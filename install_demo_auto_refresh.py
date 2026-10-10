#!/usr/bin/env python3
"""Install a guarded DAILY refresher for the public FICTIONAL finance DEMO.

Usage (Ubuntu Lightsail): sudo python3 install_demo_auto_refresh.py
Does not change the existing API, nginx, or older cron jobs.
Installs a systemd oneshot service and timer, daily at 00:30 UTC (09:30 KST).
"""
from __future__ import annotations
import ast
import json
import os
import pwd
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path('/home/ubuntu/finance-api')
UNIT = Path('/etc/systemd/system/finance-demo-refresh.service')
TIMER = Path('/etc/systemd/system/finance-demo-refresh.timer')
JOB = ROOT / 'demo_auto_refresh.py'
EXPECTED = {'SOXL', 'MU', 'COHR'}

JOB_CODE = r'''#!/usr/bin/env python3
"""Daily public, fictional DEMO market data refresh (no brokerage data)."""
from __future__ import annotations
import json
import os
import pwd
from pathlib import Path
import tempfile
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import demo_performance as pf
import generic_market_risk as gr
import prepare_generic_demo_snapshot as public

EXPECTED = {'SOXL', 'MU', 'COHR'}


def stage_json(data):
    fd, pathname = tempfile.mkstemp(prefix='.finance-demo-', suffix='.json.tmp', dir=ROOT)
    path = Path(pathname)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        return path
    except Exception:
        path.unlink(missing_ok=True)
        raise


def main():
    # Hard guard: never recompute/publish personal brokerage portfolios.
    weights, cash_weight = pf.read_demo(ROOT / 'portfolio.json')
    raw, amounts, total, cash_value = gr.portfolio_data(ROOT / 'portfolio.json')
    if set(amounts) != EXPECTED or abs(total - 68_600_000) > 1 or str(raw.get('risk_settings', {}).get('benchmark', 'SPY')).upper() != 'SPY':
        raise ValueError('DEMO GUARD: unrecognized fictional portfolio; outputs unchanged')

    staged = []
    try:
        risk_closes = gr.download_prices(['SOXL', 'MU', 'COHR', 'SPY'])
        risk = gr.evaluate(raw, amounts, total, cash_value, risk_closes)
        if (risk.get('demo') is not True or set(risk.get('tickers', [])) != EXPECTED
                or risk.get('daily_observations') != 252):
            raise ValueError('Risk result is not the expected public DEMO')
        risk_stage = stage_json(risk)
        staged.append(risk_stage)

        # Reuse the existing vetted allowlist-based public snapshot creator,
        # but make it write to an unpublished staged file.
        public_stage = stage_json({})
        staged.append(public_stage)
        public.SOURCE = risk_stage
        public.DEST = public_stage
        public.main()
        safe_public = json.loads(public_stage.read_text(encoding='utf-8'))
        if set(safe_public.get('tickers', [])) != EXPECTED or safe_public.get('demo') is not True:
            raise ValueError('Public demo validation failed')

        performance = pf.calculate(pf.download_prices(), weights, cash_weight)
        if (performance.get('demo') is not True or performance.get('daily_observations') != 252
                or len(performance.get('daily_cumulative_returns', [])) != 253
                or 'Fictional SOXL/MU/COHR' not in performance.get('assumptions', '')):
            raise ValueError('Performance result is not the expected fictional demo')
        if performance['period_end'] != risk['period_end']:
            raise ValueError('Risk/performance source market dates differ; no files published')
        performance_stage = stage_json(performance)
        staged.append(performance_stage)

        # All checks passed. Replace JSONs atomically, per file, on same filesystem.
        # No API restart needed: FastAPI reads the files on each request.
        for stage, filename in (
                (risk_stage, 'generic_risk_preview.json'),
                (public_stage, 'generic_public_demo.json'),
                (performance_stage, 'demo_performance_preview.json')):
            os.replace(stage, ROOT / filename)
        print('SUCCESS: Daily fictional DEMO refreshed through', risk['period_end'], flush=True)
        print('Generic risk + public individual + performance JSON updated. Existing APIs unchanged.', flush=True)
    finally:
        for path in staged:
            path.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
'''

SERVICE_CODE = '''[Unit]
Description=Update fictional finance DEMO performance and risk datasets
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/finance-api
ExecStart=/usr/bin/flock -n /home/ubuntu/finance-api/.demo_refresh.lock /home/ubuntu/finance-api/.venv/bin/python /home/ubuntu/finance-api/demo_auto_refresh.py
TimeoutStartSec=240
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/home/ubuntu/finance-api
ProtectHome=false
'''

