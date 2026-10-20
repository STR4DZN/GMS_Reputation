#!/usr/bin/env python3
"""Package verified runtime and reproducible preview/test sources."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(root / 'tools/build-preview.py')], check=True)
manifest = json.loads((root / 'module.json').read_text(encoding='utf-8'))
for name in manifest['styles'] + manifest['esmodules']:
    assert (root / name).is_file(), name
output = root / 'dist' / f'GMS_Reputation_{manifest["version"]}.zip'
files = [root / name for name in ['module.json', 'README.md', 'CHANGELOG.md', 'package.json']]
for directory in ['assets', 'docs', 'scripts', 'styles', 'templates', 'tools', 'tests', 'visualizer']:
    files += sorted(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in files:
        info = zipfile.ZipInfo((Path('gms-reputation') / p.relative_to(root)).as_posix(), date_time=(2026, 10, 20, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, p.read_bytes())
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
    assert json.loads(z.read('gms-reputation/module.json')) == manifest
print(f'{output.name}: {len(files)} files, {output.stat().st_size} bytes')
(output.parent / "module.json").write_bytes((root / "module.json").read_bytes())
(output.parent / "SHA256SUMS.txt").write_text(f"{hashlib.sha256(output.read_bytes()).hexdigest()}  {output.name}\n", encoding='utf-8')
