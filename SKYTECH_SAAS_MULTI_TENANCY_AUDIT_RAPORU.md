# SKYTECH CAMPUS - SAAS MULTI-TENANCY GÜVENLİK DENETİM RAPORU

## 📋 RAPOR ÖZETİ

**Tarih:** 01.12.2025  
**Proje:** SkyTech Campus Web - SaaS Okul Kantin Yönetim Sistemi  
**Denetim Türü:** Multi-Tenancy (Çoklu Kiracı) Güvenlik ve Veri İzolasyonu Kontrolü  
**Durum:** ⚠️ **KISMEN GÜVENLİ - EKSİKLİKLER MEVCUT**

---

## ✅ GÜVENLİ OLAN KISIMLAR

### 1. **Temel Veri İzolasyonu (School_ID Filtreleme)**

**Durum:** ✅ **ÇALIŞIYOR**

Tüm kritik tablolarda `school_id` foreign key ile bağlı ve sorgularda filtreleniyor:

- ✅ **Products:** `school_id` ile filtreleniyor
- ✅ **Students:** `school_id` ile filtreleniyor  
- ✅ **Transactions:** `school_id` ile filtreleniyor
- ✅ **Expenses:** `school_id` ile filtreleniyor
- ✅ **Suppliers:** `school_id` ile filtreleniyor
- ✅ **School Personnel:** `school_id` ile filtreleniyor
- ✅ **Canteens:** `school_id` ile filtreleniyor

**Kod Örnekleri:**
```typescript
// Tüm sorgularda school_id filtresi mevcut
.eq('school_id', profile.school_id)
.eq('school_id', userSchoolId)
```

### 2. **Row Level Security (RLS) Politikaları**

**Durum:** ✅ **KISMEN ÇALIŞIYOR**

Aşağıdaki tablolarda RLS aktif ve politikalar mevcut:

- ✅ **Products:** RLS aktif, okul bazlı politikalar var
- ✅ **Students:** RLS aktif, okul bazlı politikalar var
- ✅ **Transactions:** RLS aktif, okul bazlı politikalar var
- ✅ **Canteens:** RLS aktif, okul bazlı politikalar var
- ✅ **Admin Credit Logs:** RLS aktif, sadece admin erişimi
- ✅ **System Settings:** RLS aktif, sadece admin erişimi

**RLS Politikası Örneği:**
```sql
CREATE POLICY "Users can view their school's products"
ON public.products FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);
```

### 3. **Yeni Okul Oluşturma**

**Durum:** ✅ **GÜVENLİ**

Yeni okul oluşturulduğunda:
- ✅ `system_credit: 0` (Sıfırdan başlıyor)
- ✅ Öğrenci yok (school_id foreign key ile izole)
- ✅ Ürün yok (school_id foreign key ile izole)
- ✅ İşlem yok (school_id foreign key ile izole)
- ✅ Gider yok (school_id foreign key ile izole)

**Kod:**
```typescript
// Yeni okul oluşturma
.insert({
    name: formData.name,
    address: formData.address,
    system_credit: 0 // Varsayılan
})
```

### 4. **Kullanıcı Profil Yönetimi**

**Durum:** ✅ **ÇALIŞIYOR**

Her kullanıcı profilinde `school_id` saklanıyor:
- ✅ Profil oluşturulurken `school_id` atanıyor
- ✅ Tüm sorgularda `profile.school_id` kullanılıyor
- ✅ Kullanıcı sadece kendi okulunun verilerini görebiliyor

---

## ⚠️ KRİTİK EKSİKLİKLER VE GÜVENLİK AÇIKLARI

### 1. **EKSİK RLS POLİTİKALARI**

**Durum:** 🔴 **KRİTİK**

Aşağıdaki tablolarda RLS politikaları **EKSİK** veya **YETERSİZ**:

#### A. **Expenses Tablosu**
- ❌ RLS politikası yok veya eksik
- ⚠️ **Risk:** Bir okul diğer okulun giderlerini görebilir
- 📝 **Çözüm:** `db_rls_policies.sql` dosyasına expenses politikaları eklenmeli

#### B. **Suppliers Tablosu**
- ❌ RLS politikası yok veya eksik
- ⚠️ **Risk:** Bir okul diğer okulun tedarikçilerini görebilir
- 📝 **Çözüm:** `db_rls_policies.sql` dosyasına suppliers politikaları eklenmeli

#### C. **School Personnel Tablosu**
- ⚠️ RLS politikası var ama **"Enable read access for all users"** şeklinde (GÜVENSİZ!)
- 🔴 **Risk:** Tüm kullanıcılar tüm personelleri görebilir
- 📝 **Çözüm:** Okul bazlı RLS politikası eklenmeli

