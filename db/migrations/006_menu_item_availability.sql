alter table if exists public.menu_items
add column if not exists is_available boolean not null default true;
