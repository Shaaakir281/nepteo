-- Preuve de valeur commanditaire, structurée et minimisée.
--
-- Ces événements décrivent uniquement le jugement ou le résultat déclaré
-- autour d'une action. Ils ne modifient ni l'action, ni l'outbox, et ne
-- constituent jamais une preuve fournisseur d'envoi ou de livraison.

do $value_events_prerequisites$
begin
  if to_regclass('public.app_schema_version') is null
    or not exists (
      select 1
      from public.app_schema_version
      where id = 1
        and version >= 19
    )
  then
    raise exception using
      errcode = '55000',
      message = '0020 value events requires schema version 19';
  end if;
end
$value_events_prerequisites$;

-- R2 introduit un nouveau kind de relance après les allowlists de 0015/0018.
-- Les redéfinir ici garde les environnements ayant déjà appliqué ces versions
-- alignés avec l'application, sans élargir les rôles ni l'autonomie.
create or replace function public.is_commercial_safe_action_kind(
  action_kind text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    action_kind in (
      'complete_missing_emails',
      'relaunch_priority',
      'relaunch_dormant',
      'classify_unlabeled',
      'dedupe_emails',
      'complete_missing_company'
    )
    or left(action_kind, 15) = 'relaunch_stage_',
    false
  );
$$;

create or replace function public.claim_action_execution(
  p_organization_id uuid,
  p_action_id uuid,
  p_actor_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paused boolean;
  v_autonomy text;
  v_kind text;
  v_status text;
  v_existing_key text;
  v_payload jsonb;
begin
  if p_organization_id is null
    or p_action_id is null
    or p_actor_id is null
    or p_idempotency_key is distinct from ('exec:' || p_action_id::text)
  then
    raise exception using
      errcode = '22023',
      message = 'invalid execution claim';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using
      errcode = '42501',
      message = 'execution claim forbidden';
  end if;

  select organization.execution_paused, organization.autonomy_level
    into v_paused, v_autonomy
    from public.organizations as organization
    where organization.id = p_organization_id
    for update;

  if not found then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'organization_not_found'
    );
  end if;
  if v_paused then
    return jsonb_build_object('claimed', false, 'reason', 'blocked_paused');
  end if;
  if v_autonomy = 'suggest' then
    return jsonb_build_object('claimed', false, 'reason', 'blocked_autonomy');
  end if;
  if v_autonomy is distinct from 'prepare' then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'organization_guard_invalid'
    );
  end if;

  update public.actions as action
  set idempotency_key = p_idempotency_key
  where action.id = p_action_id
    and action.organization_id = p_organization_id
    and action.status = 'approved'
    and action.idempotency_key is null
    and (
      action.kind = 'relaunch_priority'
      or action.kind = 'relaunch_dormant'
      or left(action.kind, 15) = 'relaunch_stage_'
      or left(action.kind, 10) = 'ads_pause_'
    )
  returning action.kind, action.payload
    into v_kind, v_payload;

  if not found then
    select action.kind, action.status, action.idempotency_key
      into v_kind, v_status, v_existing_key
      from public.actions as action
      where action.id = p_action_id
        and action.organization_id = p_organization_id;

    if not found then
      return jsonb_build_object('claimed', false, 'reason', 'not_found');
    end if;
    if not (
      v_kind = 'relaunch_priority'
      or v_kind = 'relaunch_dormant'
      or left(v_kind, 15) = 'relaunch_stage_'
      or left(v_kind, 10) = 'ads_pause_'
    ) then
      return jsonb_build_object('claimed', false, 'reason', 'not_executable');
    end if;
    if v_status = 'executed' then
      return jsonb_build_object(
        'claimed', false,
        'reason', 'already_executed'
      );
    end if;
    if v_status <> 'approved' then
      return jsonb_build_object('claimed', false, 'reason', 'not_approved');
    end if;
    if v_existing_key is not null then
      return jsonb_build_object(
        'claimed', false,
        'reason', 'claim_held_recovery_required'
      );
    end if;

    return jsonb_build_object(
      'claimed', false,
      'reason', 'claim_conflict_retry_required'
    );
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
    'execution_started',
    'user',
    p_actor_id,
    jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  return jsonb_build_object(
    'claimed', true,
    'action', jsonb_build_object('kind', v_kind, 'payload', v_payload)
  );
end;
$$;

