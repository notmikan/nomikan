// 画像（ご提示の完成イメージ）に基づく完全一致タスクデータ
const defaultTasks = [
  // 【全体・運用】
  { id: "1", team: "全体", name: "交流会", assignee: "全員", start: 9, end: 9, note: "" },
  { id: "2", team: "全体", name: "学祭", assignee: "全員", start: 11, end: 11, note: "" },
  { id: "3", team: "全体", name: "桁試験", assignee: "全員", start: 12, end: 12, note: "" },
  { id: "4", team: "全体", name: "交流会", assignee: "全員", start: 3, end: 3, note: "" },
  { id: "5", team: "全体", name: "新歓", assignee: "全員", start: 4, end: 4, note: "" },
  { id: "6", team: "全体", name: "TF", assignee: "全員", start: 5, end: 5, note: "" },
  { id: "7", team: "全体", name: "鳥人間コンテスト本番", assignee: "全員", start: 7, end: 7, note: "7月本番" },
  
  // 【FRP班】
  { id: "8", team: "FRP", name: "試作（桁・フランジ）", assignee: "FRP班", start: 8, end: 9, note: "" },
  { id: "9", team: "FRP", name: "簪（かんざし）制作", assignee: "FRP班", start: 8, end: 9, note: "" },
  { id: "10", team: "FRP", name: "T桁の発注", assignee: "FRP班", start: 10, end: 11, note: "" },
  { id: "11", team: "FRP", name: "フランジ作成", assignee: "FRP班", start: 2, end: 5, note: "" },
  { id: "12", team: "FRP", name: "胴体関連", assignee: "FRP班", start: 4, end: 4, note: "" },

  // 【翼班】
  { id: "13", team: "翼", name: "夏/秋試作", assignee: "翼班", start: 8, end: 9, note: "" },
  { id: "14", team: "翼", name: "治具準備・リブ切り", assignee: "翼班", start: 11, end: 1, note: "" },
  { id: "15", team: "翼", name: "B翼製作", assignee: "翼班", start: 1, end: 2, note: "" },
  { id: "16", team: "翼", name: "A翼製作", assignee: "翼班", start: 2, end: 3, note: "" },
  { id: "17", team: "翼", name: "C翼製作", assignee: "翼班", start: 2, end: 3, note: "" },
  { id: "18", team: "翼", name: "D翼製作", assignee: "翼班", start: 3, end: 4, note: "" },
  { id: "19", team: "翼", name: "T尾翼製作", assignee: "翼班", start: 4, end: 4, note: "" },

  // 【コクピ班】
  { id: "20", team: "コクピ", name: "旧フレーム試作", assignee: "コクピ班", start: 8, end: 9, note: "" },
  { id: "21", team: "コクピ", name: "フレーム本制作", assignee: "コクピ班", start: 2, end: 4, note: "" },
  { id: "22", team: "コクピ", name: "電装用天板作成", assignee: "コクピ班", start: 3, end: 4, note: "" },
  { id: "23", team: "コクピ", name: "ご神体（型）制作", assignee: "コクピ班", start: 3, end: 6, note: "" },
  { id: "24", team: "コクピ", name: "フェアリング制作", assignee: "コクピ班", start: 5, end: 6, note: "" },
  { id: "25", team: "コクピ", name: "キャノピー焼き", assignee: "コクピ班", start: 6, end: 6, note: "" },

  // 【電装班】
  { id: "26", team: "電装", name: "1年生講習会(28G)", assignee: "電装班", start: 8, end: 8, note: "" },
  { id: "27", team: "電装", name: "Pixhawk親機試作", assignee: "電装班", start: 8, end: 10, note: "" },
  { id: "28", team: "電装", name: "操舵系試作", assignee: "電装班", start: 8, end: 9, note: "" },
  { id: "29", team: "電装", name: "ハッチ機構試作", assignee: "電装班", start: 8, end: 10, note: "" },
  { id: "30", team: "電装", name: "UI・通信試作", assignee: "電装班", start: 8, end: 10, note: "" },
  { id: "31", team: "電装", name: "学祭電装(スケール機)", assignee: "電装班", start: 10, end: 11, note: "" },
  { id: "32", team: "電装", name: "桁試験用距離計手配", assignee: "電装班", start: 10, end: 12, note: "" },
  { id: "33", team: "電装", name: "ピトー管・高度計完成", assignee: "電装班", start: 5, end: 6, note: "" },
  { id: "34", team: "電装", name: "UI表示計完成", assignee: "電装班", start: 5, end: 6, note: "" }
];

// アプリ全体状態
let currentTasks = [];
let firebaseDbRef = null;
let isFirebaseOnline = false;

let currentTeam = 'all';
let currentQuery = '';

