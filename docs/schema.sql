-- Supabase / Postgres — run in the SQL editor once. JSON columns keep it tiny.
create table if not exists mandates (
  id text primary key,
  json jsonb not null,
  hash text not null,
  status text not null default 'active' check (status in ('active','paused','revoked')),
  anchor_tx text,
  created_at timestamptz not null default now()
);

create table if not exists merchants (
  id text primary key,
  name text not null,
  category text not null,
  wallet text not null
);

create table if not exists ledger_entries (
  id text primary key,
  mandate_id text not null references mandates(id),
  json jsonb not null,             -- full LedgerEntry (proposal, decision, reasons, fee, total, hashes)
  status text not null check (status in ('approved','pending','stopped','settled','failed')),
  tx_hash text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_by_mandate on ledger_entries (mandate_id, created_at);

create table if not exists usage_records (
  id bigserial primary key,
  mandate_id text,
  flow text not null,              -- propose | status_fastpath | stop_template | compare | explain | audit | other
  model text not null,
  prompt_tokens int not null,
  completion_tokens int not null,
  total_tokens int not null,
  cost_usd numeric,
  latency_ms int not null,
  response_id text,                -- Kiln response id (UsageRecord.responseId); null for 0-token flows
  created_at timestamptz not null default now()
);
create index if not exists usage_by_flow on usage_records (flow, created_at);

-- Migration `usage_response_id` (2026-09-28) for databases created before response_id existed.
-- Idempotent; RLS stays as it is (ON, no policies — only the service-role key is used).
alter table usage_records add column if not exists response_id text;

-- Handy view for /metrics
create or replace view usage_by_flow_v as
select flow,
       count(*)               as calls,
       sum(prompt_tokens)     as prompt_tokens,
       sum(completion_tokens) as completion_tokens,
       sum(total_tokens)      as total_tokens,
       sum(cost_usd)          as cost_usd,
       avg(latency_ms)::int   as avg_latency_ms
from usage_records group by flow;
