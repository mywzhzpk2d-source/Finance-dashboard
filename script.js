const $ = (id) => document.getElementById(id);
const pages = {macro:"Macro 분석",journal:"매매일지",watchlist:"관심종목",ai:"AI Analyst"};

document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    const p=btn.dataset.page;
    $(p).classList.add("active");
    $("pageTitle").textContent=pages[p];
  });
});

$("today").textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(new Date());

function load(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch{return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}

function renderJournal(){
  const items=load("bj-journal-v2",[]);
  $("journalList").innerHTML=items.length?items.slice().reverse().map(x=>`
    <div class="data-item">
      <div><strong>${x.ticker} · ${x.side}</strong><span>${x.date}</span></div>
      <div>
        <p>진입 ${x.entry||"-"} / 청산 ${x.exit||"-"} / 손절 ${x.stop||"-"} / 리스크 ${x.risk||"-"}</p>
        <p>${x.reason}</p>
        <span>${x.review||""}</span>
      </div>
      <span></span>
    </div>
  `).join(""):"<p>저장된 매매일지가 없습니다.</p>";
}

$("saveJournal").onclick=()=>{
  const ticker=$("jTicker").value.trim().toUpperCase();
  const reason=$("jReason").value.trim();
  if(!ticker||!reason) return alert("티커와 진입 근거를 입력하세요.");

  const items=load("bj-journal-v2",[]);
  items.push({
    ticker,
    side:$("jSide").value,
    entry:$("jEntry").value,
    exit:$("jExit").value,
    stop:$("jStop").value,
    risk:$("jRisk").value,
    reason,
    review:$("jReview").value,
    date:new Date().toLocaleString("ko-KR")
  });
  save("bj-journal-v2",items);
  ["jTicker","jEntry","jExit","jStop","jRisk","jReason","jReview"].forEach(id=>$(id).value="");
  renderJournal();
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
const getSectors=()=>load("bj-sectors-final",defaultSectors);
const getWatch=()=>load("bj-watch-v2",defaultWatch);

function syncSectorControls(){
  const sectors=getSectors();
  $("sectorSelect").innerHTML=sectors.map(s=>`<option>${s}</option>`).join("");
  $("manageSectorSelect").innerHTML=sectors.map(s=>`<option>${s}</option>`).join("");
  $("sectorTabs").innerHTML=["전체",...sectors].map(s=>`
    <button class="sector-tab ${s===activeSector?"active":""}" data-sector="${s}">${s}</button>
  `).join("");

  document.querySelectorAll(".sector-tab").forEach(b=>b.onclick=()=>{
    activeSector=b.dataset.sector;
    syncSectorControls();
    renderWatch();
  });
}

function renderWatch(){
  const all=getWatch();
  const items=activeSector==="전체"?all:all.filter(x=>x.sector===activeSector);

  $("watchList").innerHTML=items.length?items.map(x=>`
    <div class="watch-item">
      <span>${x.sector}</span>
      <div><strong>${x.ticker}</strong><span>${x.name}</span></div>
      <button class="remove-btn" data-ticker="${x.ticker}" data-sector="${x.sector}">삭제</button>
    </div>
  `).join(""):"<p>해당 섹터에 등록된 종목이 없습니다.</p>";

  document.querySelectorAll(".remove-btn").forEach(b=>b.onclick=()=>{
    const items=getWatch();
    const idx=items.findIndex(x=>x.ticker===b.dataset.ticker&&x.sector===b.dataset.sector);
    if(idx>-1) items.splice(idx,1);
    save("bj-watch-v2",items);
    renderWatch();
  });
}

$("addSector").onclick=()=>{
  const name=$("newSectorName").value.trim();
  if(!name) return alert("새 섹터 이름을 입력하세요.");
  const sectors=getSectors();
  if(sectors.includes(name)) return alert("이미 존재하는 섹터입니다.");
  sectors.push(name);
  save("bj-sectors-final",sectors);
  $("newSectorName").value="";
  syncSectorControls();
};

$("renameSector").onclick=()=>{
  const oldName=$("manageSectorSelect").value;
  const newName=$("renameSectorName").value.trim();
  if(!oldName||!newName) return alert("변경할 섹터와 새 이름을 입력하세요.");

  const sectors=getSectors();
  if(sectors.includes(newName)) return alert("이미 존재하는 섹터 이름입니다.");

  const idx=sectors.indexOf(oldName);
  if(idx>-1) sectors[idx]=newName;

  const items=getWatch();
  items.forEach(x=>{if(x.sector===oldName)x.sector=newName});
  if(activeSector===oldName) activeSector=newName;

  save("bj-sectors-final",sectors);
  save("bj-watch-v2",items);
  $("renameSectorName").value="";
  syncSectorControls();
  renderWatch();
};

$("deleteSector").onclick=()=>{
  const target=$("manageSectorSelect").value;
  if(!target) return;
  if(!confirm(`'${target}' 섹터와 그 안의 관심종목을 모두 삭제할까요?`)) return;

  save("bj-sectors-final",getSectors().filter(x=>x!==target));
  save("bj-watch-v2",getWatch().filter(x=>x.sector!==target));
  if(activeSector===target) activeSector="전체";
  syncSectorControls();
  renderWatch();
};

$("addWatch").onclick=()=>{
  const ticker=$("watchTicker").value.trim().toUpperCase();
  const name=$("watchName").value.trim();
  const sector=$("sectorSelect").value;
  if(!ticker||!name||!sector) return alert("섹터, 티커, 설명을 입력하세요.");

  const items=getWatch();
  items.push({sector,ticker,name});
  save("bj-watch-v2",items);

  $("watchTicker").value="";
  $("watchName").value="";
  renderWatch();
};

syncSectorControls();
renderWatch();

$("buildPrompt").onclick=()=>{
  const q=$("aiQuestion").value.trim();
  if(!q) return alert("분석할 질문을 입력하세요.");

  $("promptOutput").textContent=`너는 내 개인 투자 리서치 애널리스트다.

내 투자 성향:
- 추세추종과 눌림목 매매를 선호한다.
- 20일선은 핵심 추세선, 60일선은 중기 방어선으로 본다.
- 미국 2년물·10년물 금리와 장단기 스프레드, 달러, M2, VIX, WTI, 금, 구리를 함께 본다.
- 거래량, VWAP, VPVR, RSI, MACD를 활용한다.
- 반도체와 광통신 섹터에 관심이 많다.
- 강세/약세 시나리오와 리스크 관리를 중시한다.

분석 요청:
${q}

답변 형식:
1. 현재 시장 레짐
2. 핵심 매크로 근거
3. 금리와 유동성 해석
4. 위험자산 흐름
5. 강세 시나리오
6. 약세 시나리오
7. 확인해야 할 가격·지표
8. 대응 전략
9. 이 분석이 틀릴 수 있는 지점`;
};

$("copyPrompt").onclick=async()=>{
  try{
    await navigator.clipboard.writeText($("promptOutput").textContent);
    alert("복사했습니다.");
  }catch{
    alert("복사 실패");
  }
};
