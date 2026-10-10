#!/usr/bin/env python3
"""Generic, local-only portfolio risk preview.

Reads the existing local portfolio.json structure; supports any US Yahoo Finance
stock/ETF ticker. Writes a separate private preview file and never changes the
production API snapshot, cron job, or public GitHub Pages.

Usage: .venv/bin/python generic_market_risk.py
       .venv/bin/python generic_market_risk.py --self-test
"""
from __future__ import annotations
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / 'portfolio.json'
DEFAULT_OUTPUT = ROOT / 'generic_risk_preview.json'
BENCHMARK = 'SPY'


def portfolio_data(path: Path):
    raw = json.loads(path.read_text(encoding='utf-8'))
    positions = raw.get('positions')
    if not isinstance(positions, list) or not positions:
        raise ValueError('portfolio.json: positions must be a nonempty list')
    fx = float(raw.get('usdkrw', 0))
    if not np.isfinite(fx) or fx <= 0:
        raise ValueError('portfolio.json: positive usdkrw required')
    cash = raw.get('cash')
    if not isinstance(cash, dict):
        raise ValueError('portfolio.json: cash must be a currency-to-amount dictionary')
    cash_value = float(cash.get('KRW', 0)) + float(cash.get('USD', 0))*fx
    if not np.isfinite(cash_value) or cash_value < 0:
        raise ValueError('invalid cash amounts')
    amounts = {}
    for item in positions:
        ticker = str(item['ticker']).upper().strip()
        if not ticker or not all(c.isalnum() or c in '.-^=' for c in ticker):
            raise ValueError('invalid ticker')
        quantity, price = float(item['quantity']), float(item['price'])
        currency = str(item.get('currency', 'USD')).upper()
        if currency not in ('USD', 'KRW'):
            raise ValueError(f'{ticker}: only USD/KRW demo valuation currently supported')
        value = quantity*price*(fx if currency == 'USD' else 1.0)
        if not np.isfinite(value) or value <= 0:
            raise ValueError(f'{ticker}: invalid position size or price')
        amounts[ticker] = amounts.get(ticker, 0.0) + value
    total = cash_value + sum(amounts.values())
    if total <= 0:
        raise ValueError('zero portfolio valuation')
    return raw, amounts, total, cash_value


def download_prices(tickers):
    import yfinance as yf
    frame = yf.download(tickers=tickers, period='18mo', interval='1d', auto_adjust=True,
                        progress=False, threads=False, group_by='column')
    if frame.empty:
        raise RuntimeError('Yahoo Finance returned no data')
    closes = frame['Close']
    if isinstance(closes, pd.Series):
        closes = closes.to_frame(name=tickers[0])
    closes.columns = [str(c).upper() for c in closes.columns]
    missing = sorted(set(tickers) - set(closes.columns))
    if missing:
        raise RuntimeError('Ticker data missing: '+', '.join(missing))
    closes = closes[tickers].apply(pd.to_numeric, errors='coerce').replace([np.inf, -np.inf], np.nan)
    closes = closes.dropna(how='any')
    if len(closes) < 180:
        raise RuntimeError(f'Only {len(closes)} overlapping price dates. Need at least 180.')
    return closes.tail(253)


