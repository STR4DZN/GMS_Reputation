import assert from 'node:assert/strict';

class FakeElement {
  constructor(attrs = {}, text = '', inner = '') { this.attrs = attrs; this.textContent = text; this.inner = inner; }
  getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; }
  querySelector(selector) {
    if (selector === '[data-communion-bouquet="true"]') return this.inner.includes('data-communion-bouquet="true"') ? {} : null;
    if (selector === '[data-dating-bouquet="true"]') return this.inner.includes('data-dating-bouquet="true"') ? {} : null;
    if (selector === '[data-vinculo-star="true"]') return this.inner.includes('data-vinculo-star="true"') ? {} : null;
    return null;
  }
}
function attrsFrom(raw) {
  const out = {};
  const re = /([\w:-]+)="([^"]*)"/g;
  let m; while ((m = re.exec(raw))) out[m[1]] = m[2];
  return out;
}
class FakeDOMParser {
  parseFromString(html) {
    const characterRows = [];
    const re = /<div\s+([^>]*data-character="[^"]+"[^>]*)>([\s\S]*?)<\/div>/gi;
    let m; while ((m = re.exec(html))) characterRows.push(new FakeElement(attrsFrom(m[1]), '', m[2]));
    const focalMatch = html.match(/<div\s+([^>]*data-gms-focal-profile="true"[^>]*)>/i);
    const focal = focalMatch ? new FakeElement(attrsFrom(focalMatch[1])) : null;
    return { body: {
      querySelectorAll(selector) {
        if (selector.includes('[data-character]')) return characterRows;
        if (selector === 'table tr') return [];
        return [];
      },
      querySelector(selector) {
        if (selector === '[data-gms-focal-profile="true"]') return focal;
        return null;
      }
    }};
  }
}

globalThis.DOMParser = FakeDOMParser;
globalThis.CONST = { JOURNAL_ENTRY_PAGE_FORMATS: { HTML: 1 } };
globalThis.game = { user: { id: 'gm-test', isGM: true } };

const { parseLegacyPageContent } = await import('../scripts/migration/legacy-parser.js');
const { buildLegacyMigrationSnapshot } = await import('../scripts/migration/legacy-migration.js');

const html = `@Actor[Actor.TEST]{Operador Legado}<section class="farm-reputation-card">
<div data-character="Daniel Shirako" data-value="10.5" data-communion="true" data-bond="false" data-portrait-src="page-daniel.gif" data-portrait-zoom="87" data-portrait-x="44" data-portrait-y="61"></div>
<div data-character="Agnes" data-value="-7.2" data-bond="true"></div>
<div data-gms-focal-profile="true" data-profile-src="focal.webp" data-profile-zoom="125" data-profile-x="51" data-profile-y="39" data-profile-description="Texto%20focal"></div>
</section>`;
const parsed = parseLegacyPageContent(html);
assert.equal(parsed.detectedFormat, 'card');
assert.equal(parsed.records.length, 2);
assert.equal(parsed.records[0].score, 10.5);
assert.equal(parsed.records[0].communion, true);
assert.equal(parsed.records[1].score, -7);
assert.equal(parsed.records[1].bond, true);
assert.equal(parsed.focal.description, 'Texto focal');
assert.equal(parsed.actorHeader, '@Actor[Actor.TEST]{Operador Legado}');

const page = {
  id: 'PAGE1', name: 'Perfil Um', type: 'text', uuid: 'JournalEntry.J1.JournalEntryPage.PAGE1',
  text: { format: 1, content: html }, _stats: { modifiedTime: 1234 }
};
const journal = {
  id: 'J1', uuid: 'JournalEntry.J1', name: 'Reputação', documentName: 'JournalEntry',
  pages: { contents: [page] },
  getFlag(scope, key) {
    assert.equal(scope, 'world');
    assert.equal(key, 'gmsReputationSharedPortraits');
    return { schema: 1, updatedAt: 9999, portraits: {
      'Daniel Shirako': { src: 'flag-daniel.webp', zoom: 100, x: 50, y: 50 }
    }};
  }
};
const snapshot = await buildLegacyMigrationSnapshot(journal);
assert.equal(snapshot.available, true);
assert.equal(snapshot.report.pagesScanned, 1);
assert.equal(snapshot.report.profilesImported, 1);
assert.equal(snapshot.report.subjectsImported, 11);
assert.equal(snapshot.report.portraitConflicts.length, 1);
assert.equal(snapshot.report.portraitConflicts[0].chosenSource, 'journal-flag');
assert.equal(snapshot.state.subjects['gms-subject-001'].portrait.src, 'flag-daniel.webp');
const profile = snapshot.state.profiles['gms-profile-PAGE1'];
assert.equal(profile.relationships['gms-subject-001'].score, 10.5);
assert.equal(profile.relationships['gms-subject-001'].communion, true);
assert.equal(profile.relationships['gms-subject-003'].score, -7);
assert.equal(profile.relationships['gms-subject-003'].bond, true);
assert.equal(profile.focal.description, 'Texto focal');
assert.equal(profile.focal.name, 'Operador Legado');
assert.equal(snapshot.state.migration.legacyMacroImported, true);
console.log('legacy-migration: OK');