**Mevcut Güvensiz Politika:**
```sql
-- ❌ GÜVENSİZ - Tüm kullanıcılar tüm personelleri görebilir
CREATE POLICY "Enable read access for all users" 
ON school_personnel FOR SELECT USING (true);
```

**Olması Gereken:**
```sql
-- ✅ GÜVENLİ - Sadece kendi okulunun personelini görebilir
CREATE POLICY "Users can view their school's personnel"
ON school_personnel FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);
```

### 2. **ADMIN ERİŞİM KONTROLÜ**

**Durum:** ⚠️ **KISMEN ÇALIŞIYOR**

**Sorun:**
- Admin kullanıcılar RLS politikalarından etkileniyor
- Admin tüm okulları görmek için özel politika yok

**Çözüm:**
RLS politikalarına admin exception'ı eklenmeli:

```sql
-- Örnek: Admin için özel politika
CREATE POLICY "Admin can view all schools"
ON public.schools FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
  OR
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);
```

### 3. **SERVER ACTIONS GÜVENLİK KONTROLÜ**

**Durum:** ⚠️ **KONTROL EDİLMELİ**

Tüm server action'larda `school_id` kontrolü yapılıyor mu kontrol edilmeli:

- ✅ `pos-actions.ts` - `userSchoolId` kontrolü var
- ✅ `student-actions.ts` - `profile.school_id` kontrolü var
- ✅ `personnel-actions.ts` - `profile.school_id` kontrolü var
- ⚠️ `expenses` - Kontrol edilmeli
- ⚠️ `suppliers` - Kontrol edilmeli

---

## 📊 TABLO BAZLI GÜVENLİK DURUMU

| Tablo | School_ID Filtre | RLS Aktif | RLS Politikası | Durum |
|-------|------------------|-----------|----------------|-------|
| **schools** | ✅ | ✅ | ⚠️ Admin exception eksik | ⚠️ |
| **products** | ✅ | ✅ | ✅ | ✅ |
| **students** | ✅ | ✅ | ✅ | ✅ |
| **transactions** | ✅ | ✅ | ✅ | ✅ |
| **expenses** | ✅ | ❌ | ❌ | 🔴 |
| **suppliers** | ✅ | ❌ | ❌ | 🔴 |
| **school_personnel** | ✅ | ✅ | 🔴 Güvensiz politika | 🔴 |
| **canteens** | ✅ | ✅ | ✅ | ✅ |
| **admin_credit_logs** | ✅ | ✅ | ✅ Sadece admin | ✅ |
| **system_settings** | N/A | ✅ | ✅ Sadece admin | ✅ |

**Açıklama:**
- ✅ = Güvenli
- ⚠️ = Kısmen güvenli (iyileştirme gerekli)
- 🔴 = Güvensiz (acil düzeltme gerekli)

---

## 🔧 ÖNERİLEN DÜZELTMELER

### 1. **Eksik RLS Politikalarını Ekle**

**Dosya:** `skytech-campus/web/src/db/migrations/006_complete_rls_policies.sql`

```sql
-- 1. EXPENSES Tablosu RLS Politikaları
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their school's expenses"
ON expenses FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can insert expenses for their school"
ON expenses FOR INSERT
WITH CHECK (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Canteen staff can update their school's expenses"
ON expenses FOR UPDATE
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Canteen staff can delete their school's expenses"
ON expenses FOR DELETE
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

-- 2. SUPPLIERS Tablosu RLS Politikaları
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their school's suppliers"
ON suppliers FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can manage suppliers for their school"
ON suppliers FOR ALL
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

-- 3. SCHOOL_PERSONNEL Tablosu RLS Politikaları (DÜZELTME)
-- Önce mevcut güvensiz politikayı kaldır
DROP POLICY IF EXISTS "Enable read access for all users" ON school_personnel;
DROP POLICY IF EXISTS "Enable insert access for all users" ON school_personnel;
DROP POLICY IF EXISTS "Enable update access for all users" ON school_personnel;

-- Yeni güvenli politikalar
CREATE POLICY "Users can view their school's personnel"
ON school_personnel FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Canteen staff can manage personnel for their school"
ON school_personnel FOR ALL
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);
```

### 2. **Admin Exception'ları Ekle**

Tüm RLS politikalarına admin exception'ı eklenmeli:

```sql
-- Örnek: Products için admin exception
DROP POLICY IF EXISTS "Users can view their school's products" ON products;

CREATE POLICY "Users can view their school's products"
ON products FOR SELECT
USING (
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
```

### 3. **Server Actions Güvenlik Kontrolü**

