const pageTitles = {
  dashboard: "시장 대시보드",
  watchlist: "관심종목",
  journal: "매매일지",
  study: "금융공학 공부",
  ai: "AI Analyst"
};

const defaultChecklist = [
  "NASDAQ 100의 20일·60일 이동평균 위치 확인",
  "미국 2년물 금리와 연준 정책 기대 확인",
  "미국 10년물 금리의 방향과 상승 속도 확인",
  "DXY·VIX·WTI로 유동성과 리스크 점검",
  "보유 종목의 거래량·VWAP·주요 매물대 확인",
  "오늘의 손절 기준과 최대 허용 손실 확인"
];

const defaultWatchlist = [
  { ticker: "COHR", thesis: "광통신·AI 데이터센터 수요" },
  { ticker: "LITE", thesis: "광통신 사이클과 고성능 네트워크" },
  { ticker: "SOXL", thesis: "반도체 추세 추종용 고위험 레버리지" },
  { ticker: "MU", thesis: "HBM·메모리 업황 사이클" }
];

const studyTracks = [
  { step: "01", title: "금융수학", desc: "복리, 현재가치, 채권 가격, 듀레이션, 수익률곡선", progress: 40 },
  { step: "02", title: "확률·통계", desc: "기대값, 분산, 정규분포, 회귀, 확률과정의 기초", progress: 20 },
  { step: "03", title: "파생상품", desc: "선물, 옵션, Greeks, 변동성, Black-Scholes의 직관", progress: 15 },
  { step: "04", title: "Python", desc: "pandas, numpy, 데이터 수집, 백테스트, 리스크 분석", progress: 30 }
];

