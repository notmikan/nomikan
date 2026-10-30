/**
 * timetable.js - ガントチャート描画・各班カード・タスクモーダル制御
 */

let currentTeamFilter = 'all';
let currentQuery = '';
let currentViewMode = 'month'; // 'month' (初期デフォルト) | 'year'
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;

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
                       (task.assignee && task.assignee.includes(currentQuery)) || 
                       (task.note && task.note.includes(currentQuery));
    return matchTeam && matchQuery;
  });

  // 📆 月間カレンダーモード
  if (currentViewMode === 'month') {
    if (badge) badge.textContent = `${calYear}年 ${calMonth}月 カレンダー`;
    renderMonthlyCalendar(filtered);
    return;
  }

  // 🌐 年間ガントモード
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
            ${MONTHS.map(m => `
              <div class="grid-line" onclick="openAddTaskModal({ month: ${m}, team: '${teamName}' })" title="${teamName}班の${m}月にタスクを追加" style="cursor: pointer; pointer-events: auto;"></div>
            `).join('')}
          </div>
    `;

    teamTasks.forEach(task => {
      const startCol = monthToIndex(task.start);
      const endCol = monthToIndex(task.end) + 1;

      html += `
        <div class="gantt-span-bar bg-${normalizeTeam(task.team)}" 
             style="grid-column: ${startCol} / ${endCol};" 
             onclick="event.stopPropagation(); openEditModalById('${task.id}')">
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

