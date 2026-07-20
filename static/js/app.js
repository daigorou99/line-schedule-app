// Global variables
let currentEventId = null;
let currentEventData = null;
let currentSortMode = "date"; // 'date' | 'score'

// DOM loaded event
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  if (path === "/" || path === "/index.html") {
    renderMyEvents();
    initDateTimeInputs();
  } else if (path.startsWith("/e/")) {
    const eventId = path.split("/e/")[1];
    if (eventId) {
      currentEventId = eventId;
      initEventPage(eventId);
    }
  }
});

// ----------------------------------------------------
// datetime-local 初期化・フォーマット関数
// ----------------------------------------------------
function initDateTimeInputs() {
  const inputs = document.querySelectorAll('.candidate-input[type="datetime-local"]');
  const now = new Date();
  // デフォルトで明日の19:00をセット
  now.setDate(now.getDate() + 1);
  now.setHours(19, 0, 0, 0);
  
  inputs.forEach((input, idx) => {
    const dateObj = new Date(now.getTime() + idx * 86400000); // 1日ずつずらす
    input.value = formatToISOString(dateObj);
  });
}

function formatToISOString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTimeLocalString(isoStr) {
  if (!isoStr) return "";
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr; // 変換できないテキストの場合はそのまま

  const dayOfWeekStr = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day}(${dayOfWeekStr}) ${hours}:${minutes}〜`;
}

// ----------------------------------------------------
// LocalStorage (マイイベント履歴管理)
// ----------------------------------------------------
function saveMyEvent(eventObj) {
  try {
    let events = JSON.parse(localStorage.getItem("my_events") || "[]");
    events = events.filter((e) => e.id !== eventObj.id);
    events.unshift({
      id: eventObj.id,
      title: eventObj.title,
      url: eventObj.url,
      created_at: new Date().toLocaleDateString("ja-JP"),
    });
    if (events.length > 20) events = events.slice(0, 20);
    localStorage.setItem("my_events", JSON.stringify(events));
  } catch (err) {
    console.error("Failed to save to localStorage", err);
  }
}

function renderMyEvents() {
  const container = document.getElementById("my-events-list");
  if (!container) return;

  try {
    const events = JSON.parse(localStorage.getItem("my_events") || "[]");
    if (events.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-400 italic">まだ作成したイベントはありません</p>`;
      return;
    }

    container.innerHTML = "";
    events.forEach((item) => {
      const a = document.createElement("a");
      a.href = item.url;
      a.className =
        "flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition group";
      a.innerHTML = `
        <div class="truncate pr-2">
          <p class="text-sm font-bold text-slate-700 group-hover:text-emerald-600 truncate">${escapeHtml(
            item.title
          )}</p>
          <p class="text-[10px] text-slate-400">作成日: ${item.created_at}</p>
        </div>
        <svg class="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      `;
      container.appendChild(a);
    });
  } catch (err) {
    console.error("Failed to read localStorage", err);
  }
}

// ----------------------------------------------------
// イベント作成ページ用ロジック (index.html)
// ----------------------------------------------------
function addCandidateRow() {
  const container = document.getElementById("candidates-container");
  if (!container) return;

  const div = document.createElement("div");
  div.className = "candidate-row flex items-center gap-2";
  
  // 明日の日時をデフォルトで設定
  const nextDate = new Date();
  const currentRows = container.querySelectorAll(".candidate-row").length;
  nextDate.setDate(nextDate.getDate() + 1 + currentRows);
  nextDate.setHours(19, 0, 0, 0);

  div.innerHTML = `
    <input type="datetime-local" value="${formatToISOString(nextDate)}"
      class="candidate-input w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-sans">
    <button type="button" onclick="removeCandidateRow(this)" class="p-2 text-slate-400 hover:text-rose-500 transition">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
    </button>
  `;
  container.appendChild(div);
}

