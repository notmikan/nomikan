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

// 📱 スマホ用 画面スワイプによるサブタブ（班切り替え）ジェスチャー機能（1つ飛ばし防止 ＆ ヌルサクアニメーション版）
let globalSwipeLock = false;

// 🛡️ スワイプ直後に発生するブラウザの合成 click イベントの誤発火（他ボタンへの二重ジャンプ）をキャプチャフェーズで完全ブロック
document.addEventListener('click', (e) => {
  if (globalSwipeLock) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }
}, true);

function initTouchSwipeTabs() {
  function triggerContentAnimation(sectionId, direction) {
    let animTarget = null;
    if (sectionId === 'homeTab') animTarget = document.getElementById('postsTimelineGrid');
    else if (sectionId === 'timetableTab') animTarget = document.getElementById('ganttGrid');
    else if (sectionId === 'inventoryTab') animTarget = document.getElementById('inventoryGrid');

    if (!animTarget) return;

    const animClass = direction === 'left' ? 'swipe-anim-left' : 'swipe-anim-right';
    animTarget.classList.remove('swipe-anim-left', 'swipe-anim-right');
    // DOMリフロー強制
    void animTarget.offsetWidth;
    animTarget.classList.add(animClass);

    setTimeout(() => {
      animTarget.classList.remove(animClass);
    }, 280);
  }

  function bindSwipeToSection(sectionId, getTabList, getCurrentVal, applyTabChange) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isCandidate = false;
    let isScrollCanceled = false;

    section.addEventListener('touchstart', (e) => {
      if (globalSwipeLock) return;
      if (document.querySelector('.modal-overlay.active')) return;
      // ユーザーが明確にボタンや入力フォーム、モーダル、ガントチャートバーを直接タップ操作する時だけ除外
      if (e.target.closest('button, select, textarea, input:focus, .modal, .gantt-wrapper, .x-fab-post-btn')) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      isCandidate = true;
      isScrollCanceled = false;
    }, { passive: true });

    section.addEventListener('touchmove', (e) => {
      if (!isCandidate || isScrollCanceled || globalSwipeLock) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // 縦スクロールが明確に優先された場合のみキャンセル (閾値を25px以上に緩和)
      if (Math.abs(deltaY) > 25 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        isScrollCanceled = true;
      }
    }, { passive: true });

    section.addEventListener('touchend', (e) => {
      if (!isCandidate || isScrollCanceled || globalSwipeLock) return;
      isCandidate = false;

      const now = Date.now();
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const elapsedTime = now - touchStartTime;

      const velocityX = Math.abs(deltaX) / Math.max(1, elapsedTime);

      // スワイプ判定 (軽快かつスムーズに反応するよう緩和設定)
      if (elapsedTime <= 500 && Math.abs(deltaX) >= 30 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15 && velocityX >= 0.08) {
        const tabs = getTabList();
        const currentVal = getCurrentVal();
        const currentIndex = tabs.indexOf(currentVal);

        if (currentIndex === -1) return;

        let direction = '';
        let targetIndex = -1;

        if (deltaX < 0 && currentIndex < tabs.length - 1) {
          // ⬅️ 左スワイプ (次へ)
          direction = 'left';
          targetIndex = currentIndex + 1;
        } else if (deltaX > 0 && currentIndex > 0) {
          // ➡️ 右スワイプ (前へ)
          direction = 'right';
          targetIndex = currentIndex - 1;
        }

        if (targetIndex !== -1 && direction) {
          // 🔒 強力な排他ロックをかけて「1つ飛ばし」を100%防止
          globalSwipeLock = true;

          applyTabChange(tabs[targetIndex]);
          triggerContentAnimation(sectionId, direction);

          // アニメーション完了後にロック解除 (400ms)
          setTimeout(() => {
            globalSwipeLock = false;
          }, 400);
        }
      }
    }, { passive: true });
  }

  // 1. 💬 ホーム (SNS) タブのスワイプ切替
  bindSwipeToSection(
    'homeTab',
    () => ['all', '雑談', '運営', 'FRP', '翼', 'コクピ', '電装'],
    () => (typeof currentPostTeamFilter !== 'undefined' ? currentPostTeamFilter : 'all'),
    (newTeam) => {
      if (typeof currentPostTeamFilter !== 'undefined') {
        currentPostTeamFilter = newTeam;
        const btn = document.querySelector(`.x-tab-item[data-post-team="${newTeam}"]`);
        if (btn) {
          document.querySelectorAll('.x-tab-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
        if (typeof renderPostsTimeline === 'function') renderPostsTimeline();
      }
    }
  );

  // 2. 🗓️ タイムテーブル タブのスワイプ切替
  bindSwipeToSection(
    'timetableTab',
    () => ['all', '運営', 'FRP', '翼', 'コクピ', '電装'],
    () => (typeof currentTeamFilter !== 'undefined' ? currentTeamFilter : 'all'),
    (newTeam) => {
      if (typeof currentTeamFilter !== 'undefined') {
        currentTeamFilter = newTeam;
        const btn = document.querySelector(`.sub-toolbar .filter-btn[data-team="${newTeam}"]:not(.inventory-filter-btn)`);
        if (btn) {
          document.querySelectorAll('.sub-toolbar .filter-btn:not(.inventory-filter-btn)').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
        if (typeof render === 'function') render();
      }
    }
  );

  // 3. 📦 在庫 タブのスワイプ切替
  bindSwipeToSection(
    'inventoryTab',
    () => ['all', '運営', 'FRP', '翼', 'コクピ', '電装'],
    () => (typeof currentInventoryTeamFilter !== 'undefined' ? currentInventoryTeamFilter : 'all'),
    (newTeam) => {
      if (typeof currentInventoryTeamFilter !== 'undefined') {
        currentInventoryTeamFilter = newTeam;
        const btn = document.querySelector(`.inventory-filter-btn[data-team="${newTeam}"]`);
        if (btn) {
          document.querySelectorAll('.inventory-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
        if (typeof renderInventory === 'function') renderInventory();
      }
    }
  );
}

// アプリ全体の初期化実行
document.addEventListener('DOMContentLoaded', () => {
  initDatabase();
  initTouchSwipeTabs();
});

// 即時初期化フォールバック
initDatabase();
setTimeout(initTouchSwipeTabs, 300);
