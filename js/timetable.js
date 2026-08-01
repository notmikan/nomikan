/**
 * timetable.js - ガントチャート描画・各班カード・タスクモーダル制御
 */

let currentTeamFilter = 'all';
let currentQuery = '';

function monthToIndex(m) {
  return Number(m) >= 8 ? Number(m) - 7 : Number(m) + 5;
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function normalizeTeam(tName) {
  if (!tName || tName === '全体') return '運営';
  return tName;
}

// 描画エントリポイント
function render() {
  if (typeof renderHomeDashboard === 'function') {
    renderHomeDashboard();
  }

  const badge = document.getElementById('viewModeBadge');

  const filtered = currentTasks.filter(task => {
    const teamName = normalizeTeam(task.team);
    const filterName = normalizeTeam(currentTeamFilter);
    const matchTeam = currentTeamFilter === 'all' || teamName === filterName;
    const matchQuery = !currentQuery || 
                       task.name.includes(currentQuery) || 
                       task.assignee.includes(currentQuery) || 
                       (task.note && task.note.includes(currentQuery));
    return matchTeam && matchQuery;
  });

  const isCompactView = (currentTeamFilter === 'all' && currentQuery === '');

  if (isCompactView) {
    if (badge) badge.textContent = '全体概要モード';
    renderCompact(filtered);
  } else {
    if (badge) badge.textContent = currentTeamFilter === 'all' ? '検索モード' : `${normalizeTeam(currentTeamFilter)}班 詳細モード`;
    renderDetailed(filtered);
  }
}

// 【全体概要モード】(1班1行でシームレス連続横長ガントバー描画)
function renderCompact(filteredTasks) {
  const grid = document.getElementById('ganttGrid');
  if (!grid) return;

  const teams = ['運営', 'FRP', '翼', 'コクピ', '電装'];

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
    const teamTasks = filteredTasks.filter(t => normalizeTeam(t.team) === teamName);

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
        <div class="gantt-span-bar bg-${normalizeTeam(task.team)}" 
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

// 【各班詳細・検索モード】 (時系列昇順ソート＆スマートカード表示)
function renderDetailed(filteredTasks) {
  const grid = document.getElementById('ganttGrid');
  if (!grid) return;

  if (filteredTasks.length === 0) {
    grid.innerHTML = `
      <div class="placeholder-card" style="margin: 20px 0; padding: 30px;">
        <div class="placeholder-icon">🔍</div>
        <h2>該当するタスクが見つかりませんでした</h2>
        <p>検索条件を変更するか、右上の「＋ タスク追加」から新しく追加してください。</p>
      </div>
    `;
    return;
  }

  // 開始月（または日付）の早い順に時系列昇順ソート (重複なし)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const sA = monthToIndex(a.start);
    const sB = monthToIndex(b.start);
    if (sA !== sB) return sA - sB;
    return monthToIndex(a.end) - monthToIndex(b.end);
  });

  let html = `<div class="task-cards-grid">`;

  sortedTasks.forEach(task => {
    const teamName = normalizeTeam(task.team);
    
    // 期間表示テキスト
    const dateText = (task.startDate && task.endDate)
      ? `${formatDateShort(task.startDate)} 〜 ${formatDateShort(task.endDate)}`
      : `${task.start}月 〜 ${task.end}月`;

    // ToDoリストから進捗率(%)を動的計算 (または手動設定値)
    const todos = task.todos || [];
    let progress = typeof task.progress === 'number' ? task.progress : 0;
    if (todos.length > 0) {
      const completedCount = todos.filter(t => t.completed).length;
      progress = Math.round((completedCount / todos.length) * 100);
    }

    let statusClass = 'in-progress';
    let statusLabel = `⚡ 進行中 (${progress}%)`;
    if (progress === 100) {
      statusClass = 'completed';
      statusLabel = '✓ 完了';
    } else if (progress === 0) {
      statusClass = 'not-started';
      statusLabel = '未着手';
    }

    html += `
      <div class="task-detail-card team-border-${teamName}" onclick="openEditModalById('${task.id}')" title="クリックして詳細・作業手順">
        <div class="card-header-row">
          <div class="card-task-title">${escapeHtml(task.name)}</div>
          <span class="card-duration-tag">${dateText}</span>
        </div>
        
        <div class="card-meta-info">
          <span class="card-assignee-text">
            <span class="badge badge-${teamName}">${teamName}班</span>
            <span>👤 ${escapeHtml(task.assignee)}</span>
          </span>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>

        ${task.note ? `<div style="font-size: 11px; color: #b45309; background: #fffbeb; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px;">📝 ${escapeHtml(task.note)}</div>` : ''}

        <!-- 📊 進捗プログレスメーター -->
        <div class="card-progress-container">
          <div class="card-progress-bar-bg">
            <div class="card-progress-bar-fill" style="width: ${progress}%;"></div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  grid.innerHTML = html;
}

// ✅ タスク内 ToDo リスト管理ロジック
let currentTaskTodos = [];

function renderTodoList() {
  const container = document.getElementById('todoListContainer');
  const progressText = document.getElementById('taskProgressValueText');
  if (!container) return;

  if (currentTaskTodos.length === 0) {
    container.innerHTML = `<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 24px 10px;">ToDoを追加できます</div>`;
    if (progressText) progressText.textContent = `進捗 0%`;
    return;
  }

  const completedCount = currentTaskTodos.filter(t => t.completed).length;
  const calculatedProgress = Math.round((completedCount / currentTaskTodos.length) * 100);
  if (progressText) progressText.textContent = `進捗 ${calculatedProgress}% (${completedCount}/${currentTaskTodos.length})`;

  container.innerHTML = currentTaskTodos.map((todo, idx) => `
    <div class="todo-item-row ${todo.completed ? 'completed' : ''}">
      <div class="todo-item-left" onclick="toggleTodoItem(${idx})">
        <input type="checkbox" ${todo.completed ? 'checked' : ''} onclick="event.stopPropagation(); toggleTodoItem(${idx});">
        <span>${escapeHtml(todo.text)}</span>
      </div>
      <button type="button" class="todo-delete-btn" onclick="deleteTodoItem(${idx})">✕</button>
    </div>
  `).join('');
}

window.toggleTodoItem = function(idx) {
  if (currentTaskTodos[idx]) {
    currentTaskTodos[idx].completed = !currentTaskTodos[idx].completed;
    renderTodoList();
  }
};

window.deleteTodoItem = function(idx) {
  currentTaskTodos.splice(idx, 1);
  renderTodoList();
};

document.getElementById('addTodoBtn')?.addEventListener('click', () => {
  const input = document.getElementById('newTodoInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  currentTaskTodos.push({ id: 'todo_' + Date.now(), text: text, completed: false });
  input.value = '';
  renderTodoList();
});

document.getElementById('newTodoInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addTodoBtn')?.click();
  }
});

