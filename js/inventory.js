// js/inventory.js - 在庫・資材管理システム モジュール (紫完全禁止・スマートワンタップ増減)

const INVENTORY_STORAGE_KEY = 'hope_webapp_inventory';
const FIREBASE_INVENTORY_KEY = 'hope_webapp_inventory';

let currentInventoryItems = [];
let currentInventoryTeamFilter = 'all';
let currentInventoryQuery = '';
let firebaseDbInventoryRef = null;

// 初期サンプル在庫データ
const DEFAULT_INVENTORY_ITEMS = [
  { id: 'inv_1', name: 'カーボンクロス #200', teams: ['FRP'], qty: 3, unit: '巻', note: '部室左奥の資材棚2段目に保管。残り1巻で発注！' },
  { id: 'inv_2', name: 'エポキシ樹脂 (主剤)', teams: ['FRP', '翼'], qty: 12, unit: '本', note: '主桁・フランジ積層用。冷暗所に保管。' },
  { id: 'inv_3', name: 'スタイロフォーム 15mm', teams: ['翼'], qty: 8, unit: '枚', note: '翼リブ切り出し用。部室奥の大型ラック。' },
  { id: 'inv_4', name: 'デジタルサーボ DS3218', teams: ['電装', 'コクピ'], qty: 4, unit: '個', note: 'ラダー・エレベーター駆動用。予備2個あり。' },
  { id: 'inv_5', name: 'アルミ接合パイプ φ50', teams: ['コクピ'], qty: 2, unit: '本', note: 'コクピットフレーム用。' },
  { id: 'inv_6', name: '養生テープ (緑)', teams: ['運営'], qty: 5, unit: '個', note: '全体共有工具箱に保管。' }
];

// アイテムの所有班を配列として取得 (後方互換対応)
function getTeamsArray(item) {
  if (Array.isArray(item.teams) && item.teams.length > 0) return item.teams;
  const list = [];
  if (item.team) list.push(item.team === '運営 (共通)' ? '運営' : item.team);
  if (item.team2) list.push(item.team2 === '運営 (共通)' ? '運営' : item.team2);
  return list.length > 0 ? list : ['運営'];
}

// 初期ロード ＆ Firebase リアルタイム同期
function loadInventoryItems() {
  const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
  if (saved) {
    try {
      currentInventoryItems = JSON.parse(saved);
    } catch (e) {
      currentInventoryItems = DEFAULT_INVENTORY_ITEMS;
    }
  } else {
    currentInventoryItems = DEFAULT_INVENTORY_ITEMS;
  }

  // Firebase Realtime DB 同期初期化
  initInventoryFirebase();
}

function initInventoryFirebase() {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    try {
      firebaseDbInventoryRef = firebase.database().ref(FIREBASE_INVENTORY_KEY);
      firebaseDbInventoryRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && Array.isArray(val) && val.length > 0) {
          currentInventoryItems = val;
          localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(currentInventoryItems));
        } else {
          // 初回 Firebase 側へ初期データを登録
          firebaseDbInventoryRef.set(currentInventoryItems);
        }
        renderInventory();
      }, (err) => {
        console.warn("Firebase inventory error:", err);
      });
    } catch (e) {
      console.error("Firebase inventory init error:", e);
    }
  }
}

// 保存 (LocalStorage ＋ Firebase Realtime DB)
function saveInventoryItems(items) {
  currentInventoryItems = items;
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
  renderInventory();

  if (firebaseDbInventoryRef) {
    firebaseDbInventoryRef.set(items).catch(err => {
      console.error("Inventory DB write error:", err);
    });
  }
}

// 直接数値入力更新
window.updateInventoryQtyInput = function(id, valStr, event) {
  if (event) event.stopPropagation();
  const index = currentInventoryItems.findIndex(item => item.id === id);
  if (index >= 0) {
    const newQty = Math.max(0, parseInt(valStr, 10) || 0);
    currentInventoryItems[index].qty = newQty;
    saveInventoryItems(currentInventoryItems);
  }
};

// ワンタップ数量ステッパー変更 (＋ / ➖)
window.changeInventoryQty = function(id, delta, event) {
  if (event) event.stopPropagation();
  const index = currentInventoryItems.findIndex(item => item.id === id);
  if (index >= 0) {
    const newQty = Math.max(0, (currentInventoryItems[index].qty || 0) + delta);
    currentInventoryItems[index].qty = newQty;
    saveInventoryItems(currentInventoryItems);
  }
};

