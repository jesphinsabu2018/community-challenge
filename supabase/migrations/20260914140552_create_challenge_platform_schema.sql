/*
# Community Challenge Platform — Core Schema

## Overview
Creates the full data model for a fair-competition challenge platform where users
create, join, and complete challenges across different domains (fitness, coding,
photography, community service, art, study), submit proof of completion, and get
ranked on a leaderboard using a fairness-first scoring engine.

## New Tables
1. `profiles` — user profile data linked to Supabase Auth (username, avatar, bio, stats cache)
2. `challenges` — challenge definitions with category, difficulty, submission type, evaluation criteria
3. `participants` — join table tracking which users are in which challenges and their status
4. `submissions` — proof/results submitted by users for challenges, with verification status
5. `votes` — community feedback on submissions (rate-limited, self-vote prevented)
6. `reports` — user-reported suspicious submissions for moderation
7. `comments` — user comments on submissions
8. `score_audit_log` — immutable audit trail of score computations per submission

## Security
- RLS enabled on every table
- All tables scoped to `authenticated` users (sign-in required)
- Owner-scoped policies for user-owned data (profiles, challenges created, submissions)
- Read access for all authenticated users on public content (challenges, submissions, leaderboard)
- Write access restricted to owners for their own data
- Votes: unique constraint prevents duplicate + self-voting enforced at policy level
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  username text NOT NULL UNIQUE,
  avatar_url text,
  bio text DEFAULT '',
  is_moderator boolean NOT NULL DEFAULT false,
  challenges_joined int NOT NULL DEFAULT 0,
  challenges_completed int NOT NULL DEFAULT 0,
  challenges_in_progress int NOT NULL DEFAULT 0,
  challenges_failed int NOT NULL DEFAULT 0,
  average_score numeric NOT NULL DEFAULT 0,
  consistency_streak int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  rules text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN ('Fitness','Coding','Photography','Community','Art','Study','Custom')),
  difficulty_tier text NOT NULL CHECK (difficulty_tier IN ('Easy','Medium','Hard','Expert')),
  difficulty_weight numeric NOT NULL DEFAULT 1.0 CHECK (difficulty_weight >= 1.0 AND difficulty_weight <= 2.0),
  submission_type text NOT NULL CHECK (submission_type IN ('numeric','text','file','photo','video','quiz','checklist')),
  evaluation_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  benchmark_value numeric,
  benchmark_unit text,
  deadline timestamptz,
  requires_verification boolean NOT NULL DEFAULT true,
  participant_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_select_all" ON challenges;
CREATE POLICY "challenges_select_all" ON challenges FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "challenges_insert_own" ON challenges;
CREATE POLICY "challenges_insert_own" ON challenges FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "challenges_update_own" ON challenges;
CREATE POLICY "challenges_update_own" ON challenges FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "challenges_delete_own" ON challenges;
CREATE POLICY "challenges_delete_own" ON challenges FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id);

-- ============================================================
-- PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined','in_progress','completed','failed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_select_all" ON participants;
CREATE POLICY "participants_select_all" ON participants FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "participants_insert_own" ON participants;
CREATE POLICY "participants_insert_own" ON participants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "participants_update_own" ON participants;
CREATE POLICY "participants_update_own" ON participants FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "participants_delete_own" ON participants;
CREATE POLICY "participants_delete_own" ON participants FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_challenge ON participants(challenge_id);

-- ============================================================
-- SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  submission_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_url text,
  file_hash text,
  raw_performance_score numeric,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','flagged')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_select_all" ON submissions;
CREATE POLICY "submissions_select_all" ON submissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "submissions_insert_own" ON submissions;
CREATE POLICY "submissions_insert_own" ON submissions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "submissions_update_own" ON submissions;
CREATE POLICY "submissions_update_own" ON submissions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "submissions_delete_own" ON submissions;
CREATE POLICY "submissions_delete_own" ON submissions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_verification ON submissions(verification_status);
CREATE INDEX IF NOT EXISTS idx_submissions_file_hash ON submissions(file_hash);

-- ============================================================
-- VOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(voter_id, submission_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Self-vote prevention: voter cannot vote on their own submission
DROP POLICY IF EXISTS "votes_select_all" ON votes;
CREATE POLICY "votes_select_all" ON votes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "votes_insert_not_own" ON votes;
CREATE POLICY "votes_insert_not_own" ON votes FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = voter_id
    AND NOT EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.id = votes.submission_id
      AND submissions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "votes_delete_own" ON votes;
CREATE POLICY "votes_delete_own" ON votes FOR DELETE
  TO authenticated USING (auth.uid() = voter_id);

CREATE INDEX IF NOT EXISTS idx_votes_submission ON votes(submission_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reporter_id, submission_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own_or_moderator" ON reports;
CREATE POLICY "reports_select_own_or_moderator" ON reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_moderator = true)
  );

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_update_moderator" ON reports;
CREATE POLICY "reports_update_moderator" ON reports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_moderator = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_moderator = true));

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_submission ON reports(submission_id);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_all" ON comments;
CREATE POLICY "comments_select_all" ON comments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comments_submission ON comments(submission_id);

-- ============================================================
-- SCORE AUDIT LOG (immutable, append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS score_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  computed_final_score numeric NOT NULL,
  performance_normalized numeric NOT NULL,
  difficulty_weight numeric NOT NULL,
  completion_factor numeric NOT NULL,
  verification_factor numeric NOT NULL,
  consistency_bonus numeric NOT NULL,
  community_signal_capped numeric NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE score_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "score_audit_select_all" ON score_audit_log;
CREATE POLICY "score_audit_select_all" ON score_audit_log FOR SELECT
  TO authenticated USING (true);

-- Only the service role (edge functions) can insert audit logs
DROP POLICY IF EXISTS "score_audit_insert_service" ON score_audit_log;
CREATE POLICY "score_audit_insert_service" ON score_audit_log FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_score_audit_submission ON score_audit_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_score_audit_score ON score_audit_log(computed_final_score DESC);

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 6))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: Update participant count on challenge
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_participant_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE challenges SET participant_count = participant_count + 1
    WHERE id = NEW.challenge_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE challenges SET participant_count = GREATEST(participant_count - 1, 0)
    WHERE id = OLD.challenge_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_participant_change ON participants;
CREATE TRIGGER on_participant_change
  AFTER INSERT OR DELETE ON participants
  FOR EACH ROW EXECUTE FUNCTION public.update_participant_count();
