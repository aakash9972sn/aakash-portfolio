-- Portable PostgreSQL 14+ schema (Neon, Supabase, Cloud SQL, self-hosted).
-- Apply with: npm run db:migrate. All user-owned rows must be server-authenticated.
BEGIN;
CREATE TABLE IF NOT EXISTS public_leaderboard (
  game TEXT NOT NULL CHECK (game IN ('perfect-guess')),
  user_id TEXT NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  best_score INTEGER NOT NULL CHECK (best_score > 0 AND best_score <= 100000),
  source VARCHAR(30) NOT NULL DEFAULT 'client-reported',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game, user_id)
);
CREATE INDEX IF NOT EXISTS public_leaderboard_rank ON public_leaderboard (game, best_score ASC, updated_at ASC);
CREATE TABLE IF NOT EXISTS test_analytics (
  user_id TEXT NOT NULL,
  attempt_id VARCHAR(128) NOT NULL,
  exam VARCHAR(60) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  test_id VARCHAR(128) NOT NULL,
  score NUMERIC(10,2) NOT NULL,
  possible_score NUMERIC(10,2) NOT NULL,
  correct INTEGER NOT NULL DEFAULT 0 CHECK (correct >= 0),
  wrong INTEGER NOT NULL DEFAULT 0 CHECK (wrong >= 0),
  skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped >= 0),
  topic_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, attempt_id)
);
CREATE INDEX IF NOT EXISTS test_analytics_exam_date ON test_analytics(exam, attempted_at DESC);
CREATE TABLE IF NOT EXISTS blunder_orders (
  order_id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('received','confirmed','packed','dispatched','delivered','cancelled')),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  total_paise INTEGER NOT NULL CHECK(total_paise >= 0),
  items JSONB NOT NULL,
  shipping_address JSONB NOT NULL,
  payment_status VARCHAR(30) NOT NULL CHECK (payment_status IN ('cod-pending','paid','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blunder_orders_owner ON blunder_orders(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS conversation_transcripts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind VARCHAR(12) NOT NULL CHECK(kind IN ('audio','chat')),
  content TEXT NOT NULL CHECK(length(content) <= 32000),
  language VARCHAR(20),
  consent BOOLEAN NOT NULL DEFAULT true CHECK(consent = true),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_transcripts_owner ON conversation_transcripts(user_id, created_at DESC);
COMMIT;
