/**
 * js/members.js - 部員名簿DB & イベント参加メンバー管理モジュール
 * 幹部パスコード: HoPE1127 / 一般合言葉: HoPE1968 (旧: HoPE_1968)
 */

const MEMBERS_STORAGE_KEY = 'hope_webapp_members';
const FIREBASE_MEMBERS_KEY = 'hope_webapp_members';

// 初期デフォルト名簿データ (名前・本名・学年・班の構成)
const DEFAULT_HOPE_MEMBERS = [
  { id: 'm_1', name: 'たいき', realName: '', grade: '27G', team: '運営' },
];

let currentMembersList = [];
let firebaseDbMembersRef = null;
let currentTaskMembers = []; // 現在開いているタスクの参加メンバー [{ memberId, name, grade, team }]
let currentTaskIsEvent = false; // イベント（参加者を募集する）フラグ
let memberCandidateTeamFilter = 'all';

// 👑 幹部モード状態判定 (HoPE1127 で自動昇格)
function isCurrentUserAdmin() {
  const isAdminSaved = localStorage.getItem('hope_is_admin') === 'true';
  const passcode = localStorage.getItem('hope_app_passcode');
  return isAdminSaved || passcode === 'HoPE1127';
}

function setAdminMode(isAdmin) {
  localStorage.setItem('hope_is_admin', isAdmin ? 'true' : 'false');
  if (!isAdmin && localStorage.getItem('hope_app_passcode') === 'HoPE1127') {
    localStorage.setItem('hope_app_passcode', 'HoPE1968');
  }
  updateAdminUI();
  updateEventModeUI();
}

// メンバーデータの構造（id, name, realName, grade, team）を統一
function sanitizeMember(m) {
  if (!m) return null;
  return {
    id: m.id || ('m_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
    name: m.name || '',
    realName: m.realName || '', // 👑 幹部管理用: 本名 (DB手動入力または幹部画面で設定)
    grade: m.grade || '',
    team: m.team || '運営'
  };
}

// データベース同期初期化
function initMembersDatabase() {
  const saved = localStorage.getItem(MEMBERS_STORAGE_KEY);
  if (saved) {
    try {
      currentMembersList = JSON.parse(saved).map(sanitizeMember).filter(Boolean);
    } catch (e) {
      currentMembersList = [...DEFAULT_HOPE_MEMBERS];
    }
  } else {
    currentMembersList = [...DEFAULT_HOPE_MEMBERS];
  }

  // Firebase Realtime DB 同期
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0 && firebase.database) {
    if (firebase.auth && !firebase.auth().currentUser) return;
    try {
      if (!firebaseDbMembersRef) {
        firebaseDbMembersRef = firebase.database().ref(FIREBASE_MEMBERS_KEY);
      }
      firebaseDbMembersRef.off();
      firebaseDbMembersRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list = Array.isArray(val) ? val : Object.values(val);
          const sanitized = list.filter(Boolean).map(sanitizeMember);
          currentMembersList = sanitized;
          localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(currentMembersList));
        }

        // 🌟 各部員がアプリを開いたとき、自分のデータだけを個別ノードに保存（全体上書きは絶対にしない！）
        const myName = localStorage.getItem('hope_user_author');
        const myTeam = localStorage.getItem('hope_user_team') || '運営';
        if (myName && myName.trim()) {
          const cleanMyName = myName.trim();
          const matched = currentMembersList.find(m => m.name === cleanMyName);
          if (!matched) {
            const myMember = {
              id: 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              name: cleanMyName,
              realName: '',
              grade: localStorage.getItem('hope_user_grade') || '',
              team: myTeam
            };
            saveSingleMemberToDb(myMember);
          } else if (matched.grade) {
            localStorage.setItem('hope_user_grade', matched.grade);
          }
        }

        renderTaskMembersUI();
      }, (err) => {
        console.warn("Firebase members sync error:", err);
      });
    } catch (e) {
      console.error("Members DB init error:", e);
    }
  }
}

/**
 * 👤 部員の自動登録 ＆ マルチデバイス（PC/スマホ）自動同期 (個別キー保存)
 */
window.registerOrSyncMember = function(name, team = '運営') {
  if (!name) return null;
  const cleanName = name.trim();
  if (!cleanName) return null;

  let existing = currentMembersList.find(m => m.name === cleanName);

  if (existing) {
    if (team && existing.team !== team) {
      existing.team = team;
      saveSingleMemberToDb(existing);
    }
    return existing;
  } else {
    const newMember = {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      realName: '',
      grade: '',
      team: team || '運営'
    };
    saveSingleMemberToDb(newMember);
    renderTaskMembersUI();
    return newMember;
  }
};

