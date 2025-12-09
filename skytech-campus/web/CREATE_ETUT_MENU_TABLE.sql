-- ============================================
-- SKYTECH CAMPUS - ETÜT MENÜSÜ TABLOSU
-- Date: 2025-01-XX
-- Description: Etüt günleri için yemek menüsü tablosu
-- ============================================

BEGIN;

-- 1. ETÜT MENÜSÜ TABLOSU OLUŞTUR
-- ============================================
CREATE TABLE IF NOT EXISTS public.etut_menu (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    menu_date DATE NOT NULL, -- Menü tarihi
    items_json JSONB NOT NULL, -- Yemek listesi: [{"name": "Yemek Adı", "price": 10.50}]
    is_active BOOLEAN DEFAULT true,
    notification_sent BOOLEAN DEFAULT false, -- Velilere bildirim gönderildi mi?
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDEX'LER (PERFORMANS İÇİN)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_etut_menu_school_id ON public.etut_menu(school_id);
CREATE INDEX IF NOT EXISTS idx_etut_menu_menu_date ON public.etut_menu(menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_etut_menu_is_active ON public.etut_menu(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_etut_menu_school_date ON public.etut_menu(school_id, menu_date);

-- 3. RLS (ROW LEVEL SECURITY) AYARLARI
-- ============================================
ALTER TABLE public.etut_menu ENABLE ROW LEVEL SECURITY;

-- SELECT: Okul yöneticileri ve anonim kullanıcılar (mobil) görebilir
DROP POLICY IF EXISTS "School staff can view etut menus" ON public.etut_menu;
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

-- Anonim kullanıcılar (mobil) görebilir (okul bazlı)
DROP POLICY IF EXISTS "Anon can view etut menus by school" ON public.etut_menu;
CREATE POLICY "Anon can view etut menus by school"
ON public.etut_menu
FOR SELECT
TO anon
USING (true); -- Mobil uygulama okul bazlı filtreleme yapacak

-- INSERT: Okul yöneticileri ekleyebilir
DROP POLICY IF EXISTS "School staff can insert etut menus" ON public.etut_menu;
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
);

-- UPDATE: Okul yöneticileri güncelleyebilir
DROP POLICY IF EXISTS "School staff can update etut menus" ON public.etut_menu;
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
);

-- DELETE: Okul yöneticileri silebilir
DROP POLICY IF EXISTS "School staff can delete etut menus" ON public.etut_menu;
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
);

-- 4. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_etut_menu_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_etut_menu_updated_at ON public.etut_menu;
CREATE TRIGGER trigger_update_etut_menu_updated_at
BEFORE UPDATE ON public.etut_menu
FOR EACH ROW
EXECUTE FUNCTION update_etut_menu_updated_at();

COMMIT;

-- ============================================
-- ✅ ETÜT MENÜSÜ TABLOSU KURULDU
-- ============================================
-- Kullanım:
-- 1. Web panelinden etüt menüsü eklenebilir
-- 2. Mobil uygulama okul bazlı filtreleme ile menüleri görebilir
-- 3. Sipariş sistemi etüt yemekleri için çalışır
-- ============================================


