-- ═══════════════════════════════════════════════════════════════
-- Diamond Club — Миграция безопасности
-- Запустить в Supabase SQL Editor если база уже существует
-- ═══════════════════════════════════════════════════════════════

-- 1. Убрать небезопасную политику INSERT (anon мог вставлять с чужим wallet)
DROP POLICY IF EXISTS "Users create own orders" ON dc_orders;

-- 2. Новая политика: INSERT только через service_role (серверный API)
CREATE POLICY "Service role insert orders" ON dc_orders
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 3. Проверка что service_role full access уже есть
-- (если нет — создать)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dc_orders' AND policyname = 'Service role full access'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role full access" ON dc_orders FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- 4. Добавить CHECK constraints на dc_orders (защита от абсурдных значений)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'dc_orders_carats_check'
  ) THEN
    ALTER TABLE dc_orders ADD CONSTRAINT dc_orders_carats_check CHECK (carats >= 0.1 AND carats <= 50);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'dc_orders_price_check'
  ) THEN
    ALTER TABLE dc_orders ADD CONSTRAINT dc_orders_price_check CHECK (club_price >= 0 AND club_price <= 10000000);
  END IF;
END $$;

-- ═══ ГОТОВО ═══
-- После выполнения: проверь в Authentication > Policies
-- dc_orders должна иметь:
--   SELECT: "Users see own orders" (для пользователей)
--   INSERT: "Service role insert orders" (только service_role)
--   ALL:    "Service role full access" (только service_role)