def evaluate(raw, amounts, total, cash_value, close):
    symbols = list(amounts)
    bench = str(raw.get('risk_settings', {}).get('benchmark', BENCHMARK)).upper()
    if bench not in close:
        raise ValueError(f'benchmark missing: {bench}')
    rets = close.pct_change(fill_method=None).dropna(how='any')
    if len(rets) < 120:
        raise ValueError(f'Not enough aligned daily returns: {len(rets)}')
    prices = rets[symbols]
    rb = rets[bench]
    weights = pd.Series({s: amounts[s]/total for s in symbols}, dtype=float)
    rp = prices @ weights
    bvar = float(rb.var(ddof=1))
    pvar = float(rp.var(ddof=1))
    if bvar <= 0 or pvar <= 0:
        raise ValueError('nonpositive return variance')
    beta = float(rp.cov(rb)/bvar)
    vol = float(rp.std(ddof=1)*np.sqrt(252)*100)
    rf = float(raw.get('risk_settings', {}).get('risk_free_rate', 0.03))
    if not np.isfinite(rf) or rf < -1:
        raise ValueError('invalid risk-free rate')
    daily_excess = rp - ((1+rf)**(1/252)-1)
    sharpe = float(daily_excess.mean()/rp.std(ddof=1)*np.sqrt(252))
    downside = float(np.sqrt(np.mean(np.minimum(daily_excess.to_numpy(), 0)**2)))
    sortino = float(daily_excess.mean()/downside*np.sqrt(252)) if downside else None
    alpha = float(np.quantile(rp, .05))
    tail = rp[rp <= alpha]
    var_pct = max(0, -alpha*100)
    cvar_pct = max(0, -float(tail.mean())*100) if len(tail) else None
    path = (1+rp).cumprod()
    mdd = float(((path/path.cummax())-1).min()*100)
    risk_contribution = {s: float(weights[s]*prices[s].cov(rp)/pvar*100) for s in symbols}
    individual = {}
    for s in symbols:
        x = prices[s]
        individual[s] = {
            'weight_pct': round(float(weights[s]*100), 4),
            'beta_vs_benchmark': round(float(x.cov(rb)/bvar), 5),
            'annual_volatility_pct': round(float(x.std(ddof=1)*np.sqrt(252)*100), 5),
            'correlation_vs_benchmark': round(float(x.corr(rb)), 5),
            'risk_contribution_pct': round(risk_contribution[s], 5),
        }
    corr = prices.corr()
    output = {
        'schema_version': 2, 'demo': True, 'privacy': 'LOCAL PREVIEW ONLY — DO NOT PUBLISH REAL HOLDINGS',
        'calculated_at_utc': datetime.now(timezone.utc).isoformat(),
        'data_source': 'Yahoo Finance adjusted historical daily close via yfinance',
        'period_start': str(rets.index[0].date()), 'period_end': str(rets.index[-1].date()),
        'daily_observations': len(rets), 'benchmark': bench,
        'assumptions': 'Demo holdings and manually entered current prices/FX; USD/KRW held fixed, daily fixed-weight rebalancing, zero cash return; excludes costs',
        'demo_total_krw': round(total, 2), 'cash_weight_pct': round(cash_value/total*100, 4),
        'tickers': symbols, 'individual': individual,
        'correlations': {a: {b: round(float(corr.loc[a,b]), 5) for b in symbols} for a in symbols},
        'portfolio': {'beta': round(beta, 5), 'annual_volatility_pct': round(vol, 5),
                      'sharpe': round(sharpe, 5), 'sortino': round(sortino, 5) if sortino is not None else None,
                      'historical_1d_var_95_pct': round(var_pct, 5),
                      'historical_1d_cvar_95_pct': round(cvar_pct, 5) if cvar_pct is not None else None,
                      'max_drawdown_pct': round(mdd, 5)},
        'risk_contribution_pct': {s: round(v, 5) for s,v in risk_contribution.items()},
    }
    return output


def self_test():
    dates = pd.bdate_range('2025-01-02', periods=253)
    rng = np.random.default_rng(20261010)
    market = rng.normal(.0004, .012, len(dates))
    returns = pd.DataFrame({'SPY': market, 'AAA': market*1.6+rng.normal(0,.015,len(dates)),
                             'BBB': market*.7+rng.normal(0,.009,len(dates))}, index=dates)
    close = (1+returns).cumprod()*100
    example={'risk_settings': {'benchmark': 'SPY', 'risk_free_rate':.03}}
    result=evaluate(example, {'AAA':40000000, 'BBB':20000000}, 80000000, 20000000, close)
    assert result['tickers']==['AAA','BBB']
    assert abs(sum(result['risk_contribution_pct'].values())-100)<.01
    assert len(result['correlations'])==2
    print('SELF-TEST OK: arbitrary tickers, risk contribution, correlation matrix')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,default=DEFAULT_INPUT)
    parser.add_argument('--output',type=Path,default=DEFAULT_OUTPUT)
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:
        self_test();return
    raw, amounts, total, cash_value=portfolio_data(args.input)
    tickers=list(amounts)
    bench=str(raw.get('risk_settings',{}).get('benchmark',BENCHMARK)).upper()
    requested=list(dict.fromkeys(tickers+[bench]))
    close=download_prices(requested)
    result=evaluate(raw,amounts,total,cash_value,close)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('GENERIC RISK PREVIEW READY:',args.output.name)
    print('TICKERS:',', '.join(result['tickers']))
    print('OBSERVATIONS:',result['daily_observations'])
    print('BETA:',result['portfolio']['beta'])
    print('INDIVIDUAL VOLATILITY:',{s:x['annual_volatility_pct'] for s,x in result['individual'].items()})
    print('CORRELATION MATRIX:',result['correlations'])
    print('Only local preview was written. Existing API and scheduled jobs unchanged.')

if __name__=='__main__':
    main()
