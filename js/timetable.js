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

// 📝 ToDoテキストから日付を自動抽出（11/5, 11月5日, 1-1, 1.15 等）
function parseTodoDate(text, parentTask = null) {
  if (!text || typeof text !== 'string') return null;

  // 日付パターン: 11/5, 11月5日, 1-1, 1.15 などの月日表記
  const regex = /(\d{1,2})[/月\.\-](\d{1,2})日?/;
  const match = text.match(regex);
  if (!match) return null;

  const m = parseInt(match[1], 10);
  const d = parseInt(match[2], 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  // 年の自動補正 (鳥人間シーズン: 8月〜翌7月)
  let baseYear = calYear || new Date().getFullYear();
  if (parentTask && parentTask.startDate) {
    const pDate = new Date(parentTask.startDate);
    if (!isNaN(pDate.getTime())) {
      baseYear = pDate.getFullYear();
      const pMonth = pDate.getMonth() + 1;
      if (pMonth <= 7 && m >= 8) baseYear -= 1;
      if (pMonth >= 8 && m <= 7) baseYear += 1;
    }
  } else if (parentTask && parentTask.start) {
    const pStartMonth = Number(parentTask.start);
    if (pStartMonth >= 8 && m <= 7) baseYear += 1;
  } else {
    if (calMonth >= 8 && m <= 7) baseYear = calYear + 1;
  }

  const ymd = `${baseYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // タイトルから日付表記と前後の余白を除去してスッキリ表示（「テスト」の「テ」が巻き込まれないよう修正）
  const cleanTitle = text.replace(/(?:^|\s*)(\d{1,2})[/月\.\-](\d{1,2})日?(?:\s*|$)/, '').trim();

  return {
    date: ymd,
    month: m,
    day: d,
    year: baseYear,
    title: cleanTitle || text,
    originalText: text
  };
}

// 📋 カレンダーから直接ToDoの完了/未完了をワンクリック切り替え
window.toggleTodoCalendarItem = function(taskId, todoId) {
  const task = currentTasks.find(t => t.id === taskId);
  if (!task || !task.todos) return;

  const todo = task.todos.find(td => td.id === todoId);
  if (!todo) return;

  todo.completed = !todo.completed;

  // 進捗率を再計算
  const total = task.todos.length;
  const completed = task.todos.filter(t => t.completed).length;
  task.progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (typeof saveTasks === 'function') {
    saveTasks(currentTasks);
  }
  render();
};

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

    // 期間タスク（横帯バー）と単日タスク（1日ドット）を分離
    const isSingleDay = (t) => Boolean(t.startDate && (!t.endDate || t.startDate === t.endDate));
    const spanTasks = teamTasks.filter(t => !isSingleDay(t));
    const singleTasks = teamTasks.filter(t => isSingleDay(t));

    // 1. 期間タスク（長期製作バー）を描画
    spanTasks.forEach(task => {
      const startCol = monthToIndex(task.start);
      const endCol = monthToIndex(task.end) + 1;

      html += `
        <div class="gantt-span-bar bg-${normalizeTeam(task.team)}" 
             style="grid-column: ${startCol} / ${endCol};" 
             onclick="event.stopPropagation(); openEditModalById('${task.id}')">
          ${escapeHtml(task.name)}
          <div class="tooltip">
            <strong>${escapeHtml(task.name)}</strong><br>
            担当: ${escapeHtml(task.assignee || '未定')}<br>
            期間: ${task.startDate && task.endDate ? `${formatDateShort(task.startDate)}〜${formatDateShort(task.endDate)}` : `${task.start}月〜${task.end}月`}<br>
            備考: ${escapeHtml(task.note || 'なし')}
          </div>
        </div>
      `;
    });

    // 2. 1日しかない予定（単日ドット）を月ごとにグループ化して描画（縦積みを防ぎ横並びに集約）
    MONTHS.forEach(m => {
      const mTasks = singleTasks.filter(t => {
        if (t.startDate) {
          const d = new Date(t.startDate);
          return !isNaN(d.getTime()) && (d.getMonth() + 1) === m;
        }
        return t.start === m;
      });

      if (mTasks.length > 0) {
        const col = monthToIndex(m);
        html += `
          <div class="gantt-dots-container" style="grid-column: ${col} / span 1;">
            ${mTasks.map(task => {
              let dayText = '●';
              let dateText = `${m}月`;
              if (task.startDate) {
                const d = new Date(task.startDate);
                if (!isNaN(d.getTime())) {
                  dayText = d.getDate();
                  dateText = formatDateShort(task.startDate);
                }
              }
              return `
                <div class="gantt-dot-badge bg-${normalizeTeam(task.team)}" 
                     onclick="event.stopPropagation(); openEditModalById('${task.id}')">
                  <span class="dot-day-num">${dayText}</span>
                  <div class="tooltip">
                    <strong>${escapeHtml(task.name)}</strong><br>
                    日付: ${dateText}<br>
                    担当: ${escapeHtml(task.assignee || '未定')}<br>
                    備考: ${escapeHtml(task.note || 'なし')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
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
// 📋 【Notion/Linear風 月別スマートタイムライン】(無駄なバッジを削ぎ落とし時系列で整理)
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

  // 月番号から期首インデックスへの変換: 8月=1, 9月=2 ... 12月=5, 1月=6 ... 7月=12
  function monthToFiscalOrder(m) {
    const num = Number(m);
    return num >= 8 ? num - 7 : num + 5;
  }

  // 時系列ソート
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.startDate) {
      const aM = new Date(a.startDate).getMonth() + 1;
      return monthToFiscalOrder(aM) - monthToFiscalOrder(b.start);
    }
    if (b.startDate) {
      const bM = new Date(b.startDate).getMonth() + 1;
      return monthToFiscalOrder(a.start) - monthToFiscalOrder(bM);
    }
    const orderDiff = monthToFiscalOrder(a.start) - monthToFiscalOrder(b.start);
    if (orderDiff !== 0) return orderDiff;
    return monthToFiscalOrder(a.end) - monthToFiscalOrder(b.end);
  });

  // 月ごとにグループ化
  const groups = new Map();
  sortedTasks.forEach(task => {
    let m = task.start;
    let yearPrefix = '';
    if (task.startDate) {
      const d = new Date(task.startDate);
      if (!isNaN(d.getTime())) {
        m = d.getMonth() + 1;
        yearPrefix = `${d.getFullYear()}年 `;
      }
    }
    const groupKey = `${m}月`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { month: m, yearPrefix, tasks: [] });
    }
    groups.get(groupKey).tasks.push(task);
  });

  let html = `<div class="timeline-smart-container">`;

  groups.forEach((group, groupKey) => {
    html += `
      <div class="timeline-month-section">
        <div class="timeline-month-header">
          <div class="timeline-month-pill">${groupKey}</div>
        </div>
        <div class="timeline-items-list">
    `;

    group.tasks.forEach(task => {
      const teamName = normalizeTeam(task.team);
      const isPeriod = Boolean(task.startDate && task.endDate && task.startDate !== task.endDate);
      const dateText = (task.startDate && task.endDate)
        ? (isPeriod ? `${formatDateShort(task.startDate)} 〜 ${formatDateShort(task.endDate)}` : formatDateShort(task.startDate))
        : `${task.start}月 〜 ${task.end}月`;

      const todos = task.todos || [];
      const totalCount = todos.length;
      const completedCount = todos.filter(t => t.completed).length;
      const isAllCompleted = totalCount > 0 && completedCount === totalCount;
      const countLabel = totalCount > 0 ? `(${completedCount}/${totalCount})` : '';

      // 「全体」タブでの検索時のみ班バッジを表示。個別班選択時は余計なノイズを完全に削ぎ落とす！
      const showTeamBadge = (currentTeamFilter === 'all');

      html += `
        <div class="timeline-item team-item-${teamName}" onclick="openEditModalById('${task.id}')" title="クリックして詳細・ToDo">
          <div class="timeline-item-node"></div>
          <div class="timeline-item-date">${dateText}</div>
          <div class="timeline-item-body">
            <div class="timeline-item-title-row">
              <span class="timeline-item-title">${escapeHtml(task.name)}</span>
              ${showTeamBadge ? `<span class="badge badge-${teamName}" style="font-size: 10px; padding: 1px 6px;">${teamName}</span>` : ''}
            </div>
            ${task.note ? `<div class="timeline-item-note">📝 ${escapeHtml(task.note)}</div>` : ''}
          </div>
          <div class="timeline-item-meta">
            ${task.assignee ? `<span class="timeline-item-assignee">👤 ${escapeHtml(task.assignee)}</span>` : ''}
            ${isAllCompleted ? `<span class="timeline-item-status completed">✓ 完了 ${countLabel}</span>` : (totalCount > 0 ? `<span style="font-size: 11px; font-weight: 600; color: #64748b; font-feature-settings: 'tnum';">${countLabel}</span>` : '')}
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

  // 📋 各班選択時のみ、該当班のタスク内ToDoから日付指定のあるものを自動抽出
  const todoItems = [];
  if (currentTeamFilter !== 'all') {
    filteredTasks.forEach(task => {
      if (task.todos && Array.isArray(task.todos)) {
        task.todos.forEach(todo => {
          const parsed = parseTodoDate(todo.text, task);
          if (parsed) {
            todoItems.push({
              task,
              todo,
              date: parsed.date,
              title: parsed.title,
              isTodo: true
            });
          }
        });
      }
    });
  }

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
            isEnd,
            isTodo: false
          });
        }
      }
    });

    // 📋 この週に属するToDo予定を抽出（各班選択時のみ）
    todoItems.forEach(item => {
      if (item.date >= weekStart && item.date <= weekEnd) {
        const idx = week.findIndex(d => d.ymd === item.date);
        if (idx >= 0) {
          const colStart = idx + 1;
          weekTasks.push({
            task: item.task,
            todo: item.todo,
            title: item.title,
            isTodo: true,
            colStart: colStart,
            colSpan: 1,
            colEnd: colStart,
            isStart: true,
            isEnd: true
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

      // 📋 各班選択時のToDoアイテム表示
      if (item.isTodo) {
        const isDone = Boolean(item.todo.completed);
        return `
          <div class="month-cal-todo-bar ${teamClass} ${isDone ? 'is-completed' : ''}"
               style="grid-column: ${item.colStart} / span 1; grid-row: ${item.row};"
               onclick="event.stopPropagation(); window.toggleTodoCalendarItem('${item.task.id}', '${item.todo.id}')"
               title="${escapeHtml(item.task.name)}: ${escapeHtml(item.title)} (${isDone ? '完了' : '未完了'} - クリックで切替)">
            <span class="cal-todo-check">${isDone ? '☑' : '☐'}</span>
            <span class="cal-todo-title">${escapeHtml(item.title)}</span>
          </div>
        `;
      }

      // 通常タスクバー
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

// ✅ タスク内 ToDo リスト管理ロジック (インライン連続追加・他タスク一括コピー・エクセルコピペ展開)
let currentTaskTodos = [];

function renderTodoList(autoFocusInput = false) {
  const container = document.getElementById('todoListContainer');
  const progressText = document.getElementById('taskProgressValueText');
  if (!container) return;

  const totalCount = currentTaskTodos.length;
  const completedCount = currentTaskTodos.filter(t => t.completed).length;

  const countText = document.getElementById('taskTodoCountText');
  if (countText) {
    countText.textContent = totalCount > 0 ? `(${completedCount}/${totalCount})` : '';
  }

  // 1. 既存のToDoアイテム一覧
  const itemsHtml = currentTaskTodos.map((todo, idx) => `
    <div class="todo-item-row ${todo.completed ? 'completed' : ''}">
      <div class="todo-item-left">
        <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodoItem(${idx});" title="完了切り替え">
        <span class="todo-item-text" id="todoText_${idx}" onclick="startEditingTodo(${idx}, event)" title="クリックして編集">${escapeHtml(todo.text)}</span>
      </div>
      <button type="button" class="todo-delete-btn" onclick="deleteTodoItem(${idx})" title="削除">✕</button>
    </div>
  `).join('');

  // 2. 末尾に常に準備されたインライン入力行
  const inlineInputHtml = `
    <div class="todo-inline-add-row" id="todoInlineAddRow">
      <span class="todo-inline-add-icon">＋</span>
      <input type="text" id="inlineTodoInput" class="todo-inline-add-input" 
             placeholder="新しいToDoを入力... (Enterで次へ / エクセルコピペで一括追加)" 
             autocomplete="off">
    </div>
  `;

  container.innerHTML = itemsHtml + inlineInputHtml;

  // 3. インライン入力行のイベント初期化
  bindInlineTodoInput(autoFocusInput);
}

function bindInlineTodoInput(autoFocus = false) {
  const input = document.getElementById('inlineTodoInput');
  const container = document.getElementById('todoListContainer');
  if (!input) return;

  if (autoFocus) {
    input.focus();
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // ⌨️ Enterキーで連続追加
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val) {
        currentTaskTodos.push({
          id: 'todo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          text: val,
          completed: false
        });
        renderTodoList(true);
      }
    }
  });

  // 📋 エクセルやスプシからの改行コピペで一括展開！
  input.addEventListener('paste', (e) => {
    const pasteText = (e.clipboardData || window.clipboardData)?.getData('text');
    if (pasteText && pasteText.includes('\n')) {
      e.preventDefault();
      const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        lines.forEach((line, i) => {
          currentTaskTodos.push({
            id: 'todo_' + (Date.now() + i) + '_' + Math.random().toString(36).substring(2, 6),
            text: line,
            completed: false
          });
        });
        renderTodoList(true);
      }
    }
  });
}

// ✏️ ToDoテキストの直接インライン編集 (Notion風: クリックでinput化、Enter/blurで確定)
window.startEditingTodo = function(idx, event) {
  if (event) event.stopPropagation();
  const textSpan = document.getElementById(`todoText_${idx}`);
  if (!textSpan || !currentTaskTodos[idx]) return;

  const currentText = currentTaskTodos[idx].text;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-edit-input';
  input.value = currentText;

  let isCommitted = false;
  const commit = (newVal) => {
    if (isCommitted) return;
    isCommitted = true;
    const trimmed = newVal.trim();
    if (trimmed && trimmed !== currentText) {
      currentTaskTodos[idx].text = trimmed;
    }
    renderTodoList(false);
  };

  input.addEventListener('blur', () => {
    commit(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(input.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isCommitted = true;
      renderTodoList(false);
    }
  });

  textSpan.replaceWith(input);
  input.focus();
  input.select();
};

window.toggleTodoItem = function(idx) {
  if (currentTaskTodos[idx]) {
    currentTaskTodos[idx].completed = !currentTaskTodos[idx].completed;
    renderTodoList(false);
  }
};

window.deleteTodoItem = function(idx) {
  currentTaskTodos.splice(idx, 1);
  renderTodoList(false);
};

// 📋 他タスクからToDoをコピーする処理
function initCopyTodoFeature() {
  const copyBtn = document.getElementById('copyTodoFromTaskBtn');
  const selectBar = document.getElementById('copyTodoSelectBar');
  const sourceSelect = document.getElementById('copyTodoSourceSelect');
  const confirmBtn = document.getElementById('confirmCopyTodoBtn');
  const cancelBtn = document.getElementById('cancelCopyTodoBtn');

  if (!copyBtn || !selectBar || !sourceSelect) return;

  copyBtn.addEventListener('click', () => {
    const currentTaskId = document.getElementById('taskId')?.value;
    const tasksWithTodos = currentTasks.filter(t => t.id !== currentTaskId && t.todos && t.todos.length > 0);

    if (tasksWithTodos.length === 0) {
      alert('コピー元となるToDoを持ったタスクがまだありません。');
      return;
    }

    sourceSelect.innerHTML = tasksWithTodos.map(t => {
      const team = normalizeTeam(t.team);
      return `<option value="${t.id}">[${team}] ${escapeHtml(t.name)} (${t.todos.length}項目)</option>`;
    }).join('');

    selectBar.style.display = 'flex';
  });

  cancelBtn?.addEventListener('click', () => {
    selectBar.style.display = 'none';
  });

  confirmBtn?.addEventListener('click', () => {
    const selectedId = sourceSelect.value;
    const sourceTask = currentTasks.find(t => t.id === selectedId);
    if (!sourceTask || !sourceTask.todos) return;

    const cloned = sourceTask.todos.map((item, idx) => ({
      id: 'todo_' + (Date.now() + idx) + '_' + Math.random().toString(36).substring(2, 6),
      text: item.text,
      completed: false // チェックは外して複製
    }));

    if (currentTaskTodos.length > 0) {
      const overwrite = confirm(`現在のToDo（${currentTaskTodos.length}件）があります。\n「OK」で上書き、「キャンセル」で末尾に追加しますか？`);
      if (overwrite) {
        currentTaskTodos = cloned;
      } else {
        currentTaskTodos = [...currentTaskTodos, ...cloned];
      }
    } else {
      currentTaskTodos = cloned;
    }

    selectBar.style.display = 'none';
    renderTodoList(false);
  });
}

// 初期化時に実行
initCopyTodoFeature();

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
  const selectBar = document.getElementById('copyTodoSelectBar');
  if (selectBar) selectBar.style.display = 'none';
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

  const selectBar = document.getElementById('copyTodoSelectBar');
  if (selectBar) selectBar.style.display = 'none';

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
