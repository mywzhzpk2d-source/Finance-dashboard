#!/usr/bin/env python3
"""Safely attach the demo API route to the Certbot-managed nginx HTTPS site.

Run via: sudo python3 install_demo_nginx.py
This does not run or publish any real account endpoints.
"""
from pathlib import Path
from datetime import datetime, timezone
import re
import shutil
import subprocess
import sys

CONF = Path('/etc/nginx/sites-available/default')
DOMAIN = '13-125-71-101.sslip.io'
MARKER = '# BJ_FINANCE_DEMO_API_ROUTE'
ROUTE = '''\n\t# BJ_FINANCE_DEMO_API_ROUTE — public, simulated data only\n\tlocation = /api/demo-risk {\n\t\tproxy_pass http://127.0.0.1:8000/api/demo-risk;\n\t\tproxy_set_header Host $host;\n\t\tproxy_set_header X-Real-IP $remote_addr;\n\t\tproxy_set_header X-Forwarded-Proto $scheme;\n\t\tproxy_connect_timeout 5s;\n\t\tproxy_read_timeout 15s;\n\t}\n\n'''

def main():
    if not CONF.exists():
        sys.exit('ERROR: Nginx default configuration not found; no changes made.')
    original = CONF.read_text(encoding='utf-8')
    if MARKER in original:
        print('ALREADY INSTALLED: demo route is present. Checking Nginx config...')
        subprocess.run(['nginx', '-t'], check=True)
        return
    # Confirm the known Certbot HTTPS virtual host before writing anything.
    if DOMAIN not in original or 'listen 443 ssl' not in original or 'ssl_certificate' not in original:
        sys.exit('ERROR: Expected HTTPS / domain settings missing. No changes made.')
    matches = list(re.finditer(r'(?m)^(\s*)location\s+/\s*\{', original))
    if len(matches) != 1:
        sys.exit(f'ERROR: Expected exactly one default location block; found {len(matches)}. No changes made.')
    # The only known location / is inside Certbot's HTTPS server, before listen 443 ssl.
    match = matches[0]
    if match.start() > original.find('listen 443 ssl'):
        sys.exit('ERROR: location / was not in expected HTTPS server section. No changes made.')
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = CONF.with_name('default.backup-' + timestamp)
    shutil.copy2(CONF, backup)
    modified = original[:match.start()] + ROUTE + original[match.start():]
    CONF.write_text(modified, encoding='utf-8')
    checked = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
    if checked.returncode != 0:
        shutil.copy2(backup, CONF)
        print(checked.stderr)
        sys.exit('ERROR: nginx config test failed; restored original. No reload.')
    reloaded = subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True, text=True)
    if reloaded.returncode != 0:
        shutil.copy2(backup, CONF)
        subprocess.run(['nginx', '-t'], check=False)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=False)
        sys.exit('ERROR: reload failed; restored original config.')
    print('SUCCESS: /api/demo-risk -> 127.0.0.1:8000 (HTTPS virtual host)')
    print('BACKUP:', backup)
    print('NGINX CONFIG TEST: OK; nginx reloaded.')
    print('Reminder: This is a public DEMO endpoint; never put real account data in its JSON.')

if __name__ == '__main__':
    main()
