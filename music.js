// Quiet background music. Browsers only allow sound after a click or key press, so it starts on the first one.
(function () {
  const VOLUME = 0.22; // the file is already evened out, so this is the one number to change
  const FADE_MS = 1500;
  const KEY = 'px-music-off';
  const audio = new Audio('audio/agni-kai.mp3');
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;

  let wantsMusic = true;
  try { wantsMusic = localStorage.getItem(KEY) !== '1'; } catch (e) { /* private browsing */ }
  let unlocked = false;
  let fader = null;

  function fadeTo(target, then) {
    clearInterval(fader);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stepSize = VOLUME / (FADE_MS / 50);
    fader = setInterval(() => {
      const gap = target - audio.volume;
      if (reduce || Math.abs(gap) <= stepSize) {
        audio.volume = target;
        clearInterval(fader);
        if (then) then();
      } else {
        audio.volume += Math.sign(gap) * stepSize;
      }
    }, 50);
  }

  function play() {
    if (!unlocked || !wantsMusic || document.visibilityState !== 'visible') return;
    audio.play().then(() => fadeTo(VOLUME)).catch(() => { /* the browser refused, so the game carries on silently */ });
  }

  function label() {
    const button = document.getElementById('music-toggle');
    if (!button) return;
    button.textContent = wantsMusic ? 'Music on' : 'Music off';
    button.setAttribute('aria-pressed', String(wantsMusic));
  }

  function toggle() {
    wantsMusic = !wantsMusic;
    try { localStorage.setItem(KEY, wantsMusic ? '0' : '1'); } catch (e) { /* private browsing */ }
    label();
    if (wantsMusic) play();
    else fadeTo(0, () => audio.pause());
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    play();
  }

  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') play();
    else audio.pause();
  });
  document.getElementById('music-toggle').addEventListener('click', toggle);
  label();

  window.PXMusic = { audio, VOLUME };
})();