TIMER_CODE = '''[Unit]
Description=Daily fictional market risk and performance refresh at 09:30 KST

[Timer]
OnCalendar=*-*-* 00:30:00 UTC
Persistent=true
RandomizedDelaySec=120
Unit=finance-demo-refresh.service

[Install]
WantedBy=timers.target
'''


def run(*args):
    return subprocess.run(args, capture_output=True, text=True)


def main():
    if os.geteuid() != 0:
        sys.exit('ERROR: Run with sudo python3')
    expected_paths = [ROOT / p for p in (
        'portfolio.json', 'demo_performance.py', 'generic_market_risk.py',
        'prepare_generic_demo_snapshot.py', 'generic_public_demo.json',
        'demo_performance_preview.json', '.venv/bin/python')]
    missing = [str(p) for p in expected_paths if not p.is_file()]
    if missing:
        sys.exit('ERROR: Missing prerequisites: ' + ', '.join(missing))
    raw = json.loads((ROOT / 'portfolio.json').read_text(encoding='utf-8'))
    symbols = [str(p.get('ticker', '')).upper() for p in raw.get('positions', [])]
    # Only known demo inputs. No exposure of real accounts by this installer.
    if len(symbols) != 3 or set(symbols) != EXPECTED or raw.get('usdkrw') != 1400:
        sys.exit('ERROR: DEMO-only protection failed: unexpected portfolio.json. No changes made.')
    public_snapshot = json.loads((ROOT / 'generic_public_demo.json').read_text(encoding='utf-8'))
    performance_snapshot = json.loads((ROOT / 'demo_performance_preview.json').read_text(encoding='utf-8'))
    if (public_snapshot.get('demo') is not True or set(public_snapshot.get('tickers', [])) != EXPECTED
            or performance_snapshot.get('demo') is not True
            or 'Fictional SOXL/MU/COHR' not in performance_snapshot.get('assumptions', '')):
        sys.exit('ERROR: Existing public data is not known fictional demo. No changes made.')
    ast.parse(JOB_CODE)
    check = run(str(ROOT / '.venv/bin/python'), '-c',
                'import yfinance, numpy, pandas, fastapi; print("Dependencies OK")')
    if check.returncode:
        sys.exit('ERROR: Missing Python dependencies: ' + check.stderr)
    backups = {}
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    for target in (JOB, UNIT, TIMER):
        if target.exists():
            backup = target.with_name(target.name + '.backup-' + stamp)
            shutil.copy2(target, backup)
            backups[target] = backup
    try:
        JOB.write_text(JOB_CODE, encoding='utf-8')
        account = pwd.getpwnam("ubuntu")
        os.chown(JOB, account.pw_uid, account.pw_gid)
        JOB.chmod(0o644)
        UNIT.write_text(SERVICE_CODE, encoding='utf-8')
        TIMER.write_text(TIMER_CODE, encoding='utf-8')
        for path in (UNIT, TIMER):
            path.chmod(0o644)
        reload = run('systemctl', 'daemon-reload')
        if reload.returncode:
            raise RuntimeError(reload.stderr)
        verify = run('systemd-analyze', 'verify', str(UNIT), str(TIMER))
        if verify.returncode:
            raise RuntimeError(verify.stderr)
        enable = run('systemctl', 'enable', '--now', 'finance-demo-refresh.timer')
        if enable.returncode:
            raise RuntimeError(enable.stderr)
    except Exception as e:
        for path in (JOB, UNIT, TIMER):
            if path in backups:
                shutil.copy2(backups[path], path)
            else:
                path.unlink(missing_ok=True)
        run('systemctl', 'daemon-reload')
        sys.exit('ERROR: Install failed; files restored. ' + str(e))
    print('SUCCESS: Daily DEMO refresh timer installed')
    print('SCHEDULE: 00:30 UTC / 09:30 KST every day (+ up to 2 minutes)')
    print('EXISTING: API, nginx, old cron unchanged; only fictional demo snapshots may update')
    print('CHECK: systemctl list-timers --all finance-demo-refresh.timer')
    print('TEST: sudo systemctl start finance-demo-refresh.service')
    print('LOG: journalctl -u finance-demo-refresh.service -n 30 --no-pager')


if __name__ == '__main__':
    main()
