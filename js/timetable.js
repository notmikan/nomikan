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

// 【各班詳細・検索モード】 (見やすい月別カードリスト表示)
function renderDetailed(filteredTasks) {
  const grid = document.getElementById('ganttGrid');
  if (!grid) return;

  const months = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

  if (filteredTasks.length === 0) {
    grid.innerHTML = `
      <div class="placeholder-card" style="margin: 20px 0; padding: 30px;">
        <div class="placeholder-icon">🔍</div>
        <h2>該当するタスクが見つかりませんでした</h2>
        <p>検索条件を変更するか、右上の「➕ タスク追加」から新しく追加してください。</p>
      </div>
    `;
    return;
  }

  let html = `<div class="team-cards-grid">`;

  months.forEach(m => {
    const mIdx = monthToIndex(m);
    const monthTasks = filteredTasks.filter(t => {
      const sIdx = monthToIndex(t.start);
      const eIdx = monthToIndex(t.end);
      return mIdx >= sIdx && mIdx <= eIdx;
    });

    if (monthTasks.length === 0) return;

    html += `
      <div class="month-card-section">
        <div class="month-card-header">
          <span class="month-card-title">🗓️ ${m}月</span>
          <span class="month-card-count">${monthTasks.length}件のタスク</span>
        </div>
        <div class="month-card-list">
    `;

    monthTasks.forEach(task => {
      const dateText = (task.startDate && task.endDate)
        ? `📅 ${formatDateShort(task.startDate)} 〜 ${formatDateShort(task.endDate)}`
        : `${task.start}月 〜 ${task.end}月`;

      html += `
        <div class="task-detail-card team-border-${task.team}">
          <div class="card-top-row">
            <span class="badge badge-${task.team}">${task.team}班</span>
            <span class="card-duration-badge">${dateText}</span>
          </div>
          <div class="card-task-title" onclick="openEditModalById('${task.id}')">${task.name}</div>
          <div class="card-meta-row">
            <span class="card-assignee">👤 ${task.assignee}</span>
            ${task.note ? `<span class="card-note" title="${task.note}">📝 ${task.note}</span>` : ''}
          </div>
          <div class="card-action-row">
            <button class="btn-card-action" onclick="openEditModalById('${task.id}')">✏️ 編集</button>
            <button class="btn-card-action delete" onclick="deleteTaskById('${task.id}')">🗑️ 削除</button>
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

document.getElementById('closeModal')?.addEventListener('click', () => {
  if (taskModal) taskModal.classList.remove('active');
});

document.getElementById('cancelBtn')?.addEventListener('click', () => {
  if (taskModal) taskModal.classList.remove('active');
});

window.openEditModalById = function(id) {
  const task = currentTasks.find(t => t.id === id);
  if (!task || !taskModal) return;

  document.getElementById('taskId').value = task.id;
  document.getElementById('taskTeam').value = task.team;
  document.getElementById('taskName').value = task.name;
  document.getElementById('taskAssignee').value = task.assignee;
  document.getElementById('taskStartDate').value = task.startDate || '';
  document.getElementById('taskEndDate').value = task.endDate || '';

  const hasSpecificDate = Boolean(task.startDate || task.endDate);
  if (enableSpecificDateCheckbox) enableSpecificDateCheckbox.checked = hasSpecificDate;
  if (specificDateContainer) specificDateContainer.style.display = hasSpecificDate ? 'flex' : 'none';

  document.getElementById('taskStart').value = task.start;
  document.getElementById('taskEnd').value = task.end;
  document.getElementById('taskNote').value = task.note || '';

  document.getElementById('modalTitle').textContent = 'タスク編集';
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

  const useSpecificDate = enableSpecificDateCheckbox ? enableSpecificDateCheckbox.checked : false;
  const startDate = useSpecificDate ? document.getElementById('taskStartDate').value : '';
  const endDate = useSpecificDate ? document.getElementById('taskEndDate').value : '';

  const start = Number(document.getElementById('taskStart').value);
  const end = Number(document.getElementById('taskEnd').value);
  const note = document.getElementById('taskNote').value.trim();

  const existingIndex = currentTasks.findIndex(t => t.id === id);
  const updatedTask = { id, team, name, assignee, startDate, endDate, start, end, note };

  let newTasks = [...currentTasks];
  if (existingIndex >= 0) {
    newTasks[existingIndex] = updatedTask;
  } else {
    newTasks.push(updatedTask);
  }

  saveTasks(newTasks);
  if (taskModal) taskModal.classList.remove('active');
});
