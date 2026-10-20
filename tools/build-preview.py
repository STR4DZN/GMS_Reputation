#!/usr/bin/env python3
"""Rebuild CSS/templates around the preserved dev.14 controller bundle.

The recovered install package contains all module sources. The adapter bundle
comes from the delivered preview; guard production JS so edits cannot silently
produce a preview with different controller behavior.
"""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'module.json').read_text())
version = manifest['version']
for name, expected in json.loads((root / 'tools/runtime-hashes.json').read_text()).items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, f'Rebundle controllers before changing {name}'
sources = {}
for directory in ['scripts', 'templates', 'styles']:
    for p in sorted((root / directory).rglob('*')):
        if p.is_file():
            sources[str(p.relative_to(root))] = hashlib.sha256(p.read_bytes()).hexdigest()
source_hash = hashlib.sha256(json.dumps(sources, sort_keys=True).encode()).hexdigest()
metadata = {'version': version, 'base': 'dev.70.13', 'sourceHash': source_hash, 'sources': sources,
            'runtime': 'Preserved dev.14 controller bundle; production JS verified by tools/runtime-hashes.json'}
templates = {f'modules/gms-reputation/{p.relative_to(root)}': p.read_text()
             for p in sorted((root / 'templates').rglob('*.hbs'))}
assets = json.loads((root / 'visualizer/assets.json').read_text())
css = '\n'.join((root / name).read_text() for name in manifest['styles'])
for key, url in assets['GMS_PREVIEW_ASSETS'].items():
    css = css.replace(f'../assets/icons/{key}', url)
import base64
for p in (root / 'assets/surfaces').iterdir():
    if p.is_file():
        css = css.replace(f'../assets/surfaces/{p.name}', 'data:image/svg+xml;base64,' + base64.b64encode(p.read_bytes()).decode())
def safe_json(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')
definitions = {'GMS_PREVIEW_BUILD': metadata, 'GMS_PREVIEW_TEMPLATES': templates, **assets}
inline_metadata = '\n'.join(f'globalThis.{key}={safe_json(value)};' for key, value in definitions.items())
bundle = (root / 'visualizer/runtime.bundle.js').read_text().replace('2.0.0-dev.15', version)
html = (root / 'visualizer/shell.html').read_text().replace('/* VERSION */', version)
html = html.replace('/* MODULE_CSS */', css).replace('/* METADATA */', inline_metadata).replace('/* RUNTIME */', bundle)
dist = root / 'dist'
dist.mkdir(exist_ok=True)
output = dist / 'GMS_Reputation_V2_Preview.html'
output.write_text(html)
print(f'Preview {version}: {output.stat().st_size} bytes; controller hashes verified')
