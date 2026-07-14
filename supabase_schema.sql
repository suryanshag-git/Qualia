-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create the interviews table
create table if not exists public.interviews (
    id uuid primary key,
    title text not null,
    transcript text not null,
    participant_info jsonb,
    date timestamp with time zone,
    metadata jsonb,
    embedding vector(768),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the insights table
create table if not exists public.insights (
    id uuid primary key,
    interview_id uuid references public.interviews(id) on delete cascade not null,
    data jsonb not null,
    is_mock boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable Row Level Security (RLS) or enable it with open policies for simple client access
alter table public.interviews enable row level security;
alter table public.insights enable row level security;

-- Create public read/write access policies for testing/demo purposes
create policy "Allow public read access to interviews" on public.interviews for select using (true);
create policy "Allow public insert access to interviews" on public.interviews for insert with check (true);
create policy "Allow public update access to interviews" on public.interviews for update using (true);
create policy "Allow public delete access to interviews" on public.interviews for delete using (true);

create policy "Allow public read access to insights" on public.insights for select using (true);
create policy "Allow public insert access to insights" on public.insights for insert with check (true);
create policy "Allow public update access to insights" on public.insights for update using (true);
create policy "Allow public delete access to insights" on public.insights for delete using (true);

-- Create the semantic similarity search function (RPC) used by the repository
create or replace function match_interviews (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  title text,
  transcript text,
  participant_info jsonb,
  date timestamp with time zone,
  metadata jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    interviews.id,
    interviews.title,
    interviews.transcript,
    interviews.participant_info,
    interviews.date,
    interviews.metadata,
    interviews.created_at,
    interviews.updated_at,
    (1 - (interviews.embedding <=> query_embedding))::float as similarity
  from interviews
  where (1 - (interviews.embedding <=> query_embedding)) >= match_threshold
  order by interviews.embedding <=> query_embedding
  limit match_count;
end;
$$;