function removeCandidateRow(btn) {
  const container = document.getElementById("candidates-container");
  const rows = container.querySelectorAll(".candidate-row");
  if (rows.length <= 1) {
    alert("候補日時は少なくとも1つ必要です。");
    return;
  }
  btn.closest(".candidate-row").remove();
}

async function handleCreateEvent(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = "作成中...";

  const title = document.getElementById("event-title").value.trim();
  const memo = document.getElementById("event-memo").value.trim();
  const inputs = document.querySelectorAll(".candidate-input");
  
  const candidates = Array.from(inputs)
    .map((input) => formatDateTimeLocalString(input.value.trim()))
    .filter((val) => val !== "");

  if (!title || candidates.length === 0) {
    alert("イベント名と候補日時を入力してください。");
    submitBtn.disabled = false;
    submitBtn.innerText = "URLを発行する";
    return;
  }

  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, memo, candidates }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "作成に失敗しました");
    }

    const data = await res.json();
    const fullUrl = `${window.location.origin}${data.url}`;

    saveMyEvent({ id: data.event_id, title: title, url: data.url });
    renderMyEvents();

    let shareText = `【${title}】日程調整のお願い\n`;
    if (memo) shareText += `\n${memo}\n`;
    shareText += `\n以下のリンクから空き状況のご回答をお願いします！\n${fullUrl}`;

    document.getElementById("share-text").value = shareText;
    document.getElementById("go-event-link").href = data.url;

    document.getElementById("result-modal").classList.remove("hidden");
    document.getElementById("result-modal").scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "URLを発行する";
  }
}

function copyShareText() {
  const textarea = document.getElementById("share-text");
  textarea.select();
  document.execCommand("copy");
  alert("メッセージをクリップボードにコピーしました！\nLINEやメール、各種SNS等に貼り付けて送ってください。");
}

// ----------------------------------------------------
// スケジュール調整・回答ページ用ロジック (event.html)
// ----------------------------------------------------

async function initEventPage(eventId) {
  await fetchEventData(eventId);
}

async function fetchEventData(eventId) {
  const loading = document.getElementById("loading-spinner");
  const errorCard = document.getElementById("error-card");
  const eventContent = document.getElementById("event-content");

  try {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) {
      throw new Error("イベント情報の読み込みに失敗しました");
    }
    const data = await res.json();
    currentEventData = data;

    renderEventData(data);

    loading.classList.add("hidden");
    eventContent.classList.remove("hidden");
  } catch (err) {
    loading.classList.add("hidden");
    errorCard.classList.remove("hidden");
    document.getElementById("error-message").innerText = err.message;
  }
}

function toggleSortMode(mode) {
  currentSortMode = mode;
  if (currentEventData) {
    renderEventData(currentEventData);
  }
}

