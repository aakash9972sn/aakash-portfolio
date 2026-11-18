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
    '.download-card', '.certificate-grand-card'
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
  document.querySelectorAll('.portrait-card, .hero-visual').forEach(element => element.classList.add('motion-depth'));
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
