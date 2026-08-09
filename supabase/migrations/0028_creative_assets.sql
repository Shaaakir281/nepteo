-- Créations visuelles persistées, versionnées et validées avec leur campagne.
-- Les fichiers restent dans un bucket privé ; seuls les chemins et métadonnées
-- nécessaires sont conservés en base.

do $creative_assets_prerequisites$
begin
  if to_regclass('public.app_schema_version') is null
    or not exists (
      select 1
      from public.app_schema_version
      where id = 1
        and version >= 27
    )
  then
    raise exception using
      errcode = '55000',
      message = '0028 creative assets requires schema version 27';
  end if;

  if to_regprocedure(
    'public.transition_action_decision_v2(uuid,uuid,uuid,text,text)'
  ) is null
  then
    raise exception using
      errcode = '55000',
      message = '0028 creative assets requires campaign decision cockpit';
  end if;

  if to_regclass('storage.buckets') is null
    or to_regclass('storage.objects') is null
  then
    raise exception using
      errcode = '55000',
      message = '0028 creative assets requires Supabase Storage';
  end if;
end
$creative_assets_prerequisites$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-creatives',
  'campaign-creatives',
  false,
  12582912,
  array['image/jpeg']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.creative_generation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  action_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  status text not null default 'reserved'
    check (status in ('reserved', 'succeeded', 'failed')),
  failure_reason text,
  storage_path text unique,
  storage_cleanup_token uuid,
  storage_cleanup_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (storage_cleanup_token is null) = (storage_cleanup_claimed_at is null)
  ),
  foreign key (action_id, organization_id)
    references public.actions(id, organization_id)
    on delete restrict
);

create index creative_generation_requests_org_created_idx
  on public.creative_generation_requests (organization_id, created_at desc);
create index creative_generation_requests_action_created_idx
  on public.creative_generation_requests (action_id, created_at desc)
  where action_id is not null;

create table public.creative_assets (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  action_id uuid,
  request_id uuid not null unique
    references public.creative_generation_requests(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  format text not null check (format in ('story', 'square', 'landscape')),
  headline text not null check (char_length(headline) between 3 and 500),
  storage_path text not null unique,
  mime_type text not null default 'image/jpeg' check (mime_type = 'image/jpeg'),
  model text not null,
  version integer not null check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'selected', 'validated')),
  created_at timestamptz not null default now(),
  selected_at timestamptz,
  validated_at timestamptz,
  foreign key (action_id, organization_id)
    references public.actions(id, organization_id)
    on delete restrict
);

create unique index creative_assets_action_version_unique
  on public.creative_assets (action_id, version)
  where action_id is not null;
create unique index creative_assets_one_selected_per_action
  on public.creative_assets (action_id)
  where action_id is not null and status = 'selected';
create unique index creative_assets_one_validated_per_action
  on public.creative_assets (action_id)
  where action_id is not null and status = 'validated';
create index creative_assets_org_created_idx
  on public.creative_assets (organization_id, created_at desc);

alter table public.creative_generation_requests enable row level security;
alter table public.creative_assets enable row level security;

revoke all on table public.creative_generation_requests
  from public, anon, authenticated;
revoke all on table public.creative_assets
  from public, anon, authenticated;
grant all on table public.creative_generation_requests to service_role;
grant all on table public.creative_assets to service_role;
grant select on table public.creative_assets to authenticated;

create policy creative_assets_select
on public.creative_assets
for select
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['admin', 'marketing', 'direction', 'lecture']::text[]
  )
);