// 描画処理
function renderInventory() {
  const grid = document.getElementById('inventoryGrid');
  if (!grid) return;

  // フィルタリング
  let filtered = currentInventoryItems.filter(item => {
    const teams = getTeamsArray(item);
    if (currentInventoryTeamFilter !== 'all') {
      if (!teams.includes(currentInventoryTeamFilter)) return false;
    }
    // 検索クエリ
    if (currentInventoryQuery) {
      const q = currentInventoryQuery.toLowerCase();
      const matchName = (item.name || '').toLowerCase().includes(q);
      const matchNote = (item.note || '').toLowerCase().includes(q);
      const matchTeam = teams.some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchNote && !matchTeam) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #94a3b8; background: #ffffff; border-radius: 12px; border: 1px dashed var(--border-color);">
        <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
        <p style="font-size: 14px; font-weight: 600;">該当する資材・部品が見つかりません</p>
        <p style="font-size: 12px; margin-top: 4px;">右上の「＋ 資材を追加」ボタンから新規登録できます</p>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(item => {
    const teams = getTeamsArray(item);
    const badgesHtml = teams.map(tName => `<span class="badge badge-${tName}">${tName}班</span>`).join('');

    html += `
      <div class="inventory-card" onclick="openEditInventoryModal('${item.id}')">
        <div>
          <div class="inventory-card-header">
            <div class="inventory-item-name">${escapeHtml(item.name)}</div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
              ${badgesHtml}
            </div>
          </div>

          <!-- 数量入力 ＆ ワンタップステッパー -->
          <div class="inventory-qty-box" onclick="event.stopPropagation();">
            <div class="inventory-qty-display">
              <input type="number" class="inventory-qty-input" value="${item.qty}" min="0" onchange="updateInventoryQtyInput('${item.id}', this.value, event)" onclick="event.stopPropagation();">
              <span class="inventory-qty-unit">${escapeHtml(item.unit || '個')}</span>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="inventory-stepper-btn" onclick="changeInventoryQty('${item.id}', -1, event)" title="1減らす">−</button>
              <button type="button" class="inventory-stepper-btn" onclick="changeInventoryQty('${item.id}', 1, event)" title="1増やす">＋</button>
            </div>
          </div>
        </div>

        ${item.note ? `<div class="inventory-card-note">📝 ${escapeHtml(item.note)}</div>` : ''}
      </div>
    `;
  });

  grid.innerHTML = html;
}

// モーダル操作
const inventoryModal = document.getElementById('inventoryModal');

document.getElementById('addInventoryBtn')?.addEventListener('click', () => {
  document.getElementById('inventoryForm').reset();
  document.getElementById('inventoryId').value = '';
  document.querySelectorAll('input[name="inventoryTeamCheck"]').forEach(chk => { chk.checked = false; });
  // デフォルトで最初のチェックボックスをON
  const firstChk = document.querySelector('input[name="inventoryTeamCheck"]');
  if (firstChk) firstChk.checked = true;

  document.getElementById('inventoryModalTitle').textContent = '資材を追加';
  document.getElementById('deleteInventoryModalBtn').style.display = 'none';
  if (inventoryModal) inventoryModal.classList.add('active');
});

document.getElementById('closeInventoryModal')?.addEventListener('click', () => {
  if (inventoryModal) inventoryModal.classList.remove('active');
});

document.getElementById('cancelInventoryBtn')?.addEventListener('click', () => {
  if (inventoryModal) inventoryModal.classList.remove('active');
});

window.openEditInventoryModal = function(id) {
  const item = currentInventoryItems.find(i => i.id === id);
  if (!item || !inventoryModal) return;

  document.getElementById('inventoryId').value = item.id;
  document.getElementById('inventoryName').value = item.name;
  
  const teams = getTeamsArray(item);
  document.querySelectorAll('input[name="inventoryTeamCheck"]').forEach(chk => {
    chk.checked = teams.includes(chk.value);
  });

  document.getElementById('inventoryQty').value = item.qty;
  document.getElementById('inventoryUnit').value = item.unit || '個';
  document.getElementById('inventoryNote').value = item.note || '';

  document.getElementById('inventoryModalTitle').textContent = '資材の編集';
  document.getElementById('deleteInventoryModalBtn').style.display = 'inline-flex';
  inventoryModal.classList.add('active');
};

document.getElementById('deleteInventoryModalBtn')?.addEventListener('click', () => {
  const id = document.getElementById('inventoryId').value;
  if (!id) return;
  const newItems = currentInventoryItems.filter(i => i.id !== id);
  saveInventoryItems(newItems);
  if (inventoryModal) inventoryModal.classList.remove('active');
});

document.getElementById('inventoryForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('inventoryId').value || ('inv_' + Date.now());
  const name = document.getElementById('inventoryName').value.trim();

  const selectedTeams = Array.from(document.querySelectorAll('input[name="inventoryTeamCheck"]:checked')).map(chk => chk.value);
  const teams = selectedTeams.length > 0 ? selectedTeams : ['運営'];

  const qty = Number(document.getElementById('inventoryQty').value);
  const unit = document.getElementById('inventoryUnit').value;
  const note = document.getElementById('inventoryNote').value.trim();

  const existingIndex = currentInventoryItems.findIndex(i => i.id === id);
  const updatedItem = { id, name, teams, qty, unit, note };

  let newItems = [...currentInventoryItems];
  if (existingIndex >= 0) {
    newItems[existingIndex] = updatedItem;
  } else {
    newItems.unshift(updatedItem);
  }

  saveInventoryItems(newItems);
  if (inventoryModal) inventoryModal.classList.remove('active');
});

// イベントリスナー初期化
document.addEventListener('DOMContentLoaded', () => {
  loadInventoryItems();
  renderInventory();

  // フィルターボタン
  document.querySelectorAll('.inventory-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.inventory-filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentInventoryTeamFilter = e.target.dataset.team;
      renderInventory();
    });
  });

  // 検索インプット
  document.getElementById('inventorySearchInput')?.addEventListener('input', (e) => {
    currentInventoryQuery = e.target.value.trim();
    renderInventory();
  });
});
