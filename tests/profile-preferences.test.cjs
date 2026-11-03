const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('server preferences override browser cache and changes are sent with the account token', async () => {
  const storage = new Map();
  const requests = [];
  const exports = {};
  const document = { documentElement: { dataset: {} } };
  const code = ts.transpileModule(fs.readFileSync('src/lib/profilePreferences.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, document, process: { env: {} },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    matchMedia: () => ({ matches: false }), window: { dispatchEvent() {} }, StorageEvent: class {}, CustomEvent: class {},
    fetch: async (url, init) => { requests.push({ url, ...init }); return { ok: true }; },
  });
  exports.selectPreferenceProfile('Alice');
  exports.savePreference('accent', 'red');
  exports.selectPreferenceProfile('Alice', 'alice-token', { accent: 'blue', background: 'galaxy', theme: 'dark', language: 'en', sounds: 'off', dark_style: 'black' });
  assert.equal(document.documentElement.dataset.darkStyle, 'black');
  assert.equal(document.documentElement.dataset.accent, 'blue');
  assert.equal(document.documentElement.dataset.sounds, 'off');
  assert.equal(document.documentElement.dataset.background, 'galaxy');
  assert.equal(storage.get('tarevia-language'), 'en');
  exports.savePreference('accent', 'green');
  exports.savePreference('background', 'mint');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers.Authorization, 'Bearer alice-token');
  assert.equal(requests[0].method, 'PATCH');
  assert.deepEqual(JSON.parse(requests[0].body), { accent: 'green' });
  assert.deepEqual(JSON.parse(requests[1].body), { background: 'mint' });
  exports.selectPreferenceProfile();
  assert.equal(document.documentElement.dataset.darkStyle, 'gray');
  exports.savePreference('accent', 'violet');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
});

test('preferences survive module reload and remain isolated between accounts and guest', () => {
  const storage = new Map();
  const document = { documentElement: { dataset: {} } };
  function load() {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync('src/lib/profilePreferences.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, { exports, document, process: { env: {} },
      localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
      matchMedia: () => ({ matches: false }),
      window: { dispatchEvent() {} }, StorageEvent: class {},
    });
    return exports;
  }
  let preferences = load();
  preferences.selectPreferenceProfile();
  preferences.savePreference('accent', 'green');
  preferences.selectPreferenceProfile('Alice');
  assert.equal(document.documentElement.dataset.accent, 'default');
  for (const [key, value] of Object.entries({ theme: 'dark', accent: 'violet', background: 'galaxy', language: 'en' })) preferences.savePreference(key, value);
  preferences.selectPreferenceProfile('Bob');
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(document.documentElement.dataset.background, 'default');
  assert.equal(storage.get('tarevia-language'), undefined);
  preferences.savePreference('accent', 'coral');
  preferences = load();
  preferences.selectPreferenceProfile('ALICE');
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(document.documentElement.dataset.accent, 'violet');
  assert.equal(document.documentElement.dataset.background, 'galaxy');
  assert.equal(storage.get('tarevia-language'), 'en');
  preferences.selectPreferenceProfile('Bob');
  assert.equal(document.documentElement.dataset.accent, 'coral');
  preferences.selectPreferenceProfile();
  assert.equal(document.documentElement.dataset.accent, 'green');
});
