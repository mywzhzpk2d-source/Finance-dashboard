#!/usr/bin/env python3
"""Read-only demo risk snapshot API. Never serve real brokerage/account data.

Run only on loopback behind a separately configured HTTPS reverse proxy:
    .venv/bin/uvicorn demo_api:app --host 127.0.0.1 --port 8000
"""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parent
SNAPSHOT = ROOT / "demo_risk_metrics.json"
ALLOWED_ORIGIN = "https://mywzhzpk2d-source.github.io"

app = FastAPI(title="BJ Demo Risk API", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["GET"],
    allow_headers=[],
    allow_credentials=False,
)

@app.get("/api/demo-risk")
def demo_risk():
    try:
        data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise HTTPException(status_code=503, detail="Demo snapshot unavailable")
    if data.get("demo") is not True or data.get("schema_version") != 1:
        raise HTTPException(status_code=503, detail="Demo snapshot unavailable")
    # Explicitly allowlist output fields; never return an entire source file.
    allowed = (
        "schema_version", "demo", "data_source", "calculated_at_utc",
        "period_start", "period_end", "daily_observations", "base_currency",
        "fx_assumption", "portfolio_assumption", "benchmark", "confidence",
        "risk_free_rate_annual", "demo_total_krw", "weights_pct", "metrics",
        "variance_contribution_pct", "limitations",
    )
    payload = {k: data[k] for k in allowed if k in data}
    return JSONResponse(content=payload, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

@app.get("/health")
def health():
    return {"status": "ok", "service": "demo-only"}
