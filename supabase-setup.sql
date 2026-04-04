-- ══════════════════════════════════════════════════════════════════════════════
-- TILT UGC — Run this in Supabase SQL Editor (one-time setup)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Add auth_email column to creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS auth_email text DEFAULT '';

-- 2. Set auth_email for your existing creators
-- UPDATE these with the actual Google email addresses your creators use to sign in:
-- UPDATE creators SET auth_email = 'kofi@gmail.com' WHERE name = 'Kofi';
-- UPDATE creators SET auth_email = 'neya@gmail.com' WHERE name = 'Neya';
-- UPDATE creators SET auth_email = 'yzzy@gmail.com' WHERE name = 'Yzzy';

-- 3. Create brief_ideas table
CREATE TABLE IF NOT EXISTS brief_ideas (
  id text PRIMARY KEY,
  creator_id text REFERENCES creators(id),
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- 4. Enable RLS on brief_ideas
ALTER TABLE brief_ideas ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for brief_ideas
-- Admin (via service role or matching email) can do everything
-- Creators can read/write their own ideas
CREATE POLICY "Anyone can read brief_ideas" ON brief_ideas FOR SELECT USING (true);
CREATE POLICY "Anyone can insert brief_ideas" ON brief_ideas FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update brief_ideas" ON brief_ideas FOR UPDATE USING (true) WITH CHECK (true);

-- 6. RLS policies for creators (if not already set)
-- Note: If you already have RLS enabled on creators, you may need to adjust these
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read creators" ON creators FOR SELECT USING (true);
CREATE POLICY "Anyone can update creators" ON creators FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can insert creators" ON creators FOR INSERT WITH CHECK (true);

-- 7. RLS policies for videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read videos" ON videos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert videos" ON videos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update videos" ON videos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete videos" ON videos FOR DELETE USING (true);

-- 8. RLS policies for briefs
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read briefs" ON briefs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert briefs" ON briefs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update briefs" ON briefs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete briefs" ON briefs FOR DELETE USING (true);

-- 9. RLS policies for tips
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tips" ON tips FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tips" ON tips FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete tips" ON tips FOR DELETE USING (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTES:
-- These policies use permissive "true" checks because the app-level auth
-- (admin email check + creator auth_email matching) handles access control.
-- The anon key + RLS ensures the tables are accessible but the React app
-- gates what each user type can see and do.
--
-- If you want stricter DB-level RLS (recommended for production), you can
-- replace the "true" checks with auth.uid() checks after setting up
-- Supabase auth properly. For now this works with the anon key.
-- ══════════════════════════════════════════════════════════════════════════════
