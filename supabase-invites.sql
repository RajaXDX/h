-- ============================================================================
-- دعوة صديق لروم — يُشغَّل مرة واحدة في Supabase → SQL Editor
-- ============================================================================
-- يُشغَّل بعد supabase-friends.sql و supabase-privacy.sql
-- ============================================================================


-- ============================= 1) جدول الدعوات =============================
CREATE TABLE IF NOT EXISTS room_invites (
  id         BIGSERIAL PRIMARY KEY,
  room_id    TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  room_code  TEXT NOT NULL,
  from_user  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_invite CHECK (from_user <> to_user),
  CONSTRAINT one_invite_per_room UNIQUE (room_id, to_user)
);

CREATE INDEX IF NOT EXISTS idx_invites_to ON room_invites (to_user, created_at DESC);

ALTER TABLE room_invites ENABLE ROW LEVEL SECURITY;


-- ============================= 2) السياسات =============================
-- كل طرف يرى دعواته فقط
DROP POLICY IF EXISTS "invites_read_own" ON room_invites;
CREATE POLICY "invites_read_own" ON room_invites
  FOR SELECT TO authenticated
  USING (auth.uid() = to_user OR auth.uid() = from_user);

-- الحذف: المدعوّ يرفض، والمرسِل يسحب
DROP POLICY IF EXISTS "invites_delete_own" ON room_invites;
CREATE POLICY "invites_delete_own" ON room_invites
  FOR DELETE TO authenticated
  USING (auth.uid() = to_user OR auth.uid() = from_user);

-- لا سياسة INSERT عمداً: الإدراج عبر الدالة وحدها، لأنها تتحقّق من الصداقة.
-- لو فتحناها لصار بإمكان أي أحد إغراق أي لاعب بالدعوات.


-- ============================= 3) إرسال الدعوة =============================
CREATE OR REPLACE FUNCTION invite_friend(target_id UUID, r_id TEXT, r_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF me = target_id THEN RAISE EXCEPTION 'لا يمكنك دعوة نفسك'; END IF;

  -- الأصدقاء فقط — هذا ما يمنع الدعوات المزعجة
  IF NOT are_friends(me, target_id) THEN
    RAISE EXCEPTION 'يمكنك دعوة أصدقائك فقط';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM game_rooms WHERE id = r_id) THEN
    RAISE EXCEPTION 'الروم غير موجودة';
  END IF;

  INSERT INTO room_invites (room_id, room_code, from_user, to_user)
  VALUES (r_id, r_code, me, target_id)
  ON CONFLICT (room_id, to_user) DO NOTHING;

  IF NOT FOUND THEN RETURN 'already_invited'; END IF;
  RETURN 'sent';
END;
$fn$;

REVOKE ALL ON FUNCTION invite_friend(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invite_friend(UUID, TEXT, TEXT) TO authenticated;


-- ============================= 4) دعواتي الواردة =============================
-- تُعيد اسم الداعي وكود الروم. profiles مغلق فلا يمكن ضمّه من المتصفح.
CREATE OR REPLACE FUNCTION my_invites()
RETURNS TABLE (
  invite_id  BIGINT,
  room_code  TEXT,
  from_name  TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $fn$
  SELECT i.id, i.room_code, p.username, i.created_at
  FROM room_invites i
  JOIN profiles p ON p.id = i.from_user
  JOIN game_rooms r ON r.id = i.room_id
  WHERE i.to_user = auth.uid()
    AND r.status <> 'completed'          -- لا نعرض دعوات لرومات انتهت
    AND i.created_at > now() - interval '3 hours'
  ORDER BY i.created_at DESC;
$fn$;

REVOKE ALL ON FUNCTION my_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION my_invites() TO authenticated;


-- ============================= 5) تفعيل البثّ اللحظي =============================
-- حتى تصل الدعوة فوراً بلا تحديث الصفحة
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_invites;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- للتحقق
-- ============================================================================
-- SELECT * FROM my_invites();
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'room_invites';
