-- ============================================
-- SKYTECH CAMPUS - PRODUCTS TABLOSU MOBİL İZİNLERİ (FİNAL)
-- Date: 2025-12-06
-- Description: Products ve canteens tablolarını mobil uygulama için anonim okumaya açar
-- ============================================

-- Products tablosu için anonim (anon) okuma izni ver
-- Mobil uygulama erişim kodu ile giriş yaptığı için anonim kullanıcı olarak kalıyor
-- Bu yüzden products tablosunu okumak için anonim izin gerekiyor

-- Mevcut politikaları kontrol et ve gerekirse sil
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
DROP POLICY IF EXISTS "Enable read access for anon users" ON public.products;
DROP POLICY IF EXISTS "Anon can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can read products" ON public.products;

-- Anonim kullanıcılar için SELECT izni ver
CREATE POLICY "Anon can read products"
ON public.products
FOR SELECT
TO anon
USING (true);

-- Authenticated kullanıcılar için de SELECT izni ver (güvenlik için)
CREATE POLICY "Authenticated can read products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- RLS'i aktif et (eğer kapalıysa)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Canteens tablosu için de anonim okuma izni (ürünleri filtrelemek için gerekli)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.canteens;
DROP POLICY IF EXISTS "Anon can read canteens" ON public.canteens;
DROP POLICY IF EXISTS "Authenticated can read canteens" ON public.canteens;

CREATE POLICY "Anon can read canteens"
ON public.canteens
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Authenticated can read canteens"
ON public.canteens
FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.canteens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- İŞLEM BAŞARIYLA TAMAMLANDI
-- ============================================
-- Bu SQL'i Supabase SQL Editor'de çalıştırın.
-- Mobil uygulama artık products ve canteens tablolarını okuyabilecek.
-- ============================================



