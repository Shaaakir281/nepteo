-- Beta invariant: one user belongs to at most one organization.
--
-- This migration is intentionally fail-closed. Existing duplicates require an
-- explicit product/data decision: no membership is deleted, moved, or merged.
do $$
begin
  if exists (
    select 1
    from public.memberships
    group by user_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = '0013_single_organization_per_user refused: duplicate user memberships exist',
      detail = 'No membership row was changed.',
      hint = 'Audit duplicate user_id values and resolve them explicitly before retrying.';
  end if;
end
$$;

alter table public.memberships
  add constraint memberships_user_id_unique unique (user_id);

comment on constraint memberships_user_id_unique on public.memberships is
  'Beta invariant: one organization per user; remove only after an explicit active-organization selector exists.';

-- Future reversal, after deploying an explicit active-organization selector:
-- alter table public.memberships drop constraint memberships_user_id_unique;
