const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('sound switch silences every sound and completion uses a distinct short melody', () => {
  const exports = {}, notes = [];
  const document = { documentElement: { dataset: { sounds: 'off' } } };
  let contexts = 0;
  class AudioContext {
    constructor() { contexts++; }
    currentTime = 0;
    state = 'running';
    destination = {};
    createOscillator() {
      const frequency = { setValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime(value) { this.end = value; } };
      const note = { frequency, connect() {}, disconnect() {}, start() {}, stop() {} };
      notes.push(note); return note;
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const code = ts.transpileModule(fs.readFileSync('src/lib/interfaceSounds.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, document, AudioContext, window: { AudioContext }, require: () => ({}) });
  for (const kind of ['click', 'success', 'error']) exports.playInterfaceSound(kind);
  assert.equal(contexts, 0);
  document.documentElement.dataset.sounds = 'on';
  exports.playInterfaceSound('click');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].frequency.value, 230);
  assert.equal(notes[0].frequency.end, 160);
  exports.playInterfaceSound('success');
  assert.equal(notes.length, 4);
  assert.deepEqual(notes.slice(1).map(n => n.frequency.value), [160, 349.23, 466.16]);
  assert.equal(contexts, 1);
  document.documentElement.dataset.sounds = 'off';
  exports.playInterfaceSound('success');
  assert.equal(notes.length, 4);
});
