'use strict';

(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
  const activeAnimations = new Map();
  const registered = new WeakSet();
  const ease = 'cubic-bezier(.22, 1, .36, 1)';
  let observer;
  let pointerFrame = 0;
  let activeSurface;
  let progressFrame = 0;

  const heroSelector = [
    '.hero-top', '.intro > .hello', '.intro > h1', '.intro > .hero-description',
    '.hero-cta-row', '.portrait-card', '.hero-bottom', '.report-meta',
    '.report-hero h1', '.report-lede', '.hero-actions', '.hero-visual',
    '.report-hero .spec-grid', '.project-status', '.hero-meta-top', '.hero-grid > *'
  ].join(',');
  const sectionSelector = [
    '.section-heading', '.collection-toolbar', '.collection-title', '.collection-card',
    '.about-label', '.about-copy', '.education-list > li', '.contact-section > .wrap',
    '.report-section .section-grid > header', '.section-body > p:first-child',
    '.card-grid > article', '.diagram', '.example-shell', '.resource-card', '.next-card',
    '.section-title-wrap', '.section-lead-header', '.white-panel', '.lineage-card',
    '.pillar-spec-card', '.takeaway-brick', '.concept-box-card', '.module-clean-card',
    '.download-card', '.certificate-grand-card', '.pillars-box-card', '.element-pill-card',
    '.insight-single-card', '.checklist-card', '.compare-card', '.eet-math-card',
    '.stage-aside-box'
  ].join(',');

  function hashTarget() {
    try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch { return null; }
  }

  function animate(element, frames, options) {
    if (reducedMotion.matches || typeof element.animate !== 'function') return;
    activeAnimations.get(element)?.cancel();
    const animation = element.animate(frames, options);
    activeAnimations.set(element, animation);
    const cleanUp = () => {
      if (activeAnimations.get(element) === animation) activeAnimations.delete(element);
    };
    animation.addEventListener('finish', cleanUp, { once: true });
    animation.addEventListener('cancel', cleanUp, { once: true });
  }

  function reveal(element, delay = 0) {
    element.dataset.reveal = 'revealed';
    observer?.unobserve(element);
    const target = hashTarget();
    if (element.contains(document.activeElement) || (target && (target.contains(element) || element.contains(target)))) return;
    const distance = innerWidth < 761 ? 16 : 26;
    animate(element, [{ opacity: 0, translate: `0 ${distance}px` }, { opacity: 1, translate: '0 0' }], {
      duration: innerWidth < 761 ? 560 : 760, delay, easing: ease, fill: 'backwards'
    });
  }

  function register(elements, hero = false) {
    if (!observer) return;
    elements.forEach((element, index) => {
      if (registered.has(element)) return;
      registered.add(element);
      element.dataset.reveal = 'queued';
      const siblings = [...element.parentElement.children];
      const delay = hero ? Math.min(index, 5) * 70 : Math.min(siblings.indexOf(element), 2) * 75;
      element.dataset.revealDelay = delay;
      observer.observe(element);
    });
  }

  const header = document.querySelector('.site-home .header');
  const navLinks = [...document.querySelectorAll('.site-home .header nav a[href^="#"]')];
  const sections = navLinks.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  function updateScrollState() {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.max(0, Math.min(1, scrollY / max)) : 0})`;
    header?.classList.toggle('is-scrolled', scrollY > 24);
    if (header) {
      const gutter = `${Math.max(0, header.getBoundingClientRect().left)}px`;
      if (header.style.getPropertyValue('--header-gutter') !== gutter) header.style.setProperty('--header-gutter', gutter);
    }
    const offset = (header?.offsetHeight || 0) + 100;
    const current = [...sections].reverse().find(section => section.getBoundingClientRect().top <= offset);
    navLinks.forEach(link => {
      if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    progressFrame = 0;
  }
  function scheduleScrollState() {
    if (!progressFrame) progressFrame = requestAnimationFrame(updateScrollState);
  }
  window.addEventListener('scroll', scheduleScrollState, { passive: true });
  window.addEventListener('resize', scheduleScrollState, { passive: true });
  if (typeof window.ResizeObserver === 'function') new ResizeObserver(scheduleScrollState).observe(document.body);
  updateScrollState();

  function resetSurface() {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    if (activeSurface) {
      activeSurface.style.removeProperty('--tilt-x');
      activeSurface.style.removeProperty('--tilt-y');
      activeSurface.style.removeProperty('--spot-x');
      activeSurface.style.removeProperty('--spot-y');
    }
    activeSurface = null;
  }
  document.querySelectorAll('.portrait-card, .hero-visual, .poster-exhibition-card').forEach(element => element.classList.add('motion-depth'));
  document.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches || event.pointerType !== 'mouse') return;
    const surface = event.target.closest('.collection-card, .motion-depth');
    if (!surface) { if (activeSurface) resetSurface(); return; }
    if (activeSurface !== surface) { resetSurface(); activeSurface = surface; }
    cancelAnimationFrame(pointerFrame);
    const { clientX, clientY } = event;
    pointerFrame = requestAnimationFrame(() => {
      if (!surface.isConnected) { resetSurface(); return; }
      const rect = surface.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      surface.style.setProperty('--spot-x', `${x}px`);
      surface.style.setProperty('--spot-y', `${y}px`);
      if (surface.classList.contains('motion-depth')) {
        surface.style.setProperty('--tilt-x', `${(0.5 - y / rect.height) * 4.8}deg`);
        surface.style.setProperty('--tilt-y', `${(x / rect.width - 0.5) * 4.8}deg`);
      }
      pointerFrame = 0;
    });
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (activeSurface && (!event.relatedTarget || !activeSurface.contains(event.relatedTarget))) resetSurface();
  });
  window.addEventListener('blur', resetSurface);
  finePointer.addEventListener('change', resetSurface);

  function configureMotion() {
    observer?.disconnect();
    observer = null;
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
    resetSurface();
    const enabled = !reducedMotion.matches && typeof window.IntersectionObserver === 'function' && typeof Element.prototype.animate === 'function';
    document.documentElement.classList.toggle('motion-enhanced', enabled);
    if (!enabled) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) reveal(entry.target, Number(entry.target.dataset.revealDelay) || 0);
      });
    }, { threshold: .08, rootMargin: '0px 0px -24px 0px' });
    register([...document.querySelectorAll(heroSelector)], true);
    register([...document.querySelectorAll(sectionSelector)]);
    // A live preference change must not hide or replay previously revealed content.
    document.querySelectorAll('[data-reveal="queued"]').forEach(element => observer.observe(element));
  }
  reducedMotion.addEventListener('change', configureMotion);
  configureMotion();

  document.addEventListener('portfolio:rendered', () => {
    if (activeSurface && !activeSurface.isConnected) resetSurface();
    register([...document.querySelectorAll('.collection-card')]);
    scheduleScrollState();
  });
  document.addEventListener('focusin', event => {
    // Keyboard users never need to wait for a fading control to become usable.
    activeAnimations.forEach((animation, element) => {
      if (element.contains(event.target)) animation.cancel();
    });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-example]')) return;
    document.querySelectorAll('.demo-metrics dd').forEach((element, index) => {
      animate(element, [{ opacity: .35, translate: '0 5px' }, { opacity: 1, translate: '0 0' }], {
        duration: 320, delay: index * 35, easing: ease, fill: 'backwards'
      });
    });
  });
})();

/* ---------------------------------------------------------------------------
   Effects layer — the decorative enhancements layered on top of the motion
   system: an ambient pointer light in the hero, a masked headline reveal,
   magnetic primary controls, scroll parallax and self-drawing circuitry.
   Nothing here owns layout, and all of it stands down for reduced motion.
--------------------------------------------------------------------------- */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
  const ease = 'cubic-bezier(.22, 1, .36, 1)';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const hero = document.querySelector('.site-home .hero');
  const heroTitle = document.querySelector('.site-home #hero-title');

  /* Split the headline on its existing line breaks so each line can rise out of a mask. */
  if (heroTitle && !reducedMotion.matches) {
    const lines = [[]];
    for (const node of heroTitle.childNodes) {
      if (node.nodeType === 1 && node.tagName === 'BR') lines.push([]);
      else lines[lines.length - 1].push(node);
    }
    const fragment = document.createDocumentFragment();
    lines.filter(line => line.length).forEach((nodes, index) => {
      const line = document.createElement('span');
      line.className = 'fx-line';
      const inner = document.createElement('span');
      inner.className = 'fx-line-inner';
      inner.style.setProperty('--fx-i', String(index));
      nodes.forEach(node => inner.append(node));
      line.append(inner);
      fragment.append(line);
    });
    heroTitle.replaceChildren(fragment);
    heroTitle.classList.add('fx-split');
  }

  /* A soft light that trails the pointer across the hero. */
  let heroFrame = 0;
  let pointer = null;
  function paintPointerLight() {
    heroFrame = 0;
    if (!hero || !pointer) return;
    const rect = hero.getBoundingClientRect();
    const x = clamp(pointer.x - rect.left, 0, rect.width);
    const y = clamp(pointer.y - rect.top, 0, rect.height) + rect.height * 0.1;
    hero.style.setProperty('--fx-glow-x', `${x.toFixed(1)}px`);
    hero.style.setProperty('--fx-glow-y', `${y.toFixed(1)}px`);
  }

  /* Primary controls lean gently towards the pointer. */
  document.querySelectorAll([
    '.header .github-nav', '.hero-cta-row > *', '.hero-actions > *', '.contact-bottom .button',
    '.case-header .github-nav', '.case-header .back-btn', '.footer-nav-links > *'
  ].join(',')).forEach(element => element.classList.add('fx-magnet'));
  let activeMagnet = null;
  let magnetFrame = 0;
  let magnetPoint = null;
  function paintMagnet() {
    magnetFrame = 0;
    if (!activeMagnet || !magnetPoint) return;
    const rect = activeMagnet.getBoundingClientRect();
    const dx = magnetPoint.x - (rect.left + rect.width / 2);
    const dy = magnetPoint.y - (rect.top + rect.height / 2);
    activeMagnet.style.setProperty('--fx-mag-x', `${clamp(dx * 0.3, -9, 9).toFixed(1)}px`);
    activeMagnet.style.setProperty('--fx-mag-y', `${clamp(dy * 0.45, -7, 7).toFixed(1)}px`);
  }
  function releaseMagnet() {
    if (!activeMagnet) return;
    activeMagnet.style.removeProperty('--fx-mag-x');
    activeMagnet.style.removeProperty('--fx-mag-y');
    activeMagnet = null;
    magnetPoint = null;
  }

  /* Depth: the hero portrait and the about stamp drift against the scroll. */
  const parallaxTargets = [
    { element: document.querySelector('.site-home .hero .portrait-card'), range: 16 },
    { element: document.querySelector('.site-home .about-stamp'), range: 12 },
    { element: document.querySelector('.report-page .hero-visual'), range: 14 },
    { element: document.querySelector('.case-study-page .poster-exhibition-card'), range: 14 }
  ].filter(target => target.element);
  let parallaxFrame = 0;
  function paintParallax() {
    parallaxFrame = 0;
    for (const { element, range } of parallaxTargets) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -160 || rect.top > innerHeight + 160) continue;
      const applied = parseFloat(element.style.getPropertyValue('--fx-parallax')) || 0;
      const progress = (rect.top - applied + rect.height / 2 - innerHeight / 2) / innerHeight;
      element.style.setProperty('--fx-parallax', `${(clamp(progress, -1.4, 1.4) * -range).toFixed(1)}px`);
    }
  }
  function scheduleParallax() {
    if (reducedMotion.matches || parallaxFrame) return;
    parallaxFrame = requestAnimationFrame(paintParallax);
  }

  /* Decorative circuitry draws itself the first time a card is revealed. */
  const traceObserver = typeof window.IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        traceObserver.unobserve(element);
        element.animate(
          [{ strokeDashoffset: `${element.dataset.fxLength}px` }, { strokeDashoffset: '0px' }],
          { duration: 1250, easing: ease, fill: 'forwards' }
        );
      });
    }, { threshold: .3 })
    : null;
  function primeTraces(scope = document) {
    if (!traceObserver || reducedMotion.matches) return;
    scope.querySelectorAll('.entry-art svg :is(path, rect, circle, ellipse, polygon, polyline, line)[stroke]').forEach(element => {
      if (element.dataset.fxTrace || typeof element.getTotalLength !== 'function') return;
      let length = 0;
      try { length = element.getTotalLength(); } catch { return; }
      if (!length) return;
      element.dataset.fxTrace = '1';
      element.dataset.fxLength = String(length);
      element.style.strokeDasharray = `${length}px`;
      element.style.strokeDashoffset = `${length}px`;
      traceObserver.observe(element);
    });
  }

  function resetEffects() {
    releaseMagnet();
    parallaxTargets.forEach(({ element }) => element.style.removeProperty('--fx-parallax'));
    if (hero) {
      hero.style.removeProperty('--fx-glow-x');
      hero.style.removeProperty('--fx-glow-y');
    }
    document.querySelectorAll('[data-fx-trace]').forEach(element => {
      element.getAnimations?.().forEach(animation => animation.cancel());
      element.style.removeProperty('stroke-dasharray');
      element.style.removeProperty('stroke-dashoffset');
      element.removeAttribute('data-fx-trace');
    });
  }

  document.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches || event.pointerType !== 'mouse') return;
    if (hero && hero.contains(event.target)) {
      pointer = { x: event.clientX, y: event.clientY };
      if (!heroFrame) heroFrame = requestAnimationFrame(paintPointerLight);
    }
    const magnet = event.target.closest ? event.target.closest('.fx-magnet') : null;
    if (magnet !== activeMagnet) {
      releaseMagnet();
      activeMagnet = magnet;
    }
    if (activeMagnet) {
      magnetPoint = { x: event.clientX, y: event.clientY };
      if (!magnetFrame) magnetFrame = requestAnimationFrame(paintMagnet);
    }
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (activeMagnet && (!event.relatedTarget || !activeMagnet.contains(event.relatedTarget))) releaseMagnet();
  }, { passive: true });
  window.addEventListener('blur', releaseMagnet);
  finePointer.addEventListener('change', releaseMagnet);
  window.addEventListener('scroll', scheduleParallax, { passive: true });
  window.addEventListener('resize', scheduleParallax, { passive: true });
  document.addEventListener('portfolio:rendered', () => primeTraces());
  reducedMotion.addEventListener('change', () => {
    resetEffects();
    if (!reducedMotion.matches) {
      scheduleParallax();
      primeTraces();
    }
  });

  if (!reducedMotion.matches) {
    scheduleParallax();
    primeTraces();
  }
})();

/* ---------------------------------------------------------------------------
   Power layer — the loud, high-impact behaviour: an intro curtain, a reactive
   particle field inside the hero, a custom pointer, 3D card framing and a
   running toolkit marquee. Everything is decorative, is built only when motion
   is welcome, and is torn down again the moment it is not.
--------------------------------------------------------------------------- */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const home = document.body.classList.contains('site-home');
  const hero = document.querySelector('.site-home .hero, .report-page .report-hero, .case-study-page .hero-section');

  /* ------------------------------------------------------------ the curtain */
  let intro = null;
  function dropIntro() {
    intro?.remove();
    intro = null;
  }
  function buildIntro() {
    if (intro || !home) return;
    try {
      if (sessionStorage.getItem('fx-intro-seen')) return;
      sessionStorage.setItem('fx-intro-seen', '1');
    } catch (_) { /* private modes may refuse storage; the curtain is optional */ }
    intro = document.createElement('div');
    intro.className = 'fx-intro';
    intro.setAttribute('aria-hidden', 'true');
    intro.innerHTML = '<span class="fx-intro-inner"><span class="fx-intro-mark">AAKASH</span>'
      + '<span class="fx-intro-bar"><i></i></span></span>';
    document.body.append(intro);
    intro.addEventListener('animationend', event => {
      if (event.animationName === 'fx-intro-out') dropIntro();
    });
    setTimeout(dropIntro, 2600);
  }

  /* ------------------------------------------------------------- the pointer */
  let dot = null;
  let ring = null;
  let cursorFrame = 0;
  let cursorX = 0;
  let cursorY = 0;
  let ringX = 0;
  let ringY = 0;
  let cursorHidden = true;

  function buildCursor() {
    if (dot || !finePointer.matches) return;
    dot = document.createElement('div');
    dot.className = 'fx-cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    ring = document.createElement('div');
    ring.className = 'fx-cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(dot, ring);
    document.documentElement.classList.add('fx-cursor-on');
  }
  function dropCursor() {
    document.documentElement.classList.remove('fx-cursor-on');
    dot?.remove();
    ring?.remove();
    dot = ring = null;
    cursorHidden = true;
    cursorFrame = 0;
  }
  function showCursor() {
    if (!dot || !cursorHidden) return;
    cursorHidden = false;
    dot.style.opacity = '1';
    ring.style.opacity = '1';
  }
  function hideCursor() {
    if (!dot || cursorHidden) return;
    cursorHidden = true;
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  }
  function paintCursor() {
    cursorFrame = 0;
    if (!dot) return;
    ringX += (cursorX - ringX) * .18;
    ringY += (cursorY - ringY) * .18;
    dot.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
    ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0)`;
    if (Math.abs(cursorX - ringX) > .15 || Math.abs(cursorY - ringY) > .15) {
      cursorFrame = requestAnimationFrame(paintCursor);
    }
  }

  /* -------------------------------------------------------- the particle field */
  const LINK = 132;
  const REACH = 150;
  let canvas = null;
  let ctx = null;
  let nodes = [];
  let fieldW = 0;
  let fieldH = 0;
  let fieldFrame = 0;
  let fieldVisible = false;
  let aimX = -9999;
  let aimY = -9999;
  let fieldObserver = null;
  let fieldSizer = null;

  function startField() {
    if (!canvas || fieldFrame || !fieldVisible || document.hidden) return;
    fieldFrame = requestAnimationFrame(stepField);
  }
  function stopField() {
    cancelAnimationFrame(fieldFrame);
    fieldFrame = 0;
  }
  function seedField() {
    const count = Math.round(clamp((fieldW * fieldH) / 17000, 24, 72));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * fieldW,
      y: Math.random() * fieldH,
      vx: (Math.random() - .5) * .24,
      vy: (Math.random() - .5) * .24,
      r: 1 + Math.random() * 1.4
    }));
  }
  function sizeField() {
    if (!canvas || !hero) return;
    const rect = hero.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    fieldW = Math.round(rect.width);
    fieldH = Math.round(rect.height);
    canvas.width = Math.round(fieldW * dpr);
    canvas.height = Math.round(fieldH * dpr);
    canvas.style.width = `${fieldW}px`;
    canvas.style.height = `${fieldH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedField();
  }
  function strokeLinks(bucket, alpha) {
    const near = LINK * .55;
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK || d2 < 1) continue;
        if (bucket === 'near' ? d2 > near * near : d2 <= near * near) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.strokeStyle = `rgba(126, 224, 195, ${alpha})`;
    ctx.stroke();
  }
  function drawField() {
    ctx.clearRect(0, 0, fieldW, fieldH);
    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < -24) node.x = fieldW + 24; else if (node.x > fieldW + 24) node.x = -24;
      if (node.y < -24) node.y = fieldH + 24; else if (node.y > fieldH + 24) node.y = -24;
      const dx = node.x - aimX;
      const dy = node.y - aimY;
      const dist = Math.hypot(dx, dy);
      if (dist < REACH && dist > .5) {
        const push = (1 - dist / REACH) * .9;
        node.x += (dx / dist) * push;
        node.y += (dy / dist) * push;
      }
    }
    strokeLinks('far', .14);
    strokeLinks('near', .34);
    ctx.beginPath();
    for (const node of nodes) {
      ctx.moveTo(node.x + node.r, node.y);
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(190, 238, 214, .5)';
    ctx.fill();
  }
  function stepField() {
    fieldFrame = 0;
    if (!ctx || !fieldVisible || document.hidden) return;
    drawField();
    fieldFrame = requestAnimationFrame(stepField);
  }
  function buildField() {
    if (canvas || !hero) return;
    const element = document.createElement('canvas');
    element.className = 'fx-canvas';
    element.setAttribute('aria-hidden', 'true');
    const context = element.getContext('2d');
    if (!context) return;
    canvas = element;
    ctx = context;
    hero.prepend(canvas);
    sizeField();
    fieldVisible = true;
    if (typeof window.IntersectionObserver === 'function') {
      fieldObserver = new IntersectionObserver(entries => {
        fieldVisible = entries.some(entry => entry.isIntersecting);
        if (fieldVisible) startField(); else stopField();
      }, { threshold: 0 });
      fieldObserver.observe(hero);
    }
    if (typeof window.ResizeObserver === 'function') {
      fieldSizer = new ResizeObserver(() => { stopField(); sizeField(); startField(); });
      fieldSizer.observe(hero);
    }
    startField();
  }
  function dropField() {
    stopField();
    fieldObserver?.disconnect();
    fieldSizer?.disconnect();
    fieldObserver = null;
    fieldSizer = null;
    canvas?.remove();
    canvas = null;
    ctx = null;
    nodes = [];
    fieldVisible = false;
  }

  /* ----------------------------------------------------------- card framing */
  let framedCard = null;
  const cardSelector = [
    '.collection-card', '.card-grid > article', '.next-card',
    '.module-clean-card', '.pillar-spec-card', '.concept-box-card',
    '.lineage-card', '.takeaway-brick', '.download-card', '.quote-editorial-box',
    '.pillars-box-card', '.white-panel', '.element-pill-card', '.insight-single-card',
    '.checklist-card', '.certificate-grand-card', '.resource-card', '.compare-card',
    '.eet-math-card'
  ].join(',');
  function primeCards() {
    if (reducedMotion.matches) return;
    document.querySelectorAll(cardSelector).forEach(card => card.classList.add('fx-tilt'));
  }
  function clearFraming() {
    if (!framedCard) return;
    framedCard.style.removeProperty('--fx-tilt-x');
    framedCard.style.removeProperty('--fx-tilt-y');
    framedCard.style.removeProperty('--fx-glare-x');
    framedCard.style.removeProperty('--fx-glare-y');
    framedCard = null;
  }

  /* -------------------------------------------------------------- the marquee */
  let marquee = null;
  function dropMarquee() {
    marquee?.remove();
    marquee = null;
  }
  function buildMarquee() {
    if (marquee || !home || !hero) return;
    const labels = [...document.querySelectorAll('.site-home .toolkit li')]
      .map(item => item.textContent.trim())
      .filter(Boolean);
    if (!labels.length) return;
    const track = document.createElement('div');
    track.className = 'fx-marquee-track';
    const half = labels.map(label => `<span>${label}</span>`).join('');
    track.innerHTML = half + half;
    marquee = document.createElement('div');
    marquee.className = 'fx-marquee';
    marquee.setAttribute('aria-hidden', 'true');
    marquee.append(track);
    hero.insertAdjacentElement('afterend', marquee);
  }

  /* ------------------------------------------------------------------ wiring */
  document.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (ring) {
      if (cursorHidden) {
        cursorX = ringX = event.clientX;
        cursorY = ringY = event.clientY;
        showCursor();
      }
      cursorX = event.clientX;
      cursorY = event.clientY;
      const over = event.target.closest?.('a, button, input, textarea, select, summary, [role="button"]');
      ring.classList.toggle('is-hover', Boolean(over));
      if (!cursorFrame) cursorFrame = requestAnimationFrame(paintCursor);
    }
    if (canvas) {
      const rect = hero.getBoundingClientRect();
      aimX = event.clientX - rect.left;
      aimY = event.clientY - rect.top;
    }
    const card = event.target.closest?.('.fx-tilt') || null;
    if (card !== framedCard) {
      clearFraming();
      framedCard = card;
    }
    if (framedCard && finePointer.matches) {
      const rect = framedCard.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const y = clamp(event.clientY - rect.top, 0, rect.height);
      framedCard.style.setProperty('--fx-glare-x', `${x.toFixed(1)}px`);
      framedCard.style.setProperty('--fx-glare-y', `${y.toFixed(1)}px`);
      framedCard.style.setProperty('--fx-tilt-x', `${((.5 - y / rect.height) * 6).toFixed(2)}deg`);
      framedCard.style.setProperty('--fx-tilt-y', `${((x / rect.width - .5) * 6).toFixed(2)}deg`);
    }
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { hideCursor(); clearFraming(); });
  document.addEventListener('pointerdown', () => ring?.classList.add('is-down'), { passive: true });
  document.addEventListener('pointerup', () => ring?.classList.remove('is-down'), { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) startField(); });
  window.addEventListener('blur', () => { hideCursor(); clearFraming(); });
  document.addEventListener('portfolio:rendered', () => { primeCards(); if (canvas) { stopField(); sizeField(); startField(); } });
  window.addEventListener('error', dropCursor);

  function boot() {
    if (reducedMotion.matches) {
      dropIntro();
      dropCursor();
      dropField();
      dropMarquee();
      clearFraming();
      document.querySelectorAll('.fx-tilt').forEach(card => card.classList.remove('fx-tilt'));
      return;
    }
    buildIntro();
    buildCursor();
    buildField();
    buildMarquee();
    primeCards();
  }
  reducedMotion.addEventListener('change', boot);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* ---------------------------------------------------------------------------
   Presence layer — one ambient light that lives on every page family. On a fine
   pointer it trails the cursor; on anything else it drifts on its own. Either
   way it takes its colour from how far the reader has scrolled, walking the
   same mint → sky → amber ramp as the progress rail at the top of the page, so
   the light of the page travels with the page. Purely decorative: it never
   takes a pointer and reduced motion removes it entirely.
--------------------------------------------------------------------------- */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const RAMP = [[194, 231, 205], [159, 200, 240], [227, 201, 143]];

  let light = null;
  let frame = 0;
  let handX = 0;
  let handY = 0;
  let aimX = 0;
  let aimY = 0;
  let travelling = false;
  let painted = '';

  function tone(progress) {
    const value = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    const index = value < .5 ? 0 : 1;
    const local = value < .5 ? value * 2 : (value - .5) * 2;
    const from = RAMP[index];
    const to = RAMP[index + 1];
    return from.map((channel, step) => Math.round(channel + (to[step] - channel) * local)).join(' ');
  }

  function readProgress() {
    if (!light) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? Math.max(0, Math.min(1, scrollY / max)) : 0;
    const next = tone(Math.round(ratio * 40) / 40);
    if (next === painted) return;
    painted = next;
    light.style.setProperty('--fx-amb-rgb', next);
  }

  function paint() {
    frame = 0;
    if (!light) return;
    handX += (aimX - handX) * .13;
    handY += (aimY - handY) * .13;
    light.style.transform = `translate3d(${handX.toFixed(1)}px, ${handY.toFixed(1)}px, 0)`;
    if (Math.abs(aimX - handX) > .5 || Math.abs(aimY - handY) > .5) frame = requestAnimationFrame(paint);
  }

  function handOver(x, y) {
    if (!light) return;
    if (!travelling) {
      // Take the light from wherever it is drifting, then hand it to the pointer.
      const rect = light.getBoundingClientRect();
      handX = rect.left + rect.width / 2 - innerWidth / 2;
      handY = rect.top + rect.height / 2 - innerHeight / 2;
      travelling = true;
      light.classList.add('is-live');
    }
    aimX = x - innerWidth / 2;
    aimY = y - innerHeight / 2;
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function build() {
    if (light || reducedMotion.matches || innerWidth <= 900) return;
    light = document.createElement('div');
    light.className = 'fx-ambience';
    light.setAttribute('aria-hidden', 'true');
    document.body.append(light);
    painted = '';
    readProgress();
    requestAnimationFrame(() => light?.classList.add('is-ready'));
  }

  function drop() {
    cancelAnimationFrame(frame);
    frame = 0;
    travelling = false;
    painted = '';
    light?.remove();
    light = null;
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    handOver(event.clientX, event.clientY);
  }, { passive: true });
  window.addEventListener('scroll', readProgress, { passive: true });
  window.addEventListener('resize', () => { readProgress(); build(); });
  document.addEventListener('portfolio:rendered', readProgress);

  function boot() {
    if (reducedMotion.matches) drop();
    else build();
  }
  reducedMotion.addEventListener('change', boot);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
