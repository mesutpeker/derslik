/* Grade filtering with separate branch cards; source PDF assignments stay intact. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = JSON.parse($('school-data').textContent);
  const core = DerslikCore;
  const view = core.classView(data);
  const esc = core.escapeHtml;
  const teachers = new Map(data.teachers.map(t => [t.id, t]));
  const assignments = new Map(data.assignments.map(a => [a.id, a]));

  function option(value, text) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = text;
    return element;
  }

  function populate() {
    $('school-stats').textContent = `${data.teachers.length} öğretmen · ${view.classes.length} sınıf · ${data.lessons.length.toLocaleString('tr-TR')} ders`;
    $('source-info').textContent = `${data.source.filename} · ${data.source.pages} sayfa`;
    $('filter-day').appendChild(option('ALL', 'Tüm günler'));
    data.days.forEach(day => $('filter-day').appendChild(option(day, day)));
    $('filter-class').appendChild(option('ALL', 'Tüm sınıf düzeyleri'));
    view.grades.forEach(grade => $('filter-class').appendChild(option(grade, `${grade}. sınıf`)));
    $('filter-teacher').appendChild(option('ALL', 'Tüm öğretmenler'));
    [...data.teachers].sort((a, b) => a.name.localeCompare(b.name, 'tr')).forEach(t => {
      $('filter-teacher').appendChild(option(t.id, t.name));
    });
  }

  function updatePeriods(selected = $('filter-period').value || 'ALL') {
    const day = $('filter-day').value;
    $('filter-period').replaceChildren(option('ALL', 'Tüm ders saatleri'));
    for (let p = 1; p <= 10; p++) {
      $('filter-period').appendChild(option(String(p), core.periodLabel(data, day, String(p))));
    }
    $('filter-period').value = selected;
  }

  function readFilters() {
    return {day: $('filter-day').value, period: $('filter-period').value,
      grade: $('filter-class').value, teacher: $('filter-teacher').value};
  }

  function renderCard(lesson) {
    const shared = lesson.teacher_ids.length > 1;
    const teacherRows = lesson.assignment_ids.map(id => {
      const assignment = assignments.get(id);
      const teacher = teachers.get(assignment.teacher_id);
      return `<li><span class="teacher-name">${esc(teacher.name)}</span><span class="source-tag">PDF s.${assignment.source.page} · satır ${assignment.source.row}</span></li>`;
    }).join('');
    return `<article class="lesson-card" data-lesson-id="${esc(lesson.id)}">
      <div class="card-top"><span class="class-badge">${esc(lesson.c)}</span><span class="card-day">${esc(lesson.d)} · ${lesson.p}. ders</span><span class="card-time">${esc(core.timeRange(data, lesson))}</span></div>
      <div class="card-body"><div><p class="eyebrow">DERS KODU</p><h2>${esc(lesson.l)}</h2></div><div class="room ${lesson.r ? '' : 'room-unknown'}">${lesson.r ? `Derslik: ${esc(lesson.r)}` : 'Derslik PDF’de belirtilmemiş'}</div></div>
      ${lesson.culture_classes.length ? `<p class="branch-note">Ortak kültür dersi · ${esc(lesson.culture_classes.join(' / '))}</p>` : lesson.group_label ? `<p class="branch-note">${esc(lesson.group_label)}</p>` : ''}
      <div class="teachers"><p class="teacher-label">${shared ? 'Birlikte derse giren öğretmenler' : 'Ders öğretmeni'}${shared ? '<span class="shared-badge">Ortak ders</span>' : ''}</p><ul>${teacherRows}</ul></div>
    </article>`;
  }

  function render() {
    const filters = readFilters();
    const list = core.filterLessons(data, filters);
    const day = filters.day === 'ALL' ? 'Tüm günler' : filters.day;
    const period = filters.period === 'ALL' ? 'Tüm saatler' : `${filters.period}. ders`;
    const className = filters.grade === 'ALL' ? 'Tüm sınıf düzeyleri' : `${filters.grade}. sınıf`;
    const teacher = filters.teacher === 'ALL' ? null : teachers.get(filters.teacher);
    $('filter-summary').textContent = `${day} · ${period} · ${className}${teacher ? ' · ' + teacher.name : ''}`;
    const distinctLessons = new Set(list.map(item => item.source_lesson_id));
    $('result-count').textContent = `${list.length} sınıf kaydı · ${distinctLessons.size} ders`;
    $('results-container').innerHTML = list.map(renderCard).join('');
    $('empty-state').hidden = list.length > 0;
    $('empty-description').textContent = teacher && teacher.total_hours === 0
      ? `${teacher.name} için kaynak PDF’deki öğretmen satırı boş. Ders ataması eklenmedi.`
      : 'Seçilen gün, saat, sınıf düzeyi ve öğretmen için ders kaydı bulunmuyor.';
    $('teacher-info').hidden = !teacher;
    if (teacher) $('teacher-info').textContent = `${teacher.name}: haftalık ${teacher.total_hours} ders saati. Ortak kültür derslerinin sınıf kartları aynı ders saatini paylaşır.`;
  }

  function selectCurrent() {
    const selection = core.currentSelection(data);
    $('filter-day').value = selection.day;
    updatePeriods(selection.period);
    $('current-status').textContent = selection.message;
    $('current-status').dataset.kind = selection.kind;
    render();
  }

  populate();
  ['filter-day', 'filter-period', 'filter-class', 'filter-teacher'].forEach(id => {
    $(id).addEventListener('change', () => {
      if (id === 'filter-day') updatePeriods();
      $('current-status').textContent = 'Seçilen haftalık ders programı gösteriliyor.';
      $('current-status').dataset.kind = 'manual';
      render();
    });
  });
  $('now-button').addEventListener('click', selectCurrent);
  $('reset-button').addEventListener('click', () => {
    $('filter-day').value = 'ALL';
    $('filter-class').value = 'ALL';
    $('filter-teacher').value = 'ALL';
    updatePeriods('ALL');
    $('current-status').textContent = 'Haftalık ders programının tamamı gösteriliyor.';
    $('current-status').dataset.kind = 'manual';
    render();
  });
  selectCurrent();
})();
