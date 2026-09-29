/* Scroll-linked collections, shared-photo transitions, and contact-sheet focus. */
import { rail, reduced, clamp, sheet } from './app.js';

(() => {
  const works = document.querySelector('#works');
  const pin = works.querySelector('.works-stage');
  const footer = works.querySelector('.rail-footer');
  const switches = [...works.querySelectorAll('[data-view]')];
  const prev = document.querySelector('#rail-prev');
  const next = document.querySelector('#rail-next');
  let mode = 'gallery', range = 0, rememberedX = 0, scrollFrame = 0;
  let switching = false, activeFlights = [], drag = null, suppressClick = false;
  let focused = null;
  const startY = () => works.getBoundingClientRect().top + window.scrollY;
  const progress = () => clamp(window.scrollY - startY(), 0, range);

  function updateProgress() {
    const max = rail.scrollWidth - rail.clientWidth;
    const x = rail.scrollLeft;
    const scrollable = max > 2;
    works.querySelector('.rail-buttons').hidden = !scrollable;
    works.querySelector('.rail-progress').hidden = !scrollable;
    works.querySelector('.rail-help').textContent = scrollable ? 'ЛИСТАЙТЕ ВНИЗ — ИССЛЕДУЙТЕ СЕРИИ' : 'ЧЕТЫРЕ СЕРИИ — ЧЕТЫРЕ ИСТОРИИ';
    works.querySelector('.rail-progress i').style.transform = `translateX(${max > 0 ? x / max * 300 : 0}%)`;
    prev.disabled = x < 2;
    next.disabled = x >= max - 2;
  }
  function syncScroll() {
    scrollFrame = 0;
    if (mode === 'gallery' && !reduced && !switching) {
      rail.scrollLeft = progress();
      rememberedX = rail.scrollLeft;
      updateProgress();
    }
  }
  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(syncScroll);
  }
  function measure() {
    if (mode !== 'gallery') return;
    sizeCards();
    range = Math.max(0, rail.scrollWidth - rail.clientWidth);
    works.style.height = reduced ? 'auto' : `${pin.offsetHeight + range}px`;
    syncScroll();
  }
  function sizeCards() {
    const card = rail.querySelector('.project-card');
    const image = card.querySelector('.project-image');
    const railStyle = getComputedStyle(rail);
    const cardStyle = getComputedStyle(card);
    const sidePadding = parseFloat(cardStyle.paddingLeft) + parseFloat(cardStyle.paddingRight);
    const available = rail.clientHeight - parseFloat(railStyle.paddingTop) - parseFloat(railStyle.paddingBottom)
      - card.querySelector('.project-meta').offsetHeight - parseFloat(getComputedStyle(image).marginBottom);
    const imageWidth = Math.max(120, Math.min(available * .75, rail.clientWidth * .82 - sidePadding));
    rail.style.setProperty('--series-width', `${imageWidth + sidePadding}px`);
  }
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', () => { clearFocus(); activeFlights.forEach(a => a.cancel()); measure(); }, { passive: true });
  rail.addEventListener('scroll', updateProgress, { passive: true });
  document.fonts.ready.then(measure);
  measure();

  function seek(x, smooth = true) {
    x = clamp(x, 0, range);
    if (reduced) rail.scrollTo({ left: x, behavior: 'instant' });
    else window.scrollTo({ top: startY() + x, behavior: smooth ? 'smooth' : 'instant' });
  }
  function move(direction) {
    const step = rail.querySelector('.project-card').offsetWidth + parseFloat(getComputedStyle(rail).columnGap);
    seek(rail.scrollLeft + direction * step);
  }
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  rail.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1);
    }
  });
  rail.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || switching) return;
    drag = { x: e.clientX, scroll: rail.scrollLeft, moved: false };
    suppressClick = false;
  });
  rail.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!(e.buttons & 1)) { endDrag(); return; }
    const delta = drag.x - e.clientX;
    if (Math.abs(delta) > 7 && !drag.moved) {
      drag.moved = true;
      rail.setPointerCapture(e.pointerId);
      rail.classList.add('dragging');
    }
    if (drag.moved) { e.preventDefault(); seek(drag.scroll + delta, false); }
  });
  function endDrag() {
    if (drag?.moved) suppressClick = true;
    drag = null;
    rail.classList.remove('dragging');
  }
  rail.addEventListener('pointerup', endDrag);
  rail.addEventListener('pointercancel', () => { endDrag(); suppressClick = false; });
  rail.addEventListener('click', e => {
    if (suppressClick || switching) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; }
  }, true);

  const assembled = new Set();
  function gather(card) {
    if (reduced || assembled.has(card) || switching) return;
    assembled.add(card);
    const photos = [...card.querySelectorAll('.stack-photo')].slice(0, 4);
    photos.forEach((img, i) => {
      if (i === 0) return;
      const end = getComputedStyle(img).transform;
      img.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: end, opacity: 1 }
      ], { duration: 1100, delay: 100 + (i - 1) * 90, easing: 'cubic-bezier(.18,.8,.22,1)', fill: 'backwards' });
    });
  }
  const gatherObserver = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) gather(e.target); });
  }, { threshold: .25 });
  rail.querySelectorAll('.project-card').forEach(card => gatherObserver.observe(card));

  function snapshot(container) {
    const map = new Map();
    container.querySelectorAll('img[data-photo]').forEach(img => {
      const r = img.getBoundingClientRect();
      const angle = img.classList.contains('stack-photo') ? parseFloat(img.style.getPropertyValue('--angle')) || 0 : 0;
      map.set(img.dataset.photo, {
        key: img.dataset.photo, src: img.currentSrc || img.src,
        cx: r.left + r.width / 2, cy: r.top + r.height / 2,
        w: img.offsetWidth, h: img.offsetHeight, angle,
        border: parseFloat(getComputedStyle(img).borderTopWidth) || 0
      });
    });
    return map;
  }
  function clearFocus() {
    focused?.style.setProperty('--tilt-x', '0deg');
    focused?.style.setProperty('--tilt-y', '0deg');
    focused?.classList.remove('focused');
    focused = null;
    sheet.classList.remove('is-focused');
  }
  function applyMode(all) {
    mode = all ? 'contact' : 'gallery';
    works.classList.toggle('contact-mode', all);
    rail.hidden = all;
    footer.hidden = all;
    sheet.hidden = !all;
    switches.forEach(b => {
      const selected = b.dataset.view === mode;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    if (all) works.style.height = 'auto';
    else {
      sizeCards();
      range = Math.max(0, rail.scrollWidth - rail.clientWidth);
      works.style.height = reduced ? 'auto' : `${pin.offsetHeight + range}px`;
      rail.scrollLeft = clamp(rememberedX, 0, range);
    }
  }

  async function switchView(all) {
    if (switching || all === (mode === 'contact')) return;
    switching = true;
    const originalStart = startY();
    const pinTop = Math.max(0, pin.getBoundingClientRect().top);
    if (mode === 'gallery') rememberedX = rail.scrollLeft;
    const from = snapshot(all ? rail : sheet);
    clearFocus();
    works.setAttribute('aria-busy', 'true');
    applyMode(all);
    // Keep the section's heading in place while its scroll space changes.
    window.scrollTo({ top: all ? Math.max(0, originalStart - pinTop) : originalStart + (reduced ? 0 : rememberedX), behavior: 'instant' });
    updateProgress();
    if (reduced) { switching = false; works.removeAttribute('aria-busy'); return; }
    const to = snapshot(all ? sheet : rail);
    const layer = document.createElement('div');
    layer.className = 'flight-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    works.classList.add('is-transforming');
    const animations = [];
    to.forEach((target, key) => {
      const source = from.get(key);
      if (!source || !target.w || !target.h) return;
      const clone = document.createElement('div');
      clone.className = 'flying-photo';
      clone.style.cssText = `left:${target.cx - target.w / 2}px;top:${target.cy - target.h / 2}px;width:${target.w}px;height:${target.h}px;z-index:${50 - Number(key.split('-')[1])}`;
      const img = document.createElement('img');
      img.src = target.src; img.alt = ''; clone.append(img); layer.append(clone);
      const originX = clamp(source.cx, -innerWidth * .35, innerWidth * 1.35);
      const originY = clamp(source.cy, -innerHeight * .35, innerHeight * 1.35);
      const [group, frame] = key.split('-').map(Number);
      // Resize the actual image aperture so cover cropping evolves continuously.
      // Scaling a destination-shaped bitmap would change the portrait crop abruptly.
      animations.push(clone.animate([
        { left: `${originX - source.w / 2}px`, top: `${originY - source.h / 2}px`, width: `${source.w}px`, height: `${source.h}px`, borderWidth: `${source.border}px`, transform: `rotate(${source.angle}deg)`, opacity: 1 },
        { left: `${target.cx - target.w / 2}px`, top: `${target.cy - target.h / 2}px`, width: `${target.w}px`, height: `${target.h}px`, borderWidth: `${target.border}px`, transform: `rotate(${target.angle}deg)`, opacity: 1 }
      ], { duration: all ? 980 : 880, delay: frame * 23 + group * 30, easing: 'cubic-bezier(.2,.78,.2,1)', fill: 'both' }));
    });
    activeFlights = animations;
    const y = scrollY;
    const interrupt = () => { if (Math.abs(scrollY - y) > 6) animations.forEach(a => a.cancel()); };
    addEventListener('scroll', interrupt, { passive: true });
    await Promise.allSettled(animations.map(a => a.finished));
    removeEventListener('scroll', interrupt);
    layer.remove();
    works.classList.remove('is-transforming');
    works.removeAttribute('aria-busy');
    switching = false;
    activeFlights = [];
    if (!all) { rail.querySelectorAll('.project-card').forEach(c => assembled.add(c)); syncScroll(); }
  }
  switches.forEach(b => b.addEventListener('click', () => switchView(b.dataset.view === 'contact')));

  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !reduced) {
    function focusFrame(button) {
      if (switching || focused === button || mode !== 'contact') return;
      clearFocus();
      const print = button.querySelector('.focus-print');
      const r = print.getBoundingClientRect();
      const scale = Math.max(1, Math.min(2.3, innerHeight * .72 / r.height, innerWidth * .65 / r.width));
      const w = r.width * scale, h = r.height * scale;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const x = clamp(cx, 20 + w / 2, innerWidth - 20 - w / 2) - cx;
      const y = clamp(cy, 20 + h / 2, innerHeight - 100 - h / 2) - cy;
      button.style.setProperty('--focus-x', `${x}px`);
      button.style.setProperty('--focus-y', `${y}px`);
      button.style.setProperty('--focus-scale', scale);
      button.classList.add('focused');
      sheet.classList.add('is-focused');
      focused = button;
    }
    sheet.querySelectorAll('.contact-frame').forEach(button => {
      const tilt = e => {
        if (e.pointerType !== 'mouse' || innerWidth <= 800 || focused !== button || switching) return;
        // Measure the stable layout, so the tilted image never feeds back into its own motion.
        const r = button.getBoundingClientRect();
        const print = button.querySelector('.focus-print');
        const scale = Number(button.style.getPropertyValue('--focus-scale')) || 1;
        const cx = r.left + r.width / 2 + parseFloat(button.style.getPropertyValue('--focus-x') || 0);
        const cy = r.top + print.offsetHeight / 2 + parseFloat(button.style.getPropertyValue('--focus-y') || 0);
        const x = clamp((e.clientX - cx) / (r.width * scale / 2), -1, 1);
        const y = clamp((e.clientY - cy) / (print.offsetHeight * scale / 2), -1, 1);
        button.style.setProperty('--tilt-x', `${-y * 7}deg`);
        button.style.setProperty('--tilt-y', `${x * 7}deg`);
      };
      button.addEventListener('pointerenter', e => { focusFrame(button); tilt(e); });
      button.addEventListener('pointermove', tilt);
      button.addEventListener('pointerleave', () => { if (focused === button) clearFocus(); });
      button.addEventListener('focus', () => focusFrame(button));
      button.addEventListener('blur', () => { if (focused === button) clearFocus(); });
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') clearFocus(); });
    sheet.addEventListener('click', clearFocus, true);
  }
})();
