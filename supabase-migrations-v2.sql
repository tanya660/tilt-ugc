-- ══════════════════════════════════════════════════════════════════════════════
-- TILT UGC v2 — Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. New columns on videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_id text DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS script text DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS cta text DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS delivery text DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS assigned_date date;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS invoiced boolean DEFAULT false;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS posted_date timestamptz;

-- 2. New columns on creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS rate_per_video numeric DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS bank_details text DEFAULT '';

-- 3. Creator bonuses table
CREATE TABLE IF NOT EXISTS creator_bonuses (
  id text PRIMARY KEY,
  creator_id text REFERENCES creators(id),
  week_start date NOT NULL,
  amount numeric DEFAULT 100,
  assigned_at timestamptz DEFAULT now()
);

ALTER TABLE creator_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage bonuses" ON creator_bonuses FOR ALL USING (true) WITH CHECK (true);