// フィルタボタン イベント登録
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentTeamFilter = e.target.dataset.team;
    render();
  });
});

// 検索インプット
document.getElementById('searchInput')?.addEventListener('input', (e) => {
  currentQuery = e.target.value.trim();
  render();
});

// モーダル制御
const taskModal = document.getElementById('taskModal');
const enableSpecificDateCheckbox = document.getElementById('enableSpecificDate');
const specificDateContainer = document.getElementById('specificDateContainer');

if (enableSpecificDateCheckbox && specificDateContainer) {
  enableSpecificDateCheckbox.addEventListener('change', (e) => {
    specificDateContainer.style.display = e.target.checked ? 'flex' : 'none';
  });
}

// タスク追加モーダル
document.getElementById('addBtn')?.addEventListener('click', () => {
  document.getElementById('taskForm').reset();
  document.getElementById('taskId').value = '';
  document.getElementById('taskStartDate').value = '';
  document.getElementById('taskEndDate').value = '';
  currentTaskTodos = [];
  renderTodoList();
  if (enableSpecificDateCheckbox) enableSpecificDateCheckbox.checked = false;
  if (specificDateContainer) specificDateContainer.style.display = 'none';
  document.getElementById('modalTitle').textContent = 'タスク追加';
  document.getElementById('deleteModalBtn').style.display = 'none';
  if (taskModal) taskModal.classList.add('active');
});

// 日付選択時の月自動判定連動
document.getElementById('taskStartDate')?.addEventListener('change', (e) => {
  if (e.target.value) {
    const month = new Date(e.target.value).getMonth() + 1;
    document.getElementById('taskStart').value = String(month);
  }
});

document.getElementById('taskEndDate')?.addEventListener('change', (e) => {
  if (e.target.value) {
    const month = new Date(e.target.value).getMonth() + 1;
    document.getElementById('taskEnd').value = String(month);
  }
});

function closeTaskModal() {
  if (taskModal) taskModal.classList.remove('active');
  document.getElementById('taskForm')?.reset();
  currentTaskTodos = [];
}

document.getElementById('closeModal')?.addEventListener('click', closeTaskModal);
document.getElementById('cancelBtn')?.addEventListener('click', closeTaskModal);

