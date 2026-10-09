#!/usr/bin/env python3
"""Save historical DEMO portfolio risk metrics as a local JSON snapshot.

Run alongside market_risk.py and portfolio.json on the AWS server.
No HTTP server, secrets, brokerage access or file upload is performed.
Only use with DEMO inputs; do not publish snapshots of real holdings.
"""
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from market_risk import TRADING_DAYS, get_returns, load_portfolio

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'demo_risk_metrics.json'


def clean(value):
    if value is None:
        return None
    result = float(value)
    return round(result, 5) if math.isfinite(result) else None


def build_report(returns, benchmark, annual_rf, confidence, cash_krw, values, total):
    symbols = list(values)
    weights = pd.Series({s: values[s] / total for s in symbols}, dtype=float)
    series = returns[symbols].mul(weights, axis=1).sum(axis=1)
    reference = returns[benchmark]
    daily_rf = (1 + annual_rf) ** (1 / TRADING_DAYS) - 1
    sd = float(series.std(ddof=1))
    excess = series - daily_rf
    downside = float(np.sqrt(np.mean(np.minimum(excess, 0.0) ** 2)))
    beta = series.cov(reference) / reference.var(ddof=1) if reference.var(ddof=1) > 0 else None
    sharpe = (float(excess.mean()) / sd * np.sqrt(TRADING_DAYS)) if sd > 0 else None
    sortino = (float(excess.mean()) / downside * np.sqrt(TRADING_DAYS)) if downside > 0 else None
    quantile = float(series.quantile(1 - confidence))
    tail = series[series <= quantile]
    var_pct = max(0., -quantile * 100)
    cvar_pct = max(0., -float(tail.mean()) * 100)
    path = (1 + series).cumprod().to_numpy()
    running_peak = np.maximum.accumulate(np.r_[1., path])[1:]
    mdd_pct = float(np.min(path / running_peak - 1) * 100)
    contributions = {}
    cov = returns[symbols].cov().to_numpy()
    vector = weights.to_numpy()
    variance = float(vector @ cov @ vector)
    if variance > 0:
        marginal = cov @ vector
        contributions = {symbol: clean(100 * vector[i] * marginal[i] / variance)
                         for i, symbol in enumerate(symbols)}

    return {
        'schema_version': 1,
        'demo': True,
        'data_source': 'Yahoo Finance via yfinance (unofficial); adjusted daily closes',
        'calculated_at_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'period_start': str(returns.index.min().date()),
        'period_end': str(returns.index.max().date()),
        'daily_observations': int(len(returns)),
        'base_currency': 'KRW',
        'fx_assumption': 'USD/KRW exchange rate held constant',
        'portfolio_assumption': 'Static weights, rebalanced daily; cash return 0%',
        'benchmark': benchmark,
        'confidence': confidence,
        'risk_free_rate_annual': annual_rf,
        'demo_total_krw': round(total, 0),
        'weights_pct': {'CASH': clean(100 * cash_krw / total),
                        **{s: clean(100 * weights[s]) for s in symbols}},
        'metrics': {
            'portfolio_beta': clean(beta),
            'annual_volatility_pct': clean(sd * np.sqrt(TRADING_DAYS) * 100),
            'sharpe': clean(sharpe),
            'sortino': clean(sortino),
            'historical_1d_var_pct': clean(var_pct),
            'historical_1d_var_krw': round(var_pct * total / 100, 0),
            'historical_1d_cvar_pct': clean(cvar_pct),
            'historical_1d_cvar_krw': round(cvar_pct * total / 100, 0),
            'max_drawdown_pct': clean(mdd_pct),
        },
        'variance_contribution_pct': contributions,
        'limitations': 'Past returns are not predictions. No FX movements, fees, taxes, slippage, or actual trade history. Leveraged ETF and gap risks may exceed historic estimates.'
    }


def main():
    benchmark, rf, confidence, cash_krw, values, total, _fx = load_portfolio(ROOT / 'portfolio.json')
    if rf <= -1:
        raise ValueError('risk_free_rate must be greater than -100%')
    symbols = list(dict.fromkeys([*values, benchmark]))
    returns = get_returns(symbols)
    report = build_report(returns, benchmark, rf, confidence, cash_krw, values, total)
    tmp = OUTPUT.with_suffix('.json.tmp')
    try:
        with tmp.open('w', encoding='utf-8') as fh:
            json.dump(report, fh, indent=2, ensure_ascii=False, allow_nan=False)
            fh.write('\n')
        os.replace(tmp, OUTPUT)
    finally:
        tmp.unlink(missing_ok=True)
    print('DEMO RISK JSON READY:', OUTPUT.name)
    print('MARKET DATA THROUGH:', report['period_end'])
    print('BETA:', report['metrics']['portfolio_beta'])
    print('ANNUAL VOL (%):', report['metrics']['annual_volatility_pct'])
    print('Do not upload portfolio.json or actual account snapshots to public GitHub.')


if __name__ == '__main__':
    main()
