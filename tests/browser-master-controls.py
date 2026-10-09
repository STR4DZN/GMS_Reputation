"""Real-template/controller coverage for the extracted Master controls.
Run against the preview; GMS_CONTROL_TRACE optionally writes comparable checkpoints.
This adapter does not replace validation inside Foundry v13.
"""
import json
import os
import re
from playwright.sync_api import sync_playwright

URL = os.environ.get("GMS_PREVIEW_URL", "http://127.0.0.1:8766")
WORLD = "game.settings.get('gms-reputation','worldState')"
traces = []

def settle(page):
    page.evaluate("""async () => {
      await previewApp._saveController.whenIdle(); await previewApp._navigationTail;
      for (let i=0;i<5;i++) {
        const tail=previewApp._renderTail; await tail;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if (tail===previewApp._renderTail && !previewApp._saveController.isSaving) return;
      }
      throw new Error('Preview did not settle');
    }""")

def navigate(page, **target):
    page.evaluate("target => previewApp._navigate(target)", target)

def ready(page):
    page.goto(f"{URL}/?view=master&user=gm&reset=1")
    page.wait_for_function("window.previewReady")
    page.evaluate("""() => {
      let n=0; foundry.utils.randomID=(length=16)=>(`test${++n}`.padEnd(length,'x')).slice(0,length);
      window.controlMessages=[];
      for (const level of ['info','warn','error']) ui.notifications[level]=message=>controlMessages.push([level,message]);
    }""")

def click_mutation(page, selector, condition):
    page.locator(selector).click()
    page.wait_for_function(condition)
    settle(page)

def open_details(page, selector):
    page.locator(selector).evaluate("element => { element.closest('details').open=true; }")

def normalized(value):
    if isinstance(value, dict):
        return {key: normalized(item) for key, item in value.items() if key not in ('createdAt','updatedAt','timestamp')}
    if isinstance(value, list):
        return [normalized(item) for item in value]
    if isinstance(value, str):
        return re.sub(r'-[a-z0-9]+-(test\d+x*)$', r'-TIME-\1', value)
    return value

