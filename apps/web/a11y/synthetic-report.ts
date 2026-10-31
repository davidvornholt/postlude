/**
 * A made-up /wrap report for the browser tests, written to the report contract
 * (Contract 5 in the personal-systems plan) and nothing more.
 *
 * It holds no numbers of its own. It fills them in from the message the page
 * sends, takes the colour scheme from that message, and asks for the height it
 * needs. Along the way it records on its root element what it could and
 * couldn't do from inside the sandbox, so a test can read that back.
 */

export const syntheticReportHtml = `<!-- A synthetic report for tests. -->
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
</body>
</html>
`;
