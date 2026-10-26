/* Pure schedule operations. Browser and Node tests execute this same source. */
const DerslikCore = (() => {
  const ALL = 'ALL';
  const weekdays = {Mon: 'Pazartesi', Tue: 'Salı', Wed: 'Çarşamba', Thu: 'Perşembe', Fri: 'Cuma'};
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

  function filterLessons(data, filters) {
    return data.lessons.filter(item =>
      (filters.day === ALL || item.d === filters.day) &&
      (filters.period === ALL || String(item.p) === String(filters.period)) &&
      (filters.className === ALL || item.c === filters.className) &&
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

  return {ALL, filterLessons, currentSelection, timeRange, periodLabel, escapeHtml};
})();
if (typeof module !== 'undefined') module.exports = DerslikCore;
