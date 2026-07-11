const labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const sample = {
  y10:[4.05,4.12,4.18,4.11,4.22,4.28,4.34,4.31,4.26,4.38,4.33,4.29],
  y2:[4.31,4.36,4.39,4.34,4.42,4.46,4.52,4.48,4.39,4.45,4.37,4.32],
  dxy:[102,103,102.5,104,103.2,104.4,105.1,104.8,103.9,104.2,103.6,103.1],
  m2:[20.8,20.9,21.0,21.05,21.1,21.15,21.2,21.25,21.3,21.35,21.4,21.5],
  gold:[2020,2040,2070,2100,2140,2180,2200,2250,2280,2310,2350,2390],
  wti:[74,76,75,78,81,79,83,82,80,78,77,79],
  copper:[3.8,3.9,4.0,4.1,4.2,4.35,4.28,4.4,4.45,4.38,4.5,4.55],
  nasdaq:[16000,16300,16600,16450,16900,17200,17600,17800,18100,18300,18550,18800],
  dow:[37500,37800,38100,38400,38250,38600,39000,39200,39500,39800,40100,40500],
  kospi:[2520,2550,2580,2600,2570,2620,2650,2680,2700,2720,2750,2780],
  vix:[15,16,14,18,17,16,19,17,16,15,14,15]
};

const chartInstances = [];

function colors(){
  const dark = document.body.classList.contains("dark");
  return {
    text: dark ? "#cbd5e1" : "#475467",
    grid: dark ? "rgba(148,163,184,.12)" : "rgba(15,23,42,.08)"
  };
}

function baseOptions(){
  const c = colors();
  return {
    responsive:true,
    maintainAspectRatio:false,
    interaction:{mode:"index",intersect:false},
    plugins:{legend:{labels:{color:c.text}}},
    scales:{
      x:{ticks:{color:c.text,maxTicksLimit:8},grid:{color:c.grid}},
      y:{ticks:{color:c.text},grid:{color:c.grid}}
    }
  };
}

function makeLine(id, data, label){
  const ctx=document.getElementById(id);
  const ch=new Chart(ctx,{
    type:"line",
    data:{labels,datasets:[{label,data,borderWidth:2,tension:.25,pointRadius:0,fill:false}]},
    options:baseOptions()
  });
  chartInstances.push(ch);
}

function makeRates(){
  const ctx=document.getElementById("ratesChart");
  const spread=sample.y10.map((v,i)=>v-sample.y2[i]);
  const ch=new Chart(ctx,{
    type:"line",
    data:{
      labels,
      datasets:[
        {label:"US 10Y",data:sample.y10,borderWidth:2,tension:.25,pointRadius:0},
        {label:"US 2Y",data:sample.y2,borderWidth:2,tension:.25,pointRadius:0},
        {label:"10Y-2Y Spread",data:spread,borderWidth:1,tension:.25,pointRadius:0,fill:true}
      ]
    },
    options:baseOptions()
  });
  chartInstances.push(ch);
}

makeRates();
makeLine("dxyChart",sample.dxy,"DXY");
makeLine("m2Chart",sample.m2,"M2");
makeLine("goldChart",sample.gold,"Gold");
makeLine("wtiChart",sample.wti,"WTI");
makeLine("copperChart",sample.copper,"Copper");
makeLine("nasdaqChart",sample.nasdaq,"NASDAQ");
makeLine("dowChart",sample.dow,"Dow Jones");
makeLine("kospiChart",sample.kospi,"KOSPI");
makeLine("vixChart",sample.vix,"VIX");

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

document.getElementById("themeToggle").addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  document.getElementById("themeToggle").textContent=document.body.classList.contains("dark")?"라이트 모드":"다크 모드";
  localStorage.setItem("bj-theme",document.body.classList.contains("dark")?"dark":"light");
  location.reload();
});
if(localStorage.getItem("bj-theme")==="dark") document.body.classList.add("dark");

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
  const ticker=jTicker.value.trim().toUpperCase(),reason=jReason.value.trim();
  if(!ticker||!reason)return alert("티커와 진입 근거를 입력하세요.");
  const items=load("bj-journal-v2",[]);
  items.push({ticker,side:jSide.value,entry:jEntry.value,exit:jExit.value,stop:jStop.value,risk:jRisk.value,reason,review:jReview.value,date:new Date().toLocaleString("ko-KR")});
  save("bj-journal-v2",items);
  [jTicker,jEntry,jExit,jStop,jRisk,jReason,jReview].forEach(x=>x.value="");
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
  const b=document.createElement("button");b.className="sector-tab"+(sec==="전체"?" active":"");b.textContent=sec;
  b.onclick=()=>{activeSector=sec;document.querySelectorAll(".sector-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderWatch()};
  tabs.appendChild(b);
});

function renderWatch(){
  const items=load("bj-watch-v2",defaultWatch);
  const filtered=activeSector==="전체"?items:items.filter(x=>x.sector===activeSector);
  const wrap=document.getElementById("watchList");wrap.innerHTML=filtered.length?"":"<p>해당 섹터에 등록된 종목이 없습니다.</p>";
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
  const ticker=watchTicker.value.trim().toUpperCase(),name=watchName.value.trim();
  if(!ticker||!name)return alert("티커와 설명을 입력하세요.");
  const items=load("bj-watch-v2",defaultWatch);
  items.push({sector:sectorSelect.value,ticker,name});
  save("bj-watch-v2",items);
  watchTicker.value="";watchName.value="";renderWatch();
});
renderWatch();

document.getElementById("buildPrompt").addEventListener("click",()=>{
  const q=aiQuestion.value.trim();
  if(!q)return alert("분석할 질문을 입력하세요.");
  promptOutput.textContent=`너는 내 개인 투자 리서치 애널리스트다.

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
  try{await navigator.clipboard.writeText(promptOutput.textContent);alert("복사했습니다.");}
  catch{alert("복사에 실패했습니다.");}
});
