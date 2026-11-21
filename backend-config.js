/* Public service address only. Gemini credentials stay on the server. */
(() => {
  'use strict';
  window.AAKASH_BACKEND_BASE = location.hostname === 'aakash9972sn.github.io'
    ? 'https://ais-pre-wdyrf6yb4psuwizvqpn4hw-374223411049.asia-northeast1.run.app'
    : '';
})();
