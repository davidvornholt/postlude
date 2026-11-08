/**
 * The /wrap report every sample day carries, written to the report contract
 * (Contract 5 in the personal-systems plan). It holds no numbers of its own: it
 * fills them in from the message the page sends, takes the colour scheme from
 * it, and asks for the height it needs. It says that it is sample data, so
 * nobody mistakes it for a measured day.
 */

export const sampleReportHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sample day report</title>
<style>
  :root { color-scheme: light; --ink: #1d1d1b; --faint: #6b6860; --bar: #4f6f52; --track: #e8e5dc; background: #ffffff; color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
  :root[data-theme="dark"] { color-scheme: dark; --ink: #f1efe9; --faint: #a9a59b; --bar: #9cc29f; --track: #34322d; background: #1b1a18; }
  body { margin: 0; }
  main { padding: 16px 20px; }
  h1 { font-size: 18px; margin: 0; }
  .note { color: var(--faint); font-size: 13px; margin: 2px 0 14px; }
  dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px 16px; margin: 0 0 16px; }
  dt { color: var(--faint); font-size: 13px; }
  dd { margin: 0; font-size: 20px; font-variant-numeric: tabular-nums; }
  h2 { font-size: 14px; margin: 0 0 8px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: grid; grid-template-columns: 120px 1fr 56px; gap: 8px; align-items: center; font-size: 13px; }
  .track { background: var(--track); height: 8px; overflow: hidden; }
  .fill { background: var(--bar); height: 100%; }
  .minutes { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<main>
  <h1>Day report</h1>
  <p class="note">Sample data for a preview. Nothing here was measured.</p>
  <dl>
    <div><dt>Active</dt><dd data-minutes="activeMinutes">…</dd></div>
    <div><dt>Focused</dt><dd data-minutes="focusMinutes">…</dd></div>
    <div><dt>Scattered</dt><dd data-minutes="scatteredMinutes">…</dd></div>
    <div><dt>Away from the computer</dt><dd data-minutes="offComputerMinutes">…</dd></div>
    <div><dt>In appointments</dt><dd data-minutes="appointmentMinutes">…</dd></div>
    <div><dt>First and last activity</dt><dd data-span>…</dd></div>
    <div><dt>Landed pull requests</dt><dd data-count="landedPrs">…</dd></div>
    <div><dt>Mail sent</dt><dd data-mail>…</dd></div>
  </dl>
  <section data-categories hidden>
    <h2>Where the time went (estimates)</h2>
    <ul></ul>
  </section>
</main>
<script>
  const unmeasured = 'Not measured';
  const minutes = (value) => {
    if (value === null || value === undefined) { return unmeasured; }
    const hours = Math.floor(value / 60);
    return hours === 0 ? value + ' min' : hours + ' h ' + String(value % 60).padStart(2, '0') + ' min';
  };
  const clock = (instant) => instant === null ? unmeasured : instant.slice(11, 16);
  const reportHeight = () => {
    const height = Math.ceil(document.querySelector('main').getBoundingClientRect().height);
    window.parent.postMessage({ type: 'postlude:report-height', height }, '*');
  };
  const show = (metrics) => {
    for (const field of document.querySelectorAll('[data-minutes]')) {
      field.textContent = minutes(metrics[field.dataset.minutes]);
    }
    for (const field of document.querySelectorAll('[data-count]')) {
      const value = metrics[field.dataset.count];
      field.textContent = value === null ? unmeasured : String(value);
    }
    document.querySelector('[data-span]').textContent =
      clock(metrics.firstActivityAt) + ' to ' + clock(metrics.lastActivityAt);
    const counts = metrics.sentMails.map((mailbox) => mailbox.count);
    document.querySelector('[data-mail]').textContent =
      counts.length === 0 || counts.includes(null) ? unmeasured : String(counts.reduce((sum, count) => sum + count, 0));
    const section = document.querySelector('[data-categories]');
    const list = section.querySelector('ul');
    list.replaceChildren();
    const largest = Math.max(1, ...metrics.categories.map((category) => category.minutes ?? 0));
    for (const category of metrics.categories) {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = category.label;
      const track = document.createElement('span');
      track.className = 'track';
      const fill = document.createElement('span');
      fill.className = 'fill';
      fill.style.display = 'block';
      fill.style.width = ((category.minutes ?? 0) / largest) * 100 + '%';
      track.append(fill);
      const value = document.createElement('span');
      value.className = 'minutes';
      value.textContent = minutes(category.minutes);
      item.append(label, track, value);
      list.append(item);
    }
    section.hidden = metrics.categories.length === 0;
  };
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) { return; }
    const message = event.data;
    if (message === null || typeof message !== 'object' || message.type !== 'postlude:day-metrics') { return; }
    document.documentElement.dataset.theme = message.theme;
    show(message.dayMetrics);
    reportHeight();
  });
  window.addEventListener('resize', reportHeight);
</script>
</body>
</html>
`;
