const TV_SCRIPT = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

function currentTheme(){
  return document.body.classList.contains("dark") ? "dark" : "light";
}

function mountTV(containerId, config){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "tradingview-widget-container";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";

  const widget = document.createElement("div");
  widget.className = "tradingview-widget-container__widget";
  widget.style.height = "100%";
  widget.style.width = "100%";

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = TV_SCRIPT;
  script.async = true;
  script.innerHTML = JSON.stringify({
    autosize: true,
    interval: "D",
    timezone: "exchange",
    theme: currentTheme(),
    style: "1",
    locale: "en",
    backgroundColor: currentTheme() === "dark" ? "#111720" : "#ffffff",
    gridColor: currentTheme() === "dark" ? "rgba(148, 163, 184, 0.08)" : "rgba(15, 23, 42, 0.06)",
    hide_side_toolbar: true,
    hide_top_toolbar: true,
    hide_legend: false,
    hide_volume: true,
    allow_symbol_change: false,
    save_image: false,
    withdateranges: false,
    calendar: false,
    support_host: "https://www.tradingview.com",
    ...config
  });

  wrapper.appendChild(widget);
  wrapper.appendChild(script);
  container.appendChild(wrapper);
}

function mountAllWidgets(){
  mountTV("tv-rates", {
    symbol: "TVC:US10Y",
    hide_top_toolbar: false,
    withdateranges: true,
    compareSymbols: [{symbol:"TVC:US02Y", position:"SameScale"}]
  });

  mountTV("tv-dxy", {symbol:"TVC:DXY"});
  mountTV("tv-m2", {symbol:"FRED:M2SL"});
  mountTV("tv-gold", {symbol:"OANDA:XAUUSD"});
  mountTV("tv-wti", {symbol:"NYMEX:CL1!"});
  mountTV("tv-copper", {symbol:"COMEX:HG1!"});

  mountTV("tv-nasdaq", {symbol:"NASDAQ:IXIC", hide_top_toolbar:false, withdateranges:true});
  mountTV("tv-dow", {symbol:"DJ:DJI", hide_top_toolbar:false, withdateranges:true});
  mountTV("tv-kospi", {symbol:"KRX:KOSPI", hide_top_toolbar:false, withdateranges:true});
  mountTV("tv-vix", {symbol:"CBOE:VIX", hide_top_toolbar:false, withdateranges:true});
}

mountAllWidgets();

const strengthData=[
  ["반도체","92"],["광통신","88"],["소프트웨어","84"],["전력설비","79"],["금융","72"],["에너지","68"]
];
const turnoverData=[
  ["NVDA","$34.8B"],["TSLA","$29.4B"],["AMD","$18.7B"],["MU","$11.5B"],["SOXL","$8.9B"],["COHR","$2.1B"]
];

function renderRanking(id,data){
  const wrap=document.getElementById(id);wrap.innerHTML="";
  data.forEach((x,i)=>{
    const div=document.createElement("div");div.className="rank-item";
    div.innerHTML=`<div class="rank-no">${String(i+1).padStart(2,"0")}</div><strong>${x[0]}</strong><span>${x[1]}</span>`;
    wrap.appendChild(div);
  });
}
renderRanking("strengthList",strengthData);
renderRanking("turnoverList",turnoverData);

const pages={macro:"Macro 분석",journal:"매매일지",watchlist:"관심종목",ai:"AI Analyst"};
document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    const p=btn.dataset.page;
    document.getElementById(p).classList.add("active");
    document.getElementById("pageTitle").textContent=pages[p];
  });
});

document.getElementById("today").textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(new Date());

const savedTheme=localStorage.getItem("bj-theme") || "dark";
document.body.classList.toggle("dark", savedTheme==="dark");
document.getElementById("themeToggle").textContent=savedTheme==="dark"?"라이트 모드":"다크 모드";

document.getElementById("themeToggle").addEventListener("click",()=>{
  const next=document.body.classList.contains("dark")?"light":"dark";
  localStorage.setItem("bj-theme",next);
  document.body.classList.toggle("dark",next==="dark");
  document.getElementById("themeToggle").textContent=next==="dark"?"라이트 모드":"다크 모드";
  mountAllWidgets();
});

function load(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}

