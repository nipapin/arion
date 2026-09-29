(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('.theme-toggle');
  const preferred = matchMedia('(prefers-color-scheme:dark)');
  const canvas = document.querySelector('#particles');
  const ctx = canvas.getContext('2d');
  const hero = document.querySelector('.hero-stage');
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
  let stored;
  try { stored = localStorage.getItem('arion-theme'); } catch {}
  let rgb = '', width = 0, height = 0, dots = [], running = false, frame = 0;
  let pointer = { x: -1000, y: -1000 }, visible = false;
  function setTheme(theme) {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    toggle.title = dark ? 'Светлая тема' : 'Тёмная тема';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#0f141d' : '#e7e8e5';
    rgb = getComputedStyle(root).getPropertyValue('--particle-rgb').trim();
    if (!running && ctx) draw(performance.now());
  }
  setTheme(root.dataset.theme || 'light');
  toggle.addEventListener('click', () => {
    stored = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('arion-theme', stored); } catch {}
    setTheme(stored);
  });
  preferred.addEventListener('change', e => { if (!stored) setTheme(e.matches ? 'dark' : 'light'); });
  if (!ctx) return;
  function resize() {
    width = hero.clientWidth; height = hero.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(72, Math.max(24, Math.round(width / 23)));
    dots = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), radius: .6 + Math.random() * 1.15, speed: 2 + Math.random() * 4, phase: Math.random() * Math.PI * 2 }));
    if (!running) draw(performance.now());
  }
  function draw(time) {
    if (!ctx || !width || reducedMotion.matches) return;
    const t = time / 1000;
    ctx.clearRect(0, 0, width, height);
    for (const p of dots) {
      let x = p.x * width + Math.sin(t * .17 + p.phase) * 25;
      let y = (p.y * height - t * p.speed) % (height + 40);
      if (y < -20) y += height + 40;
      const dx = x - pointer.x, dy = y - pointer.y, distance = Math.hypot(dx, dy);
      if (distance < 120 && distance > 0) { const push = (1 - distance / 120) * 13; x += dx / distance * push; y += dy / distance * push; }
      const alpha = .2 + (Math.sin(t * .55 + p.phase) + 1) * .17;
      ctx.beginPath(); ctx.fillStyle = `rgba(${rgb},${alpha})`; ctx.arc(x, y, p.radius, 0, Math.PI * 2); ctx.fill();
    }
    if (running) frame = requestAnimationFrame(draw);
  }
  function sync() {
    const shouldRun = visible && !document.hidden && !reducedMotion.matches;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) frame = requestAnimationFrame(draw); else cancelAnimationFrame(frame);
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
  observer.observe(hero);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  addEventListener('resize', resize, { passive: true });
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1000; });
  resize();
})();