revoke execute on function public.claim_action_execution(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.claim_action_execution(
  uuid,
  uuid,
  uuid,
  text
) to service_role;

alter table public.actions
  add constraint actions_id_organization_unique
  unique (id, organization_id);

alter table public.prospects
  add constraint prospects_id_organization_unique
  unique (id, organization_id);

-- Cohorte figée au moment de l'approbation d'une relance. Sans ce snapshot,
-- un prospect disparaîtrait de la saisie terrain dès qu'un connecteur met à
-- jour son dernier contact ou son statut à la suite de la relance.
create table public.action_target_snapshots (
  action_id uuid primary key,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  captured_at timestamptz not null default now(),
  captured_by uuid references auth.users(id) on delete set null,
  unique (action_id, organization_id),
  constraint action_target_snapshots_action_organization_fkey
    foreign key (action_id, organization_id)
    references public.actions(id, organization_id)
    on delete cascade
);

create table public.action_target_snapshot_members (
  action_id uuid not null,
  organization_id uuid not null,
  prospect_id uuid not null,
  primary key (action_id, prospect_id),
  constraint action_target_members_snapshot_organization_fkey
    foreign key (action_id, organization_id)
    references public.action_target_snapshots(action_id, organization_id)
    on delete cascade,
  constraint action_target_members_prospect_organization_fkey
    foreign key (prospect_id, organization_id)
    references public.prospects(id, organization_id)
    on delete cascade
);

create index action_target_snapshots_org_captured_idx
  on public.action_target_snapshots (organization_id, captured_at desc);
create index action_target_members_org_prospect_idx
  on public.action_target_snapshot_members (organization_id, prospect_id);

alter table public.action_target_snapshots enable row level security;
alter table public.action_target_snapshot_members enable row level security;

create policy action_target_snapshots_select
  on public.action_target_snapshots
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction']
    )
  );

create policy action_target_snapshot_members_select
  on public.action_target_snapshot_members
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction']
    )
  );

revoke all on table public.action_target_snapshots
  from public, anon, authenticated;
revoke all on table public.action_target_snapshot_members
  from public, anon, authenticated;
grant select on table public.action_target_snapshots to authenticated;
grant select on table public.action_target_snapshot_members to authenticated;
revoke update on table public.action_target_snapshots from service_role;
revoke update on table public.action_target_snapshot_members from service_role;
grant select, insert, delete on table public.action_target_snapshots
  to service_role;
grant select, insert, delete on table public.action_target_snapshot_members
  to service_role;

create table public.value_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  -- L'action est exigée à l'insertion par la RPC. Elle peut ensuite devenir
  -- NULL si l'objet opérationnel est supprimé, afin de conserver la preuve
  -- minimisée sans bloquer l'effacement.
  action_id uuid,
  -- Conservé même si l'action est ensuite effacée : la scorecard du play ne
  -- doit ni perdre ni réattribuer une preuve historique devenue orpheline.
  action_kind text not null check (length(action_kind) between 1 and 100),
  prospect_id uuid,
  event_type text not null check (
    event_type in (
      'suggestion_useful',
      'suggestion_not_useful',
      'false_positive',
      'draft_reviewed',
      'manual_followup_sent',
      'reply_received',
      'meeting_booked',
      'opportunity_created'
    )
  ),
  source text not null check (source in ('manual', 'gmail', 'microsoft')),
  -- Dérivé du marqueur démo de l'action, jamais fourni par le client.
  is_demo boolean not null,
  false_positive_reason text check (
    false_positive_reason in (
      'recent_contact',
      'already_replied',
      'opted_out',
      'wrong_person',
      'terminal_stage',
      'missing_context',
      'other'
    )
  ),
  edit_level text check (edit_level in ('none', 'light', 'significant')),
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null check (
    length(idempotency_key) between 1 and 200
    and idempotency_key !~ '[[:space:]]'
  ),
  constraint value_events_action_organization_fkey
    foreign key (action_id, organization_id)
    references public.actions(id, organization_id)
    on delete set null (action_id),
  constraint value_events_prospect_organization_fkey
    foreign key (prospect_id, organization_id)
    references public.prospects(id, organization_id)
    on delete set null (prospect_id),
  constraint value_events_reason_shape check (
    (
      event_type = 'false_positive'
      and false_positive_reason is not null
    )
    or (
      event_type <> 'false_positive'
      and false_positive_reason is null
    )
  ),
  constraint value_events_edit_shape check (
    (
      event_type = 'draft_reviewed'
      and edit_level is not null
    )
    or (
      event_type <> 'draft_reviewed'
      and edit_level is null
    )
  ),
  constraint value_events_source_shape check (
    event_type in (
      'reply_received',
      'meeting_booked',
      'opportunity_created'
    )
    or source = 'manual'
  ),
  unique (organization_id, idempotency_key)
);

