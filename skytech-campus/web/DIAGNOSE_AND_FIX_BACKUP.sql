-- ============================================
-- SKYTECH CAMPUS - YEDEKLEME SİSTEMİ TAMİR VE KURULUM SCRİPTİ
-- ============================================
-- Bu script:
-- 1. system_settings tablosunu oluşturur (Eğer yoksa)
-- 2. school_backups tablosunu oluşturur (Eğer yoksa)
-- 3. Gerekli RLS kurallarını tanımlar
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1. SYSTEM_SETTINGS TABLOSU (KRİTİK - BU EKSİK OLABİLİR)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admin okuyabilsin
DROP POLICY IF EXISTS "Admin can view all settings" ON public.system_settings;
CREATE POLICY "Admin can view all settings" ON public.system_settings FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Admin güncelleyebilsin
DROP POLICY IF EXISTS "Admin can update all settings" ON public.system_settings;
CREATE POLICY "Admin can update all settings" ON public.system_settings FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Admin ekleyebilsin
DROP POLICY IF EXISTS "Admin can insert settings" ON public.system_settings;
CREATE POLICY "Admin can insert settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Varsayılan değer ekle (Komisyon oranı)
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('commission_rate', '0.10', 'Her satıştan düşülecek komisyon oranı (TL cinsinden)')
ON CONFLICT (setting_key) DO NOTHING;

-- --------------------------------------------
-- 2. SCHOOL_BACKUPS TABLOSU
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_backups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    backup_data JSONB NOT NULL,
    backup_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    file_name TEXT
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_school_backups_school_id ON public.school_backups(school_id);
CREATE INDEX IF NOT EXISTS idx_school_backups_backup_date ON public.school_backups(backup_date DESC);

-- RLS
ALTER TABLE public.school_backups ENABLE ROW LEVEL SECURITY;

-- Okuma (Admin + Okul Yöneticisi)
DROP POLICY IF EXISTS "Admins can view backups" ON public.school_backups;
CREATE POLICY "Admins can view backups" ON public.school_backups FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'school_admin'))
    OR EXISTS (SELECT 1 FROM public.schools WHERE schools.id = school_backups.school_id AND schools.canteen_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Ekleme (Admin + Okul Yöneticisi)
DROP POLICY IF EXISTS "Admins can insert backups" ON public.school_backups;
CREATE POLICY "Admins can insert backups" ON public.school_backups FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'school_admin'))
);

-- Silme (Sadece Admin)
DROP POLICY IF EXISTS "Admins can delete backups" ON public.school_backups;
CREATE POLICY "Admins can delete backups" ON public.school_backups FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

COMMIT;

-- ============================================
-- ✅ YEDEKLEME VERİTABANI ALTYAPISI OLUŞTURULDU
-- ============================================
