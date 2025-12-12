-- ============================================
-- SKYTECH CAMPUS - ACİL DURUM OKUL TRANSFERİ
-- ============================================
-- NASIL KULLANILIR?
-- 1. Aşağıdaki 'ESKI_ID_BURAYA' kısmına bozuk/kaynak okulun ID'sini yapıştırın.
-- 2. 'YENI_ID_BURAYA' kısmına yeni açtığınız okulun ID'sini yapıştırın.
-- 3. RUN butonuna basın.
-- ============================================

DO $$
DECLARE
    -- 👇 BURALARI DOLDURUN (Tırnakları silmeyin!)
    old_school_id uuid := 'ESKI_ID_BURAYA';
    new_school_id uuid := 'YENI_ID_BURAYA';
BEGIN
    -- 1. ÖĞRENCİLER
    UPDATE public.students 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Öğrenciler: % adet taşındı.', row_count;

    -- 2. İŞLEMLER (Harcamalar)
    UPDATE public.transactions 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'İşlemler (Muhasebe): % adet taşındı.', row_count;

    -- 3. SİPARİŞLER
    UPDATE public.orders 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Siparişler: % adet taşındı.', row_count;

    -- 4. ÜRÜNLER
    UPDATE public.products 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Ürünler: % adet taşındı.', row_count;

    -- 5. PERSONEL
    UPDATE public.school_personnel 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Personel: % adet taşındı.', row_count;

    -- 6. ETÜT MENÜSÜ
    UPDATE public.etut_menu 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
     GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Etüt Menüleri: % adet taşındı.', row_count;

    -- 7. KANTİNLER
    UPDATE public.canteens 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
     GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Kantin Hesapları: % adet taşındı.', row_count;

    -- 8. TEDARİKÇİLER
    UPDATE public.suppliers 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
     GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Tedarikçiler: % adet taşındı.', row_count;

    -- 9. GİDERLER
    UPDATE public.expenses 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;
     GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Giderler: % adet taşındı.', row_count;

    RAISE NOTICE '✅ Transfer başarıyla tamamlandı!';
END $$;
