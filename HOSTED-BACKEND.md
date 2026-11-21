# Backend configuration

The uploaded AI Studio app includes a Gemini Node server. On GitHub Pages, `backend-config.js` points to the hosted Cloud Run service supplied by the owner. Local and Node deployments use their own same-origin routes. See [DEPLOYMENT.md](DEPLOYMENT.md). No Gemini keys belong in browser JavaScript.
