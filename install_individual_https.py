#!/usr/bin/env python3
"""Safely expose ONLY the fictional demo-individual-risk endpoint over HTTPS.
Run on AWS Lightsail: sudo python3 install_individual_https.py
This does not modify the FastAPI code or original /api/demo-risk route.
"""
from datetime import datetime, timezone
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.request

CONF = Path('/etc/nginx/sites-available/default')
DOMAIN = '13-125-71-101.sslip.io'
MARKER = '# BJ_FINANCE_INDIVIDUAL_DEMO_ROUTE_V1'
ROUTE = '''    # BJ_FINANCE_INDIVIDUAL_DEMO_ROUTE_V1 - fictional public DEMO ONLY
    location = /api/demo-individual-risk {
        proxy_pass http://127.0.0.1:8000/api/demo-individual-risk;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 15s;
        add_header X-Content-Type-Options nosniff always;
    }

'''


def run(*args):
    return subprocess.run(args, capture_output=True, text=True)


def server_blocks(source):
    result = []
    # nginx server entries begin at top level of the `http` context; comments excluded.
    for m in re.finditer(r'(?m)^[ \t]*server\s*\{', source):
        start = source.index('{', m.start(), m.end())
        depth = 1
        i = start + 1
        while i < len(source) and depth:
            if source[i] == '{':
                depth += 1
            elif source[i] == '}':
                depth -= 1
            i += 1
        if depth:
            raise ValueError('Unbalanced nginx server block')
        block = source[start + 1:i - 1]
        clean = '\n'.join(line.split('#', 1)[0] for line in block.splitlines())
        result.append((start, block, clean))
    return result


def main():
    if not CONF.is_file():
        sys.exit('ERROR: nginx default configuration not found. No changes made.')
    try:
        with urllib.request.urlopen('http://127.0.0.1:8000/api/demo-individual-risk', timeout=8) as r:
            import json
            payload = json.load(r)
            if r.status != 200 or payload.get('demo') is not True or set(payload.get('tickers', [])) != {'SOXL', 'MU', 'COHR'}:
                raise ValueError('not the expected public fictional demo response')
    except Exception as e:
        sys.exit('ERROR: Local DEMO API is not ready: ' + str(e) + '. No changes made.')
    original = CONF.read_text(encoding='utf-8')
    if MARKER in original:
        check = run('nginx', '-t')
        print('ALREADY INSTALLED; nginx -t:', 'OK' if check.returncode == 0 else check.stderr)
        sys.exit(0 if check.returncode == 0 else 1)
    try:
        candidates = []
        for start, block, clean in server_blocks(original):
            if (re.search(r'(?m)^\s*server_name\s+' + re.escape(DOMAIN) + r'\s*;', clean)
                and re.search(r'(?m)^\s*listen\s+443\s+ssl\s*;', clean)
                and re.search(r'(?m)^\s*ssl_certificate\s+', clean)):
                loc = re.search(r'(?m)^\s*location\s+/\s*\{', block)
                if not loc:
                    raise ValueError('Named HTTPS server missing location /')
                candidates.append(start + 1 + loc.start())
        if len(candidates) != 1:
            raise ValueError(f'Expected exactly one matching HTTPS server, found {len(candidates)}')
    except ValueError as e:
        sys.exit('ERROR: ' + str(e) + '. No changes made.')
    backup = CONF.with_name('default.backup-individual-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    shutil.copy2(CONF, backup)
    try:
        insert = candidates[0]
        CONF.write_text(original[:insert] + '\n' + ROUTE + original[insert:], encoding='utf-8')
        check = run('nginx', '-t')
        if check.returncode != 0:
            raise RuntimeError('nginx -t failed: ' + check.stderr)
        reload = run('systemctl', 'reload', 'nginx')
        if reload.returncode != 0:
            raise RuntimeError('nginx reload failed: ' + reload.stderr)
    except Exception as e:
        shutil.copy2(backup, CONF)
        run('systemctl', 'reload', 'nginx')
        sys.exit('ERROR: ' + str(e) + '\nOriginal configuration restored from ' + str(backup))
    print('SUCCESS: HTTPS /api/demo-individual-risk -> 127.0.0.1:8000')
    print('BACKUP:', backup)
    print('NGINX CONFIG TEST: OK; nginx reloaded.')
    print('Existing /api/demo-risk route unchanged. PUBLIC FICTIONAL DEMO ONLY.')


if __name__ == '__main__':
    main()
