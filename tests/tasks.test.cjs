const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const result = {};
  cache.set(file, result);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports: result, require: id => {
    if (!id.startsWith(".")) return require(id);
    const target = path.resolve(path.dirname(file), id);
    return load(fs.existsSync(target + ".tsx") ? target + ".tsx" : target + ".ts");
  }});
  return result;
}
const { TasksPage } = load("src/components/pages/TasksPage.tsx");
const { ActivityList } = load("src/components/ActivityParts.tsx");
const course = { id: "course", name: "Programación", is_active: true };
const base = { description: "Entrega", course_id: "course", activity_type: "tarea", due_date: null, review_required: true };
const items = [{ ...base, id: "pending", title: "Tarea pendiente", status: "pending" },
  { ...base, id: "done", title: "Tarea hecha", status: "completed" }];
const props = { items, loaded: true, busy: false, complete() {}, reopen() {}, onSave() {}, onDelete() {}, onChangeView() {},
  filters: { courses: [course], courseFilter: "", typeFilter: "", from: "", to: "", setCourseFilter() {}, setTypeFilter() {}, setFrom() {}, setTo() {} } };

test("the task board separates pending and completed activities and exposes the full list", () => {
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, view: "board" }));
  const sections = [...html.matchAll(/<section class="panel task-column"[^>]*>(.*?)<\/section>/g)].map(match => match[1]);
  assert.equal(sections.length, 2);
  assert.match(sections[0], /Pendientes.*Tarea pendiente/);
  assert.doesNotMatch(sections[0], /Tarea hecha/);
  assert.match(sections[1], /Hechas.*Tarea hecha/);
  assert.doesNotMatch(sections[1], /Tarea pendiente/);
  assert.match(html, /Ver todas las tareas/);
  assert.match(html, /Modificar Tarea pendiente/);
  assert.match(html, /Borrar Tarea hecha/);
});

test("the full list shows both statuses and offers a return to the board", () => {
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, view: "list" }));
  assert.match(html, /Todas las tareas/);
  assert.match(html, /Tarea pendiente/);
  assert.match(html, /Tarea hecha/);
  assert.match(html, /Ver pendientes y hechas/);
  assert.doesNotMatch(html, /class="panel task-column"/);
});

test("completed checkboxes reopen activities and busy activities cannot be changed", () => {
  const tree = ActivityList({ items, courses: [course], loaded: true, complete() {}, reopen() {}, busy: true });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /aria-label="Marcar como pendiente Tarea hecha"/);
  assert.equal((html.match(/disabled=""/g) || []).length, 2);
});

test("past pending activities show as overdue while delivered activities stay completed", () => {
  const dated = [
    { ...items[0], due_date: "2000-01-01" },
    { ...items[1], due_date: "2000-01-01" },
  ];
  const html = renderToStaticMarkup(React.createElement(ActivityList, {
    items: dated, courses: [course], loaded: true, complete() {}, reopen() {},
  }));
  assert.equal((html.match(/Vencida/g) || []).length, 1);
  assert.match(html, /class="finished">Tarea hecha/);
});

