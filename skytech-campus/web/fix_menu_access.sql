-- ============================================
-- SKYTECH CAMPUS - MENÜ ERİŞİM DÜZELTMESİ
-- Date: 2025-12-06
-- Description: Kantin ve ürünlerin görünmemesi sorununu çözer.
-- ============================================

BEGIN;

-- 1. KANTİNLER (CANTEENS) TABLOSU
-- ============================================
ALTER TABLE public.canteens DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.canteens TO anon, authenticated, service_role;

-- 2. ÜRÜNLER (PRODUCTS) TABLOSU
-- ============================================
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.products TO anon, authenticated, service_role;

-- 3. OKULLAR (SCHOOLS) TABLOSU (Garanti olsun)
-- ============================================
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.schools TO anon, authenticated, service_role;

COMMIT;

-- ============================================
-- ARTIK MENÜ GÖRÜNMELİ
-- ============================================
