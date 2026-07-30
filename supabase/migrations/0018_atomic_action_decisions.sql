-- Transition et journalisation atomiques des décisions humaines.
--
-- Une mise à jour applicative suivie d'un INSERT séparé pouvait laisser une
-- action approuvée sans trace si le journal échouait. Cette RPC enferme les
-- deux écritures dans la même transaction PostgreSQL.
create or replace function public.transition_action_decision(
  p_organization_id uuid,
  p_action_id uuid,
  p_actor_id uuid,
  p_transition text
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
  v_action public.actions%rowtype;
begin
  if p_organization_id is null
    or p_action_id is null
    or p_actor_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'invalid action transition';
  end if;

  -- Défense en profondeur : la fonction n'accepte que les rôles éditeurs,
  -- même si son EXECUTE est déjà limité au service role.
  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using
      errcode = '42501',
      message = 'action transition forbidden';
  end if;

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
      raise exception using
        errcode = '22023',
        message = 'unknown action transition';
  end case;

  update public.actions
  set
    status = v_target_status,
    decided_by = case
      when p_transition = 'resume' then null
      else p_actor_id
    end,
    decided_at = case
      when p_transition = 'resume' then null
      else statement_timestamp()
    end
  where id = p_action_id
    and organization_id = p_organization_id
    and status = v_expected_status
  returning * into v_action;

  if not found then
    return jsonb_build_object('changed', false);
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
    jsonb_build_object('kind', v_action.kind, 'title', v_action.title)
  );

  return jsonb_build_object(
    'changed', true,
    'status', v_target_status
  );
end;
$$;

revoke execute on function public.transition_action_decision(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.transition_action_decision(
  uuid,
  uuid,
  uuid,
  text
) to service_role;

comment on function public.transition_action_decision(uuid, uuid, uuid, text) is
  'Atomically transitions one action and appends its human decision to the journal.';

-- Claim d'exécution, garde organisationnelle et journal de départ atomiques.
-- Une mise en pause concurrente sérialise sur la ligne organizations : si elle
-- gagne avant le claim, aucune préparation ne démarre ; après le claim,
-- l'exécution déjà engagée conserve sa sémantique at-most-once.
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

comment on function public.claim_action_execution(uuid, uuid, uuid, text) is
  'Atomically checks execution guards, claims one action and journals its start.';

-- Finalisation du claim et journal de résultat atomiques. Les brouillons de
-- l'outbox sont préparés avant cette étape, mais l'action ne devient jamais
-- `executed` ou `failed` sans la trace correspondante.
create or replace function public.finish_action_execution(
  p_organization_id uuid,
  p_action_id uuid,
  p_actor_id uuid,
  p_idempotency_key text,
  p_outcome text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_status text;
  v_event text;
begin
  if p_organization_id is null
    or p_action_id is null
    or p_actor_id is null
    or p_idempotency_key is distinct from ('exec:' || p_action_id::text)
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'invalid execution finalization';
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
      message = 'execution finalization forbidden';
  end if;

  case p_outcome
    when 'succeeded' then
      v_target_status := 'executed';
      v_event := 'execution_succeeded';
    when 'failed' then
      v_target_status := 'failed';
      v_event := 'execution_failed';
    else
      raise exception using
        errcode = '22023',
        message = 'unknown execution outcome';
  end case;

  update public.actions
  set status = v_target_status
  where id = p_action_id
    and organization_id = p_organization_id
    and status = 'approved'
    and idempotency_key = p_idempotency_key;

  if not found then
    return jsonb_build_object('finished', false);
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
    p_payload
  );

  return jsonb_build_object(
    'finished', true,
    'status', v_target_status
  );
end;
$$;

revoke execute on function public.finish_action_execution(
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.finish_action_execution(
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb
) to service_role;

comment on function public.finish_action_execution(
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb
) is
  'Atomically finalizes a claimed action and appends its execution result.';

-- Le bouton d'arrêt et le niveau d'autonomie sont des gardes d'exécution. Leur
-- état et leur trace doivent donc changer ensemble, sur la même ligne
-- d'organisation que le claim verrouille avec `for update`.
create or replace function public.change_execution_control(
  p_organization_id uuid,
  p_actor_id uuid,
  p_control text,
  p_value text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_payload jsonb;
begin
  if p_organization_id is null
    or p_actor_id is null
    or p_control is null
    or p_value is null
  then
    raise exception using
      errcode = '22023',
      message = 'invalid execution control change';
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
      message = 'execution control change forbidden';
  end if;

  case p_control
    when 'pause' then
      if p_value not in ('true', 'false') then
        raise exception using
          errcode = '22023',
          message = 'invalid execution pause value';
      end if;
      update public.organizations
      set execution_paused = (p_value = 'true')
      where id = p_organization_id;
      v_event := 'execution_pause_changed';
      v_payload := jsonb_build_object('paused', p_value = 'true');
    when 'autonomy' then
      if p_value not in ('suggest', 'prepare') then
        raise exception using
          errcode = '22023',
          message = 'invalid autonomy value';
      end if;
      update public.organizations
      set autonomy_level = p_value
      where id = p_organization_id;
      v_event := 'autonomy_changed';
      v_payload := jsonb_build_object('level', p_value);
    else
      raise exception using
        errcode = '22023',
        message = 'unknown execution control';
  end case;

  if not found then
    return jsonb_build_object('changed', false);
  end if;

  insert into public.journal (
    organization_id,
    event,
    actor,
    actor_id,
    payload
  )
  values (
    p_organization_id,
    v_event,
    'user',
    p_actor_id,
    v_payload
  );

  return jsonb_build_object('changed', true);
end;
$$;

revoke execute on function public.change_execution_control(
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.change_execution_control(
  uuid,
  uuid,
  text,
  text
) to service_role;

comment on function public.change_execution_control(uuid, uuid, text, text) is
  'Atomically updates an execution guard and appends its audit event.';

update public.app_schema_version
set version = greatest(version, 18),
    updated_at = now()
where id = 1;
