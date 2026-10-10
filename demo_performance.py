#!/usr/bin/env python3
"""STEP 35: local, strictly fictional demo portfolio vs SPY performance preview.

Reads portfolio.json locally, downloads daily adjusted prices, and writes ONLY a
local preview JSON. Does not modify Nginx, running API, public GitHub, or cron.
Never publish the preview or run against real-account holdings.

Usage:
  .venv/bin/python demo_performance.py --self-test
  .venv/bin/python demo_performance.py
"""
from __future__ import annotations
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / 'portfolio.json'
OUTPUT = ROOT / 'demo_performance_preview.json'
EXPECTED = {'SOXL', 'MU', 'COHR'}
EXPECTED_TOTAL = 68_600_000
BENCHMARK = 'SPY'
WINDOWS = {'1M': 21, '3M': 63, '6M': 126, '1Y': 252}


def read_demo(path: Path):
    obj = json.loads(path.read_text(encoding='utf-8'))
    positions = obj.get('positions', [])
    symbols = [str(p['ticker']).upper() for p in positions]
    if len(symbols) != 3 or set(symbols) != EXPECTED:
        raise ValueError('DEMO GUARD: Refusing non-demo ticker set; do not use real holdings.')
    fx = float(obj.get('usdkrw', 0))
    cash = obj.get('cash', {})
    if not np.isfinite(fx) or fx <= 0 or not isinstance(cash, dict):
        raise ValueError('Invalid demo FX or cash')
    cash_krw = float(cash.get('KRW', 0)) + float(cash.get('USD', 0)) * fx
    amounts = {}
    for p in positions:
        ticker = str(p['ticker']).upper()
        cur = p.get('currency', 'USD').upper()
        if cur not in ('USD', 'KRW'):
            raise ValueError('Unexpected demo currency')
        amounts[ticker] = amounts.get(ticker, 0) + float(p['quantity']) * float(p['price']) * (fx if cur == 'USD' else 1)
    total = cash_krw + sum(amounts.values())
    if not np.isfinite(total) or abs(total - EXPECTED_TOTAL) > 1 or cash_krw < 0 or any(v <= 0 or not np.isfinite(v) for v in amounts.values()):
        raise ValueError('DEMO GUARD: Portfolio total differs from known fictional example.')
    weights = {t: amounts[t] / total for t in sorted(EXPECTED)}
    return weights, cash_krw / total


def download_prices():
    import yfinance as yf
    symbols = sorted(EXPECTED | {BENCHMARK})
    frame = yf.download(tickers=symbols, period='18mo', interval='1d', auto_adjust=True,
                        progress=False, threads=False, group_by='column')
    if frame.empty:
        raise RuntimeError('No Yahoo Finance market prices')
    closes = frame['Close']
    if isinstance(closes, pd.Series):
        raise RuntimeError('Unexpected one-ticker response')
    closes.columns = [str(x).upper() for x in closes.columns]
    if not set(symbols).issubset(closes.columns):
        raise RuntimeError('Missing market ticker data')
    closes = closes[symbols].apply(pd.to_numeric, errors='coerce').replace([np.inf, -np.inf], np.nan).dropna(how='any')
    if len(closes) < 253:
        raise RuntimeError('Need at least 253 aligned trading-day price observations')
    return closes.tail(253)


