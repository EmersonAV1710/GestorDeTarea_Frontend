const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const result = {};
const code = ts.transpileModule(fs.readFileSync("src/lib/dragAutoScroll.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(code, { exports: result });

function environment() {
  const frames = new Map();
  const listeners = new Map();
  const scrolls = [];
  let nextFrame = 0;
  const viewport = {
    innerHeight: 600,
    requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    scrollBy(options) { scrolls.push(options.top); },
    addEventListener(type, listener) { const set = listeners.get(type) || new Set(); set.add(listener); listeners.set(type, set); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
  function frame(time) {
    const entry = frames.entries().next().value;
    if (!entry) return;
    frames.delete(entry[0]);
    entry[1](time);
  }
  function dispatch(type, event = {}) { for (const listener of [...(listeners.get(type) || [])]) listener(event); }
  return { controller: result.createDragAutoScroll(viewport), frames, listeners, scrolls, frame, dispatch };
}

test("dragging near viewport edges scrolls in the expected direction and stops in the center", () => {
  const env = environment();
  env.controller.start(20);
  env.frame(0);
  assert.ok(env.scrolls[0] < 0);
  env.dispatch("dragover", { clientY: 580 });
  env.frame(16);
  assert.ok(env.scrolls[1] > 0);
  env.dispatch("dragover", { clientY: 300 });
  env.frame(32);
  assert.equal(env.scrolls.length, 2);
  env.dispatch("dragover", { clientY: -1 });
  env.frame(48);
  assert.equal(env.scrolls.length, 2);
  env.controller.stop();
});

for (const event of ["drop", "dragend", "blur"]) {
  test(`${event} cancels scrolling and releases the event listeners`, () => {
    const env = environment();
    env.controller.start(10);
    env.frame(0);
    env.dispatch(event);
    const count = env.scrolls.length;
    env.frame(16);
    assert.equal(env.frames.size, 0);
    assert.equal(env.scrolls.length, count);
    assert.equal([...env.listeners.values()].reduce((total, set) => total + set.size, 0), 0);
  });
}

test("restarting and cleaning up a drag leaves only one loop and no active listeners", () => {
  const env = environment();
  env.controller.start(20);
  env.controller.start(580);
  assert.equal(env.frames.size, 1);
  assert.equal([...env.listeners.values()].reduce((total, set) => total + set.size, 0), 4);
  env.controller.stop();
  assert.equal(env.frames.size, 0);
  assert.equal([...env.listeners.values()].reduce((total, set) => total + set.size, 0), 0);
});
