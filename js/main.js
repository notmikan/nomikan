/**
 * main.js - メイン初期化 ＆ タブ切り替えモジュール
 */

// タブ切り替え関数
window.switchTab = function(tabName) {
  document.querySelectorAll('.app-tabs .nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });

  const homeTab = document.getElementById('homeTab');
  const timetableTab = document.getElementById('timetableTab');
  const inventoryTab = document.getElementById('inventoryTab');
  const placeholderTab = document.getElementById('placeholderTab');

  if (homeTab) homeTab.classList.remove('active');
  if (timetableTab) timetableTab.classList.remove('active');
  if (inventoryTab) inventoryTab.classList.remove('active');
  if (placeholderTab) placeholderTab.classList.remove('active');

  // 📱 浮遊投稿ボタン (FAB) は「ホーム (SNS)」タブの時だけ右下に表示
  const fabBtn = document.getElementById('openComposeFabBtn');
  if (fabBtn) {
    if (tabName === 'home') {
      fabBtn.style.setProperty('display', 'flex', 'important');
    } else {
      fabBtn.style.setProperty('display', 'none', 'important');
    }
  }

  if (tabName === 'home') {
    if (homeTab) homeTab.classList.add('active');
  } else if (tabName === 'timetable') {
    if (timetableTab) timetableTab.classList.add('active');
  } else if (tabName === 'inventory') {
    if (inventoryTab) inventoryTab.classList.add('active');
  } else {
    if (placeholderTab) {
      placeholderTab.classList.add('active');
    }
  }
};

// タブボタンイベントリスナー設定 (PC上部タブ ＆ スマホボトムナビ)
document.querySelectorAll('.nav-tab, .mobile-bottom-nav .nav-item').forEach(tabBtn => {
  tabBtn.addEventListener('click', (e) => {
    const targetTab = e.currentTarget.dataset.tab;
    if (targetTab) {
      switchTab(targetTab);
    }
  });
});

// ⌨️ 全モーダル Esc キー一括閉じるハンドラー
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    // 1. 画像拡大ライトボックス
    const lightboxModal = document.getElementById('imageLightboxModal');
    if (lightboxModal && (lightboxModal.classList.contains('active') || lightboxModal.style.display === 'flex')) {
      lightboxModal.classList.remove('active');
      lightboxModal.style.display = 'none';
      return;
    }

    // 2. 新規投稿モーダル
    const composeModal = document.getElementById('xPostComposeModal');
    if (composeModal && (composeModal.classList.contains('active') || composeModal.style.display === 'flex')) {
      composeModal.classList.remove('active');
      composeModal.style.display = 'none';
      return;
    }

    // 3. タスク詳細モーダル
    const taskModal = document.getElementById('taskModal');
    if (taskModal && (taskModal.classList.contains('active') || taskModal.style.display === 'flex')) {
      if (typeof closeTaskModal === 'function') closeTaskModal();
      else {
        taskModal.classList.remove('active');
        taskModal.style.display = 'none';
      }
      return;
    }

    // 4. 在庫追加モーダル
    const inventoryModal = document.getElementById('inventoryModal');
    if (inventoryModal && (inventoryModal.classList.contains('active') || inventoryModal.style.display === 'flex')) {
      inventoryModal.classList.remove('active');
      inventoryModal.style.display = 'none';
      return;
    }

    // 5. DB設定モーダル
    const dbConfigModal = document.getElementById('dbConfigModal');
    if (dbConfigModal && (dbConfigModal.classList.contains('active') || dbConfigModal.style.display === 'flex')) {
      dbConfigModal.classList.remove('active');
      dbConfigModal.style.display = 'none';
      return;
    }

    // 6. プロフィール設定モーダル
    const userProfileModal = document.getElementById('userProfileModal');
    if (userProfileModal && (userProfileModal.classList.contains('active') || userProfileModal.style.display === 'flex')) {
      userProfileModal.classList.remove('active');
      userProfileModal.style.display = 'none';
      return;
    }

    // 7. AI ポップオーバー
    document.querySelectorAll('.ai-detail-popover').forEach(pop => {
      pop.style.display = 'none';
    });
  }
});

// アプリ全体の初期化実行
document.addEventListener('DOMContentLoaded', () => {
  initDatabase();
});

// 即時初期化フォールバック
initDatabase();
