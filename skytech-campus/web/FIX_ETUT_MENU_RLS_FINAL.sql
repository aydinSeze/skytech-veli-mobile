-- ============================================
-- SKYTECH CAMPUS - ETÜT MENÜSÜ RLS FİNAL DÜZELTMESİ
-- Date: 2025-01-XX
-- Description: "permission denied for table users" hatasını KESİN ÇÖZER
-- ============================================

BEGIN;

-- TÜM MEVCUT POLİTİKALARI TEMİZLE
DROP POLICY IF EXISTS "School staff can view etut menus" ON public.etut_menu;
DROP POLICY IF EXISTS "Anon can view etut menus by school" ON public.etut_menu;
DROP POLICY IF EXISTS "School staff can insert etut menus" ON public.etut_menu;
DROP POLICY IF EXISTS "School staff can update etut menus" ON public.etut_menu;
DROP POLICY IF EXISTS "School staff can delete etut menus" ON public.etut_menu;

-- SELECT: Okul yöneticileri görebilir (auth.users KULLANMAYIN!)
CREATE POLICY "School staff can view etut menus"
ON public.etut_menu
FOR SELECT
TO authenticated
USING (
    -- Profil'den school_id kontrolü
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.school_id = etut_menu.school_id
    )
    OR
    -- Admin kontrolü
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
    OR
    -- Schools tablosundan canteen_email kontrolü (auth.users YOK!)
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = etut_menu.school_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.email = schools.canteen_email
        )
    )
);

-- Anonim kullanıcılar (mobil) görebilir
CREATE POLICY "Anon can view etut menus by school"
ON public.etut_menu
FOR SELECT
TO anon
USING (true);

-- INSERT: Okul yöneticileri ekleyebilir (auth.users KULLANMAYIN!)
CREATE POLICY "School staff can insert etut menus"
ON public.etut_menu
FOR INSERT
TO authenticated
WITH CHECK (
    -- Profil'den school_id kontrolü
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.school_id = etut_menu.school_id
    )
    OR
    -- Admin kontrolü
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
    OR
    -- Schools tablosundan canteen_email kontrolü
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = etut_menu.school_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.email = schools.canteen_email
        )
    )
);

-- UPDATE: Okul yöneticileri güncelleyebilir
CREATE POLICY "School staff can update etut menus"
ON public.etut_menu
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.school_id = etut_menu.school_id
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = etut_menu.school_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.email = schools.canteen_email
        )
    )
);

-- DELETE: Okul yöneticileri silebilir
CREATE POLICY "School staff can delete etut menus"
ON public.etut_menu
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.school_id = etut_menu.school_id
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'school_admin')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.schools
        WHERE schools.id = etut_menu.school_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.email = schools.canteen_email
        )
    )
);

COMMIT;

-- ============================================
-- ✅ RLS POLİTİKALARI FİNAL GÜNCELLENDİ
-- ============================================
-- Artık auth.users tablosuna HİÇBİR ŞEKİLDE erişim yok
-- Sadece profiles ve schools tabloları kullanılıyor
-- ============================================


