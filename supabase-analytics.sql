-- ============================================================================
-- تحليلات بسيطة — يُشغَّل مرة واحدة في Supabase → SQL Editor
-- ============================================================================
--
-- الغرض: معرفة هل النشر ينجح فعلاً. بدون هذا لا يمكن معرفة أي قناة جلبت لاعبين
-- ولا كم جلسة تُلعب يومياً.
--
-- لا يُجمع أي شيء يخصّ هوية اللاعب: لا اسم ولا رسالة ولا معرّف جهاز.
-- فقط: نوع الحدث، ومن أين جاء الزائر، ونوع الجهاز.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,            -- visit | room_created | game_started | game_finished
  source TEXT,                    -- whatsapp | twitter | direct ... من referrer أو ?src=
  device TEXT,                    -- mobile | desktop
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_events_day ON app_events (created_at);
CREATE INDEX IF NOT EXISTS idx_app_events_event ON app_events (event);

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

-- الكتابة مفتوحة (اللاعبون يسجّلون أحداثهم بدون تسجيل دخول)،
-- والقراءة مقصورة على حساب الإدارة حتى لا يطّلع أحد على أرقامك.
DROP POLICY IF EXISTS "insert_events_public" ON app_events;
CREATE POLICY "insert_events_public" ON app_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "read_events_authenticated" ON app_events;
CREATE POLICY "read_events_authenticated" ON app_events
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- استعلامات جاهزة للوحة الإدارة أو للتشغيل هنا
-- ============================================================================

-- آخر 14 يوماً:
-- SELECT date_trunc('day', created_at)::date AS اليوم,
--        count(*) FILTER (WHERE event = 'visit')         AS زيارات,
--        count(*) FILTER (WHERE event = 'room_created')  AS رومات,
--        count(*) FILTER (WHERE event = 'game_started')  AS جولات
-- FROM app_events
-- WHERE created_at > now() - interval '14 days'
-- GROUP BY 1 ORDER BY 1 DESC;

-- من أين يأتي الزوّار:
-- SELECT source, count(*) FROM app_events
-- WHERE event = 'visit' AND created_at > now() - interval '30 days'
-- GROUP BY 1 ORDER BY 2 DESC;
