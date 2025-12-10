-- ============================================
-- SKYTECH CAMPUS - STORAGE İZİNLERİ TAMİRİ
-- ============================================
-- Bu script, yedekleme dosyasının "backups" klasörüne
-- yüklenebilmesi için gerekli izinleri tanımlar.
-- ============================================

BEGIN;

-- 1. storage.objects ÜZERİNE RLS KURALLARI
-- ============================================

-- Önce eski politikaları temizleyelim (çakışma olmasın)
DROP POLICY IF EXISTS "Admins can upload backups" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update backups" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete backups" ON storage.objects;
DROP POLICY IF EXISTS "Admins can select backups" ON storage.objects;

-- INSERT (Yükleme) İzni - Sadece Adminler
CREATE POLICY "Admins can upload backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backups' AND (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
  )
);

-- UPDATE (Güncelleme) İzni
CREATE POLICY "Admins can update backups"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'backups' AND (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
  )
);

-- SELECT (Okuma/İndirme) İzni
CREATE POLICY "Admins can select backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' AND (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
  )
);

COMMIT;

-- ============================================
-- ✅ STORAGE İZİNLERİ GÜNCELLENDİ
-- ============================================
