const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('screens start at the top, restore their own position, and preserve explicit task navigation', () => {
  const refs = [], listeners = new Set(), calls = [];
  let cursor = 0, previousScreen, cleanup;
  const window = {
    scrollY: 0,
    scrollTo(options) { calls.push(options.top); this.scrollY = options.top; },
    addEventListener(event, listener) { listeners.add(listener); },
    removeEventListener(event, listener) { listeners.delete(listener); },
  };
  const hooks = {
    useRef(initial) { const index = cursor++; return refs[index] ??= { current: initial }; },
    useEffect(effect, [screen]) {
      if (screen !== previousScreen) { cleanup?.(); previousScreen = screen; cleanup = effect(); }
    },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/lib/useScreenScroll.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, window, require: () => hooks });
  function render(screen, target = false) { cursor = 0; exports.useScreenScroll(screen, target); }
  function scroll(top) { window.scrollY = top; listeners.forEach(listener => listener()); }
  render('alice:panel');
  assert.equal(window.scrollY, 0);
  scroll(650);
  render('alice:tareas');
  assert.equal(window.scrollY, 0);
  scroll(220);
  render('alice:panel');
  assert.equal(window.scrollY, 650);
  render('alice:tareas');
  assert.equal(window.scrollY, 220);
  render('bob:panel');
  assert.equal(window.scrollY, 0);
  scroll(900);
  const before = calls.length;
  render('alice:tareas', true);
  assert.equal(calls.length, before);
  assert.equal(listeners.size, 1);
});
