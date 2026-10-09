#!/usr/bin/env python3
"""Market-data-based historical risk study of a DEMO, static-weight portfolio.

Reads a local portfolio.json, downloads adjusted daily prices from Yahoo Finance
via yfinance, and computes historical metrics. Does not contain account keys.
No order placement, portfolio file modification, or API exposure.
"""
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

PERIOD = "1y"
TRADING_DAYS = 252
MIN_DAILY_RETURNS = 60


def numeric(value, name):
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid number for {name}: {value!r}") from None
    if not math.isfinite(result):
        raise ValueError(f"Non-finite number for {name}")
    return result


def cash_amount(cash, currency):
    if isinstance(cash, dict):
        return numeric(cash.get(currency, 0), f"cash.{currency}")
    raise ValueError("cash must be an object with KRW and USD keys")


def load_portfolio(path):
    cfg = json.loads(path.read_text(encoding="utf-8"))
    holdings = cfg.get("positions")
    if not isinstance(holdings, list) or not holdings:
        raise ValueError("positions must be a nonempty list")

    # The current demo config expresses stock prices in their currency and
    # cash in KRW/USD, with a manually specified USD/KRW conversion rate.
    fx = numeric(cfg.get("usdkrw"), "usdkrw")
    if fx <= 0:
        raise ValueError("usdkrw must be positive")
    base = cfg.get("base_currency", "KRW")
    if base != "KRW":
        raise ValueError("This demo risk model currently requires KRW as base_currency")
    cash = cfg.get("cash", {})
    krw_cash = cash_amount(cash, "KRW")
    usd_cash = cash_amount(cash, "USD")
    if min(krw_cash, usd_cash) < 0:
        raise ValueError("Negative cash requires separate borrowing modeling")
    cash_krw = krw_cash + usd_cash * fx
    settings = cfg.get("risk_settings") or {}
    benchmark = str(settings.get("benchmark", "SPY")).strip().upper()
    rf = numeric(settings.get("risk_free_rate", 0.03), "risk_free_rate")
    confidence = numeric(settings.get("confidence_level", 0.95), "confidence_level")
    if not 0 < confidence < 1:
        raise ValueError("confidence_level must be between 0 and 1")

    values = {}
    for row in holdings:
        symbol = str(row["ticker"]).strip().upper()
        if not symbol:
            raise ValueError("Missing ticker")
        qty = numeric(row["quantity"], f"{symbol}.quantity")
        price = numeric(row["price"], f"{symbol}.price")
        cur = str(row.get("currency", "USD")).upper()
        if cur not in ("USD", "KRW"):
            raise ValueError(f"Unsupported currency {cur} for {symbol}")
        if qty < 0 or price <= 0:
            raise ValueError("This version supports long positions with positive prices")
        value_krw = qty * price * (fx if cur == "USD" else 1)
        values[symbol] = values.get(symbol, 0.0) + value_krw
    total = cash_krw + sum(values.values())
    if total <= 0:
        raise ValueError("Total portfolio value must be positive")
    return benchmark, rf, confidence, cash_krw, values, total, fx


def get_returns(symbols):
    raw = yf.download(
        symbols, period=PERIOD, auto_adjust=True, progress=False,
        threads=False, group_by="column", timeout=20,
    )
    if raw is None or raw.empty:
        raise RuntimeError("Price download returned no data")
    close = raw["Close"]
    if isinstance(close, pd.Series):
        close = close.to_frame(name=symbols[0])
    missing = [s for s in symbols if s not in close.columns]
    if missing:
        raise RuntimeError(f"Missing symbols from price feed: {missing}")
    # Explicitly discard invalid observations; never silently fill missing prices.
    prices = close[symbols].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
    prices = prices.where(prices > 0).dropna(how="any")
    if len(prices) < MIN_DAILY_RETURNS + 1:
        raise RuntimeError(f"Insufficient common price dates: {len(prices)}")
    returns = prices.pct_change(fill_method=None).iloc[1:].dropna(how="any")
    if len(returns) < MIN_DAILY_RETURNS:
        raise RuntimeError(f"Insufficient aligned daily returns: {len(returns)}")
    return returns


