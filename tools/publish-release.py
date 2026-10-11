"""Publish verified Foundry assets through the repository's GitHub Actions token."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("assets", type=Path)
parser.add_argument("--verify-only", action="store_true")
args = parser.parse_args()
manifest = json.loads((root / "module.json").read_text())
version = manifest["version"]
assert re.fullmatch(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", version), "Unsafe release version"
tag = f"v{version}"
zip_name = f"GMS_Reputation_{version}.zip"
names = [zip_name, "module.json", "SHA256SUMS.txt"]
assets = args.assets.resolve()
assert json.loads((assets / "module.json").read_text()) == manifest, "Artifact manifest differs from checkout"
with ZipFile(assets / zip_name) as archive:
    assert archive.testzip() is None
    assert json.loads(archive.read("module.json")) == manifest, "ZIP manifest mismatch"
    constants = archive.read("scripts/constants.js").decode()
    assert re.search(r'MODULE_VERSION\s*=\s*"' + re.escape(version) + r'"', constants), "Runtime version mismatch"
digest = hashlib.sha256((assets / zip_name).read_bytes()).hexdigest()
assert (assets / "SHA256SUMS.txt").read_text() == f"{digest}  {zip_name}\n", "ZIP checksum mismatch"
assert manifest["download"].endswith(f"/{tag}/{zip_name}"), "Download/tag/asset mismatch"
notes = root / "docs" / "releases" / f"{version}.md"
assert notes.is_file(), "Release notes missing"
print(f"release assets: OK | {tag} | manifest, runtime and SHA-256 match", flush=True)
if args.verify_only:
    raise SystemExit(0)

repository = os.environ["GMS_REPOSITORY"]
commit = os.environ["GITHUB_SHA"]
assert manifest["url"] == f"https://github.com/{repository}", "Unexpected release destination"
assert re.fullmatch(r"[0-9a-f]{40}", commit), "Expected exact commit SHA"

def gh(*arguments, capture=False, check=True):
    return subprocess.run(["gh", *arguments, "--repo", repository], check=check,
                          capture_output=capture, text=True)

def tag_commit():
    # gh api uses the explicit endpoint rather than the release command's --repo flag.
    ref = json.loads(subprocess.check_output(["gh", "api", f"repos/{repository}/git/ref/tags/{tag}"], text=True))["object"]
    while ref["type"] == "tag":
        ref = json.loads(subprocess.check_output(["gh", "api", f"repos/{repository}/git/tags/{ref['sha']}"], text=True))["object"]
    assert ref["type"] == "commit" and ref["sha"] == commit, "Existing tag targets a different commit"

existing = gh("release", "view", tag, "--json", "isDraft", capture=True, check=False)
if existing.returncode == 0:
    tag_commit()
    draft = json.loads(existing.stdout)["isDraft"]
    if draft:
        gh("release", "upload", tag, *[str(assets / name) for name in names], "--clobber")
        gh("release", "edit", tag, "--notes-file", str(notes), "--title", f"{tag}: Retratos visíveis e interface modular")
else:
    draft = True
    gh("release", "create", tag, *[str(assets / name) for name in names], "--draft",
       "--target", commit, "--title", f"{tag}: Retratos visíveis e interface modular", "--notes-file", str(notes))
    tag_commit()

# Download the remote assets before publication; never replace a published release.
with tempfile.TemporaryDirectory() as destination:
    gh("release", "download", tag, "--dir", destination,
       *[argument for name in names for argument in ("--pattern", name)])
    for name in names:
        assert (Path(destination) / name).read_bytes() == (assets / name).read_bytes(), f"Remote asset differs: {name}"
if draft:
    gh("release", "edit", tag, "--draft=false", "--latest")
print(f"release: PUBLISHED | https://github.com/{repository}/releases/tag/{tag}", flush=True)
