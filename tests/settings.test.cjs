const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');

test('language selection persists, translates screens and dates, and preserves user content', () => {
  const cache = new Map(), storage = new Map();
  const document = { documentElement: { lang: 'es' } };
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(code, { exports, document,
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      require: id => {
        if (!id.startsWith('.')) return require(id);
        const target = path.resolve(path.dirname(file), id);
        return load(fs.existsSync(target + '.tsx') ? target + '.tsx' : target + '.ts');
      },
    });
    return exports;
  }
  const language = load('src/lib/language.ts');
  const { TasksPage } = load('src/components/pages/TasksPage.tsx');
  const { CalendarPage } = load('src/components/pages/CalendarPage.tsx');
  const { UserPreferencesMenu } = load('src/components/UserPreferencesMenu.tsx');
  const courses = [{ id: 'course', name: 'Matemática', is_active: true }];
  const items = [{ id: 'task', title: 'Entregar informe', description: '', course_id: 'course', activity_type: 'tarea', status: 'pending', due_date: null }];
  const props = { courses, items, loaded: true, busy: false, complete() {}, reopen() {}, onChangeView() {},
    filters: { courses, courseFilter: '', typeFilter: '', statusFilter: '', from: '', to: '' } };
  language.setLanguage('en');
  assert.equal(storage.get('tarevia-language'), 'en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(language.locale(), 'en-US');
  const tasks = renderToStaticMarkup(React.createElement(TasksPage, props));
  assert.match(tasks, /My tasks/);
  assert.match(tasks, /Add task/);
  assert.match(tasks, /Entregar informe/);
  assert.match(tasks, /Matemática/);
  const calendar = renderToStaticMarkup(React.createElement(CalendarPage, props));
  assert.match(calendar, /Calendar/);
  assert.match(calendar, />Mon</);
  const settings = renderToStaticMarkup(React.createElement(UserPreferencesMenu, { username: 'Usuario' }));
  assert.match(settings, /aria-label="Settings"/);
  assert.match(settings, /profile-summary/);
  assert.doesNotMatch(settings, /user-preferences-trigger/);
  language.setLanguage('es');
  assert.equal(storage.get('tarevia-language'), 'es');
  assert.match(renderToStaticMarkup(React.createElement(TasksPage, props)), /Mis tareas/);
});
