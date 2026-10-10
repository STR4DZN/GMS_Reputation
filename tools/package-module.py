"""Build and inspect the installable runtime ZIP, without development dependencies."""
import json
import hashlib
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
subprocess.run(["node", "tools/build-styles.mjs", "--check"], cwd=root, check=True)
manifest = json.loads((root / "module.json").read_text())
files = [root / name for name in ("module.json", "README.md", "CHANGELOG.md")]
for directory in ("assets", "docs", "scripts", "styles", "templates"):
    files.extend(p for p in (root / directory).rglob("*") if p.is_file() and p.name not in (".DS_Store", "Thumbs.db"))
output = root / "dist" / f"GMS_Reputation_{manifest['version']}.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(files):
        info = ZipInfo(file.relative_to(root).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, file.read_bytes(), compresslevel=9)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    names = set(archive.namelist())
    assert not any(name.startswith(("src/", "tools/", "tests/", "node_modules/")) for name in names)
    assert json.loads(archive.read("module.json")) == manifest
    for name in [*manifest.get("esmodules", []), *manifest.get("scripts", []), *manifest.get("styles", [])]:
        assert name in names, f"Missing manifest resource: {name}"
    for name in sorted(names):
        if name.startswith("scripts/") and name.endswith(".js"):
            source = archive.read(name).decode()
            # Static imports/exports and literal dynamic imports must resolve in the ZIP.
            imports = re.findall(r'(?:from\s+|import\s*\(\s*|import\s+)[\"\']([^\"\']+)[\"\']', source)
            for specifier in imports:
                if specifier.startswith("."):
                    target = posixpath.normpath(str(PurePosixPath(name).parent / specifier))
                    assert target in names, f"Missing runtime import: {name} -> {target}"
            for target in re.findall(r'modules/\$\{MODULE_ID\}/(templates/[^`]+\.hbs)', source):
                assert target in names, f"Missing ApplicationV2 template: {target}"
        if name.startswith("templates/") and name.endswith(".hbs"):
            for target in re.findall(r'\{\{>\s+"modules/gms-reputation/([^"]+)"', archive.read(name).decode()):
                assert target in names, f"Missing partial: {name} -> {target}"
        if name.startswith("styles/") and name.endswith(".css"):
            for resource in re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', archive.read(name).decode()):
                if resource.startswith(("data:", "http:", "https:", "#")):
                    continue
                target = posixpath.normpath(str(PurePosixPath(name).parent / resource.split("#")[0].split("?")[0]))
                assert target in names, f"Missing stylesheet resource: {target}"
print(f"package: OK | {len(files)} runtime files | {output.stat().st_size} bytes | import/template/asset closure | {output.relative_to(root)}")
(output.parent / "module.json").write_bytes((root / "module.json").read_bytes())
(output.parent / "SHA256SUMS.txt").write_text(f"{hashlib.sha256(output.read_bytes()).hexdigest()}  {output.name}\n")
