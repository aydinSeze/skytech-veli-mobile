-- ============================================
-- SKYTECH CAMPUS - TRANSACTIONS TABLOSUNA ORDER_ID EKLEME
-- Date: 2025-12-09
-- Description: Transactions tablosuna order_id kolonu ekleniyor
-- ============================================

BEGIN;

-- order_id kolonu ekle (sipariş ID'si - nullable çünkü her transaction sipariş değil)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id);

COMMIT;

-- ============================================
-- ✅ ORDER_ID KOLONU EKLENDİ
-- ============================================
-- Artık transaction'lar sipariş ID'si ile ilişkilendirilebilir
-- ============================================


