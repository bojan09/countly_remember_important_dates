// Runs synchronously in <head> before first paint so the saved theme/accent/language never flash.
(function () {
  try {
    var p = JSON.parse(localStorage.getItem('countly.prefs.v1') || '{}');
    var d = document.documentElement;
    var light = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
    d.dataset.theme = p.theme === 'light' || p.theme === 'dark' ? p.theme : light ? 'light' : 'dark';
    if (p.lang === 'mk') d.lang = 'mk';
    var accents = { violet: '#7356f2', teal: '#2ec4b6', orange: '#ff9f43', peach: '#ffb38a', pink: '#ff5fa2', blue: '#4d8dff', indigo: '#5b5bd6' };
    var ink = { violet: '#ffffff', indigo: '#ffffff' };
    if (accents[p.accent]) {
      d.style.setProperty('--accent', accents[p.accent]);
      d.style.setProperty('--accent-ink', ink[p.accent] || '#1a0f3a');
      d.style.setProperty('--strong-mix', ink[p.accent] ? '#000' : '#fff');
    }
    if (p.reduceMotion === true) d.dataset.motion = 'reduced';
  } catch (e) {
    /* defaults apply */
  }
})();
