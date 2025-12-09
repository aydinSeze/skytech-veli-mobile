-- ============================================
-- SKYTECH CAMPUS - ETÜT MENÜSÜ TABLOSU KONTROLÜ
-- Date: 2025-01-XX
-- Description: Etüt menüsü tablosunun var olup olmadığını kontrol eder
-- ============================================

-- Tablo var mı kontrol et
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'etut_menu'
ORDER BY ordinal_position;

-- Eğer tablo yoksa şu hatayı alırsınız:
-- "relation "information_schema.columns" does not exist" veya boş sonuç

-- Tablo varsa tüm kolonları göreceksiniz:
-- id, school_id, menu_date, items_json, is_active, notification_sent, created_at, updated_at

-- ============================================
-- EĞER TABLO YOKSA:
-- CREATE_ETUT_MENU_TABLE.sql dosyasını çalıştırın
-- ============================================


