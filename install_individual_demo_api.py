#!/usr/bin/env python3
"""Safely add a strictly DEMO-only individual risk route to existing FastAPI.

Run on AWS Lightsail: sudo python3 install_individual_demo_api.py
Never use public endpoints for actual account holdings.
Does not edit Nginx or public routing.
"""
from __future__ import annotations
import ast
from datetime import datetime, timezone
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path('/home/ubuntu/finance-api')
TARGET = ROOT / 'demo_api.py'
SNAPSHOT = ROOT / 'generic_public_demo.json'
SERVICE = 'finance-demo-api'
ROUTE_MARKER = '# BJ_GENERIC_PUBLIC_DEMO_API_V1'
ROUTE = '''\n\n# BJ_GENERIC_PUBLIC_DEMO_API_V1 - public fictional holdings ONLY\n@app.get("/api/demo-individual-risk")\ndef demo_individual_risk():\n    try:\n        data = json.loads((ROOT / "generic_public_demo.json").read_text(encoding="utf-8"))\n    except (OSError, ValueError):\n        raise HTTPException(status_code=503, detail="Demo individual snapshot unavailable")\n    # Hard gate: only the known public example, never generic_risk_preview.json\n    # or portfolio.json containing personal holdings.\n    demo_tickers = {"SOXL", "MU", "COHR"}\n    tickers = data.get("tickers")\n    if (data.get("schema_version") != 1 or data.get("demo") is not True\n            or not isinstance(tickers, list) or len(tickers) != 3\n            or set(tickers) != demo_tickers):\n        raise HTTPException(status_code=503, detail="Demo individual snapshot invalid")\n    try:\n        fields = ("weight_pct", "beta_vs_benchmark", "annual_volatility_pct",\n                  "correlation_vs_benchmark", "risk_contribution_pct")\n        individuals = {s: {k: float(data["individual"][s][k]) for k in fields}\n                       for s in tickers}\n        correlations = {a: {b: float(data["correlations"][a][b]) for b in tickers}\n                        for a in tickers}\n        contributions = {s: float(data["risk_contribution_pct"][s]) for s in tickers}\n        # Allowlist every published field, never forward unknown JSON properties.\n        payload = {\n            "schema_version": 1, "demo": True,\n            "source": "fictional public demo holdings / historical Yahoo Finance prices",\n            "period_start": str(data["period_start"]),\n            "period_end": str(data["period_end"]),\n            "daily_observations": int(data["daily_observations"]),\n            "benchmark": "SPY",\n            "tickers": tickers,\n            "individual": individuals,\n            "correlations": correlations,\n            "risk_contribution_pct": contributions,\n            "limitations": "Demo only: hypothetical holdings, not real brokerage data.",\n        }\n        import math\n        numbers = [*contributions.values(),\n                   *(v for row in individuals.values() for v in row.values()),\n                   *(v for row in correlations.values() for v in row.values())]\n        if (not all(math.isfinite(v) for v in numbers)\n                or any(abs(v) > 1.00001 for row in correlations.values() for v in row.values())\n                or any(not 0 <= individuals[s]["weight_pct"] <= 100 for s in tickers)\n                or not 120 <= payload["daily_observations"] <= 400):\n            raise ValueError("Invalid numeric snapshot")\n    except (KeyError, TypeError, ValueError, OverflowError):\n        raise HTTPException(status_code=503, detail="Demo individual snapshot invalid")\n    return JSONResponse(content=payload, headers={\n        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"\n    })\n'''


def cmd(*args):
    return subprocess.run(args, capture_output=True, text=True)


def abort(reason):
    sys.exit('ERROR: ' + reason + '\nNo changes made.')


def local_test():
    url = 'http://127.0.0.1:8000/api/demo-individual-risk'
    for _ in range(8):
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                import json
                body = json.load(resp)
                if (resp.status == 200 and body.get('demo') is True and
                        set(body.get('tickers', [])) == {'SOXL', 'MU', 'COHR'}):
                    return True
        except (urllib.error.URLError, ValueError, TimeoutError, OSError):
            pass
        time.sleep(1)
    return False


def main():
    if not TARGET.is_file() or not SNAPSHOT.is_file():
        abort('Missing demo_api.py or generic_public_demo.json on server.')
    original = TARGET.read_text(encoding='utf-8')
    if ROUTE_MARKER in original:
        print('ALREADY INSTALLED: endpoint code exists. No changes made.')
        print('Local HTTP check:', 'OK' if local_test() else 'FAILED (check systemctl status)')
        return
    if ('app = FastAPI(' not in original or
            '@app.get("/api/demo-risk")' not in original or
            'ALLOWED_ORIGIN = "https://mywzhzpk2d-source.github.io"' not in original):
        abort('Unexpected FastAPI module layout. Refusing to patch.')
    import json
    data = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    if data.get('demo') is not True or set(data.get('tickers', [])) != {'SOXL', 'MU', 'COHR'}:
        abort('Snapshot not known fictional demo holdings.')
    candidate = original.rstrip() + ROUTE + '\n'
    ast.parse(candidate)
    backup = ROOT / ('demo_api.py.backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    shutil.copy2(TARGET, backup)
    try:
        TARGET.write_text(candidate, encoding='utf-8')
        check = cmd(str(ROOT / '.venv/bin/python'), '-m', 'py_compile', str(TARGET))
        if check.returncode:
            raise RuntimeError('Syntax check failed: ' + check.stderr)
        restarted = cmd('systemctl', 'restart', SERVICE)
        if restarted.returncode:
            raise RuntimeError('Service restart failed: ' + restarted.stderr)
        if not local_test():
            raise RuntimeError('Local API did not return valid DEMO JSON (200)')
    except Exception as exc:
        shutil.copy2(backup, TARGET)
        cmd('systemctl', 'restart', SERVICE)
        sys.exit('ERROR: ' + str(exc) + '\nROLLED BACK to ' + str(backup))
    print('SUCCESS: Local DEMO API GET /api/demo-individual-risk -> 200')
    print('BACKUP:', backup)
    print('Nginx unchanged; HTTPS route NOT YET published.')
    print('Never use this endpoint for real holdings or account details.')


if __name__ == '__main__':
    main()
