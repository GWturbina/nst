-- ═══════════════════════════════════════════════════════════════
-- Diamond Club — Миграция Этап 3 (конфигуратор + витрина + турниры)
-- Запустить в Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Добавить quality_tier в dc_orders
ALTER TABLE dc_orders ADD COLUMN IF NOT EXISTS quality_tier TEXT DEFAULT 'standard';

-- 2. Таблица цен конфигуратора
CREATE TABLE IF NOT EXISTS dc_prices (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dc_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read prices" ON dc_prices
  FOR SELECT USING (true);
CREATE POLICY "Service manages prices" ON dc_prices
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Таблица витрины
CREATE TABLE IF NOT EXISTS dc_showcase (
  id BIGSERIAL PRIMARY KEY,
  type TEXT DEFAULT 'corporate',
  category TEXT DEFAULT 'diamond',
  seller_wallet TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  photos TEXT[] DEFAULT '{}',
  video_url TEXT,
  cert_url TEXT,
  retail_price NUMERIC(12,2) DEFAULT 0,
  club_price NUMERIC(12,2) DEFAULT 0,
  custom_price NUMERIC(12,2),
  carat NUMERIC(6,2),
  shape TEXT,
  clarity TEXT,
  color TEXT,
  gem_id TEXT,
  status TEXT DEFAULT 'active',
  buyer_wallet TEXT,
  delivery_address_encrypted TEXT,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dc_showcase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read showcase" ON dc_showcase
  FOR SELECT USING (true);
CREATE POLICY "Service manages showcase" ON dc_showcase
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_showcase_status ON dc_showcase(status);
CREATE INDEX IF NOT EXISTS idx_showcase_type ON dc_showcase(type);
CREATE INDEX IF NOT EXISTS idx_showcase_seller ON dc_showcase(seller_wallet);

-- 4. Таблица турниров
CREATE TABLE IF NOT EXISTS dc_tournaments (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  month TEXT NOT NULL,
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

-- 5. Supabase Storage bucket для фото/видео витрины
-- ВАЖНО: Это нужно сделать через Supabase Dashboard:
-- Storage > Create bucket > Имя: "showcase" > Public: ON
-- Или через API (не SQL)

-- ═══ ГОТОВО ═══