function renderEventData(data) {
  const { event, candidates, responses, summary } = data;

  // ソートボタンのスタイル更新
  const sortDateBtn = document.getElementById("sort-date-btn");
  const sortScoreBtn = document.getElementById("sort-score-btn");
  if (currentSortMode === "score") {
    sortScoreBtn.className = "px-3 py-1.5 rounded-lg transition bg-white text-emerald-700 shadow-sm font-bold";
    sortDateBtn.className = "px-3 py-1.5 rounded-lg transition text-slate-500 hover:text-slate-700";
  } else {
    sortDateBtn.className = "px-3 py-1.5 rounded-lg transition bg-white text-emerald-700 shadow-sm font-bold";
    sortScoreBtn.className = "px-3 py-1.5 rounded-lg transition text-slate-500 hover:text-slate-700";
  }

  // タイトル＆メモ
  document.getElementById("event-title").innerText = event.title;
  const memoEl = document.getElementById("event-memo");
  if (event.memo) {
    memoEl.innerText = event.memo;
    memoEl.classList.remove("hidden");
  } else {
    memoEl.classList.add("hidden");
  }

  // 回答件数
  document.getElementById("response-count").innerText = `回答 ${responses.length}件`;

  // 最高スコアの計算
  let maxScore = -1;
  if (responses.length > 0) {
    Object.values(summary).forEach((s) => {
      if (s.score > maxScore) maxScore = s.score;
    });
  }

  // ソート適用（'date' または 'score'）
  let displayCandidates = [...candidates];
  if (currentSortMode === "score") {
    displayCandidates.sort((a, b) => {
      const scoreA = summary[String(a.id)]?.score || 0;
      const scoreB = summary[String(b.id)]?.score || 0;
      return scoreB - scoreA; // 降順
    });
  }

  // テーブルヘッダー (ユーザー名 + 編集/削除ボタン)
  const userHeadersContainer = document.getElementById("user-headers-container");
  userHeadersContainer.innerHTML = "";
  if (responses.length > 0) {
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center gap-4 overflow-x-auto";
    responses.forEach((resp) => {
      const th = document.createElement("div");
      th.className = "font-bold text-slate-700 min-w-[85px] text-center truncate flex flex-col items-center gap-1";
      const displayName = resp.affiliation
        ? `${resp.user_name} (${resp.affiliation})`
        : resp.user_name;
      
      th.innerHTML = `
        <span class="truncate max-w-[85px]" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
        <div class="flex items-center justify-center gap-1.5 text-[10px] font-normal text-slate-400">
          <button onclick="editResponse('${escapeHtml(resp.user_name)}')" title="編集" class="hover:text-emerald-600 transition">✏️</button>
          <button onclick="deleteResponse(${resp.id}, '${escapeHtml(resp.user_name)}', ${resp.has_pin})" title="削除" class="hover:text-rose-600 transition">🗑️</button>
        </div>
      `;
      wrapper.appendChild(th);
    });
    userHeadersContainer.appendChild(wrapper);
  } else {
    userHeadersContainer.innerText = "回答者";
  }

  // テーブルボディ (候補日時一覧)
  const tbody = document.getElementById("schedule-tbody");
  tbody.innerHTML = "";

  displayCandidates.forEach((cand) => {
    const candIdStr = String(cand.id);
    const sum = summary[candIdStr] || { ok: 0, maybe: 0, ng: 0, score: 0 };
    const isTopChoice = maxScore > 0 && sum.score === maxScore;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition";

    let okMaybeNgBadge = `
      <div class="flex items-center justify-center gap-1 text-[11px] font-bold">
        <span class="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">〇${sum.ok}</span>
        <span class="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">△${sum.maybe}</span>
        <span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">×${sum.ng}</span>
      </div>
    `;

    // ユーザーごとの〇△×アイコン
    let userAnswersHtml = "";
    if (responses.length > 0) {
      userAnswersHtml = `<div class="flex items-center gap-4 overflow-x-auto">`;
      responses.forEach((resp) => {
        const st = resp.answers[candIdStr];
        let symbol = "-";
        let colorClass = "text-slate-300";
        if (st === "ok") {
          symbol = "〇";
          colorClass = "text-emerald-600 font-bold";
        } else if (st === "maybe") {
          symbol = "△";
          colorClass = "text-amber-500 font-bold";
        } else if (st === "ng") {
          symbol = "×";
          colorClass = "text-rose-500 font-bold";
        }
        userAnswersHtml += `<span class="min-w-[85px] text-center block text-sm ${colorClass}">${symbol}</span>`;
      });
      userAnswersHtml += `</div>`;
    } else {
      userAnswersHtml = `<span class="text-slate-400 italic">まだ回答はありません</span>`;
    }

    // カレンダー追加アクションボタン
    const candTextEscaped = escapeHtml(cand.candidate_text);
    const calendarBtns = `
      <div class="flex items-center justify-center gap-1">
        <button onclick="openGoogleCalendar('${candTextEscaped}')" title="Googleカレンダーに追加"
          class="p-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 rounded transition text-xs flex items-center gap-1 font-medium px-2">
          <span>📅 Google</span>
        </button>
        <button onclick="downloadIcal('${candTextEscaped}')" title="iCal (.ics) ファイル保存"
          class="p-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded transition text-xs flex items-center gap-1 font-medium px-2">
          <span>📥 .ics</span>
        </button>
      </div>
    `;

    tr.innerHTML = `
      <td class="py-3 px-3">
        <div class="font-medium text-slate-800 flex items-center gap-1.5">
          ${isTopChoice ? '<span class="bg-amber-400 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">★1番人気</span>' : ""}
          <span>${candTextEscaped}</span>
        </div>
      </td>
      <td class="py-3 px-2 text-center">${okMaybeNgBadge}</td>
      <td class="py-3 px-2">${userAnswersHtml}</td>
      <td class="py-3 px-2 text-center">${calendarBtns}</td>
    `;
    tbody.appendChild(tr);
  });

  // コメント一覧
  const commentsContainer = document.getElementById("comments-list");
  commentsContainer.innerHTML = "";
  const responsesWithComments = responses.filter((r) => r.comment && r.comment.trim() !== "");
  if (responsesWithComments.length > 0) {
    responsesWithComments.forEach((r) => {
      const displayName = r.affiliation ? `${r.user_name} (${r.affiliation})` : r.user_name;
      const div = document.createElement("div");
      div.className = "bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-2";
      div.innerHTML = `
        <span class="font-bold text-slate-700 whitespace-nowrap">${escapeHtml(displayName)}:</span>
        <span class="text-slate-600">${escapeHtml(r.comment)}</span>
      `;
      commentsContainer.appendChild(div);
    });
  } else {
    commentsContainer.innerHTML = `<p class="text-slate-400 italic">コメントはありません</p>`;
  }

  renderResponseFormCandidates(candidates);
}

