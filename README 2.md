# BJ Market Terminal (TradingView 위젯 버전)

## 구조
이제 백엔드가 없습니다. GitHub Actions, Python 스크립트, data/market-data.json이
전부 필요 없어요. 아래 3개 파일만 있으면 됩니다.

- index.html
- style.css
- script.js

## GitHub 업로드
저장소를 비우고 위 3개 파일만 루트에 올리면 됩니다. 폴더 구조 신경 쓸 필요 없어요.

## 기존 파일 정리
아래는 더 이상 필요 없으니 저장소에서 삭제해도 됩니다.
- data/ 폴더 (market-data.json)
- scripts/ 폴더 (update_market_data.py)
- .github/workflows/update-market-data.yml

## 데이터 소스
모든 차트는 TradingView 공개 위젯을 그대로 임베드합니다 (API 키 불필요).
- 금리: FRED:DGS10, FRED:DGS2
- 10Y-2Y 스프레드: FRED:T10Y2Y (FRED가 이미 계산해서 제공)
- 달러인덱스: TVC:DXY
- M2: FRED:M2SL
- 금: TVC:GOLD
- WTI: TVC:USOIL
- 구리: COMEX:HG1!
- NASDAQ: NASDAQ:IXIC
- Dow: TVC:DJI
- KOSPI: KRX:KOSPI (한국거래소 실데이터, 별도 우회 불필요)
- VIX: TVC:VIX

## 참고
"시장강도 순위"는 TradingView Market Overview 위젯으로 대체되어, 등수 정렬 대신
각 자산의 등락률을 나란히 보여주는 방식입니다.
