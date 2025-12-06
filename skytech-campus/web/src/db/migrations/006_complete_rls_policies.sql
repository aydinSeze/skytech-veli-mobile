-- ============================================
-- SKYTECH CAMPUS - EKSİK RLS POLİTİKALARI
-- Multi-Tenancy Güvenlik Düzeltmeleri
-- ============================================

-- 1. EXPENSES TABLOSU RLS POLİTİKALARI
-- ============================================

-- RLS'i aktif et (eğer yoksa)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Mevcut güvensiz politikaları kaldır (varsa)
DROP POLICY IF EXISTS "Enable read access for all users" ON expenses;
DROP POLICY IF EXISTS "Enable insert access for all users" ON expenses;
DROP POLICY IF EXISTS "Enable update access for all users" ON expenses;
DROP POLICY IF EXISTS "Enable delete access for all users" ON expenses;

-- Yeni güvenli politikalar
CREATE POLICY "Users can view their school's expenses"
ON expenses FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can insert expenses for their school"
ON expenses FOR INSERT
WITH CHECK (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can update their school's expenses"
ON expenses FOR UPDATE
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can delete their school's expenses"
ON expenses FOR DELETE
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. SUPPLIERS TABLOSU RLS POLİTİKALARI
-- ============================================

-- RLS'i aktif et (eğer yoksa)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Mevcut güvensiz politikaları kaldır (varsa)
DROP POLICY IF EXISTS "Enable read access for all users" ON suppliers;
DROP POLICY IF EXISTS "Enable insert access for all users" ON suppliers;
DROP POLICY IF EXISTS "Enable update access for all users" ON suppliers;
DROP POLICY IF EXISTS "Enable delete access for all users" ON suppliers;

-- Yeni güvenli politikalar
CREATE POLICY "Users can view their school's suppliers"
ON suppliers FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can insert suppliers for their school"
ON suppliers FOR INSERT
WITH CHECK (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can update their school's suppliers"
ON suppliers FOR UPDATE
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can delete their school's suppliers"
ON suppliers FOR DELETE
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. SCHOOL_PERSONNEL TABLOSU RLS POLİTİKALARI (DÜZELTME)
-- ============================================

-- RLS'i aktif et (zaten aktif olabilir)
ALTER TABLE school_personnel ENABLE ROW LEVEL SECURITY;

-- Mevcut güvensiz politikaları kaldır
DROP POLICY IF EXISTS "Enable read access for all users" ON school_personnel;
DROP POLICY IF EXISTS "Enable insert access for all users" ON school_personnel;
DROP POLICY IF EXISTS "Enable update access for all users" ON school_personnel;
DROP POLICY IF EXISTS "Kantinci Personel Tam Yetki" ON school_personnel;
DROP POLICY IF EXISTS "Kantinci personel gorebilir" ON school_personnel;
DROP POLICY IF EXISTS "Kantinci personel ekleyebilir" ON school_personnel;
DROP POLICY IF EXISTS "Kantinci personel duzenleyebilir" ON school_personnel;
DROP POLICY IF EXISTS "Kantinci personel silebilir" ON school_personnel;

-- Yeni güvenli politikalar
CREATE POLICY "Users can view their school's personnel"
ON school_personnel FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can insert personnel for their school"
ON school_personnel FOR INSERT
WITH CHECK (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can update their school's personnel"
ON school_personnel FOR UPDATE
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can delete their school's personnel"
ON school_personnel FOR DELETE
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. MEVCUT POLİTİKALARA ADMIN EXCEPTION EKLE
-- ============================================

-- PRODUCTS - Admin exception ekle
DROP POLICY IF EXISTS "Users can view their school's products" ON products;
CREATE POLICY "Users can view their school's products"
ON products FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- STUDENTS - Admin exception ekle
DROP POLICY IF EXISTS "Users can view their school's students" ON students;
CREATE POLICY "Users can view their school's students"
ON students FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- TRANSACTIONS - Admin exception ekle
DROP POLICY IF EXISTS "Users can view their school's transactions" ON transactions;
CREATE POLICY "Users can view their school's transactions"
ON transactions FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- CANTEENS - Admin exception ekle
DROP POLICY IF EXISTS "Users can view their own canteen" ON canteens;
CREATE POLICY "Users can view their own canteen"
ON canteens FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. SCHOOLS TABLOSU - ADMIN ERİŞİMİ
-- ============================================

-- Schools tablosu için admin politikası (tüm okulları görebilir)
DROP POLICY IF EXISTS "Admin can view all schools" ON schools;
CREATE POLICY "Admin can view all schools"
ON schools FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR
  id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

-- ============================================
-- MİGRASYON TAMAMLANDI
-- ============================================
-- Bu migration dosyası çalıştırıldıktan sonra:
-- 1. Expenses tablosu güvenli hale geldi
-- 2. Suppliers tablosu güvenli hale geldi
-- 3. School Personnel tablosu güvenli hale geldi
-- 4. Tüm tablolarda admin exception'ı eklendi
-- 5. Multi-tenancy güvenliği tam olarak sağlandı
-- ============================================