/**
 * 🛡️ 単一メンバーの個別保存 (全体上書きを廃止し、対象メンバーのノードのみ安全に保存)
 */
function saveSingleMemberToDb(member) {
  if (!member || !member.id) return;
  const sanitized = sanitizeMember(member);

  const idx = currentMembersList.findIndex(m => m.id === sanitized.id);
  if (idx >= 0) {
    currentMembersList[idx] = sanitized;
  } else {
    currentMembersList.push(sanitized);
  }
  localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(currentMembersList));

  if (!firebaseDbMembersRef && typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0 && firebase.database) {
    try {
      firebaseDbMembersRef = firebase.database().ref(FIREBASE_MEMBERS_KEY);
    } catch (e) {
      console.warn("Could not get firebaseDbMembersRef:", e);
    }
  }

  if (firebaseDbMembersRef) {
    firebaseDbMembersRef.child(sanitized.id).set(sanitized).catch(err => {
      console.error("Save single member error:", err);
    });
  }
}

function saveMembersToDb(newMembers) {
  // 互換用ラッパー: 個別に保存
  if (Array.isArray(newMembers)) {
    newMembers.forEach(m => saveSingleMemberToDb(m));
  }
}

// タスクモーダル開閉時のステート初期化
window.initTaskMembersState = function(taskOrMembers = {}, isEventFlag = false) {
  if (Array.isArray(taskOrMembers)) {
    currentTaskMembers = JSON.parse(JSON.stringify(taskOrMembers));
    currentTaskIsEvent = Boolean(isEventFlag);
  } else if (taskOrMembers && typeof taskOrMembers === 'object') {
    currentTaskMembers = taskOrMembers.members ? JSON.parse(JSON.stringify(taskOrMembers.members)) : [];
    currentTaskIsEvent = Boolean(taskOrMembers.isEvent);
  } else {
    currentTaskMembers = [];
    currentTaskIsEvent = false;
  }

  const isEventCheck = document.getElementById('taskIsEventCheckbox');
  if (isEventCheck) {
    isEventCheck.checked = currentTaskIsEvent;
  }

  updateEventModeUI();
};

window.getTaskMembersState = function() {
  return [...currentTaskMembers];
};

window.getTaskIsEventState = function() {
  const isEventCheck = document.getElementById('taskIsEventCheckbox');
  return isEventCheck ? isEventCheck.checked : currentTaskIsEvent;
};

// イベント（参加者を募集する）モードのUI開閉連動
function updateEventModeUI() {
  const isAdm = isCurrentUserAdmin();
  const toggleWrap = document.getElementById('taskEventModeToggleWrap');
  const isEventCheck = document.getElementById('taskIsEventCheckbox');
  const membersSection = document.getElementById('taskMembersSection');

  const isEvent = isEventCheck ? isEventCheck.checked : currentTaskIsEvent;

  // 幹部のみ「参加者を募集する（イベント）」チェックボックスを操作可能
  if (toggleWrap) {
    toggleWrap.style.display = isAdm ? 'block' : 'none';
  }

  // チェックがONのイベントのみ、参加メンバー枠を表示
  if (membersSection) {
    membersSection.style.display = isEvent ? 'block' : 'none';
  }

  if (isEvent) {
    renderTaskMembersUI();
  }
}

