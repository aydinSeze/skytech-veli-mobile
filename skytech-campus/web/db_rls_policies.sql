-- 1. RLS'i Aktif Et
alter table public.products enable row level security;
alter table public.students enable row level security;
alter table public.transactions enable row level security;
alter table public.canteens enable row level security;

-- 2. PRODUCTS Politikaları
create policy "Users can view their school's products"
on public.products for select
using (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

create policy "Canteen staff can insert products for their school"
on public.products for insert
with check (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

create policy "Canteen staff can update their school's products"
on public.products for update
using (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

create policy "Canteen staff can delete their school's products"
on public.products for delete
using (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

-- 3. STUDENTS Politikaları
create policy "Users can view their school's students"
on public.students for select
using (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

create policy "Canteen staff can manage students"
on public.students for all
using (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

-- 4. TRANSACTIONS Politikaları
create policy "Users can view their school's transactions"
on public.transactions for select
using (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

create policy "Canteen staff can insert transactions"
on public.transactions for insert
with check (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

-- 5. CANTEENS Politikaları
create policy "Users can view their own canteen"
on public.canteens for select
using (
  school_id in (select school_id from public.profiles where id = auth.uid())
);

-- NOT: Adminlerin her şeyi görmesi gerekiyorsa, politikalar 'OR role = admin' şeklinde güncellenebilir.
-- Ancak şu an tam izolasyon sağlıyoruz.