create index value_events_org_occurred_idx
  on public.value_events (organization_id, occurred_at desc);
create index value_events_org_kind_occurred_idx
  on public.value_events (
    organization_id,
    action_kind,
    is_demo,
    occurred_at desc,
    id desc
  );
create index value_events_action_occurred_idx
  on public.value_events (action_id, occurred_at desc);
create index value_events_prospect_occurred_idx
  on public.value_events (prospect_id, occurred_at desc)
  where prospect_id is not null;

alter table public.value_events enable row level security;

create policy value_events_select
  on public.value_events
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction']
    )
  );

-- Les JWT applicatifs peuvent lire les événements autorisés par la RLS. Le
-- service role peut insérer et effectuer un effacement RGPD, mais jamais
-- réécrire un événement existant.
revoke all on table public.value_events from public, anon, authenticated;
grant select on table public.value_events to authenticated;
revoke update on table public.value_events from service_role;
grant select, insert, delete on table public.value_events to service_role;

-- Le serveur calcule la cible avec les mêmes règles pures que l'aperçu. La RPC
-- fige la cohorte, approuve l'action et journalise la décision dans une seule
-- transaction. Les références inter-organisation sont refusées en profondeur.
create or replace function public.approve_relaunch_action_with_targets(
  p_organization_id uuid,
  p_action_id uuid,
  p_actor_id uuid,
  p_prospect_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action public.actions%rowtype;
  v_target_count integer;
begin
  if p_organization_id is null
    or p_action_id is null
    or p_actor_id is null
    or p_prospect_ids is null
    or cardinality(p_prospect_ids) = 0
    or cardinality(p_prospect_ids) > 50
  then
    raise exception using
      errcode = '22023',
      message = 'invalid relaunch approval';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using
      errcode = '42501',
      message = 'relaunch approval forbidden';
  end if;

  select action.*
    into v_action
    from public.actions as action
    where action.id = p_action_id
      and action.organization_id = p_organization_id
    for update;

  if not found then
    return jsonb_build_object('changed', false, 'reason', 'not_found');
  end if;

  if v_action.kind not in ('relaunch_priority', 'relaunch_dormant')
    and position('relaunch_stage_' in v_action.kind) <> 1
  then
    return jsonb_build_object('changed', false, 'reason', 'not_relaunch');
  end if;

  if v_action.status <> 'proposed' then
    return jsonb_build_object(
      'changed',
      false,
      'reason',
      'invalid_status'
    );
  end if;

  if exists (
    select 1
    from unnest(p_prospect_ids) as target(prospect_id)
    left join public.prospects as prospect
      on prospect.id = target.prospect_id
      and prospect.organization_id = p_organization_id
    where target.prospect_id is null
      or prospect.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'action target outside organization';
  end if;

  insert into public.action_target_snapshots (
    action_id,
    organization_id,
    captured_by
  )
  values (
    p_action_id,
    p_organization_id,
    p_actor_id
  );

  insert into public.action_target_snapshot_members (
    action_id,
    organization_id,
    prospect_id
  )
  select
    p_action_id,
    p_organization_id,
    target.prospect_id
  from (
    select distinct prospect_id
    from unnest(p_prospect_ids) as candidate(prospect_id)
  ) as target;

  get diagnostics v_target_count = row_count;

  update public.actions
  set
    status = 'approved',
    decided_by = p_actor_id,
    decided_at = statement_timestamp(),
    payload = case
      when v_action.kind = 'relaunch_dormant' then
        jsonb_set(
          v_action.payload,
          '{approved_target_count}',
          to_jsonb(v_target_count),
          true
        )
      else v_action.payload
    end
  where id = p_action_id
    and organization_id = p_organization_id
    and status = 'proposed';

  if not found then
    raise exception using
      errcode = '40001',
      message = 'relaunch approval lost its compare-and-set';
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
    'action_approved',
    'user',
    p_actor_id,
    jsonb_build_object('kind', v_action.kind, 'title', v_action.title)
  );

  return jsonb_build_object(
    'changed',
    true,
    'status',
    'approved',
    'target_count',
    v_target_count
  );
end;
$$;

revoke execute on function public.approve_relaunch_action_with_targets(
  uuid,
  uuid,
  uuid,
  uuid[]
) from public, anon, authenticated;
grant execute on function public.approve_relaunch_action_with_targets(
  uuid,
  uuid,
  uuid,
  uuid[]
) to service_role;

comment on table public.action_target_snapshots is
  'Immutable relaunch cohort captured before the human approval transition.';
comment on table public.action_target_snapshot_members is
  'Tenant-safe prospect membership of an immutable action target snapshot.';
comment on function public.approve_relaunch_action_with_targets(
  uuid,
  uuid,
  uuid,
  uuid[]
) is
  'Atomically freezes up to 50 relaunch targets, approves, and journals.';

-- L'insertion, sa déduplication et sa trace de journal partagent une
-- transaction PostgreSQL. Une nouvelle clé est possible pour un événement
-- compensatoire (par exemple faux positif après "utile"), mais un double clic
-- sur le même fait est absorbé.
create or replace function public.record_value_event(
  p_organization_id uuid,
  p_action_id uuid,
  p_prospect_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_false_positive_reason text,
  p_edit_level text,
  p_submission_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_key text;
  v_event_id uuid;
  v_existing public.value_events%rowtype;
  v_is_demo boolean;
  v_action_kind text;
  v_action_status text;
  v_action_payload jsonb;
begin
  if p_organization_id is null
    or p_action_id is null
    or p_actor_id is null
    or p_event_type is null
    or p_source is null
    or p_submission_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'invalid value event';
  end if;

  if p_event_type not in (
    'suggestion_useful',
    'suggestion_not_useful',
    'false_positive',
    'draft_reviewed',
    'manual_followup_sent',
    'reply_received',
    'meeting_booked',
    'opportunity_created'
  )
    or p_source not in ('manual', 'gmail', 'microsoft')
  then
    raise exception using
      errcode = '22023',
      message = 'invalid value event classification';
  end if;

  if (
    p_event_type = 'false_positive'
    and (
      p_false_positive_reason is null
      or p_false_positive_reason not in (
        'recent_contact',
        'already_replied',
        'opted_out',
        'wrong_person',
        'terminal_stage',
        'missing_context',
        'other'
      )
    )
  )
    or (
      p_event_type <> 'false_positive'
      and p_false_positive_reason is not null
  )
    or (
      p_event_type = 'draft_reviewed'
      and (
        p_edit_level is null
        or p_edit_level not in ('none', 'light', 'significant')
      )
    )
    or (
      p_event_type <> 'draft_reviewed'
      and p_edit_level is not null
    )
    or (
      p_event_type not in (
        'reply_received',
        'meeting_booked',
        'opportunity_created'
      )
      and p_source <> 'manual'
    )
  then
    raise exception using
      errcode = '22023',
      message = 'invalid value event detail';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using
      errcode = '42501',
      message = 'value event forbidden';
  end if;

  select
      action.kind,
      action.status,
      action.payload,
      action.payload @> '{"demo": true}'::jsonb
    into v_action_kind, v_action_status, v_action_payload, v_is_demo
    from public.actions as action
    where action.id = p_action_id
      and action.organization_id = p_organization_id;

  if not found then
    return jsonb_build_object('recorded', false, 'reason', 'not_found');
  end if;

  if p_event_type in (
    'draft_reviewed',
    'manual_followup_sent',
    'reply_received',
    'meeting_booked',
    'opportunity_created'
  )
    and not (
      v_action_kind = 'relaunch_priority'
      or v_action_kind = 'relaunch_dormant'
      or left(v_action_kind, 15) = 'relaunch_stage_'
    )
  then
    raise exception using
      errcode = '22023',
      message = 'value event incompatible with action kind';
  end if;

  if p_prospect_id is not null
    and not exists (
      select 1
      from public.prospects as prospect
      where prospect.id = p_prospect_id
        and prospect.organization_id = p_organization_id
    )
  then
    return jsonb_build_object(
      'recorded',
      false,
      'reason',
      'prospect_not_found'
    );
  end if;

  if p_event_type in (
    'manual_followup_sent',
    'reply_received',
    'meeting_booked',
    'opportunity_created'
  ) then
    if p_prospect_id is null
      or v_action_status not in ('approved', 'executed')
    then
      raise exception using
        errcode = '22023',
        message = 'declared outcome requires an approved prospect';
    end if;

    if exists (
      select 1
      from public.action_target_snapshots as snapshot
      where snapshot.action_id = p_action_id
        and snapshot.organization_id = p_organization_id
    ) then
      if not exists (
        select 1
        from public.action_target_snapshot_members as member
        where member.action_id = p_action_id
          and member.organization_id = p_organization_id
          and member.prospect_id = p_prospect_id
      ) then
        raise exception using
          errcode = '23503',
          message = 'declared outcome outside action cohort';
      end if;
    elsif v_action_kind = 'relaunch_dormant' then
      raise exception using
        errcode = '23503',
        message = 'dormant outcome requires an action cohort';
    elsif not (
      coalesce(v_action_payload -> 'prospect_drafts', '{}'::jsonb)
        ? p_prospect_id::text
      or exists (
        select 1
        from public.outbox_messages as message
        where message.action_id = p_action_id
          and message.organization_id = p_organization_id
          and message.prospect_id = p_prospect_id
      )
      or exists (
        select 1
        from public.value_events as prior_event
        where prior_event.action_id = p_action_id
          and prior_event.organization_id = p_organization_id
          and prior_event.prospect_id = p_prospect_id
      )
    ) then
      raise exception using
        errcode = '23503',
        message = 'declared outcome has no historical target';
    end if;
  end if;

  v_expected_key :=
    'value:'
    || lower(p_action_id::text)
    || ':'
    || lower(p_submission_id::text);

  if p_idempotency_key is distinct from v_expected_key then
    raise exception using
      errcode = '22023',
      message = 'invalid value event idempotency key';
  end if;

  insert into public.value_events (
    organization_id,
    action_id,
    action_kind,
    prospect_id,
    event_type,
    source,
    is_demo,
    false_positive_reason,
    edit_level,
    actor_id,
    idempotency_key
  )
  values (
    p_organization_id,
    p_action_id,
    v_action_kind,
    p_prospect_id,
    p_event_type,
    p_source,
    v_is_demo,
    p_false_positive_reason,
    p_edit_level,
    p_actor_id,
    p_idempotency_key
  )
  on conflict (organization_id, idempotency_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select *
      into v_existing
      from public.value_events as value_event
      where value_event.organization_id = p_organization_id
        and value_event.idempotency_key = p_idempotency_key;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'value event replay unavailable';
    end if;

    if v_existing.action_id is distinct from p_action_id
      or v_existing.action_kind is distinct from v_action_kind
      or v_existing.prospect_id is distinct from p_prospect_id
      or v_existing.event_type is distinct from p_event_type
      or v_existing.source is distinct from p_source
      or v_existing.is_demo is distinct from v_is_demo
      or v_existing.false_positive_reason
        is distinct from p_false_positive_reason
      or v_existing.edit_level is distinct from p_edit_level
      or v_existing.actor_id is distinct from p_actor_id
    then
      raise exception using
        errcode = '23505',
        message = 'value event idempotency payload conflict';
    end if;

    return jsonb_build_object('recorded', false, 'reason', 'duplicate');
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
    'value_event_recorded',
    'user',
    p_actor_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'value_event_id', v_event_id,
        'event_type', p_event_type,
        'source', p_source,
        'is_demo', v_is_demo,
        'false_positive_reason', p_false_positive_reason,
        'edit_level', p_edit_level
      )
    )
  );

  return jsonb_build_object(
    'recorded',
    true,
    'value_event_id',
    v_event_id
  );
