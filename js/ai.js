// js/ai.js - Gemini 1.5 Flash AI 連動 ＆ ニュアンス判定(完了vs未完了ToDo自動生成)ハイブリッドエンジン

const FIREBASE_AI_LOGS_KEY = 'hope_webapp_ai_logs';
let firebaseDbAiLogsRef = null;

function initAiLogsFirebase() {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    try {
      firebaseDbAiLogsRef = firebase.database().ref(FIREBASE_AI_LOGS_KEY);
    } catch (e) {
      console.warn("AI Logs Firebase init error:", e);
    }
  }
}

function recordAiLog(logEntry) {
  const entry = {
    id: 'ailog_' + Date.now(),
    timestamp: Date.now(),
    ...logEntry
  };

  try {
    const saved = JSON.parse(localStorage.getItem(FIREBASE_AI_LOGS_KEY) || '[]');
    saved.unshift(entry);
    localStorage.setItem(FIREBASE_AI_LOGS_KEY, JSON.stringify(saved.slice(0, 50)));
  } catch (e) {}

  if (firebaseDbAiLogsRef) {
    firebaseDbAiLogsRef.push(entry).catch(err => console.error("AI Log write error:", err));
  }
}

/**
 * ニュアンス判定付きローカルルールベース判定 (完了 vs 進行中ToDo自動生成)
 */
function fallbackLocalMatching(postContent, teamTasks) {
  const content = postContent.toLowerCase();
  
  // 完了フラグ判定: 「おわった」「完了」「できた」「終」
  const isDone = content.includes("おわった") || content.includes("終わった") || content.includes("完了") || content.includes("できた") || content.includes("終了");

  // トピック抽出
  let topicTodo = "作業進行中";
  if (content.includes("ジャイロ") || content.includes("センサ")) topicTodo = "ジャイロセンサ制御・テスト";
  else if (content.includes("基板") || content.includes("回路")) topicTodo = "基板設計・回路作成";
  else if (content.includes("サンディング") || content.includes("積層")) topicTodo = "積層・表面処理";
  else if (content.includes("リブ") || content.includes("プランク")) topicTodo = "リブ切り出し・組立て";
  else if (content.includes("溶接") || content.includes("ペダル")) topicTodo = "フレーム溶接・加工";

  for (const task of teamTasks) {
    const taskName = task.name.toLowerCase();
    
    if (content.includes("基板") || content.includes("回路") || content.includes("pixhawk") || content.includes("ジャイロ") || content.includes("センサ")) {
      if (taskName.includes("基板") || taskName.includes("回路") || taskName.includes("電装") || taskName.includes("計装") || taskName.includes("親機")) {
        return { matched: true, taskId: task.id, todoText: topicTodo, isCompleted: isDone, confidence: 0.90 };
      }
    }
    if (content.includes("サンディング") || content.includes("積層") || content.includes("桁")) {
      if (taskName.includes("積層") || taskName.includes("桁") || taskName.includes("frp")) {
        return { matched: true, taskId: task.id, todoText: topicTodo, isCompleted: isDone, confidence: 0.90 };
      }
    }
    if (content.includes("リブ") || content.includes("プランク") || content.includes("翼")) {
      if (taskName.includes("リブ") || taskName.includes("翼") || taskName.includes("プランク")) {
        return { matched: true, taskId: task.id, todoText: topicTodo, isCompleted: isDone, confidence: 0.90 };
      }
    }
  }

  if (teamTasks.length > 0) {
    const t = teamTasks[0];
    return { matched: true, taskId: t.id, todoText: topicTodo, isCompleted: isDone, confidence: 0.85 };
  }

  return null;
}

/**
 * SNS投稿を Gemini AI でバックグラウンド解析する主関数
 */
async function analyzePostWithGemini(post) {
  if (!post || !post.content) return null;

  const team = post.team || '雑談';
  if (team === '雑談' || team === '全体' || !team) {
    return null;
  }

  const apiKey = getGeminiApiKey();

  let allTasks = (typeof currentTasks !== 'undefined' && Array.isArray(currentTasks) && currentTasks.length > 0) 
    ? currentTasks 
    : (typeof loadTasks === 'function' ? loadTasks() : (typeof defaultTasks !== 'undefined' ? defaultTasks : []));

  const teamTasks = allTasks.filter(t => {
    const tTeam = t.team === '運営' || t.team === '運営 (共通)' ? '運営' : t.team;
    return tTeam === team;
  });

  if (teamTasks.length === 0) {
    return null;
  }

  if (apiKey) {
    const targetTasksPrompt = teamTasks.map(t => `ID:${t.id}, Task:${t.name}`).join('\n');
    const promptText = `
あなたはサークル進捗管理AIです。
投稿本文の作業状況とニュアンス(完了報告か、苦戦・進行中か)を判定してください。

【該当班のタスク】
${targetTasksPrompt}

【判定ルール】
1. 「〜完了」「〜おわった」など完了報告 ➔ "isCompleted": true
2. 「〜むずい」「〜苦戦中」「〜動かす」「〜やってる」など進行中・課題報告 ➔ "isCompleted": false (ToDoを追加するがチェックは入れない)
3. todoText に具体的な作業名 (例: "ジャイロセンサ制御", "基板設計") を抽出してください。

【JSON形式で出力】
{
  "matched": true,
  "taskId": "${teamTasks[0]?.id || '1'}",
  "todoText": "作業工程名",
  "isCompleted": false,
  "confidence": 0.90
}
`;

    const candidateEndpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
    ];

    try {
      let response = null;
      for (const endpoint of candidateEndpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': apiKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${promptText}\n\n投稿: "${post.content}"` }] }]
            })
          });
          if (response.ok) break;
        } catch (e) {}
      }

      if (response && response.ok) {
        const data = await response.json();
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText) {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const result = JSON.parse(jsonMatch[0]);
              if (result && result.matched && result.taskId) {
                return processAiResult(result, post, team, teamTasks);
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  // 🛡️ ハイブリッド・フォールバック (完了 vs 進行中ニュアンス補完)
  const fallbackResult = fallbackLocalMatching(post.content, teamTasks);
  if (fallbackResult) {
    return processAiResult(fallbackResult, post, team, teamTasks);
  }

  return null;
}

function processAiResult(result, post, team, teamTasks) {
  const confidence = Number(result.confidence || 0.85);
  const isCompleted = typeof result.isCompleted === 'boolean' ? result.isCompleted : true;

  if (confidence >= 0.80) {
    const updatedInfo = window.addOrCheckTodoByAi(result.taskId, result.todoText, isCompleted);
    if (updatedInfo) {
      recordAiLog({
        postId: post.id,
        author: post.author,
        team: team,
        taskId: result.taskId,
        taskName: updatedInfo.taskName,
        todoText: result.todoText,
        isCompleted: isCompleted,
        confidence: confidence,
        actionType: isCompleted ? 'CHECK_TODO' : 'CREATE_PENDING_TODO'
      });

      return {
        status: 'AUTO_UPDATED',
        taskId: result.taskId,
        taskName: updatedInfo.taskName,
        todoText: result.todoText,
        isCompleted: isCompleted,
        progress: updatedInfo.progress
      };
    }
  }

  const targetTask = teamTasks.find(t => t.id == result.taskId) || teamTasks[0];
  return {
    status: 'PROPOSAL',
    taskId: result.taskId,
    taskName: targetTask ? targetTask.name : 'タスク',
    todoText: result.todoText,
    isCompleted: isCompleted,
    confidence: confidence
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initAiLogsFirebase();
});