// DOM要素
const grid = document.getElementById('ganttGrid');
const badge = document.getElementById('viewModeBadge');
const dbStatusBadge = document.getElementById('dbStatusBadge');
const dbStatusText = document.getElementById('dbStatusText');
const syncInfoText = document.getElementById('syncInfoText');

// モーダル要素
const taskModal = document.getElementById('taskModal');
const dbConfigModal = document.getElementById('dbConfigModal');

// --- 1. Firebase ＆ データ管理 ---

function initDatabase() {
  const savedConfigStr = localStorage.getItem('hope_firebase_config');
  
  if (savedConfigStr && typeof firebase !== 'undefined') {
    try {
      const config = JSON.parse(savedConfigStr);
      if (config && (config.databaseURL || config.apiKey)) {
        if (!firebase.apps.length) {
          firebase.initializeApp(config);
        }
        firebaseDbRef = firebase.database().ref('hope_webapp_tasks');
        
        // リアルタイムリスナー設定
        firebaseDbRef.on('value', (snapshot) => {
          const val = snapshot.val();
          if (val) {
            currentTasks = Array.isArray(val) ? val : Object.values(val);
          } else {
            currentTasks = [...defaultTasks];
            saveTasksToDb(currentTasks);
          }
          setOnlineStatus(true);
          render();
        }, (error) => {
          console.warn("Firebase sync error:", error);
          fallbackToLocal();
        });
        return;
      }
    } catch (e) {
      console.error("Invalid Firebase config:", e);
    }
  }
  fallbackToLocal();
}

function fallbackToLocal() {
  isFirebaseOnline = false;
  firebaseDbRef = null;
  setOnlineStatus(false);

  // 古いバージョンストレージをクリアし完全最新データを適用
  const localSaved = localStorage.getItem('hope_webapp_tasks_v10');
  if (localSaved) {
    currentTasks = JSON.parse(localSaved);
  } else {
    currentTasks = [...defaultTasks];
    localStorage.setItem('hope_webapp_tasks_v10', JSON.stringify(currentTasks));
  }
  render();
}

function setOnlineStatus(online) {
  isFirebaseOnline = online;
  if (online) {
    dbStatusBadge.className = 'db-status-badge online';
    dbStatusText.textContent = 'リアルタイム同期中';
    syncInfoText.textContent = '🟢 Firebase DBにリアルタイム接続中 (全端末で同期)';
  } else {
    dbStatusBadge.className = 'db-status-badge local';
    dbStatusText.textContent = 'ローカル保存モード';
    syncInfoText.textContent = '🟡 ローカル保存モードで動作中 (右上の「⚙️ DB設定」からFirebase接続可能)';
  }
}

function saveTasks(newTasks) {
  currentTasks = newTasks;
  if (isFirebaseOnline && firebaseDbRef) {
    saveTasksToDb(newTasks);
  } else {
    localStorage.setItem('hope_webapp_tasks_v10', JSON.stringify(newTasks));
    render();
  }
}

function saveTasksToDb(tasksToSave) {
  if (firebaseDbRef) {
    firebaseDbRef.set(tasksToSave).catch(err => {
      console.error("Firebase write error:", err);
      localStorage.setItem('hope_webapp_tasks_v10', JSON.stringify(tasksToSave));
    });
  }
}

// データリセット関数
window.resetToDefaultImageData = function() {
  saveTasks([...defaultTasks]);
  alert("画像を基にした完全基準データにリセットしました！");
};

// --- 2. ガントチャート描画ロジック ---

function monthToIndex(m) {
  return Number(m) >= 8 ? Number(m) - 7 : Number(m) + 5;
}

function render() {
  const filtered = currentTasks.filter(task => {
    const matchTeam = currentTeam === 'all' || task.team === currentTeam;
    const matchQuery = task.name.includes(currentQuery) || 
                       task.assignee.includes(currentQuery) || 
                       (task.note && task.note.includes(currentQuery));
    return matchTeam && matchQuery;
  });

  const isCompactView = (currentTeam === 'all' && currentQuery === '');

  if (isCompactView) {
    badge.textContent = '全体概要モード';
    renderCompact(filtered);
  } else {
    badge.textContent = currentTeam === 'all' ? '検索モード' : `${currentTeam}班 詳細モード`;
    renderDetailed(filtered);
  }
}

