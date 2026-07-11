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

function load(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch{return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}

const strengthData=[["반도체","92"],["광통신","88"],["소프트웨어","84"],["전력설비","79"],["금융","72"],["에너지","68"]];
const turnoverData=[["NVDA","$34.8B"],["TSLA","$29.4B"],["AMD","$18.7B"],["MU","$11.5B"],["SOXL","$8.9B"],["COHR","$2.1B"]];
function renderRanking(id,data){
  document.getElementById(id).innerHTML=data.map((x,i)=>`<div class="rank-item"><div class="rank-no">${String(i+1).padStart(2,"0")}</div><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join("");
}
renderRanking("strengthList",strengthData);renderRanking("turnoverList",turnoverData);

function renderJournal(){
  const items=load("bj-journal-v2",[]);
  journalList.innerHTML=items.length?items.slice().reverse().map(x=>`<div class="data-item"><div><strong>${x.ticker} · ${x.side}</strong><span>${x.date}</span></div><div><p>진입 ${x.entry||"-"} / 청산 ${x.exit||"-"} / 손절 ${x.stop||"-"} / 리스크 ${x.risk||"-"}</p><p>${x.reason}</p><span>${x.review||""}</span></div><span></span></div>`).join(""):"<p>저장된 매매일지가 없습니다.</p>";
}
saveJournal.onclick=()=>{
  const ticker=jTicker.value.trim().toUpperCase(), reason=jReason.value.trim();
  if(!ticker||!reason)return alert("티커와 진입 근거를 입력하세요.");
  const items=load("bj-journal-v2",[]);
  items.push({ticker,side:jSide.value,entry:jEntry.value,exit:jExit.value,stop:jStop.value,risk:jRisk.value,reason,review:jReview.value,date:new Date().toLocaleString("ko-KR")});
  save("bj-journal-v2",items);renderJournal();
};
renderJournal();

const defaultSectors=["반도체","광통신","소프트웨어","전력·에너지","금융","산업재","헬스케어","기타"];
const defaultWatch=[
  {sector:"광통신",ticker:"COHR",name:"AI 데이터센터 광통신"},
  {sector:"광통신",ticker:"LITE",name:"광통신 사이클"},
  {sector:"반도체",ticker:"MU",name:"HBM·메모리 업황"},
  {sector:"반도체",ticker:"SOXL",name:"반도체 레버리지"}
];
let activeSector="전체";

function getSectors(){return load("bj-sectors-v4",defaultSectors)}
function getWatch(){return load("bj-watch-v2",defaultWatch)}

function syncSectorControls(){
  const sectors=getSectors();
  sectorSelect.innerHTML=sectors.map(s=>`<option>${s}</option>`).join("");
  manageSectorSelect.innerHTML=sectors.map(s=>`<option>${s}</option>`).join("");
  sectorTabs.innerHTML=[`<button class="sector-tab ${activeSector==="전체"?"active":""}" data-sector="전체">전체</button>`]
    .concat(sectors.map(s=>`<button class="sector-tab ${activeSector===s?"active":""}" data-sector="${s}">${s}</button>`)).join("");
  document.querySelectorAll(".sector-tab").forEach(b=>b.onclick=()=>{activeSector=b.dataset.sector;syncSectorControls();renderWatch()});
}

function renderWatch(){
  const items=getWatch();
  const filtered=activeSector==="전체"?items:items.filter(x=>x.sector===activeSector);
  watchList.innerHTML=filtered.length?filtered.map((item,i)=>`<div class="watch-item"><span>${item.sector}</span><div><strong>${item.ticker}</strong><span>${item.name}</span></div><button class="remove-btn" data-sector="${item.sector}" data-ticker="${item.ticker}" data-name="${item.name}">삭제</button></div>`).join(""):"<p>해당 섹터에 등록된 종목이 없습니다.</p>";
  document.querySelectorAll(".remove-btn").forEach(b=>b.onclick=()=>{
    const items=getWatch();
    const idx=items.findIndex(x=>x.sector===b.dataset.sector&&x.ticker===b.dataset.ticker&&x.name===b.dataset.name);
    if(idx>-1)items.splice(idx,1);
    save("bj-watch-v2",items);renderWatch();
  });
}

addSector.onclick=()=>{
  const name=newSectorName.value.trim();
  if(!name)return alert("새 섹터 이름을 입력하세요.");
  const sectors=getSectors();
  if(sectors.includes(name))return alert("이미 존재하는 섹터입니다.");
  sectors.push(name);save("bj-sectors-v4",sectors);newSectorName.value="";syncSectorControls();
};

renameSector.onclick=()=>{
  const oldName=manageSectorSelect.value;
  const newName=renameSectorName.value.trim();
  if(!oldName||!newName)return alert("변경할 섹터와 새 이름을 입력하세요.");
  const sectors=getSectors();
  if(sectors.includes(newName))return alert("이미 존재하는 섹터 이름입니다.");
  const idx=sectors.indexOf(oldName);if(idx>-1)sectors[idx]=newName;
  const items=getWatch();items.forEach(x=>{if(x.sector===oldName)x.sector=newName});
  if(activeSector===oldName)activeSector=newName;
  save("bj-sectors-v4",sectors);save("bj-watch-v2",items);renameSectorName.value="";syncSectorControls();renderWatch();
};

deleteSector.onclick=()=>{
  const target=manageSectorSelect.value;
  if(!target)return;
  if(!confirm(`'${target}' 섹터와 그 안의 관심종목을 모두 삭제할까요?`))return;
  const sectors=getSectors().filter(x=>x!==target);
  const items=getWatch().filter(x=>x.sector!==target);
  if(activeSector===target)activeSector="전체";
  save("bj-sectors-v4",sectors);save("bj-watch-v2",items);syncSectorControls();renderWatch();
};

addWatch.onclick=()=>{
  const ticker=watchTicker.value.trim().toUpperCase(), name=watchName.value.trim(), sector=sectorSelect.value;
  if(!ticker||!name||!sector)return alert("섹터, 티커, 설명을 입력하세요.");
  const items=getWatch();items.push({sector,ticker,name});save("bj-watch-v2",items);
  watchTicker.value="";watchName.value="";renderWatch();
};

syncSectorControls();renderWatch();

buildPrompt.onclick=()=>{
  const q=aiQuestion.value.trim();if(!q)return alert("분석할 질문을 입력하세요.");
  promptOutput.textContent=`너는 내 개인 투자 리서치 애널리스트다.

내 투자 성향:
- 추세추종과 눌림목 매매를 선호한다.
- 20일선은 핵심 추세선, 60일선은 중기 방어선으로 본다.
- 미국 2년물·10년물 금리, 달러인덱스, M2, VIX, WTI, 금, 구리를 함께 본다.
- 거래량, VWAP, VPVR, RSI, MACD를 활용한다.
- 반도체와 광통신 섹터에 관심이 많다.
- 강세/약세 시나리오와 리스크 관리를 중시한다.

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
};

copyPrompt.onclick=async()=>{try{await navigator.clipboard.writeText(promptOutput.textContent);alert("복사했습니다.")}catch{alert("복사 실패")}};


// ===== Real 10Y - 2Y spread from FRED =====
// No API key is stored in the site. We download the public FRED CSV series
// for DGS10 and DGS2, align observations by date, and calculate DGS10 - DGS2.
async function fetchFredSeries(seriesId){
  const directUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  let text;
  try{
    const res = await fetch(directUrl, {cache:"no-store"});
    if(!res.ok) throw new Error(`${seriesId} HTTP ${res.status}`);
    text = await res.text();
  }catch(directErr){
    // 브라우저(특히 인앱 브라우저)에서 CORS로 직접 호출이 막히는 경우 공개 프록시로 재시도.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
    const res2 = await fetch(proxyUrl, {cache:"no-store"});
    if(!res2.ok) throw new Error(`${seriesId} proxy HTTP ${res2.status}`);
    text = await res2.text();
  }
  const lines = text.trim().split(/\r?\n/);
  const map = new Map();
  for(let i=1;i<lines.length;i++){
    const parts = lines[i].split(",");
    if(parts.length < 2) continue;
    const date = parts[0].trim();
    const value = Number(parts[1]);
    if(date && Number.isFinite(value)) map.set(date,value);
  }
  return map;
}

async function renderRealSpread(){
  const status = document.getElementById("spreadStatus");
  const latest = document.getElementById("spreadLatest");
  try{
    const [tenY,twoY] = await Promise.all([
      fetchFredSeries("DGS10"),
      fetchFredSeries("DGS2")
    ]);

    const rows=[];
    for(const [date,v10] of tenY){
      if(twoY.has(date)){
        rows.push({date, spread:Number((v10-twoY.get(date)).toFixed(3))});
      }
    }
    rows.sort((a,b)=>a.date.localeCompare(b.date));

    // Keep the latest 5 years for readability/performance.
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear()-5);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    const recent = rows.filter(x=>x.date>=cutoffStr);
    const data = recent.length ? recent : rows.slice(-1300);
    if(!data.length) throw new Error("공통 관측값이 없습니다.");

    const last=data[data.length-1];
    latest.textContent=`${last.spread>=0?"+":""}${last.spread.toFixed(2)}%`;
    status.textContent=`최근 관측일 ${last.date} · 출처: FRED · 계산식 DGS10 − DGS2`;

    const ctx=document.getElementById("spreadChart");
    const isDark=document.body.classList.contains("dark");
    const grid=isDark?"rgba(148,163,184,.12)":"rgba(15,23,42,.08)";
    const textColor=isDark?"#98a2b3":"#667085";

    const positiveFill = "rgba(34,197,94,.16)";
    const negativeFill = "rgba(239,68,68,.20)";

    new Chart(ctx,{
      type:"line",
      data:{
        labels:data.map(x=>x.date),
        datasets:[{
          label:"10Y − 2Y spread",
          data:data.map(x=>x.spread),
          borderWidth:1.7,
          pointRadius:0,
          tension:.08,
          fill:{
            target:{value:0},
            above:positiveFill,
            below:negativeFill
          },
          segment:{
            borderColor:c=>c.p0.parsed.y<0||c.p1.parsed.y<0?"rgba(248,113,113,.95)":"rgba(74,222,128,.95)"
          }
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        interaction:{mode:"index",intersect:false},
        plugins:{
          legend:{display:false},
          tooltip:{
            callbacks:{
              label:(c)=>` Spread: ${c.parsed.y.toFixed(2)}%`
            }
          }
        },
        scales:{
          x:{
            grid:{display:false},
            ticks:{color:textColor,maxTicksLimit:7,maxRotation:0}
          },
          y:{
            grid:{color:grid},
            ticks:{color:textColor,callback:v=>`${v}%`}
          }
        }
      },
      plugins:[{
        id:"zeroLine",
        afterDraw(chart){
          const y=chart.scales.y.getPixelForValue(0);
          const c=chart.ctx;
          c.save();
          c.setLineDash([6,5]);
          c.strokeStyle="rgba(148,163,184,.8)";
          c.lineWidth=1;
          c.beginPath();
          c.moveTo(chart.chartArea.left,y);
          c.lineTo(chart.chartArea.right,y);
          c.stroke();
          c.restore();
        }
      }]
    });
  }catch(err){
    console.error(err);
    latest.textContent="데이터 오류";
    status.textContent="FRED 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.";
  }
}
renderRealSpread();

// ===== TradingView widgets: staggered loading =====
// 위젯을 한 번에 10개 이상 동시에 그리면 인앱 브라우저 등 일부 환경에서
// "This symbol is only available on TradingView" 오류나 기본 심볼(AAPL)로
// 잘못 표시되는 문제가 발생한다. 컨테이너 수를 줄이고, 순서대로 간격을 두고
// 스크립트를 주입해 안정적으로 로드되게 한다.
function loadTVWidget(containerId, scriptSrc, config, delay){
  setTimeout(()=>{
    const container = document.getElementById(containerId);
    if(!container) return;
    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    wrapper.appendChild(widgetDiv);
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = scriptSrc;
    script.async = true;
    script.textContent = JSON.stringify(config);
    wrapper.appendChild(script);
    container.appendChild(wrapper);
  }, delay);
}

const ADV = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
const OVERVIEW = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";

loadTVWidget("tv-us10y", ADV, {
  autosize:true, symbol:"TVC:US10Y", interval:"D", timezone:"exchange", theme:"dark", style:"1",
  locale:"en", hide_side_toolbar:true, hide_top_toolbar:false, allow_symbol_change:false,
  save_image:false, withdateranges:true, hide_volume:true
}, 0);

loadTVWidget("tv-us02y", ADV, {
  autosize:true, symbol:"TVC:US02Y", interval:"D", timezone:"exchange", theme:"dark", style:"1",
  locale:"en", hide_side_toolbar:true, hide_top_toolbar:false, allow_symbol_change:false,
  save_image:false, withdateranges:true, hide_volume:true
}, 500);

loadTVWidget("tv-macro-overview", OVERVIEW, {
  symbols:[
    ["Dollar Index","TVC:DXY|1D"],
    ["M2 Money Supply","FRED:M2SL|1M"],
    ["Gold","OANDA:XAUUSD|1D"],
    ["WTI Crude Oil","TVC:USOIL|1D"],
    ["Copper","CAPITALCOM:COPPER|1D"]
  ],
  chartOnly:false, width:"100%", height:"100%", locale:"en", colorTheme:"dark", autosize:true,
  showVolume:false, showMA:false, hideDateRanges:false, hideMarketStatus:false, hideSymbolLogo:false,
  scalePosition:"right", scaleMode:"Normal", fontSize:"11", noTimeScale:false,
  valuesTracking:"1", changeMode:"price-and-percent", chartType:"area", lineWidth:2
}, 1000);

loadTVWidget("tv-risk-overview", OVERVIEW, {
  symbols:[
    ["NASDAQ Composite","NASDAQ:IXIC|1D"],
    ["Dow Jones","DJ:DJI|1D"],
    ["KOSPI","KRX:KOSPI|1D"],
    ["VIX","CBOE:VIX|1D"]
  ],
  chartOnly:false, width:"100%", height:"100%", locale:"en", colorTheme:"dark", autosize:true,
  showVolume:false, showMA:false, hideDateRanges:false, hideMarketStatus:false, hideSymbolLogo:false,
  scalePosition:"right", scaleMode:"Normal", fontSize:"11", noTimeScale:false,
  valuesTracking:"1", changeMode:"price-and-percent", chartType:"area", lineWidth:2
}, 1500);
