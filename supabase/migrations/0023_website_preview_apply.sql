-- I2 : application atomique d'une analyse `website_preview` à la mémoire.
-- La recherche reste séparée ; seule une RPC service-role explicitement appelée
-- après revue peut écrire les sections sélectionnées et leur journal.

do $website_preview_apply_prerequisites$
begin
  if not exists (
    select 1 from public.app_schema_version where id = 1 and version >= 22
  ) then
    raise exception using errcode = '55000',
      message = '0023 website preview apply requires schema version 22';
  end if;

  if to_regclass('public.company_memory') is null
    or to_regclass('public.research_runs') is null
    or to_regclass('public.journal') is null
    or to_regclass('public.memberships') is null
  then
    raise exception using errcode = '55000',
      message = '0023 website preview apply requires memory, research, journal and memberships';
  end if;
end
$website_preview_apply_prerequisites$;

create or replace function public.apply_website_preview_sections(
  p_organization_id uuid,
  p_actor_id uuid,
  p_subject_key text,
  p_sections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section text;
  v_content jsonb;
  v_applied integer := 0;
  v_section_names text[] := array[]::text[];
begin
  if p_organization_id is null
    or p_actor_id is null
    or p_subject_key is null
    or p_subject_key !~ '^[a-z0-9][a-z0-9-]{0,119}$'
    or p_sections is null
    or jsonb_typeof(p_sections) <> 'object'
    or p_sections = '{}'::jsonb
  then
    raise exception using errcode = '22023',
      message = 'invalid website preview application';
  end if;

  perform 1
  from public.memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_actor_id
    and membership.role in ('admin', 'marketing', 'direction');

  if not found then
    raise exception using errcode = '42501',
      message = 'website preview application requires an editor membership';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_sections) as supplied(section)
    where supplied.section not in (
      'activite', 'zone', 'ton', 'canaux', 'offres', 'presence'
    )
  )
    or exists (
      select 1
      from jsonb_each(p_sections) as supplied(section, content)
      where jsonb_typeof(supplied.content) <> 'object'
        or supplied.content = '{}'::jsonb
    )
  then
    raise exception using errcode = '22023',
      message = 'website preview application contains an unsafe section';
  end if;

  perform 1
  from public.research_runs as research
  where research.organization_id = p_organization_id
    and research.kind = 'website_preview'
    and research.subject_key = p_subject_key
    and research.status = 'ok'
    and research.created_at >= statement_timestamp() - interval '30 days';

  if not found then
    raise exception using errcode = '55000',
      message = 'fresh website preview not found';
  end if;

  for v_section, v_content in
    select supplied.section, supplied.content
    from jsonb_each(p_sections) as supplied(section, content)
    order by supplied.section
  loop
    insert into public.company_memory as memory (
      organization_id,
      section,
      content,
      updated_at
    )
    values (
      p_organization_id,
      v_section,
      v_content,
      statement_timestamp()
    )
    on conflict (organization_id, section)
    do update set
      content = excluded.content,
      updated_at = excluded.updated_at;

    insert into public.journal (
      organization_id,
      event,
      actor,
      actor_id,
      payload
    )
    values (
      p_organization_id,
      'memory_updated',
      'user',
      p_actor_id,
      jsonb_build_object(
        'section', v_section,
        'source', 'website_preview',
        'subject_key', p_subject_key
      )
    );

    v_applied := v_applied + 1;
    v_section_names := array_append(v_section_names, v_section);
  end loop;

  insert into public.journal (
    organization_id,
    event,
    actor,
    actor_id,
    payload
  )
  values (
    p_organization_id,
    'website_preview_applied',
    'user',
    p_actor_id,
    jsonb_build_object(
      'sections', to_jsonb(v_section_names),
      'count', v_applied,
      'subject_key', p_subject_key
    )
  );

  return jsonb_build_object(
    'applied', v_applied,
    'sections', to_jsonb(v_section_names)
  );
end;
$$;

revoke execute on function public.apply_website_preview_sections(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_website_preview_sections(uuid, uuid, text, jsonb)
  to service_role;

comment on function public.apply_website_preview_sections(uuid, uuid, text, jsonb) is
  'Atomically applies explicitly reviewed website-preview sections to company memory.';

do $website_preview_apply_postconditions$
begin
  if pg_catalog.has_function_privilege(
      'authenticated',
      'public.apply_website_preview_sections(uuid,uuid,text,jsonb)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.apply_website_preview_sections(uuid,uuid,text,jsonb)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.apply_website_preview_sections(uuid,uuid,text,jsonb)',
      'EXECUTE'
    )
  then
    raise exception using errcode = '55000',
      message = '0023 website preview apply found unsafe RPC privileges';
  end if;
end
$website_preview_apply_postconditions$;

update public.app_schema_version
set version = greatest(version, 23),
    updated_at = now()
where id = 1
  and version >= 22;

do $website_preview_apply_readiness$
begin
  if not exists (
    select 1 from public.app_schema_version where id = 1 and version >= 23
  ) then
    raise exception using errcode = '55000',
      message = '0023 website preview apply did not certify schema version 23';
  end if;
end
$website_preview_apply_readiness$;
