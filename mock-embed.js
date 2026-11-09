// Lets a mock page run inside the full tutorial walkthrough (mock-tutorial.html). When a page is opened
// with ?embed, its design tabs and notes hide, its Back, Next and Skip buttons tell the walkthrough to move,
// and it reports its height so the walkthrough can size the frame to fit.
(function () {
  if (!new URLSearchParams(location.search).has('embed') || window.parent === window) return;
  document.documentElement.classList.add('embed');
  document.body.classList.add('embed');

  const send = (msg) => window.parent.postMessage(msg, '*');
  document.addEventListener('click', (e) => {
    const skip = e.target.closest('.help-head .tool');
    if (skip) return send({ go: 'skip' });
    const button = e.target.closest('.help-foot button');
    if (button) send({ go: button.classList.contains('quiet') ? 'back' : 'next' });
    return undefined;
  });

  const report = () => send({ height: document.getElementById('help').getBoundingClientRect().height });
  new ResizeObserver(report).observe(document.getElementById('help'));
  report();
})();