def summarize(returns, benchmark, rf, confidence, cash_krw, values, total):
    symbols = list(values)
    weights = pd.Series({s: values[s] / total for s in symbols}, dtype=float)
    cash_weight = cash_krw / total
    # Hypothetical constant-weight daily rebalanced portfolio.
    # Cash earns 0%, and USD/KRW is held fixed throughout this analysis.
    r_portfolio = returns[symbols].mul(weights, axis=1).sum(axis=1)
    r_benchmark = returns[benchmark]
    daily_rf = (1 + rf) ** (1 / TRADING_DAYS) - 1 if rf > -1 else None
    if daily_rf is None:
        raise ValueError("risk_free_rate must be greater than -100%")
    vol_daily = r_portfolio.std(ddof=1)
    down_dev = np.sqrt(np.mean(np.minimum(r_portfolio - daily_rf, 0) ** 2))
    sharpe = ((r_portfolio.mean() - daily_rf) / vol_daily * np.sqrt(TRADING_DAYS)) if vol_daily > 0 else None
    sortino = ((r_portfolio.mean() - daily_rf) / down_dev * np.sqrt(TRADING_DAYS)) if down_dev > 0 else None
    b_var = r_benchmark.var(ddof=1)
    beta = r_portfolio.cov(r_benchmark) / b_var if b_var > 0 else None

    # A loss is positive by convention. Non-positive VaR means the empirical
    # tail quantile itself was not a loss.
    q = float(r_portfolio.quantile(1 - confidence))
    tail = r_portfolio[r_portfolio <= q]
    var_pct = -q * 100
    cvar_pct = -float(tail.mean()) * 100
    growth = (1 + r_portfolio).cumprod()
    peak = np.maximum.accumulate(np.r_[1.0, growth.to_numpy()])[1:]
    drawdown = growth.to_numpy() / peak - 1
    mdd_pct = float(drawdown.min() * 100)

    # Component contributions to variance; the percentages add to ~100% if
    # annual volatility is nonzero. Negative entries are possible for hedges.
    variance_contributions = {}
    if vol_daily > 0:
        cov = returns[symbols].cov()
        vector = weights.to_numpy()
        portfolio_var = float(vector @ cov.to_numpy() @ vector)
        if portfolio_var > 0:
            for idx, sym in enumerate(symbols):
                variance_contributions[sym] = float(100 * vector[idx] * (cov.to_numpy() @ vector)[idx] / portfolio_var)

    def show(x, decimals=2, suffix=""):
        return "N/A" if x is None or not np.isfinite(x) else f"{x:.{decimals}f}{suffix}"

    print("=" * 58)
    print("MARKET RISK | DEMO POSITIONS + REAL HISTORICAL RETURNS")
    print("=" * 58)
    print("Price feed: Yahoo Finance via yfinance (unofficial)")
    print(f"Calculated UTC: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}")
    print(f"Common daily returns: {len(returns)}")
    print(f"Period (UTC-like exchange dates): {returns.index.min().date()} to {returns.index.max().date()}")
    print(f"Benchmark: {benchmark} | Confidence: {confidence:.0%} | Risk-free: {rf:.1%}/yr")
    print(f"Demo assets (KRW): {total:,.0f}")
    print(f"Weights: Cash {cash_weight:.2%}; " + "; ".join(f"{s} {weights[s]:.2%}" for s in symbols))
    print("\n[Portfolio metrics, constant weights, KRW FX held constant]")
    print(f"Portfolio beta vs {benchmark}: {show(beta)}")
    print(f"Annual volatility: {show(vol_daily * np.sqrt(TRADING_DAYS) * 100)}%")
    print(f"Annualized Sharpe: {show(sharpe)}")
    print(f"Annualized Sortino: {show(sortino)}")
    print(f"Historical 1-day VaR ({confidence:.0%}): {show(var_pct)}% / KRW {max(0, var_pct) * total / 100:,.0f}")
    print(f"Historical 1-day CVaR ({confidence:.0%}): {show(cvar_pct)}% / KRW {max(0, cvar_pct) * total / 100:,.0f}")
    print(f"Max drawdown (rebalanced path): {show(mdd_pct)}%")
    print("\n[Contribution to daily return variance (%)]")
    for s, contribution in variance_contributions.items():
        print(f"{s}: {contribution:.2f}%")
    print("\nLIMITATIONS: Historical, not predictive. Demo prices and FX are manual.")
    print("Cash return = 0%; no FX movements, taxes, slippage or trading costs.")
    print("Assumes daily constant-weight rebalancing, not actual buy-and-hold P&L.")
    print("Leverage, gaps, and tail dependence may exceed historical estimates.")


def main():
    path = Path(__file__).resolve().parent / "portfolio.json"
    if not path.is_file():
        raise FileNotFoundError(f"Missing config: {path}")
    benchmark, rf, confidence, cash_krw, values, total, _ = load_portfolio(path)
    symbols = list(dict.fromkeys([*values.keys(), benchmark]))
    returns = get_returns(symbols)
    summarize(returns, benchmark, rf, confidence, cash_krw, values, total)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
