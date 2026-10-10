#!/usr/bin/env python3
"""Create an explicit, one-time PUBLIC DEMO snapshot from local generic preview.

Never use this with actual account holdings. It refuses other ticker sets or
changed demo portfolio totals. Does not alter the running API or Nginx.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'generic_risk_preview.json'
DEST = ROOT / 'generic_public_demo.json'
DEMO_TICKERS = {'SOXL', 'MU', 'COHR'}
DEMO_TOTAL_KRW = 68_600_000


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('Expected a finite numerical demo metric')
    return round(float(value), 5)


def main():
    obj = json.loads(SOURCE.read_text(encoding='utf-8'))
    tickers = obj.get('tickers')
    if obj.get('schema_version') != 2 or obj.get('demo') is not True:
        raise ValueError('Not an explicitly labeled demo analysis')
    if not isinstance(tickers, list) or len(tickers) != 3 or set(tickers) != DEMO_TICKERS:
        raise ValueError('Refusing to publish a changed portfolio: demo tickers do not match')
    if abs(number(obj.get('demo_total_krw')) - DEMO_TOTAL_KRW) > 1:
        raise ValueError('Refusing to publish a changed portfolio: demo total does not match')
    individual = obj['individual']
    correlations = obj['correlations']
    risk = obj['risk_contribution_pct']
    fields = ('weight_pct', 'beta_vs_benchmark', 'annual_volatility_pct',
              'correlation_vs_benchmark', 'risk_contribution_pct')
    result = {
        'schema_version': 1,
        'demo': True,
        'source': 'public fictional demo portfolio / Yahoo Finance historical prices',
        'period_start': str(obj['period_start']),
        'period_end': str(obj['period_end']),
        'daily_observations': int(obj['daily_observations']),
        'benchmark': str(obj['benchmark']),
        'tickers': tickers,
        'individual': {s: {k: number(individual[s][k]) for k in fields} for s in tickers},
        'correlations': {a: {b: number(correlations[a][b]) for b in tickers} for a in tickers},
        'risk_contribution_pct': {s: number(risk[s]) for s in tickers},
        'limitations': 'Fictional holdings only; historical estimates, not forecasts. Never publish real holdings.'
    }
    if not 120 <= result['daily_observations'] <= 400:
        raise ValueError('Unexpected daily observation count')
    if any(not -1.00001 <= v <= 1.00001 for row in result['correlations'].values() for v in row.values()):
        raise ValueError('Invalid correlations')
    DEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('PUBLIC DEMO SNAPSHOT READY:', DEST)
    print('TICKERS:', ', '.join(tickers))
    print('PERIOD:', result['period_start'], 'to', result['period_end'])
    print('Existing API, cron, Nginx and portfolio input UNCHANGED.')
    print('Next: create a separate DEMO-only authenticated-data-safe endpoint.')

if __name__ == '__main__':
    main()