def checkpoint(page, name):
    settle(page)
    data = page.evaluate("""() => ({
      world:game.settings.get('gms-reputation','worldState'),
      backup:game.settings.get('gms-reputation','worldStateBackup'),
      selection:[previewApp.profileId,previewApp.subjectId,previewApp.newProfileGroupId,previewApp.activeSection],
      messages:controlMessages,
      panels:[...document.querySelectorAll('[data-master-section-panel]')].map(e=>[e.dataset.masterSectionPanel,e.hidden]),
      drafts:{fields:[...previewApp._fieldDrafts],relationships:[...previewApp._relationshipDrafts],portraits:[...previewApp._portraitDrafts],focal:[...previewApp._focalPortraitDrafts]}
    })""")
    traces.append([name, normalized(data)])

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1280,'height':900}, reduced_motion='reduce')
    page.set_default_timeout(10000)
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: errors.append(f'HTTP {response.status}: {response.url}') if response.status>=400 else None)
    ready(page)
    navigate(page, activeSection='profiles')
    checkpoint(page, 'initial')
    # Validation and accent-insensitive searches do not write world data.
    revision=page.evaluate(f'{WORLD}.revision')
    for selector in ['[data-master-create-group]','[data-master-create-profile]']:
        open_details(page, selector); page.locator(selector).click()
    assert page.evaluate(f'{WORLD}.revision') == revision
    page.locator('[data-master-profile-list-search]').fill('NÉXUS')
    assert page.locator('[data-master-group="g1"]').evaluate('e=>!e.hidden && e.open')
    page.locator('[data-master-profile-list-search]').fill('inexistente')
    assert page.locator('.gms-master-profile-group').evaluate_all('rows=>rows.every(e=>e.hidden)')
    page.locator('[data-master-profile-list-search]').fill('')
    checkpoint(page, 'validation-search')
    # Create via Enter, rename/reorder the group, and create/select a profile.
    open_details(page, '[data-master-new-group-name]')
    page.locator('[data-master-new-group-name]').fill('Órbita')
    page.locator('[data-master-new-group-name]').press('Enter')
    page.wait_for_function(f"Object.values({WORLD}.groups).some(g=>g.name==='Órbita')")
    settle(page)
    group=page.evaluate("previewApp.newProfileGroupId")
    open_details(page, f'[data-master-group="{group}"] [data-master-group-name]')
    page.locator(f'[data-master-group="{group}"] [data-master-group-name]').fill('Órbita Central')
    click_mutation(page, f'[data-master-group="{group}"] [data-master-group-save]', f"{WORLD}.groups['{group}'].name==='Órbita Central'")
    open_details(page, f'[data-master-group="{group}"] [data-master-group-move="up"]')
    revision=page.evaluate(f'{WORLD}.revision')
    click_mutation(page, f'[data-master-group="{group}"] [data-master-group-move="up"]', f'{WORLD}.revision>{revision}')
    open_details(page, '[data-master-new-profile-name]')
    page.locator('[data-master-new-profile-name]').fill('Matriz Órbita')
    page.locator('[data-master-new-profile-focal-name]').fill('Órbita')
    page.locator(f'[data-master-new-profile-group-choice="{group}"]').click()
    click_mutation(page, '[data-master-create-profile]', f"Object.values({WORLD}.profiles).some(p=>p.name==='Matriz Órbita')")
    profile=page.evaluate('previewApp.profileId')
    assert page.evaluate(f"{WORLD}.profiles['{profile}'].groupId") == group
    checkpoint(page, 'created-group-profile')
    page.locator('[data-master-profile-editor-name]').fill('Matriz Órbita editada')
    click_mutation(page, '[data-master-save-profile-editor]', f"{WORLD}.profiles['{profile}'].name==='Matriz Órbita editada'")
    # A roster toggle preserves relationship data, then restores inclusion.
    navigate(page, activeSection='characters')
    toggle='[data-master-profile-roster-toggle="s5"]'
    click_mutation(page, toggle, f"!{WORLD}.profiles['{profile}'].subjectIds.includes('s5')")
    assert page.evaluate(f"!!{WORLD}.profiles['{profile}'].relationships.s5")
    click_mutation(page, toggle, f"{WORLD}.profiles['{profile}'].subjectIds.includes('s5')")
    navigate(page, activeSection='profiles')
    page.locator('[data-master-profile-editor-group-choice="g1"]').click()
    click_mutation(page, '[data-master-save-profile-editor]', f"{WORLD}.profiles['{profile}'].groupId==='g1'")
    revision=page.evaluate(f'{WORLD}.revision')
    click_mutation(page, '[data-master-profile-move="up"]', f'{WORLD}.revision>{revision}')
    page.locator(f'[data-master-profile-editor-group-choice="{group}"]').click()
    click_mutation(page, '[data-master-save-profile-editor]', f"{WORLD}.profiles['{profile}'].groupId==='{group}'")
    checkpoint(page, 'edited-profile-roster-order')
    # Focal form and portrait share one explicit save, with calibrated values.
    page.locator('[data-master-focal-name]').fill('Focal Órbita')
    page.locator('[data-master-focal-description]').fill('Descrição focal atualizada')
    page.locator('[data-master-focal-editor] [name="portraitZoom"]').evaluate("e=>{e.value='137';e.dispatchEvent(new Event('input',{bubbles:true}));}")
    click_mutation(page, '[data-master-save-focal]', f"{WORLD}.profiles['{profile}'].focal.name==='Focal Órbita'")
    assert page.evaluate(f"{WORLD}.profiles['{profile}'].focal.portrait.zoom") == 137
    checkpoint(page, 'focal')
    # Character creation, edit, tags, order and separate portrait save.
    navigate(page, activeSection='characters', subjectId='s1')
    page.locator('[data-master-character-list-search]').fill('SÉNTINELA')
    assert page.locator('.gms-master-subject-registry__list > article').evaluate_all('rows=>rows.filter(e=>!e.hidden).length') == 1
    page.locator('[data-master-character-list-search]').fill('')
    open_details(page, '[data-master-new-subject-alias]')
    page.locator('[data-master-new-subject-alias]').fill('Órbita NPC')
    page.locator('[data-master-new-subject-real-name]').fill('Nome original')
    click_mutation(page, '[data-master-create-subject]', f"Object.values({WORLD}.subjects).some(s=>s.alias==='Órbita NPC')")
    subject=page.evaluate(f"Object.values({WORLD}.subjects).find(s=>s.alias==='Órbita NPC').id")
    navigate(page, subjectId=subject)
    page.locator('[data-master-subject-alias]').fill('Órbita NPC editado')
    page.locator('[data-master-subject-description]').fill('Biografia atualizada')
    page.locator('[data-master-subject-tags]').fill('alpha, beta; gamma')
    click_mutation(page, '[data-master-save-subject]', f"{WORLD}.subjects['{subject}'].alias==='Órbita NPC editado'")
    assert page.evaluate(f"{WORLD}.subjects['{subject}'].metadata.tags") == ['alpha','beta','gamma']
    revision=page.evaluate(f'{WORLD}.revision')
    click_mutation(page, '[data-master-subject-move="up"]', f'{WORLD}.revision>{revision}')
    page.locator('[data-master-portrait-editor] [name="portraitZoom"]').evaluate("e=>{e.value='146';e.dispatchEvent(new Event('input',{bubbles:true}));}")
    click_mutation(page, '[data-master-save-portrait]', f"{WORLD}.subjects['{subject}'].portrait.zoom===146")
    checkpoint(page, 'character-portrait')
    # Half points, expanded protocols, range and explicit quick saves.
    navigate(page, activeSection='relationship')
    page.locator('[data-master-bond]').check()
    page.locator('[data-master-score-input]').fill('11.5')
    assert page.locator('[data-master-score-preview]').inner_text() == '11,5'
    click_mutation(page, '[data-master-apply-specials]', f"{WORLD}.profiles['{profile}'].relationships['{subject}'].score===11.5")
    page.locator('[data-master-score-range]').evaluate("e=>{e.value='-2.5';e.dispatchEvent(new Event('input',{bubbles:true}));}")
    click_mutation(page, '[data-master-apply-score]', f"{WORLD}.profiles['{profile}'].relationships['{subject}'].score===-2.5")
    checkpoint(page, 'relationship')
    # Bulk selection, cancellation, archive/restore, activation and ordering.
    navigate(page, activeSection='characters')
    page.locator('[data-master-bulk-select-all]').check()
    assert page.locator('[data-master-bulk-subject]').evaluate_all('rows=>rows.every(e=>e.checked)')
    page.locator('[data-master-bulk-select-all]').uncheck()
    selected=f'[data-master-bulk-subject][value="{subject}"]'
    page.locator(selected).check()
    page.locator('[data-master-bulk-score-mode]').select_option('set')
    page.locator('[data-master-bulk-score-value]').fill('6.5')
    click_mutation(page, '[data-master-bulk-apply-relationship]', f"{WORLD}.profiles['{profile}'].relationships['{subject}'].score===6.5")
    page.locator(selected).check()
    revision=page.evaluate(f'{WORLD}.revision')
    page.once('dialog',lambda dialog: dialog.dismiss())
    page.locator('[data-master-bulk-action="archive"]').click()
    assert page.evaluate(f'{WORLD}.revision') == revision
    page.once('dialog',lambda dialog: dialog.accept())
    click_mutation(page, '[data-master-bulk-action="archive"]', f"{WORLD}.subjects['{subject}'].archived")
    page.locator(selected).check()
    click_mutation(page, '[data-master-bulk-action="restore"]', f"!{WORLD}.subjects['{subject}'].archived")
    page.locator(selected).check()
    page.once('dialog',lambda dialog: dialog.accept())
    click_mutation(page, '[data-master-bulk-action="deactivate"]', f"!{WORLD}.subjects['{subject}'].active")
    page.locator(selected).check()
    click_mutation(page, '[data-master-bulk-action="activate"]', f"{WORLD}.subjects['{subject}'].active")
    for direction in ['top','bottom']:
        page.locator(selected).check(); revision=page.evaluate(f'{WORLD}.revision')
        click_mutation(page, f'[data-master-bulk-action="{direction}"]', f'{WORLD}.revision>{revision}')
    checkpoint(page, 'bulk')
    # All permanent deletion types start locked, show confirmation, preserve backups.
    navigate(page, activeSection='cleanup')
    assert page.locator('[data-master-cleanup-delete]').evaluate_all('buttons=>buttons.every(e=>e.disabled)')
    page.locator('[data-master-cleanup-search]').fill('ÓRBITA')
    assert page.locator('[data-master-cleanup-row]:visible').count() == 3
    page.locator('[data-master-cleanup-search]').fill('')
    page.locator('[data-master-cleanup-unlock]').check()
    revision=page.evaluate(f'{WORLD}.revision')
    delete=f'[data-master-cleanup-delete="subject"][data-cleanup-id="{subject}"]'
    page.once('dialog',lambda dialog: dialog.dismiss()); page.locator(delete).click()
    assert page.evaluate(f'{WORLD}.revision') == revision
    page.once('dialog',lambda dialog: dialog.accept())
    click_mutation(page, delete, f"!{WORLD}.subjects['{subject}']")
    assert page.evaluate(f"!!game.settings.get('gms-reputation','worldStateBackup').subjects['{subject}']")
    assert page.evaluate(f"Object.values({WORLD}.profiles).every(p=>!p.subjectIds.includes('{subject}')&&!p.relationships['{subject}'])")
    checkpoint(page, 'delete-subject')
    page.locator('[data-master-cleanup-unlock]').check()
    page.once('dialog',lambda dialog: dialog.accept())
    click_mutation(page, f'[data-master-cleanup-delete="group"][data-cleanup-id="{group}"]', f"!{WORLD}.groups['{group}']")
    assert page.evaluate(f"{WORLD}.profiles['{profile}'].groupId") is None
    checkpoint(page, 'delete-group')
    page.locator('[data-master-cleanup-unlock]').check()
    page.once('dialog',lambda dialog: dialog.accept())
    click_mutation(page, f'[data-master-cleanup-delete="profile"][data-cleanup-id="{profile}"]', f"!{WORLD}.profiles['{profile}']")
    assert page.evaluate(f'Object.keys({WORLD}.subjects).length') == 5
    checkpoint(page, 'delete-profile')
    # Retained controls from a prior render/closed panel must become inert.
    page.locator('[data-master-cleanup-unlock]').check()
    page.evaluate("""() => {
      window.retiredControls=previewApp.element.querySelector('[data-master-panel-root]');
      retiredControls.querySelector('[data-master-new-group-name]').value='Grupo obsoleto';
      retiredControls.querySelector('[data-master-new-profile-name]').value='Perfil obsoleto';
      retiredControls.querySelector('[data-master-new-subject-alias]').value='NPC obsoleto';
    }""")
    old_world=page.evaluate(WORLD)
    page.evaluate('previewApp.render({force:true})'); settle(page)
    page.evaluate("""() => {
      for (const selector of ['[data-master-create-group]','[data-master-create-profile]',
          '[data-master-create-subject]','[data-master-save-profile-editor]','[data-master-save-subject]',
          '[data-master-save-focal]','[data-master-save-portrait]','[data-master-score-delta]',
          '[data-master-bulk-apply-relationship]','[data-master-cleanup-delete]']) {
        retiredControls.querySelector(selector)?.click();
      }
      for (const input of retiredControls.querySelectorAll('[data-portrait-editor] input')) {
        input.value='155'; input.dispatchEvent(new Event('input',{bubbles:true}));
      }
    }""")
    settle(page)
    assert page.evaluate(WORLD) == old_world
    assert page.evaluate('!previewApp._saveController.hasPending && !previewApp._fieldDrafts.size && !previewApp._focalPortraitDrafts.size')
    checkpoint(page, 'obsolete-controls')
    # Assistant can still edit, but cannot enter the permanent-cleanup workspace.
    page.evaluate("async () => { game.user.role=3;game.user.isGM=false;await previewApp.render({force:true}); }")
    navigate(page, activeSection='cleanup')
    assert page.evaluate('previewApp.activeSection') == 'profiles'
    assert page.locator('[data-master-cleanup-delete]').count() == 0
    assert page.locator('[data-master-save-profile-editor]').is_enabled()
    checkpoint(page, 'assistant')
    page.evaluate("async () => { window.closedRoot=previewApp.element; await previewApp.close(); }")
    assert not page.evaluate('previewApp.rendered')
    page.evaluate("closedRoot.querySelector('[data-master-create-group]')?.click()")
    assert page.evaluate(WORLD) == old_world
    assert not errors, errors
    browser.close()

if os.environ.get('GMS_CONTROL_TRACE'):
    with open(os.environ['GMS_CONTROL_TRACE'],'w') as output:
        json.dump(traces,output,ensure_ascii=False,sort_keys=True,indent=2)
print(f'browser-master-controls: OK | {len(traces)} checkpoints | registry, searches, roster, ordering, focal/portrait, half points, bulk, unlock/cancel/3 deletion types and backups')
