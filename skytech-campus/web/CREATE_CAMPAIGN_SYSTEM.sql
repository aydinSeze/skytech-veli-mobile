-- ============================================
-- SKYTECH CAMPUS - GLOBAL DUYURU SİSTEMİ (KAMPANYA)
-- Date: 2025-12-06
-- Description: Admin panelinden yüklenen kampanyaların mobil uygulamada görüntülenmesi
-- 
-- KULLANIM: Bu SQL'i Supabase Dashboard -> SQL Editor'de çalıştırın
-- ============================================

-- 1. ANNOUNCEMENTS TABLOSU OLUŞTUR
-- ============================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    target_link TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
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
DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
CREATE POLICY "Anyone can read announcements"
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

-- ============================================
-- ✅ SQL MIGRATION TAMAMLANDI
-- ============================================
-- Şimdi aşağıdaki adımları takip edin:
-- 
-- 1. STORAGE BUCKET OLUŞTUR (Manuel):
--    - Supabase Dashboard -> Storage
--    - "New bucket" butonuna tıklayın
--    - Name: "campaigns"
--    - Public: true (ÖNEMLİ: Mobilde görünsün diye)
--    - File size limit: 5MB (isteğe bağlı)
--    - Allowed MIME types: image/jpeg, image/png, image/webp
--    - "Create bucket" butonuna tıklayın
-- 
-- 2. STORAGE POLİTİKALARI (Manuel):
--    - Supabase Dashboard -> Storage -> campaigns -> Policies
--    - "New Policy" butonuna tıklayın
--    
--    Policy 1 - Public Read:
--    - Policy Name: "Public read access"
--    - Allowed operation: SELECT
--    - Target roles: anon, authenticated
--    - USING expression: true
--    - "Save policy" butonuna tıklayın
--    
--    Policy 2 - Admin Upload:
--    - Policy Name: "Admin upload access"
--    - Allowed operation: INSERT, UPDATE, DELETE
--    - Target roles: authenticated
--    - USING expression: 
--      EXISTS (
--          SELECT 1 FROM public.profiles 
--          WHERE id = auth.uid() 
--          AND role = 'admin'
--      )
--    - "Save policy" butonuna tıklayın
-- 
-- 3. WEB PANELİNİ YENİLE:
--    - Tarayıcıda sayfayı yenileyin (F5)
--    - Artık kampanya ekleyebilmelisiniz!
-- ============================================