test("checkbox actions complete pending tasks and reopen completed tasks", () => {
  const calls = [];
  const tree = ActivityList({ items, courses: [course], loaded: true,
    complete: id => calls.push(["complete", id]), reopen: id => calls.push(["reopen", id]) });
  function inputs(node) {
    if (!node || typeof node !== "object") return [];
    return [...(node.type === "input" ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(inputs)];
  }
  const checkboxes = inputs(tree);
  checkboxes.find(input => !input.props.checked).props.onChange();
  checkboxes.find(input => input.props.checked).props.onChange();
  assert.deepEqual(calls, [["complete", "pending"], ["reopen", "done"]]);
});


const { buildMonthDays, dateKey, groupActivitiesByDate } = load("src/lib/calendar.ts");
const { CalendarPage } = load("src/components/pages/CalendarPage.tsx");

test("month grids cover full Monday-to-Sunday weeks, including leap years and year boundaries", () => {
  for (const [year, month, expectedDays] of [[2024, 1, 29], [2026, 1, 28], [2026, 2, 31], [2027, 0, 31]]) {
    const days = buildMonthDays(year, month);
    assert.equal(days.length % 7, 0);
    assert.equal(days[0].date.getDay(), 1);
    assert.equal(days[days.length - 1].date.getDay(), 0);
    assert.equal(days.filter(day => day.isCurrentMonth).length, expectedDays);
    assert.equal(new Set(Array.from(days, day => day.key)).size, days.length);
  }
  assert.equal(buildMonthDays(2027, 0)[0].key, "2026-12-28");
  assert.equal(buildMonthDays(2024, 1).find(day => day.day === 29 && day.isCurrentMonth).key, "2024-02-29");
  assert.equal(dateKey(new Date(2026, 9, 12, 12)), "2026-10-12");
});

test("activities appear on their exact date and undated activities are excluded from the grid", () => {
  const dated = [{ ...items[1], due_date: "2026-11-20" }, { ...items[0], due_date: "2026-11-20" },
    { ...items[0], id: "next", due_date: "2026-11-21" }, { ...items[0], id: "undated", due_date: null }];
  const groups = groupActivitiesByDate(dated);
  assert.equal(groups.size, 2);
  assert.equal(groups.get("2026-11-20").length, 2);
  assert.equal(groups.get("2026-11-20")[0].status, "pending");
  assert.equal(groups.get("2026-11-21")[0].id, "next");
  assert.equal(dated[0].status, "completed");
});

test("calendar shows month navigation and a dialog for the selected day's tasks", () => {
  const today = dateKey(new Date());
  const html = renderToStaticMarkup(React.createElement(CalendarPage, {
    items: [{ ...items[0], due_date: today }, items[1]], courses: [course], loaded: true,
    busy: false, complete() {}, reopen() {},
  }));
  assert.match(html, /Calendario/);
  assert.match(html, /Mes anterior/);
  assert.match(html, /Mes siguiente/);
  assert.match(html, /aria-current="date"/);
  assert.match(html, /Lun.*Mar.*Mié.*Jue.*Vie.*Sáb.*Dom/);
  assert.match(html, /<dialog[^>]*class="logout-dialog calendar-agenda"/);
  assert.match(html, /Cerrar actividades del día/);
  assert.doesNotMatch(html, /calendar-layout/);
  assert.match(html, /Tarea pendiente/);
  assert.match(html, /Actividades sin fecha/);
  assert.match(html, /Tipo de entrega/);
});


const { PanelPage, upcomingWithinWeeks } = load("src/components/pages/PanelPage.tsx");

test("panel shows every activity due within one week by default", () => {
  const today = new Date();
  const dueIn = days => { const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12); date.setDate(date.getDate() + days); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
  const upcoming = [
    { ...items[0], id: "later", title: "Más tarde", due_date: dueIn(8) },
    ...Array.from({ length: 8 }, (_, index) => ({ ...items[0], id: `task-${index}`, title: `Actividad ${index + 1}`, due_date: dueIn(index % 7) })).reverse(),
  ];
  const html = renderToStaticMarkup(React.createElement(PanelPage, { ...props, upcoming, onAnalyze() {}, onShowAll() {} }));
  assert.equal((html.match(/<article /g) || []).length, 8);
  assert.doesNotMatch(html, /Más tarde/);
  const filterRow = html.match(/<div class="filters panel-filters">([\s\S]*?)<\/div>/)?.[1];
  assert(filterRow);
  assert.match(filterRow, /Curso.*Tipo de entrega.*Semanas/);
  assert.doesNotMatch(filterRow, /Desde|Hasta/);
  assert.match(html, /<h2>Actividades próximas<\/h2>/);
  assert.doesNotMatch(html, /<h3[^>]*>Próximas<\/h3>/);
  assert.match(html, /<option value="1" selected="">1 semana<\/option>/);
  assert.match(html, /<option value="all">Todas<\/option>/);
});

test("upcoming exam stays above the overdue section with only past tasks", () => {
  const { localToday } = load("src/lib/proposals.ts");
  const exam = { ...items[0], id: "exam", title: "Examen en línea", due_date: localToday(), activity_type: "examen" };
  const overdue = [
    { ...items[0], id: "task1", title: "Tarea 1", due_date: "2000-01-01" },
    { ...items[0], id: "task3", title: "Tarea 3", due_date: "2000-02-01" },
  ];
  const html = renderToStaticMarkup(React.createElement(PanelPage, {
    ...props, items: [exam, ...overdue], upcoming: [exam], overdue, undated: [], onAnalyze() {}, onShowAll() {},
  }));
  assert.ok(html.indexOf("Examen en línea") < html.indexOf('id="overdue-title"'));
  const overdueSection = html.match(/<section class="panel-task-group" aria-labelledby="overdue-title">([\s\S]*?)<\/section>/)?.[1];
  assert(overdueSection);
  assert.match(overdueSection, /Vencidas.*2/);
  assert.match(overdueSection, /Tarea 1/);
  assert.match(overdueSection, /Tarea 3/);
  assert.doesNotMatch(overdueSection, /Examen en línea/);
});

test("upcoming deadline includes the last day and can be extended or removed", () => {
  const activities = [6, 7, 8, 14, 15].map(days => ({ ...items[0], id: String(days), due_date: `2026-10-${String(12 + days).padStart(2, "0")}` }));
  assert.deepEqual(upcomingWithinWeeks(activities, 1, "2026-10-12").map(item => item.id), ["6", "7"]);
  assert.deepEqual(upcomingWithinWeeks(activities, 2, "2026-10-12").map(item => item.id), ["6", "7", "8", "14"]);
  assert.equal(upcomingWithinWeeks(activities, null, "2026-10-12").length, 5);
});


test("shared task lists always show earlier dates first and undated tasks last without changing the data", () => {
  const unordered = [
    { ...items[0], id: "undated", title: "Sin fecha" },
    { ...items[1], id: "later", title: "Más tarde", due_date: "2027-01-01" },
    { ...items[0], id: "earlier", title: "Más cercana", due_date: "2026-12-31" },
  ];
  const html = renderToStaticMarkup(React.createElement(ActivityList, { items: unordered, courses: [course], loaded: true, complete() {} }));
  assert.ok(html.indexOf("Más cercana") < html.indexOf("Más tarde"));
  assert.ok(html.indexOf("Más tarde") < html.indexOf("Sin fecha"));
  assert.deepEqual(unordered.map(item => item.id), ["undated", "later", "earlier"]);
});

test("date ordering updates when a task is edited and resolves matching dates consistently", () => {
  const { compareActivityDates } = load("src/lib/activityOrder.ts");
  const activities = [{ title: "Zeta", due_date: "2026-11-20" }, { title: "Alfa", due_date: "2026-11-20" }];
  assert.deepEqual([...activities].sort(compareActivityDates).map(item => item.title), ["Alfa", "Zeta"]);
  activities[0].due_date = "2026-11-19";
  assert.deepEqual([...activities].sort(compareActivityDates).map(item => item.title), ["Zeta", "Alfa"]);
});


const { AuthPage } = load("src/components/pages/AuthPage.tsx");
test("registration displays checkmarks for fulfilled password rules and enables submission only when all match", () => {
  const authProps = { authMode: "register", email: "", username: "", busy: false, authError: "", notice: "", password: "", passwordConfirmation: "" };
  function render(password, passwordConfirmation = password) {
    return renderToStaticMarkup(React.createElement(AuthPage, { ...authProps, password, passwordConfirmation }));
  }
  for (const password of ["Clave1", "clave123", "ClaveLarga"]) {
    assert.match(render(password), /class="primary" disabled=""/);
  }
  const valid = render("Clave8ok");
  assert.equal((valid.match(/aria-label="Cumplido"/g) || []).length, 4);
  assert.doesNotMatch(valid, /Pendiente|Hasta 128|contraseñas comunes|maxLength="128"|maxlength="128"/);
  assert.doesNotMatch(valid, /class="primary" disabled=""/);
  assert.match(render("Clave8ok", "OtraClave1"), /class="primary" disabled=""/);
  assert.doesNotMatch(render("A" + "x".repeat(150) + "1"), /class="primary" disabled=""/);
});


test("task content is escaped instead of rendering injected HTML", () => {
  const payload = '<script>alert("xss")</script>';
  const html = renderToStaticMarkup(React.createElement(ActivityList, { items: [{ ...items[0], title: payload, description: payload }], courses: [course], loaded: true, complete() {} }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});


test("the file card X clears the selected file without opening the picker or submitting", () => {
  const { AnalyzePage } = load("src/components/pages/AnalyzePage.tsx");
  let selected = "programa.pdf", focused = false, prevented = false, stopped = false;
  const input = { value: "selected-file", focus() { focused = true; } };
  const tree = AnalyzePage({ pendingReviews: [], savedDocuments: [], reviewFileName: "", courses: [], activeCourses: [], uploadCourse: "",
    uploadFormRef: { current: { querySelector() { return input; } } }, selectedFileName: selected,
    setSelectedFileName(value) { selected = value; }, busy: false, proposals: [], docId: "", reviewError: "" });
  function find(node) {
    if (!node || typeof node !== "object") return [];
    return [...(node.props?.className === "upload-file-remove" ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(find)];
  }
  const button = find(tree)[0];
  assert.equal(button.props.type, "button");
  button.props.onClick({ preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.equal(selected, "");
  assert.equal(input.value, "");
  assert.equal(focused, true);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
});

test("past document proposals offer overdue or delivered status", () => {
  const { AnalyzePage } = load("src/components/pages/AnalyzePage.tsx");
  const props = { pendingReviews: [], savedDocuments: [], reviewFileName: "programa.pdf", courses: [],
    activeCourses: [], uploadCourse: "", uploadFormRef: { current: null }, reviewRef: { current: null },
    selectedFileName: "", busy: false, docId: "documento", reviewError: "", onEdit() {}, onConfirm() {},
    proposals: [{ title: "Entrega anterior", description: "", due_date: "2000-01-01", review_required: false, status: "pending" }] };
  const past = renderToStaticMarkup(React.createElement(AnalyzePage, props));
  assert.match(past, /Esta fecha ya pasó/);
  assert.match(past, /Vencida/);
  assert.match(past, /Entregada/);
  const future = renderToStaticMarkup(React.createElement(AnalyzePage, { ...props,
    proposals: [{ ...props.proposals[0], due_date: "2099-01-01" }] }));
  assert.doesNotMatch(future, /Esta fecha ya pasó/);
});
