-- ============================================
-- SKYTECH CAMPUS - GLOBAL DUYURU SİSTEMİ (ANNOUNCEMENTS)
-- Date: 2025-12-06
-- Description: Admin panelinden yüklenen kampanyaların mobil uygulamada görüntülenmesi
-- ============================================

BEGIN;

-- 1. ANNOUNCEMENTS TABLOSU OLUŞTUR
-- ============================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL, -- Supabase Storage URL
    target_link TEXT NOT NULL, -- Tıklanınca gidilecek link
    is_active BOOLEAN DEFAULT false, -- Aynı anda sadece bir tane aktif olabilir
    created_by UUID REFERENCES auth.users(id), -- Hangi admin oluşturdu
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDEX'LER (PERFORMANS İÇİN)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

-- 3. RLS (ROW LEVEL SECURITY) AYARLARI
-- ============================================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- SELECT: Herkes okuyabilir (anon dahil - mobil uygulama için)
DROP POLICY IF EXISTS "Anyone can read active announcements" ON public.announcements;
CREATE POLICY "Anyone can read active announcements"
ON public.announcements
FOR SELECT
TO anon, authenticated, service_role
USING (true);

-- INSERT: Sadece adminler ekleyebilir
DROP POLICY IF EXISTS "Only admins can insert announcements" ON public.announcements;
CREATE POLICY "Only admins can insert announcements"
ON public.announcements
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- UPDATE: Sadece adminler güncelleyebilir
DROP POLICY IF EXISTS "Only admins can update announcements" ON public.announcements;
CREATE POLICY "Only admins can update announcements"
ON public.announcements
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- DELETE: Sadece adminler silebilir
DROP POLICY IF EXISTS "Only admins can delete announcements" ON public.announcements;
CREATE POLICY "Only admins can delete announcements"
ON public.announcements
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- 4. TRIGGER: Aynı anda sadece bir tane aktif kampanya olsun
-- ============================================
CREATE OR REPLACE FUNCTION ensure_single_active_announcement()
RETURNS TRIGGER AS $$
BEGIN
    -- Eğer yeni kayıt aktif yapılıyorsa, diğerlerini pasif yap
    IF NEW.is_active = true THEN
        UPDATE public.announcements
        SET is_active = false
        WHERE id != NEW.id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_active_announcement ON public.announcements;
CREATE TRIGGER trigger_single_active_announcement
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION ensure_single_active_announcement();

-- 5. STORAGE BUCKET OLUŞTUR (Supabase Storage)
-- ============================================
-- NOT: Storage bucket'ları SQL ile oluşturulamaz, Supabase Dashboard'dan manuel oluşturulmalı
-- Aşağıdaki komutlar sadece referans içindir
-- 
-- Supabase Dashboard -> Storage -> Create Bucket:
-- - Name: "campaigns"
-- - Public: true
-- - File size limit: 5MB (veya istediğiniz limit)
-- - Allowed MIME types: image/jpeg, image/png, image/webp

-- 6. STORAGE POLİTİKALARI (Eğer bucket varsa)
-- ============================================
-- Storage policies için Supabase Dashboard -> Storage -> campaigns -> Policies kullanın
-- Veya aşağıdaki SQL'i çalıştırın (bucket oluşturulduktan sonra):

-- SELECT: Herkes okuyabilir
-- INSERT: Sadece adminler yükleyebilir
-- UPDATE: Sadece adminler güncelleyebilir
-- DELETE: Sadece adminler silebilir

COMMIT;

-- ============================================
-- İŞLEM BAŞARIYLA TAMAMLANDI
-- ============================================
-- ÖNEMLİ: Storage bucket'ı manuel olarak oluşturmanız gerekiyor:
-- 1. Supabase Dashboard -> Storage
-- 2. "New bucket" butonuna tıklayın
-- 3. Name: "campaigns"
-- 4. Public: true
-- 5. Create bucket
-- ============================================

