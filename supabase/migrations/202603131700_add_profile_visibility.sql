alter table public.profiles
  add column if not exists show_in_musician_list boolean;

update public.profiles
set show_in_musician_list = true
where role = 'musician'
  and show_in_musician_list is null;

update public.profiles
set show_in_musician_list = false
where role is distinct from 'musician'
  and show_in_musician_list is null;

alter table public.profiles
  alter column show_in_musician_list set default true;

alter table public.profiles
  alter column show_in_musician_list set not null;

comment on column public.profiles.show_in_musician_list is
  'Controls whether a musician is listed in the venue musician directory.';