// 【全体概要モード】(1班1行でシームレス連続横長ガントバー描画)
function renderCompact(filteredTasks) {
  const teams = ['全体', 'FRP', '翼', 'コクピ', '電装'];

  let html = `
    <div class="gantt-wrapper">
      <div class="gantt-header-row">
        <div class="gantt-header-cell">チーム / 班</div>
        <div class="gantt-header-cell">8月</div>
        <div class="gantt-header-cell">9月</div>
        <div class="gantt-header-cell">10月</div>
        <div class="gantt-header-cell">11月</div>
        <div class="gantt-header-cell">12月</div>
        <div class="gantt-header-cell">1月</div>
        <div class="gantt-header-cell">2月</div>
        <div class="gantt-header-cell">3月</div>
        <div class="gantt-header-cell">4月</div>
        <div class="gantt-header-cell">5月</div>
        <div class="gantt-header-cell">6月</div>
        <div class="gantt-header-cell">7月</div>
      </div>
  `;

  teams.forEach(teamName => {
    const teamTasks = filteredTasks.filter(t => t.team === teamName);

    html += `
      <div class="team-row-container">
        <div class="team-label-cell">
          <span class="badge badge-${teamName}">${teamName}</span>
        </div>
        <div class="team-timeline-grid">
          <div class="month-grid-lines">
            ${Array(12).fill('<div class="grid-line"></div>').join('')}
          </div>
    `;

    teamTasks.forEach(task => {
      const startCol = monthToIndex(task.start);
      const endCol = monthToIndex(task.end) + 1;

      html += `
        <div class="gantt-span-bar bg-${task.team}" 
             style="grid-column: ${startCol} / ${endCol};" 
             onclick="openEditModalById('${task.id}')">
          ${task.name}
          <div class="tooltip">
            <strong>${task.name}</strong><br>
            担当: ${task.assignee}<br>
            期間: ${task.start}月〜${task.end}月<br>
            備考: ${task.note || 'なし'}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  grid.innerHTML = html;
}

// 【個別詳細モード】(1タスク1行でシームレス連続ガントバー描画)
function renderDetailed(filteredTasks) {
  let html = `
    <div class="gantt-wrapper">
      <div class="gantt-header-row-detailed">
        <div class="gantt-header-cell" style="text-align:left; padding-left:14px;">タスク名</div>
        <div class="gantt-header-cell" style="text-align:left; padding-left:14px;">担当者</div>
        <div class="gantt-header-cell">8月</div>
        <div class="gantt-header-cell">9月</div>
        <div class="gantt-header-cell">10月</div>
        <div class="gantt-header-cell">11月</div>
        <div class="gantt-header-cell">12月</div>
        <div class="gantt-header-cell">1月</div>
        <div class="gantt-header-cell">2月</div>
        <div class="gantt-header-cell">3月</div>
        <div class="gantt-header-cell">4月</div>
        <div class="gantt-header-cell">5月</div>
        <div class="gantt-header-cell">6月</div>
        <div class="gantt-header-cell">7月</div>
        <div class="gantt-header-cell">操作</div>
      </div>
  `;

  filteredTasks.forEach(task => {
    const startCol = monthToIndex(task.start);
    const endCol = monthToIndex(task.end) + 1;

    html += `
      <div class="task-row-container">
        <div class="task-label-cell">
          <span class="badge badge-${task.team}" style="font-size:10px; padding:2px 6px;">${task.team}</span>
          <span style="font-weight:600; font-size:13px; cursor:pointer;" onclick="openEditModalById('${task.id}')">${task.name}</span>
        </div>
        <div class="task-assignee-cell">${task.assignee}</div>
        <div class="team-timeline-grid">
          <div class="month-grid-lines">
            ${Array(12).fill('<div class="grid-line"></div>').join('')}
          </div>
          <div class="gantt-span-bar bg-${task.team}" 
               style="grid-column: ${startCol} / ${endCol};" 
               onclick="openEditModalById('${task.id}')">
            ${task.name}
            <div class="tooltip">
              <strong>${task.name}</strong><br>
              担当: ${task.assignee}<br>
              期間: ${task.start}月〜${task.end}月<br>
              備考: ${task.note || 'なし'}
            </div>
          </div>
        </div>
        <div class="task-action-cell">
          <button class="action-btn" onclick="openEditModalById('${task.id}')" title="編集">✏️</button>
          <button class="action-btn delete" onclick="deleteTaskById('${task.id}')" title="削除">🗑️</button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  grid.innerHTML = html;
}

// --- 3. イベントハンドラ ＆ UI制御 ---

// フィルタボタン
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentTeam = e.target.dataset.team;
    render();
  });
});

// 検索インプット
document.getElementById('searchInput').addEventListener('input', (e) => {
  currentQuery = e.target.value.trim();
  render();
});

// タスク追加モーダル
document.getElementById('addBtn').addEventListener('click', () => {
  document.getElementById('taskForm').reset();
  document.getElementById('taskId').value = '';
  document.getElementById('modalTitle').textContent = '➕ タスクの追加';
  document.getElementById('deleteModalBtn').style.display = 'none';
  taskModal.classList.add('active');
});

