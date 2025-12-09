-- ============================================
-- SKYTECH CAMPUS - ORDERS TABLOSUNA PAYMENT_STATUS EKLEME
-- Date: 2025-01-XX
-- Description: Siparişler tablosuna ödeme durumu kolonu ekleniyor
-- ============================================

BEGIN;

-- payment_status kolonunu ekle (pending, completed, cancelled)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' 
CHECK (payment_status IN ('pending', 'completed', 'cancelled'));

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

COMMIT;

-- ============================================
-- ✅ PAYMENT_STATUS KOLONU EKLENDİ
-- ============================================
-- Değerler:
-- - 'pending': Bakiye düşmedi (sipariş bekliyor)
-- - 'completed': Bakiye düşüldü (sipariş teslim edildi)
-- - 'cancelled': Sipariş iptal edildi
-- ============================================


