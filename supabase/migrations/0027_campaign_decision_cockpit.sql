-- CAMP-2 : cockpit de décision pour les propositions Ads observées.
--
-- Ce lot reste une frontière de proposition : il rend la décision explicable,
-- crée les actions et leurs traces atomiquement, mais ne prépare ni n'applique
-- aucune mutation chez un fournisseur publicitaire.

do $campaign_decision_prerequisites$
begin
  if to_regclass('public.app_schema_version') is null
    or not exists (
      select 1
      from public.app_schema_version
      where id = 1
        and version >= 26
    )
  then
    raise exception using
      errcode = '55000',
      message = '0027 campaign decision cockpit requires schema version 26';
  end if;

  if to_regclass('public.actions') is null
    or to_regclass('public.journal') is null
    or to_regprocedure(
      'public.transition_action_decision(uuid,uuid,uuid,text)'
    ) is null
    or to_regprocedure(
      'public.claim_action_execution(uuid,uuid,uuid,text)'
    ) is null
  then
    raise exception using
      errcode = '55000',
      message = '0027 campaign decision cockpit prerequisites missing';
  end if;
end
$campaign_decision_prerequisites$;

-- Le motif est nullable pour préserver les décisions historiques. Lorsqu'il
-- existe, la contrainte conserve exactement la forme nettoyée journalisée.
alter table public.actions
  add column if not exists decision_reason text;

do $campaign_decision_reason_constraint$
begin
  if not exists (
    select 1
    from pg_constraint as constraint_def
    where constraint_def.conrelid = 'public.actions'::regclass
      and constraint_def.conname = 'actions_decision_reason_check'
  ) then
    alter table public.actions
      add constraint actions_decision_reason_check
      check (
        decision_reason is null
        or (
          decision_reason = btrim(decision_reason)
          and char_length(decision_reason) between 3 and 500
        )
      );
  end if;
end
$campaign_decision_reason_constraint$;

-- Version distincte : l'ancienne signature reste disponible aux clients déjà
-- déployés. La mise à jour et le journal partagent la transaction de la RPC.
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
begin
  if p_organization_id is null
    or p_action_id is null
    or p_actor_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'invalid action transition';
  end if;

  -- Même normalisation que l'interface, répétée à la frontière de confiance :
  -- contrôles et suites d'espaces deviennent un seul espace, puis les bords
  -- sont retirés. Le navigateur n'est jamais l'autorité du motif stocké.
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
    decided_by = case
      when p_transition = 'resume' then null
      else p_actor_id
    end,
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
      'reason', v_action.decision_reason
    )
  );

  return jsonb_build_object(
    'changed', true,
    'status', v_target_status,
    'reason', v_action.decision_reason
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
  'CAMP-2: atomically records a bounded human decision reason and its journal event.';

-- Compatibilité de signature sans faille de contournement : les anciens
-- clients conservent approve/postpone/resume, mais doivent migrer vers v2 pour
-- fournir le motif obligatoire d'un refus.
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
begin
  if p_transition = 'reject' then
    raise exception using
      errcode = '22023',
      message = 'rejection reason required; use transition_action_decision_v2';
  end if;

  return public.transition_action_decision_v2(
    p_organization_id,
    p_action_id,
    p_actor_id,
    p_transition,
    null
  );
end;
$$;

revoke execute on function public.transition_action_decision(
  uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.transition_action_decision(
  uuid, uuid, uuid, text
) to service_role;

comment on function public.transition_action_decision(uuid, uuid, uuid, text) is
  'Compatibility wrapper: non-reject transitions delegate to CAMP-2 v2; rejection requires an explicit bounded reason.';

-- Une campagne ne peut avoir qu'une proposition de pause ouverte par
-- organisation. Les autres statuts restent disponibles dans l'historique.
-- Une base issue de l'ancien SELECT/INSERT peut toutefois déjà contenir des
-- doublons : on refuse alors la migration avec les identités à arbitrer au lieu
-- de fusionner silencieusement des décisions humaines.
do $campaign_decision_duplicate_preflight$
declare
  v_conflicts jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'organization_id', duplicate.organization_id,
      'kind', duplicate.kind,
      'count', duplicate.row_count
    )
    order by duplicate.organization_id, duplicate.kind
  )
    into v_conflicts
    from (
      select action.organization_id, action.kind, count(*) as row_count
      from public.actions as action
      where action.status = 'proposed'
        and left(action.kind, 10) = 'ads_pause_'
      group by action.organization_id, action.kind
      having count(*) > 1
      order by action.organization_id, action.kind
      limit 50
    ) as duplicate;

  if v_conflicts is not null then
    raise exception using
      errcode = '55000',
      message = '0027 duplicate proposed ads pause actions require explicit arbitration',
      detail = v_conflicts::text,
      hint = 'Keep or decide each duplicate explicitly, then rerun migration 0027.';
  end if;
