-- Chunks of /content with their embeddings, for hybrid (vector + full-text) search.

create extension if not exists vector with schema extensions;

create table public.chunks (
  id text primary key,                 -- e.g. "projects/rep-tracker#stack"
  section_id text not null,
  file text not null,                  -- e.g. "projects/rep-tracker.md"
  page_title text not null,
  heading text not null,
  url text not null,                   -- citation link, e.g. "/projects/rep-tracker#stack"
  content text not null,               -- section text shown to the model
  search_text text not null,           -- title + summary + content: embedded and indexed
  content_hash text not null,          -- lets the ingest skip unchanged chunks
  embedding extensions.vector(1024) not null,
  fts tsvector generated always as (to_tsvector('english', search_text)) stored,
  updated_at timestamptz not null default now()
);

-- No vector index: with a few dozen rows an exact scan is faster than an
-- approximate (HNSW) index and never misses a match. Add one past ~10k rows.
create index chunks_fts_idx on public.chunks using gin (fts);

-- RLS on with no policies: the publishable key can't read or write anything.
-- The server uses the secret key, which bypasses RLS.
alter table public.chunks enable row level security;

-- Nearest chunks by cosine distance.
create function public.match_chunks_vector(query_embedding extensions.vector(1024), match_count int)
returns table (id text, file text, page_title text, heading text, url text, content text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.file, c.page_title, c.heading, c.url, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Full-text matches. Terms are OR-ed rather than AND-ed: a natural-language
-- question ("Has he used TypeScript in production?") rarely has every word in
-- one chunk, and ts_rank_cd already ranks chunks matching more terms higher.
create function public.match_chunks_text(query_text text, match_count int)
returns table (id text, file text, page_title text, heading text, url text, content text, rank real)
language sql stable
set search_path = public
as $$
  select c.id, c.file, c.page_title, c.heading, c.url, c.content,
         ts_rank_cd(c.fts, q.query) as rank
  from public.chunks c,
       (select replace(plainto_tsquery('english', query_text)::text, ' & ', ' | ')::tsquery as query) q
  where c.fts @@ q.query
  order by rank desc
  limit match_count;
$$;

-- Only the server (secret key / service_role) may call the search functions.
revoke execute on function public.match_chunks_vector(extensions.vector, int) from public, anon, authenticated;
revoke execute on function public.match_chunks_text(text, int) from public, anon, authenticated;