function load(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function renderChecklist() {
  const state = load("bj-checklist", defaultChecklist.map(text => ({ text, done: false })));
  const wrap = document.getElementById("checklist");
  wrap.innerHTML = "";
  state.forEach((item, i) => {
    const label = document.createElement("label");
    label.className = "check-item";
    label.innerHTML = `<input type="checkbox" ${item.done ? "checked" : ""}><span>${item.text}</span>`;
    label.querySelector("input").addEventListener("change", e => {
      state[i].done = e.target.checked;
      save("bj-checklist", state);
    });
    wrap.appendChild(label);
  });
}

function renderWatchlist() {
  const items = load("bj-watchlist", defaultWatchlist);
  const wrap = document.getElementById("watchlist-table");
  wrap.innerHTML = items.length ? "" : "<p>아직 등록된 종목이 없습니다.</p>";
  items.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "data-item";
    row.innerHTML = `
      <strong>${item.ticker}</strong>
      <span>${item.thesis}</span>
      <button class="remove-btn">삭제</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      items.splice(i, 1);
      save("bj-watchlist", items);
      renderWatchlist();
    });
    wrap.appendChild(row);
  });
}

function renderJournal() {
  const items = load("bj-journal", []);
  const wrap = document.getElementById("journal-list");
  wrap.innerHTML = items.length ? "" : "<p>저장된 매매일지가 없습니다.</p>";
  items.slice().reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = "data-item";
    row.innerHTML = `
      <div>
        <strong>${item.ticker} · ${item.action}</strong>
        <span>${item.date}${item.price ? ` · ${item.price}` : ""}</span>
      </div>
      <div>
        <p>${item.reason}</p>
        <span>리스크 기준: ${item.risk || "미입력"}</span>
      </div>
      <span></span>
    `;
    wrap.appendChild(row);
  });
}

function renderStudy() {
  const wrap = document.getElementById("study-cards");
  wrap.innerHTML = "";
  studyTracks.forEach(item => {
    const card = document.createElement("article");
    card.className = "study-card";
    card.innerHTML = `
      <span class="kicker">STEP ${item.step}</span>
      <h4>${item.title}</h4>
      <p>${item.desc}</p>
      <div class="progress"><span style="width:${item.progress}%"></span></div>
    `;
    wrap.appendChild(card);
  });
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.target;
    document.getElementById(target).classList.add("active");
    document.getElementById("page-title").textContent = pageTitles[target];
  });
});

document.getElementById("today").textContent = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "long", day: "numeric", weekday: "short"
}).format(new Date());

const savedTheme = localStorage.getItem("bj-theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  document.getElementById("theme-toggle").textContent = "라이트 모드";
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("bj-theme", isDark ? "dark" : "light");
  document.getElementById("theme-toggle").textContent = isDark ? "라이트 모드" : "다크 모드";
});

const marketNote = document.getElementById("market-note");
marketNote.value = localStorage.getItem("bj-market-note") || "";
document.getElementById("save-market-note").addEventListener("click", () => {
  localStorage.setItem("bj-market-note", marketNote.value);
  alert("시장 메모가 저장되었습니다.");
});

document.getElementById("reset-checklist").addEventListener("click", () => {
  save("bj-checklist", defaultChecklist.map(text => ({ text, done: false })));
  renderChecklist();
});

document.getElementById("add-watch").addEventListener("click", () => {
  const ticker = document.getElementById("ticker-input").value.trim().toUpperCase();
  const thesis = document.getElementById("thesis-input").value.trim();
  if (!ticker || !thesis) return alert("티커와 투자 논리를 입력하세요.");
  const items = load("bj-watchlist", defaultWatchlist);
  items.push({ ticker, thesis });
  save("bj-watchlist", items);
  document.getElementById("ticker-input").value = "";
  document.getElementById("thesis-input").value = "";
  renderWatchlist();
});

document.getElementById("save-journal").addEventListener("click", () => {
  const ticker = document.getElementById("journal-ticker").value.trim().toUpperCase();
  const action = document.getElementById("journal-action").value;
  const price = document.getElementById("journal-price").value;
  const risk = document.getElementById("journal-risk").value.trim();
  const reason = document.getElementById("journal-reason").value.trim();
  if (!ticker || !reason) return alert("티커와 매매 근거를 입력하세요.");

  const items = load("bj-journal", []);
  items.push({
    ticker, action, price, risk, reason,
    date: new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date())
  });
  save("bj-journal", items);

  ["journal-ticker", "journal-price", "journal-risk", "journal-reason"].forEach(id => {
    document.getElementById(id).value = "";
  });
  renderJournal();
});

document.getElementById("build-prompt").addEventListener("click", () => {
  const question = document.getElementById("ai-question").value.trim();
  if (!question) return alert("분석할 질문을 입력하세요.");

  const prompt = `너는 내 개인 투자 리서치 애널리스트다.

내 투자 성향:
- 추세추종과 눌림목 매매를 선호한다.
- 20일선은 핵심 추세선, 60일선은 중기 방어선으로 본다.
- 금리, 달러, 유동성, 거래량, VWAP, VPVR, RSI, MACD를 함께 본다.
- 반도체와 광통신 섹터에 관심이 많다.
- 방향성보다 리스크 관리와 시나리오별 대응을 중시한다.

분석 요청:
${question}

답변 형식:
1. 현재 시장 레짐
2. 가장 중요한 근거 3~5개
3. 강세 시나리오
4. 약세 시나리오
5. 확인해야 할 가격/지표
6. 내가 취할 수 있는 대응
7. 틀릴 수 있는 지점과 리스크`;

  document.getElementById("prompt-output").textContent = prompt;
});

document.getElementById("copy-prompt").addEventListener("click", async () => {
  const text = document.getElementById("prompt-output").textContent;
  try {
    await navigator.clipboard.writeText(text);
    alert("프롬프트를 복사했습니다.");
  } catch {
    alert("복사에 실패했습니다. 직접 선택해서 복사하세요.");
  }
});

renderChecklist();
renderWatchlist();
renderJournal();
renderStudy();
