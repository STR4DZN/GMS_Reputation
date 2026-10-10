"""History, preferences and rollback through real templates/application controllers."""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get("GMS_PREVIEW_URL", "http://127.0.0.1:8766")
WORLD = "game.settings.get('gms-reputation','worldState')"

def settle(page):
    page.evaluate("""async () => {
      await previewApp._saveController.whenIdle(); await previewApp._navigationTail;
      for(let n=0;n<5;n++){const tail=previewApp._renderTail;await tail;
        await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
        if(tail===previewApp._renderTail)return;}
      throw Error('Preview did not settle');
    }""")

def navigate(page, area):
    page.evaluate("area=>previewApp._navigate({activeSection:area})", area)
    settle(page)

def ready(page):
    page.goto(f"{URL}/?view=master&user=gm&reset=1")
    page.wait_for_function("window.previewReady")
    page.evaluate("""() => {
      window.messages=[];
      for(const level of ['warn','error','info'])ui.notifications[level]=message=>messages.push([level,message]);
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width":1280,"height":900}, reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    ready(page)
    original = page.evaluate(f"{WORLD}.profiles.p1.relationships.s1.score")
    page.evaluate("""async () => {const api=await import('/scripts/data/reputation-registry.js');await api.setReputationScore('p1','s1',6);}""")
    settle(page); navigate(page,"history")
    revision = page.evaluate(f"{WORLD}.revision")
    page.once("dialog", lambda dialog: dialog.dismiss())
    page.locator('[data-master-undo]').click(); settle(page)
    assert page.evaluate(f"{WORLD}.revision") == revision
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator('[data-master-undo]').click(); settle(page)
    assert page.evaluate(f"{WORLD}.profiles.p1.relationships.s1.score") == original
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator('[data-master-redo]').click(); settle(page)
    assert page.evaluate(f"{WORLD}.profiles.p1.relationships.s1.score") == 6
    navigate(page,"characters")
    page.locator('[data-master-subject-alias]').fill('Rascunho protegido')
    navigate(page,"history")
    revision = page.evaluate(f"{WORLD}.revision")
    page.locator('[data-master-undo]').click(); settle(page)
    assert page.evaluate(f"{WORLD}.revision") == revision
    assert 'alterações pendentes' in page.evaluate('messages.at(-1)[1]')
    navigate(page,"settings")
    page.locator('[data-master-restore-backup]').click(); settle(page)
    assert page.evaluate(f"{WORLD}.revision") == revision
    navigate(page,"characters")
    assert page.locator('[data-master-subject-alias]').input_value() == 'Rascunho protegido'
    page.locator('[data-master-save-subject]').click(); settle(page)
    assert page.evaluate(f"{WORLD}.subjects.s1.alias") == 'Rascunho protegido'
    navigate(page,"settings")
    before = page.evaluate(WORLD)
    page.once("dialog", lambda dialog: dialog.dismiss())
    page.locator('[data-master-restore-backup]').click(); settle(page)
    assert page.evaluate(WORLD) == before
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator('[data-master-restore-backup]').click(); settle(page)
    assert page.evaluate("game.settings.get('gms-reputation','worldStateBackup')") == before
    assert page.evaluate(f"{WORLD}.subjects.s1.alias") != 'Rascunho protegido'
    # User-scoped preferences do not create a world/history transaction.
    revision = page.evaluate(f"{WORLD}.revision")
    page.locator('[data-master-save-mode]').select_option('idle')
    page.wait_for_function("previewApp._saveController.mode==='idle'")
    page.locator('[data-master-autosave-delay]').fill('1.37')
    page.locator('[data-master-autosave-delay]').dispatch_event('change')
    page.wait_for_function("document.querySelector('[data-master-autosave-delay]').value==='1.25'")
    page.locator('[data-master-save-mode]').select_option('manual')
    page.wait_for_function("previewApp._saveController.mode==='manual'")
    assert page.evaluate(f"{WORLD}.revision") == revision
    assert not errors, errors
    browser.close()
print('browser-system-controls: OK | undo/redo/cancel, field draft gates, rollback backup and user preferences')