// 👥 タスク詳細モーダル内 参加メンバーUI描画
function renderTaskMembersUI() {
  const countBadge = document.getElementById('taskMemberCountBadge');
  const selectedWrap = document.getElementById('taskSelectedMembersWrap');
  const adminAddArea = document.getElementById('taskAdminAddMemberArea');
  const selfJoinBar = document.getElementById('taskSelfJoinBar');
  const selfJoinBtn = document.getElementById('toggleSelfJoinBtn');
  const availableList = document.getElementById('taskAvailableMembersList');

  if (!selectedWrap) return;

  const count = currentTaskMembers.length;
  if (countBadge) countBadge.textContent = `(${count}名)`;

  // 1. 選択済みメンバーチップの描画
  if (count === 0) {
    selectedWrap.innerHTML = `<span style="font-size: 12px; color: #94a3b8; font-weight: 500;">なし</span>`;
  } else {
    selectedWrap.innerHTML = currentTaskMembers.map((m, idx) => {
      const isAdm = isCurrentUserAdmin();
      const removeBtn = isAdm ? `<button type="button" class="member-chip-remove" onclick="removeMemberFromTask(${idx})" title="解除">✕</button>` : '';
      const gradeText = m.grade ? `(${m.grade})` : '';
      return `
        <div class="member-chip">
          <span>${escapeHtml(m.name)}${gradeText}</span>
          ${removeBtn}
        </div>
      `;
    }).join('');
  }

  const isAdmin = isCurrentUserAdmin();

  // 2. 幹部モードの場合：参加者追加エリアを表示
  if (isAdmin) {
    if (adminAddArea) adminAddArea.style.display = 'block';
    if (selfJoinBar) selfJoinBar.style.display = 'none';

    if (availableList) {
      // 既に参加しているメンバーIDを除外
      const joinedIds = new Set(currentTaskMembers.map(m => m.memberId || m.id));
      const joinedNames = new Set(currentTaskMembers.map(m => m.name));

      let filteredCandidates = currentMembersList.filter(m => !joinedIds.has(m.id) && !joinedNames.has(m.name));

      if (memberCandidateTeamFilter !== 'all') {
        filteredCandidates = filteredCandidates.filter(m => m.team === memberCandidateTeamFilter);
      }

      if (filteredCandidates.length === 0) {
        availableList.innerHTML = `<span style="font-size: 11px; color: #94a3b8;">追加可能なメンバーはいません</span>`;
      } else {
        availableList.innerHTML = filteredCandidates.map(m => `
          <button type="button" class="avail-member-chip" onclick="addMemberToTask('${m.id}')">
            ＋ ${escapeHtml(m.name)}${m.grade ? `(${m.grade})` : ''}
          </button>
        `).join('');
      }
    }
  } else {
    // 3. 一般部員モードの場合：自分を参加者に追加/解除するボタンを表示
    if (adminAddArea) adminAddArea.style.display = 'none';
    if (selfJoinBar) selfJoinBar.style.display = 'block';

    const currentUserName = (typeof currentUser !== 'undefined' && currentUser.author) 
      ? currentUser.author 
      : localStorage.getItem('hope_user_author') || '';

    const isJoined = currentTaskMembers.some(m => m.name === currentUserName);

    if (selfJoinBtn) {
      if (isJoined) {
        selfJoinBtn.className = 'btn-leave-event';
        selfJoinBtn.innerHTML = `<span>✔ 参加予定</span>`;
      } else {
        selfJoinBtn.className = 'btn-join-event';
        selfJoinBtn.innerHTML = `<span>参加する</span>`;
      }
    }
  }
}

// メンバーをタスクに追加 (幹部操作)
window.addMemberToTask = function(memberId) {
  const member = currentMembersList.find(m => m.id === memberId);
  if (!member) return;

  currentTaskMembers.push({
    memberId: member.id,
    name: member.name,
    grade: member.grade || '',
    team: member.team || '運営'
  });
  renderTaskMembersUI();
  if (typeof triggerTaskAutoSave === 'function') triggerTaskAutoSave(true);
};

// メンバーをタスクから解除 (幹部操作)
window.removeMemberFromTask = function(idx) {
  currentTaskMembers.splice(idx, 1);
  renderTaskMembersUI();
  if (typeof triggerTaskAutoSave === 'function') triggerTaskAutoSave(true);
};

// 一般部員による自発エントリー・キャンセル切り替え
function toggleSelfJoinTask() {
  const currentUserName = (typeof currentUser !== 'undefined' && currentUser.author) 
    ? currentUser.author 
    : localStorage.getItem('hope_user_author') || '';
  const currentUserTeam = (typeof currentUser !== 'undefined' && currentUser.team) 
    ? currentUser.team 
    : localStorage.getItem('hope_user_team') || '運営';

  if (!currentUserName) {
    alert('名前が設定されていません');
    return;
  }

  const existingIdx = currentTaskMembers.findIndex(m => m.name === currentUserName);
  if (existingIdx >= 0) {
    // キャンセル
    currentTaskMembers.splice(existingIdx, 1);
  } else {
    // 参加追加 (名簿にリンクがあれば学年等を取得)
    const linked = currentMembersList.find(m => m.name === currentUserName);
    currentTaskMembers.push({
      memberId: linked ? linked.id : ('temp_' + Date.now()),
      name: currentUserName,
      grade: linked ? linked.grade : '',
      team: currentUserTeam
    });
  }
  renderTaskMembersUI();
  if (typeof triggerTaskAutoSave === 'function') triggerTaskAutoSave(true);
}

