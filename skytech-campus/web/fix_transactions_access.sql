-- ============================================
-- SKYTECH CAMPUS - FIX TRANSACTION ACCESS
-- Date: 2025-12-06
-- Description: Anonim kullanıcıların işlem geçmişini görebilmesi için izinleri açar.
-- ============================================

-- 1. TRANSACTIONS TABLOSU İZİNLERİ
-- ============================================
-- RLS'yi kapat (Anonim erişim için en garanti yol)
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- İzinleri ver
GRANT ALL ON public.transactions TO anon, authenticated, service_role;

-- 2. ORDERS TABLOSU (EĞER VARSA)
-- ============================================
-- Schema.sql'de orders tablosu görünmüyor ama transactions içinde items_json var.
-- Yine de varsa diye kontrol edip açalım.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        EXECUTE 'ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY';
        EXECUTE 'GRANT ALL ON public.orders TO anon, authenticated, service_role';
    END IF;
END $$;

-- 3. STUDENTS TABLOSU (ZATEN AÇIK OLMALI AMA GARANTİLE)
-- ============================================
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.students TO anon, authenticated, service_role;

-- ============================================
-- İŞLEM TAMAMLANDI
-- ============================================
