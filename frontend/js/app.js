/* ═══════════════════════════════════════════════
   SENTIX — Cyberpunk Frontend Logic
═══════════════════════════════════════════════ */

const API = "";

// ── Chart instances ───────────────────────────────────────────────────────────
let charts = { sent: null, emotion: null, keyword: null };

// ── Example texts ─────────────────────────────────────────────────────────────
const EXAMPLES = {
  positive: `I absolutely loved this product! The quality is outstanding and it exceeded all my expectations. The customer service team was incredibly helpful and responded within minutes. Shipping was fast and the packaging was beautiful. I've already recommended it to all my friends and family. This is definitely the best purchase I've made this year. Five stars without hesitation!`,
  negative: `This was a complete disaster from start to finish. The product arrived broken and the description was totally misleading. When I contacted customer support, they were rude and unhelpful. I waited three weeks for a replacement that never arrived. The quality is terrible and it fell apart after just one use. I want my money back immediately. I would give zero stars if I could. Absolutely disgusting service.`,
  mixed:    `The new smartphone has some impressive features, including a stunning display and excellent battery life. However, the camera performance is disappointing compared to competitors at this price point. The software is intuitive and responsive, which makes daily use a pleasure. On the downside, the build quality feels cheap and the phone gets warm during extended use. Overall, it's a decent device with room for improvement.`,
  news:     `Global markets showed mixed signals today as investors weighed strong corporate earnings against persistent inflation concerns. Technology stocks rallied sharply after several major companies reported better-than-expected profits, while energy shares declined amid falling oil prices. Economists warned that while employment figures remain robust, consumer confidence has started to slip. Central banks are expected to maintain cautious monetary policies heading into the next quarter.`,
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function setStatus(state, text) {
  document.getElementById("statusLed").className   = `status-led ${state}`;
  document.getElementById("statusLabel").textContent = text;
}

function addLog(text, cls = "") {
  const log   = document.getElementById("sysLog");
  const lines = log.querySelectorAll(".log-line");
  // Remove blink from last line
  lines.forEach(l => l.classList.remove("blink"));
  // Remove oldest if too many
  if (lines.length >= 6) lines[0].remove();
  const d = document.createElement("div");
  d.className   = `log-line ${cls}`;
  d.textContent = `> ${text}`;
  log.appendChild(d);
}

function showToast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className   = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

function escapeHtml(t) {
  return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll(".cyber-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`tab-${tab}`).classList.add("active");
}

// ── Char counter ──────────────────────────────────────────────────────────────
document.getElementById("textInput").addEventListener("input", function () {
  const c = this.value.length;
  const w = this.value.trim() ? this.value.trim().split(/\s+/).length : 0;
  document.getElementById("charCount").textContent = `${c} CHARS / ${w} WORDS`;
});

// ── Example loader ────────────────────────────────────────────────────────────
function loadExample(key) {
  const ta = document.getElementById("textInput");
  ta.value = EXAMPLES[key];
  ta.dispatchEvent(new Event("input"));
  const textTab = document.querySelector('[data-tab="text"]');
  switchTab("text", textTab);
  addLog(`LOADED EXAMPLE: ${key.toUpperCase()}`, "active");
}

// ── Main analyse ──────────────────────────────────────────────────────────────
async function analyse() {
  const activeTab = document.querySelector(".cyber-tab.active").dataset.tab;
  let payload, endpoint;

  if (activeTab === "text") {
    const text = document.getElementById("textInput").value.trim();
    if (!text) { showToast("// ERROR: NO INPUT DATA"); return; }
    payload  = { text };
    endpoint = "/api/analyze";
  } else {
    const url = document.getElementById("urlInput").value.trim();
    if (!url)  { showToast("// ERROR: NO TARGET URL"); return; }
    payload  = { url };
    endpoint = "/api/url";
  }

  // Set loading state
  const btn = document.getElementById("analyseBtn");
  document.getElementById("btnText").classList.add("hidden");
  document.getElementById("btnSpinner").classList.remove("hidden");
  btn.disabled = true;
  setStatus("loading", "PROCESSING");
  addLog("INITIALISING ANALYSIS...", "active");

  try {
    addLog("EMBEDDING INPUT DATA...", "active");
    const res  = await fetch(API + endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) { showToast(`// ERROR: ${data.error}`); addLog(`ERROR: ${data.error}`, "err"); return; }

    addLog("RUNNING VADER ENGINE...", "active");
    await new Promise(r => setTimeout(r, 120));
    addLog("COMPUTING TF-IDF SCORES...", "active");
    await new Promise(r => setTimeout(r, 80));

    renderResults(data);

    addLog(`VERDICT: ${data.overall.label.toUpperCase()}  [${data.overall.compound}]`, "done");
    addLog("ANALYSIS COMPLETE ✓", "done");
    setStatus("ready", "COMPLETE");

  } catch (e) {
    showToast("// ERROR: CANNOT CONNECT TO SERVER");
    addLog("CONNECTION FAILED", "err");
    setStatus("error", "ERROR");
  } finally {
    document.getElementById("btnText").classList.remove("hidden");
    document.getElementById("btnSpinner").classList.add("hidden");
    btn.disabled = false;
  }
}

// ── Render all results ────────────────────────────────────────────────────────
function renderResults(data) {
  document.getElementById("emptyState").classList.add("hidden");
  const r = document.getElementById("results");
  r.classList.remove("hidden");

  renderOverall(data.overall);
  renderReadability(data.readability);
  renderSentChart(data.sentence_counts);
  renderEmotionChart(data.emotions);
  renderKeywordChart(data.keywords);
  renderHeatmap(data.sentences);
}

// ── Overall ───────────────────────────────────────────────────────────────────
function renderOverall(o) {
  const vv = document.getElementById("verdictValue");
  vv.textContent = o.label.toUpperCase();
  vv.className   = `verdict-value ${o.label}`;

  document.getElementById("compoundVal").textContent = o.compound >= 0
    ? `+${o.compound.toFixed(4)}` : o.compound.toFixed(4);

  // Gauge: compound -1..+1 → 0%..100%
  const pct = ((o.compound + 1) / 2 * 100).toFixed(1);
  document.getElementById("gaugeNeedle").style.left = `${pct}%`;

  document.getElementById("statPos").textContent   = `${(o.pos * 100).toFixed(0)}%`;
  document.getElementById("statNeu").textContent   = `${(o.neu * 100).toFixed(0)}%`;
  document.getElementById("statNeg").textContent   = `${(o.neg * 100).toFixed(0)}%`;
}

// ── Readability ───────────────────────────────────────────────────────────────
function renderReadability(r) {
  document.getElementById("statWords").textContent = r.word_count.toLocaleString();
  document.getElementById("statSents").textContent = r.sentence_count;
  document.getElementById("statGrade").textContent = `G${r.grade_level}`;

  document.getElementById("readRow").innerHTML = `
    <div class="read-cell">
      <div class="read-val">${r.flesch_score}</div>
      <div class="read-key">FLESCH SCORE</div>
      <div class="read-desc">${r.level_label}</div>
    </div>
    <div class="read-cell">
      <div class="read-val">${r.grade_level}</div>
      <div class="read-key">GRADE LEVEL</div>
      <div class="read-desc">US school grade</div>
    </div>
    <div class="read-cell">
      <div class="read-val">${r.avg_words_per_sentence}</div>
      <div class="read-key">WORDS / SENT</div>
      <div class="read-desc">Average length</div>
    </div>
  `;
}

// ── Sentence doughnut ─────────────────────────────────────────────────────────
function renderSentChart(counts) {
  destroyChart("sent");
  const total = (counts.positive + counts.neutral + counts.negative) || 1;
  const ctx   = document.getElementById("sentChart").getContext("2d");

  charts.sent = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [{
        data: [counts.positive, counts.neutral, counts.negative],
        backgroundColor: ["rgba(0,255,136,0.85)", "rgba(85,96,128,0.85)", "rgba(255,45,120,0.85)"],
        borderColor:     ["#00ff88", "#556080", "#ff2d78"],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: "72%",
      plugins: { legend: { display: false } },
    },
  });

  // Custom legend
  const legend = document.getElementById("sentLegend");
  legend.innerHTML = [
    ["#00ff88", "POSITIVE", counts.positive, (counts.positive/total*100).toFixed(0)],
    ["#556080", "NEUTRAL",  counts.neutral,  (counts.neutral /total*100).toFixed(0)],
    ["#ff2d78", "NEGATIVE", counts.negative, (counts.negative/total*100).toFixed(0)],
  ].map(([c,l,n,p]) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${c}"></span>
      <span style="color:${c}">${l}</span>
      <span style="margin-left:auto;color:#3a4460">${n} sent · ${p}%</span>
    </div>
  `).join("");
}

// ── Emotion radar ─────────────────────────────────────────────────────────────
function renderEmotionChart(emotions) {
  destroyChart("emotion");
  const ctx    = document.getElementById("emotionChart").getContext("2d");
  const labels = Object.keys(emotions).map(e => e.toUpperCase());
  const values = Object.values(emotions);

  charts.emotion = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: "rgba(191,0,255,0.15)",
        borderColor:     "#bf00ff",
        pointBackgroundColor: "#00ffe0",
        pointBorderColor:     "#00ffe0",
        pointRadius: 4,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          grid:       { color: "rgba(0,255,224,0.08)" },
          angleLines: { color: "rgba(0,255,224,0.08)" },
          pointLabels: { color: "#556080", font: { family: "'Share Tech Mono'", size: 10 } },
          ticks: { display: false },
        },
      },
    },
  });
}

// ── Keyword bar ───────────────────────────────────────────────────────────────
function renderKeywordChart(keywords) {
  destroyChart("keyword");
  const top = keywords.slice(0, 12);
  const ctx  = document.getElementById("keywordChart").getContext("2d");

  charts.keyword = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map(k => k.word),
      datasets: [{
        data: top.map(k => parseFloat(k.score.toFixed(4))),
        backgroundColor: top.map((_, i) => {
          const a = 1 - (i / top.length) * 0.55;
          return `rgba(0,255,224,${a.toFixed(2)})`;
        }),
        borderColor:  "rgba(0,255,224,0.6)",
        borderWidth:  1,
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid:  { color: "rgba(0,255,224,0.06)" },
          ticks: { color: "#3a4460", font: { family: "'Share Tech Mono'", size: 9 } },
        },
        y: {
          grid:  { display: false },
          ticks: { color: "#7888aa", font: { family: "'Share Tech Mono'", size: 10 } },
        },
      },
    },
  });
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function renderHeatmap(sentences) {
  const limit   = parseInt(document.getElementById("sentLimit").value);
  const heatmap = document.getElementById("heatmap");
  const display = sentences.slice(0, limit);

  heatmap.innerHTML = display.map((s, i) => {
    const score = (s.compound >= 0 ? "+" : "") + s.compound.toFixed(3);
    return `
      <div class="heat-row ${s.label}" style="animation-delay:${i*0.05}s">
        <span class="heat-badge ${s.label}">${s.label.toUpperCase()} ${score}</span>
        ${escapeHtml(s.text)}
      </div>
    `;
  }).join("");

  if (sentences.length > limit) {
    heatmap.innerHTML += `
      <div style="font-family:'Share Tech Mono',monospace;font-size:10px;
                  color:#3a4460;text-align:center;padding:8px;">
        // ${sentences.length - limit} MORE SENTENCES NOT SHOWN
      </div>`;
  }
}

// ── Keyboard shortcut ─────────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyse();
});

// ── Health check on load ──────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  addLog("BOOTING SENTIX v2.0...", "active");
  try {
    const r = await fetch(API + "/api/health", { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      addLog("SERVER CONNECTED ✓", "done");
      addLog("ALL SYSTEMS ONLINE ✓", "done");
      addLog("AWAITING INPUT_", "");
      document.querySelector(".log-line:last-child").classList.add("blink");
      setStatus("ready", "ONLINE");
    } else {
      addLog("SERVER ERROR", "err");
      setStatus("error", "ERROR");
    }
  } catch {
    addLog("SERVER OFFLINE", "err");
    addLog("RUN: python backend/app.py", "err");
    setStatus("error", "OFFLINE");
  }
});
