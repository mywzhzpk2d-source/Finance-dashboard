
const $ = (id) => document.getElementById(id);
const pages = {macro:"Macro 분석",ai:"AI Analyst",news:"뉴스룸"};

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

$("buildPrompt").onclick=()=>{
  const q=$("aiQuestion").value.trim();
  if(!q) return alert("분석할 질문을 입력하세요.");

  $("promptOutput").textContent=`너는 내 개인 투자 리서치 애널리스트다.

내 투자 성향:
- 추세추종과 눌림목 매매를 선호한다.
- 20일선은 핵심 추세선, 60일선은 중기 방어선으로 본다.
- 미국 2년물·10년물 금리, 달러, VIX, WTI, 금을 함께 본다.
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

// ---- CNN Fear & Greed gauge ----
// 1) CNN 내부 엔드포인트를 직접 fetch 시도 → 2) CORS로 막히면 공개 프록시로 재시도 → 3) 그래도 실패하면 아래 수동값 사용
const fgScoreVal = 62; // 자동 fetch가 모두 실패했을 때 쓰이는 수동 백업값. cnn.com/markets/fear-and-greed 값을 보고 직접 수정
function fgLabelFor(score){
  if(score<25) return ["EXTREME FEAR","#ef4444"];
  if(score<45) return ["FEAR","#f59e0b"];
  if(score<55) return ["NEUTRAL","#eab308"];
  if(score<75) return ["GREED","#84cc16"];
  return ["EXTREME GREED","#22c55e"];
}
function renderFearGreed(score){
  const svg=$("fgGauge");
  if(!svg) return;
  svg.innerHTML="";
  const cx=120,cy=120,r=95,thickness=16;
  const segments=[
    {from:0,to:25,color:"#ef4444"},
    {from:25,to:45,color:"#f59e0b"},
    {from:45,to:55,color:"#eab308"},
    {from:55,to:75,color:"#84cc16"},
    {from:75,to:100,color:"#22c55e"},
  ];
  const pt=(val,radius)=>{
    const angle=Math.PI-(val/100)*Math.PI;
    return [cx+radius*Math.cos(angle), cy-radius*Math.sin(angle)];
  };
  segments.forEach(seg=>{
    const [x1,y1]=pt(seg.from,r), [x2,y2]=pt(seg.to,r);
    const large=(seg.to-seg.from)>50?1:0;
    const path=document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d",`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`);
    path.setAttribute("fill","none");
    path.setAttribute("stroke",seg.color);
    path.setAttribute("stroke-width",thickness);
    svg.appendChild(path);
  });
  const needleAngle=Math.PI-(score/100)*Math.PI;
  const nx=cx+(r-22)*Math.cos(needleAngle), ny=cy-(r-22)*Math.sin(needleAngle);
  const needle=document.createElementNS("http://www.w3.org/2000/svg","line");
  needle.setAttribute("x1",cx); needle.setAttribute("y1",cy);
  needle.setAttribute("x2",nx); needle.setAttribute("y2",ny);
  needle.setAttribute("stroke","#eef2f7"); needle.setAttribute("stroke-width","2.5"); needle.setAttribute("stroke-linecap","round");
  svg.appendChild(needle);
  const hub=document.createElementNS("http://www.w3.org/2000/svg","circle");
  hub.setAttribute("cx",cx); hub.setAttribute("cy",cy); hub.setAttribute("r","4"); hub.setAttribute("fill","#eef2f7");
  svg.appendChild(hub);
}
function applyFearGreed(score,ratingText){
  renderFearGreed(score);
  if($("fgScore")) $("fgScore").textContent=Math.round(score);
  if($("fgLabelBadge")){
    const [lbl,color]=fgLabelFor(score);
    $("fgLabelBadge").textContent=ratingText?ratingText.toUpperCase():lbl;
    $("fgLabelBadge").style.color=color;
    $("fgLabelBadge").style.borderColor=color;
  }
}
function ratingKo(r){
  const map={"extreme fear":"Extreme Fear","fear":"Fear","neutral":"Neutral","greed":"Greed","extreme greed":"Extreme Greed"};
  return map[(r||"").toLowerCase()]||r||"";
}
async function fetchFearGreed(){
  const today=new Date().toISOString().slice(0,10);
  const directUrl=`https://production.dataviz.cnn.io/index/fearandgreed/graphdata/${today}`;
  const proxyUrl=`https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
  let data=null;
  for(const url of [directUrl,proxyUrl]){
    try{
      const res=await fetch(url);
      if(res.ok){ data=await res.json(); break; }
    }catch(e){ /* CORS 또는 네트워크 오류 - 다음 방법 시도 */ }
  }
  if(data && data.fear_and_greed && typeof data.fear_and_greed.score==="number"){
    const fg=data.fear_and_greed;
    applyFearGreed(fg.score, fg.rating);
    if($("fgPrev")) $("fgPrev").textContent=`${Math.round(fg.previous_close)} · ${ratingKo(fgLabelFor(fg.previous_close)[0].toLowerCase())}`;
    if($("fgWeek")) $("fgWeek").textContent=`${Math.round(fg.previous_1_week)} · ${ratingKo(fgLabelFor(fg.previous_1_week)[0].toLowerCase())}`;
    if($("fgMonth")) $("fgMonth").textContent=`${Math.round(fg.previous_1_month)} · ${ratingKo(fgLabelFor(fg.previous_1_month)[0].toLowerCase())}`;
    if($("fgYear")) $("fgYear").textContent=`${Math.round(fg.previous_1_year)} · ${ratingKo(fgLabelFor(fg.previous_1_year)[0].toLowerCase())}`;
    if($("fgSrc")){ $("fgSrc").textContent="실시간 · CNN 공식 엔드포인트"; }
    if($("fgNote")) $("fgNote").textContent="CNN 내부 데이터 엔드포인트에서 실시간으로 가져온 값입니다 (비공식 경로이므로 CNN 측 변경 시 자동 폴백됩니다).";
  } else {
    applyFearGreed(fgScoreVal);
    if($("fgSrc")) $("fgSrc").textContent="수동값 표시 중 · 자동 fetch 실패(CORS 등)";
    if($("fgNote")) $("fgNote").textContent="CNN 엔드포인트 자동 조회가 이 환경에서 차단되어 수동값을 표시 중입니다. cnn.com/markets/fear-and-greed 값을 보고 script.js의 fgScoreVal을 갱신하세요.";
  }
}
renderFearGreed(fgScoreVal);
if($("fgScore")) $("fgScore").textContent=fgScoreVal;
fetchFearGreed();

// ---- Central bank policy rates: 위 HTML에 TradingView Market Overview 위젯으로 직접 임베드됨 (아래 JS 불필요) ----


