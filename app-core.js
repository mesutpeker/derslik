/* Pure schedule operations. Browser and Node tests execute this same source. */
const DerslikCore = (() => {
  const ALL = 'ALL';
  const weekdays = {Mon: 'Pazartesi', Tue: 'Salı', Wed: 'Çarşamba', Thu: 'Perşembe', Fri: 'Cuma'};
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

  // Restore the school's former branch relationships without changing PDF cells.
  // Culture courses are shared; vocational courses remain with their own branch.
  const cultureCourses = {
    '10': new Set(['BED10', 'BİY10', 'COĞ10', 'DİN10', 'FEL10', 'FİZ10', 'KİM10', 'MAT10', 'REHB', 'SAK', 'SDE', 'STDB', 'TAR10', 'TED10', 'İNG10']),
    '11': new Set(['BED11', 'DİN11', 'FELS11', 'REHB', 'SAĞB 9', 'SOTT11', 'STDB', 'TAR11', 'TED11', 'İKM11', 'İNG11']),
    '12': new Set(['DİN12', 'SBYY12', 'SKAM', 'TED12', 'İNG12', 'İNKT12'])
  };
  const culturePartners = {'10-A': '10-D', '10-B': '10-G', '11-C': '11-D',
    '11-B': '11-G', '12-A': '12-E', '12-B': '12-G', '12-C': '12-D'};
  const workshopBranches = {
    '10A-D': ['10-D', 'Motor atölye grubu'], '10B-G': ['10-G', 'Gıda atölye grubu'],
    '11B-G': ['11-G', 'Gıda atölye grubu'], '11C-D': ['11-D', 'Motor atölye grubu'],
    '12A-E': ['12-E', 'Elektrik atölye grubu'], '12B-G': ['12-G', 'Gıda atölye grubu'],
    '12C-D': ['12-D', 'Motor atölye grubu'],
    '9C-İ': ['9-C', 'Tesisat grubu'], '10C-İ': ['10-C', 'Tesisat grubu'],
    '11C-İ': ['11-C', 'Tesisat grubu'], '12C-İ': ['12-C', 'Tesisat grubu']
  };
  const views = new WeakMap();
  const gradeOf = className => String(parseInt(className, 10));

  function classView(data) {
    if (views.has(data)) return views.get(data);
    const lessons = data.lessons.flatMap(source => {
      const workshop = workshopBranches[source.c];
      const partner = culturePartners[source.c];
      const common = partner && cultureCourses[gradeOf(source.c)].has(source.l);
      const classes = workshop ? [workshop[0]] : common ? [source.c, partner] : [source.c];
      return classes.map(c => ({...source, id: `${source.id}@${c}`, c, grade: gradeOf(c),
        source_lesson_id: source.id, source_class: source.c,
        culture_classes: common ? [source.c, partner] : [],
        group_label: workshop ? workshop[1] : ''}));
    });
    lessons.sort((a, b) => data.days.indexOf(a.d) - data.days.indexOf(b.d) || a.p - b.p ||
      a.c.localeCompare(b.c, 'tr', {numeric: true}) || a.id.localeCompare(b.id));
    const result = {lessons, classes: [...new Set(lessons.map(l => l.c))],
      grades: [...new Set(lessons.map(l => l.grade))].sort((a, b) => Number(a) - Number(b))};
    views.set(data, result);
    return result;
  }

  function filterLessons(data, filters) {
    return classView(data).lessons.filter(item =>
      (filters.day === ALL || item.d === filters.day) &&
      (filters.period === ALL || String(item.p) === String(filters.period)) &&
      (filters.grade === ALL || item.grade === String(filters.grade)) &&
      (filters.teacher === ALL || item.teacher_ids.includes(filters.teacher))
    );
  }

  function currentSelection(data, now = new Date()) {
    const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]));
    const day = weekdays[parts.weekday];
    if (!day) return {kind: 'weekend', day: ALL, period: ALL,
      message: 'Hafta sonu. Haftalık programın tamamı gösteriliyor.'};
    const current = Number(parts.hour) * 60 + Number(parts.minute);
    const periods = data.period_times[day];
    const active = periods.find(p => current >= minutes(p.start) && current < minutes(p.end));
    if (active) return {kind: 'lesson', day, period: String(active.period),
      message: `Şu an ${day}, ${active.period}. ders (${active.start} – ${active.end}). Saat dilimi: Türkiye.`};
    const next = periods.find(p => current < minutes(p.start));
    if (next) {
      const kind = current < minutes(periods[0].start) ? 'before' : 'break';
      return {kind, day, period: String(next.period),
        message: `${kind === 'before' ? 'Dersler henüz başlamadı.' : 'Şu an ders arası.'} Sıradaki ${next.period}. ders (${next.start} – ${next.end}) gösteriliyor.`};
    }
    return {kind: 'after', day, period: ALL,
      message: 'Bugünün ders saatleri sona erdi. Günün tamamı gösteriliyor.'};
  }

  function timeRange(data, lesson) {
    const slot = data.period_times[lesson.d].find(p => p.period === lesson.p);
    return `${slot.start} – ${slot.end}`;
  }

  function periodLabel(data, day, period) {
    if (period === ALL) return 'Tüm ders saatleri';
    if (day !== ALL) {
      const p = data.period_times[day].find(item => item.period === Number(period));
      return `${period}. ders (${p.start} – ${p.end})`;
    }
    const standard = data.period_times.Pazartesi[Number(period) - 1];
    const friday = data.period_times.Cuma[Number(period) - 1];
    return standard.start === friday.start
      ? `${period}. ders (${standard.start} – ${standard.end})`
      : `${period}. ders (Cuma saatleri farklı)`;
  }

  const escapeHtml = value => String(value).replace(/[&<>"']/g, c =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  return {ALL, classView, filterLessons, currentSelection, timeRange, periodLabel, escapeHtml};
})();
if (typeof module !== 'undefined') module.exports = DerslikCore;
