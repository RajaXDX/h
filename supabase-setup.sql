-- ============================= MOKHAMAKH RAJ - SUPABASE SETUP ============================= --
-- لتطبيق هذه الأوامر:
-- 1. اذهب إلى Supabase Console
-- 2. اختر Project
-- 3. اذهب إلى SQL Editor
-- 4. انسخ والصق هذا الملف بالكامل
-- 5. اضغط "Run"

-- ============================= 1. GAME SETTINGS TABLE ============================= --
-- تخزين الإعدادات (الفئات، النقاط، بنك الأسئلة)

CREATE TABLE IF NOT EXISTS game_settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================= 2. GAME SESSIONS TABLE ============================= --
-- تسجيل الألعاب والجلسات

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  team_a_name TEXT NOT NULL,
  team_b_name TEXT NOT NULL,
  score_a INTEGER DEFAULT 0,
  score_b INTEGER DEFAULT 0,
  categories_used JSONB DEFAULT '[]',
  lifelinesUsed_a JSONB DEFAULT '[]',
  lifelinesUsed_b JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active', -- active, completed, paused
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================= 3. ROUNDS TABLE ============================= --
-- تسجيل الجولات

CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  categories_in_round JSONB NOT NULL DEFAULT '[]',
  questions_used JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================= 4. STATISTICS TABLE ============================= --
-- إحصائيات اللاعبين والفرق

CREATE TABLE IF NOT EXISTS team_statistics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  team_name TEXT NOT NULL,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  average_score DECIMAL(10, 2) DEFAULT 0,
  last_played TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================= 5. ADMIN LOG TABLE ============================= --
-- تسجيل أنشطة الإدارة

CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action TEXT NOT NULL, -- add_question, delete_question, update_points, etc
  target TEXT, -- category name, question id, etc
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================= INDEXES ============================= --
-- تحسين الأداء

CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON game_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_rounds_session ON game_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_wins ON team_statistics(wins DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- ============================= ROW LEVEL SECURITY ============================= --
-- تفعيل الأمان على مستوى الصفوف

-- تفعيل RLS على جميع الجداول
ALTER TABLE game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_game_state ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسات للوصول العام (القراءة والكتابة مفتوحة للجميع مؤقتاً)
-- ⚠️ نصيحة أمنية: يجب تحديد هذه السياسات لاحقاً بناءً على متطلبات الأمان

-- game_settings - السماح للجميع بالقراءة والكتابة
CREATE POLICY "allow_public_read_game_settings" ON game_settings
  FOR SELECT USING (true);

CREATE POLICY "allow_public_write_game_settings" ON game_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update_game_settings" ON game_settings
  FOR UPDATE USING (true);

-- game_sessions - السماح بالقراءة والإنشاء للجميع
CREATE POLICY "allow_public_read_sessions" ON game_sessions
  FOR SELECT USING (true);

CREATE POLICY "allow_public_insert_sessions" ON game_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update_sessions" ON game_sessions
  FOR UPDATE USING (true);

-- game_rounds
CREATE POLICY "allow_public_read_rounds" ON game_rounds
  FOR SELECT USING (true);

CREATE POLICY "allow_public_insert_rounds" ON game_rounds
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update_rounds" ON game_rounds
  FOR UPDATE USING (true);

-- team_statistics
CREATE POLICY "allow_public_read_stats" ON team_statistics
  FOR SELECT USING (true);

CREATE POLICY "allow_public_insert_stats" ON team_statistics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update_stats" ON team_statistics
  FOR UPDATE USING (true);

-- admin_logs
CREATE POLICY "allow_public_read_logs" ON admin_logs
  FOR SELECT USING (true);

CREATE POLICY "allow_public_insert_logs" ON admin_logs
  FOR INSERT WITH CHECK (true);

-- game_rooms - السماح بالقراءة والكتابة للجميع
CREATE POLICY "allow_public_read_rooms" ON game_rooms
  FOR SELECT USING (true);

CREATE POLICY "allow_public_insert_rooms" ON game_rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update_rooms" ON game_rooms
  FOR UPDATE USING (true);

-- room_players - السماح بالقراءة والكتابة للجميع
CREATE POLICY "allow_public_read_players" ON room_players
  FOR SELECT USING (true);

CREATE POLICY "allow_public_insert_players" ON room_players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update_players" ON room_players
  FOR UPDATE USING (true);

-- room_chat - السماح بالقراءة والكتابة للجميع
CREATE POLICY "allow_public_read_chat" ON room_chat
  FOR SELECT USING (true);

CREATE POLICY "allow_public_insert_chat" ON room_chat
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update_chat" ON room_chat
  FOR UPDATE USING (true);

-- room_game_state - السماح بالقراءة والكتابة للجميع
CREATE POLICY "allow_public_read_state" ON room_game_state
  FOR SELECT USING (true);

CREATE POLICY "allow_public_insert_state" ON room_game_state
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_update_state" ON room_game_state
  FOR UPDATE USING (true);

-- سياسات الحذف — كانت ناقصة، فكان أي DELETE من التطبيق يفشل بصمت
-- (بدون رسالة خطأ وبدون حذف أي صف). شغّل هذا الجزء لتفعيل الحذف النهائي للرومات.
CREATE POLICY "allow_public_delete_rooms" ON game_rooms
  FOR DELETE USING (true);

CREATE POLICY "allow_public_delete_players" ON room_players
  FOR DELETE USING (true);

CREATE POLICY "allow_public_delete_chat" ON room_chat
  FOR DELETE USING (true);

CREATE POLICY "allow_public_delete_state" ON room_game_state
  FOR DELETE USING (true);

-- ============================= 6. GAME ROOMS TABLE ============================= --
-- غرف اللعب متعددة اللاعبين

CREATE TABLE IF NOT EXISTS game_rooms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT NOT NULL UNIQUE, -- رمز قصير (4-6 أحرف) للدخول
  name TEXT NOT NULL,
  mode TEXT DEFAULT 'online', -- online, local
  status TEXT DEFAULT 'waiting', -- waiting, active, completed, archived
  host_player_id TEXT NOT NULL,
  categories_selected JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms(code);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_rooms_created ON game_rooms(created_at DESC);

-- ============================= 7. ROOM PLAYERS TABLE ============================= --
-- اللاعبون في كل غرفة

CREATE TABLE IF NOT EXISTS room_players (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL, -- معرف فريد محلي للاعب
  player_name TEXT NOT NULL,
  device_id TEXT,
  team TEXT, -- A أو B - يتم تعيينه من قبل Host
  score INTEGER DEFAULT 0,
  is_host BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active', -- active, inactive, left
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_player ON room_players(player_id);
CREATE INDEX IF NOT EXISTS idx_room_players_team ON room_players(room_id, team);

-- ============================= 8. ROOM CHAT TABLE ============================= --
-- رسائل الشات في الرومات

CREATE TABLE IF NOT EXISTS room_chat (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  message TEXT NOT NULL,
  reactions JSONB DEFAULT '{}', -- {"😂": ["player_id1", "player_id2"], ...}
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_chat_room ON room_chat(room_id);
CREATE INDEX IF NOT EXISTS idx_room_chat_created ON room_chat(created_at DESC);

-- ============================= 9. ROOM GAME STATE TABLE ============================= --
-- حالة اللعبة الحالية في كل روم

CREATE TABLE IF NOT EXISTS room_game_state (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  room_id TEXT NOT NULL UNIQUE REFERENCES game_rooms(id) ON DELETE CASCADE,
  current_round INTEGER DEFAULT 0,
  current_question_cell TEXT, -- format: "cat-index-difficulty-row"
  scores JSONB NOT NULL DEFAULT '{"A": 0, "B": 0}', -- {A: score, B: score}
  questions_used JSONB DEFAULT '[]', -- قائمة الأسئلة المستخدمة
  state_data JSONB DEFAULT '{}', -- بيانات إضافية حسب الحاجة
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_room_game_state_room ON room_game_state(room_id);

-- ============================= REALTIME SUBSCRIPTIONS ============================= --
-- تفعيل Realtime للجداول الرئيسية

ALTER PUBLICATION supabase_realtime ADD TABLE game_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE game_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE room_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE room_game_state;

-- ============================= SEED DATA ============================= --
-- إدراج بيانات أولية

-- حفظ الإعدادات الأولية
INSERT INTO game_settings (id, data) VALUES
  ('categories', '[]'::jsonb),
  ('points', '[100, 250, 400]'::jsonb),
  ('question_bank', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================= FUNCTIONS ============================= --
-- دوال مساعدة

-- دالة لحساب إحصائيات الفريق
CREATE OR REPLACE FUNCTION update_team_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث إحصائيات الفريق الفائز
  IF NEW.status = 'completed' THEN
    IF NEW.score_a > NEW.score_b THEN
      INSERT INTO team_statistics (team_name, total_games, wins, total_points, last_played, updated_at)
      VALUES (NEW.team_a_name, 1, 1, NEW.score_a, NEW.ended_at, now())
      ON CONFLICT (team_name) DO UPDATE SET
        total_games = team_statistics.total_games + 1,
        wins = team_statistics.wins + 1,
        total_points = team_statistics.total_points + NEW.score_a,
        last_played = NEW.ended_at,
        updated_at = now();
    ELSIF NEW.score_b > NEW.score_a THEN
      INSERT INTO team_statistics (team_name, total_games, wins, total_points, last_played, updated_at)
      VALUES (NEW.team_b_name, 1, 1, NEW.score_b, NEW.ended_at, now())
      ON CONFLICT (team_name) DO UPDATE SET
        total_games = team_statistics.total_games + 1,
        wins = team_statistics.wins + 1,
        total_points = team_statistics.total_points + NEW.score_b,
        last_played = NEW.ended_at,
        updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بجدول game_sessions
DROP TRIGGER IF EXISTS on_game_completed ON game_sessions;
CREATE TRIGGER on_game_completed
  AFTER UPDATE ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_team_statistics();

-- ============================= COMMENTS ============================= --
-- توثيق الجداول

COMMENT ON TABLE game_settings IS 'تخزين الإعدادات الرئيسية: الفئات، النقاط، بنك الأسئلة';
COMMENT ON TABLE game_sessions IS 'تسجيل جلسات اللعب الكاملة (محلية)';
COMMENT ON TABLE game_rounds IS 'تفاصيل كل جولة في اللعبة';
COMMENT ON TABLE team_statistics IS 'إحصائيات الفرق على مدار الوقت';
COMMENT ON TABLE admin_logs IS 'سجل أنشطة الإدارة للتدقيق والأمان';
COMMENT ON TABLE game_rooms IS 'غرف اللعب متعددة اللاعبين - مود أونلاين';
COMMENT ON TABLE room_players IS 'اللاعبون في كل غرفة لعب';
COMMENT ON TABLE room_chat IS 'رسائل الشات في الرومات مع دعم التفاعلات';
COMMENT ON TABLE room_game_state IS 'حالة اللعبة الحية - تُحدّث فوراً عبر Realtime';

-- ============================= COMPLETION ============================= --
-- انتهى الإعداد!
-- الآن:
-- 1. تأكد من تفعيل Realtime في Dashboard > Replication
-- 2. انسخ الـ URL و API Key من Project Settings
-- 3. ضعهم في supabase-config.js
-- 4. اختبر الاتصال بفتح الموقع
