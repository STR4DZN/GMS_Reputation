"""Portrait lifecycle integration using the real preview controllers/templates.
Start npm run preview; run python tests/browser-portraits.py with Playwright installed.
CHROMIUM_PATH and GMS_PREVIEW_URL are optional. --baseline measures the old branch.
The fixture contains 25 animated GIFs and five static images with distinct URLs.
This preview does not replace an in-world Foundry v13 check.
"""
import base64
import json
import os
import sys
from playwright.sync_api import sync_playwright

URL = os.environ.get("GMS_PREVIEW_URL", "http://127.0.0.1:8766")
BASELINE = "--baseline" in sys.argv
GIF = base64.b64decode("R0lGODlhEAAQAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAEAAQAAAIHQABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFgQEBACH5BAEKAAEALAAAAAAQABAAgQAA/wAAAAAAAAAAAAgdAAEIHEiwoMGDCBMqXMiwocOHECNKnEixosWBAQEAOw==")
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="blue"/></svg>'

def source_count(page):
    return page.locator('[data-player-card] img[src]').count()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    errors = []
    requested = set()
    page.on("pageerror", lambda error: errors.append(str(error)))
    def fixture(route):
        requested.add(route.request.url.rsplit("/", 1)[-1])
        route.fulfill(status=200, content_type="image/gif" if route.request.url.endswith('.gif') else "image/svg+xml", body=GIF if route.request.url.endswith('.gif') else SVG)
    page.route("**/portrait-fixture/*", fixture)
    page.goto(f"{URL}/?view=player&user=mari&reset=1")
    page.wait_for_function("window.previewReady")
    page.evaluate("""async () => {
      const Schema = await import('/scripts/data/schema.js');
      const state = Schema.createEmptyWorldState({createdBy:'gm'});
      state.groups.g1 = {id:'g1',name:'Fixture',active:true,archived:false,sortOrder:10};
      for (let i=0;i<30;i++) {
        const id=`s${i+1}`;
        state.subjects[id]=Schema.createSubject({id,alias:`Personagem ${String(i+1).padStart(2,'0')}`,sortOrder:i+1,
          portrait:{src:`/portrait-fixture/${i}.${i<25?'gif':'svg'}`,zoom:175,x:30,y:70}});
      }
      for (const [id,n] of [['p1',0],['p2',29]]) state.profiles[id]=Schema.createProfile({id,name:id,groupId:'g1',sortOrder:n,
        focal:{name:id,portrait:{src:`/portrait-fixture/${n}.${n<25?'gif':'svg'}`}},
        subjectIds:Object.keys(state.subjects),relationships:Object.fromEntries(Object.keys(state.subjects).map(id=>[id,{subjectId:id,score:0}]))});
      state.revision=game.settings.get('gms-reputation','worldState').revision+1;
      await game.settings.set('gms-reputation','worldState',state);
      await previewApp._syncTail;
      await previewApp.render();
    }""")
    page.wait_for_timeout(500)
    cards = page.locator('[data-player-card]')
    assert cards.count() == 30
    heights = cards.evaluate_all("es=>es.map(e=>e.getBoundingClientRect().height)")
    initial = {"cardSources": source_count(page), "distinctRequests": len(requested), "cards": 30, "animatedGIFs": 25}
    print(("baseline" if BASELINE else "viewport") + ": " + json.dumps(initial), flush=True)
    if BASELINE:
        browser.close()
        sys.exit(0)
    assert source_count(page) < 30
    assert len(requested) < 30, "Offscreen images must not be requested before scrolling"
    assert '24.gif' not in requested
    assert page.locator('[data-player-card] img').last.get_attribute('src') is None
    # Nested scroll containers load the destination and release the previous cards.
    cards.last.evaluate("e=>e.scrollIntoView({block:'center'})")
    page.wait_for_function("document.querySelector('[data-player-card][data-subject-id=\"s30\"] img')?.naturalWidth>0")
    page.wait_for_timeout(200)
    assert cards.first.locator('img').get_attribute('src') is None
    assert '29.svg' in requested
    assert heights == cards.evaluate_all("es=>es.map(e=>e.getBoundingClientRect().height)")
    cards.first.evaluate("e=>e.scrollIntoView({block:'center'})")
    page.wait_for_function("document.querySelector('[data-player-card][data-subject-id=\"s1\"] img')?.naturalWidth>0")
    image = cards.first.locator('img')
    frame = image.locator('..')
    assert frame.evaluate("e=>e.style.getPropertyValue('--gms-portrait-zoom')") == '1.75'
    assert frame.evaluate("e=>e.style.getPropertyValue('--gms-portrait-x')") == '30%'
    page.evaluate("previewApp.element.hidden=true")
    page.wait_for_function("document.querySelectorAll('[data-player-card] img[src]').length===0")
    page.evaluate("previewApp.element.hidden=false")
    page.wait_for_function("document.querySelector('[data-player-card][data-subject-id=\"s1\"] img')?.naturalWidth>0")
    # A background document releases visible images and restores them on return.
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'))")
    assert page.locator('img[data-gms-portrait-src][src]').count() == 0
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false}); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_function("document.querySelector('[data-player-card][data-subject-id=\"s1\"] img')?.hasAttribute('src')")
    # Live card replacement must register the new element and release the old one.
    page.evaluate("window.oldPortrait=document.querySelector('[data-player-card] img')")
    page.evaluate("""async () => {
      const state=game.settings.get('gms-reputation','worldState'); state.revision++;
      state.profiles.p1.relationships.s1.score=.5;
      await game.settings.set('gms-reputation','worldState',state); await previewApp._syncTail;
    }""")
    page.wait_for_function("oldPortrait!==document.querySelector('[data-player-card] img') && !oldPortrait.hasAttribute('src')")
    page.wait_for_function("document.querySelector('[data-player-card] img')?.naturalWidth>0")
    page.evaluate("""async () => {
      const {openSubjectDetail}=await import('/scripts/apps/subject-detail.js');
      window.details=openSubjectDetail({profileId:'p1',subjectId:'s1'});
      await details._renderTail;
      window.detailPortrait=details.element.querySelector('img[data-gms-portrait-src]');
      detailPortrait.parentElement.scrollIntoView({block:'center'});
    }""")
    page.wait_for_function("detailPortrait.hasAttribute('src') && detailPortrait.naturalWidth>0")
    page.evaluate("details.close()")
    assert page.evaluate("!detailPortrait.hasAttribute('src')")
    # Closing the application must detach sources even if callers retain its DOM.
    page.evaluate("window.closedPortraits=[...previewApp.element.querySelectorAll('img[data-gms-portrait-src]')]")
    page.evaluate("async () => { await previewApp.close(); game.user=game.users.find(u=>u.id==='gm'); await previewShow('master'); }")
    assert page.evaluate("closedPortraits.every(i=>!i.hasAttribute('src'))")
    # Popover options remain suspended until opened, including selected thumbnails.
    options = page.locator('[data-smart-selector="master-subject"] [data-smart-selector-option] img')
    assert options.count() == 30
    assert options.evaluate_all("es=>es.every(e=>!e.hasAttribute('src'))")
    toggle = page.locator('[data-smart-selector="master-subject"] [data-smart-selector-toggle]')
    toggle.click()
    page.wait_for_function("document.querySelector('[data-smart-selector=\"master-subject\"] [data-smart-selector-option] img')?.hasAttribute('src')")
    assert options.last.get_attribute('src') is None
    page.locator('[data-smart-selector="master-subject"] input[data-smart-selector-search]').fill('Personagem 30')
    option = page.locator('[data-smart-selector="master-subject"] [data-smart-selector-option="s30"]')
    option.press('Enter')
    page.wait_for_function("previewApp.subjectId==='s30'")
    page.evaluate("async () => { await previewApp._renderTail; }")
    current = page.locator('[data-smart-selector="master-subject"] [data-smart-selector-current-image]')
    page.wait_for_function("document.querySelector('[data-smart-selector=\"master-subject\"] [data-smart-selector-current-image]')?.getAttribute('src')==='/portrait-fixture/29.svg'")
    # The editor uses the same controller and preserves calibration when saving.
    page.evaluate("previewApp._navigate({activeSection:'portrait'})")
    editor = page.locator('[data-master-portrait-editor]')
    editor.locator('[data-portrait-preview]').evaluate("e=>e.scrollIntoView({block:'center'})")
    page.wait_for_function("document.querySelector('[data-master-portrait-editor] img')?.naturalWidth>0")
    editor.locator('[name="portraitUrl"]').fill(f'{URL}/portrait-fixture/editor.gif')
    editor.locator('[data-action="usePortraitUrl"]').click()
    page.wait_for_function("url=>document.querySelector('[data-master-portrait-editor] img')?.getAttribute('src')===url", arg=f'{URL}/portrait-fixture/editor.gif')
    editor.locator('[name="portraitZoom"]').fill('210')
    editor.locator('[name="portraitX"]').fill('40')
    editor.locator('[name="portraitY"]').fill('70')
    page.locator('[data-master-save-portrait]').click()
    page.wait_for_function("game.settings.get('gms-reputation','worldState').subjects.s30.portrait.zoom===210")
    page.wait_for_function("!previewApp._saveController.isSaving")
    portrait = page.evaluate("game.settings.get('gms-reputation','worldState').subjects.s30.portrait")
    assert portrait == {'src':f'{URL}/portrait-fixture/editor.gif','zoom':210,'x':40,'y':70}, portrait
    page.evaluate("previewApp._navigate({activeSection:'history'})")
    page.wait_for_timeout(200)
    assert editor.locator('img').get_attribute('src') is None
    page.evaluate("game.user.setFlag('gms-reputation','personalReputationBinding',{profileId:'p2',subjectId:'s30'})")
    page.wait_for_function("Boolean(game.user.getFlag('gms-reputation','personalReputationView'))")
    page.evaluate("""async () => {
      const state=game.settings.get('gms-reputation','worldState'); state.revision++;
      state.profiles.p1.relationships.s30.score=.5;
      await game.settings.set('gms-reputation','worldState',state); await previewApp._syncTail;
    }""")
    page.wait_for_function("document.querySelector('.gms-feedback-dock img[data-gms-portrait-src]')?.naturalWidth>0")
    page.evaluate("window.feedbackPortraits=[...document.querySelectorAll('.gms-feedback-dock img[data-gms-portrait-src]')]")
    page.evaluate("previewApp.close()")
    assert page.evaluate("feedbackPortraits.every(i=>!i.hasAttribute('src')) && !document.querySelector('.gms-feedback-dock')")
    fallback = browser.new_page(viewport={"width":1280,"height":900})
    fallback.add_init_script("window.IntersectionObserver=undefined")
    fallback.goto(f'{URL}/?view=player&user=mari&reset=1')
    fallback.wait_for_function("window.previewReady && document.querySelector('[data-player-card] img')?.naturalWidth>0")
    assert fallback.locator('[data-player-card] img[data-gms-portrait-src][src]').count() == 5
    fallback.close()
    assert not errors, errors
    browser.close()
    print("browser-portraits: OK | scrolling, geometry, hidden views, live sync, details, feedback, cleanup, keyboard selection, calibrated save and fallback")
