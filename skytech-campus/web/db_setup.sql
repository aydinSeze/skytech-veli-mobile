-- 1. Profiles tablosunu oluştur (Eğer yoksa)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  role text default 'student' check (role in ('admin', 'canteen_staff', 'student', 'parent')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. RLS (Row Level Security) Aç
alter table public.profiles enable row level security;

-- 3. Politikalar (Policies)
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- 4. Yeni kullanıcı kayıt olduğunda otomatik profil oluşturan Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'student');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger'ı bağla
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. ÖRNEK KULLANICI GÜNCELLEME (Bunu kendinize göre düzenleyin)
-- Kendi kullanıcınızı admin yapmak için:
-- update public.profiles set role = 'admin' where email = 'sizin@emailiniz.com';

-- Kantinci oluşturmak için:
-- update public.profiles set role = 'canteen_staff' where email = 'kantinci@skytech.com';
