/**
 * home.js - ホームダッシュボード制御モジュール
 */

function renderHomeDashboard() {
  const homeGrid = document.getElementById('homeMonthlyTasksGrid');
  if (!homeGrid) return;
  homeGrid.innerHTML = '';
}
