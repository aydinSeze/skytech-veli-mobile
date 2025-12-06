-- Profiles tablosu için RLS Politikalarını Onar
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. Kullanıcı kendi profilini görebilir
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 2. Admin tüm profilleri görebilir
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" 
ON profiles FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 3. Profil oluşturma/güncelleme (Trigger ile yapılıyor ama yine de ekleyelim)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE
TO authenticated 
USING (auth.uid() = id);