end;
$$;

revoke execute on function public.record_value_event(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.record_value_event(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text
) to service_role;

comment on table public.value_events is
  'Minimized, structured evidence about human-reviewed suggestions and declared outcomes.';
comment on function public.record_value_event(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text
) is
  'Idempotently records one structured value event and its audit entry.';

-- Vérifie la frontière avant de certifier la version 20.
do $value_events_postconditions$
begin
  if coalesce(
      position(
        'relaunch_dormant'
        in pg_catalog.pg_get_functiondef(
          'public.claim_action_execution(uuid,uuid,uuid,text)'::regprocedure
        )
      ),
      0
    ) = 0
    or coalesce(
      position(
        'relaunch_dormant'
        in pg_catalog.pg_get_functiondef(
          'public.is_commercial_safe_action_kind(text)'::regprocedure
        )
      ),
      0
    ) = 0
  then
    raise exception using
      errcode = '55000',
      message = '0020 dormant play allowlists are not aligned';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as table_def
    where table_def.oid = 'public.action_target_snapshots'::regclass
      and table_def.relrowsecurity
  )
    or not exists (
      select 1
      from pg_catalog.pg_class as table_def
      where table_def.oid =
        'public.action_target_snapshot_members'::regclass
        and table_def.relrowsecurity
    )
    or not exists (
      select 1
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'action_target_snapshots'
        and policyname = 'action_target_snapshots_select'
        and cmd = 'SELECT'
        and coalesce(qual, '') like '%has_org_role%'
        and coalesce(qual, '') not like '%commercial%'
        and coalesce(qual, '') not like '%lecture%'
    )
    or not exists (
      select 1
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'action_target_snapshot_members'
        and policyname = 'action_target_snapshot_members_select'
        and cmd = 'SELECT'
        and coalesce(qual, '') like '%has_org_role%'
        and coalesce(qual, '') not like '%commercial%'
        and coalesce(qual, '') not like '%lecture%'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0020 action target snapshots found unsafe RLS policies';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as table_def
    where table_def.oid = 'public.value_events'::regclass
      and table_def.relrowsecurity
  )
    or not exists (
      select 1
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'value_events'
        and policyname = 'value_events_select'
        and cmd = 'SELECT'
        and coalesce(qual, '') like '%has_org_role%'
        and coalesce(qual, '') like '%admin%'
        and coalesce(qual, '') like '%marketing%'
        and coalesce(qual, '') like '%direction%'
        and coalesce(qual, '') not like '%commercial%'
        and coalesce(qual, '') not like '%lecture%'
    )
    or (
      select count(*)
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'value_events'
    ) <> 1
  then
    raise exception using
      errcode = '55000',
      message = '0020 value events found unsafe RLS policies';
  end if;

  if not pg_catalog.has_table_privilege(
    'authenticated',
    'public.value_events',
    'SELECT'
  )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.value_events',
      'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.value_events',
      'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.value_events',
      'DELETE'
    )
    or pg_catalog.has_any_column_privilege(
      'anon',
      'public.value_events',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.value_events',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.value_events',
      'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.value_events',
      'UPDATE'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.value_events',
      'DELETE'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0020 value events found unsafe table privileges';
  end if;

  if not pg_catalog.has_table_privilege(
      'authenticated',
      'public.action_target_snapshots',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'authenticated',
      'public.action_target_snapshot_members',
      'SELECT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.action_target_snapshots',
      'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.action_target_snapshots',
      'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.action_target_snapshots',
      'DELETE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.action_target_snapshot_members',
      'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.action_target_snapshot_members',
      'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.action_target_snapshot_members',
      'DELETE'
    )
    or pg_catalog.has_any_column_privilege(
      'anon',
      'public.action_target_snapshots',
      'SELECT'
    )
    or pg_catalog.has_any_column_privilege(
      'anon',
      'public.action_target_snapshot_members',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.action_target_snapshots',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.action_target_snapshots',
      'INSERT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.action_target_snapshots',
      'DELETE'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.action_target_snapshot_members',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.action_target_snapshot_members',
      'INSERT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.action_target_snapshot_members',
      'DELETE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.action_target_snapshots',
      'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.action_target_snapshot_members',
      'UPDATE'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0020 action target snapshots found unsafe privileges';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated',
    'public.record_value_event(uuid,uuid,uuid,uuid,text,text,text,text,uuid,text)',
    'EXECUTE'
  )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.record_value_event(uuid,uuid,uuid,uuid,text,text,text,text,uuid,text)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.record_value_event(uuid,uuid,uuid,uuid,text,text,text,text,uuid,text)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.approve_relaunch_action_with_targets(uuid,uuid,uuid,uuid[])',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.approve_relaunch_action_with_targets(uuid,uuid,uuid,uuid[])',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.approve_relaunch_action_with_targets(uuid,uuid,uuid,uuid[])',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.claim_action_execution(uuid,uuid,uuid,text)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.claim_action_execution(uuid,uuid,uuid,text)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.claim_action_execution(uuid,uuid,uuid,text)',
      'EXECUTE'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0020 value events found unsafe function privileges';
  end if;
end
$value_events_postconditions$;

update public.app_schema_version
set version = greatest(version, 20),
    updated_at = now()
where id = 1
  and version >= 19;

do $value_events_readiness_postcondition$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1
      and version >= 20
  ) then
    raise exception using
      errcode = '55000',
      message = '0020 value events did not certify schema version 20';
  end if;
end
$value_events_readiness_postcondition$;
