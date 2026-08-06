-- Users / RBAC health
select
  jsonb_array_length(coalesce(data->'users','[]'::jsonb)) as users_n,
  updated_at
from public.erp_state where id = 'farmtrack-demo';

select
  u->>'name' as name,
  u->>'email' as email,
  u->>'role' as role,
  u->>'status' as status,
  u->>'department' as department,
  u->>'lastLogin' as last_login
from public.erp_state,
  jsonb_array_elements(coalesce(data->'users','[]'::jsonb)) u
where id = 'farmtrack-demo'
order by u->>'role', u->>'name';
