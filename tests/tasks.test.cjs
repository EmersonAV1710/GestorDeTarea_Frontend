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
const { closeOtherActionMenus } = load("src/lib/actionMenus.ts");
const { localToday } = load("src/lib/proposals.ts");
const { matchesActivityStatus } = load("src/lib/activityStatus.ts");
const course = { id: "course", name: "Programación", is_active: true };
const base = { description: "Entrega", course_id: "course", activity_type: "tarea", due_date: null, review_required: true };
const items = [{ ...base, id: "pending", title: "Tarea pendiente", status: "pending" },
  { ...base, id: "done", title: "Tarea hecha", status: "completed" }];
const props = { items, loaded: true, busy: false, complete() {}, reopen() {}, onSave() {}, onDelete() {}, onChangeView() {},
  filters: { courses: [course], courseFilter: "", typeFilter: "", statusFilter: "", upcomingWeeks: null, from: "", to: "", setCourseFilter() {}, setTypeFilter() {}, setStatusFilter() {}, setUpcomingWeeks() {}, setFrom() {}, setTo() {} } };

test("opening a three-dot menu closes the previous one", () => {
  const menus = [{ open: true }, { open: true }, { open: false }];
  const ownerDocument = { querySelectorAll(selector) {
    assert.equal(selector, "details.activity-menu[open], details.course-menu[open]");
    return menus.filter(menu => menu.open);
  } };
  menus.forEach(menu => { menu.ownerDocument = ownerDocument; });
  closeOtherActionMenus(menus[1]);
  assert.deepEqual(menus.map(menu => menu.open), [false, true, false]);
  menus[2].open = true;
  closeOtherActionMenus(menus[2]);
  assert.deepEqual(menus.map(menu => menu.open), [false, false, true]);
});

test("task filters start collapsed without a task count", () => {
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, view: "board" }));
  assert.match(html, /class="filter-disclosure task-filter-disclosure"/);
  assert.match(html, /class="filter-toggle task-filter-toggle" aria-expanded="false" aria-controls="[^"]+"/);
  assert.doesNotMatch(html, /class="task-filter-count"/);
  assert.match(html, /class="filter-disclosure-content" hidden=""/);
  assert.match(html, /Curso.*Tipo de entrega.*Desde.*Hasta/);
  assert.match(html, /Fecha inicial/);
  assert.match(html, /Fecha final/);
  assert.match(html, /Limpiar filtros/);
});

test("selected task filters appear as removable labels beside the filter button", () => {
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, view: "board", filters: {
    ...props.filters, courseFilter: "course", typeFilter: "examen", statusFilter: "completed", from: "2026-10-14", to: "2026-10-21",
  } }));
  for (const label of ["Curso: Programación", "Tipo: Examen", "Desde: 14/10/2026", "Hasta: 21/10/2026"]) {
    assert.match(html, new RegExp(`aria-label="Quitar filtro ${label}"`));
  }
  assert.match(html, /class="active-filter-remove" aria-hidden="true">×<\/span>/);
});

test("task status filter shows pending or completed tasks in both views", () => {
  for (const [statusFilter, visible, hidden, heading] of [
    ["pending", "Tarea pendiente", "Tarea hecha", "Tareas pendientes"],
    ["completed", "Tarea hecha", "Tarea pendiente", "Tareas hechas"],
  ]) {
    for (const view of ["board", "list"]) {
      const html = renderToStaticMarkup(React.createElement(TasksPage, {
        ...props, view, filters: { ...props.filters, statusFilter },
      }));
      assert.match(html, new RegExp(`>${visible}<`));
      assert.doesNotMatch(html, new RegExp(`>${hidden}<`));
      if (view === "list") assert.match(html, new RegExp(`<h2 id="all-tasks-title">${heading}</h2>`));
    }
  }
});

test("status filtering treats overdue tasks as pending across views", () => {
  assert.equal(matchesActivityStatus("pending", "pending"), true);
  assert.equal(matchesActivityStatus("completed", "pending"), false);
  assert.equal(matchesActivityStatus("completed", "completed"), true);
  assert.equal(matchesActivityStatus("pending", "completed"), false);
  assert.equal(matchesActivityStatus("pending", ""), true);
  assert.equal(matchesActivityStatus("completed", ""), true);
});

