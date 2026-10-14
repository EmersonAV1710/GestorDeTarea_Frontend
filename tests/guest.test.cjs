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
  }, crypto: globalThis.crypto });
  return result;
}

const guest = load("src/lib/guestData.ts");
const { accessPermissions } = load("src/lib/access.ts");
const { AuthPage } = load("src/components/pages/AuthPage.tsx");
const { AuthRequiredDialog } = load("src/components/AuthRequiredDialog.tsx");
const proposal = { title: "Entrega final", description: "Resumen", activity_type: "tarea", due_date: "2026-11-20", status: "pending", review_required: false };
function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test("guest courses and tasks persist, update, complete and delete locally", () => {
  const browser = storage();
  guest.setGuestMode(browser, true);
  let data = guest.addGuestCourse(guest.emptyGuestData(), "Matemática", "MAT101", "II-2026");
  const courseId = data.courses[0].id;
  data = guest.createGuestActivity(data, courseId, proposal);
  const activityId = data.activities[0].id;
  guest.saveGuestData(browser, data);
  assert.equal(guest.isGuestMode(browser), true);
  data = guest.readGuestData(browser);
  assert.equal(data.activities[0].due_date, "2026-11-20");
  data = guest.updateGuestActivity(data, activityId, { ...proposal, title: "Entrega corregida" });
  data = guest.changeGuestActivityStatus(data, activityId, "completed");
  assert.equal(data.activities[0].title, "Entrega corregida");
  assert.equal(data.activities[0].status, "completed");
  data = guest.updateGuestCourse(data, { ...data.courses[0], name: "Álgebra" });
  assert.equal(data.courses[0].name, "Álgebra");
  guest.saveGuestData(browser, data);
  guest.setGuestMode(browser, false);
  assert.equal(guest.isGuestMode(browser), false);
  assert.equal(guest.readGuestData(browser).activities.length, 1);
  data = guest.deleteGuestActivity(data, activityId);
  data = guest.deleteGuestCourse(data, courseId);
  assert.equal(data.courses.length, 0);
  assert.equal(data.activities.length, 0);
});

test("invalid or unavailable guest storage is never overwritten", () => {
  const browser = storage();
  browser.setItem("tarevia_guest_data_v1", "{broken");
  assert.throws(() => guest.readGuestData(browser), /dañados/);
  assert.equal(browser.getItem("tarevia_guest_data_v1"), "{broken");
  const denied = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } };
  assert.throws(() => guest.readGuestData(denied), /almacenamiento local/);
  assert.throws(() => guest.saveGuestData(denied, guest.emptyGuestData()), /almacenamiento local/);
});

test("access policy separates guest local work from private APIs", () => {
  assert.equal(accessPermissions("guest").localData, true);
  assert.equal(accessPermissions("guest").panelActions, true);
  assert.equal(accessPermissions("guest").privateApi, false);
  assert.equal(accessPermissions("guest").documentAnalysis, false);
  assert.equal(accessPermissions("authenticated").privateApi, true);
  assert.equal(accessPermissions("signedOut").application, false);
});

test("login entry and restricted action dialog expose the intended choices", () => {
  const auth = renderToStaticMarkup(React.createElement(AuthPage, {
    authMode: "login", email: "", setEmail() {}, username: "", setUsername() {}, password: "", setPassword() {},
    passwordConfirmation: "", setPasswordConfirmation() {}, busy: false, authError: "", authErrorId: 0,
    notice: "", noticeId: 0, onLogin() {}, onRegister() {}, onToggleMode() {}, onContinueAsGuest() {},
    onClearAuthError() {}, onClearNotice() {},
  }));
  assert.match(auth, /Continuar sin iniciar sesión/);
  const dialog = renderToStaticMarkup(React.createElement(AuthRequiredDialog, {
    open: false, onClose() {}, onLogin() {}, onRegister() {},
  }));
  assert.match(dialog, /Inicia sesión para continuar/);
  assert.match(dialog, /Ahora no/);
  assert.match(dialog, /Crear cuenta/);
  assert.match(dialog, /Iniciar sesión/);
});
