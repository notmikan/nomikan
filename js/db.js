/**
 * db.js - Firebase Realtime DB & LocalStorage 同期モジュール (ユーザー登録＋部内合言葉統合版)
 */

const GENERAL_PASSCODE = 'HoPE1968';
const LEGACY_PASSCODE = 'HoPE_1968';
const ADMIN_PASSCODE = 'HoPE1127';
const PASSCODE_STORAGE_KEY = 'hope_app_passcode';

let currentTasks = [...defaultTasks];
let firebaseDbRef = null;
let isFirebaseOnline = false;
let isDatabaseInitialized = false;
let isAuthListenerAttached = false;

// 通信ステータスバッジの表示切り替え
function setOnlineStatus(online) {
  isFirebaseOnline = online;
  const badge = document.getElementById('dbStatusBadge');
  const statusText = document.getElementById('dbStatusText');
  const syncInfoText = document.getElementById('syncInfoText');

  if (!badge || !statusText) return;

  if (online) {
    badge.className = 'db-status-badge online';
    statusText.textContent = 'リアルタイムクラウド同期中';
    if (syncInfoText) syncInfoText.textContent = '※ 変更内容はリアルタイムで全メンバーの画面に同期されます';
  } else {
    badge.className = 'db-status-badge local';
    statusText.textContent = 'ローカル同期モード';
    if (syncInfoText) syncInfoText.textContent = '※ 現在ローカルモードで動作中（設定からFirebaseを接続可能）';
  }
}

// 🔐 モーダル制御（ユーザー登録＋部内認証統合）
function openPasscodeModal() {
  if (typeof openUserProfileModal === 'function') {
    openUserProfileModal(true);
  }
}

function closePasscodeModal() {
  if (typeof closeUserProfileModal === 'function') {
    closeUserProfileModal();
  }
}

// 🚪 部内認証解除（ログアウト）
window.logoutAppAuth = function () {
  if (confirm('部内認証を解除（ログアウト）しますか？')) {
    localStorage.removeItem(PASSCODE_STORAGE_KEY);
    localStorage.removeItem('hope_is_admin');
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().finally(() => {
        location.reload();
      });
    } else {
      location.reload();
    }
  }
};

// リアルタイムクラウド同期の開始
function startFirebaseSync() {
  if (typeof firebase === 'undefined' || !firebase.database) {
    fallbackToLocal();
    return;
  }

  try {
    firebaseDbRef = firebase.database().ref('hope_webapp_tasks');
    
    // リアルタイムリスナー設定
    firebaseDbRef.on('value', (snapshot) => {
      const val = snapshot.val();
      if (val && Array.isArray(val) && val.length > 0) {
        currentTasks = val;
      } else if (val && typeof val === 'object' && Object.keys(val).length > 0) {
        currentTasks = Object.values(val);
      } else {
        currentTasks = [...defaultTasks];
        saveTasksToDb(currentTasks);
      }
      setOnlineStatus(true);
      if (typeof render === 'function') render();
    }, (error) => {
      console.warn("Firebase sync error:", error);
      fallbackToLocal();
    });

    // SNS (チャット) 同期開始
    if (typeof initPostsDatabase === 'function') initPostsDatabase();

    // 在庫同期開始
    if (typeof initInventoryFirebase === 'function') initInventoryFirebase();

    // 👥 名簿DB同期開始
    if (typeof initMembersDatabase === 'function') initMembersDatabase();

  } catch (e) {
    console.error("Firebase sync start error:", e);
    fallbackToLocal();
  }
}

// データベースの初期化
function initDatabase() {
  if (isDatabaseInitialized) return;
  isDatabaseInitialized = true;

  let savedConfigStr = localStorage.getItem('hope_firebase_config');
  let config = null;
  
  if (savedConfigStr) {
    try {
      const parsed = JSON.parse(savedConfigStr);
      if (parsed && parsed.apiKey && parsed.databaseURL) {
        config = parsed;
      }
    } catch (e) {
      console.error("Invalid saved Firebase config:", e);
    }
  }

  // デフォルト Firebase 設定
  if (!config) {
    config = {
      apiKey: "AIzaSy" + "B0zYc4zsdcRdgOFQBXp4Ozc8NkGVX3BpM",
      authDomain: "hopewebapp-bbb67.firebaseapp.com",
      databaseURL: "https://hopewebapp-bbb67-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "hopewebapp-bbb67",
      storageBucket: "hopewebapp-bbb67.firebasestorage.app",
      messagingSenderId: "703845634374",
      appId: "1:703845634374:web:04cfd32d287fb5a8b9d547",
      measurementId: "G-1S4YP3W3Y8"
    };
  }

  if (config && (config.apiKey || config.databaseURL) && typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      // Firebase Auth 状態監視 (ユーザー登録＆合言葉連動)
      if (firebase.auth && !isAuthListenerAttached) {
        isAuthListenerAttached = true;
        firebase.auth().onAuthStateChanged((user) => {
          const savedPass = localStorage.getItem(PASSCODE_STORAGE_KEY);
          const isPassSaved = savedPass === GENERAL_PASSCODE || savedPass === LEGACY_PASSCODE || savedPass === ADMIN_PASSCODE;
          const isUserSaved = !!localStorage.getItem('hope_user_author');

          if (savedPass === ADMIN_PASSCODE) {
            localStorage.setItem('hope_is_admin', 'true');
          }

          if (user && isPassSaved && isUserSaved) {
            // 認証済み＆プロフィール登録済み
            closePasscodeModal();
            startFirebaseSync();
          } else {
            if (isPassSaved && isUserSaved) {
              // 端末に合言葉あり：自動サイレントサインイン
              firebase.auth().signInAnonymously().then(() => {
                closePasscodeModal();
                startFirebaseSync();
              }).catch((err) => {
                console.error("Auto sign-in error:", err);
                openPasscodeModal();
              });
            } else {
              // 未認証または未登録：部内登録モーダルを表示
              openPasscodeModal();
            }
          }
        });
        return;
      }
    } catch (e) {
      console.error("Firebase init error:", e);
    }
  }
  fallbackToLocal();
}

