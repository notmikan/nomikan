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

  // 浮遊投稿ボタン (FAB) はホームタブの時だけ表示
  const fabBtn = document.getElementById('openComposeFabBtn');
  if (fabBtn) {
    fabBtn.style.display = (tabName === 'home') ? 'flex' : 'none';
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

// アプリ全体の初期化実行
document.addEventListener('DOMContentLoaded', () => {
  initDatabase();
});

// 即時初期化フォールバック
initDatabase();
