'use strict';
document.querySelectorAll('[data-copy-code]').forEach(button => {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const code = document.getElementById(button.dataset.copyCode);
    const status = button.closest('.source-panel').querySelector('.source-copy-status');
    try {
      await navigator.clipboard.writeText(code.textContent);
      status.textContent = 'Code copied. Paste it into your editor.';
      button.textContent = 'Copied!';
      setTimeout(() => { button.textContent = 'Copy code'; }, 2000);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = 'Code selected. Press Ctrl+C (or Command+C), or use Download.';
    }
  });
});