end
$campaign_decision_duplicate_preflight$;

create unique index if not exists
  actions_one_proposed_ads_pause_kind_per_org_uidx
on public.actions (organization_id, kind)
where status = 'proposed'
  and left(kind, 10) = 'ads_pause_';

-- Insertion atomique d'un petit lot de propositions Meta observées. L'identité
-- idempotente est (organisation, kind) tant que la proposition reste ouverte.
-- Un rejeu strictement identique ne crée ni action ni journal supplémentaire ;
-- une collision avec un contenu différent échoue honnêtement.
create or replace function public.propose_ads_pause_actions(
  p_organization_id uuid,
  p_actor_id uuid,
  p_proposals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_payload jsonb;
  v_action_id uuid;
  v_existing public.actions%rowtype;
  v_data_sources text[];
  v_created integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_campaign_id text;
  v_observation_from date;
  v_observation_to date;
  v_spend numeric;
  v_revenue numeric;
  v_roas numeric;
  v_server_roas numeric;
begin
  if p_organization_id is null
    or p_actor_id is null
    or jsonb_typeof(p_proposals) is distinct from 'array'
    or jsonb_array_length(p_proposals) not between 1 and 20
  then
    raise exception using
      errcode = '22023',
      message = 'invalid ads pause proposal batch';
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
      message = 'ads pause proposal forbidden';
  end if;

  for v_item in
    select proposal.value
    from jsonb_array_elements(p_proposals) as proposal(value)
    order by proposal.value ->> 'kind'
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or not (v_item ?& array[
        'kind', 'title', 'finding', 'rationale', 'data_sources',
        'expected_impact', 'confidence', 'risk', 'payload'
      ])
      or (v_item - array[
        'kind', 'title', 'finding', 'rationale', 'data_sources',
        'expected_impact', 'confidence', 'risk', 'payload'
      ]) <> '{}'::jsonb
    then
      raise exception using
        errcode = '22023',
        message = 'invalid ads pause proposal fields';
    end if;

    if jsonb_typeof(v_item -> 'kind') is distinct from 'string'
      or jsonb_typeof(v_item -> 'title') is distinct from 'string'
      or jsonb_typeof(v_item -> 'finding') is distinct from 'string'
      or jsonb_typeof(v_item -> 'rationale') is distinct from 'string'
      or jsonb_typeof(v_item -> 'data_sources') is distinct from 'array'
      or jsonb_typeof(v_item -> 'expected_impact') is distinct from 'string'
      or jsonb_typeof(v_item -> 'confidence') is distinct from 'null'
      or jsonb_typeof(v_item -> 'risk') is distinct from 'string'
      or jsonb_typeof(v_item -> 'payload') is distinct from 'object'
    then
      raise exception using
        errcode = '22023',
        message = 'invalid ads pause proposal types';
    end if;

    if char_length(v_item ->> 'title') not between 1 and 200
      or (v_item ->> 'title') <> btrim(v_item ->> 'title')
      or char_length(v_item ->> 'finding') not between 1 and 2000
      or (v_item ->> 'finding') <> btrim(v_item ->> 'finding')
      or char_length(v_item ->> 'rationale') not between 1 and 2000
      or (v_item ->> 'rationale') <> btrim(v_item ->> 'rationale')
      or char_length(v_item ->> 'expected_impact') not between 1 and 1000
      or (v_item ->> 'expected_impact') <> btrim(v_item ->> 'expected_impact')
      or (v_item ->> 'risk') <> 'low'
      or jsonb_array_length(v_item -> 'data_sources') not between 1 and 10
    then
      raise exception using
        errcode = '22023',
        message = 'invalid ads pause proposal content';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_item -> 'data_sources') as source(value)
      where jsonb_typeof(source.value) is distinct from 'string'
        or char_length(source.value #>> '{}') not between 1 and 300
        or (source.value #>> '{}') <> btrim(source.value #>> '{}')
    )
    then
      raise exception using
        errcode = '22023',
        message = 'invalid ads pause proposal source';
    end if;

    v_payload := v_item -> 'payload';

    if not (v_payload ?& array[
        'campaign_id', 'campaign_name', 'roas', 'spend', 'revenue', 'provider',
        'observation_from', 'observation_to'
      ])
      or (v_payload - array[
        'campaign_id', 'campaign_name', 'roas', 'spend', 'revenue', 'provider',
        'observation_from', 'observation_to', 'demo'
      ]) <> '{}'::jsonb
      or jsonb_typeof(v_payload -> 'campaign_id') is distinct from 'string'
      or jsonb_typeof(v_payload -> 'campaign_name') is distinct from 'string'
      or jsonb_typeof(v_payload -> 'roas') is distinct from 'number'
      or jsonb_typeof(v_payload -> 'spend') is distinct from 'number'
      or jsonb_typeof(v_payload -> 'revenue') is distinct from 'number'
      or jsonb_typeof(v_payload -> 'provider') is distinct from 'string'
    then
      raise exception using
        errcode = '22023',
        message = 'invalid Meta Ads pause payload fields';
    end if;

    v_campaign_id := v_payload ->> 'campaign_id';
    v_spend := (v_payload ->> 'spend')::numeric;
    v_revenue := (v_payload ->> 'revenue')::numeric;
    v_roas := (v_payload ->> 'roas')::numeric;
    if char_length(v_campaign_id) not between 1 and 200
      or v_campaign_id <> btrim(v_campaign_id)
      or char_length(v_payload ->> 'campaign_name') not between 1 and 200
      or (v_payload ->> 'campaign_name') <> btrim(v_payload ->> 'campaign_name')
      or (v_payload ->> 'provider') <> 'meta_ads'
      or (v_item ->> 'kind') is distinct from ('ads_pause_' || v_campaign_id)
      or v_roas < 0
      or v_roas >= 1
      or v_roas is distinct from trunc(v_roas, 2)
      or v_spend < 50
      or v_spend > 1000000000000
      or abs(v_spend - round(v_spend, 2)) > 0.000001
      or v_revenue < 0
      or v_revenue > 1000000000000
      or abs(v_revenue - round(v_revenue, 2)) > 0.000001
    then
      raise exception using
        errcode = '22023',
        message = 'invalid Meta Ads pause payload values';
    end if;

    -- La division est séparée du contrôle de bornes : une dépense invalide ne
    -- doit jamais atteindre le calcul. Une tolérance d'un centième absorbe le
    -- cas limite d'arrondi IEEE-754 du serveur TypeScript ; le snapshot stocké
    -- est ensuite remplacé par les valeurs décimales recalculées ici.
    v_spend := round(v_spend, 2);
    v_revenue := round(v_revenue, 2);
    v_server_roas := round(v_revenue / v_spend, 2);
    if v_server_roas >= 1
      or abs(v_roas - v_server_roas) > 0.01
    then
      raise exception using
        errcode = '22023',
        message = 'invalid Meta Ads pause payload ratio';
    end if;

    v_payload := jsonb_set(v_payload, '{spend}', to_jsonb(v_spend), false);
    v_payload := jsonb_set(v_payload, '{revenue}', to_jsonb(v_revenue), false);
    v_payload := jsonb_set(v_payload, '{roas}', to_jsonb(v_server_roas), false);

    if (v_payload ? 'demo')
      and jsonb_typeof(v_payload -> 'demo') is distinct from 'boolean'
    then
      raise exception using
        errcode = '22023',
        message = 'invalid Meta Ads demo marker';
    end if;

    if jsonb_typeof(v_payload -> 'observation_from') is distinct from 'string'
      or jsonb_typeof(v_payload -> 'observation_to') is distinct from 'string'
      or (v_payload ->> 'observation_from') !~ '^\d{4}-\d{2}-\d{2}$'
      or (v_payload ->> 'observation_to') !~ '^\d{4}-\d{2}-\d{2}$'
    then
      raise exception using
        errcode = '22023',
        message = 'invalid Meta Ads observation window';
    end if;

    v_observation_from := (v_payload ->> 'observation_from')::date;
    v_observation_to := (v_payload ->> 'observation_to')::date;
    if v_observation_to - v_observation_from <> 29
      or v_observation_to > current_date
    then
      raise exception using
        errcode = '22023',
        message = 'invalid Meta Ads observation window';
    end if;

    select array_agg(source.value order by source.ordinality)
      into v_data_sources
      from jsonb_array_elements_text(v_item -> 'data_sources')
        with ordinality as source(value, ordinality);

    -- Mémoire durable : une décision passée pour ce kind interdit de recréer
    -- silencieusement la même recommandation. Une proposition encore ouverte
    -- conserve en plus la comparaison stricte de contenu du rejeu idempotent.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_organization_id::text || ':' || (v_item ->> 'kind'),
        0
      )
    );

    select *
      into v_existing
      from public.actions as action
      where action.organization_id = p_organization_id
        and action.kind = (v_item ->> 'kind')
      order by action.created_at asc, action.id asc
      limit 1
      for update;

    if found then
      if v_existing.payload ->> 'campaign_id' is distinct from v_campaign_id
        or v_existing.payload ->> 'provider' is distinct from 'meta_ads'
      then
        raise exception using
          errcode = '23505',
          message = 'ads pause proposal durable identity conflict';
      end if;

      -- Les propositions créées avant CAMP-2 portaient une confiance fixe et
      -- un libellé exécutable. Cette confiance non nulle est le marqueur de
      -- migration : une proposition encore ouverte est remplacée par le
      -- constat canonique courant ; un historique décidé conserve son texte,
      -- mais perd la fausse calibration. Dans les deux cas la correction est
      -- journalisée une seule fois et reste dans la transaction.
      if v_existing.confidence is not null then
        if v_existing.status = 'proposed' then
          update public.actions as action
          set
            title = v_item ->> 'title',
            finding = v_item ->> 'finding',
            rationale = v_item ->> 'rationale',
            data_sources = v_data_sources,
            expected_impact = v_item ->> 'expected_impact',
            confidence = null,
            risk = 'low',
            payload = v_payload
          where action.id = v_existing.id
            and action.organization_id = p_organization_id;
        else
          update public.actions as action
          set confidence = null
          where action.id = v_existing.id
            and action.organization_id = p_organization_id;
        end if;

        insert into public.journal (
          organization_id,
          action_id,
          event,
          actor,
          actor_id,
          payload
        )
        select
          p_organization_id,
          v_existing.id,
          case
            when v_existing.status = 'proposed' then 'action_proposal_upgraded'
            else 'action_history_adopted'
          end,
          'agent',
          p_actor_id,
          jsonb_build_object(
            'kind', v_item ->> 'kind',
            'provider', 'meta_ads',
            'campaign_id', v_campaign_id,
            'legacy_confidence', v_existing.confidence,
            'status', v_existing.status,
            'external_effect', false
          )
        where not exists (
          select 1
          from public.journal as journal_entry
          where journal_entry.organization_id = p_organization_id
            and journal_entry.action_id = v_existing.id
            and journal_entry.event in (
              'action_proposal_upgraded',
              'action_history_adopted'
            )
        );

        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'campaign_id', v_campaign_id,
          'action_id', v_existing.id,
          'created', false,
          'upgraded', v_existing.status = 'proposed',
          'adopted', v_existing.status <> 'proposed'
        ));
        continue;
      end if;

      if v_existing.status = 'proposed'
        and (
          v_existing.title is distinct from (v_item ->> 'title')
          or v_existing.finding is distinct from (v_item ->> 'finding')
          or v_existing.rationale is distinct from (v_item ->> 'rationale')
          or v_existing.data_sources is distinct from v_data_sources
          or v_existing.expected_impact is distinct from (v_item ->> 'expected_impact')
          or v_existing.risk is distinct from 'low'
          or v_existing.payload is distinct from v_payload
        )
      then
        raise exception using
          errcode = '23505',
          message = 'ads pause proposal idempotency content conflict';
      end if;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'campaign_id', v_campaign_id,
        'action_id', v_existing.id,
        'created', false
      ));
      continue;
    end if;

    v_action_id := null;
    insert into public.actions (
      organization_id,
      kind,
      title,
      finding,
      rationale,
      data_sources,
      expected_impact,
      confidence,
      risk,
      status,
      payload
    )
    values (
      p_organization_id,
      v_item ->> 'kind',
      v_item ->> 'title',
      v_item ->> 'finding',
      v_item ->> 'rationale',
      v_data_sources,
      v_item ->> 'expected_impact',
      null,
      'low',
      'proposed',
      v_payload
    )
    on conflict (organization_id, kind)
      where status = 'proposed' and left(kind, 10) = 'ads_pause_'
      do nothing
    returning id into v_action_id;

    if v_action_id is null then
      select *
        into v_existing
        from public.actions as action
        where action.organization_id = p_organization_id
          and action.kind = (v_item ->> 'kind')
          and action.status = 'proposed'
        for update;

      if not found then
        raise exception using
          errcode = '40001',
          message = 'ads pause proposal idempotency state unavailable';
      end if;

      if v_existing.title is distinct from (v_item ->> 'title')
        or v_existing.finding is distinct from (v_item ->> 'finding')
        or v_existing.rationale is distinct from (v_item ->> 'rationale')
        or v_existing.data_sources is distinct from v_data_sources
        or v_existing.expected_impact is distinct from (v_item ->> 'expected_impact')
        or v_existing.confidence is not null
        or v_existing.risk is distinct from 'low'
        or v_existing.payload is distinct from v_payload
      then
        raise exception using
          errcode = '23505',
          message = 'ads pause proposal idempotency content conflict';
      end if;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'campaign_id', v_campaign_id,
        'action_id', v_existing.id,
        'created', false
      ));
      continue;
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
      v_action_id,
      'action_proposed',
      'agent',
      p_actor_id,
      jsonb_build_object(
        'kind', v_item ->> 'kind',
        'title', v_item ->> 'title',
        'provider', 'meta_ads',
        'campaign_id', v_campaign_id,
        'confidence', null
      )
    );

    v_created := v_created + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'campaign_id', v_campaign_id,
      'action_id', v_action_id,
      'created', true
    ));
  end loop;

  return jsonb_build_object(
    'created_count', v_created,
    'results', v_results
  );