// 📋 名簿テキストをクリップボードにコピー
function copyTaskMemberListText() {
  const taskNameInput = document.getElementById('taskName');
  const taskName = taskNameInput ? taskNameInput.value.trim() : 'イベント';
  const copyBtn = document.getElementById('copyTaskMemberListBtn');

  if (currentTaskMembers.length === 0) {
    alert('参加メンバーがまだ登録されていません');
    return;
  }

  const lines = currentTaskMembers.map(m => {
    const meta = [m.team, m.grade].filter(Boolean).join('/');
    return `・${m.name} ${meta ? `(${meta})` : ''}`;
  });

  const text = `【${taskName} 参加メンバー（計${currentTaskMembers.length}名）】\n` + lines.join('\n');

  navigator.clipboard.writeText(text).then(() => {
    if (copyBtn) {
      const orig = copyBtn.innerHTML;
      copyBtn.innerHTML = '✔ コピー完了';
      setTimeout(() => { copyBtn.innerHTML = orig; }, 1800);
    }
  }).catch(() => {
    prompt('以下のテキストをコピーしてください:', text);
  });
}

// 👑 幹部UI・名簿リンク管理モーダル制御
function updateAdminUI() {
  const isAdmin = isCurrentUserAdmin();
  const modalAdminArea = document.getElementById('modalAdminArea');
  const savedPass = localStorage.getItem('hope_app_passcode');
  const isAuthSaved = savedPass === 'HoPE1968' || savedPass === 'HoPE_1968' || savedPass === 'HoPE1127';

  // 認証済み かつ 幹部 の場合のみ、プロフィール設定モーダル内に「👥 部員名簿リンク管理」を表示
  if (modalAdminArea) {
    modalAdminArea.style.display = (isAuthSaved && isAdmin) ? 'block' : 'none';
  }
}
window.updateAdminUI = updateAdminUI;
window.updateEventModeUI = updateEventModeUI;

function openMemberLinkModal() {
  const modal = document.getElementById('memberLinkModal');
  const container = document.getElementById('memberLinkTableContainer');
  if (!modal || !container) return;

  renderMemberManagementTable();

  modal.classList.add('active');
  modal.style.display = 'flex';
}