create or replace function public.reserve_creative_generation(
  p_organization_id uuid,
  p_action_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  if p_organization_id is null or p_actor_id is null then
    raise exception using errcode = '22023', message = 'invalid creative reservation';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using errcode = '42501', message = 'creative reservation forbidden';
  end if;

  -- Sérialise les quotas de l'organisation avant l'appel externe payant.
  perform 1
  from public.organizations
  where id = p_organization_id
  for update;

  -- Une requête interrompue ne bloque pas indéfiniment les 5 versions d'une
  -- campagne. Elle reste toutefois comptée dans la limite quotidienne, qui
  -- protège le coût des appels fournisseur déjà engagés.
  update public.creative_generation_requests
  set status = 'failed',
      failure_reason = 'abandoned',
      completed_at = statement_timestamp()
  where organization_id = p_organization_id
    and status = 'reserved'
    and created_at < statement_timestamp() - interval '10 minutes';

  if p_action_id is not null and not exists (
    select 1
    from public.actions as action
    where action.id = p_action_id
      and action.organization_id = p_organization_id
      and action.kind = 'launch_campaign'
      and action.status in ('proposed', 'postponed', 'approved')
      and (
        action.status <> 'approved'
        or not exists (
          select 1
          from public.creative_assets as asset
          where asset.action_id = action.id
            and asset.organization_id = action.organization_id
            and asset.status = 'validated'
        )
      )
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'campaign_unavailable');
  end if;

  if (
    select count(*)
    from public.creative_generation_requests as request
    where request.organization_id = p_organization_id
      and request.created_at >= date_trunc('day', statement_timestamp())
  ) >= 20 then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit');
  end if;

  if p_action_id is not null and (
    select count(*)
    from public.creative_generation_requests as request
    where request.organization_id = p_organization_id
      and request.action_id = p_action_id
      and request.status <> 'failed'
  ) >= 5 then
    return jsonb_build_object('allowed', false, 'reason', 'campaign_limit');
  end if;

  insert into public.creative_generation_requests (
    organization_id,
    action_id,
    actor_id
  )
  values (p_organization_id, p_action_id, p_actor_id)
  returning id into v_request_id;

  return jsonb_build_object('allowed', true, 'request_id', v_request_id);
end;
$$;

revoke execute on function public.reserve_creative_generation(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_creative_generation(uuid, uuid, uuid)
  to service_role;

create or replace function public.record_creative_asset(
  p_id uuid,
  p_organization_id uuid,
  p_action_id uuid,
  p_request_id uuid,
  p_actor_id uuid,
  p_format text,
  p_headline text,
  p_storage_path text,
  p_model text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer := 1;
  v_status text := 'draft';
  v_action_status text;
begin
  if p_id is null
    or p_organization_id is null
    or p_request_id is null
    or p_actor_id is null
    or p_format not in ('story', 'square', 'landscape')
    or char_length(btrim(coalesce(p_headline, ''))) not between 3 and 500
    or btrim(coalesce(p_storage_path, '')) = ''
    or btrim(coalesce(p_model, '')) = ''
  then
    raise exception using errcode = '22023', message = 'invalid creative asset';
  end if;

  perform 1
  from public.organizations
  where id = p_organization_id
  for update;

  if not exists (
    select 1
    from public.creative_generation_requests as request
    where request.id = p_request_id
      and request.organization_id = p_organization_id
      and request.action_id is not distinct from p_action_id
      and request.actor_id = p_actor_id
      and request.status = 'reserved'
      and request.storage_path = p_storage_path
  ) then
    raise exception using errcode = '55000', message = 'creative reservation unavailable';
  end if;

  if p_action_id is not null then
    select action.status
    into v_action_status
    from public.actions as action
    where action.id = p_action_id
      and action.organization_id = p_organization_id
      and action.kind = 'launch_campaign'
      and action.status in ('proposed', 'postponed', 'approved');

    if not found or (
      v_action_status = 'approved'
      and exists (
        select 1
        from public.creative_assets as asset
        where asset.action_id = p_action_id
          and asset.organization_id = p_organization_id
          and asset.status = 'validated'
      )
    ) then
      raise exception using errcode = '55000', message = 'creative campaign unavailable';
    end if;

    select coalesce(max(asset.version), 0) + 1
    into v_version
    from public.creative_assets as asset
    where asset.action_id = p_action_id;

    if v_action_status <> 'approved' then
      update public.creative_assets
      set status = 'draft', selected_at = null
      where action_id = p_action_id
        and organization_id = p_organization_id
        and status = 'selected';

      v_status := 'selected';
    end if;
  end if;

  insert into public.creative_assets (
    id,
    organization_id,
    action_id,
    request_id,
    created_by,
    format,
    headline,
    storage_path,
    model,
    version,
    status,
    selected_at
  )
  values (
    p_id,
    p_organization_id,
    p_action_id,
    p_request_id,
    p_actor_id,
    p_format,
    btrim(p_headline),
    p_storage_path,
    p_model,
    v_version,
    v_status,
    case when v_status = 'selected' then statement_timestamp() else null end
  );

  insert into public.journal (
    organization_id,
    action_id,
    event,
    actor,
    actor_id,
    payload
  )
  values (
    p_organization_id,
    p_action_id,
    'creative_image_generated',
    'agent',
    p_actor_id,
    jsonb_build_object(
      'creative_id', p_id,
      'format', p_format,
      'model', p_model,
      'version', v_version
    )
  );

  update public.creative_generation_requests
  set status = 'succeeded', completed_at = statement_timestamp()
  where id = p_request_id;

  return jsonb_build_object(
    'id', p_id,
    'version', v_version,
    'status', v_status,
    'storage_path', p_storage_path
  );
end;
$$;

revoke execute on function public.record_creative_asset(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_creative_asset(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text
) to service_role;

create or replace function public.claim_creative_storage_cleanup(
  p_request_id uuid,
  p_organization_id uuid,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  if p_request_id is null
    or p_organization_id is null
    or btrim(coalesce(p_storage_path, '')) = ''
  then
    raise exception using errcode = '22023', message = 'invalid creative cleanup claim';
  end if;

  perform 1
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  update public.creative_generation_requests as request
  set status = 'failed',
      failure_reason = case
        when request.status = 'reserved' then 'abandoned'
        else coalesce(request.failure_reason, 'storage_cleanup')
      end,
      completed_at = coalesce(request.completed_at, statement_timestamp()),
      storage_cleanup_token = v_token,
      storage_cleanup_claimed_at = statement_timestamp()
  where request.id = p_request_id
    and request.organization_id = p_organization_id
    and request.storage_path = p_storage_path
    and (
      request.status = 'failed'
      or (
        request.status = 'reserved'
        and request.created_at < statement_timestamp() - interval '10 minutes'
      )
    )
    and (
      request.storage_cleanup_token is null
      or request.storage_cleanup_claimed_at
        < statement_timestamp() - interval '10 minutes'
    )
    and not exists (
      select 1
      from public.creative_assets as asset
      where asset.request_id = request.id
    );

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  return jsonb_build_object('claimed', true, 'token', v_token);
end;
$$;

revoke execute on function public.claim_creative_storage_cleanup(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_creative_storage_cleanup(uuid, uuid, text)
  to service_role;

create or replace function public.finish_creative_storage_cleanup(
  p_request_id uuid,
  p_organization_id uuid,
  p_storage_path text,
  p_cleanup_token uuid,
  p_removed boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_request_id is null
    or p_organization_id is null
    or btrim(coalesce(p_storage_path, '')) = ''
    or p_cleanup_token is null
    or p_removed is null
  then
    raise exception using errcode = '22023', message = 'invalid creative cleanup result';
  end if;

  perform 1
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    return false;
  end if;

  update public.creative_generation_requests as request
  set storage_path = case when p_removed then null else request.storage_path end,
      storage_cleanup_token = null,
      storage_cleanup_claimed_at = null,
      failure_reason = case
        when p_removed then 'storage_cleaned'
        else request.failure_reason
      end,
      completed_at = coalesce(request.completed_at, statement_timestamp())
  where request.id = p_request_id
    and request.organization_id = p_organization_id
    and request.storage_path = p_storage_path
    and request.status = 'failed'
    and request.storage_cleanup_token = p_cleanup_token;

  return found;
end;
$$;

revoke execute on function public.finish_creative_storage_cleanup(
  uuid, uuid, text, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.finish_creative_storage_cleanup(
  uuid, uuid, text, uuid, boolean
) to service_role;

create or replace function public.select_creative_asset(
  p_organization_id uuid,
  p_action_id uuid,
  p_creative_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selected public.creative_assets%rowtype;
  v_action_status text;
  v_target_status text;
  v_event text;
begin
  if p_organization_id is null
    or p_action_id is null
    or p_creative_id is null
    or p_actor_id is null
  then
    raise exception using errcode = '22023', message = 'invalid creative selection';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using errcode = '42501', message = 'creative selection forbidden';
  end if;

  perform 1
  from public.organizations
  where id = p_organization_id
  for update;

  select *
  into v_selected
  from public.creative_assets as asset
  where asset.id = p_creative_id
    and asset.organization_id = p_organization_id
    and asset.action_id = p_action_id
    and asset.status in ('draft', 'selected', 'validated');

  if not found then
    return jsonb_build_object('changed', false);
  end if;

  select action.status
  into v_action_status
  from public.actions as action
  where action.id = p_action_id
    and action.organization_id = p_organization_id
    and action.kind = 'launch_campaign'
    and action.status in ('proposed', 'postponed', 'approved');

  if not found then
    return jsonb_build_object('changed', false);
  end if;

  if v_action_status = 'approved' and exists (
    select 1
    from public.creative_assets as asset
    where asset.action_id = p_action_id
      and asset.organization_id = p_organization_id
      and asset.status = 'validated'
      and asset.id <> p_creative_id
  ) then
    return jsonb_build_object('changed', false);
  end if;

  if v_action_status = 'approved' then
    v_target_status := 'validated';
    v_event := 'creative_image_validated';
  else
    v_target_status := 'selected';
    v_event := 'creative_image_selected';
  end if;

  if v_selected.status = v_target_status then
    return jsonb_build_object(
      'changed', false,
      'selected', true,
      'status', v_target_status
    );
  end if;

  update public.creative_assets
  set status = 'draft', selected_at = null, validated_at = null
  where action_id = p_action_id
    and organization_id = p_organization_id
    and status in ('selected', 'validated');

  update public.creative_assets
  set status = v_target_status,
      selected_at = statement_timestamp(),
      validated_at = case
        when v_target_status = 'validated' then statement_timestamp()
        else null
      end
  where id = p_creative_id;

  insert into public.journal (
    organization_id,
    action_id,
    event,
    actor,
    actor_id,
    payload
  )
  values (
    p_organization_id,
    p_action_id,
    v_event,
    'user',
    p_actor_id,
    jsonb_build_object('creative_id', p_creative_id, 'version', v_selected.version)
  );

  return jsonb_build_object(
    'changed', true,
    'selected', true,
    'status', v_target_status
  );
end;
$$;

revoke execute on function public.select_creative_asset(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.select_creative_asset(uuid, uuid, uuid, uuid)
  to service_role;

-- La décision campagne et la validation de son visuel sélectionné partagent
-- désormais la même transaction et la même trace de journal.
create or replace function public.transition_action_decision_v2(
  p_organization_id uuid,
  p_action_id uuid,
  p_actor_id uuid,
  p_transition text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_status text;
  v_target_status text;
  v_event text;
  v_reason text;
  v_action public.actions%rowtype;
  v_creative_id uuid;
begin
  if p_organization_id is null
    or p_action_id is null
    or p_actor_id is null
  then
    raise exception using errcode = '22023', message = 'invalid action transition';
  end if;

  v_reason := nullif(
    btrim(
      regexp_replace(
        regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]', ' ', 'g'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using errcode = '42501', message = 'action transition forbidden';
  end if;

  -- Partage le verrou des opérations de création/sélection : la validation
  -- d'une campagne et l'enregistrement de son visuel restent atomiques.
  perform 1
  from public.organizations
  where id = p_organization_id
  for update;

  case p_transition
    when 'approve' then
      v_expected_status := 'proposed';
      v_target_status := 'approved';
      v_event := 'action_approved';
    when 'reject' then
      v_expected_status := 'proposed';
      v_target_status := 'rejected';
      v_event := 'action_rejected';
    when 'postpone' then
      v_expected_status := 'proposed';
      v_target_status := 'postponed';
      v_event := 'action_postponed';
    when 'resume' then
      v_expected_status := 'postponed';
      v_target_status := 'proposed';
      v_event := 'action_resumed';
    else
      raise exception using errcode = '22023', message = 'unknown action transition';
  end case;

  if p_transition = 'reject'
    and (
      v_reason is null
      or char_length(v_reason) not between 3 and 500
    )
  then
    raise exception using
      errcode = '22023',
      message = 'rejection reason must contain 3 to 500 characters';
  end if;

  if p_transition <> 'reject'
    and v_reason is not null
    and char_length(v_reason) not between 3 and 500
  then
    raise exception using
      errcode = '22023',
      message = 'decision reason must contain 3 to 500 characters';
  end if;

  update public.actions
  set
    status = v_target_status,
    decided_by = case when p_transition = 'resume' then null else p_actor_id end,
    decided_at = case
      when p_transition = 'resume' then null
      else statement_timestamp()
    end,
    decision_reason = case
      when p_transition = 'resume' then null
      else v_reason
    end
  where id = p_action_id
    and organization_id = p_organization_id
    and status = v_expected_status
  returning * into v_action;

  if not found then
    return jsonb_build_object('changed', false);
  end if;

  if p_transition = 'approve' and v_action.kind = 'launch_campaign' then
    update public.creative_assets
    set status = 'validated', validated_at = statement_timestamp()
    where id = (
      select asset.id
      from public.creative_assets as asset
      where asset.organization_id = p_organization_id
        and asset.action_id = p_action_id
        and asset.status = 'selected'
      order by asset.version desc
      limit 1
    )
    returning id into v_creative_id;
  end if;

  insert into public.journal (
    organization_id,
    action_id,
    event,
    actor,
    actor_id,
    payload
  )
  values (
    p_organization_id,
    p_action_id,
    v_event,
    'user',
    p_actor_id,
    jsonb_build_object(
      'kind', v_action.kind,
      'title', v_action.title,
      'reason', v_action.decision_reason,
      'creative_id', v_creative_id
    )
  );

  return jsonb_build_object(
    'changed', true,
    'status', v_target_status,
    'reason', v_action.decision_reason,
    'creative_id', v_creative_id
  );
end;
$$;

revoke execute on function public.transition_action_decision_v2(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.transition_action_decision_v2(
  uuid, uuid, uuid, text, text
) to service_role;

comment on function public.transition_action_decision_v2(
  uuid, uuid, uuid, text, text
) is
  'Atomically records a bounded decision reason and validates the selected campaign creative.';

do $creative_assets_postconditions$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'campaign-creatives' and public = false
  )
    or to_regclass('public.creative_assets') is null
    or to_regclass('public.creative_generation_requests') is null
    or to_regprocedure(
      'public.claim_creative_storage_cleanup(uuid,uuid,text)'
    ) is null
    or to_regprocedure(
      'public.finish_creative_storage_cleanup(uuid,uuid,text,uuid,boolean)'
    ) is null
    or position(
      'creative_assets'
      in pg_get_functiondef(
        'public.transition_action_decision_v2(uuid,uuid,uuid,text,text)'::regprocedure
      )
    ) = 0
  then
    raise exception using errcode = '55000', message = '0028 creative assets postconditions failed';
  end if;
end
$creative_assets_postconditions$;

update public.app_schema_version
set version = greatest(version, 28),
    updated_at = now()
where id = 1
  and version >= 27;

do $creative_assets_readiness_postcondition$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1
      and version >= 28
  ) then
    raise exception using
      errcode = '55000',
      message = '0028 creative assets did not certify schema version 28';
  end if;
end
$creative_assets_readiness_postcondition$;
