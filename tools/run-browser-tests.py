"""Start the isolated preview and run its browser integrations. Requires Playwright."""
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
port = os.environ.get("PORT", "8766")
url = f"http://127.0.0.1:{port}"
tests = sys.argv[1:] or ["tests/browser-navigation.py", "tests/browser-master-controls.py", "tests/browser-portraits.py", "tests/browser-system-controls.py"]
server = subprocess.Popen(["node", "visualizer/serve.mjs"], cwd=root, env={**os.environ, "PORT":port}, stdout=subprocess.DEVNULL)
try:
    for _ in range(100):
        if server.poll() is not None:
            raise RuntimeError("Preview server stopped during startup")
        try:
            with urllib.request.urlopen(url, timeout=1):
                break
        except OSError:
            time.sleep(.05)
    else:
        raise RuntimeError("Preview server did not start")
    for test in tests:
        subprocess.run([sys.executable, test], cwd=root, env={**os.environ, "GMS_PREVIEW_URL":url}, check=True)
finally:
    server.terminate()
    server.wait(timeout=10)
