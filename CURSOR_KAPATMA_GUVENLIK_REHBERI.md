# 🔒 CURSOR KAPATMA GÜVENLİK REHBERİ

## ✅ CURSOR'U GÜVENLE KAPATMAK İÇİN YAPILACAKLAR

### 1. TÜM DOSYALARI KAYDET (EN ÖNEMLİ!)

**Kısayol:** `Ctrl + K, S` (Tüm dosyaları kaydet)

Veya:
- `File` → `Save All` (Tümünü Kaydet)
- Veya her dosyayı tek tek `Ctrl + S` ile kaydedin

### 2. GIT COMMIT YAP (ÇOK ÖNEMLİ!)

Terminal'de şu komutları çalıştır:

```bash
cd C:\Users\aydin\Desktop\SkyTech
git add .
git commit -m "Kampanya sistemi ve güncellemeler"
git push
```

**Neden önemli?** Git commit yapmazsanız, dosyalar sadece bilgisayarınızda kalır. Git'e commit yaparsanız, Cursor kapansa bile tüm değişiklikleriniz güvende olur!

### 3. ÖNEMLİ DOSYALARI KONTROL ET

Aşağıdaki dosyaların var olduğundan emin ol:

#### SQL Dosyaları (Veritabanı):
- ✅ `skytech-campus/web/TAMAMEN_CALISTIR_BUNU.sql`
- ✅ `skytech-campus/web/ADMIN_YAP_AYDIN.sql`
- ✅ `skytech-campus/web/CREATE_CAMPAIGN_SYSTEM.sql`

#### Mobil Uygulama Dosyaları:
- ✅ `skytech-mobile/app/(tabs)/index.tsx`
- ✅ `skytech-mobile/app/(tabs)/profile.tsx`
- ✅ `skytech-mobile/app/menu.tsx`
- ✅ `skytech-mobile/app/login.tsx`

#### Web Panel Dosyaları:
- ✅ `skytech-campus/web/src/app/dashboard/campaigns/page.tsx`
- ✅ `skytech-campus/web/src/app/dashboard/layout.tsx`

### 4. CURSOR'U KAPATMADAN ÖNCE KONTROL LİSTESİ

- [ ] Tüm dosyalar kaydedildi (`Ctrl + K, S`)
- [ ] Git commit yapıldı (`git commit`)
- [ ] Git push yapıldı (`git push`) - Eğer remote repository varsa
- [ ] Önemli dosyaların var olduğu kontrol edildi
- [ ] Terminal'de hata yok

### 5. CURSOR'U AÇTIĞINDA KONTROL ET

Cursor'u tekrar açtığınızda:

1. **Dosyaların var olduğunu kontrol edin:**
   - Sol panelde dosyalar görünüyor mu?
   - Özellikle `campaigns/page.tsx` dosyası var mı?

2. **Git durumunu kontrol edin:**
   ```bash
   git status
   ```
   - Eğer "nothing to commit" görüyorsanız, her şey kaydedilmiş demektir ✅

3. **Son commit'i kontrol edin:**
   ```bash
   git log --oneline -5
   ```
   - Son commit'iniz görünüyor mu?

### 6. EĞER DOSYALAR KAYBOLURSA

**Panik yapmayın!** Git kullanıyorsanız:

```bash
# Son commit'e geri dön
git reset --hard HEAD

# Veya belirli bir commit'e dön
git log  # Commit ID'lerini gör
git checkout [COMMIT_ID]
```

### 7. OTOMATIK KAYDETME AYARLARI

Cursor'da otomatik kaydetme açık mı kontrol edin:

1. `File` → `Preferences` → `Settings`
2. "Auto Save" araması yapın
3. "Files: Auto Save" → `afterDelay` veya `onFocusChange` seçin

### 8. GÜNLÜK YEDEKLEME ÖNERİSİ

Her gün sonunda:

1. Tüm dosyaları kaydet (`Ctrl + K, S`)
2. Git commit yap
3. Eğer GitHub/GitLab kullanıyorsanız, push yap
4. Önemli SQL dosyalarını ayrı bir klasöre kopyala (yedek)

---

## 🚨 ACİL DURUM: DOSYALAR KAYBOLDU

Eğer Cursor'u açtığınızda dosyalar yoksa:

1. **Git'ten geri al:**
   ```bash
   git status
   git checkout .
   ```

2. **Local History kontrol et:**
   - Cursor'da sağ tık → "Local History" → "Show History"
   - Eski versiyonları görebilirsiniz

3. **Workspace'i kontrol et:**
   - `File` → `Open Folder`
   - `C:\Users\aydin\Desktop\SkyTech` klasörünü açın

---

## ✅ ŞİMDİ GÜVENLE KAPATABİLİRSİNİZ!

Yukarıdaki adımları yaptıysanız, Cursor'u güvenle kapatabilirsiniz. Tüm değişiklikleriniz güvende! 🎉

