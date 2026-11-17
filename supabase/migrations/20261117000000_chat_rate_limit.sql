-- Question counts for the chat's rate limits: per visitor per window, and for
-- everyone together per day. A visitor is a keyed hash of their IP, never the IP.

create table public.chat_usage (
  bucket text not null,                -- 'daily', or 'visitor:<hash>'
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);

create index chat_usage_window_idx on public.chat_usage (window_start);

-- RLS on with no policies, like public.chunks: only the secret key can touch it.
alter table public.chat_usage enable row level security;

-- Counts one question and says whether it may go ahead: 'ok', or the limit it
-- is over, 'visitor' or 'daily'. A question over the visitor limit isn't
-- counted against the daily one, so one visitor can't use up everyone's.
create function public.chat_rate_limit(
  visitor text,
  visitor_limit int,
  visitor_window_seconds int,
  daily_limit int
)
returns text
language plpgsql
set search_path = public
as $$
declare
  visitor_count int;
  daily_count int;
begin
  delete from public.chat_usage where window_start < now() - interval '2 days';

  insert into public.chat_usage as u (bucket, window_start, count)
  values (
    'visitor:' || visitor,
    to_timestamp(floor(extract(epoch from now()) / visitor_window_seconds) * visitor_window_seconds),
    1
  )
  on conflict (bucket, window_start) do update set count = u.count + 1
  returning u.count into visitor_count;
  if visitor_count > visitor_limit then
    return 'visitor';
  end if;

  insert into public.chat_usage as u (bucket, window_start, count)
  values ('daily', date_trunc('day', now() at time zone 'utc') at time zone 'utc', 1)
  on conflict (bucket, window_start) do update set count = u.count + 1
  returning u.count into daily_count;
  if daily_count > daily_limit then
    return 'daily';
  end if;

  return 'ok';
end;
$$;

-- Only the server (secret key / service_role) may call it.
revoke execute on function public.chat_rate_limit(text, int, int, int) from public, anon, authenticated;
