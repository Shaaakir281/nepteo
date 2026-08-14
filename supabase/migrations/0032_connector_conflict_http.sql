-- PostgREST traite les SQLSTATE 40* comme des erreurs transactionnelles. Un
-- conflit optimiste métier ne doit donc pas utiliser 40001 : sur la passerelle
-- hébergée, ce signal est réessayé jusqu'au timeout. PT409 produit directement
-- une réponse HTTP 409 non ambiguë, sans rejouer la mutation.

do $connector_conflict_http_prerequisites$
begin
  if to_regclass('public.app_schema_version') is null
    or not exists (
      select 1 from public.app_schema_version where id = 1 and version >= 31
    )
  then
    raise exception using
      errcode = '55000',
      message = '0032 connector conflict HTTP requires schema version 31';
  end if;
end
$connector_conflict_http_prerequisites$;

do $connector_conflict_http_rewrite$
declare
  v_signature regprocedure;
  v_definition text;
  v_rewritten text;
begin
  foreach v_signature in array array[
    'public.commit_connector_transition(uuid,uuid,bigint,text,jsonb,text,text,uuid,jsonb)'::regprocedure,
    'public.persist_connector_credentials(uuid,uuid,bigint,text,text,uuid,jsonb)'::regprocedure,
    'public.apply_connector_snapshot(uuid,uuid,bigint,text,jsonb,jsonb,text,uuid,jsonb)'::regprocedure,
    'public.begin_connector_revocation(uuid,uuid,bigint,uuid,jsonb)'::regprocedure,
    'public.finish_connector_revocation(uuid,uuid,bigint,text,uuid,jsonb)'::regprocedure
  ]
  loop
    v_definition := pg_get_functiondef(v_signature);
    if position('errcode = ''40001''' in v_definition) > 0 then
      v_rewritten := replace(
        v_definition,
        'errcode = ''40001''',
        'errcode = ''PT409'''
      );
      execute v_rewritten;
    elsif position('errcode = ''PT409''' in v_definition) > 0 then
      -- Le staging partagé a déjà exécuté l'ancienne 0030 : conserver la
      -- définition corrigée au lieu d'échouer ou de la réécrire.
      null;
    else
      raise exception using
        errcode = '55000',
        message = '0032 expected connector conflict marker was not found';
    end if;
  end loop;
end
$connector_conflict_http_rewrite$;

do $connector_conflict_http_postconditions$
declare
  v_signature regprocedure;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.commit_connector_transition(uuid,uuid,bigint,text,jsonb,text,text,uuid,jsonb)'::regprocedure,
    'public.persist_connector_credentials(uuid,uuid,bigint,text,text,uuid,jsonb)'::regprocedure,
    'public.apply_connector_snapshot(uuid,uuid,bigint,text,jsonb,jsonb,text,uuid,jsonb)'::regprocedure,
    'public.begin_connector_revocation(uuid,uuid,bigint,uuid,jsonb)'::regprocedure,
    'public.finish_connector_revocation(uuid,uuid,bigint,text,uuid,jsonb)'::regprocedure
  ]
  loop
    v_definition := pg_get_functiondef(v_signature);
    if position('errcode = ''PT409''' in v_definition) = 0
      or position('errcode = ''40001''' in v_definition) > 0
    then
      raise exception using
        errcode = '55000',
        message = '0032 connector conflict HTTP postconditions failed';
    end if;
  end loop;
end
$connector_conflict_http_postconditions$;

update public.app_schema_version
set version = greatest(version, 32), updated_at = now()
where id = 1 and version >= 31;

do $connector_conflict_http_readiness_postcondition$
begin
  if not exists (
    select 1 from public.app_schema_version where id = 1 and version >= 32
  ) then
    raise exception using
      errcode = '55000',
      message = '0032 connector conflict HTTP did not certify schema version 32';
  end if;
end
$connector_conflict_http_readiness_postcondition$;