window.openEditModalById = function(id) {
  const task = currentTasks.find(t => t.id === id);
  if (!task || !taskModal) return;

  document.getElementById('taskId').value = task.id;
  document.getElementById('taskTeam').value = task.team;
  document.getElementById('taskName').value = task.name;
  document.getElementById('taskAssignee').value = task.assignee;
  document.getElementById('taskStartDate').value = task.startDate || '';
  document.getElementById('taskEndDate').value = task.endDate || '';

  currentTaskTodos = task.todos ? JSON.parse(JSON.stringify(task.todos)) : [];
  renderTodoList();

  const hasSpecificDate = Boolean(task.startDate || task.endDate);
  if (enableSpecificDateCheckbox) enableSpecificDateCheckbox.checked = hasSpecificDate;
  if (specificDateContainer) specificDateContainer.style.display = hasSpecificDate ? 'flex' : 'none';

  document.getElementById('taskStart').value = task.start;
  document.getElementById('taskEnd').value = task.end;
  document.getElementById('taskNote').value = task.note || '';

  document.getElementById('modalTitle').textContent = 'タスク詳細';
  document.getElementById('deleteModalBtn').style.display = 'inline-flex';
  taskModal.classList.add('active');
};

document.getElementById('deleteModalBtn')?.addEventListener('click', () => {
  const id = document.getElementById('taskId').value;
  if (id) deleteTaskById(id);
});

document.getElementById('taskForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('taskId').value || String(Date.now());
  const team = document.getElementById('taskTeam').value;
  const name = document.getElementById('taskName').value.trim();
  const assignee = document.getElementById('taskAssignee').value.trim();

  const completedCount = currentTaskTodos.filter(t => t.completed).length;
  const calculatedProgress = currentTaskTodos.length > 0 
    ? Math.round((completedCount / currentTaskTodos.length) * 100) 
    : 0;

  const useSpecificDate = enableSpecificDateCheckbox ? enableSpecificDateCheckbox.checked : false;
  const startDate = useSpecificDate ? document.getElementById('taskStartDate').value : '';
  const endDate = useSpecificDate ? document.getElementById('taskEndDate').value : '';

  const start = Number(document.getElementById('taskStart').value);
  const end = Number(document.getElementById('taskEnd').value);
  const note = document.getElementById('taskNote').value.trim();

  const existingIndex = currentTasks.findIndex(t => t.id === id);
  const updatedTask = { id, team, name, assignee, progress: calculatedProgress, todos: [...currentTaskTodos], startDate, endDate, start, end, note };

  let newTasks = [...currentTasks];
  if (existingIndex >= 0) {
    newTasks[existingIndex] = updatedTask;
  } else {
    newTasks.push(updatedTask);
  }

  currentTasks = newTasks;
  saveTasks(newTasks);
  closeTaskModal();
});

// 🤖 AI連動による ToDo チェック ＆ 動的追加 API (完了 / 未完了進行中トグル対応)
window.addOrCheckTodoByAi = function(taskId, todoText, isCompleted = true) {
  if (!taskId || !todoText) return null;
  const index = currentTasks.findIndex(t => t.id == taskId);
  if (index < 0) return null;

  const task = currentTasks[index];
  let todos = Array.isArray(task.todos) ? [...task.todos] : [];
  
  let existingIndex = todos.findIndex(t => t.text.includes(todoText) || todoText.includes(t.text));
  let isNew = false;

  if (existingIndex >= 0) {
    if (isCompleted) {
      todos[existingIndex].completed = true;
    }
  } else {
    todos.push({ text: todoText, completed: isCompleted });
    isNew = true;
  }

  const completedCount = todos.filter(t => t.completed).length;
  const progressPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : (task.progress || 0);

  currentTasks[index] = {
    ...task,
    todos: todos,
    progress: progressPercent
  };

  saveTasks(currentTasks);
  return { taskId: task.id, taskName: task.name, isNew: isNew, isCompleted: isCompleted, progress: progressPercent };
};

// 🤖 AI連動の取り消し API
window.revertAiTaskUpdate = function(taskId, todoText) {
  const index = currentTasks.findIndex(t => t.id === taskId);
  if (index < 0) return;

  const task = currentTasks[index];
  let todos = Array.isArray(task.todos) ? [...task.todos] : [];

  let existingIndex = todos.findIndex(t => t.text === todoText);
  if (existingIndex >= 0) {
    todos[existingIndex].completed = false;
  }

  const completedCount = todos.filter(t => t.completed).length;
  const progressPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  currentTasks[index] = {
    ...task,
    todos: todos,
    progress: progressPercent
  };

  saveTasks(currentTasks);
};