document.getElementById('closeModal').addEventListener('click', () => taskModal.classList.remove('active'));
document.getElementById('cancelBtn').addEventListener('click', () => taskModal.classList.remove('active'));

window.openEditModalById = function(id) {
  const task = currentTasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('taskId').value = task.id;
  document.getElementById('taskTeam').value = task.team;
  document.getElementById('taskName').value = task.name;
  document.getElementById('taskAssignee').value = task.assignee;
  document.getElementById('taskStart').value = task.start;
  document.getElementById('taskEnd').value = task.end;
  document.getElementById('taskNote').value = task.note || '';

  document.getElementById('modalTitle').textContent = '✏️ タスクの編集';
  document.getElementById('deleteModalBtn').style.display = 'inline-flex';
  taskModal.classList.add('active');
};

document.getElementById('taskForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('taskId').value || String(Date.now());
  const team = document.getElementById('taskTeam').value;
  const name = document.getElementById('taskName').value.trim();
  const assignee = document.getElementById('taskAssignee').value.trim();
  const start = Number(document.getElementById('taskStart').value);
  const end = Number(document.getElementById('taskEnd').value);
  const note = document.getElementById('taskNote').value.trim();

  const existingIndex = currentTasks.findIndex(t => t.id === id);
  const updatedTask = { id, team, name, assignee, start, end, note };

  let newTasks = [...currentTasks];
  if (existingIndex >= 0) {
    newTasks[existingIndex] = updatedTask;
  } else {
    newTasks.push(updatedTask);
  }

  saveTasks(newTasks);
  taskModal.classList.remove('active');
});

document.getElementById('deleteModalBtn').addEventListener('click', () => {
  const id = document.getElementById('taskId').value;
  if (id && confirm('このタスクを削除してもよろしいですか？')) {
    deleteTaskById(id);
    taskModal.classList.remove('active');
  }
});

window.deleteTaskById = function(id) {
  const newTasks = currentTasks.filter(t => t.id !== id);
  saveTasks(newTasks);
};

// DB設定モーダル
document.getElementById('openDbConfigBtn').addEventListener('click', () => {
  const saved = localStorage.getItem('hope_firebase_config') || '';
  document.getElementById('firebaseConfigInput').value = saved;
  dbConfigModal.classList.add('active');
});

document.getElementById('closeDbModal').addEventListener('click', () => dbConfigModal.classList.remove('active'));
document.getElementById('cancelDbBtn').addEventListener('click', () => dbConfigModal.classList.remove('active'));

document.getElementById('dbConfigForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const rawInput = document.getElementById('firebaseConfigInput').value.trim();
  if (rawInput) {
    try {
      let configObj;
      if (rawInput.startsWith('{')) {
        configObj = JSON.parse(rawInput);
      } else {
        configObj = { databaseURL: rawInput };
      }
      localStorage.setItem('hope_firebase_config', JSON.stringify(configObj));
      alert("Firebase設定を保存しました。接続を初期化します。");
      dbConfigModal.classList.remove('active');
      initDatabase();
    } catch (err) {
      alert("Firebase Config の記述が正しくありません。正しいJSON形式またはURLを入力してください。");
    }
  } else {
    localStorage.removeItem('hope_firebase_config');
    dbConfigModal.classList.remove('active');
    fallbackToLocal();
  }
});

document.getElementById('resetDbConfigBtn').addEventListener('click', () => {
  if (confirm("ローカル保存モードに戻しますか？")) {
    localStorage.removeItem('hope_firebase_config');
    dbConfigModal.classList.remove('active');
    fallbackToLocal();
  }
});

// タブ切り替え
window.switchTab = function(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });

  const timetableTab = document.getElementById('timetableTab');
  const placeholderTab = document.getElementById('placeholderTab');

  if (tabName === 'timetable') {
    timetableTab.classList.add('active');
    placeholderTab.classList.remove('active');
  } else {
    timetableTab.classList.remove('active');
    placeholderTab.classList.add('active');

    const iconMap = {
      budget: '💰',
      inventory: '📦',
      members: '👥',
      admin: '🔒'
    };
    const titleMap = {
      budget: '予算 ＆ 資材発注管理モジュール',
      inventory: '部品・資材・工具 在庫管理モジュール',
      members: 'メンバー ＆ 作業シフト管理モジュール',
      admin: '幹部専用 設定 ＆ 権限管理'
    };

    document.getElementById('placeholderIcon').textContent = iconMap[tabName] || '⚙️';
    document.getElementById('placeholderTitle').textContent = titleMap[tabName] || 'モジュール準備中';
  }
};

document.querySelectorAll('.nav-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', (e) => {
    const targetTab = e.currentTarget.dataset.tab;
    switchTab(targetTab);
  });
});

// 初期化実行
initDatabase();