function renderResponseFormCandidates(candidates) {
  const container = document.getElementById("candidates-form-list");
  container.innerHTML = "";

  candidates.forEach((cand) => {
    const candId = cand.id;
    const div = document.createElement("div");
    div.className = "p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2";
    div.innerHTML = `
      <span class="text-sm font-medium text-slate-800">${escapeHtml(cand.candidate_text)}</span>
      <div class="flex items-center gap-2">
        <div class="status-option flex-1">
          <input type="radio" id="cand-${candId}-ok" name="cand-${candId}" value="ok" checked class="hidden">
          <label for="cand-${candId}-ok" class="ok-label cursor-pointer block text-center px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold transition">
            〇 可能
          </label>
        </div>
        <div class="status-option flex-1">
          <input type="radio" id="cand-${candId}-maybe" name="cand-${candId}" value="maybe" class="hidden">
          <label for="cand-${candId}-maybe" class="maybe-label cursor-pointer block text-center px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold transition">
            △ 微妙
          </label>
        </div>
        <div class="status-option flex-1">
          <input type="radio" id="cand-${candId}-ng" name="cand-${candId}" value="ng" class="hidden">
          <label for="cand-${candId}-ng" class="ng-label cursor-pointer block text-center px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold transition">
            × 不可
          </label>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function checkExistingName(name) {
  if (!currentEventData || !name.trim()) return;
  const nameTrimmed = name.trim();
  const existing = currentEventData.responses.find((r) => r.user_name === nameTrimmed);

  if (existing) {
    document.getElementById("user-affiliation").value = existing.affiliation || "";
    document.getElementById("user-comment").value = existing.comment || "";
    Object.entries(existing.answers).forEach(([candId, status]) => {
      const radio = document.getElementById(`cand-${candId}-${status}`);
      if (radio) radio.checked = true;
    });
  }
}

function editResponse(userName) {
  document.getElementById("user-name").value = userName;
  checkExistingName(userName);
  document.getElementById("form-card").scrollIntoView({ behavior: "smooth" });
}

async function deleteResponse(responseId, userName, hasPin) {
  let pinCode = "";
  if (hasPin) {
    pinCode = prompt(`「${userName}」さんの回答を削除します。\n作成時に設定したパスワード（暗証番号）を入力してください:`);
    if (pinCode === null) return; // キャンセル
  } else {
    if (!confirm(`「${userName}」さんの回答を削除してもよろしいですか？`)) return;
  }

  try {
    const res = await fetch(`/api/events/${currentEventId}/responses/${responseId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin_code: pinCode }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "削除に失敗しました");
    }

    alert("回答を削除しました。");
    await fetchEventData(currentEventId);
  } catch (err) {
    alert(err.message);
  }
}

