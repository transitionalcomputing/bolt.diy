#!/usr/bin/env python3
"""Server-only new test client input. Secret is read from a real no-echo TTY only."""
import getpass
import json
import os
import stat
import sys
import uuid
import warnings
from pathlib import Path
from urllib.parse import urlsplit

ISSUER = 'https://auth.signallayerit.com/application/o/bolt-account-test/'

def assemble(base, secret):
    if not isinstance(base, dict) or set(base) != {'metadata', 'clientId', 'subjects'}:
        raise ValueError('Invalid input')
    metadata = base['metadata']
    if not isinstance(metadata, dict) or metadata.get('issuer') != ISSUER:
        raise ValueError('Invalid issuer')
    for name in ('issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri'):
        value = metadata.get(name)
        if not isinstance(value, str):
            raise ValueError('Invalid endpoint')
        parsed = urlsplit(value)
        if parsed.scheme != 'https' or parsed.netloc != 'auth.signallayerit.com' or parsed.username or parsed.password or parsed.fragment:
            raise ValueError('Invalid endpoint')
    subjects = base['subjects']
    if not isinstance(subjects, list) or len(subjects) != 2 or len(set(subjects)) != 2:
        raise ValueError('Invalid subjects')
    for subject in subjects:
        if not isinstance(subject, str) or str(uuid.UUID(subject)) != subject:
            raise ValueError('User UUID required')
    client = base['clientId']
    if not isinstance(client, str) or not client or len(client) > 512 or any(c in client for c in '\r\n\0'):
        raise ValueError('Invalid client')
    if not isinstance(secret, str) or not 8 <= len(secret) <= 4096 or any(c in secret for c in '\r\n\0'):
        raise ValueError('Invalid secret')
    return {**base, 'clientSecret': secret}

def read_private_json(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'r', encoding='utf-8') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.geteuid() or info.st_size > 65536:
            raise ValueError('Invalid input file')
        return json.load(stream)

def write_private_json(path, value):
    parent = Path(path).parent
    info = parent.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.geteuid():
        raise ValueError('Invalid private directory')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as stream:
        json.dump(value, stream, separators=(',', ':'))
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())

def main():
    try:
        if len(sys.argv) != 3 or not sys.stdin.isatty():
            raise ValueError('Real terminal required')
        base = read_private_json(sys.argv[1])
        warnings.simplefilter('error', getpass.GetPassWarning)
        secret = getpass.getpass('Paste new test client secret (hidden): ')
        result = assemble(base, secret)
        write_private_json(sys.argv[2], result)
        print('Private OIDC input saved')
    except Exception:
        print('Private OIDC input failed; no values displayed', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