// 📆 【月間カレンダーモード】(連続した日程を帯状バーで表示)
function renderMonthlyCalendar(filteredTasks) {
  const grid = document.getElementById('ganttGrid');
  if (!grid) return;

  const currentLabel = document.getElementById('currentMonthLabel');
  if (currentLabel) {
    currentLabel.textContent = `${calYear}年 ${calMonth}月`;
  }

  const today = new Date();
  const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const firstDay = new Date(calYear, calMonth - 1, 1).getDay(); // 0(日)〜6(土)
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const prevMonthLastDate = new Date(calYear, calMonth - 1, 0).getDate();

  // 全日数の配列構築 (前月余白 + 当月 + 翌月余白)
  const allDays = [];

  // 前月余白
  for (let i = 0; i < firstDay; i++) {
    const dayNum = prevMonthLastDate - firstDay + i + 1;
    const m = calMonth === 1 ? 12 : calMonth - 1;
    const y = calMonth === 1 ? calYear - 1 : calYear;
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    allDays.push({ dayNum, ymd, isCurrentMonth: false, dayOfWeek: i });
  }

  // 当月
  for (let day = 1; day <= daysInMonth; day++) {
    const ymd = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = (firstDay + day - 1) % 7;
    allDays.push({ dayNum: day, ymd, isCurrentMonth: true, dayOfWeek });
  }

  // 翌月余白 (7の倍数になるまで)
  const remaining = (7 - (allDays.length % 7)) % 7;
  for (let j = 1; j <= remaining; j++) {
    const m = calMonth === 12 ? 1 : calMonth + 1;
    const y = calMonth === 12 ? calYear + 1 : calYear;
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
    const dayOfWeek = allDays.length % 7;
    allDays.push({ dayNum: j, ymd, isCurrentMonth: false, dayOfWeek });
  }

  // 7日単位で週に分割
  const weeks = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  // カレンダー対象タスク (具体的な日付があるもの)
  const validTasks = filteredTasks.filter(task => Boolean(task.startDate || task.endDate));

  let weeksHtml = '';

  weeks.forEach(week => {
    const weekStart = week[0].ymd;
    const weekEnd = week[6].ymd;

    // この週に属するタスクセグメントを抽出
    const weekTasks = [];
    validTasks.forEach(task => {
      const tStart = task.startDate || task.endDate;
      const tEnd = task.endDate || task.startDate;

      if (tStart <= weekEnd && tEnd >= weekStart) {
        // 週内での開始・終了日付
        const segStart = tStart < weekStart ? weekStart : tStart;
        const segEnd = tEnd > weekEnd ? weekEnd : tEnd;

        const startIdx = week.findIndex(d => d.ymd === segStart);
        const endIdx = week.findIndex(d => d.ymd === segEnd);

        if (startIdx >= 0 && endIdx >= 0) {
          const colStart = startIdx + 1; // 1〜7 (CSS Grid)
          const colSpan = endIdx - startIdx + 1;
          const isStart = (tStart >= weekStart);
          const isEnd = (tEnd <= weekEnd);

          weekTasks.push({
            task,
            colStart,
            colSpan,
            colEnd: colStart + colSpan - 1,
            isStart,
            isEnd
          });
        }
      }
    });

    // レーン（行）の割り当て: 重なり防止
    // 開始が早い順、同じなら期間が長い順にソート
    weekTasks.sort((a, b) => {
      if (a.colStart !== b.colStart) return a.colStart - b.colStart;
      return b.colSpan - a.colSpan;
    });

    const lanes = [];
    weekTasks.forEach(item => {
      let assignedRow = -1;
      for (let r = 0; r < lanes.length; r++) {
        if (item.colStart > lanes[r]) {
          assignedRow = r;
          break;
        }
      }
      if (assignedRow === -1) {
        assignedRow = lanes.length;
        lanes.push(item.colEnd);
      } else {
        lanes[assignedRow] = item.colEnd;
      }
      item.row = assignedRow + 1;
    });

    // 1. 背景マスHTML
    const daysBgHtml = week.map(day => {
      const isToday = day.ymd === todayYMD;
      const dayClass = day.dayOfWeek === 0 ? 'sunday' : (day.dayOfWeek === 6 ? 'saturday' : '');
      const otherClass = day.isCurrentMonth ? '' : 'other-month';
      return `
        <div class="month-cal-day-bg ${otherClass} ${isToday ? 'today-cell' : ''}"
             onclick="openAddTaskModal({ date: '${day.ymd}', team: '${currentTeamFilter !== 'all' ? currentTeamFilter : ''}' })"
             title="${day.ymd} にタスクを追加">
          <div class="month-cal-day-header">
            <span class="month-cal-day-num ${dayClass}">${day.dayNum}</span>
            <span class="day-quick-add-icon">＋</span>
          </div>
        </div>
      `;
    }).join('');

    // 2. イベントバーHTML
    const eventRowsCount = Math.max(lanes.length, 1);
    const eventsHtml = weekTasks.map(item => {
      const teamClass = `bg-${normalizeTeam(item.task.team)}`;
      const startCap = item.isStart ? 'is-start' : '';
      const endCap = item.isEnd ? 'is-end' : '';
      const isPeriod = Boolean(item.task.startDate && item.task.endDate && item.task.startDate !== item.task.endDate);
      const icon = (item.isStart && isPeriod) ? '📅 ' : '';
      return `
        <div class="month-cal-event-bar ${teamClass} ${startCap} ${endCap}"
             style="grid-column: ${item.colStart} / span ${item.colSpan}; grid-row: ${item.row};"
             onclick="event.stopPropagation(); openEditModalById('${item.task.id}')"
             title="${escapeHtml(item.task.name)} (${normalizeTeam(item.task.team)}班 / ${escapeHtml(item.task.assignee || '未定')})">
          <span class="event-title" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${icon}${escapeHtml(item.task.name)}
          </span>
        </div>
      `;
    }).join('');

    weeksHtml += `
      <div class="month-cal-week">
        <div class="month-cal-week-bg">
          ${daysBgHtml}
        </div>
        <div class="month-cal-week-events" style="grid-template-rows: repeat(${eventRowsCount}, minmax(22px, auto));">
          ${eventsHtml}
        </div>
      </div>
    `;
  });

  const html = `
    <div class="monthly-calendar-wrapper">
      <div class="month-cal-header-row">
        <div class="month-cal-header-cell sunday">日</div>
        <div class="month-cal-header-cell">月</div>
        <div class="month-cal-header-cell">火</div>
        <div class="month-cal-header-cell">水</div>
        <div class="month-cal-header-cell">木</div>
        <div class="month-cal-header-cell">金</div>
        <div class="month-cal-header-cell saturday">土</div>
      </div>
      <div class="month-cal-weeks-container">
        ${weeksHtml}
      </div>
    </div>
  `;

  grid.innerHTML = html;
}

