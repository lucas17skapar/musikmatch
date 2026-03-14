create table if not exists public.musician_reviews (
  id bigserial primary key,
  musician_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.profiles(id) on delete cascade,
  gig_id bigint references public.gigs(id) on delete set null,
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_musician_reviews_musician_created_at
  on public.musician_reviews (musician_id, created_at desc);

create unique index if not exists idx_musician_reviews_unique_venue_gig
  on public.musician_reviews (venue_id, gig_id)
  where gig_id is not null;

alter table public.musician_reviews enable row level security;

grant select, insert, update, delete on public.musician_reviews to authenticated;
grant usage, select on sequence public.musician_reviews_id_seq to authenticated;

drop policy if exists "musician_reviews_read_authenticated" on public.musician_reviews;
create policy "musician_reviews_read_authenticated"
on public.musician_reviews
for select
to authenticated
using (true);

drop policy if exists "musician_reviews_insert_own_venue" on public.musician_reviews;
create policy "musician_reviews_insert_own_venue"
on public.musician_reviews
for insert
to authenticated
with check (
  venue_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'venue'
  )
  and (
    gig_id is null
    or exists (
      select 1
      from public.applications a
      join public.gigs g on g.id = a.gig_id
      where a.musician_id = musician_reviews.musician_id
        and a.gig_id = musician_reviews.gig_id
        and a.status = 'accepted'
        and g.venue_id = auth.uid()
    )
  )
);

drop policy if exists "musician_reviews_update_own_venue" on public.musician_reviews;
create policy "musician_reviews_update_own_venue"
on public.musician_reviews
for update
to authenticated
using (venue_id = auth.uid())
with check (venue_id = auth.uid());

drop policy if exists "musician_reviews_delete_own_venue" on public.musician_reviews;
create policy "musician_reviews_delete_own_venue"
on public.musician_reviews
for delete
to authenticated
using (venue_id = auth.uid());
