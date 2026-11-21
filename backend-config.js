/* Public backend address only. Do not put GEMINI_API_KEY here. */
window.AAKASH_BACKEND_ORIGIN = window.AAKASH_BACKEND_ORIGIN ||
  (/(^|\.)github\.io$/i.test(location.hostname) ? "https://aakash-portfolio-g3fb.onrender.com" : ""); // Public backend origin; no secret.
(() => {
  "use strict";
  function origin() {
    const configured = String(window.AAKASH_BACKEND_ORIGIN || "").trim();
    if (!configured) {
      if (/(^|\.)github\.io$/i.test(location.hostname)) {
        throw new Error(
          "This portfolio is hosted on GitHub Pages, which cannot run Gemini server.js. " +
          "Deploy the Node backend, then set AAKASH_BACKEND_ORIGIN in backend-config.js. " +
          "Projects and practice tests remain available without AI."
        );
      }
      return location.origin;
    }
    let url;
    try { url = new URL(configured); }
    catch { throw new Error("Invalid backend URL. Use the public HTTPS origin of your Node deployment."); }
    if (url.protocol !== "https:" &&
        !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      throw new Error("The Gemini backend must use HTTPS (except localhost). Do not include a secret.");
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password)
      throw new Error("Backend URL must contain only the origin, not /api, a path, or credentials.");
    return url.origin;
  }
  window.AakashBackend = Object.freeze({
    origin,
    url(path) { return new URL(path, origin()).href; },
    configured() { try { origin(); return true; } catch { return false; } },
  });
})();
