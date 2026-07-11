const charts=[];
const $=id=>document.getElementById(id);
const pages={macro:"Macro 분석",journal:"매매일지",watchlist:"관심종목",ai:"AI Analyst"};

document.querySelectorAll(".nav-btn").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active"); const p=btn.dataset.page; $(p).classList.add("active"); $("pageTitle").textContent=pages[p];
});
$("today").textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(new Date());

function chartOptions(unit=""){
  return {responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{labels:{color:"#98a2b3",boxWidth:10}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y}${unit?" "+unit:""}`}}},scales:{x:{grid:{display:false},ticks:{color:"#98a2b3",maxTicksLimit:7,maxRotation:0}},y:{grid:{color:"rgba(148,163,184,.10)"},ticks:{color:"#98a2b3"}}}};
}
function lineChart(id, seriesList, unit="", fill=false){
  const allDates=[...new Set(seriesList.flatMap(s=>s.data.map(x=>x.date)))].sort();
  const datasets=seriesList.map(s=>{
    const m=new Map(s.data.map(x=>[x.date,x.value]));
    return {label:s.label,data:allDates.map(d=>m.has(d)?m.get(d):null),borderWidth:2,pointRadius:0,tension:.12,spanGaps:true,fill};
  });
  charts.push(new Chart($(id),{type:"line",data:{labels:allDates,datasets},options:chartOptions(unit)}));
}
function getSeries(db,id){return db.series[id]?.data||[]}
function alignSpread(a,b){
  const mb=new Map(b.map(x=>[x.date,x.value]));
  return a.filter(x=>mb.has(x.date)).map(x=>({date:x.date,value:Number((x.value-mb.get(x.date)).toFixed(3))}));
}
function pctChange(data,lookback=6){
  if(data.length<2)return null;
  const end=data[data.length-1].value, start=data[Math.max(0,data.length-1-lookback)].value;
  return ((end/start)-1)*100;
}
async function loadMarket(){
  try{
    const res=await fetch(`data/market-data.json?v=${Date.now()}`,{cache:"no-store"}); if(!res.ok)throw new Error("data file");
    const db=await res.json();
    $("updatedAt").textContent=`데이터 갱신: ${new Date(db.generated_at).toLocaleString("ko-KR")}`;
    $("dataStatus").textContent=db.source_mode==="seed"?"초기 샘플 데이터":"자동 갱신 데이터";

    const y10=getSeries(db,"DGS10"), y2=getSeries(db,"DGS2"), spread=alignSpread(y10,y2);
    lineChart("ratesChart",[{label:"US 10Y",data:y10},{label:"US 2Y",data:y2}],"%");
    const zeroPlugin={id:"zero",afterDraw(chart){const y=chart.scales.y.getPixelForValue(0),c=chart.ctx;c.save();c.setLineDash([5,5]);c.strokeStyle="rgba(148,163,184,.7)";c.beginPath();c.moveTo(chart.chartArea.left,y);c.lineTo(chart.chartArea.right,y);c.stroke();c.restore()}};
    const labels=spread.map(x=>x.date), vals=spread.map(x=>x.value);
    charts.push(new Chart($("spreadChart"),{type:"line",data:{labels,datasets:[{label:"10Y−2Y",data:vals,borderWidth:2,pointRadius:0,tension:.08,fill:{target:{value:0},above:"rgba(34,197,94,.16)",below:"rgba(239,68,68,.20)"}}]},options:chartOptions("%"),plugins:[zeroPlugin]}));
    const last=spread.at(-1); $("spreadLatest").textContent=last?`${last.value>=0?"+":""}${last.value.toFixed(2)}%`:"—";

    lineChart("dollarChart",[{label:"Broad USD",data:getSeries(db,"DTWEXBGS")}]);
    lineChart("m2Chart",[{label:"M2",data:getSeries(db,"M2SL")}]);
    lineChart("goldChart",[{label:"Gold",data:getSeries(db,"GOLDAMGBD228NLBM")}]);
    lineChart("wtiChart",[{label:"WTI",data:getSeries(db,"DCOILWTICO")}]);
    lineChart("copperChart",[{label:"Copper",data:getSeries(db,"PCOPPUSDM")}]);
    lineChart("nasdaqChart",[{label:"NASDAQ",data:getSeries(db,"NASDAQCOM")}]);
    lineChart("dowChart",[{label:"Dow",data:getSeries(db,"DJIA")}]);
    lineChart("kospiChart",[{label:"KOSPI",data:getSeries(db,"KOSPI")}]);
    lineChart("vixChart",[{label:"VIX",data:getSeries(db,"VIXCLS")}]);

    const strength=[
      ["NASDAQ",pctChange(getSeries(db,"NASDAQCOM"))],
      ["Dow Jones",pctChange(getSeries(db,"DJIA"))],
      ["KOSPI",pctChange(getSeries(db,"KOSPI"))],
      ["Gold",pctChange(getSeries(db,"GOLDAMGBD228NLBM"))],
      ["WTI",pctChange(getSeries(db,"DCOILWTICO"))],
      ["Copper",pctChange(getSeries(db,"PCOPPUSDM"))],
    ].filter(x=>Number.isFinite(x[1])).sort((a,b)=>b[1]-a[1]);
    $("strengthList").innerHTML=strength.map((x,i)=>`<div class="rank-item"><div class="rank-no">${String(i+1).padStart(2,"0")}</div><strong>${x[0]}</strong><span>${x[1]>=0?"+":""}${x[1].toFixed(2)}%</span></div>`).join("");
  }catch(e){
    console.error(e); $("dataStatus").textContent="데이터 파일 오류";
  }
}
loadMarket();

function load(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch{return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function renderJournal(){const items=load("bj-journal-v2",[]);$("journalList").innerHTML=items.length?items.slice().reverse().map(x=>`<div class="data-item"><div><strong>${x.ticker} · ${x.side}</strong><span>${x.date}</span></div><div><p>진입 ${x.entry||"-"} / 청산 ${x.exit||"-"} / 손절 ${x.stop||"-"} / 리스크 ${x.risk||"-"}</p><p>${x.reason}</p><span>${x.review||""}</span></div><span></span></div>`).join(""):"<p>저장된 매매일지가 없습니다.</p>"}
$("saveJournal").onclick=()=>{const ticker=$("jTicker").value.trim().toUpperCase(),reason=$("jReason").value.trim();if(!ticker||!reason)return alert("티커와 근거를 입력하세요.");const items=load("bj-journal-v2",[]);items.push({ticker,side:$("jSide").value,entry:$("jEntry").value,exit:$("jExit").value,stop:$("jStop").value,risk:$("jRisk").value,reason,review:$("jReview").value,date:new Date().toLocaleString("ko-KR")});save("bj-journal-v2",items);renderJournal()};renderJournal();

const defaults=["반도체","광통신","소프트웨어","전력·에너지","금융","산업재","헬스케어","기타"];
const defaultWatch=[{sector:"광통신",ticker:"COHR",name:"AI 데이터센터 광통신"},{sector:"광통신",ticker:"LITE",name:"광통신 사이클"},{sector:"반도체",ticker:"MU",name:"HBM·메모리 업황"},{sector:"반도체",ticker:"SOXL",name:"반도체 레버리지"}];
let activeSector="전체"; const getSectors=()=>load("bj-sectors-v6",defaults),getWatch=()=>load("bj-watch-v2",defaultWatch);
function syncSectors(){const s=getSectors();$("sectorSelect").innerHTML=s.map(x=>`<option>${x}</option>`).join("");$("manageSectorSelect").innerHTML=s.map(x=>`<option>${x}</option>`).join("");$("sectorTabs").innerHTML=["전체",...s].map(x=>`<button class="sector-tab ${x===activeSector?"active":""}" data-sector="${x}">${x}</button>`).join("");document.querySelectorAll(".sector-tab").forEach(b=>b.onclick=()=>{activeSector=b.dataset.sector;syncSectors();renderWatch()})}
function renderWatch(){const all=getWatch(),items=activeSector==="전체"?all:all.filter(x=>x.sector===activeSector);$("watchList").innerHTML=items.length?items.map(x=>`<div class="watch-item"><span>${x.sector}</span><div><strong>${x.ticker}</strong><span>${x.name}</span></div><button class="remove-btn" data-t="${x.ticker}" data-s="${x.sector}">삭제</button></div>`).join(""):"<p>등록된 종목이 없습니다.</p>";document.querySelectorAll(".remove-btn").forEach(b=>b.onclick=()=>{const a=getWatch();const i=a.findIndex(x=>x.ticker===b.dataset.t&&x.sector===b.dataset.s);if(i>-1)a.splice(i,1);save("bj-watch-v2",a);renderWatch()})}
$("addSector").onclick=()=>{const n=$("newSectorName").value.trim(),s=getSectors();if(!n)return;if(s.includes(n))return alert("이미 존재합니다.");s.push(n);save("bj-sectors-v6",s);$("newSectorName").value="";syncSectors()};
$("renameSector").onclick=()=>{const old=$("manageSectorSelect").value,n=$("renameSectorName").value.trim();if(!n)return;const s=getSectors(),i=s.indexOf(old);if(i>-1)s[i]=n;const w=getWatch();w.forEach(x=>{if(x.sector===old)x.sector=n});if(activeSector===old)activeSector=n;save("bj-sectors-v6",s);save("bj-watch-v2",w);syncSectors();renderWatch()};
$("deleteSector").onclick=()=>{const t=$("manageSectorSelect").value;if(!confirm(`${t} 섹터와 내부 종목을 삭제할까요?`))return;save("bj-sectors-v6",getSectors().filter(x=>x!==t));save("bj-watch-v2",getWatch().filter(x=>x.sector!==t));activeSector="전체";syncSectors();renderWatch()};
$("addWatch").onclick=()=>{const t=$("watchTicker").value.trim().toUpperCase(),n=$("watchName").value.trim();if(!t||!n)return;const w=getWatch();w.push({sector:$("sectorSelect").value,ticker:t,name:n});save("bj-watch-v2",w);$("watchTicker").value="";$("watchName").value="";renderWatch()};
syncSectors();renderWatch();

$("buildPrompt").onclick=()=>{const q=$("aiQuestion").value.trim();if(!q)return;$("promptOutput").textContent=`너는 내 개인 투자 리서치 애널리스트다.

내 투자 성향:
- 추세추종과 눌림목 매매를 선호한다.
- 20일선은 핵심 추세선, 60일선은 중기 방어선으로 본다.
- 2년물·10년물 금리와 장단기 스프레드, 달러, M2, VIX, 원자재를 함께 본다.
- 거래량, VWAP, VPVR, RSI, MACD를 활용한다.
- 강세/약세 시나리오와 리스크 관리를 중시한다.

분석 요청:
${q}

답변 형식:
1. 현재 시장 레짐
2. 핵심 매크로 근거
3. 금리와 유동성 해석
4. 강세 시나리오
5. 약세 시나리오
6. 확인해야 할 지표
7. 대응 전략
8. 틀릴 수 있는 지점`};
$("copyPrompt").onclick=async()=>{try{await navigator.clipboard.writeText($("promptOutput").textContent);alert("복사했습니다.")}catch{}};
