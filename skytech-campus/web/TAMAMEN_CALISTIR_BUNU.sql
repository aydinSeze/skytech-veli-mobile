-- ============================================
-- SKYTECH CAMPUS - KAMPANYA SİSTEMİ TAM KURULUM
-- TÜM BU DOSYAYI KOPYALA-YAPIŞTIR VE ÇALIŞTIR
-- ============================================

BEGIN;

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

-- ============================================
-- 2. INDEX'LER (PERFORMANS İÇİN)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

-- ============================================
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

-- ============================================
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

COMMIT;

-- ============================================
-- 5. KULLANICIYI ADMIN YAP (EMAIL'İNİZİ YAZIN)
-- ============================================
-- AŞAĞIDAKİ SATIRDAKİ EMAIL'İ KENDİ EMAIL'İNİZLE DEĞİŞTİRİN VE ÇALIŞTIRIN
-- Örnek: 'aydinSezerr@outlook.com' yerine kendi email'inizi yazın

-- Önce mevcut kullanıcıyı kontrol et
SELECT 
    u.id,
    u.email,
    p.role,
    CASE 
        WHEN p.role = 'admin' THEN '✅ ZATEN ADMIN'
        WHEN p.role IS NULL THEN '❌ PROFİL YOK - Aşağıdaki sorguyu çalıştırın'
        ELSE '❌ ADMIN DEĞİL - Aşağıdaki sorguyu çalıştırın'
    END as durum
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'BURAYA_EMAILINIZI_YAZIN';  -- ÖRN: 'aydinSezerr@outlook.com'

-- Eğer yukarıdaki sorguda role 'admin' değilse veya profil yoksa, aşağıdaki sorguyu çalıştırın:

-- Profil varsa güncelle
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'BURAYA_EMAILINIZI_YAZIN'  -- ÖRN: 'aydinSezerr@outlook.com'
)
AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id);

-- Profil yoksa oluştur
INSERT INTO public.profiles (id, email, role, full_name)
SELECT 
    id,
    email,
    'admin' as role,
    COALESCE(raw_user_meta_data->>'full_name', 'Admin') as full_name
FROM auth.users
WHERE email = 'BURAYA_EMAILINIZI_YAZIN'  -- ÖRN: 'aydinSezerr@outlook.com'
AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id
);

-- Sonucu kontrol et
SELECT 
    u.email,
    p.role,
    p.full_name,
    CASE 
        WHEN p.role = 'admin' THEN '✅ BAŞARILI - Artık kampanya ekleyebilirsiniz!'
        ELSE '❌ HATA - Tekrar deneyin'
    END as sonuc
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'BURAYA_EMAILINIZI_YAZIN';  -- ÖRN: 'aydinSezerr@outlook.com'

-- ============================================
-- ✅ TAMAMLANDI!
-- ============================================
-- Şimdi yapmanız gerekenler:
-- 
-- 1. Yukarıdaki tüm SQL'i Supabase SQL Editor'de çalıştırın
-- 2. "BURAYA_EMAILINIZI_YAZIN" yerine kendi email'inizi yazın ve 5. bölümü tekrar çalıştırın
-- 3. Supabase Dashboard -> Storage -> "New bucket" -> Name: "campaigns", Public: true -> Create
-- 4. Storage -> campaigns -> Policies -> Public read access ve Admin upload access ekleyin
-- 5. Web panelini yenileyin (F5)
-- ============================================


