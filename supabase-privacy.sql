-- ============================================================================
-- خصوصية الملف الشخصي + عرض إحصاءات اللاعبين
-- يُشغَّل مرة واحدة في Supabase → SQL Editor (بعد supabase-friends.sql)
-- ============================================================================
--
-- المشكلة التي يعالجها:
-- سياسة profiles الحالية "USING (true)" تجعل كل صف مقروءاً للجميع — أي أن
-- إحصاءات أي لاعب مكشوفة لأي شخص يستعلم مباشرة. إخفاؤها في الواجهة لا يكفي.
--
-- لكن لا يمكن حجب الصف كله: اسم المستخدم يجب أن يبقى قابلاً للبحث حتى تعمل
-- إضافة الأصدقاء. و RLS تعمل على مستوى الصف لا العمود.
--
-- الحل: نغلق الجدول، ونفتح الوصول عبر دوال تُعيد ما يُسمح به فقط.
-- ============================================================================


-- ============================= 1) إعداد الخصوصية =============================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy TEXT NOT NULL DEFAULT 'public';

DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT valid_privacy
    CHECK (privacy IN ('public', 'friends', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- public  = إحصاءاتي للجميع
-- friends = لأصدقائي فقط
-- private = لي وحدي


-- ============================= 2) إغلاق القراءة المباشرة =============================
-- بعد هذا لا أحد يقرأ صفوف الآخرين مباشرة — الوصول عبر الدوال أدناه.
DROP POLICY IF EXISTS "profiles_read_public" ON profiles;
DROP POLICY IF EXISTS "profiles_read_self_or_admin" ON profiles;
CREATE POLICY "profiles_read_self_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());


-- ============================= 3) هل بيننا صداقة؟ =============================
CREATE OR REPLACE FUNCTION are_friends(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND ((requester_id = a AND addressee_id = b)
        OR (requester_id = b AND addressee_id = a))
  );
$$;


-- ============================= 4) البحث عن لاعب بالاسم =============================
-- تُعيد المعرّف والاسم فقط — لا إحصاءات. لازمة لإضافة الأصدقاء.
CREATE OR REPLACE FUNCTION find_player(target_username TEXT)
RETURNS TABLE (id UUID, username TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.username FROM profiles p
  WHERE p.username = lower(trim(target_username))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION find_player(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_player(TEXT) TO authenticated;


-- ============================= 5) بطاقة اللاعب =============================
-- تُعيد الاسم دائماً، والإحصاءات حسب إعداد صاحبها.
-- visible تخبر الواجهة هل تعرض الأرقام أم رسالة «الحساب خاص».
CREATE OR REPLACE FUNCTION get_player_card(target_username TEXT)
RETURNS TABLE (
  username      TEXT,
  privacy       TEXT,
  visible       BOOLEAN,
  is_friend     BOOLEAN,
  is_me         BOOLEAN,
  games_played  INTEGER,
  games_won     INTEGER,
  total_score   BIGINT,
  rooms_created INTEGER,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  me  UUID := auth.uid();
  p   profiles%ROWTYPE;
  ok  BOOLEAN;
  fr  BOOLEAN;
BEGIN
  SELECT * INTO p FROM profiles
  WHERE profiles.username = lower(trim(target_username));

  IF NOT FOUND THEN RETURN; END IF;

  fr := are_friends(me, p.id);
  ok := (p.id = me)                       -- ملفي أنا
     OR is_admin()                        -- الإدارة ترى كل شيء
     OR (p.privacy = 'public')
     OR (p.privacy = 'friends' AND fr);

  RETURN QUERY SELECT
    p.username,
    p.privacy,
    ok,
    fr,
    (p.id = me),
    CASE WHEN ok THEN p.games_played  ELSE NULL END,
    CASE WHEN ok THEN p.games_won     ELSE NULL END,
    CASE WHEN ok THEN p.total_score   ELSE NULL END,
    CASE WHEN ok THEN p.rooms_created ELSE NULL END,
    CASE WHEN ok THEN p.created_at    ELSE NULL END;
END;
$$;

REVOKE ALL ON FUNCTION get_player_card(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_player_card(TEXT) TO authenticated;


-- ============================= 6) قائمة أصدقائي =============================
-- بعد إغلاق الجدول لم يعد بالإمكان ضمّ profiles من المتصفح، فنُعيدها هنا.
CREATE OR REPLACE FUNCTION list_my_friends()
RETURNS TABLE (
  row_id       BIGINT,
  other_id     UUID,
  username     TEXT,
  status       TEXT,
  direction    TEXT,      -- incoming | outgoing | friend
  privacy      TEXT,
  games_played INTEGER,
  games_won    INTEGER,
  total_score  BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    f.id,
    CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END,
    p.username,
    f.status,
    CASE
      WHEN f.status = 'accepted' THEN 'friend'
      WHEN f.addressee_id = auth.uid() THEN 'incoming'
      ELSE 'outgoing'
    END,
    p.privacy,
    -- إحصاءات الصديق تظهر إن كان حسابه عاماً أو للأصدقاء
    CASE WHEN f.status = 'accepted' AND p.privacy <> 'private' THEN p.games_played END,
    CASE WHEN f.status = 'accepted' AND p.privacy <> 'private' THEN p.games_won END,
    CASE WHEN f.status = 'accepted' AND p.privacy <> 'private' THEN p.total_score END
  FROM friendships f
  JOIN profiles p ON p.id = CASE WHEN f.requester_id = auth.uid()
                                 THEN f.addressee_id ELSE f.requester_id END
  WHERE f.requester_id = auth.uid() OR f.addressee_id = auth.uid()
  ORDER BY f.created_at DESC;
$$;

REVOKE ALL ON FUNCTION list_my_friends() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_my_friends() TO authenticated;


-- ============================= 7) لوحة الصدارة =============================
-- الحسابات العامة فقط — من اختار الخصوصية لا يظهر فيها.
CREATE OR REPLACE FUNCTION leaderboard(limit_n INTEGER DEFAULT 20)
RETURNS TABLE (
  username     TEXT,
  games_played INTEGER,
  games_won    INTEGER,
  total_score  BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.username, p.games_played, p.games_won, p.total_score
  FROM profiles p
  WHERE p.privacy = 'public' AND p.games_played > 0
  ORDER BY p.total_score DESC, p.games_won DESC
  LIMIT LEAST(GREATEST(limit_n, 1), 100);
$$;

REVOKE ALL ON FUNCTION leaderboard(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leaderboard(INTEGER) TO authenticated;


-- ============================================================================
-- للتحقق بعد التشغيل
-- ============================================================================
-- SELECT privacy, count(*) FROM profiles GROUP BY privacy;   -- الكل public افتراضياً
-- SELECT * FROM get_player_card('vip');
-- SELECT * FROM leaderboard(10);
