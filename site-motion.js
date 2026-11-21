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
    const distance = innerWidth < 761 ? 14 : 20;
    animate(element, [{ opacity: 0, translate: `0 ${distance}px` }, { opacity: 1, translate: '0 0' }], {
      duration: innerWidth < 761 ? 460 : 620, delay, easing: ease, fill: 'backwards'
    });
  }

  function register(elements, hero = false) {
    if (!observer) return;
    elements.forEach((element, index) => {
      if (registered.has(element)) return;
      registered.add(element);
      element.dataset.reveal = 'queued';
      const siblings = [...element.parentElement.children];
      const delay = hero ? Math.min(index, 5) * 55 : Math.min(siblings.indexOf(element), 2) * 65;
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
        surface.style.setProperty('--tilt-x', `${(0.5 - y / rect.height) * 2.4}deg`);
        surface.style.setProperty('--tilt-y', `${(x / rect.width - 0.5) * 2.4}deg`);
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
    activeAnimations.forEach((animation, element) => {
      if (element.contains(event.target)) animation.cancel();
    });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-example]')) return;
    document.querySelectorAll('.demo-metrics dd').forEach((element, index) => {
      animate(element, [{ opacity: .4, translate: '0 4px' }, { opacity: 1, translate: '0 0' }], {
        duration: 280, delay: index * 30, easing: ease, fill: 'backwards'
      });
    });
  });
})();

/* Restraint effects layer: masked hero line rise, subtle pointer light, light parallax, SVG trace, toolkit ribbon. */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
  const ease = 'cubic-bezier(.22, 1, .36, 1)';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const home = document.body.classList.contains('site-home');
  const hero = document.querySelector('.site-home .hero');
  const heroTitle = document.querySelector('.site-home #hero-title');

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

  let heroFrame = 0;
  let pointer = null;
  function paintPointerLight() {
    heroFrame = 0;
    if (!hero || !pointer) return;
    const rect = hero.getBoundingClientRect();
    const x = clamp(pointer.x - rect.left, 0, rect.width);
    const y = clamp(pointer.y - rect.top, 0, rect.height) + rect.height * 0.08;
    hero.style.setProperty('--fx-glow-x', `${x.toFixed(1)}px`);
    hero.style.setProperty('--fx-glow-y', `${y.toFixed(1)}px`);
  }

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
    activeMagnet.style.setProperty('--fx-mag-x', `${clamp(dx * 0.18, -5, 5).toFixed(1)}px`);
    activeMagnet.style.setProperty('--fx-mag-y', `${clamp(dy * 0.25, -4, 4).toFixed(1)}px`);
  }
  function releaseMagnet() {
    if (!activeMagnet) return;
    activeMagnet.style.removeProperty('--fx-mag-x');
    activeMagnet.style.removeProperty('--fx-mag-y');
    activeMagnet = null;
    magnetPoint = null;
  }

  const parallaxTargets = [
    { element: document.querySelector('.site-home .hero .portrait-card'), range: 12 },
    { element: document.querySelector('.site-home .about-stamp'), range: 10 },
    { element: document.querySelector('.report-page .hero-visual'), range: 10 },
    { element: document.querySelector('.case-study-page .poster-exhibition-card'), range: 10 }
  ].filter(target => target.element);
  let parallaxFrame = 0;
  function paintParallax() {
    parallaxFrame = 0;
    for (const { element, range } of parallaxTargets) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -160 || rect.top > innerHeight + 160) continue;
      const applied = parseFloat(element.style.getPropertyValue('--fx-parallax')) || 0;
      const progress = (rect.top - applied + rect.height / 2 - innerHeight / 2) / innerHeight;
      element.style.setProperty('--fx-parallax', `${(clamp(progress, -1.2, 1.2) * -range).toFixed(1)}px`);
    }
  }
  function scheduleParallax() {
    if (reducedMotion.matches || parallaxFrame) return;
    parallaxFrame = requestAnimationFrame(paintParallax);
  }

  const traceObserver = typeof window.IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        traceObserver.unobserve(element);
        element.animate(
          [{ strokeDashoffset: `${element.dataset.fxLength}px` }, { strokeDashoffset: '0px' }],
          { duration: 1100, easing: ease, fill: 'forwards' }
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
    dropMarquee();
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

  function boot() {
    if (reducedMotion.matches) {
      resetEffects();
      return;
    }
    scheduleParallax();
    primeTraces();
    buildMarquee();
  }
  reducedMotion.addEventListener('change', boot);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