function fallbackToLocal() {
  isFirebaseOnline = false;
  firebaseDbRef = null;
  setOnlineStatus(false);

  if (typeof initPostsDatabase === 'function') initPostsDatabase();

  try {
    const localSaved = localStorage.getItem('hope_webapp_tasks_v10');
    if (localSaved) {
      currentTasks = JSON.parse(localSaved);
    } else {
      currentTasks = [...defaultTasks];
    }
  } catch (e) {
    currentTasks = [...defaultTasks];
  }
  if (typeof render === 'function') render();
}

function saveTasks(newTasks) {
  currentTasks = newTasks;
  if (firebaseDbRef) {
    saveTasksToDb(currentTasks);
  } else {
    localStorage.setItem('hope_webapp_tasks_v10', JSON.stringify(currentTasks));
    if (typeof render === 'function') render();
  }
}

function saveTasksToDb(tasksToSave) {
  if (firebaseDbRef) {
    firebaseDbRef.set(tasksToSave).then(() => {
      localStorage.setItem('hope_webapp_tasks_v10', JSON.stringify(tasksToSave));
      if (typeof render === 'function') render();
    }).catch(err => {
      console.error("Firebase write error:", err);
      localStorage.setItem('hope_webapp_tasks_v10', JSON.stringify(tasksToSave));
      if (typeof render === 'function') render();
    });
  }
}

// タスク削除関数
window.deleteTaskById = function (id) {
  if (confirm('このタスクを削除してもよろしいですか？')) {
    const newTasks = currentTasks.filter(t => t.id !== id);
    saveTasks(newTasks);
    const taskModal = document.getElementById('taskModal');
    if (taskModal) taskModal.classList.remove('active');
  }
};

// DB設定モーダルイベント（デバッグ用）
const dbConfigModal = document.getElementById('dbConfigModal');
const closeDbModal = document.getElementById('closeDbModal');
const cancelDbBtn = document.getElementById('cancelDbBtn');
const dbStatusBadge = document.getElementById('dbStatusBadge');

// 🛠️ デバッグ用グローバル関数 (コンソール `openDbConfigModal()` で起動可能)
window.openDbConfigModal = function () {
  if (dbConfigModal) dbConfigModal.classList.add('active');
};

if (closeDbModal) closeDbModal.addEventListener('click', () => dbConfigModal.classList.remove('active'));
if (cancelDbBtn) cancelDbBtn.addEventListener('click', () => dbConfigModal.classList.remove('active'));

// ⌨️ デバッグ用隠しショートカット: Ctrl + Shift + D
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    e.preventDefault();
    window.openDbConfigModal();
  }
});

// 🖱️ デバッグ用隠しトリプルクリック (バッジを3連打でモーダル起動)
if (dbStatusBadge) {
  let badgeClickCount = 0;
  let badgeClickTimer = null;
  dbStatusBadge.addEventListener('click', () => {
    badgeClickCount++;
    clearTimeout(badgeClickTimer);
    if (badgeClickCount >= 3) {
      badgeClickCount = 0;
      window.openDbConfigModal();
    } else {
      badgeClickTimer = setTimeout(() => { badgeClickCount = 0; }, 600);
    }
  });
}

document.getElementById('dbConfigForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const inputVal = document.getElementById('firebaseConfigInput').value.trim();
  if (!inputVal) {
    localStorage.removeItem('hope_firebase_config');
    alert('設定をクリアしました。ローカルモードでリロードします。');
    location.reload();
    return;
  }
  try {
    const parsed = JSON.parse(inputVal);
    localStorage.setItem('hope_firebase_config', JSON.stringify(parsed));
    alert('Firebase設定を保存しました。再接続します。');
    location.reload();
  } catch (err) {
    alert('JSON形式が正しくありません。FirebaseコンソールのConfigオブジェクトをそのまま貼り付けてください。');
  }
});

document.getElementById('resetDbConfigBtn')?.addEventListener('click', () => {
  if (confirm('Firebase設定を解除してローカル保存モードに戻しますか？')) {
    localStorage.removeItem('hope_firebase_config');
    location.reload();
  }
});
