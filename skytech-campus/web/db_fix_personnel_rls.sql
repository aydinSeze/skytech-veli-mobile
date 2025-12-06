-- 1. MEVCUT TÜM KISITLAMALARI KALDIR (Temiz Sayfa)
drop policy if exists "Kantinci personel gorebilir" on public.school_personnel;
drop policy if exists "Kantinci personel ekleyebilir" on public.school_personnel;
drop policy if exists "Kantinci personel duzenleyebilir" on public.school_personnel;
drop policy if exists "Kantinci personel silebilir" on public.school_personnel;

-- 2. "TEK KURAL HER ŞEYİ YÖNETİR" (Yüzüklerin Efendisi Modeli)
-- Okuma, Ekleme, Silme, Güncelleme... Hepsi için tek bir izin veriyoruz.
create policy "Kantinci Personel Tam Yetki"
on public.school_personnel
for all
using (
  school_id in (
    select school_id from public.profiles 
    where id = auth.uid()
  )
)
with check (
  school_id in (
    select school_id from public.profiles 
    where id = auth.uid()
  )
);
