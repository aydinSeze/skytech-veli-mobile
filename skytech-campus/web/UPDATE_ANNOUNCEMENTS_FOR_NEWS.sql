-- ============================================
-- SKYTECH CAMPUS - ANNOUNCEMENTS TABLOSUNA HABERLER İÇİN ALAN EKLEME
-- Date: 2025-12-07
-- Description: Kampanyalar ve haberler için ayrım yapmak için display_location alanı ekleniyor
-- ============================================

-- display_location alanını ekle (ana_sayfa veya haberler)
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS display_location TEXT DEFAULT 'ana_sayfa' CHECK (display_location IN ('ana_sayfa', 'haberler'));

-- view_count alanını ekle (PDF indirme için)
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- description, start_date, end_date alanlarını ekle (eğer yoksa)
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- increment_view_count fonksiyonunu oluştur (eğer yoksa)
-- Önce eski fonksiyonu sil (eğer varsa)
DROP FUNCTION IF EXISTS public.increment_view_count(UUID);
DROP FUNCTION IF EXISTS public.increment_view_count(row_id UUID);

-- Yeni fonksiyonu oluştur (row_id parametresi ile - Supabase RPC uyumluluğu için)
CREATE OR REPLACE FUNCTION public.increment_view_count(row_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.announcements
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ✅ GÜNCELLEME TAMAMLANDI
-- ============================================

