'use strict';

// Real image links remain usable when JavaScript is unavailable.
const projectImages = [...document.querySelectorAll('[data-project-image]')];
const imageDialog = document.querySelector('#project-image-dialog');
if (imageDialog && projectImages.length) {
  const preview = imageDialog.querySelector('img');
  const caption = imageDialog.querySelector('figcaption');
  const counter = imageDialog.querySelector('.viewer-counter');
  const close = imageDialog.querySelector('[data-viewer-close]');
  const previous = imageDialog.querySelector('[data-viewer-previous]');
  const next = imageDialog.querySelector('[data-viewer-next]');
  let selected = 0;
  let opener;
  let oldOverflow = '';
  function show(index) {
    selected = (index + projectImages.length) % projectImages.length;
    const link = projectImages[selected];
    preview.src = link.href;
    preview.alt = link.querySelector('img').alt;
    caption.textContent = link.dataset.caption;
    counter.textContent = `${selected + 1} / ${projectImages.length}`;
  }
  projectImages.forEach((link, index) => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      oldOverflow = document.body.style.overflow;
      show(index);
      imageDialog.showModal();
      document.body.style.overflow = 'hidden';
      close.focus();
    });
  });
  close.addEventListener('click', () => imageDialog.close());
  previous.addEventListener('click', () => show(selected - 1));
  next.addEventListener('click', () => show(selected + 1));
  imageDialog.addEventListener('click', event => { if (event.target === imageDialog) imageDialog.close(); });
  imageDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(selected - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(selected + 1); }
    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === close) { event.preventDefault(); next.focus(); }
      else if (!event.shiftKey && document.activeElement === next) { event.preventDefault(); close.focus(); }
    }
  });
  imageDialog.addEventListener('close', () => {
    document.body.style.overflow = oldOverflow;
    opener?.focus({ preventScroll: true });
  });
}

// Load the correct document only when the reader is opened.
document.querySelectorAll('.report-reader').forEach(reader => {
  reader.addEventListener('toggle', () => {
    const frame = reader.querySelector('iframe');
    if (reader.open && !frame.hasAttribute('src')) frame.src = frame.dataset.src;
  });
});

const uidDemo = document.querySelector('#uid-demo');
if (uidDemo) {
  const registeredUID = [0x12, 0x34, 0x56, 0x78];
  const scenarios = { registered: registeredUID, unregistered: [0xA3, 0xB5, 0x72, 0x09], idle: null };
  const consolePanel = uidDemo.querySelector('.uid-console');
  const status = uidDemo.querySelector('[data-uid-status]');
  const output = uidDemo.querySelector('output');
  uidDemo.querySelectorAll('[data-uid-scenario]').forEach(button => {
    button.addEventListener('click', () => {
      uidDemo.querySelectorAll('[data-uid-scenario]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const uid = scenarios[button.dataset.uidScenario];
      if (!uid) {
        consolePanel.dataset.state = 'idle';
        status.textContent = 'Waiting for a card';
        output.textContent = 'No UID received.\nLEDs off · no buzzer indication.';
        return;
      }
      const matches = uid.length === registeredUID.length && uid.every((byte, index) => byte === registeredUID[index]);
      consolePanel.dataset.state = matches ? 'registered' : 'unregistered';
      status.textContent = matches ? 'Registered UID · green LED' : 'Unregistered UID · red LED';
      output.textContent = `UID: ${uid.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')}\n${matches ? 'All UID bytes match.' : 'UID read successfully; no registered match.'}\nBuzzer: short read acknowledgement.`;
    });
  });
}
