# 📦 STORAGE BUCKET KURULUM ADIMLARI

## ❌ HATA: "Bucket not found"

Bu hata, `campaigns` storage bucket'ının henüz oluşturulmadığını gösterir.

## ✅ ÇÖZÜM: Adım Adım Kurulum

### 1. Supabase Dashboard'a Giriş Yapın
- [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Projenizi seçin

### 2. Storage Bölümüne Gidin
- Sol menüden **"Storage"** seçeneğine tıklayın
- Veya direkt URL: `https://supabase.com/dashboard/project/[PROJECT_ID]/storage/buckets`

### 3. Yeni Bucket Oluşturun
- **"New bucket"** veya **"Create bucket"** butonuna tıklayın

### 4. Bucket Ayarlarını Yapın
- **Name:** `campaigns` (tam olarak bu isim, küçük harf)
- **Public bucket:** ✅ **TRUE** (ÇOK ÖNEMLİ! Mobilde görünsün diye)
- **File size limit:** `5 MB` (isteğe bağlı)
- **Allowed MIME types:** `image/jpeg, image/png, image/webp` (isteğe bağlı)
- **"Create bucket"** butonuna tıklayın

### 5. Storage Politikalarını Ayarlayın

Bucket oluşturulduktan sonra, **Policies** sekmesine gidin:

#### Policy 1: Public Read Access (Herkes Okuyabilsin)
- **"New Policy"** butonuna tıklayın
- **Policy Name:** `Public read access`
- **Allowed operation:** `SELECT` (sadece okuma)
- **Target roles:** `anon`, `authenticated` (her ikisini de seçin)
- **USING expression:** `true`
- **"Save policy"** butonuna tıklayın

#### Policy 2: Admin Upload Access (Sadece Adminler Yükleyebilsin)
- **"New Policy"** butonuna tıklayın
- **Policy Name:** `Admin upload access`
- **Allowed operation:** `INSERT`, `UPDATE`, `DELETE` (hepsini seçin)
- **Target roles:** `authenticated`
- **USING expression:**
```sql
EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
)
```
- **"Save policy"** butonuna tıklayın

### 6. Test Edin
- Web panelinde kampanya ekleme sayfasına gidin
- Resim yüklemeyi deneyin
- Artık "Bucket not found" hatası almamalısınız!

## 🔍 Kontrol Listesi

- [ ] SQL migration çalıştırıldı (`CREATE_CAMPAIGN_SYSTEM.sql`)
- [ ] Storage bucket oluşturuldu (`campaigns`)
- [ ] Bucket public olarak ayarlandı (Public: true)
- [ ] Public read policy eklendi
- [ ] Admin upload policy eklendi
- [ ] Web paneli yenilendi (F5)

## ⚠️ ÖNEMLİ NOTLAR

1. **Bucket ismi tam olarak `campaigns` olmalı** (küçük harf, çoğul)
2. **Public bucket MUTLAKA `true` olmalı**, yoksa mobil uygulamada resimler görünmez
3. **Policies olmadan resim yüklenemez**, mutlaka ekleyin
4. Bucket oluşturulduktan sonra **web panelini yenileyin** (F5)

## 🆘 Hala Çalışmıyorsa

1. Supabase Dashboard -> Storage -> `campaigns` bucket'ının var olduğundan emin olun
2. Bucket'ın "Public" olduğunu kontrol edin
3. Policies'lerin doğru ayarlandığını kontrol edin
4. Tarayıcı konsolunu (F12) açıp hata mesajlarını kontrol edin
5. Supabase Dashboard -> Logs -> API Logs'tan detaylı hata mesajlarını inceleyin



