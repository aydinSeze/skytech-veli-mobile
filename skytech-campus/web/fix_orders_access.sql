-- ============================================
-- SKYTECH CAMPUS - FIX ORDERS ACCESS
-- Date: 2025-12-06
-- Description: Anonim kullanıcıların sipariş detaylarını görebilmesi için orders tablosunun izinlerini açar.
-- ============================================

-- ORDERS TABLOSU İZİNLERİ
-- ============================================
-- RLS'yi kapat (Anonim erişim için)
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- İzinleri ver
GRANT ALL ON public.orders TO anon, authenticated, service_role;

-- ============================================
-- İŞLEM TAMAMLANDI
-- ============================================
