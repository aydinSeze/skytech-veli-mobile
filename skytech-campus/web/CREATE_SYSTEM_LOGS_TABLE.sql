-- ============================================
-- SKYTECH CAMPUS - SYSTEM LOGS TABLOSU
-- Date: 2025-01-XX
-- Description: Sistem logları ve yedekleme tarih takibi
-- ============================================

BEGIN;

-- 1. SYSTEM_LOGS TABLOSU OLUŞTUR
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_logs (
    id TEXT PRIMARY KEY DEFAULT 'backup_log', -- Tek bir kayıt tutacağız
    last_backup_date DATE, -- Son yedekleme tarihi (YYYY-MM-DD formatında)
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. INDEX'LER
-- ============================================
CREATE INDEX IF NOT EXISTS idx_system_logs_last_backup_date ON public.system_logs(last_backup_date);

-- 3. RLS (ROW LEVEL SECURITY) AYARLARI
-- ============================================
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Adminler okuyabilir
DROP POLICY IF EXISTS "Admins can view system logs" ON public.system_logs;
CREATE POLICY "Admins can view system logs"
ON public.system_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- UPDATE/INSERT: Adminler güncelleyebilir
DROP POLICY IF EXISTS "Admins can update system logs" ON public.system_logs;
CREATE POLICY "Admins can update system logs"
ON public.system_logs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- 4. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_system_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_system_logs_updated_at_trigger ON public.system_logs;
CREATE TRIGGER update_system_logs_updated_at_trigger
    BEFORE UPDATE ON public.system_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_system_logs_updated_at();

COMMIT;

-- ============================================
-- ✅ SYSTEM_LOGS TABLOSU KURULDU
-- ============================================
-- Kullanım:
-- 1. last_backup_date: Son yedekleme tarihini tutar (YYYY-MM-DD)
-- 2. Her günlük yedekleme sonrası bu tablo güncellenir
-- ============================================