Tüm server action'larda `school_id` kontrolü yapıldığından emin olun:

```typescript
// Örnek: Expenses için güvenlik kontrolü
const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, role')
    .eq('id', user.id)
    .single()

if (!profile?.school_id) {
    return { success: false, error: 'Okul bilgisi bulunamadı.' }
}

// Sadece kendi okulunun giderlerini ekleyebilir
await supabase.from('expenses').insert({
    ...formData,
    school_id: profile.school_id // ZORUNLU
})
```

---

## 🎯 SONUÇ VE ÖNERİLER

### ✅ **GÜVENLİ OLAN KISIMLAR:**
1. Temel veri izolasyonu (school_id filtreleme) çalışıyor
2. Products, Students, Transactions için RLS politikaları mevcut
3. Yeni okul oluşturma sıfırdan başlıyor
4. Kullanıcı profil yönetimi doğru çalışıyor

### 🔴 **ACİL DÜZELTİLMESİ GEREKENLER:**
1. **Expenses tablosu için RLS politikaları eklenmeli**
2. **Suppliers tablosu için RLS politikaları eklenmeli**
3. **School Personnel tablosu için güvensiz politikalar düzeltilmeli**
4. **Admin exception'ları tüm politikalarına eklenmeli**

### ⚠️ **İYİLEŞTİRİLMESİ GEREKENLER:**
1. Server action'larda ekstra güvenlik kontrolleri
2. Admin panelinde tüm okulları görme yetkisi
3. Audit log sistemi (hangi kullanıcı hangi veriyi görüntüledi)

---

## 📝 PROJE DÖKÜMANI

### **SkyTech Campus - SaaS Okul Kantin Yönetim Sistemi**

#### **Genel Bakış:**
SkyTech Campus, okullar için özel olarak tasarlanmış bir SaaS (Software as a Service) kantin yönetim sistemidir. Her okul kendi bağımsız panelini kullanır ve verileri tamamen izole edilmiştir.

#### **Mimari:**
- **Framework:** Next.js 14/15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Güvenlik:** Row Level Security (RLS)
- **Multi-Tenancy:** School_ID bazlı veri izolasyonu

#### **Ana Özellikler:**

1. **Yönetim Paneli (Admin):**
   - Okul yönetimi
   - Kredi yükleme/azaltma
   - Sistem ayarları (komisyon oranı)
   - Finansal raporlar
   - Tüm okulları görüntüleme

2. **Kantin Paneli (Canteen Staff):**
   - Dashboard (gelir, gider, kâr analizi)
   - Kasa / Satış (POS)
   - Ürün yönetimi
   - Öğrenci/Personel yönetimi
   - Gider takibi
   - Tedarikçi yönetimi
   - İşlem geçmişi
   - Ayarlar (PIN değiştirme)

3. **Veri İzolasyonu:**
   - Her okul sadece kendi verilerini görür
   - RLS politikaları ile veritabanı seviyesinde güvenlik
   - School_ID bazlı filtreleme

4. **Finansal Sistem:**
   - Sistem kredisi (her satıştan komisyon düşer)
   - Öğrenci/Personel bakiye yönetimi
   - Gider takibi
   - Karşılaştırmalı analiz (geçen ay vs bu ay)
   - Nakit akış raporu

5. **Özellikler:**
   - Excel ile toplu öğrenci yükleme
   - NFC kart sistemi
   - Stok yönetimi (negatif stok desteği)
   - WhatsApp entegrasyonu (sipariş gönderme)
   - PDF rapor oluşturma
   - Gerçek zamanlı güncellemeler (Supabase Realtime)

#### **Güvenlik:**
- Row Level Security (RLS) ile veritabanı seviyesinde izolasyon
- School_ID bazlı veri filtreleme
- Role-based access control (Admin, Canteen Staff)
- Session yönetimi (Supabase Auth)

#### **Teknik Detaylar:**
- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Next.js Server Actions
- **Database:** PostgreSQL (Supabase)
- **Real-time:** Supabase Realtime Subscriptions
- **File Storage:** Supabase Storage (gelecekte)

---

## 🚀 SONRAKİ ADIMLAR

1. ✅ Eksik RLS politikalarını ekle (Expenses, Suppliers, Personnel)
2. ✅ Admin exception'larını tüm politikalarına ekle
3. ✅ Server action güvenlik kontrollerini güçlendir
4. ⏳ Test senaryoları oluştur (farklı okullar arası veri erişimi)
5. ⏳ Audit log sistemi ekle
6. ⏳ Mobil entegrasyon hazırlığı

---

**Rapor Hazırlayan:** AI Assistant  
**Tarih:** 01.12.2025  
**Versiyon:** 1.0

