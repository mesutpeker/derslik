/* Run: node tests/test_app.cjs. Reference was independently decoded by pypdf. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'okul_verisi.json'), 'utf8'));
const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'pdf-reference.json'), 'utf8'));
const core = require('../app-core.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const teacherIds = new Map(data.teachers.map(t => [t.name, t.id]));
const teacherNames = new Map(data.teachers.map(t => [t.id, t.name]));
const tuple = l => JSON.stringify([l.d, l.p, l.c, l.l, l.r]);
const goldTuple = a => JSON.stringify([a.day, a.period, a.className, a.course, a.room]);
const filterKey = f => JSON.stringify([f.day, f.period, f.className, f.teacher]);
const expected = new Map();
const report = {passed: false, source_sha256: data.source.sha256, checks: {}};
assert.equal(data.source.sha256, gold.source_sha256);

// Build query expectations from each independent PDF cell's 16 possible scopes.
for (const a of gold.cells) {
  for (const day of ['ALL', a.day]) for (const period of ['ALL', String(a.period)])
    for (const className of ['ALL', a.className]) for (const teacher of ['ALL', teacherIds.get(a.teacher)]) {
      const key = filterKey({day, period, className, teacher});
      if (!expected.has(key)) expected.set(key, new Set());
      expected.get(key).add(goldTuple(a));
    }
}
let filterChecks = 0;
for (const day of ['ALL', ...data.days]) for (const period of ['ALL', ...Array.from({length: 10}, (_, i) => String(i + 1))])
  for (const className of ['ALL', ...data.classes]) for (const teacher of ['ALL', ...data.teachers.map(t => t.id)]) {
    const filters = {day, period, className, teacher};
    const actual = new Set(core.filterLessons(data, filters).map(tuple));
    const reference = expected.get(filterKey(filters)) || new Set();
    assert.deepEqual(actual, reference, `Filter differs: ${JSON.stringify(filters)}`);
    filterChecks++;
  }
report.checks.exhaustive_filter_combinations = filterChecks;

// Every shared lesson must retain the exact complete teacher set.
const goldGroups = new Map();
for (const a of gold.cells) {
  if (!goldGroups.has(goldTuple(a))) goldGroups.set(goldTuple(a), new Set());
  goldGroups.get(goldTuple(a)).add(a.teacher);
}
for (const lesson of data.lessons) {
  assert.deepEqual(new Set(lesson.teacher_ids.map(id => teacherNames.get(id))), goldGroups.get(tuple(lesson)));
}
assert.equal(data.lessons.length, 1264);
assert.equal(data.assignments.length, 1347);
assert.equal(data.classes.length, 45);
assert.equal(data.teachers.length, 72);
assert.equal(data.course_catalog.length, 181);
assert.equal(data.lessons.filter(l => l.teacher_ids.length === 2).length, 83);
assert.equal(data.assignments.filter(a => a.c.includes('MSM')).length, 87);
assert.equal(data.assignments.filter(a => !a.r).length, 2);
assert.equal(data.teachers.find(t => t.name === 'MEHMET KORKMAZ').total_hours, 0);
report.checks.lesson_teacher_sets = data.lessons.length;
report.checks.data_regressions = 9;

// One entire week, minute by minute, against PDF bell times.
let minuteChecks = 0;
for (let dayIndex = 0; dayIndex < 7; dayIndex++) for (let minute = 0; minute < 1440; minute++) {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0');
  const min = String(minute % 60).padStart(2, '0');
  const now = new Date(`2026-10-${26 + dayIndex}T${hour}:${min}:00+03:00`.replace('2026-10-32', '2026-11-01'));
  const selected = core.currentSelection(data, now);
  if (dayIndex >= 5) {
    assert.equal(selected.kind, 'weekend'); assert.equal(selected.day, 'ALL'); assert.equal(selected.period, 'ALL');
  } else {
    const day = data.days[dayIndex];
    const convert = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const slots = gold.times[day];
    const active = slots.find(s => minute >= convert(s.start) && minute < convert(s.end));
    const next = slots.find(s => minute < convert(s.start));
    assert.equal(selected.day, day);
    if (active) {assert.equal(selected.kind, 'lesson'); assert.equal(selected.period, String(active.period));}
    else if (next) {assert.equal(selected.kind, next.period === 1 ? 'before' : 'break'); assert.equal(selected.period, String(next.period));}
    else {assert.equal(selected.kind, 'after'); assert.equal(selected.period, 'ALL');}
  }
  minuteChecks++;
}
report.checks.clock_minutes = minuteChecks;
const boundaryTimes = ['08:19:59', '08:20:00', '08:59:59', '09:00:00', '09:09:59', '09:10:00', '17:04:59', '17:05:00'];
const kinds = ['before', 'lesson', 'lesson', 'break', 'break', 'lesson', 'lesson', 'after'];
boundaryTimes.forEach((time, i) => assert.equal(core.currentSelection(data, new Date(`2026-10-26T${time}+03:00`)).kind, kinds[i]));
assert.equal(core.currentSelection(data, new Date('2026-10-30T10:35:00Z')).period, '6');
report.checks.clock_second_boundaries_and_timezone = boundaryTimes.length + 1;

// Actual generated HTML, CSS, embedded data and embedded scripts.
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 3);
assert.deepEqual(JSON.parse(scripts[0][2]), data);
assert.equal(scripts[1][2], fs.readFileSync(path.join(root, 'app-core.js'), 'utf8'));
assert.equal(scripts[2][2], fs.readFileSync(path.join(root, 'app-ui.js'), 'utf8'));
assert.equal(/<(script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html), false);
assert.equal(/@import|url\(\s*["']?https?:/i.test(html), false);
assert(html.includes('[hidden]{display:none!important}'));
assert.equal(html.includes('classes_list'), false);
assert.equal(html.includes('AHÂªAP'), false);
report.checks.offline_build_and_embedded_integrity = 8;

// Minimal DOM executes the unmodified generated UI, including event handlers.
class Node {
  constructor(id) {this.id = id; this.children = []; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.dataset = {}; this.listeners = {}; this.currentValue = '';}
  get value() {return this.currentValue;}
  set value(value) {this.currentValue = String(value);}
  appendChild(child) {this.children.push(child); if (this.children.length === 1) this.value = child.value; return child;}
  replaceChildren(...children) {this.children = []; children.forEach(child => this.appendChild(child));}
  addEventListener(type, handler) {this.listeners[type] = handler;}
}
const nodes = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Node(m[1])]));
nodes['school-data'].textContent = scripts[0][2];
const document = {getElementById: id => {assert(nodes[id], `Missing DOM node: ${id}`); return nodes[id];}, createElement: () => new Node()};
const context = vm.createContext({document, Intl, Date});
vm.runInContext(scripts[1][2] + '\n' + scripts[2][2], context);
assert.equal(nodes['filter-class'].children.length, 46);
assert.equal(nodes['filter-teacher'].children.length, 73);
const set = (id, value) => {nodes[id].value = value; nodes[id].listeners.change();};
const renderedIds = () => [...nodes['results-container'].innerHTML.matchAll(/data-lesson-id="([^"]+)"/g)].map(m => m[1]);
let uiChecks = 0;
function verifyUI() {
  const f = {day: nodes['filter-day'].value, period: nodes['filter-period'].value, className: nodes['filter-class'].value, teacher: nodes['filter-teacher'].value};
  const reference = expected.get(filterKey(f)) || new Set();
  const actual = renderedIds().map(id => tuple(data.lessons.find(l => l.id === id)));
  assert.deepEqual(new Set(actual), reference);
  assert.equal(nodes['empty-state'].hidden, actual.length > 0);
  assert(nodes['result-count'].textContent.startsWith(`${actual.length} ders`));
  uiChecks++;
}
for (const day of ['ALL', ...data.days]) {
  set('filter-day', day);
  for (const period of ['ALL', ...Array.from({length: 10}, (_, i) => String(i + 1))]) {
    set('filter-period', period);
    for (const c of ['ALL', ...data.classes]) {set('filter-class', c); verifyUI();}
  }
}
set('filter-class', 'ALL');
for (const teacher of data.teachers) {
  set('filter-teacher', teacher.id);
  for (const day of ['ALL', ...data.days]) {
    set('filter-day', day);
    for (const period of ['ALL', ...Array.from({length: 10}, (_, i) => String(i + 1))]) {set('filter-period', period); verifyUI();}
  }
}
report.checks.actual_embedded_ui_combinations = uiChecks;

set('filter-teacher', 'ALL'); set('filter-day', 'Perşembe'); set('filter-period', '4'); set('filter-class', '11-B');
assert(nodes['results-container'].innerHTML.includes('NEBİ SARI'));
assert(nodes['results-container'].innerHTML.includes('YASİN ŞAVLI'));
assert(nodes['results-container'].innerHTML.includes('Ortak ders'));
set('filter-class', '12MSMC'); set('filter-day', 'Salı'); set('filter-period', '1');
assert(nodes['results-container'].innerHTML.includes('NESİBE GÜZİDE ÜNAL'));
set('filter-class', '9-C');
assert(nodes['results-container'].innerHTML.includes('BURAK KAÇAR'));
assert(!nodes['results-container'].innerHTML.includes('AYŞE GİRGİN'));
set('filter-class', '10-E'); set('filter-period', '5');
assert(nodes['results-container'].innerHTML.includes('Derslik PDF’de belirtilmemiş'));
nodes['reset-button'].listeners.click(); verifyUI();
assert.equal(renderedIds().length, 1264);
set('filter-teacher', teacherIds.get('MEHMET KORKMAZ')); verifyUI();
assert(nodes['empty-description'].textContent.includes('satırı boş'));
nodes['now-button'].listeners.click();
assert.equal(nodes['filter-teacher'].value, teacherIds.get('MEHMET KORKMAZ'));
report.checks.ui_regressions = 13;
assert.equal(core.escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
report.passed = true;
fs.writeFileSync(path.join(__dirname, 'app-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
