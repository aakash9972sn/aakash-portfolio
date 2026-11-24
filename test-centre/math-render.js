/* MathJax-based textbook equation rendering for Test Centre content.
   Never interprets arbitrary HTML: maths is read from escaped text nodes. */
(function () {
  'use strict';
  const hasMath = value => /\\\(|\\\[|\$\$|(^|[^\w\\])\$(?=\S)/.test(String(value || ''));
  let queued = new Set(), scheduled = false, inProgress = false;
  function enqueue(node) {
    if (!node || !node.isConnected || !window.MathJax?.typesetPromise) return;
    queued.add(node);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  }
  async function flush() {
    scheduled = false;
    if (inProgress || !queued.size) return;
    inProgress = true;
    // MathJax must see a subtree once when both the runner and the observer queue it.
    const nodes = [...queued].filter(node => {
      if (!node.isConnected) return false;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (queued.has(parent)) return false;
      }
      return true;
    });
    queued.clear();
    try {
      await window.MathJax.typesetPromise(nodes);
    } catch (error) {
      console.warn('Equation rendering skipped:', error);
    } finally {
      inProgress = false;
      if (queued.size && !scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    }
  }
  function scan(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!hasMath(node.nodeValue)) return;
      const parent = node.parentElement;
      if (!parent || parent.closest('mjx-container,script,style,textarea,pre,code')) return;
      enqueue(parent);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches('mjx-container,script,style,textarea,pre,code')) return;
      if (node.childNodes.length < 70) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let textNode, count = 0;
        while ((textNode = walker.nextNode()) && count++ < 350) scan(textNode);
      } else if (hasMath(node.textContent)) {
        enqueue(node);
      }
    }
  }
  window.TestCentreMath = Object.freeze({
    render: (node) => enqueue(node),
    renderShadow: (node) => enqueue(node),
    enabled: () => Boolean(window.MathJax?.typesetPromise)
  });
  function observe() {
    const root = document.querySelector('#screen-home')?.parentElement || document.body;
    const observer = new MutationObserver(changes => {
      for (const change of changes) {
        if (change.type === 'characterData') scan(change.target);
        for (const node of change.addedNodes) scan(node);
      }
    });
    observer.observe(root, {subtree:true, childList:true, characterData:true});
    scan(root);
  }
  window.addEventListener('testcentre:math-ready', () => scan(document.body));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe, {once:true});
  } else observe();
})();
