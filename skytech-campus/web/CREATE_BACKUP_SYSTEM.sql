-- ============================================
-- SKYTECH CAMPUS - YEDEKLEME SİSTEMİ (7 GÜNLÜK)
-- Date: 2025-01-XX
-- Description: Okul yedeklemelerini 7 gün saklama ve otomatik silme
-- ============================================

BEGIN;

-- 1. YEDEKLEME TABLOSU OLUŞTUR
-- ============================================
CREATE TABLE IF NOT EXISTS public.school_backups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    backup_data JSONB NOT NULL, -- Tüm yedekleme verisi burada
    backup_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    file_name TEXT -- İndirilen dosya adı
);

-- 2. INDEX'LER (PERFORMANS İÇİN)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_school_backups_school_id ON public.school_backups(school_id);
CREATE INDEX IF NOT EXISTS idx_school_backups_backup_date ON public.school_backups(backup_date DESC);
CREATE INDEX IF NOT EXISTS idx_school_backups_created_by ON public.school_backups(created_by);

-- 3. RLS (ROW LEVEL SECURITY) AYARLARI
-- ============================================
ALTER TABLE public.school_backups ENABLE ROW LEVEL SECURITY;

-- SELECT: Adminler ve okul yöneticileri görebilir
DROP POLICY IF EXISTS "Admins can view backups" ON public.school_backups;
CREATE POLICY "Admins can view backups"
ON public.school_backups
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = school_backups.school_id
        AND schools.canteen_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
);

-- INSERT: Adminler ve okul yöneticileri ekleyebilir
DROP POLICY IF EXISTS "Admins can insert backups" ON public.school_backups;
CREATE POLICY "Admins can insert backups"
ON public.school_backups
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
);

-- DELETE: Adminler silebilir (otomatik silme için)
DROP POLICY IF EXISTS "Admins can delete backups" ON public.school_backups;
CREATE POLICY "Admins can delete backups"
ON public.school_backups
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- 4. OTOMATİK SİLME FONKSİYONU (7 GÜNDEN ESKİ YEDEKLEMELERİ SİL)
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
RETURNS void AS $$
BEGIN
    DELETE FROM public.school_backups
    WHERE backup_date < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. OTOMATİK SİLME TRİGGERİ (HER GÜN ÇALIŞACAK)
-- ============================================
-- Not: Supabase Cron Jobs kullanılabilir veya manuel olarak çalıştırılabilir
-- pg_cron extension'ı aktifse:
-- SELECT cron.schedule('cleanup-backups', '0 2 * * *', 'SELECT public.cleanup_old_backups()');

COMMIT;

-- ============================================
-- ✅ YEDEKLEME SİSTEMİ KURULDU
-- ============================================
-- Kullanım:
-- 1. Yedekleme yapıldığında `school_backups` tablosuna kaydedilir
-- 2. Son 7 günlük yedeklemeler görüntülenebilir
-- 3. 7 günden eski yedeklemeler otomatik silinir
-- ============================================


