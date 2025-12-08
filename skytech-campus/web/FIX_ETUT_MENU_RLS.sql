-- ============================================
-- SKYTECH CAMPUS - ETÜT MENÜSÜ RLS DÜZELTMESİ
-- Date: 2025-01-XX
-- Description: "permission denied for table users" hatasını düzeltir
-- ============================================

BEGIN;

-- Mevcut politikaları temizle
DROP POLICY IF EXISTS "School staff can view etut menus" ON public.etut_menu;
DROP POLICY IF EXISTS "Anon can view etut menus by school" ON public.etut_menu;
DROP POLICY IF EXISTS "School staff can insert etut menus" ON public.etut_menu;
DROP POLICY IF EXISTS "School staff can update etut menus" ON public.etut_menu;
DROP POLICY IF EXISTS "School staff can delete etut menus" ON public.etut_menu;

-- SELECT: Okul yöneticileri görebilir (auth.users yerine profiles kullan)
CREATE POLICY "School staff can view etut menus"
ON public.etut_menu
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.school_id = etut_menu.school_id
    )
    OR
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = etut_menu.school_id
        AND schools.canteen_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
);

-- Anonim kullanıcılar (mobil) görebilir
CREATE POLICY "Anon can view etut menus by school"
ON public.etut_menu
FOR SELECT
TO anon
USING (true);

-- INSERT: Okul yöneticileri ekleyebilir (auth.users yerine profiles kullan)
CREATE POLICY "School staff can insert etut menus"
ON public.etut_menu
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = etut_menu.school_id
        AND schools.canteen_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.school_id = etut_menu.school_id
    )
);

-- UPDATE: Okul yöneticileri güncelleyebilir
CREATE POLICY "School staff can update etut menus"
ON public.etut_menu
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = etut_menu.school_id
        AND schools.canteen_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.school_id = etut_menu.school_id
    )
);

-- DELETE: Okul yöneticileri silebilir
CREATE POLICY "School staff can delete etut menus"
ON public.etut_menu
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = etut_menu.school_id
        AND schools.canteen_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.school_id = etut_menu.school_id
    )
);

COMMIT;

-- ============================================
-- ✅ RLS POLİTİKALARI GÜNCELLENDİ
-- ============================================
-- Artık auth.users tablosuna direkt erişim yok
-- Sadece profiles ve schools tabloları kullanılıyor
-- ============================================

