-- ============================================================================
-- تأمين لوحة الإدارة — يُشغَّل مرة واحدة في Supabase → SQL Editor
-- ============================================================================
--
-- المشكلة التي يعالجها هذا الملف:
-- جدول game_settings (الفئات + النقاط + بنك الأسئلة) كانت الكتابة فيه مفتوحة
-- للجميع، ورمز لوحة الإدارة كان مكتوباً داخل ملفات JavaScript أي مقروءاً لأي
-- زائر. النتيجة: أي شخص يقدر يعدّل بيانات كل اللاعبين.
--
-- الحل: القراءة تبقى مفتوحة (اللعبة تحتاجها بدون تسجيل دخول)، والكتابة تُقصر
-- على المستخدمين المسجّلين فقط. الصلاحية تُفرض هنا في قاعدة البيانات، وليس في
-- المتصفح حيث يمكن تجاوزها.
--
-- ============================================================================
-- الخطوة 1: أنشئ حساب الإدارة أولاً
-- ============================================================================
-- من لوحة Supabase:  Authentication → Users → Add user
-- ضع بريداً وكلمة مرور قوية، وفعّل "Auto Confirm User".
-- هذا هو الحساب الذي ستدخل به للوحة الإدارة داخل اللعبة.
--
-- ============================================================================
-- الخطوة 2: شغّل ما تحت هذا السطر
-- ============================================================================

-- حذف السياسات المفتوحة القديمة على game_settings
DROP POLICY IF EXISTS "allow_public_write_game_settings" ON game_settings;
DROP POLICY IF EXISTS "allow_public_insert_game_settings" ON game_settings;
DROP POLICY IF EXISTS "allow_public_update_game_settings" ON game_settings;
DROP POLICY IF EXISTS "allow_public_delete_game_settings" ON game_settings;
DROP POLICY IF EXISTS "allow_public_read_game_settings" ON game_settings;

-- وحذف سياسات هذا الملف نفسه، حتى يمكن تشغيله أكثر من مرة بدون خطأ
-- (بدون هذه الأسطر يفشل التشغيل الثاني بـ: policy ... already exists)
DROP POLICY IF EXISTS "read_settings_public" ON game_settings;
DROP POLICY IF EXISTS "insert_settings_authenticated" ON game_settings;
DROP POLICY IF EXISTS "update_settings_authenticated" ON game_settings;
DROP POLICY IF EXISTS "delete_settings_authenticated" ON game_settings;

-- القراءة تبقى مفتوحة: اللاعبون يحتاجون الفئات وبنك الأسئلة بدون تسجيل دخول
CREATE POLICY "read_settings_public" ON game_settings
  FOR SELECT
  USING (true);

-- الكتابة للمسجّلين فقط
CREATE POLICY "insert_settings_authenticated" ON game_settings
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "update_settings_authenticated" ON game_settings
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_settings_authenticated" ON game_settings
  FOR DELETE TO authenticated
  USING (true);

-- ============================================================================
-- ملاحظة عن جداول الرومات
-- ============================================================================
-- جداول game_rooms و room_players و room_chat و room_game_state تبقى مفتوحة
-- للكتابة، لأن اللاعبين يكتبون فيها أثناء اللعب بدون تسجيل دخول. أثر أي عبث
-- فيها محدود بروم واحدة ومؤقت، بعكس game_settings الذي يمس كل اللاعبين.
-- تضييقها لاحقاً يحتاج ربط اللاعبين بجلسات مصادَق عليها.

-- ============================================================================
-- للتحقق بعد التشغيل
-- ============================================================================
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'game_settings';
--
-- المتوقع: سياسة SELECT للجميع، وثلاث سياسات للكتابة مقصورة على authenticated.
