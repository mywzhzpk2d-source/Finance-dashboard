# BJ Market Terminal FINAL

최종 통합본입니다.

## 유지한 기능
- 기존 다크 터미널 디자인
- 매매일지
- 관심종목
- 섹터 추가 / 이름 변경 / 삭제
- AI Analyst

## 변경한 Macro 구조
TradingView / 네이버 차트를 임베드하지 않고 데이터 자체를 받아 Chart.js로 직접 표시합니다.

### 차트
- 미국 10년물
- 미국 2년물
- 10Y - 2Y 스프레드
- 달러지수
- M2
- 금
- WTI
- 구리
- NASDAQ
- Dow Jones
- KOSPI
- VIX
- 시장강도 순위

## GitHub 업로드 구조
반드시 폴더 구조까지 그대로 업로드해야 합니다.

- index.html
- style.css
- script.js
- data/market-data.json
- scripts/update_market_data.py
- .github/workflows/update-market-data.yml

## 실제 데이터 갱신
GitHub에서:
Actions → Update market data → Run workflow

한 번 수동 실행하면 `data/market-data.json`이 실제 데이터로 갱신됩니다.
이후 평일 하루 4회 자동 실행됩니다.

## 참고
최초 업로드 직후에는 화면이 비지 않도록 샘플 데이터가 들어 있습니다.
GitHub Action 실행 후 자동 데이터로 교체됩니다.

참고: KOSPI는 FRED에 표준 시리즈로 없어서 Yahoo Finance(^KS11)에서 대신 받아옵니다.
Yahoo 쪽 요청이 일시적으로 막히면 그 회차만 실패하고, 이전에 받아둔 데이터가 그대로 유지됩니다.
