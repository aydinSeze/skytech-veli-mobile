-- ============================================
-- OKUL ID BULUCU
-- ============================================
-- Bu sorguyu çalıştırıp, çıkan listeden:
-- 1. Bozuk olan okulun ID'sini
-- 2. Yeni açtığınız okulun ID'sini
-- Kopyalayabilirsiniz.
-- ============================================

SELECT 
    name as "OKUL İSMİ", 
    id as "OKUL ID (Bunu Kopyala)",
    created_at as "Kuruluş Tarihi"
FROM 
    public.schools 
ORDER BY 
    created_at DESC;
