'use strict';

// Native modal dialogs keep the page behind an enlarged document inert.
function prepareDocumentViewer(dialog, activeClass) {
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('#lightbox-caption');
  const closeButton = dialog.querySelector('#lightbox-close');
  let opener;
  let previousOverflow = '';
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', () => {
    dialog.classList.remove(activeClass);
    document.body.style.overflow = previousOverflow;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('keydown', event => {
    // The close button is the only interactive element in this document viewer.
    if (event.key === 'Tab') { event.preventDefault(); closeButton.focus(); }
  });
  return (trigger, src, description) => {
    opener = trigger;
    previousOverflow = document.body.style.overflow;
    image.src = src;
    image.alt = description;
    if (caption) caption.textContent = description;
    dialog.classList.add(activeClass);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    closeButton.focus();
  };
}

function bindDocumentTrigger(trigger, action) {
  if (!trigger) return;
  trigger.setAttribute('aria-haspopup', 'dialog');
  if (!trigger.matches('button, a[href]')) {
    trigger.tabIndex = 0;
    trigger.setAttribute('role', 'button');
    trigger.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        action();
      }
    });
  }
  trigger.addEventListener('click', action);
}
