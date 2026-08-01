/**
 * db.js - Firebase Realtime DB & LocalStorage 同期モジュール
 */

let currentTasks = [...defaultTasks];
let firebaseDbRef = null;
let isFirebaseOnline = false;

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

// データベースの初期化
function initDatabase() {
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

      if (typeof initPostsDatabase === 'function') initPostsDatabase();
      return;
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
    }).catch(err => {
      console.error("Firebase write error:", err);
      localStorage.setItem('hope_webapp_tasks_v10', JSON.stringify(tasksToSave));
      if (typeof render === 'function') render();
    });
  }
}

// タスク削除関数
window.deleteTaskById = function(id) {
  if (confirm('このタスクを削除してもよろしいですか？')) {
    const newTasks = currentTasks.filter(t => t.id !== id);
    saveTasks(newTasks);
    const taskModal = document.getElementById('taskModal');
    if (taskModal) taskModal.classList.remove('active');
  }
};

// DB設定モーダルイベント
const dbConfigModal = document.getElementById('dbConfigModal');
const openDbConfigBtn = document.getElementById('openDbConfigBtn');
const closeDbModal = document.getElementById('closeDbModal');
const cancelDbBtn = document.getElementById('cancelDbBtn');
const dbStatusBadge = document.getElementById('dbStatusBadge');

if (openDbConfigBtn) openDbConfigBtn.addEventListener('click', () => dbConfigModal.classList.add('active'));
if (dbStatusBadge) dbStatusBadge.addEventListener('click', () => dbConfigModal.classList.add('active'));
if (closeDbModal) closeDbModal.addEventListener('click', () => dbConfigModal.classList.remove('active'));
if (cancelDbBtn) cancelDbBtn.addEventListener('click', () => dbConfigModal.classList.remove('active'));

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
