# 🔧 دليل إعداد Supabase

هذا الدليل يشرح كيفية إعداد قاعدة البيانات السحابية لتطبيق مخمخ رجا.

## 📋 متطلبات

- حساب Supabase مجاني أو مدفوع
- متصفح حديث
- 10 دقائق من الوقت

## 🚀 خطوات الإعداد

### الخطوة 1: إنشاء حساب على Supabase

1. اذهب إلى **[supabase.com](https://supabase.com)**
2. اضغط **"Start your project"**
3. سجل دخول باستخدام:
   - GitHub
   - Google
   - أو بريد إلكتروني

### الخطوة 2: إنشاء مشروع جديد

1. اضغط **"New Project"**
2. ملء البيانات:
   - **Project Name**: `mokhamakh-raj`
   - **Database Password**: اختر كلمة مرور قوية واحفظها
   - **Region**: اختر المنطقة الأقرب (مثل Europe, US East, etc)
3. اضغط **"Create new project"**
4. انتظر 30-60 ثانية لإنشاء المشروع

### الخطوة 3: تنفيذ أوامر SQL

1. في لوحة Supabase، اذهب إلى **SQL Editor**
2. اضغط **"New Query"**
3. انسخ محتوى ملف `supabase-setup.sql` بالكامل
4. الصقه في محرر SQL
5. اضغط **"Run"** (أو اضغط Ctrl+Enter)
6. انتظر إلى أن تظهر رسالة نجاح ✅

### الخطوة 4: تفعيل Realtime

1. اذهب إلى **Database > Replication**
2. ابحث عن جداول:
   - `game_settings`
   - `game_sessions`
   - `game_rounds`
3. فعّل (Enable) Realtime لكل جدول بالضغط على الأيقونة
4. يجب أن تصبح خضراء (Enabled)

### الخطوة 5: الحصول على مفاتيح API

1. اذهب إلى **Project Settings** (الترس في أسفل اليسار)
2. اختر **API** من القائمة الجانبية
3. انسخ:
   - **Project URL** (سيبدو مثل: `https://xxxxx.supabase.co`)
   - **anon public key** (النص الطويل تحت "Project URL")

### الخطوة 6: تحديث الكود

1. افتح ملف `js/supabase-config.js`
2. ابحث عن هذا الجزء:
   ```javascript
   const SUPABASE_URL = "https://rqcltlleqpppeywxbkpo.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGci...";
   ```
3. استبدل القيم بما نسختها للتو:
   ```javascript
   const SUPABASE_URL = "YOUR_PROJECT_URL";
   const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
   ```

### الخطوة 7: اختبار الاتصال

1. افتح الموقع في المتصفح
2. لاحظ أيقونة المزامنة في الأعلى:
   - 📴 وضع محلي (لم يتصل بعد)
   - 🔄 جاري المزامنة (يتصل الآن)
   - ☁️ متزامن (تم الاتصال بنجاح)
3. اذهب إلى لوحة الإدارة (⚙️) برقم سري `2014`
4. ستظهر تبويب **"☁️ المزامنة"** مع معلومات الاتصال

## ✅ تحقق من الإعداد

### في Supabase Dashboard:

1. اذهب إلى **Table Editor**
2. يجب أن ترى جداول جديدة:
   - `game_settings`
   - `game_sessions`
   - `game_rounds`
   - `team_statistics`
   - `admin_logs`

3. اذهب إلى `game_settings` وتحقق من:
   - `categories` (فارغ - سيتم ملؤه)
   - `points` = `[100, 250, 400]`
   - `question_bank` (فارغ - سيتم ملؤه)

### في التطبيق:

1. أضف سؤال من لوحة الإدارة
2. اضغط "مزامنة الآن"
3. يجب أن ترى البيانات تظهر في Supabase Dashboard

## 🔐 أمان إضافي (اختياري)

### تقييد الوصول

إذا كنت تريد حماية لوحة الإدارة أكثر، يمكنك:

1. إضافة معرّف فريد في localStorage
2. استخدام JWT tokens
3. تقييد الوصول على أساس IP

لكن الإعداد الحالي آمن للاستخدام العام.

## 🐛 حل المشاكل

### "Supabase not connected"

**المشكلة**: لا يتصل التطبيق بـ Supabase

**الحل**:
- تحقق من أن SUPABASE_URL و SUPABASE_ANON_KEY صحيحة
- تحقق من اتصال الإنترنت
- افتح Console (F12) وابحث عن أخطاء
- جرب في متصفح مختلف

### "Realtime not working"

**المشكلة**: التحديثات لا تظهر فوراً على الأجهزة الأخرى

**الحل**:
- تحقق من أن Realtime مفعّل في Database > Replication
- أعد تحميل الصفحة
- جرب "مزامنة الآن" من لوحة الإدارة

### "Permission denied"

**المشكلة**: خطأ عند محاولة كتابة بيانات

**الحل**:
- تحقق من RLS policies
- تأكد من أن `allow_public_write` مفعّل
- اتصل بدعم Supabase

### "Database connection timeout"

**المشكلة**: التطبيق يتوقف عن الاستجابة

**الحل**:
- قد تكون حدود المشروع المجاني قد انتهت
- يمكنك ترقية الخطة
- أو انتظر يوماً جديداً (تُعاد الحدود يومياً)

## 📊 حدود المشروع المجاني

Supabase يوفر:
- ✅ 500 MB storage
- ✅ 2 million requests/month
- ✅ 10 GB bandwidth
- ✅ Realtime unlimited
- ✅ 50 Projects
- ✅ Database users: 2
- ✅ Function invocations: 500K/month

هذا كافٍ لـ 1000+ لاعب!

## 🎉 النتيجة

بعد الانتهاء من جميع الخطوات:

✅ قاعدة بيانات سحابية عاملة
✅ مزامنة فورية بين الأجهزة
✅ نسخ احتياطية تلقائية
✅ لا حاجة لخوادم خاصة
✅ أمان عالي

---

**الآن يمكنك:**
1. فتح التطبيق من أي جهاز
2. إضافة أسئلة من أي مكان
3. تتزامن البيانات تلقائياً
4. كل لاعب يرى التحديثات فوراً!

🚀 **تهانينا! قاعدة البيانات الخاصة بك جاهزة الآن!**