function renderJournal(){
  const items=load("bj-journal-v2",[]);
  const wrap=document.getElementById("journalList");
  wrap.innerHTML=items.length?"":"<p>저장된 매매일지가 없습니다.</p>";
  items.slice().reverse().forEach(x=>{
    const div=document.createElement("div");div.className="data-item";
    div.innerHTML=`<div><strong>${x.ticker} · ${x.side}</strong><span>${x.date}</span></div>
    <div><p>진입 ${x.entry||"-"} / 청산 ${x.exit||"-"} / 손절 ${x.stop||"-"} / 리스크 ${x.risk||"-"}</p><p>${x.reason}</p><span>${x.review||""}</span></div><span></span>`;
    wrap.appendChild(div);
  });
}
document.getElementById("saveJournal").addEventListener("click",()=>{
  const ticker=document.getElementById("jTicker").value.trim().toUpperCase();
  const reason=document.getElementById("jReason").value.trim();
  if(!ticker||!reason)return alert("티커와 진입 근거를 입력하세요.");
  const items=load("bj-journal-v2",[]);
  items.push({
    ticker,
    side:document.getElementById("jSide").value,
    entry:document.getElementById("jEntry").value,
    exit:document.getElementById("jExit").value,
    stop:document.getElementById("jStop").value,
    risk:document.getElementById("jRisk").value,
    reason,
    review:document.getElementById("jReview").value,
    date:new Date().toLocaleString("ko-KR")
  });
  save("bj-journal-v2",items);
  ["jTicker","jEntry","jExit","jStop","jRisk","jReason","jReview"].forEach(id=>document.getElementById(id).value="");
  renderJournal();
});
renderJournal();

const sectors=["전체","반도체","광통신","소프트웨어","전력·에너지","금융","산업재","헬스케어","기타"];
let activeSector="전체";
const defaultWatch=[
  {sector:"광통신",ticker:"COHR",name:"AI 데이터센터 광통신"},
  {sector:"광통신",ticker:"LITE",name:"광통신 사이클"},
  {sector:"반도체",ticker:"MU",name:"HBM·메모리 업황"},
  {sector:"반도체",ticker:"SOXL",name:"반도체 레버리지"}
];

const tabs=document.getElementById("sectorTabs");
const sel=document.getElementById("sectorSelect");
sectors.filter(x=>x!=="전체").forEach(x=>sel.innerHTML+=`<option>${x}</option>`);
sectors.forEach(sec=>{
  const b=document.createElement("button");
  b.className="sector-tab"+(sec==="전체"?" active":"");
  b.textContent=sec;
  b.onclick=()=>{
    activeSector=sec;
    document.querySelectorAll(".sector-tab").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    renderWatch();
  };
  tabs.appendChild(b);
});

function renderWatch(){
  const items=load("bj-watch-v2",defaultWatch);
  const filtered=activeSector==="전체"?items:items.filter(x=>x.sector===activeSector);
  const wrap=document.getElementById("watchList");
  wrap.innerHTML=filtered.length?"":"<p>해당 섹터에 등록된 종목이 없습니다.</p>";
  filtered.forEach(item=>{
    const div=document.createElement("div");div.className="watch-item";
    div.innerHTML=`<span>${item.sector}</span><div><strong>${item.ticker}</strong><span>${item.name}</span></div><button class="remove-btn">삭제</button>`;
    div.querySelector("button").onclick=()=>{
      const all=load("bj-watch-v2",defaultWatch);
      const idx=all.findIndex(x=>x.sector===item.sector&&x.ticker===item.ticker&&x.name===item.name);
      if(idx>-1)all.splice(idx,1);
      save("bj-watch-v2",all);renderWatch();
    };
    wrap.appendChild(div);
  });
}

document.getElementById("addWatch").addEventListener("click",()=>{
  const ticker=document.getElementById("watchTicker").value.trim().toUpperCase();
  const name=document.getElementById("watchName").value.trim();
  if(!ticker||!name)return alert("티커와 설명을 입력하세요.");
  const items=load("bj-watch-v2",defaultWatch);
  items.push({sector:document.getElementById("sectorSelect").value,ticker,name});
  save("bj-watch-v2",items);
  document.getElementById("watchTicker").value="";
  document.getElementById("watchName").value="";
  renderWatch();
});
renderWatch();

document.getElementById("buildPrompt").addEventListener("click",()=>{
  const q=document.getElementById("aiQuestion").value.trim();
  if(!q)return alert("분석할 질문을 입력하세요.");
  document.getElementById("promptOutput").textContent=`너는 내 개인 투자 리서치 애널리스트다.

내 투자 성향:
- 추세추종과 눌림목 매매를 선호한다.
- 20일선은 핵심 추세선, 60일선은 중기 방어선으로 본다.
- 미국 2년물·10년물 금리, 달러인덱스, M2, VIX, WTI, 금, 구리 등 매크로 지표를 함께 본다.
- 거래량, VWAP, VPVR, RSI, MACD를 함께 본다.
- 반도체와 광통신 섹터에 관심이 많다.
- 강세/약세 시나리오와 리스크 관리 기준을 중시한다.

분석 요청:
${q}

답변 형식:
1. 현재 시장 레짐
2. 핵심 매크로 근거
3. 금리와 유동성 해석
4. 강세 시나리오
5. 약세 시나리오
6. 확인해야 할 가격/지표
7. 대응 전략
8. 틀릴 수 있는 지점과 리스크`;
});

document.getElementById("copyPrompt").addEventListener("click",async()=>{
  try{
    await navigator.clipboard.writeText(document.getElementById("promptOutput").textContent);
    alert("복사했습니다.");
  }catch{
    alert("복사에 실패했습니다.");
  }
});