async function handleRespond(e) {
  e.preventDefault();
  if (!currentEventId || !currentEventData) return;

  const submitBtn = document.getElementById("respond-submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = "送信中...";

  const userName = document.getElementById("user-name").value.trim();
  const affiliation = document.getElementById("user-affiliation").value.trim();
  const pinCode = document.getElementById("user-pin").value.trim();
  const comment = document.getElementById("user-comment").value.trim();

  const answers = {};
  currentEventData.candidates.forEach((cand) => {
    const selected = document.querySelector(`input[name="cand-${cand.id}"]:checked`);
    if (selected) {
      answers[cand.id] = selected.value;
    }
  });

  try {
    const res = await fetch(`/api/events/${currentEventId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_name: userName,
        affiliation,
        pin_code: pinCode,
        comment,
        answers,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "回答の送信に失敗しました");
    }

    alert("回答を送信しました！");
    await fetchEventData(currentEventId);

  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "回答を送信する";
  }
}

// ----------------------------------------------------
// カレンダー連携 (Google / iCal)
// ----------------------------------------------------
function parseCandidateDate(candidateText) {
  // 例: "8/10(土) 19:00〜" から Date オブジェクトを解析（年がない場合は今年）
  const now = new Date();
  const year = now.getFullYear();

  const match = candidateText.match(/(\d+)\/(\d+).*?(\d+):(\d+)/);
  if (!match) {
    // パースできない場合は現在の1時間後をセット
    const start = new Date(now.getTime() + 3600000);
    const end = new Date(start.getTime() + 7200000);
    return { start, end };
  }

  const month = parseInt(match[1], 10) - 1;
  const day = parseInt(match[2], 10);
  const hour = parseInt(match[3], 10);
  const min = parseInt(match[4], 10);

  const start = new Date(year, month, day, hour, min);
  const end = new Date(start.getTime() + 2 * 3600000); // 2時間イベントと仮定

  return { start, end };
}

function formatUtcForCalendar(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    '00Z'
  );
}

function openGoogleCalendar(candidateText) {
  if (!currentEventData) return;

  const eventTitle = currentEventData.event.title;
  const memo = currentEventData.event.memo || "";
  const pageUrl = window.location.href;
  const { start, end } = parseCandidateDate(candidateText);

  const datesStr = `${formatUtcForCalendar(start)}/${formatUtcForCalendar(end)}`;
  const details = `${memo}\n\n調整ページ: ${pageUrl}`;

  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    eventTitle
  )}&dates=${datesStr}&details=${encodeURIComponent(details)}`;

  window.open(gcalUrl, "_blank");
}

function downloadIcal(candidateText) {
  if (!currentEventData) return;

  const eventTitle = currentEventData.event.title;
  const memo = currentEventData.event.memo || "";
  const pageUrl = window.location.href;
  const { start, end } = parseCandidateDate(candidateText);

  const startUtc = formatUtcForCalendar(start);
  const endUtc = formatUtcForCalendar(end);
  const nowUtc = formatUtcForCalendar(new Date());

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Web Schedule App//JA",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${currentEventId}-${Date.now()}@schedule-app`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${eventTitle}`,
    `DESCRIPTION:${memo.replace(/\n/g, "\\n")} \\n\\n調整ページ: ${pageUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${eventTitle.replace(/[\/\\]/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyCurrentUrl() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    alert("URLをコピーしました！");
  }).catch(() => {
    const tempInput = document.createElement("input");
    tempInput.value = window.location.href;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    alert("URLをコピーしました！");
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m];
  });
}