function renderMemberManagementTable() {
  const container = document.getElementById('memberLinkTableContainer');
  if (!container) return;

  if (currentMembersList.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">
        登録部員はいません（部員が入室すると自動でここに追加されます）
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
      <thead style="background: #f1f5f9; color: #475569; position: sticky; top: 0; z-index: 2;">
        <tr>
          <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">部員名</th>
          <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">本名 (DB管理用)</th>
          <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">学年</th>
          <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">所属班</th>
          <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: right;">操作</th>
        </tr>
      </thead>
      <tbody>
        ${currentMembersList.map((m, idx) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">${escapeHtml(m.name)}</td>
            <td style="padding: 6px 10px;">
              <input type="text" value="${escapeHtml(m.realName || '')}" placeholder="例: 佐藤 大輝" 
                     onchange="updateMemberRealName(${idx}, this.value)"
                     style="width: 100px; padding: 3px 6px; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 4px;">
            </td>
            <td style="padding: 6px 10px;">
              <input type="text" value="${escapeHtml(m.grade || '')}" placeholder="例: 2年 / 27G" 
                     onchange="updateMemberGrade(${idx}, this.value)"
                     style="width: 75px; padding: 3px 6px; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 4px;">
            </td>
            <td style="padding: 6px 10px;">
              <select onchange="updateMemberTeam(${idx}, this.value)" style="font-size: 11px; padding: 3px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">
                <option value="運営" ${m.team === '運営' ? 'selected' : ''}>運営</option>
                <option value="FRP" ${m.team === 'FRP' ? 'selected' : ''}>FRP</option>
                <option value="翼" ${m.team === '翼' ? 'selected' : ''}>翼</option>
                <option value="コクピ" ${m.team === 'コクピ' ? 'selected' : ''}>コクピ</option>
                <option value="電装" ${m.team === '電装' ? 'selected' : ''}>電装</option>
              </select>
            </td>
            <td style="padding: 6px 10px; text-align: right;">
              <button type="button" onclick="deleteMemberFromDb(${idx})" 
                      style="background: none; border: none; color: #ef4444; font-size: 12px; cursor: pointer; padding: 2px 6px;" title="名簿から削除">
                🗑
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// 幹部による名簿更新 (対象メンバーのみ個別保存)
window.updateMemberRealName = function(idx, val) {
  if (currentMembersList[idx]) {
    currentMembersList[idx].realName = val.trim();
    saveSingleMemberToDb(currentMembersList[idx]);
  }
};

window.updateMemberGrade = function(idx, val) {
  if (currentMembersList[idx]) {
    currentMembersList[idx].grade = val.trim();
    saveSingleMemberToDb(currentMembersList[idx]);
    renderTaskMembersUI();
  }
};

window.updateMemberTeam = function(idx, val) {
  if (currentMembersList[idx]) {
    currentMembersList[idx].team = val;
    saveSingleMemberToDb(currentMembersList[idx]);
    renderTaskMembersUI();
  }
};

window.deleteMemberFromDb = function(idx) {
  const member = currentMembersList[idx];
  if (!member) return;
  if (confirm(`「${member.name}」を名簿から削除しますか？`)) {
    const memberId = member.id;
    currentMembersList.splice(idx, 1);
    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(currentMembersList));

    if (!firebaseDbMembersRef && typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0 && firebase.database) {
      try {
        firebaseDbMembersRef = firebase.database().ref(FIREBASE_MEMBERS_KEY);
      } catch (e) {
        console.warn("Could not get firebaseDbMembersRef:", e);
      }
    }

    if (firebaseDbMembersRef && memberId) {
      firebaseDbMembersRef.child(memberId).remove().catch(err => console.error("Remove member error:", err));
    }
    renderMemberManagementTable();
    renderTaskMembersUI();
  }
};

// 幹部による名簿新規追加（手動追加フォーム用）
window.addNewMemberByAdmin = function(name, team, grade, realName = '') {
  if (!name || !name.trim()) return;
  const newMember = {
    id: 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: name.trim(),
    realName: realName ? realName.trim() : '',
    grade: grade ? grade.trim() : '',
    team: team || '運営'
  };
  saveSingleMemberToDb(newMember);
  renderMemberManagementTable();
  renderTaskMembersUI();
};

function closeMemberLinkModal() {
  const modal = document.getElementById('memberLinkModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

// イベントリスナー初期化
document.addEventListener('DOMContentLoaded', () => {
  initMembersDatabase();
  updateAdminUI();

  // タスクイベントモード切替チェックボックス (幹部操作)
  document.getElementById('taskIsEventCheckbox')?.addEventListener('change', () => {
    updateEventModeUI();
    if (typeof triggerTaskAutoSave === 'function') triggerTaskAutoSave(true);
  });

  // 名簿リンク管理モーダル開閉
  document.getElementById('openMemberLinkModalBtn')?.addEventListener('click', () => {
    const profileModal = document.getElementById('userProfileModal');
    if (profileModal) profileModal.classList.remove('active');
    openMemberLinkModal();
  });
  document.getElementById('closeMemberLinkModalBtn')?.addEventListener('click', closeMemberLinkModal);
  document.getElementById('closeMemberLinkModalBottomBtn')?.addEventListener('click', closeMemberLinkModal);

  // 幹部による手動部員追加ボタン
  document.getElementById('adminAddMemberSubmitBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('adminNewMemberName');
    const gradeInput = document.getElementById('adminNewMemberGrade');
    const teamInput = document.getElementById('adminNewMemberTeam');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) {
      alert('部員名を入力してください');
      nameInput.focus();
      return;
    }
    addNewMemberByAdmin(name, teamInput ? teamInput.value : '運営', gradeInput ? gradeInput.value : '');
    nameInput.value = '';
    if (gradeInput) gradeInput.value = '';
  });

  // 自発参加ボタン
  document.getElementById('toggleSelfJoinBtn')?.addEventListener('click', toggleSelfJoinTask);

  // 名簿テキストコピーボタン
  document.getElementById('copyTaskMemberListBtn')?.addEventListener('click', copyTaskMemberListText);

  // 候補メンバー班別フィルタータブ切り替え
  document.querySelectorAll('#taskMemberTeamTabs .tab-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#taskMemberTeamTabs .tab-chip').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      memberCandidateTeamFilter = e.target.dataset.mteam;
      renderTaskMembersUI();
    });
  });
});
