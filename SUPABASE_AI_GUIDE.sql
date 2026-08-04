-- FarmTrack AI Guide — optional audit of guide queries (no write actions)
create table if not exists public.ai_guide_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  user_role text,
  page_module text,
  query text,
  reply_preview text,
  used_notifications boolean default false,
  created_at timestamptz default now()
);
create index if not exists ai_guide_logs_page_idx on public.ai_guide_logs (page_module);
create index if not exists ai_guide_logs_created_idx on public.ai_guide_logs (created_at desc);
grant all on public.ai_guide_logs to service_role;
grant select on public.ai_guide_logs to authenticated;
