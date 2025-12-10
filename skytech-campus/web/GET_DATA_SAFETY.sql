-- ============================================
-- SKYTECH CAMPUS - MANUEL VERİ KURTARMA & KONTROL
-- ============================================
-- Bu sorgu, tüm okullardaki öğrencilerin bakiyelerini listeler.
-- Acil durumlarda verileri buradan görebilirsiniz.
-- ============================================

SELECT 
    sch.name as "Okul Adı",
    st.full_name as "Öğrenci Adı",
    st.access_code as "Erişim Kodu",
    st.wallet_balance as "Güncel Bakiye (TL)",
    st.daily_limit as "Günlük Limit",
    st.created_at as "Kayıt Tarihi" -- Düzeltildi: updated_at -> created_at
FROM 
    public.students st
JOIN 
    public.schools sch ON st.school_id = sch.id
ORDER BY 
    sch.name ASC, 
    st.full_name ASC;

-- ============================================
-- NASIL DIŞARI AKTARILIR (EXPORT)?
-- ============================================
-- 1. Bu sorguyu SQL Editor'de çalıştırın (RUN).
-- 2. Sonuçların olduğu tablonun sağ üst köşesinde
--    "CSV" veya "Download" butonu çıkacaktır.
-- 3. O butona basarak tüm veriyi Excel/CSV olarak alabilirsiniz.
-- ============================================
