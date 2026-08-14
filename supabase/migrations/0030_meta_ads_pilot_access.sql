-- Parcours pilote Meta Ads tant que l'application Meta reste en mode
-- développement. La validation du testeur reste manuelle : cette migration
-- ne contacte pas Meta et ne crée aucune permission Ads supplémentaire.

do $meta_pilot_precondition$
begin
  if to_regclass('public.app_schema_version') is null
    or not exists (
      select 1 from public.app_schema_version where id = 1 and version >= 29
    ) then
    raise exception using
      errcode = '55000',
      message = '0030 meta ads pilot access requires schema version 29';
  end if;
end;
$meta_pilot_precondition$;

create table public.meta_ads_pilot_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  facebook_email text not null,
  facebook_profile_url text,
  status text not null default 'requested'
    check (status in ('requested', 'ready', 'connected', 'declined')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  connected_at timestamptz,
  reviewer_ref text,
  unique (organization_id, requested_by),
  check (
    length(facebook_email) between 3 and 254
    and facebook_email = lower(facebook_email)
    and facebook_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  check (
    facebook_profile_url is null
    or (
      length(facebook_profile_url) between 20 and 500
      and facebook_profile_url ~ '^https://([A-Za-z0-9-]+\.)*facebook\.com/'
    )
  ),
  check (status <> 'ready' or ready_at is not null),
  check (status <> 'connected' or connected_at is not null)
);

create index meta_ads_pilot_access_status_idx
  on public.meta_ads_pilot_access_requests (status, requested_at);

alter table public.meta_ads_pilot_access_requests enable row level security;

create policy meta_ads_pilot_access_own_select
  on public.meta_ads_pilot_access_requests
  for select
  using (
    requested_by = auth.uid()
    and public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture', 'commercial']
    )
  );

revoke all on table public.meta_ads_pilot_access_requests
  from public, anon, authenticated;
grant select on table public.meta_ads_pilot_access_requests to authenticated;
grant all on table public.meta_ads_pilot_access_requests to service_role;

create or replace function public.request_meta_ads_pilot_access(
  p_organization_id uuid,
  p_actor_id uuid,
  p_facebook_email text,
  p_facebook_profile_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.meta_ads_pilot_access_requests%rowtype;
begin
  if not exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_id
      and m.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using errcode = '42501', message = 'meta pilot actor forbidden';
  end if;
  if p_facebook_email is null
    or length(p_facebook_email) not between 3 and 254
    or p_facebook_email <> lower(p_facebook_email)
    or p_facebook_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or (
      p_facebook_profile_url is not null
      and (
        length(p_facebook_profile_url) not between 20 and 500
        or p_facebook_profile_url !~ '^https://([A-Za-z0-9-]+\.)*facebook\.com/'
      )
    ) then
    raise exception using errcode = '22023', message = 'invalid meta pilot request';
  end if;

  insert into public.meta_ads_pilot_access_requests (
    organization_id, requested_by, facebook_email, facebook_profile_url
  ) values (
    p_organization_id, p_actor_id, p_facebook_email, p_facebook_profile_url
  )
  on conflict (organization_id, requested_by) do update set
    facebook_email = excluded.facebook_email,
    facebook_profile_url = excluded.facebook_profile_url,
    status = case
      when meta_ads_pilot_access_requests.status = 'ready' then 'ready'
      else 'requested'
    end,
    requested_at = case
      when meta_ads_pilot_access_requests.status = 'ready'
        then meta_ads_pilot_access_requests.requested_at
      else clock_timestamp()
    end,
    updated_at = clock_timestamp(),
    ready_at = case
      when meta_ads_pilot_access_requests.status = 'ready'
        then meta_ads_pilot_access_requests.ready_at
      else null
    end,
    connected_at = null,
    reviewer_ref = case
      when meta_ads_pilot_access_requests.status = 'ready'
        then meta_ads_pilot_access_requests.reviewer_ref
      else null
    end
  returning * into v_request;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id,
    'meta_ads_pilot_access_requested',
    'user',
    p_actor_id,
    jsonb_build_object(
      'provider', 'meta_ads',
      'request_id', v_request.id,
      'status', v_request.status,
      'profile_link_provided', p_facebook_profile_url is not null
    )
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'status', v_request.status
  );
