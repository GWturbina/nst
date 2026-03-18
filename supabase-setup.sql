## Настройка Supabase Storage для фото/видео витрины

### Шаг 1: Создать bucket
1. Откройте Supabase Dashboard → Storage
2. Нажмите "New bucket"
3. Имя: `showcase`
4. Public bucket: **ВКЛ** (ON)
5. File size limit: `10MB`
6. Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif, video/mp4, video/webm`

### Шаг 2: Настроить политику доступа
В Storage → Policies → `showcase` bucket:

**Upload (INSERT):**
```sql
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'showcase');
```

**Read (SELECT):**
```sql
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'showcase');
```

### Шаг 3: Добавить в Vercel Environment Variables
```
NEXT_PUBLIC_SITE_URL=https://ваш-домен.vercel.app
```

### Готово!
Файлы загружаются в: `showcase/{wallet_address}/{timestamp}.{ext}`
URL: `https://ВАШ_ПРОЕКТ.supabase.co/storage/v1/object/public/showcase/...`