end;
$$;

revoke execute on function public.propose_ads_pause_actions(
  uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.propose_ads_pause_actions(
  uuid, uuid, jsonb
) to service_role;

comment on function public.propose_ads_pause_actions(uuid, uuid, jsonb) is
  'CAMP-2: atomically and idempotently proposes bounded Meta Ads pause reviews with one journal per new action.';

-- Conserve le contrat de 0020 mais referme l'allowlist sur les seules relances.
-- Une proposition ads_pause_* peut être approuvée humainement, jamais claimée.
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
  uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.claim_action_execution(
  uuid, uuid, uuid, text
) to service_role;

comment on function public.claim_action_execution(uuid, uuid, uuid, text) is
  'Atomically claims approved relaunch actions only; CAMP-2 Ads pause proposals are not executable.';

-- Referme aussi la seconde moitié du protocole. Une action ads_pause_* qui
-- aurait reçu une clé de claim avant 0027 ne peut donc pas être finalisée en
-- executed/failed après la migration.
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

  update public.actions as action
  set status = v_target_status
  where action.id = p_action_id
    and action.organization_id = p_organization_id
    and action.status = 'approved'
    and action.idempotency_key = p_idempotency_key
    and (
      action.kind = 'relaunch_priority'
      or action.kind = 'relaunch_dormant'
      or left(action.kind, 15) = 'relaunch_stage_'
    );

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
  uuid, uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.finish_action_execution(
  uuid, uuid, uuid, text, text, jsonb
) to service_role;

comment on function public.finish_action_execution(
  uuid, uuid, uuid, text, text, jsonb
) is
  'Atomically finalizes claimed relaunch actions only; legacy Ads pause claims remain non-executable.';

do $campaign_decision_postconditions$
declare
  v_claim_definition text;
  v_finish_definition text;
  v_legacy_transition_definition text;
  v_proposal_definition text;
begin
  select pg_get_functiondef(
    'public.claim_action_execution(uuid,uuid,uuid,text)'::regprocedure
  ) into v_claim_definition;
  select pg_get_functiondef(
    'public.finish_action_execution(uuid,uuid,uuid,text,text,jsonb)'::regprocedure
  ) into v_finish_definition;
  select pg_get_functiondef(
    'public.propose_ads_pause_actions(uuid,uuid,jsonb)'::regprocedure
  ) into v_proposal_definition;
  select pg_get_functiondef(
    'public.transition_action_decision(uuid,uuid,uuid,text)'::regprocedure
  ) into v_legacy_transition_definition;

  if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'actions'
        and column_name = 'decision_reason'
        and is_nullable = 'YES'
    )
    or not exists (
      select 1
      from pg_constraint as constraint_def
      where constraint_def.conrelid = 'public.actions'::regclass
        and constraint_def.conname = 'actions_decision_reason_check'
    )
    or to_regprocedure(
      'public.transition_action_decision(uuid,uuid,uuid,text)'
    ) is null
    or to_regprocedure(
      'public.transition_action_decision_v2(uuid,uuid,uuid,text,text)'
    ) is null
    or to_regprocedure(
      'public.propose_ads_pause_actions(uuid,uuid,jsonb)'
    ) is null
    or not exists (
      select 1
      from pg_index as index_def
      where index_def.indexrelid =
        'public.actions_one_proposed_ads_pause_kind_per_org_uidx'::regclass
        and index_def.indisunique
        and index_def.indpred is not null
    )
    or position('ads_pause_' in v_claim_definition) > 0
    or position('ads_pause_' in v_finish_definition) > 0
    or position('relaunch_priority' in v_finish_definition) = 0
    or position('rejection reason required' in v_legacy_transition_definition) = 0
    or position('transition_action_decision_v2' in v_legacy_transition_definition) = 0
    or position('pg_advisory_xact_lock' in v_proposal_definition) = 0
    or position('outbox_messages' in v_proposal_definition) > 0
    or position('http_request' in v_proposal_definition) > 0
    or position('net.http' in v_proposal_definition) > 0
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.transition_action_decision_v2(uuid,uuid,uuid,text,text)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.propose_ads_pause_actions(uuid,uuid,jsonb)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.finish_action_execution(uuid,uuid,uuid,text,text,jsonb)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.transition_action_decision_v2(uuid,uuid,uuid,text,text)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.propose_ads_pause_actions(uuid,uuid,jsonb)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.finish_action_execution(uuid,uuid,uuid,text,text,jsonb)',
      'EXECUTE'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0027 campaign decision cockpit postconditions failed';
  end if;
end
$campaign_decision_postconditions$;

update public.app_schema_version
set version = greatest(version, 27),
    updated_at = now()
where id = 1;

do $campaign_decision_readiness$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1
      and version >= 27
  )
  then
    raise exception using
      errcode = '55000',
      message = '0027 campaign decision cockpit did not certify schema version 27';
  end if;
end
$campaign_decision_readiness$;
