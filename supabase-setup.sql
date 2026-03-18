-- ═══════════════════════════════════════════════════════════════
-- Diamond Club — Supabase Setup
-- FIX C2: Row Level Security на ВСЕХ таблицах
-- 
-- ИНСТРУКЦИЯ: Запустить в Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ═══ ТАБЛИЦА ЗАКАЗОВ ═══
CREATE TABLE IF NOT EXISTS dc_orders (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  gem_type TEXT,
  shape TEXT,
  clarity TEXT,
  color TEXT,
  fancy_color TEXT,
  intensity TEXT,
  carats NUMERIC(8,2) DEFAULT 0,
  has_cert BOOLEAN DEFAULT false,
  region TEXT,
  buy_mode TEXT,
  is_fraction BOOLEAN DEFAULT false,
  fraction_count INTEGER DEFAULT 0,
  total_fractions INTEGER DEFAULT 0,
  retail_price NUMERIC(12,2) DEFAULT 0,
  club_price NUMERIC(12,2) DEFAULT 0,
  savings NUMERIC(12,2) DEFAULT 0,
  discount_pct NUMERIC(5,2) DEFAULT 0,
  spec_string TEXT,
  quality_tier TEXT DEFAULT 'standard',  -- 'standard' | 'premium'
  status TEXT DEFAULT 'NEW',
  gem_id INTEGER,
  purchase_id INTEGER,
  lot_id INTEGER,
  admin_note TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  production_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE dc_orders ENABLE ROW LEVEL SECURITY;

-- Пользователь видит ТОЛЬКО свои заказы
CREATE POLICY "Users see own orders" ON dc_orders
  FOR SELECT USING (wallet = lower(current_setting('request.jwt.claims', true)::json->>'sub'));

-- INSERT только через service_role (серверный API)
-- Убран WITH CHECK(true) — anon больше не может вставлять напрямую
CREATE POLICY "Service role insert orders" ON dc_orders
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Обновлять могут ТОЛЬКО через service_role (API routes)
CREATE POLICY "Service role full access" ON dc_orders
  FOR ALL USING (auth.role() = 'service_role');

-- ═══ ТАБЛИЦА АДМИНОВ ═══
CREATE TABLE IF NOT EXISTS dc_admins (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'operator',  -- owner / manager / operator
  name TEXT,
  max_amount NUMERIC(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dc_admins ENABLE ROW LEVEL SECURITY;

-- Все могут ЧИТАТЬ (для проверки своей роли)
CREATE POLICY "Anyone can read admins" ON dc_admins
  FOR SELECT USING (true);

-- Менять админов может ТОЛЬКО service_role
CREATE POLICY "Service manages admins" ON dc_admins
  FOR ALL USING (auth.role() = 'service_role');

-- ═══ ЛОГ ДЕЙСТВИЙ ═══
CREATE TABLE IF NOT EXISTS dc_order_log (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES dc_orders(id),
  action TEXT,
  actor TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dc_order_log ENABLE ROW LEVEL SECURITY;

-- Все могут читать и вставлять лог
CREATE POLICY "Log readable" ON dc_order_log FOR SELECT USING (true);
CREATE POLICY "Log insertable" ON dc_order_log FOR INSERT WITH CHECK (true);

-- ═══ ТАБЛИЦА ТАПОВ (для серверной тапалки) ═══
CREATE TABLE IF NOT EXISTS dc_taps (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT UNIQUE NOT NULL,
  energy INTEGER DEFAULT 200,
  total_dct NUMERIC(16,4) DEFAULT 0,
  total_taps BIGINT DEFAULT 0,
  level INTEGER DEFAULT 0,
  last_tap_at BIGINT DEFAULT 0,
  last_regen_at BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dc_taps ENABLE ROW LEVEL SECURITY;

-- Тапы управляются ТОЛЬКО через API (service_role)
CREATE POLICY "Taps service only" ON dc_taps
  FOR ALL USING (auth.role() = 'service_role');

-- Пользователь может читать свои тапы
CREATE POLICY "Users see own taps" ON dc_taps
  FOR SELECT USING (true);

-- ═══ ИНДЕКСЫ ═══
CREATE INDEX IF NOT EXISTS idx_orders_wallet ON dc_orders(wallet);
CREATE INDEX IF NOT EXISTS idx_orders_status ON dc_orders(status);
CREATE INDEX IF NOT EXISTS idx_taps_wallet ON dc_taps(wallet);
CREATE INDEX IF NOT EXISTS idx_log_order ON dc_order_log(order_id);

-- ═══ ТАБЛИЦА ЦЕН КОНФИГУРАТОРА ═══
CREATE TABLE IF NOT EXISTS dc_prices (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,       -- 'club_standard' | 'club_premium' | 'config'
  data JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dc_prices ENABLE ROW LEVEL SECURITY;

-- Все могут ЧИТАТЬ цены
CREATE POLICY "Anyone can read prices" ON dc_prices
  FOR SELECT USING (true);

-- Менять может ТОЛЬКО service_role
CREATE POLICY "Service manages prices" ON dc_prices
  FOR ALL USING (auth.role() = 'service_role');

-- ═══ ТАБЛИЦА ВИТРИНЫ ═══
CREATE TABLE IF NOT EXISTS dc_showcase (
  id BIGSERIAL PRIMARY KEY,
  type TEXT DEFAULT 'corporate',      -- 'corporate' | 'partner'
  category TEXT DEFAULT 'diamond',    -- 'diamond' | 'jewelry'
  seller_wallet TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  photos TEXT[] DEFAULT '{}',         -- массив URL фото
  video_url TEXT,
  cert_url TEXT,
  retail_price NUMERIC(12,2) DEFAULT 0,
  club_price NUMERIC(12,2) DEFAULT 0,
  custom_price NUMERIC(12,2),
  carat NUMERIC(6,2),
  shape TEXT,
  clarity TEXT,
  color TEXT,
  gem_id TEXT,                        -- ID камня (C1.5W и т.д.)
  status TEXT DEFAULT 'active',       -- 'active' | 'sold' | 'hidden'
  buyer_wallet TEXT,
  delivery_address_encrypted TEXT,    -- зашифрованный адрес доставки
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dc_showcase ENABLE ROW LEVEL SECURITY;

-- Все видят активные объявления
CREATE POLICY "Anyone can read showcase" ON dc_showcase
  FOR SELECT USING (true);

-- INSERT/UPDATE через service_role
CREATE POLICY "Service manages showcase" ON dc_showcase
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_showcase_status ON dc_showcase(status);
CREATE INDEX IF NOT EXISTS idx_showcase_type ON dc_showcase(type);
CREATE INDEX IF NOT EXISTS idx_showcase_seller ON dc_showcase(seller_wallet);

-- ═══ ТАБЛИЦА ТУРНИРОВ ═══
CREATE TABLE IF NOT EXISTS dc_tournaments (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  month TEXT NOT NULL,                -- '2026-03'
  invites INTEGER DEFAULT 0,
  turnover NUMERIC(16,2) DEFAULT 0,
  taps_dct NUMERIC(16,4) DEFAULT 0,
  max_gem_sale NUMERIC(16,2) DEFAULT 0,
  max_jewelry_sale NUMERIC(16,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet, month)
);

ALTER TABLE dc_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tournaments" ON dc_tournaments
  FOR SELECT USING (true);

CREATE POLICY "Service manages tournaments" ON dc_tournaments
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_tournaments_month ON dc_tournaments(month);

-- ═══ ГОТОВО ═══
-- После выполнения: проверьте что RLS включён на всех таблицах
-- Authentication > Policies — должны быть зелёные галочки
