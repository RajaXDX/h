/* ============================= CLOUD SYNC FUNCTIONS ============================= */

let syncSubscription = null;

// دالة المزامنة الرئيسية
async function pushToCloud() {
  if (!supa) {
    log('Supabase not connected', 'warning');
    return false;
  }

  try {
    setSyncStatus('syncing');

    // تصدير الفئات
    const { error: catError } = await supa
      .from('game_settings')
      .upsert(
        {
          id: 'categories',
          data: CATEGORIES,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    if (catError) throw catError;

    // تصدير النقاط
    const { error: pointsError } = await supa
      .from('game_settings')
      .upsert(
        {
          id: 'points',
          data: POINTS,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    if (pointsError) throw pointsError;

    // تصدير بنك الأسئلة
    const { error: bankError } = await supa
      .from('game_settings')
      .upsert(
        {
          id: 'question_bank',
          data: QBANK,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    if (bankError) throw bankError;

    setSyncStatus('synced');
    log('Data synced to cloud successfully', 'success');
    return true;
  } catch (error) {
    console.error('Cloud sync failed:', error);
    setSyncStatus('error');
    log('Cloud sync failed: ' + error.message, 'error');
    return false;
  }
}

// سحب البيانات من السحابة عند البداية
async function pullFromCloudOnce() {
  if (!supa) {
    log('Supabase not connected', 'warning');
    return;
  }

  try {
    setSyncStatus('syncing');

    // جلب الفئات
    const { data: catData, error: catError } = await supa
      .from('game_settings')
      .select('data')
      .eq('id', 'categories')
      .single();

    if (!catError && catData?.data) {
      CATEGORIES = catData.data;
      saveJSON('mr_categories', CATEGORIES);
    }

    // جلب النقاط
    const { data: pointsData, error: pointsError } = await supa
      .from('game_settings')
      .select('data')
      .eq('id', 'points')
      .single();

    if (!pointsError && pointsData?.data) {
      POINTS = pointsData.data;
      saveJSON('mr_points', POINTS);
    }

    // جلب بنك الأسئلة
    const { data: bankData, error: bankError } = await supa
      .from('game_settings')
      .select('data')
      .eq('id', 'question_bank')
      .single();

    if (!bankError && bankData?.data) {
      QBANK = bankData.data;
      saveJSON('mr_bank', QBANK);
    }

    setSyncStatus('synced');
    log('Data pulled from cloud successfully', 'success');
  } catch (error) {
    console.error('Cloud pull failed:', error);
    setSyncStatus('error');
    log('Cloud pull failed: ' + error.message, 'error');
  }
}

// الاستماع للتغييرات في الوقت الفعلي
function listenToCloudChanges() {
  if (!supa) return;

  // الاستماع لتغييرات game_settings
  syncSubscription = supa
    .channel('game_settings_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_settings' },
      (payload) => {
        if (payload.new) {
          const { id, data } = payload.new;

          switch (id) {
            case 'categories':
              CATEGORIES = data;
              saveJSON('mr_categories', CATEGORIES);
              if (document.querySelector('#screen-categories.active')) {
                renderCatGrid();
              }
              break;

            case 'points':
              POINTS = data;
              saveJSON('mr_points', POINTS);
              if (document.querySelector('#screen-game.active')) {
                renderBoard();
              }
              break;

            case 'question_bank':
              QBANK = data;
              saveJSON('mr_bank', QBANK);
              updateTotalStats();
              break;
          }

          setSyncStatus('synced');
          log('Cloud data updated', 'success');
        }
      }
    )
    .subscribe();

  log('Listening to cloud changes', 'success');
}

// إيقاف الاستماع
function stopListeningToCloud() {
  if (syncSubscription) {
    supa?.removeChannel(syncSubscription);
    syncSubscription = null;
  }
}

// تهيئة المزامنة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  if (supa) {
    // جلب البيانات الأولية
    await pullFromCloudOnce();

    // بدء الاستماع للتغييرات
    listenToCloudChanges();
  }

  updateTotalStats();
});

// إيقاف الاستماع عند غلق الصفحة
window.addEventListener('beforeunload', () => {
  stopListeningToCloud();
});
