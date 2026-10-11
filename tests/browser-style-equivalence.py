"""Compare rendered computed properties, pseudo-elements, bounds and pixels on identical DOM.
Run against the preview with GMS_STYLE_BASELINE=/path/to/baseline-checkout.
This validates the isolated adapter, not Foundry's window manager or other modules.
"""
import hashlib
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

url = os.environ.get("GMS_PREVIEW_URL", "http://127.0.0.1:8766")
before = (Path(os.environ["GMS_STYLE_BASELINE"]) / "styles/gms-reputation-59.10.css").read_text()
after = (Path(__file__).resolve().parents[1] / "styles/gms-reputation-59.10.css").read_text()
SNAPSHOT = """async () => {
  await document.fonts.ready;
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  // Hidden workspaces are checked when selected below. Avoid repeatedly reading
  // hundreds of computed properties from every inactive workspace's SVG nodes.
  const nodes = [...document.querySelectorAll('.application, .application *')]
    .filter(e => e.getClientRects().length > 0);
  const data = nodes.map(e => {
    const rect = e.getBoundingClientRect();
    const styles = ['', '::before', '::after'].map(pseudo => {
      const style = getComputedStyle(e, pseudo || null);
      return [...style].map(prop => [prop, style.getPropertyValue(prop)]);
    });
    return [e.tagName, e.getAttribute('class'), [rect.x,rect.y,rect.width,rect.height],styles];
  });
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [nodes.length,[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')];
}"""
cases = 0
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width":1280,"height":900}, reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    for view, user in [("master", "gm"), ("player", "mari")]:
        page.goto(f"{url}/?view={view}&user={user}&reset=1")
        page.wait_for_function("window.previewReady")
        page.evaluate("""() => {
          document.querySelector('link[href*=gms-reputation]').disabled=true;
          const css=document.createElement('style');css.id='comparison-css';document.head.append(css);
          const freeze=document.createElement('style');
          freeze.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
          document.head.append(freeze);
        }""")
        areas = ["subjects", "profile", "characters", "relationship", "portrait", "focal", "history", "cleanup", "settings"] if view == "master" else ["player"]
        for width in [320, 390, 768, 1280]:
            page.set_viewport_size({"width":width,"height":900})
            for area in areas:
                if view == "master":
                    page.evaluate("area => previewApp._navigate({activeSection:area})", area)
                results = []
                for css in [before, after]:
                    page.evaluate("css => document.querySelector('#comparison-css').textContent=css", css)
                    computed = page.evaluate(SNAPSHOT)
                    pixels = hashlib.sha256(page.locator(".application").first.screenshot(animations="disabled")).hexdigest()
                    results.append((computed, pixels))
                assert results[0] == results[1], (view, width, area, results)
                cases += 1
                print(f"style surface {cases}/40: {view}/{width}/{area} | {results[0][0][0]} rendered nodes | identical", flush=True)
    assert not errors, errors
    browser.close()
print(f"browser-style-equivalence: OK | {cases} surfaces | rendered computed properties, pseudo-elements, geometry and identical screenshot pixels")
