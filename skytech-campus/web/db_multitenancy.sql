-- 1. CANTEENS Tablosuna school_id ekle
alter table public.canteens 
add column if not exists school_id uuid references public.schools(id) on delete cascade;

-- 2. PRODUCTS Tablosuna school_id ekle
alter table public.products 
add column if not exists school_id uuid references public.schools(id) on delete cascade;

-- 3. TRANSACTIONS Tablosuna school_id ekle
alter table public.transactions 
add column if not exists school_id uuid references public.schools(id) on delete cascade;

-- 4. STUDENTS Tablosunu Kontrol Et (Zaten varsa hata vermez)
alter table public.students 
add column if not exists school_id uuid references public.schools(id) on delete cascade;

-- 5. MEVCUT VERİLERİ GÜNCELLE (Opsiyonel: İlk okula ata)
-- Eğer hiç okul yoksa bu adım çalışmaz veya null kalır.
-- Örnek: İlk okulu bul ve null olanları ona ata.
do $$
declare
  first_school_id uuid;
begin
  select id into first_school_id from public.schools limit 1;
  
  if first_school_id is not null then
    update public.canteens set school_id = first_school_id where school_id is null;
    update public.products set school_id = first_school_id where school_id is null;
    update public.transactions set school_id = first_school_id where school_id is null;
    update public.students set school_id = first_school_id where school_id is null;
  end if;
end $$;
