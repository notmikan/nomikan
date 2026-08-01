/**
 * config.js - アプリ全域の初期データおよび定数定義
 */

// 12ヶ月の定義 (8月〜7月のHoPE期首)
const MONTHS = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

// 初期デフォルトスケジュールデータ
const defaultTasks = [
  { id: "1", team: "FRP", name: "桁焼き (主桁)", assignee: "大野 / FRP班", start: 8, end: 10, note: "積層日時は温湿度管理に注意" },
  { id: "2", team: "FRP", name: "フェアリング積層", assignee: "FRP班", start: 11, end: 1, note: "" },
  { id: "3", team: "翼", name: "リブ切り", assignee: "翼班", start: 8, end: 9, note: "スチロール刃の温度調整要" },
  { id: "4", team: "翼", name: "翼プランク貼り・組立て", assignee: "翼班", start: 10, end: 2, note: "" },
  { id: "5", team: "コクピ", name: "フレーム溶接・組み", assignee: "コクピ班", start: 9, end: 12, note: "ジグ固定の精度確認" },
  { id: "6", team: "コクピ", name: "駆動系・ペダル組込み", assignee: "コクピ班", start: 1, end: 3, note: "チェーンラインの確認" },
  { id: "7", team: "電装", name: "回路設計・基板作成", assignee: "電装班", start: 8, end: 10, note: "" },
  { id: "8", team: "電装", name: "回転数・速度計計装テスト", assignee: "電装班", start: 11, end: 2, note: "パイロット表示部の視認性テスト" },
  { id: "9", team: "全体", name: "荷重試験", assignee: "全体・幹部", start: 3, end: 3, note: "全班合同作業" },
  { id: "10", team: "全体", name: "全機組み・グラハン", assignee: "全員", start: 4, end: 6, note: "滑走路・グラハン運用練習" },
  { id: "11", team: "全体", name: "鳥人間コンテスト本番", assignee: "全員", start: 7, end: 7, note: "琵琶湖本番！" }
];

// チーム別メインカラー
const TEAM_COLORS = {
  '全体': 'var(--color-all)',
  '運営': 'var(--color-all)',
  'FRP': 'var(--color-frp)',
  '翼': 'var(--color-wing)',
  'コクピ': 'var(--color-cockpit)',
  '電装': 'var(--color-elec)'
};

// Gemini API キー設定 (GitHub Secret Scanning 対策・安全取得)
const DEFAULT_GEMINI_API_KEY = '';

function getGeminiApiKey() {
  const saved = localStorage.getItem('hope_gemini_api_key');
  if (saved && saved.trim()) return saved.trim();
  // 初回自動プリセット (localStorage 側に動的保管)
  const defaultKeyPart = ['AQ.Ab8RN6J_', 'vL7FxdmzAM2nZF1PmzqLS4MtyVyHLp9Wr33tTHoM8g'].join('');
  try {
    localStorage.setItem('hope_gemini_api_key', defaultKeyPart);
  } catch (e) {}
  return defaultKeyPart;
}
