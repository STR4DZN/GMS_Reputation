"""Integration smoke test with real controllers/templates in the development preview.
Start npm run preview, then run: python tests/browser-navigation.py
Requires Python Playwright and Chromium (CHROMIUM_PATH can override its path).
This adapter does not replace testing inside Foundry v13.
"""
import os
from playwright.sync_api import sync_playwright
URL = os.environ.get("GMS_PREVIEW_URL", "http://127.0.0.1:8766")

def ready(page, view="master"):
    page.goto(f"{URL}/?view={view}&user={'mari' if view == 'player' else 'gm'}&reset=1")
    page.wait_for_function("window.previewReady")

def navigate(page, **target):
    page.evaluate("(target) => previewApp._navigate(target)", target)

def commit(page, profile="p1", changes=None):
    page.evaluate("""async ({profile,changes}) => {
      const state = game.settings.get('gms-reputation','worldState');
      state.revision++;
      for (const [id, patch] of Object.entries(changes)) Object.assign(state.profiles[profile].relationships[id], patch);
      await game.settings.set('gms-reputation','worldState',state);
      await new Promise(resolve => setTimeout(resolve, 30));
    }""", {"profile":profile,"changes":changes})

with sync_playwright() as p:
    chromium_path=os.environ.get("CHROMIUM_PATH") or ("/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None)
    browser=p.chromium.launch(executable_path=chromium_path,args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":1280,"height":900},reduced_motion="reduce")
    errors=[];page.on("pageerror",lambda error: errors.append(str(error)))
    page.on("response",lambda response: errors.append(f"HTTP {response.status}: {response.url}") if response.status>=400 else None)
    ready(page)
    # Native dialog, accent-insensitive navigation, Escape and focus restoration.
    page.locator("[data-navigation-open]").click()
    page.locator("[data-navigation-query]").fill("historico")
    assert page.locator("[data-navigation-result]").count()==1
    page.locator("[data-navigation-query]").press("Enter")
    assert page.evaluate("previewApp.activeSection")=="history"
    page.locator("[data-navigation-back]").click()
    assert page.evaluate("previewApp.activeSection")=="relationship"
    page.locator("[data-navigation-forward]").click()
    assert page.evaluate("previewApp.activeSection")=="history"
    page.locator("[data-navigation-open]").focus();page.keyboard.press("Control+k")
    page.locator("[data-navigation-query]").press("Escape")
    assert not page.locator("[data-navigation-dialog]").evaluate("element=>element.open")
    assert page.evaluate("previewApp.rendered")
    # Plain fields and separate relationship edits survive context changes.
    navigate(page,activeSection="characters")
    page.locator("[data-master-subject-alias]").fill("Corvo editado")
    navigate(page,subjectId="s2")
    assert page.locator("[data-master-subject-alias]").input_value()=="Fio Rubro"
    navigate(page,subjectId="s1")
    assert page.locator("[data-master-subject-alias]").input_value()=="Corvo editado"
    page.locator("[data-master-save-subject]").click()
    page.wait_for_function("game.settings.get('gms-reputation','worldState').subjects.s1.alias==='Corvo editado'")
    page.wait_for_function("!previewApp._saveController.isSaving")
    page.evaluate("async () => { await previewApp._renderTail; }")
    # A newer form edit made while persistence waits must remain a draft.
    page.evaluate("""() => {
      const original = game.settings.set.bind(game.settings);
      game.settings.set = async (...args) => {
        if (args[1] === 'worldState') {
          game.settings.set = original;
          await new Promise(resolve => { window.releaseSlowSave = resolve; });
        }
        return original(...args);
      };
    }""")
    page.locator("[data-master-subject-alias]").fill("Corvo salvo")
    page.locator("[data-master-save-subject]").click()
    page.wait_for_function("typeof window.releaseSlowSave === 'function'")
    page.locator("[data-master-subject-alias]").fill("Corvo rascunho novo")
    page.evaluate("window.releaseSlowSave()")
    page.wait_for_function("!previewApp._saveController.isSaving")
    page.evaluate("async () => { await previewApp._renderTail; }")
    page.wait_for_function("document.querySelector('[data-master-subject-alias]').value==='Corvo rascunho novo'")
    assert page.evaluate("game.settings.get('gms-reputation','worldState').subjects.s1.alias")=="Corvo salvo"
    navigate(page,subjectId="s2");navigate(page,subjectId="s1")
    assert page.locator("[data-master-subject-alias]").input_value()=="Corvo rascunho novo"
    page.evaluate("async () => { await Promise.all([previewApp._navigate({subjectId: 's2'}), previewApp._navigate({subjectId: 's3'}), previewApp._navigate({subjectId: 's1'})]); }")
    assert page.locator("[data-master-subject-alias]").input_value()=="Corvo rascunho novo"
    page.once("dialog",lambda dialog: dialog.dismiss())
    page.evaluate("previewApp.close()")
    assert page.evaluate("previewApp.rendered"), "Canceling a close must retain drafts"
    page.locator("[data-master-subject-alias]").fill("Corvo salvo")
    navigate(page,activeSection="relationship")
    page.locator('[data-master-score-delta="0.5"]').click()
    navigate(page,subjectId="s2")
    page.locator('[data-master-score-delta="-0.5"]').click()
    navigate(page,subjectId="s1")
    assert float(page.locator("[data-master-score-input]").input_value())==4.5
    page.locator("[data-master-save-now]").click()
    page.wait_for_function("!previewApp._saveController.isSaving && !previewApp._saveController.hasPending")
    scores=page.evaluate("game.settings.get('gms-reputation','worldState').profiles.p1.relationships")
    assert scores["s1"]["score"]==4.5 and scores["s2"]["score"]==8
    # Every area fits narrow windows; horizontal tabs deliberately scroll themselves.
    for width in [320,390,768,1280]:
        page.set_viewport_size({"width":width,"height":900})
        for area in ["profiles","characters","relationship","history","cleanup","settings"]:
            navigate(page,activeSection=area)
            dimensions=page.locator(".gms-master-panel__content").evaluate("e=>[e.clientWidth,e.scrollWidth]")
            assert dimensions[1]<=dimensions[0]+1, (width,area,dimensions)
    # The active horizontal tab remains visible after settings forces a render.
    bounds=page.locator('[data-master-section-choice="settings"]').bounding_box()
    assert bounds['x']>=0
    # Named linking saves only User flags; no revision bump or world IDs entered.
    page.locator('[data-master-settings-tab="players"]').click()
    row=page.locator('[data-player-binding-user="mari"]')
    assert row.locator('legend').inner_text().startswith('M')
    revision=page.evaluate("game.settings.get('gms-reputation','worldState').revision")
    row.locator('[data-player-binding-profile]').select_option('')
    row.locator('[data-player-binding-save]').click()
    page.wait_for_function("game.users.find(u=>u.id==='mari').getFlag('gms-reputation','personalReputationBinding')===null")
    page.evaluate("async () => { await previewApp._renderTail; }")
    row.locator('[data-player-binding-profile]').select_option('p-self')
    # Saved alias changed above, so explicit named choice is needed here.
    row.locator('[data-player-binding-subject]').select_option('s1')
    row.locator('[data-player-binding-save]').click()
    page.wait_for_function("game.users.find(u=>u.id==='mari').getFlag('gms-reputation','personalReputationBinding')?.subjectId==='s1'")
    page.evaluate("async () => { await previewApp._renderTail; }")
    assert page.evaluate("game.settings.get('gms-reputation','worldState').revision")==revision
    for width in [320,390,768,1280]:
        page.set_viewport_size({"width":width,"height":900})
        dimensions=page.locator('.gms-master-panel__content').evaluate('e=>[e.clientWidth,e.scrollWidth]')
        assert dimensions[1]<=dimensions[0]+1, ('bindings',width,dimensions)
    # Unique profile name resolves its character without entering an ID.
    joao=page.locator('[data-player-binding-user="joao"]')
    joao.locator('[data-player-binding-profile]').select_option('p-self')
    joao.locator('[data-player-binding-profile]').select_option('p-fio')
    assert joao.locator('[data-player-binding-subject]').input_value()=='s2'
    # Saving another row and navigating retains an unsaved user's named choice.
    joao.locator('[data-player-binding-subject]').select_option('s1')
    row.locator('[data-player-binding-save]').click()
    page.evaluate("async () => { await previewApp._renderTail; }")
    assert joao.locator('[data-player-binding-subject]').input_value()=='s1'
    navigate(page,activeSection='history');navigate(page,activeSection='settings')
    assert joao.locator('[data-player-binding-subject]').input_value()=='s1'
    joao.locator('[data-player-binding-subject]').select_option('s2')
    # Reduced motion suppresses both legacy decorations and new animations.
    assert page.locator(".application").evaluate("e=>[...e.querySelectorAll('*')].every(x=>getComputedStyle(x).animationName==='none')")
    ready(page,"player")
    page.locator('[data-player-card][data-subject-id="s1"]').focus()
    commit(page,changes={"s1":{"score":4.5}})
    page.wait_for_function("document.querySelector('[data-player-card][data-subject-id=s1] .gms-reputation-player-card__score strong').textContent==='4,5'")
    assert page.evaluate("document.activeElement.dataset.subjectId")=="s1"
    assert page.locator(".gms-feedback-card").count()==1
    card=page.locator(".gms-feedback-card").first
    assert "Sua reputação aumentou com Lapso" in card.inner_text() and "+0,5" in card.inner_text()
    assert card.locator(".gms-feedback-hearts").count()==2
    assert card.evaluate("e=>getComputedStyle(e).animationName")=="none"
    card.locator("[data-feedback-dismiss]").click()
    commit(page,profile="p2",changes={"s1":{"score":6}})
    assert "Sua reputação aumentou com Sentinela" in page.locator('.gms-feedback-card').inner_text()
    page.locator('[data-feedback-dismiss]').click()
    commit(page,changes={"s2":{"score":9}})
    commit(page,profile="p-self",changes={"s1":{"score":8}})
    assert page.locator('.gms-feedback-card').count()==0, "Other players and own matrix do not produce personal notices"
    commit(page,changes={"s1":{"score":3.5}})
    assert "Sua reputação diminuiu com Lapso" in page.locator(".gms-feedback-card").inner_text()
    page.locator("[data-feedback-dismiss]").click()
    page.evaluate("""async () => {
      const Schema = await import('/scripts/data/schema.js');
      const state = game.settings.get('gms-reputation','worldState');state.revision++;
      for (let i=3;i<=9;i++) {
        const id=`extra${i}`;state.profiles[id]=Schema.createProfile({id,name:`Contato ${i}`,focal:{name:`Contato ${i}`},subjectIds:['s1'],relationships:{s1:{score:0}}});
      }
      await game.settings.set('gms-reputation','worldState',state);
      await new Promise(resolve=>setTimeout(resolve,30));
    }""")
    page.evaluate("""async () => {
      const state=game.settings.get('gms-reputation','worldState');state.revision++;
      state.profiles.p1.relationships.s1.score=5;state.profiles.p2.relationships.s1.score=3;
      for(let i=3;i<=9;i++)state.profiles[`extra${i}`].relationships.s1.score=i%2 ? 2 : -1;
      await game.settings.set('gms-reputation','worldState',state);
      await new Promise(resolve=>setTimeout(resolve,30));
    }""")
    assert page.locator(".gms-feedback-card").count()==1
    assert page.locator(".gms-feedback-change").count()==2
    page.locator("[data-feedback-expand]").click()
    assert page.locator(".gms-feedback-change").count()==6
    assert page.locator(".gms-feedback-pages").is_visible()
    page.locator('[data-feedback-page][data-step="1"]').click()
    assert page.locator(".gms-feedback-change").count()==3
    page.locator('[data-feedback-page][data-step="-1"]').click()
    assert page.locator(".gms-feedback-change").count()==6
    for width in [320,390,768,1280]:
        page.set_viewport_size({"width":width,"height":900})
        dimensions=page.locator(".gms-player-dashboard__scroll").evaluate("e=>[e.clientWidth,e.scrollWidth]")
        assert dimensions[1]<=dimensions[0]+1, (width,dimensions)
    page.locator("[data-player-profile-step='1']").click()
    page.wait_for_function("previewApp.profileId==='p2'")
    assert page.locator(".gms-feedback-card").count()==1, "Browsing profiles keeps the personal recap"
    # Rapid updates coalesce without blocking navigation, at most two live DOM cards.
    ready(page,"player");page.emulate_media(reduced_motion="no-preference")
    for score in [4.5,5,5.5]:commit(page,changes={"s1":{"score":score}})
    assert page.locator(".gms-feedback-card").count()==1
    assert "+1,5" in page.locator(".gms-feedback-card").inner_text()
    ready(page,"player")
    page.clock.install()
    commit(page,changes={"s1":{"score":4.5}})
    page.locator("[data-feedback-inspect]").focus()
    page.clock.fast_forward(9000)
    assert page.locator(".gms-feedback-card").count()==1, "Focus pauses dismissal"
    page.mouse.move(0,0);page.locator("[data-navigation-open]").focus()
    page.clock.fast_forward(9000)
    assert page.locator(".gms-feedback-card").count()==1, "Personal recap stays until manual close"
    page.locator('[data-feedback-dismiss]').click()
    page.locator('[data-personal-reputation-open]').click()
    assert "Seu último resumo" in page.locator('.gms-feedback-card').inner_text()
    # Offline: close all surfaces, commit changes, reopen and catch up only Mari.
    page.clock.uninstall() if hasattr(page.clock,'uninstall') else None
    ready(page,'player')
    page.evaluate("async () => { await previewApp.close(); }")
    commit(page,changes={"s1":{"score":6},"s2":{"score":1}})
    commit(page,profile='p2',changes={"s1":{"score":2}})
    assert page.locator('.gms-feedback-card').count()==0
    page.evaluate("async () => { await previewShow('player'); }")
    assert page.locator('.gms-feedback-card').count()==1
    assert '2 aumentaram' not in page.locator('.gms-feedback-card').inner_text()
    assert '1 aumentaram · 1 diminuíram' in page.locator('.gms-feedback-card').inner_text()
    assert 'Fio Rubro' not in page.locator('.gms-feedback-card').inner_text()
    page.evaluate("async () => { await new Promise(r=>setTimeout(r,40)); }")
    page.goto(f"{URL}/?view=player&user=mari")
    page.wait_for_function('window.previewReady')
    assert page.locator('.gms-feedback-card').count()==0, 'No duplicate after persisted reopen'
    page.locator('[data-personal-reputation-open]').click()
    assert 'Sua reputação diminuiu com Sentinela' in page.locator('.gms-feedback-card').inner_text()
    assert not errors, errors
    browser.close()
print("browser-navigation: OK | keyboard, drafts, multi-entity saves, all areas at 320/390/768/1280, named mappings, own-player/offline recaps, replay, pagination and reduced motion")