test("the task board separates pending and completed activities and exposes the full list", () => {
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, view: "board" }));
  const sections = [...html.matchAll(/<section class="panel task-column"[^>]*>(.*?)<\/section>/g)].map(match => match[1]);
  assert.equal(sections.length, 2);
  assert.match(sections[0], /Pendientes.*Tarea pendiente/);
  assert.doesNotMatch(sections[0], /Tarea hecha/);
  assert.match(sections[1], /Hechas.*Tarea hecha/);
  assert.doesNotMatch(sections[1], /Tarea pendiente/);
  assert.doesNotMatch(html, /Ver todas las tareas/);
  assert.match(html, /Modificar Tarea pendiente/);
  assert.match(html, /Borrar Tarea hecha/);
  assert.match(html, /Ver detalles/);
  assert.match(html, /class="activity-details-dialog"/);
});

test("the full list shows both statuses and offers a return to the board", () => {
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, view: "list" }));
  assert.match(html, /Todas las tareas/);
  assert.match(html, /Tarea pendiente/);
  assert.match(html, /Tarea hecha/);
  assert.match(html, /Ver pendientes y hechas/);
  assert.doesNotMatch(html, /class="panel task-column"/);
});

test("completed activities show a status mark and busy activities cannot be changed", () => {
  const tree = ActivityList({ items, courses: [course], loaded: true, complete() {}, reopen() {}, busy: true });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /aria-label="Hecha: Tarea hecha"/);
  assert.match(html, /Volver a pendientes/);
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
  assert.equal((html.match(/<em>Vencida<\/em>/g) || []).length, 1);
  assert.match(html, /class="finished">Tarea hecha/);
});

test("year warning stays outside the description and dates use full month names", () => {
  const legacy = "Preparar el informe. El año no se especifica explícitamente en el texto, por lo que la fecha debe revisarse.";
  const html = renderToStaticMarkup(React.createElement(ActivityList, {
    items: [{ ...items[0], description: legacy, due_date: null }], courses: [course], loaded: true, complete() {},
  }));
  assert.match(html, /<p>Preparar el informe\.<\/p>/);
  assert.match(html, /class="activity-date-warning"/);
  assert.match(html, /role="tooltip">El año no se especifica en el texto\.<\/span>/);
  const shortWarning = renderToStaticMarkup(React.createElement(ActivityList, {
    items: [{ ...items[0], description: "Preparar el informe. El año no se especifica en el texto." }],
    courses: [course], loaded: true, complete() {},
  }));
  assert.match(shortWarning, /<p>Preparar el informe\.<\/p>/);
  assert.match(shortWarning, /role="tooltip">El año no se especifica en el texto\.<\/span>/);
  const flagged = renderToStaticMarkup(React.createElement(ActivityList, {
    items: [{ ...items[0], description: "Preparar el informe.", year_unconfirmed: true }],
    courses: [course], loaded: true, complete() {},
  }));
  assert.match(flagged, /role="tooltip">El año no se especifica en el texto\.<\/span>/);
  const dated = renderToStaticMarkup(React.createElement(ActivityList, {
    items: [{ ...items[0], due_date: "2026-11-10" }], courses: [course], loaded: true, complete() {},
  }));
  assert.match(dated, /10 de noviembre/);
});

test("alternative week dates appear only in the warning tooltip", () => {
  const reason = "Fechas alternativas entre semana A (20 octubre) y semana B (27 octubre).";
  const html = renderToStaticMarkup(React.createElement(ActivityList, {
    items: [{ ...items[0], description: `Presentar el proyecto. ${reason}` }],
    courses: [course], loaded: true, complete() {},
  }));
  assert.match(html, /<p>Presentar el proyecto\.<\/p>/);
  assert.match(html, /role="tooltip">Fechas alternativas entre semana A/);
  assert.equal((html.match(/Fechas alternativas entre semana A/g) || []).length, 2);
});

test("the date warning explains group alternatives and falls back when no reason is recorded", () => {
  const html = renderToStaticMarkup(React.createElement(ActivityList, {
    items: [
      { ...items[0], id: "group", description: "Presentar el proyecto. La fecha depende del grupo: grupo A el 10 y grupo B el 12." },
      { ...items[0], id: "unknown", description: "Entregar el informe." },
    ],
    courses: [course], loaded: true, complete() {},
  }));
  assert.match(html, /role="tooltip">La fecha depende del grupo: grupo A el 10 y grupo B el 12\.<\/span>/);
  assert.match(html, /role="tooltip">No hay una fecha confirmada para esta actividad\. Revisa sus datos\.<\/span>/);
});

