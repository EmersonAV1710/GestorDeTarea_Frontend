const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function createBoard(busy = false, withCourse = false) {
  const state = [];
  let cursor = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
    useId() { return hooks.useState(() => `test-id-${cursor}`)[0]; },
    useEffect() {},
  };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const result = {};
    cache.set(file, result);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
    }}).outputText;
    vm.runInNewContext(code, { exports: result, window: {
      innerHeight: 800, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
      scrollBy() {}, addEventListener() {}, removeEventListener() {},
    }, require: id => {
      if (id === "react") return hooks;
      if (!id.startsWith(".")) return require(id);
      const target = path.resolve(path.dirname(file), id);
      return load(fs.existsSync(target + ".tsx") ? target + ".tsx" : target + ".ts");
    }});
    return result;
  }
  const { TasksPage } = load("src/components/pages/TasksPage.tsx");
  const { ActivityList } = load("src/components/ActivityParts.tsx");
  const calls = [];
  const props = { items: [
    { id: "pending", status: "pending", title: "Pendiente", description: "", course_id: "course", due_date: null, review_required: false },
    { id: "done", status: "completed", title: "Hecha", description: "", course_id: "course", due_date: null, review_required: false },
  ], filters: { courses: withCourse ? [{ id: "course", name: "Prueba", is_active: true }] : [], courseFilter: "", typeFilter: "", from: "", to: "" },
    loaded: true, busy, view: "board", onChangeView() {}, onSave() {}, onDelete() {}, onCourses() {},
    onCreate: (courseId, values) => { calls.push(["create", courseId, values]); return Promise.resolve(null); },
    complete: id => calls.push(["complete", id]), reopen: id => calls.push(["reopen", id]),
  };
  function render() { cursor = 0; return TasksPage(props); }
  function find(node, predicate) {
    if (!node || typeof node !== "object") return [];
    return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => find(child, predicate))];
  }
  function card(id) {
    const lists = find(render(), node => node.type === ActivityList);
    return lists.flatMap(node => find(ActivityList(node.props), child => child.type === "article")).find(node => node.key === id);
  }
  function column(status) {
    return find(render(), node => node.props?.["aria-labelledby"] === (status === "pending" ? "pending-tasks-title" : "done-tasks-title"))[0];
  }
  const data = new Map();
  const event = { dataTransfer: { setData: (type, value) => data.set(type, value), getData: type => data.get(type) || "" },
    prevented: false, preventDefault() { this.prevented = true; } };
  return { card, column, event, calls, props, render, find };
}

test("dragging pending tasks to done completes them and highlights the target", () => {
  const board = createBoard();
  board.card("pending").props.onDragStart(board.event);
  assert.equal(board.event.dataTransfer.effectAllowed, "move");
  board.column("completed").props.onDragOver(board.event);
  assert.equal(board.event.prevented, true);
  assert.match(board.column("completed").props.className, /is-drop-target/);
  board.column("completed").props.onDrop(board.event);
  assert.deepEqual(board.calls, [["complete", "pending"]]);
  assert.doesNotMatch(board.column("completed").props.className, /is-drop-target/);
});

test("dragging done tasks to pending reopens them", () => {
  const board = createBoard();
  board.card("done").props.onDragStart(board.event);
  board.column("pending").props.onDrop(board.event);
  assert.deepEqual(board.calls, [["reopen", "done"]]);
});

test("same-column, cancelled and external drops do not change task status", () => {
  const board = createBoard();
  board.card("pending").props.onDragStart(board.event);
  board.column("pending").props.onDrop(board.event);
  assert.deepEqual(board.calls, []);
  board.card("pending").props.onDragStart(board.event);
  board.card("pending").props.onDragEnd();
  board.column("completed").props.onDrop(board.event);
  assert.deepEqual(board.calls, []);
  board.event.dataTransfer.setData("application/x-tarevia-activity", "pending");
  board.column("completed").props.onDrop(board.event);
  assert.deepEqual(board.calls, []);
});

test("busy tasks cannot be dragged or changed through a drop", () => {
  const board = createBoard(true);
  assert.equal(board.card("pending").props.draggable, false);
  board.card("pending").props.onDragStart(board.event);
  assert.equal(board.event.prevented, true);
  board.column("completed").props.onDrop(board.event);
  assert.deepEqual(board.calls, []);
});

test("manual task form creates a task without a document", async () => {
  const board = createBoard(false, true);
  board.find(board.render(), node => node.type === "button" && node.props.children === "Añadir tarea")[0].props.onClick();
  const section = board.find(board.render(), node => node.props?.["aria-labelledby"] === "manual-task-title")[0];
  assert(section);
  const selects = board.find(section, node => node.type === "select");
  assert.equal(selects[0].props.value, "");
  assert.equal(selects[1].props.value, "");
  assert.equal(selects[0].props.required, true);
  assert.equal(selects[1].props.required, true);
  board.find(section, node => node.type === "input" && node.props.placeholder === "Ej. Entregar informe")[0]
    .props.onChange({ target: { value: "  Tarea manual  " } });
  function form() { return board.find(board.render(), node => node.props?.["aria-labelledby"] === "manual-task-title")
    .flatMap(node => board.find(node, child => child.type === "form"))[0]; }
  function submit() { form().props.onSubmit({ preventDefault() {} }); }
  const save = () => board.find(form(), node => node.type === "button" && node.props.children === "Guardar tarea")[0];
  assert.equal(save().props.disabled, true);
  submit();
  assert.deepEqual(board.calls, []);
  board.find(form(), node => node.type === "select")[0].props.onChange({ target: { value: "course" } });
  assert.equal(save().props.disabled, true);
  submit();
  assert.deepEqual(board.calls, []);
  board.find(form(), node => node.type === "select")[1].props.onChange({ target: { value: "tarea" } });
  board.find(form(), node => node.type === "input" && node.props.placeholder === "Ej. Entregar informe")[0]
    .props.onChange({ target: { value: "   " } });
  assert.equal(save().props.disabled, true);
  submit();
  assert.deepEqual(board.calls, []);
  board.find(form(), node => node.type === "input" && node.props.placeholder === "Ej. Entregar informe")[0]
    .props.onChange({ target: { value: "  Tarea manual  " } });
  assert.equal(save().props.disabled, false);
  submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(board.calls[0][0], "create");
  assert.equal(board.calls[0][1], "course");
  assert.equal(board.calls[0][2].activity_type, "tarea");
  assert.equal(board.calls[0][2].title, "Tarea manual");
  assert.equal(board.calls[0][2].due_date, null);
  assert.equal(board.calls[0][2].review_required, true);
  assert.equal("document_id" in board.calls[0][2], false);
  assert.equal(board.find(board.render(), node => node.props?.["aria-labelledby"] === "manual-task-title").length, 0);
});