// ユーティリティ: HTMLエスケープ
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
const monthSelectContainer = document.getElementById('monthSelectContainer');

// 📅 日付指定モード ⇔ 月指定モードのUI切り替え ＆ 自動連動
function toggleDateMode(isSpecificDate) {
  if (enableSpecificDateCheckbox) {
    enableSpecificDateCheckbox.checked = isSpecificDate;
  }
  if (specificDateContainer) {
    specificDateContainer.style.display = isSpecificDate ? 'flex' : 'none';
  }
  if (monthSelectContainer) {
    // 日付指定時は「開始月・終了月」UIを非表示にし、日付から自動計算
    monthSelectContainer.style.display = isSpecificDate ? 'none' : 'flex';
  }
  if (isSpecificDate) {
    syncMonthsFromDates();
  }
}

if (enableSpecificDateCheckbox) {
  enableSpecificDateCheckbox.addEventListener('change', (e) => {
    toggleDateMode(e.target.checked);
  });
}

// 日付から開始月・終了月を自動計算して反映
function syncMonthsFromDates() {
  const startDateVal = document.getElementById('taskStartDate')?.value;
  const endDateVal = document.getElementById('taskEndDate')?.value;
  const startMonthSelect = document.getElementById('taskStart');
  const endMonthSelect = document.getElementById('taskEnd');

  if (startDateVal) {
    const sDate = new Date(startDateVal);
    if (!isNaN(sDate.getTime()) && startMonthSelect) {
      startMonthSelect.value = String(sDate.getMonth() + 1);
    }
  }
  if (endDateVal) {
    const eDate = new Date(endDateVal);
    if (!isNaN(eDate.getTime()) && endMonthSelect) {
      endMonthSelect.value = String(eDate.getMonth() + 1);
    }
  } else if (startDateVal && endMonthSelect) {
    const sDate = new Date(startDateVal);
    if (!isNaN(sDate.getTime())) {
      endMonthSelect.value = String(sDate.getMonth() + 1);
    }
  }
}

// 🌟 タスク追加モーダル (直感作成 ＆ ユーザー情報自動補完)
window.openAddTaskModal = function(options = {}) {
  const form = document.getElementById('taskForm');
  if (form) form.reset();

  document.getElementById('taskId').value = '';
  currentTaskTodos = [];
  renderTodoList();

  // 👤 担当者自動補完: 保存済みのユーザー名
  const savedAuthor = localStorage.getItem('hope_user_author') || (typeof currentUser !== 'undefined' ? currentUser.author : '');
  const assigneeInput = document.getElementById('taskAssignee');
  if (assigneeInput) {
    assigneeInput.value = savedAuthor || '';
  }

  // 🛠️ 担当班自動補完: options.team ➔ hope_user_team ➔ 現在のフィルタ ➔ FRP
  const teamSelect = document.getElementById('taskTeam');
  if (teamSelect) {
    let targetTeam = options.team;
    if (!targetTeam) {
      const savedTeam = localStorage.getItem('hope_user_team') || (typeof currentUser !== 'undefined' ? currentUser.team : '');
      if (savedTeam) {
        targetTeam = savedTeam;
      } else if (currentTeamFilter !== 'all') {
        targetTeam = normalizeTeam(currentTeamFilter);
      } else {
        targetTeam = 'FRP';
      }
    }
    teamSelect.value = normalizeTeam(targetTeam);
  }

  // 📅 日付・期間自動補完
  const startDateInput = document.getElementById('taskStartDate');
  const endDateInput = document.getElementById('taskEndDate');
  const startMonthSelect = document.getElementById('taskStart');
  const endMonthSelect = document.getElementById('taskEnd');

  if (options.date) {
    // 📆 月間カレンダー日付マス目タップ時：日付指定モードON、月選択は非表示＆自動入力
    if (startDateInput) startDateInput.value = options.date;
    if (endDateInput) endDateInput.value = options.date;
    toggleDateMode(true);
  } else {
    // 🌐 年間ガントマス目タップ時 または 通常「＋タスク追加」ボタン時：月指定モード
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    toggleDateMode(false);

    const targetMonth = options.month ? String(options.month) : String(calMonth || (new Date().getMonth() + 1));
    if (startMonthSelect) startMonthSelect.value = targetMonth;
    if (endMonthSelect) endMonthSelect.value = targetMonth;
  }

  document.getElementById('modalTitle').textContent = 'タスク追加';
  document.getElementById('deleteModalBtn').style.display = 'none';
  if (taskModal) taskModal.classList.add('active');
  const taskNameInput = document.getElementById('taskName');
  if (taskNameInput) setTimeout(() => taskNameInput.focus(), 80);
};

