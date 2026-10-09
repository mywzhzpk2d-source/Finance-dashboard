#!/usr/bin/env python3
"""Add a demo-only API route to the existing Certbot HTTPS nginx site.

Run from AWS: sudo python3 install_demo_nginx_v2.py
Backs up the configuration and rolls back on syntax/reload failure.
"""
from datetime import datetime, timezone
from pathlib import Path
import re
import shutil
import subprocess
import sys

CONF = Path('/etc/nginx/sites-available/default')
DOMAIN = '13-125-71-101.sslip.io'
MARKER = '# BJ_FINANCE_DEMO_API_ROUTE'
ROUTE = '''    # BJ_FINANCE_DEMO_API_ROUTE (public DEMO only; never real accounts)
    location = /api/demo-risk {
        proxy_pass http://127.0.0.1:8000/api/demo-risk;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 15s;
    }

'''


def main():
    if not CONF.is_file():
        sys.exit('ERROR: nginx default config missing. No changes made.')
    original = CONF.read_text(encoding='utf-8')
    if MARKER in original:
        result = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
        print('ALREADY INSTALLED; nginx check:', 'OK' if result.returncode == 0 else result.stderr)
        if result.returncode: sys.exit(1)
        return

    # The active Certbot HTTPS server includes both the named domain and
    # 'listen 443 ssl'. Ignore the unrelated Ubuntu default server at line 48.
    candidates = []
    for start_match in re.finditer(r'(?m)^\s*server\s*\{', original):
        opening = original.index('{', start_match.start(), start_match.end())
        depth = 1
        end = opening + 1
        while end < len(original) and depth:
            if original[end] == '{': depth += 1
            elif original[end] == '}': depth -= 1
            end += 1
        if depth: sys.exit('ERROR: Unbalanced nginx braces. No changes made.')
        block = original[opening + 1:end - 1]
        block_uncommented = '\n'.join(line.split('#', 1)[0] for line in block.splitlines())
        if (re.search(r'(?m)^\s*server_name\s+' + re.escape(DOMAIN) + r'\s*;', block_uncommented)
                and re.search(r'(?m)^\s*listen\s+443\s+ssl\s*;', block_uncommented)
                and re.search(r'(?m)^\s*ssl_certificate\s+', block_uncommented)):
            loc = re.search(r'(?m)^\s*location\s+/\s*\{', block_uncommented)
            if not loc:
                sys.exit('ERROR: HTTPS server has no location / block. No changes made.')
            candidates.append((opening, block))

    if len(candidates) != 1:
        sys.exit(f'ERROR: Expected one domain HTTPS server, found {len(candidates)}. No changes made.')

    opening, block = candidates[0]
    loc = re.search(r'(?m)^\s*location\s+/\s*\{', block)
    if not loc:
        sys.exit('ERROR: Could not locate HTTPS location block. No changes made.')
    insertion_at = opening + 1 + loc.start()
    backup = CONF.with_name('default.backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    shutil.copy2(CONF, backup)
    try:
        CONF.write_text(original[:insertion_at] + '\n' + ROUTE + original[insertion_at:], encoding='utf-8')
        test = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
        if test.returncode:
            raise RuntimeError('nginx -t failed: ' + test.stderr)
        reload = subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True, text=True)
        if reload.returncode:
            raise RuntimeError('nginx reload failed: ' + reload.stderr)
    except Exception as exc:
        shutil.copy2(backup, CONF)
        subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True, text=True)
        sys.exit(f'ERROR: {exc}\nOriginal config restored from {backup}')
    print('SUCCESS: HTTPS /api/demo-risk -> 127.0.0.1:8000')
    print('BACKUP:', backup)
    print('NGINX CONFIG TEST: OK; nginx reloaded.')
    print('PUBLIC DEMO endpoint only. Never put brokerage credentials or real holdings in JSON.')


if __name__ == '__main__':
    main()
