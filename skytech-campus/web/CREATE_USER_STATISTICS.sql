-- ============================================
-- SKYTECH CAMPUS - KULLANICI İSTATİSTİKLERİ SİSTEMİ
-- Date: 2025-12-07
-- Description: Mobil uygulama kullanıcı istatistikleri ve aktiflik takibi
-- ============================================

-- 1. APP_USAGE TABLOSU OLUŞTUR
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'app_open', 'app_close', 'feature_used'
    feature_name TEXT, -- 'menu', 'orders', 'profile', vb.
    session_duration INTEGER, -- Saniye cinsinden
    device_info JSONB -- {platform: 'ios'|'android'|'web', version: '...'}
);

-- 2. INDEX'LER
-- ============================================
CREATE INDEX IF NOT EXISTS idx_app_usage_student_id ON public.app_usage(student_id);
CREATE INDEX IF NOT EXISTS idx_app_usage_created_at ON public.app_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_usage_action ON public.app_usage(action);

-- 3. RLS AYARLARI
-- ============================================
ALTER TABLE public.app_usage ENABLE ROW LEVEL SECURITY;

-- SELECT: Adminler okuyabilir
DROP POLICY IF EXISTS "Admins can read app usage" ON public.app_usage;
CREATE POLICY "Admins can read app usage"
ON public.app_usage
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- INSERT: Anonim kullanıcılar (mobil) kayıt ekleyebilir
DROP POLICY IF EXISTS "Anyone can insert app usage" ON public.app_usage;
CREATE POLICY "Anyone can insert app usage"
ON public.app_usage
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 4. GÜNLÜK AKTİF KULLANICI SAYISINI HESAPLAYAN VIEW
-- ============================================
CREATE OR REPLACE VIEW public.daily_active_users AS
SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT student_id) as active_users,
    COUNT(*) as total_actions
FROM public.app_usage
WHERE action = 'app_open'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 5. KULLANICI AKTİFLİK SEVİYESİNİ HESAPLAYAN FONKSİYON
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_activity_stats(
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    total_sessions INTEGER,
    total_duration INTEGER,
    last_active TIMESTAMPTZ,
    activity_level TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.full_name,
        COUNT(DISTINCT DATE(au.created_at))::INTEGER as total_sessions,
        COALESCE(SUM(au.session_duration), 0)::INTEGER as total_duration,
        MAX(au.created_at) as last_active,
        CASE
            WHEN COUNT(DISTINCT DATE(au.created_at)) >= days_back * 0.8 THEN 'Çok Aktif'
            WHEN COUNT(DISTINCT DATE(au.created_at)) >= days_back * 0.5 THEN 'Aktif'
            WHEN COUNT(DISTINCT DATE(au.created_at)) >= days_back * 0.2 THEN 'Orta'
            WHEN COUNT(DISTINCT DATE(au.created_at)) > 0 THEN 'Az Aktif'
            ELSE 'Pasif'
        END as activity_level
    FROM public.students s
    LEFT JOIN public.app_usage au ON s.id = au.student_id 
        AND au.created_at >= NOW() - (days_back || ' days')::INTERVAL
    GROUP BY s.id, s.full_name
    ORDER BY total_sessions DESC, last_active DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ✅ SQL MIGRATION TAMAMLANDI
-- ============================================



