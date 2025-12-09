-- ============================================
-- SKYTECH CAMPUS - ANNOUNCEMENTS TRIGGER DÜZELTMESİ
-- Date: 2025-12-07
-- Description: Sadece kampanyalar için tek aktif olmalı, haberler için sınır yok
-- ============================================

-- Eski trigger fonksiyonunu güncelle
CREATE OR REPLACE FUNCTION ensure_single_active_announcement()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece 'ana_sayfa' (kampanyalar) için tek aktif kontrolü yap
    -- 'haberler' için sınır yok, istediği kadar aktif olabilir
    IF NEW.is_active = true AND NEW.display_location = 'ana_sayfa' THEN
        -- Sadece aynı display_location'daki diğerlerini pasif yap
        UPDATE public.announcements
        SET is_active = false
        WHERE id != NEW.id 
          AND is_active = true 
          AND display_location = 'ana_sayfa';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı yeniden oluştur
DROP TRIGGER IF EXISTS trigger_single_active_announcement ON public.announcements;
CREATE TRIGGER trigger_single_active_announcement
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION ensure_single_active_announcement();

-- ============================================
-- ✅ GÜNCELLEME TAMAMLANDI
-- ============================================
-- Artık:
-- - Kampanyalar (ana_sayfa): Sadece 1 aktif olabilir
-- - Haberler (haberler): İstediğiniz kadar aktif olabilir
-- ============================================


