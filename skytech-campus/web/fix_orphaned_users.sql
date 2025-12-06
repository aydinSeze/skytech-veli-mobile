-- Auth tablosunda olup Profiles tablosunda olmayan kullanıcıları bul ve ekle
insert into public.profiles (id, role)
select id, 'student' -- Varsayılan rol (daha sonra admin panelinden değiştirilebilir)
from auth.users
where id not in (select id from public.profiles);

-- İsteğe bağlı: Eğer belirli bir okul ID'si ile güncellemek isterseniz:
-- update public.profiles set school_id = 'OKUL_UUID' where school_id is null;