test("an activity due today shows Hoy with the full date", () => {
  const today = localToday();
  const html = renderToStaticMarkup(React.createElement(ActivityList, {
    items: [{ ...items[0], due_date: today }], courses: [course], loaded: true, complete() {},
  }));
  const expected = new Date(`${today}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "long" });
  assert.match(html, new RegExp(`<div class="due"><span>Hoy, ${expected}<\\/span><\\/div>`));
});

test("a pending checkbox completes a task and the completed menu reopens it", () => {
  const calls = [];
  const tree = ActivityList({ items, courses: [course], loaded: true,
    complete: id => calls.push(["complete", id]), reopen: id => calls.push(["reopen", id]) });
  function find(node, predicate) {
    if (!node || typeof node !== "object") return [];
    return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => find(child, predicate))];
  }
  const checkboxes = find(tree, node => node.type?.name === "CompleteTaskCheck");
  assert.equal(checkboxes.length, 1);
  checkboxes[0].props.complete(checkboxes[0].props.activity.id);
  let closed = false;
  const reopenButton = find(tree, node => node.type === "button" && node.props.children === "Volver a pendientes")[0];
  reopenButton.props.onClick({ currentTarget: { closest: () => ({ removeAttribute: () => { closed = true; } }) } });
  assert.equal(closed, true);
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
  assert.match(html, /Estado.*<option value="pending">Pendientes<\/option><option value="completed">Hechas<\/option>/);
  assert.match(html, /class="filter-disclosure calendar-filter-disclosure"/);
  assert.match(html, /class="filter-toggle" aria-expanded="false" aria-controls="[^"]+"/);
  assert.match(html, /Filtrar resultados/);
  assert.match(html, /class="filter-disclosure-content" hidden=""/);
  assert.doesNotMatch(html, /class="filter-card/);
  assert.match(html, /↺ Limpiar filtros/);
});


const { PanelPage, upcomingActivities, upcomingWithinWeeks } = load("src/components/pages/PanelPage.tsx");

test("upcoming selection retains completed activities until their due date passes", () => {
  const candidate = (id, due_date, status) => ({ ...items[0], id, due_date, status });
  const activities = [
    candidate("done", "2026-10-14", "completed"),
    candidate("pending", "2026-10-13", "pending"),
    candidate("past", "2026-10-12", "completed"),
    candidate("undated", null, "pending"),
  ];
  assert.deepEqual(upcomingActivities(activities, "2026-10-13").map(item => item.id), ["pending", "done"]);
});

test("dashboard previews four pending deadlines without exposing descriptions", () => {
  const pending = Array.from({ length: 5 }, (_, i) => ({ ...items[0], id: `next-${i}`, title: `Next ${i}`, description: "Private full description", due_date: `2099-01-0${i+1}` })).reverse();
  const done = { ...items[1], title: "Already done", due_date: "2099-01-01" };
  const html = renderToStaticMarkup(React.createElement(PanelPage, { ...props, username: "Jordan", items: [...pending, done], onAnalyze() {}, onShowAll() {}, onOpenTask() {} }));
  assert.match(html, /Hola, Jordan/);
  assert.equal((html.match(/class="panel-task-preview"/g) || []).length, 4);
  assert.ok(html.indexOf("Next 0") < html.indexOf("Next 1"));
  assert.doesNotMatch(html, /Next 4|Already done|Private full description/);
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="17"/);
});

test("dashboard totals include completed, overdue and undated tasks", () => {
  const activities = [items[0], items[1], { ...items[0], id: "late", due_date: "2000-01-01" }];
  const html = renderToStaticMarkup(React.createElement(PanelPage, { ...props, username: "Jordan", items: activities, onAnalyze() {}, onShowAll() {}, onOpenTask() {} }));
  assert.match(html, /Total de tareas<\/dt><dd>3/);
  assert.match(html, /Pendientes<\/dt><dd>2/);
  assert.match(html, /Completadas<\/dt><dd>1/);
  assert.match(html, /Vencidas<\/dt><dd>1/);
  assert.match(html, /aria-valuenow="33"/);
});

test("empty dashboard has zero progress and a clear upcoming state", () => {
  const html = renderToStaticMarkup(React.createElement(PanelPage, { ...props, username: "Jordan", items: [], onAnalyze() {}, onShowAll() {}, onOpenTask() {} }));
  assert.match(html, /aria-valuenow="0"/);
  assert.match(html, /panel-agenda-empty/);
  assert.doesNotMatch(html, /NaN/);
});

test("upcoming deadline includes the last day and can be extended or removed", () => {
  const activities = [-1, 0, 6, 7, 8, 13, 14, 15].map(days => ({ ...items[0], id: String(days),
    due_date: new Date(Date.UTC(2026, 9, 12 + days)).toISOString().slice(0, 10) }));
  assert.deepEqual(upcomingWithinWeeks(activities, 1, "2026-10-12").map(item => item.id), ["0", "6", "7"]);
  assert.deepEqual(upcomingWithinWeeks(activities, 2, "2026-10-12").map(item => item.id), ["0", "6", "7", "8", "13", "14"]);
  assert.deepEqual(upcomingWithinWeeks(activities, null, "2026-10-12").map(item => item.id), ["0", "6", "7", "8", "13", "14", "15"]);
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
  const { clearSelectedFile } = load("src/components/pages/AnalyzePage.tsx");
  let selected = "programa.pdf", focused = false, prevented = false, stopped = false;
  const input = { value: "selected-file", focus() { focused = true; } };
  clearSelectedFile({ preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } }, input, value => { selected = value; });
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

test("uncertain year is prominent in the document review", () => {
  const { AnalyzePage } = load("src/components/pages/AnalyzePage.tsx");
  const props = { pendingReviews: [], savedDocuments: [], reviewFileName: "programa.pdf", courses: [],
    activeCourses: [], uploadCourse: "", uploadFormRef: { current: null }, reviewRef: { current: null },
    selectedFileName: "", busy: false, docId: "documento", reviewError: "", onEdit() {}, onConfirm() {},
    proposals: [{ title: "Entrega", description: "", due_date: null, review_required: true, year_unconfirmed: true }] };
  const html = renderToStaticMarkup(React.createElement(AnalyzePage, props));
  assert.match(html, /Hay actividades con el año sin confirmar/);
  assert.match(html, /Año sin confirmar/);
  assert.match(html, /role="alert"/);
});

test("dropping a supported document selects it for the upload form", () => {
  const { assignDroppedFile } = load("src/components/pages/AnalyzePage.tsx");
  const input = { files: null };
  const files = [{ name: "programa.DOCX" }];
  assert.equal(assignDroppedFile(files, input), "programa.DOCX");
  assert.equal(input.files, files);
  assert.throws(() => assignDroppedFile([{ name: "archivo.exe" }], input), /PDF, DOCX o TXT/);
  assert.throws(() => assignDroppedFile([files[0], files[0]], input), /un solo archivo/);
  assert.equal(input.files, files);
});


test("completion draws a check before committing and ignores repeated clicks", async () => {
  const exports = {}, timers = [], calls = [];
  const file = path.resolve("src/components/ActivityParts.tsx");
  let checking = false;
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports,
    window: { matchMedia: () => ({ matches: false }), setTimeout: (callback, delay) => { assert.equal(delay, 180); timers.push(callback); } },
    require: id => {
      if (id === "react") return { ...React, useState: () => [false, value => { checking = value; }], useRef: value => ({ current: value }) };
      if (!id.startsWith(".")) return require(id);
      const target = path.resolve(path.dirname(file), id);
      return load(fs.existsSync(target + ".tsx") ? target + ".tsx" : target + ".ts");
    }
  });
  const tree = exports.ActivityList({ items: [items[0]], courses: [course], loaded: true, complete: id => calls.push(id) });
  const article = tree.props.children[0];
  const control = article.props.children[0];
  const label = control.type(control.props);
  const input = label.props.children[0];
  input.props.onChange();
  input.props.onChange();
  assert.equal(checking, true);
  assert.equal(timers.length, 1);
  assert.equal(calls.length, 0);
  timers[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [items[0].id]);
  assert.equal(checking, false);
});


test("task board limits pending and completed columns to ten independently", () => {
  const activities = Array.from({ length: 25 }, (_, index) => ({ ...items[0], id: `pending-${index}`, title: `Pending ${index}`, due_date: `2099-01-${String(index+1).padStart(2,'0')}` }));
  const completed = activities.map(item => ({ ...item, id: `done-${item.id}`, status: "completed" }));
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, items: [...activities, ...completed], view: "board" }));
  assert.equal((html.match(/<article /g) || []).length, 20);
  assert.equal((html.match(/1\u201310 de 25/g) || []).length, 2);
  assert.equal((html.match(/1 \/ 3/g) || []).length, 2);
  assert.doesNotMatch(html, /id="activity-pending-10"/);
});

test("opening a task from the panel selects its page in the full list", () => {
  const activities = Array.from({ length: 25 }, (_, index) => ({ ...items[0], id: `paged-${index}`, due_date: `2099-01-${String(index+1).padStart(2,'0')}` }));
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, items: activities, view: "list", focusedTaskId: "paged-24" }));
  assert.equal((html.match(/<article /g) || []).length, 5);
  assert.match(html, /id="activity-paged-24"/);
  assert.match(html, /21\u201325 de 25/);
  assert.match(html, /3 \/ 3/);
});


test("task ordering handles dates, titles and courses without mutating the source", () => {
  const { orderTasks } = load("src/lib/activityOrder.ts");
  const rows = [
    { ...items[0], id: "z", title: "Zeta", due_date: "2099-01-01", course_id: "a" },
    { ...items[0], id: "a", title: "Alfa", due_date: "2099-01-03", course_id: "b" },
    { ...items[0], id: "m", title: "Medio", due_date: null, course_id: "a" },
  ];
  const courses = [{ id: "a", name: "Zoologia" }, { id: "b", name: "Algebra" }];
  const ids = order => Array.from(orderTasks(rows, order, courses), row => row.id);
  assert.deepEqual(ids("date-asc"), ["z", "a", "m"]);
  assert.deepEqual(ids("date-desc"), ["a", "z", "m"]);
  assert.deepEqual(ids("title-asc"), ["a", "m", "z"]);
  assert.deepEqual(ids("title-desc"), ["z", "m", "a"]);
  assert.deepEqual(ids("course"), ["a", "z", "m"]);
  assert.deepEqual(rows.map(row => row.id), ["z", "a", "m"]);
  const sorted = orderTasks(rows, "title-asc", courses);
  const html = renderToStaticMarkup(React.createElement(ActivityList, { items: sorted, preserveOrder: true, courses, loaded: true, complete() {} }));
  assert(html.indexOf('id="activity-a"') < html.indexOf('id="activity-m"'));
  assert(html.indexOf('id="activity-m"') < html.indexOf('id="activity-z"'));
});


test("Mis tareas filters omit the status selector", () => {
  const html = renderToStaticMarkup(React.createElement(TasksPage, { ...props, items: [], view: "board" }));
  assert.doesNotMatch(html, /<label>Estado<select/);
  assert.match(html, /<label>Curso<select/);
  assert.match(html, /<label>Tipo de entrega<select/);
});


test("pending deadlines prioritize upcoming work before overdue and undated tasks", () => {
  const { orderPendingTasks } = load("src/lib/activityOrder.ts");
  const rows = [
    { title: "Undated", due_date: null }, { title: "Old", due_date: "2026-01-01" },
    { title: "Later", due_date: "2026-11-20" }, { title: "Today", due_date: "2026-11-01" },
    { title: "Yesterday", due_date: "2026-10-31" },
  ];
  assert.deepEqual(Array.from(orderPendingTasks(rows, "2026-11-01"), row => row.title), ["Today", "Later", "Yesterday", "Old", "Undated"]);
});


test("every active course offers deactivation, including empty and guest courses", () => {
  const { CoursesPage } = load("src/components/pages/CoursesPage.tsx");
  for (const guest of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(CoursesPage, { guest, courses: [course], items: [], loaded: true, busy: false, editingCourse: null, confirmDeactivateId: "", newCourse: "", newCourseCode: "", newCourseTerm: "", error: "" }));
    assert.match(html, />Desactivar<\/button>/);
  }
  const html = renderToStaticMarkup(React.createElement(CoursesPage, { courses: [{ ...course, is_active: false }], items: [], loaded: true, busy: false, editingCourse: null, confirmDeactivateId: "", newCourse: "", newCourseCode: "", newCourseTerm: "", error: "" }));
  assert.match(html, />Reactivar<\/button>/);
  assert.doesNotMatch(html, />Desactivar<\/button>/);
});
