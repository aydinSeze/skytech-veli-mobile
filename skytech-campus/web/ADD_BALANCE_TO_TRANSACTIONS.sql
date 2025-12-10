-- ============================================
-- SKYTECH CAMPUS - TRANSACTIONS TABLOSUNA BAKİYE BİLGİSİ EKLEME
-- Date: 2025-01-XX
-- Description: Her işlem için önceki ve sonraki bakiye bilgisini kaydetmek için
-- ============================================

BEGIN;

-- previous_balance kolonu ekle (işlem öncesi bakiye)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS previous_balance NUMERIC DEFAULT 0;

-- new_balance kolonu ekle (işlem sonrası bakiye)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS new_balance NUMERIC DEFAULT 0;

-- Mevcut transaction'lar için bakiye bilgilerini hesapla (opsiyonel - geçmiş veriler için)
-- Bu kısım çalıştırılabilir ama mevcut veriler için doğru olmayabilir
-- UPDATE public.transactions 
-- SET previous_balance = COALESCE((SELECT wallet_balance FROM students WHERE id = transactions.student_id), 0) + COALESCE(amount, 0),
--     new_balance = COALESCE((SELECT wallet_balance FROM students WHERE id = transactions.student_id), 0)
-- WHERE previous_balance IS NULL OR previous_balance = 0;

COMMIT;

-- ============================================
-- ✅ KOLONLAR EKLENDİ
-- ============================================
-- Artık her transaction'da previous_balance ve new_balance bilgileri kaydedilecek
-- ============================================