end;
$function$;

-- Appelée manuellement par l'exploitation après ajout du compte aux rôles de
-- l'application Meta. La notification au testeur reste également manuelle.
create or replace function public.mark_meta_ads_pilot_access_ready(
  p_request_id uuid,
  p_reviewer_ref text default 'manual_meta_review'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.meta_ads_pilot_access_requests%rowtype;
begin
  if length(coalesce(p_reviewer_ref, '')) not between 3 and 120 then
    raise exception using errcode = '22023', message = 'invalid meta pilot reviewer';
  end if;
  update public.meta_ads_pilot_access_requests
  set
    status = 'ready',
    ready_at = coalesce(ready_at, clock_timestamp()),
    updated_at = clock_timestamp(),
    reviewer_ref = p_reviewer_ref
  where id = p_request_id and status in ('requested', 'ready')
  returning * into v_request;
  if not found then
    raise exception using errcode = 'P0002', message = 'meta pilot request not found';
  end if;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    v_request.organization_id,
    'meta_ads_pilot_access_ready',
    'agent',
    null,
    jsonb_build_object(
      'provider', 'meta_ads',
      'request_id', v_request.id,
      'status', 'ready',
      'reviewer_ref', p_reviewer_ref
    )
  );
  return jsonb_build_object('request_id', v_request.id, 'status', 'ready');
end;
$function$;

create or replace function public.mark_meta_ads_pilot_access_connected(
  p_organization_id uuid,
  p_actor_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.meta_ads_pilot_access_requests%rowtype;
begin
  update public.meta_ads_pilot_access_requests
  set
    status = 'connected',
    connected_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where organization_id = p_organization_id
    and requested_by = p_actor_id
    and status in ('requested', 'ready')
  returning * into v_request;
  if not found then return false; end if;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id,
    'meta_ads_pilot_access_connected',
    'user',
    p_actor_id,
    jsonb_build_object(
      'provider', 'meta_ads',
      'request_id', v_request.id,
      'status', 'connected'
    )
  );
  return true;
end;
$function$;

revoke execute on function public.request_meta_ads_pilot_access(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.request_meta_ads_pilot_access(uuid, uuid, text, text)
  to service_role;
revoke execute on function public.mark_meta_ads_pilot_access_ready(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_meta_ads_pilot_access_ready(uuid, text)
  to service_role;
revoke execute on function public.mark_meta_ads_pilot_access_connected(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.mark_meta_ads_pilot_access_connected(uuid, uuid)
  to service_role;

do $meta_pilot_postconditions$
begin
  if to_regclass('public.meta_ads_pilot_access_requests') is null
    or to_regprocedure('public.request_meta_ads_pilot_access(uuid,uuid,text,text)') is null
    or to_regprocedure('public.mark_meta_ads_pilot_access_ready(uuid,text)') is null
    or to_regprocedure('public.mark_meta_ads_pilot_access_connected(uuid,uuid)') is null then
    raise exception using
      errcode = '55000',
      message = '0030 meta ads pilot access postconditions failed';
  end if;
end;
$meta_pilot_postconditions$;

update public.app_schema_version
set version = greatest(version, 30), updated_at = now()
where id = 1;

do $meta_pilot_readiness_postcondition$
begin
  if not exists (
    select 1 from public.app_schema_version where id = 1 and version >= 30
  ) then
    raise exception using
      errcode = '55000',
      message = '0030 meta ads pilot access did not certify schema version 30';
  end if;
end;
$meta_pilot_readiness_postcondition$;
