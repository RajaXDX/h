-- ============================================================================
-- الأصدقاء — يُشغَّل مرة واحدة في Supabase → SQL Editor
-- ============================================================================
--
-- علاقة الصداقة صفّ واحد بين طرفين، لا صفّان. حالتها:
--   pending  = طلب أُرسل ولم يُقبل بعد
--   accepted = صداقة قائمة
--
-- الحذف يزيل الصف نهائياً (سواء رفض طلب أو إزالة صديق).
-- ============================================================================

CREATE TABLE IF NOT EXISTS friendships (
  id            BIGSERIAL PRIMARY KEY,
  requester_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT now(),
  responded_at  TIMESTAMPTZ,

  CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted')),
  CONSTRAINT unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- كل طرف يرى علاقاته هو فقط — لا أحد يتصفّح صداقات الآخرين
DROP POLICY IF EXISTS "friendships_read_own" ON friendships;
CREATE POLICY "friendships_read_own" ON friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- الطلب يُرسل باسمك أنت فقط — لا يمكن انتحال مرسِل
DROP POLICY IF EXISTS "friendships_insert_own" ON friendships;
CREATE POLICY "friendships_insert_own" ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- القبول حقّ المُرسَل إليه وحده — المُرسِل لا يقبل طلبه بنفسه
DROP POLICY IF EXISTS "friendships_accept" ON friendships;
CREATE POLICY "friendships_accept" ON friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id AND status = 'accepted');

-- الحذف حقّ الطرفين: رفض طلب، أو إزالة صديق، أو سحب طلب أرسلته
DROP POLICY IF EXISTS "friendships_delete_own" ON friendships;
CREATE POLICY "friendships_delete_own" ON friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);


-- ============================================================================
-- منع طلب معكوس مكرر
-- ============================================================================
-- unique_pair يمنع (أ→ب) مرتين، لكنه لا يمنع (ب→أ) بينما (أ→ب) قائم.
-- هذه الدالة تُستدعى من التطبيق وتتولّى الحالتين: لو كان الطرف الآخر أرسل
-- لك طلباً من قبل، يُقبل مباشرة بدل إنشاء طلب معاكس.
CREATE OR REPLACE FUNCTION request_friend(target_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  existing friendships%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF me = target_id THEN RAISE EXCEPTION 'لا يمكنك إضافة نفسك'; END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_id) THEN
    RAISE EXCEPTION 'الحساب غير موجود';
  END IF;

  SELECT * INTO existing FROM friendships
  WHERE (requester_id = me AND addressee_id = target_id)
     OR (requester_id = target_id AND addressee_id = me)
  LIMIT 1;

  IF FOUND THEN
    IF existing.status = 'accepted' THEN
      RETURN 'already_friends';
    ELSIF existing.requester_id = me THEN
      RETURN 'already_sent';
    ELSE
      -- هو أرسل لك أولاً → القبول بدل طلب معاكس
      UPDATE friendships SET status = 'accepted', responded_at = now()
      WHERE id = existing.id;
      RETURN 'accepted';
    END IF;
  END IF;

  INSERT INTO friendships (requester_id, addressee_id) VALUES (me, target_id);
  RETURN 'sent';
END;
$$;

REVOKE ALL ON FUNCTION request_friend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_friend(UUID) TO authenticated;


-- ============================================================================
-- للتحقق بعد التشغيل
-- ============================================================================
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'friendships';
--   المتوقع: أربع سياسات (SELECT / INSERT / UPDATE / DELETE)
