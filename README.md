# BJ Market Terminal v6

## 구조
TradingView/네이버 차트를 임베드하지 않습니다.

1. GitHub Actions가 FRED CSV 데이터를 정기적으로 다운로드
2. `data/market-data.json`을 자동 갱신
3. 홈페이지는 로컬 JSON을 읽어 Chart.js로 차트를 직접 그림

## 포함 데이터
- DGS10: 미국 10년물
- DGS2: 미국 2년물
- 10Y-2Y: 브라우저에서 직접 계산
- M2SL: M2
- NASDAQCOM: 나스닥 종합
- DJIA: 다우
- KOSPI: 코스피
- VIXCLS: VIX
- DCOILWTICO: WTI
- GOLDAMGBD228NLBM: 금
- PCOPPUSDM: 구리
- DTWEXBGS: 미국 광의 달러지수

## 중요
초기 `data/market-data.json`은 사이트가 빈 화면이 되지 않도록 넣은 샘플 데이터입니다.
GitHub Actions의 `Update market data`를 한 번 수동 실행하면 실제 데이터로 교체됩니다.

## 업로드해야 하는 구조
- index.html
- style.css
- script.js
- data/market-data.json
- scripts/update_market_data.py
- .github/workflows/update-market-data.yml