// 「＋ タスク追加」ボタン
document.getElementById('addBtn')?.addEventListener('click', () => {
  openAddTaskModal();
});

// 日付選択時の月自動判定連動
document.getElementById('taskStartDate')?.addEventListener('change', (e) => {
  const endDateInput = document.getElementById('taskEndDate');
  if (e.target.value) {
    if (endDateInput && !endDateInput.value) {
      endDateInput.value = e.target.value;
    }
    syncMonthsFromDates();
  }
});

document.getElementById('taskEndDate')?.addEventListener('change', (e) => {
  if (e.target.value) {
    syncMonthsFromDates();
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
  toggleDateMode(hasSpecificDate);

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
  const assignee = document.getElementById('taskAssignee').value.trim() || '未定';

  const completedCount = currentTaskTodos.filter(t => t.completed).length;
  const calculatedProgress = currentTaskTodos.length > 0 
    ? Math.round((completedCount / currentTaskTodos.length) * 100) 
    : 0;

  const useSpecificDate = enableSpecificDateCheckbox ? enableSpecificDateCheckbox.checked : false;
  let startDate = '';
  let endDate = '';
  let start = Number(document.getElementById('taskStart').value);
  let end = Number(document.getElementById('taskEnd').value);

  if (useSpecificDate) {
    startDate = document.getElementById('taskStartDate').value;
    endDate = document.getElementById('taskEndDate').value || startDate;
    if (startDate) {
      const sDate = new Date(startDate);
      if (!isNaN(sDate.getTime())) start = sDate.getMonth() + 1;
    }
    if (endDate) {
      const eDate = new Date(endDate);
      if (!isNaN(eDate.getTime())) end = eDate.getMonth() + 1;
    }
  }

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

// 🌐 年間 ⇔ 📆 月間 ビュー切り替えイベント
document.getElementById('viewToggleYear')?.addEventListener('click', () => {
  currentViewMode = 'year';
  document.getElementById('viewToggleYear')?.classList.add('active');
  document.getElementById('viewToggleMonth')?.classList.remove('active');
  const monthNav = document.getElementById('monthNavToolbar');
  if (monthNav) monthNav.style.display = 'none';
  render();
});

document.getElementById('viewToggleMonth')?.addEventListener('click', () => {
  currentViewMode = 'month';
  document.getElementById('viewToggleMonth')?.classList.add('active');
  document.getElementById('viewToggleYear')?.classList.remove('active');
  const monthNav = document.getElementById('monthNavToolbar');
  if (monthNav) monthNav.style.display = 'flex';
  render();
});

// 📆 月間カレンダー ナビゲーション
document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
  calMonth--;
  if (calMonth < 1) {
    calMonth = 12;
    calYear--;
  }
  render();
});

document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
  calMonth++;
  if (calMonth > 12) {
    calMonth = 1;
    calYear++;
  }
  render();
});

document.getElementById('todayMonthBtn')?.addEventListener('click', () => {
  const d = new Date();
  calYear = d.getFullYear();
  calMonth = d.getMonth() + 1;
  render();
});
