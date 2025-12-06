-- ============================================
-- SKYTECH CAMPUS - TAM KURULUM VE DÜZELTME (TEK DOSYA)
-- Date: 2025-12-06
-- Description: Bu kodu Supabase SQL Editor'de çalıştırın.
-- Eksik tabloları oluşturur ve mobil uygulama izinlerini açar.
-- ============================================

BEGIN;

-- 1. EKSİK TABLOLARI OLUŞTUR (EĞER YOKSA)
-- ============================================

-- Orders (Siparişler) Tablosu
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL DEFAULT 'mobile', -- 'mobile', 'supplier'
    items_json JSONB NOT NULL, -- [{name: "Tost", price: 10}, ...]
    total_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed'
    notes TEXT,
    completed_at TIMESTAMPTZ
);

-- 2. İZİNLERİ AÇ (RLS DISABLE)
-- ============================================

-- Transactions
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.transactions TO anon, authenticated, service_role;

-- Orders
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.orders TO anon, authenticated, service_role;

-- Students
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.students TO anon, authenticated, service_role;

-- Products (Menü görüntüleme için)
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.products TO anon, authenticated, service_role;

COMMIT;

-- ============================================
-- İŞLEM BAŞARIYLA TAMAMLANDI
-- ============================================