def calculate(closes: pd.DataFrame, weights: dict[str, float], cash_weight: float):
    if set(weights) != EXPECTED or not np.isclose(sum(weights.values()) + cash_weight, 1, atol=1e-6):
        raise ValueError('Invalid fixed demo weights')
    returns = closes.pct_change(fill_method=None).dropna(how='any')
    returns = returns.tail(252)
    if len(returns) != 252 or not np.isfinite(returns.to_numpy()).all():
        raise ValueError('Need 252 clean aligned daily returns')
    rp = sum(returns[t] * w for t, w in weights.items())  # zero-return demo cash; daily constant weights
    rb = returns[BENCHMARK]
    if (rp <= -1).any() or (rb <= -1).any():
        raise ValueError('Invalid daily returns for compounding')
    records = []
    cp = 1.0
    cb = 1.0
    # Opening 0% baseline allows 1Y and all shorter windows to align exactly.
    records.append({'date': str(closes.index[-253].date()), 'portfolio_pct': 0.0, 'spy_pct': 0.0})
    for date, p, b in zip(returns.index, rp, rb):
        cp *= 1 + float(p)
        cb *= 1 + float(b)
        records.append({'date': str(date.date()), 'portfolio_pct': round((cp - 1) * 100, 4),
                        'spy_pct': round((cb - 1) * 100, 4)})
    periods = {}
    for label, n in WINDOWS.items():
        p = rp.iloc[-n:]
        b = rb.iloc[-n:]
        cpw = (1 + p).cumprod()
        cbw = (1 + b).cumprod()
        p_return = (float(cpw.iloc[-1]) - 1) * 100
        b_return = (float(cbw.iloc[-1]) - 1) * 100
        # Initial balance 1 is part of the MDD peak, otherwise early drawdown is missed.
        p_path = np.r_[1.0, cpw.to_numpy()]
        b_path = np.r_[1.0, cbw.to_numpy()]
        p_mdd = float(np.min(p_path / np.maximum.accumulate(p_path) - 1) * 100)
        b_mdd = float(np.min(b_path / np.maximum.accumulate(b_path) - 1) * 100)
        periods[label] = {'trading_days': n,
                          'period_start': str(closes.index[-n-1].date()),
                          'period_end': str(closes.index[-1].date()),
                          'portfolio_return_pct': round(p_return, 4),
                          'spy_return_pct': round(b_return, 4),
                          'excess_return_pct': round(p_return - b_return, 4),
                          'portfolio_mdd_pct': round(p_mdd, 4),
                          'spy_mdd_pct': round(b_mdd, 4)}
    return {'schema_version': 1, 'demo': True, 'privacy': 'LOCAL PREVIEW - do not upload real holdings',
            'calculated_at_utc': datetime.now(timezone.utc).isoformat(),
            'data_source': 'Yahoo Finance auto-adjusted daily closes (unofficial)',
            'benchmark': BENCHMARK,
            'assumptions': 'Fictional SOXL/MU/COHR portfolio; fixed daily weights; zero-return cash; constant FX; excludes fees, taxes, slippage, dividends on cash and actual P&L',
            'period_start': records[0]['date'], 'period_end': records[-1]['date'],
            'daily_observations': 252,
            'daily_cumulative_returns': records,
            'periods': periods}


def self_test():
    dates = pd.bdate_range('2025-01-02', periods=253)
    # Down-then-up paths deliberately test drawdown and cumulative return maths.
    factor = np.linspace(-0.003, 0.003, 252)
    series = pd.DataFrame({'SOXL': np.r_[100, 100 * np.cumprod(1 + factor * 3)],
                           'MU': np.r_[100, 100 * np.cumprod(1 + factor * 2)],
                           'COHR': np.r_[100, 100 * np.cumprod(1 + factor)],
                           'SPY': np.r_[100, 100 * np.cumprod(1 + factor * .5)]}, index=dates)
    result = calculate(series, {'SOXL': .2244898, 'MU': .244898, 'COHR': .1734694}, .3571428)
    assert len(result['daily_cumulative_returns']) == 253
    assert result['daily_cumulative_returns'][0]['portfolio_pct'] == 0
    assert all(result['periods'][k]['trading_days'] == n for k, n in WINDOWS.items())
    assert all(result['periods'][k]['portfolio_mdd_pct'] <= 0 for k in WINDOWS)
    print('SELF-TEST OK: rolling performance windows, SPY excess return, MDD, 253 chart points')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    weights, cash_weight = read_demo(INPUT)
    result = calculate(download_prices(), weights, cash_weight)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DEMO PERFORMANCE PREVIEW READY:', OUTPUT)
    print('PERIOD:', result['period_start'], 'to', result['period_end'])
    print('TRADING DAYS:', result['daily_observations'])
    for k, v in result['periods'].items():
        print(k, 'portfolio=', v['portfolio_return_pct'], 'SPY=', v['spy_return_pct'],
              'excess=', v['excess_return_pct'], 'MDD=', v['portfolio_mdd_pct'])
    print('Existing API, cron, and Nginx UNCHANGED. Do NOT upload JSON to public GitHub.')


if __name__ == '__main__':
    main()
