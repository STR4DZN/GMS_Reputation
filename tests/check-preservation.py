from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
references=json.loads((root/'tools/base-dev14-hashes.json').read_text())
changed={'module.json','README.md','CHANGELOG.md','docs/INSTALLATION.md','styles/master-workbench.css','scripts/constants.js','templates/apps/master-panel.hbs','templates/partials/reputation-workbench.hbs'}
count=0
for name,expected in references.items():
 if name in changed:continue
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==expected,f'Unexpected change from dev.14: {name}'
 count+=1
for name in ['scripts/constants.js','templates/apps/master-panel.hbs']:
 content=(root/name).read_bytes().replace(b'2.0.0-dev.16',b'2.0.0-dev.14')
 assert hashlib.sha256(content).hexdigest()==references[name],f'Only version may change: {name}'
base=(root/'tools/base-master-workbench.css').read_bytes()
assert hashlib.sha256(base).hexdigest()==references['styles/master-workbench.css']
css=(root/'styles/master-workbench.css').read_bytes()
assert css.startswith(base),'dev.14 layout must be restored before applying the focused GM fix'
patch=css[len(base):].decode()
assert '.gms-player' not in patch
assert 'grid-template-columns: minmax(300px, 1.1fr) minmax(0, 1fr)' in patch
assert 'flex: 0 0 auto' in patch
manifest=json.loads((root/'module.json').read_text())
assert manifest['version']=='2.0.0-dev.16'
assert manifest['styles']==['styles/player-original-scoped.css','styles/master-foundation.css','styles/master-workbench.css','styles/player-npc-search.css','styles/master-portrait-editor.css']
print(f'Preservation passed: {count} original files byte-identical to dev.14; image editor, Players and controllers retained; focused GM CSS only.')

content=(root/'templates/partials/reputation-workbench.hbs').read_bytes().replace(b' title="{{name}} \xe2\x80\x94 {{group}}"',b'')
assert hashlib.sha256(content).hexdigest()==references['templates/partials/reputation-workbench.hbs']
