# 🚀 KAMPANYA SİSTEMİ - ADIM ADIM KURULUM REHBERİ

## ⚠️ ÖNEMLİ: TÜM ADIMLARI SIRASIYLA YAPIN!

---

## ADIM 1: SQL MİGRATİON ÇALIŞTIR (5 DAKİKA)

### 1.1. Supabase Dashboard'a Git
- [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Projenizi seçin

### 1.2. SQL Editor'ü Aç
- Sol menüden **"SQL Editor"** seçeneğine tıklayın
- Veya direkt: `https://supabase.com/dashboard/project/[PROJECT_ID]/sql/new`

### 1.3. SQL Dosyasını Çalıştır
1. `TAMAMEN_CALISTIR_BUNU.sql` dosyasını açın
2. **TÜM İÇERİĞİNİ** kopyalayın
3. Supabase SQL Editor'e yapıştırın
4. **"BURAYA_EMAILINIZI_YAZIN"** yazan yerleri kendi email'inizle değiştirin
   - Örnek: `'aydinSezerr@outlook.com'` yerine kendi email'inizi yazın
5. **"Run"** veya **"Ctrl+Enter"** ile çalıştırın
6. **"Success"** mesajını bekleyin

---

## ADIM 2: STORAGE BUCKET OLUŞTUR (2 DAKİKA)

### 2.1. Storage Bölümüne Git
- Supabase Dashboard -> Sol menüden **"Storage"** seçeneğine tıklayın

### 2.2. Yeni Bucket Oluştur
- **"New bucket"** veya **"Create bucket"** butonuna tıklayın

### 2.3. Bucket Ayarları
- **Name:** `campaigns` (tam olarak bu isim, küçük harf)
- **Public bucket:** ✅ **TRUE** (ÇOK ÖNEMLİ!)
- **File size limit:** `5 MB` (isteğe bağlı)
- **Allowed MIME types:** `image/jpeg, image/png, image/webp` (isteğe bağlı)
- **"Create bucket"** butonuna tıklayın

---

## ADIM 3: STORAGE POLİTİKALARI EKLE (3 DAKİKA)

### 3.1. Policies Sekmesine Git
- Storage -> `campaigns` bucket'ına tıklayın
- **"Policies"** sekmesine tıklayın

### 3.2. Policy 1: Public Read Access
- **"New Policy"** butonuna tıklayın
- **Policy Name:** `Public read access`
- **Allowed operation:** `SELECT` (sadece okuma)
- **Target roles:** `anon`, `authenticated` (her ikisini de seçin)
- **USING expression:** `true`
- **"Save policy"** butonuna tıklayın

### 3.3. Policy 2: Admin Upload Access
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

---

## ADIM 4: KULLANICIYI ADMIN YAP (2 DAKİKA)

### 4.1. Email'inizi Kontrol Edin
- `TAMAMEN_CALISTIR_BUNU.sql` dosyasının **5. bölümünü** tekrar açın
- İlk sorguda email'inizi yazın ve çalıştırın
- Eğer `durum` kolonu **"✅ ZATEN ADMIN"** ise, bu adımı atlayın

### 4.2. Admin Yap
- Eğer admin değilseniz, aynı dosyanın **5. bölümündeki** UPDATE ve INSERT sorgularını çalıştırın
- Email'inizi yazdığınızdan emin olun
- Son kontrol sorgusunu çalıştırın
- **"✅ BAŞARILI"** mesajını görmelisiniz

---

## ADIM 5: WEB PANELİNİ YENİLE (30 SANİYE)

1. Tarayıcıda web panelini açın
2. **F5** tuşuna basın veya sayfayı yenileyin
3. **"/dashboard/campaigns"** sayfasına gidin
4. Artık kampanya ekleyebilmelisiniz!

---

## ✅ KONTROL LİSTESİ

- [ ] SQL migration çalıştırıldı (`TAMAMEN_CALISTIR_BUNU.sql`)
- [ ] Email değiştirildi ve admin yapıldı
- [ ] Storage bucket oluşturuldu (`campaigns`)
- [ ] Bucket public olarak ayarlandı (Public: true)
- [ ] Public read policy eklendi
- [ ] Admin upload policy eklendi
- [ ] Web paneli yenilendi (F5)

---

## 🆘 HALA ÇALIŞMIYORSA

### Hata: "Table not found"
- ✅ SQL migration'ı tekrar çalıştırın
- ✅ Supabase Dashboard -> Table Editor -> `announcements` tablosunun var olduğunu kontrol edin

### Hata: "Bucket not found"
- ✅ Storage bucket'ın oluşturulduğunu kontrol edin
- ✅ Bucket isminin tam olarak `campaigns` olduğundan emin olun

### Hata: "Yetkiniz yok"
- ✅ Email'inizi doğru yazdığınızdan emin olun
- ✅ Admin yapma sorgusunu tekrar çalıştırın
- ✅ Supabase Dashboard -> Table Editor -> `profiles` -> Kendi satırınızda `role = 'admin'` olduğunu kontrol edin

### Hata: "RLS policy"
- ✅ SQL migration'ı tekrar çalıştırın
- ✅ Supabase Dashboard -> Authentication -> Policies -> `announcements` tablosunda 4 policy olduğunu kontrol edin

---

## 📞 YARDIM

Tüm adımları yaptıysanız ve hala çalışmıyorsa:
1. Tarayıcı konsolunu açın (F12)
2. Hata mesajını kopyalayın
3. Supabase Dashboard -> Logs -> API Logs'tan detaylı hata mesajlarını kontrol edin

