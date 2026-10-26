/* Grade filtering with separate branch cards; source PDF assignments stay intact. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = JSON.parse($('school-data').textContent);
  const core = DerslikCore;
  const view = core.classView(data);
  const esc = core.escapeHtml;
  const teachers = new Map(data.teachers.map(t => [t.id, t]));

  function option(value, text) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = text;
    return element;
  }

  function populate() {
    $('filter-day').appendChild(option('ALL', 'Tüm günler'));
    data.days.forEach(day => $('filter-day').appendChild(option(day, day)));
    $('filter-class').appendChild(option('ALL', 'Tüm sınıflar'));
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
    const teacherRows = lesson.teacher_ids.map(id => {
      const teacher = teachers.get(id);
      return `<li><span class="teacher-name">${esc(teacher.name)}</span></li>`;
    }).join('');
    return `<article class="lesson-card" data-lesson-id="${esc(lesson.id)}">
      <div class="card-top"><span class="class-badge">${esc(lesson.c)}</span><div class="room ${lesson.r ? '' : 'room-unknown'}"${lesson.r ? '' : ' aria-label="Derslik belirtilmemiş"'}><span class="room-label">Derslik</span><strong class="room-value">${lesson.r ? esc(lesson.r) : '—'}</strong></div></div>
      <div class="teachers"><ul>${teacherRows}</ul></div>
      <div class="lesson-details"><span class="card-day">${esc(lesson.d)} · ${lesson.p}. ders</span><span class="card-time">${esc(core.timeRange(data, lesson))}</span><h2 class="lesson-code">${esc(lesson.l)}</h2></div>
    </article>`;
  }

  function render() {
    const filters = readFilters();
    const list = core.filterLessons(data, filters);
    const day = filters.day === 'ALL' ? 'Tüm günler' : filters.day;
    const period = filters.period === 'ALL' ? 'Tüm saatler' : `${filters.period}. ders`;
    const className = filters.grade === 'ALL' ? 'Tüm sınıflar' : `${filters.grade}. sınıf`;
    const teacher = filters.teacher === 'ALL' ? null : teachers.get(filters.teacher);
    $('filter-summary').textContent = `${day} · ${period} · ${className}`;
    $('result-count').textContent = `${list.length} sonuç`;
    $('results-container').innerHTML = list.map(renderCard).join('');
    $('empty-state').hidden = list.length > 0;
    $('empty-description').textContent = teacher && teacher.total_hours === 0
      ? 'Bu öğretmen için ders kaydı yok.'
      : 'Bu seçimde ders kaydı yok.';
  }

  function selectCurrent() {
    const selection = core.currentSelection(data);
    $('filter-day').value = selection.day;
    updatePeriods(selection.period);
    const messages = {before: 'Dersler henüz başlamadı.',
      break: 'Ders arası · sıradaki ders gösteriliyor.',
      after: 'Dersler bitti · günün tamamı gösteriliyor.',
      weekend: 'Hafta sonu · tüm hafta gösteriliyor.'};
    $('current-status').textContent = messages[selection.kind] || '';
    $('current-status').hidden = selection.kind === 'lesson';
    $('current-status').dataset.kind = selection.kind;
    render();
  }

  populate();
  ['filter-day', 'filter-period', 'filter-class', 'filter-teacher'].forEach(id => {
    $(id).addEventListener('change', () => {
      if (id === 'filter-day') updatePeriods();
      $('current-status').hidden = true;
      $('current-status').textContent = '';
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
    $('current-status').hidden = true;
    $('current-status').textContent = '';
    $('current-status').dataset.kind = 'manual';
    render();
  });
  selectCurrent();
})();
