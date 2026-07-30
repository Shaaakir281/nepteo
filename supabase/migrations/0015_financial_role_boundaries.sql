-- Frontière des données financières par rôle.
--
-- - admin / marketing / direction : lecture financière + mutations serveur ;
-- - lecture : lecture financière, aucune mutation ;
-- - commercial : uniquement prospects expurgés et connecteurs non financiers ;
--   aucun contenu libre/dérivé (mémoire, actions, journal, outbox, recherches).
--
-- Les écritures des tables concernées restent sans policy et passent donc
-- uniquement par le service role, après contrôle des capacités applicatives.

create or replace function public.has_org_role(
  org uuid,
  allowed_roles text[]
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships as m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.role = any (allowed_roles)
  );
$$;

create or replace function public.is_financial_action_kind(action_kind text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    action_kind = 'launch_campaign' or left(action_kind, 4) = 'ads_',
    false
  );
$$;

-- Même logique d'allowlist que la matrice applicative : un futur kind est
-- invisible au commercial tant qu'il n'a pas été classifié.
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
      'classify_unlabeled',
      'dedupe_emails',
      'complete_missing_company'
    )
    or left(action_kind, 15) = 'relaunch_stage_',
    false
  );
$$;

-- Certains événements historiques ne portent ni action_id ni payload.kind.
-- Le brief créatif est inclus car son objectif libre peut contenir un budget.
create or replace function public.is_financial_journal_event(event_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    event_name in (
      'ads_demo_loaded',
      'revenue_demo_loaded',
      'demo_scenario_loaded',
      'creative_brief_generated'
    ),
    false
  );
$$;

-- Allowlist volontaire : un futur événement est invisible au commercial tant
-- qu'il n'a pas été classifié. Les quatre événements financiers ci-dessus en
-- sont absents par construction.
create or replace function public.is_commercial_safe_journal_event(
  event_name text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    event_name in (
      'organization_created',
      'memory_updated',
      'connector_requested',
      'connector_connected',
      'connector_configured',
      'connector_synced',
      'connector_disconnected',
      'connector_sync_failed',
      'analysis_run',
      'action_proposed',
      'action_approved',
      'action_rejected',
      'action_postponed',
      'action_resumed',
      'draft_prepared',
      'draft_edited',
      'prospect_note_saved',
      'execution_started',
      'execution_succeeded',
      'execution_failed',
      'execution_blocked',
      'execution_pause_changed',
      'autonomy_changed',
      'research_started',
      'research_succeeded',
      'research_failed',
      'research_blocked',
      'identity_proposed',
      'demo_scenario_cleared',
      'demo_scenario_clear_failed'
    ),
    false
  );
$$;

-- Le journal ne stocke aujourd'hui que le provider, pas toujours le type du
-- connecteur. La liste reprend toutes les familles ads/payments du catalogue ;
-- le test de `connector_type` couvre les futurs événements qui le fourniront.
create or replace function public.is_financial_connector_ref(
  provider_name text,
  connector_type text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    connector_type in ('ads', 'payments')
    or provider_name in (
      'meta_ads',
      'google_ads',
      'linkedin_ads',
      'stripe',
      'shopify',
      'woocommerce',
      'invoicing'
    ),
    false
  );
$$;

-- Le journal référence parfois l'action sans recopier son kind. Cette fonction
-- classifie la ligne liée sans dépendre de la policy RLS d'actions.
create or replace function public.is_financial_action(
  org uuid,
  action_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.actions as a
    join public.memberships as m
      on m.organization_id = a.organization_id
    where a.id = action_uuid
      and a.organization_id = org
      and m.user_id = auth.uid()
      and public.is_financial_action_kind(a.kind)
  );
$$;

-- Pour les événements d'exécution, une action absente, orpheline ou d'un kind
-- futur n'est jamais considérée comme sûre pour le commercial.
create or replace function public.is_commercial_safe_action(
  org uuid,
  action_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.actions as a
    join public.memberships as m
      on m.organization_id = a.organization_id
    where a.id = action_uuid
      and a.organization_id = org
      and m.user_id = auth.uid()
      and public.is_commercial_safe_action_kind(a.kind)
  );
$$;

-- La mémoire contient des champs libres (offres, objectifs, ton, observations)
-- qui peuvent tous embarquer notes ou montants. Aucun contenu mémoire n'est
-- donc lisible par le commercial. Les sections `__` restent en plus invisibles
-- à tous les JWT utilisateurs. Le service role contourne la RLS.
drop policy if exists company_memory_select on public.company_memory;
create policy company_memory_select
  on public.company_memory
  for select
  using (
    left(section, 2) <> '__'
    and public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

-- query/answer/sources peuvent révéler des prix ou budgets même pour une
-- recherche non publicitaire. La lecture reste réservée aux rôles financiers ;
-- les traitements serveur conservent l'accès via le service role.
drop policy if exists research_runs_select on public.research_runs;
create policy research_runs_select
  on public.research_runs
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

-- Le texte généré d'un briefing reçoit notamment company_memory.objectifs.
-- Ce champ libre peut contenir un budget que le LLM reformule : la lecture du
-- briefing suit donc la même frontière financière que research_runs. Le
-- service role conserve son accès complet en contournant la RLS.
drop policy if exists briefings_select on public.briefings;
create policy briefings_select
  on public.briefings
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists ad_metrics_select on public.ad_metrics;
create policy ad_metrics_select
  on public.ad_metrics
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists revenue_select on public.revenue_events;
create policy revenue_select
  on public.revenue_events
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

-- Toute action contient des champs libres/dérivés (finding, rationale,
-- expected_impact, payload). Une allowlist de kind ne peut pas garantir
-- l'absence de notes ou montants : le commercial ne lit donc aucune action.
drop policy if exists actions_select on public.actions;
create policy actions_select
  on public.actions
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

-- Le journal est un payload libre et recopie des données d'actions, connecteurs
-- et erreurs. Le commercial n'en lit aucune ligne, quel que soit l'événement.
drop policy if exists journal_select on public.journal;
create policy journal_select
  on public.journal
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

-- Destinataire, objet et corps sont du contenu libre préparé. Aucune lecture
-- commerciale, même avant un éventuel branchement d'envoi externe.
drop policy if exists outbox_select on public.outbox_messages;
create policy outbox_select
  on public.outbox_messages
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

-- Un connecteur publicitaire ou de paiement révèle au minimum sa source et sa
-- configuration. Le commercial conserve les connecteurs CRM/fichiers.
drop policy if exists connectors_select on public.connectors;
create policy connectors_select
  on public.connectors
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
    or (
      public.has_org_role(organization_id, array['commercial'])
      and type not in ('ads', 'payments')
    )
  );

-- `prospects.raw` recopie toutes les colonnes de la source ; une feuille CRM
-- peut donc y contenir un champ « Budget » même si le board ne l'affiche pas.
-- Les notes libres ont le même risque. Aucun RSC authentifié ne les lit :
-- seuls les traitements autorisés de brouillon y accèdent via le service role.
revoke select on table public.prospects from public, anon, authenticated;
grant select on table public.prospects to service_role;
grant select (
  id,
  organization_id,
  connector_id,
  external_id,
  name,
  email,
  company,
  stage,
  source,
  synced_at,
  last_contact_at
) on table public.prospects to authenticated;
