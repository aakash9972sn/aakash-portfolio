"use strict";
(() => {
  const $ = (selector) => document.querySelector(selector);
  const dialog = $("#delivery-dialog");
  if (!dialog) return;

  const ATTRIBUTION_ID = "gmp_mcp_codeassist_v1_aistudio";
  const DTU_HUB = { lat: 28.7501, lng: 77.1177 };
  const COVERAGE_RADIUS_M = 6000;
  const fieldIds = {
    address: "location-address",
    city: "location-city",
    state: "location-state",
    pincode: "delivery-pin",
  };

  let callbacks = {};
  let point = null;
  let boundArea = { city: "", state: "", pincode: "" };
  let lastSuggestedAddress = "";
  let selected = null;
  let sequence = 0;
  let controller = null;
  let quotaBannerShown = false;

  // Google Maps SDK state
  let loaderPromise = null;
  let map = null;
  let storeMarker = null;
  let deliveryMarker = null;
  let coverageCircle = null;
  let infoWindow = null;
  let geocoder = null;
  let autocompleteEl = null;
  let mapsAvailable = false;
  let leafletMap = null;
  let leafletPin = null;
  let leafletLoader = null;

  try {
    selected = JSON.parse(sessionStorage.getItem("blunder:delivery-location"));
  } catch {
    selected = null;
  }

  /* ------------------------------------------------ Quota Error Defense (Case A) */
  function showQuotaBanner() {
    if (quotaBannerShown) return;
    quotaBannerShown = true;
    const banner = $("#gmp-quota-banner");
    if (banner) banner.hidden = false;
  }

  window.addEventListener("gmp-quota-exceeded", showQuotaBanner);

  const prevAuthFailure = window.gm_authFailure;
  window.gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
    if (typeof prevAuthFailure === "function") prevAuthFailure();
  };

  if (!window.__blunderGmpConsoleTapped) {
    window.__blunderGmpConsoleTapped = true;
    const origConsoleError = console.error.bind(console);
    console.error = (...args) => {
      try {
        const joined = args.map((a) => (typeof a === "string" ? a : a?.message || "")).join(" ");
        if (/OverQuotaMapError|QuotaExceededError|OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED/i.test(joined)) {
          window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
        }
      } catch {}
      return origConsoleError(...args);
    };
  }

  /* ------------------------------------------------------------ Helpers */
  const validPoint = (p) =>
    Boolean(
      p &&
        Number.isFinite(Number(p.latitude)) &&
        Number.isFinite(Number(p.longitude)) &&
        Math.abs(Number(p.latitude)) <= 90 &&
        Math.abs(Number(p.longitude)) <= 180
    );

  const haversineKm = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  };

  const status = (text) => {
    const el = $("#location-status");
    if (el) el.textContent = text;
  };

  const busy = (isBusy) => {
    const btn = $("#location-search-button");
    const gps = $("#location-gps");
    if (btn) btn.disabled = isBusy;
    if (gps) gps.disabled = isBusy;
  };

  const googleSearchUrl = (query) =>
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(String(query || "Delhi Technological University, Delhi, India").slice(0, 180));

  const googleRouteUrl = (loc) =>
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(`${loc.latitude.toFixed(6)},${loc.longitude.toFixed(6)}`);

  function fields() {
    return Object.fromEntries(
      Object.entries(fieldIds).map(([name, id]) => [name, ($("#" + id)?.value || "").trim()])
    );
  }

  function cleanSelection(data) {
    if (!data) return null;
    const pincode = String(data.pincode || "").trim();
    const address = String(data.address || "").trim().slice(0, 220);
    const city = String(data.city || "").trim().slice(0, 80);
    const state = String(data.state || "").trim().slice(0, 80);
    if (!address && !city && !state && !pincode) return null;
    return {
      address,
      city,
      state,
      pincode: /^[1-9]\d{5}$/.test(pincode) ? pincode : "",
      point: validPoint(data.point)
        ? {
            latitude: Number(Number(data.point.latitude).toFixed(6)),
            longitude: Number(Number(data.point.longitude).toFixed(6)),
          }
        : null,
    };
  }

  function getSelection() {
    return cleanSelection(selected);
  }

  function mergeHouseDetails(existing, nextStreet, previousSuggestion = "") {
    const street = String(nextStreet || "").trim();
    let manual = String(existing || "").trim();
    const previous = String(previousSuggestion || "").trim();
    if (!street) return manual.slice(0, 220);
    if (!manual || manual.toLowerCase() === previous.toLowerCase()) return street.slice(0, 220);
    if (previous && manual.toLowerCase().endsWith(previous.toLowerCase())) {
      manual = manual.slice(0, manual.length - previous.length).replace(/[,\s]+$/, "");
    }
    const parts = manual.split(/\s*,\s*|\n/).map((x) => x.trim()).filter(Boolean);
    const first = parts[0] || "";
    const unitPattern =
      /^(?:flat\b|room\b|rm\b|hostel\b|h(?:ouse)?\.?\s*no\.?|house\b|plot\b|unit\b|apt\b|apartment\b|building\b|floor\b|door\b|suite\b|quarter\b|block\b|shop\b|[A-Z]{1,3}[-/ ]?\d{1,5}[A-Z]?\b|\d{1,5}[a-z]?(?:[/\-]\d{1,5})?(?:\s|$)|[^,]{1,60}\bhostel\b)/i;
    if (!unitPattern.test(first)) return street.slice(0, 220);
    const prefixParts = [first];
    for (const part of parts.slice(1, 3)) {
      if (!/\b(?:hostel|building|block|tower|wing|apartment|residency|society|complex|flat|room)\b/i.test(part)) break;
      prefixParts.push(part);
    }
    const prefix = prefixParts.join(", ");
    if (street.toLowerCase().includes(prefix.toLowerCase())) return street.slice(0, 220);
    const available = 220 - prefix.length - 2;
    if (available < 12) return prefix.slice(0, 220);
    return prefix + ", " + street.slice(0, available);
  }

  function setFields(value = {}, { preserveHouse = false } = {}) {
    const previousSuggestion = lastSuggestedAddress;
    const typed = $("#location-address")?.value || "";
    const suggested = String(value.address || "");
    boundArea = {
      city: value.city || "",
      state: value.state || "",
      pincode: value.pincode || "",
    };
    for (const [name, id] of Object.entries(fieldIds)) {
      const el = $("#" + id);
      if (!el) continue;
      if (name === "address" && preserveHouse) {
        el.value = mergeHouseDetails(typed, suggested, previousSuggestion);
      } else {
        el.value = value[name] || "";
      }
    }
    lastSuggestedAddress = suggested;
    const resEl = $("#delivery-result");
    if (resEl) resEl.textContent = "";
  }

  function showAvailability() {
    const pin = ($("#delivery-pin")?.value || "").trim();
    const resEl = $("#delivery-result");
    if (!resEl) return { valid: false, text: "" };
    if (!pin) {
      resEl.textContent = "";
      return { valid: false, text: "" };
    }
    const result = callbacks.checkAvailability
      ? callbacks.checkAvailability(pin)
      : { valid: /^[1-9]\d{5}$/.test(pin), text: "PIN checked." };
    resEl.textContent = result.text;
    resEl.dataset.available = String(result.available ?? result.valid);
    return result;
  }

  function updateCoordinatesUI(next) {
    point = validPoint(next)
      ? {
          latitude: Number(Number(next.latitude).toFixed(6)),
          longitude: Number(Number(next.longitude).toFixed(6)),
        }
      : null;

    const coordsEl = $("#location-coordinates");
    const routeEl = $("#location-route");
    const centreEl = $("#location-centre");

    if (coordsEl) {
      coordsEl.hidden = !point;
      if (point) {
        const distKm = haversineKm(DTU_HUB, { lat: point.latitude, lng: point.longitude });
        const zoneNote = distKm <= 6 ? "Within 6 km local delivery zone" : "Outside standard DTU 6 km radius";
        coordsEl.textContent = `Pinned (${distKm.toFixed(1)} km from DTU Hub · ${zoneNote}) · ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
      } else {
        coordsEl.textContent = "";
      }
    }
    if (routeEl) {
      routeEl.hidden = !point;
      if (point) routeEl.href = googleRouteUrl(point);
    }
    if (centreEl) {
      centreEl.href = point
        ? googleSearchUrl(`${point.latitude},${point.longitude}`)
        : googleSearchUrl("Delhi Technological University, Delhi, India");
    }
  }

  /* No-card Leaflet / OpenStreetMap fallback: real map and draggable pin. */
  async function ensureLeaflet() {
    const div=$("#delivery-map");
    if(!div)return;
    if(leafletMap){requestAnimationFrame(()=>leafletMap.invalidateSize());return}
    if(!leafletLoader){
      leafletLoader=new Promise((resolve,reject)=>{
        const link=document.createElement("link");
        link.rel="stylesheet";
        link.href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        const tag=document.createElement("script");
        tag.src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
        tag.onload=()=>window.L?resolve(window.L):reject(Error("Leaflet unavailable"));
        tag.onerror=()=>reject(Error("Free OpenStreetMap viewer could not load"));
        document.head.appendChild(tag);
      }).catch(e=>{leafletLoader=null;throw e});
    }
    const L=await leafletLoader;
    leafletMap=L.map(div,{zoomControl:true,scrollWheelZoom:false})
      .setView([point?.latitude??DTU_HUB.lat,point?.longitude??DTU_HUB.lng],point?16:13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    }).addTo(leafletMap);
    L.circle([DTU_HUB.lat,DTU_HUB.lng],{radius:COVERAGE_RADIUS_M,color:"#446b3b",fillOpacity:.055,weight:2})
      .addTo(leafletMap);
    L.marker([DTU_HUB.lat,DTU_HUB.lng]).addTo(leafletMap).bindPopup("DTU Store Hub — reference point only");
    leafletMap.on("click",event=>choosePoint({latitude:event.latlng.lat,longitude:event.latlng.lng}));
    if(point)placeDeliveryMarker(point,"Delivery pin","",false);
    $("#map-unavailable")?.setAttribute("hidden","");
    const privacy=$(".map-privacy");
    if(privacy)privacy.textContent="Free OpenStreetMap tiles + Leaflet map and Nominatim address search. © OpenStreetMap contributors. Your GPS is requested only when you choose Use my location. Delivery availability is not guaranteed.";
    status("Free OpenStreetMap mode. Tap map to place a delivery pin, or search for a nearby address.");
    requestAnimationFrame(()=>leafletMap.invalidateSize());
  }

  /* ---------------------------------------------------- Google Maps SDK */
  function loadGoogleMapsBootstrap(apiKey) {
    if (window.google?.maps?.importLibrary) return Promise.resolve();
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise((resolve, reject) => {
      try {
        ((g) => {
          var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
          b = b[c] || (b[c] = {});
          var d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams();
          var u = () => h || (h = new Promise(async (f, n) => {
            await (a = m.createElement("script"));
            e.set("libraries", [...r] + "");
            for (k in g) e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[k]);
            e.set("callback", c + ".maps." + q);
            a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
            d[q] = f;
            a.onerror = () => (h = n(new Error(p + " could not load.")));
            a.nonce = m.querySelector("script[nonce]")?.nonce || "";
            m.head.append(a);
          }));
          d[l] ? resolve() : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
        })({
          key: apiKey,
          v: "weekly",
          language: "en",
          region: "IN",
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    return loaderPromise;
  }

  function buildAddressFromComponents(components = [], fallbackFormatted = "") {
    const get = (type) => {
      const found = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
      return found ? String(found.longText || found.long_name || "") : "";
    };
    const subpremise = get("subpremise");
    const streetNumber = get("street_number");
    const route = get("route");
    const sublocality2 = get("sublocality_level_2") || get("neighborhood");
    const sublocality1 = get("sublocality_level_1");
    const locality = get("locality") || get("administrative_area_level_2") || "New Delhi";
    const state = get("administrative_area_level_1") || "Delhi";
    const postal = (get("postal_code").match(/\b[1-9]\d{5}\b/) || [])[0] || "";
    const line = [subpremise, streetNumber, route, sublocality2, sublocality1].filter(Boolean).join(", ");
    return {
      address: (line || fallbackFormatted.split(",").slice(0, 2).join(", ")).trim().slice(0, 220),
      city: locality.slice(0, 80),
      state: state.slice(0, 80),
      pincode: postal,
    };
  }

  function showMarkerPopup(position, titleText, subText) {
    if (!map || !infoWindow || !deliveryMarker) return;
    const box = document.createElement("div");
    box.style.cssText = "font:600 12px/1.45 'Manrope',system-ui,sans-serif;color:#1b281e;max-width:220px;";
    const titleEl = document.createElement("div");
    titleEl.textContent = titleText;
    box.appendChild(titleEl);
    if (subText) {
      const subEl = document.createElement("div");
      subEl.style.cssText = "font-weight:500;font-size:11px;color:#4f6244;margin-top:3px;";
      subEl.textContent = subText;
      box.appendChild(subEl);
    }
    infoWindow.setContent(box);
    infoWindow.open({ map, anchor: deliveryMarker, shouldFocus: false });
  }

  function placeDeliveryMarker(coords, labelText = "Delivery pin", subText = "", zoomTo = false) {
    const pos = { lat: Number(coords.latitude ?? coords.lat), lng: Number(coords.longitude ?? coords.lng) };
    if (leafletMap && window.L) {
      if (!leafletPin) {
        leafletPin = L.marker([pos.lat,pos.lng],{draggable:true}).addTo(leafletMap);
        leafletPin.on('dragend',()=>{const p=leafletPin.getLatLng();choosePoint({latitude:p.lat,longitude:p.lng})});
      }
      leafletPin.setLatLng([pos.lat,pos.lng]).bindPopup(labelText).openPopup();
      if (zoomTo) leafletMap.setView([pos.lat,pos.lng],16);
      return;
    }
    if (!map || !deliveryMarker) return;
    deliveryMarker.position = pos;
    deliveryMarker.map = map;
    map.panTo(pos);
    if (zoomTo && (map.getZoom() || 14) < 16) map.setZoom(16);
    const distKm = haversineKm(DTU_HUB, pos).toFixed(1);
    showMarkerPopup(pos, labelText, subText || `${distKm} km from DTU Store Hub`);
  }

  async function ensureMap() {
    const mapDiv = $("#delivery-map");
    const unavailableEl = $("#map-unavailable");
    if (!mapDiv) return;
    if (leafletMap) {
      mapsAvailable = true;
      if(unavailableEl)unavailableEl.hidden=true;
      requestAnimationFrame(()=>leafletMap.invalidateSize());
      return;
    }
    if (map) {
      mapsAvailable = true;
      if (unavailableEl) unavailableEl.hidden = true;
      return;
    }

    try {
      const origin = String(window.BLUNDER_API_ORIGIN || "").replace(/\/+$/, "");
      const res = await fetch(`${origin}/api/maps/config`, { cache: "no-store" });
      if (res.status === 429) {
        window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
        throw new Error("Quota exceeded");
      }
      const cfg = await res.json();
      if (!cfg?.configured || !cfg?.apiKey) {
        mapsAvailable = false;
        await ensureLeaflet();
        return;
      }

      await loadGoogleMapsBootstrap(cfg.apiKey);

      const [{ Map, Circle, InfoWindow }, { AdvancedMarkerElement, PinElement }, { Geocoder }, { PlaceAutocompleteElement }] =
        await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("marker"),
          google.maps.importLibrary("geocoding"),
          google.maps.importLibrary("places"),
        ]);

      map = new Map(mapDiv, {
        center: point ? { lat: point.latitude, lng: point.longitude } : DTU_HUB,
        zoom: point ? 16 : 13,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        internalUsageAttributionIds: [ATTRIBUTION_ID],
      });

      coverageCircle = new Circle({
        map,
        center: DTU_HUB,
        radius: COVERAGE_RADIUS_M,
        clickable: false,
        strokeColor: "#263d2b",
        strokeOpacity: 0.72,
        strokeWeight: 1.5,
        fillColor: "#698148",
        fillOpacity: 0.12,
      });

      const storePin = new PinElement({
        background: "#1c2b1f",
        borderColor: "#facc15",
        glyphColor: "#facc15",
        glyphText: "D",
        scale: 0.9,
      });
      storeMarker = new AdvancedMarkerElement({
        map,
        position: DTU_HUB,
        title: "Blunder Hub · DTU Delhi",
        content: storePin,
      });
      storeMarker.addListener("click", () => {
        showMarkerPopup(DTU_HUB, "Blunder DTU Store Hub", "6 km local delivery coverage zone");
      });

      const userPin = new PinElement({
        background: "#d94e28",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        glyphText: "B",
      });
      deliveryMarker = new AdvancedMarkerElement({
        map: point ? map : null,
        position: point ? { lat: point.latitude, lng: point.longitude } : DTU_HUB,
        gmpDraggable: true,
        title: "Selected delivery point",
        content: userPin,
      });

      infoWindow = new InfoWindow({ disableAutoPan: true });
      geocoder = new Geocoder();

      map.addListener("click", (event) => {
        if (!event.latLng) return;
        choosePoint({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      });

      deliveryMarker.addListener("dragend", (event) => {
        const pos = event.latLng || deliveryMarker.position;
        if (!pos) return;
        const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;
        choosePoint({ latitude: lat, longitude: lng });
      });

      const placesHost = $("#google-places-host");
      if (placesHost && !autocompleteEl) {
        autocompleteEl = new PlaceAutocompleteElement({
          includedRegionCodes: ["in"],
          locationBias: { center: DTU_HUB, radius: 15000 },
        });
        autocompleteEl.setAttribute("internal-usage-attribution-ids", ATTRIBUTION_ID);
        autocompleteEl.setAttribute("placeholder", "Live Google Places search (area, sector, DTU gate…)");
        placesHost.replaceChildren(autocompleteEl);

        autocompleteEl.addEventListener("gmp-select", async ({ placePrediction }) => {
          if (!placePrediction) return;
          busy(true);
          status("Fetching selected place details…");
          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: ["displayName", "formattedAddress", "location", "viewport", "addressComponents"],
            });
            if (!place.location) {
              status("Selected place has no map coordinates. Click the map to drop your pin.");
              return;
            }
            const nextPoint = { latitude: place.location.lat(), longitude: place.location.lng() };
            updateCoordinatesUI(nextPoint);
            if (place.viewport) {
              map.fitBounds(place.viewport);
            } else {
              map.setCenter({ lat: nextPoint.latitude, lng: nextPoint.longitude });
              map.setZoom(16);
            }
            placeDeliveryMarker(
              nextPoint,
              place.displayName || "Selected address",
              place.formattedAddress || "",
              !place.viewport
            );
            const parsed = buildAddressFromComponents(place.addressComponents || [], place.formattedAddress || "");
            if (!parsed.address && place.displayName) parsed.address = String(place.displayName).slice(0, 220);
            setFields(parsed, { preserveHouse: true });
            showAvailability();
            status("Location pinned from Google Places. Confirm your house or hostel details below.");
          } catch (err) {
            const msg = String(err?.message || err || "");
            if (/429|QUOTA|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT/i.test(msg)) {
              window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
            }
            status("Could not load selected place details. Try searching below or clicking the map.");
          } finally {
            busy(false);
          }
        });
      }

      mapsAvailable = true;
      if (unavailableEl) unavailableEl.hidden = true;
    } catch (error) {
      mapsAvailable = false;
      if (unavailableEl) unavailableEl.hidden = false;
      const msg = String(error?.message || error || "");
      if (/429|QUOTA|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT/i.test(msg)) {
        window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
      }
      try{await ensureLeaflet()}
      catch {status("Map tiles are unavailable. You can still search and enter your delivery address manually.");}
    }
  }

  /* --------------------------------------------------- Geocoding Actions */
  function cancelPending() {
    sequence++;
    controller?.abort();
    controller = null;
    busy(false);
  }

  function beginRequest() {
    cancelPending();
    controller = new AbortController();
    return {
      id: sequence,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(14000)]),
    };
  }

  async function serverRequest(kind, payload, signal) {
    if (callbacks.request) {
      return callbacks.request(kind, payload, signal);
    }
    const origin = String(window.BLUNDER_API_ORIGIN || "").replace(/\/+$/, "");
    const provider = !geocoder ? 'osm' : 'maps';
    const res = await fetch(`${origin}/api/${provider}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 || data?.status === "RESOURCE_EXHAUSTED" || data?.status === "OVER_QUERY_LIMIT") {
      window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
      throw new Error("Google Maps quota reached. Please enter your address manually.");
    }
    if (!res.ok) throw new Error(data?.error || "Address lookup failed.");
    return data;
  }

  async function choosePoint(next) {
    if (!validPoint(next) || !dialog.open) return;
    const operation = beginRequest();
    updateCoordinatesUI(next);
    placeDeliveryMarker(next, "Delivery pin", "Finding nearest street address…", true);
    if ($("#delivery-result")) $("#delivery-result").textContent = "";
    if ($("#location-results")) $("#location-results").hidden = true;
    status("Finding street address for your pinned location…");
    busy(true);

    try {
      let parsed = null;
      if (geocoder) {
        try {
          const { results } = await geocoder.geocode({
            location: { lat: next.latitude, lng: next.longitude },
          });
          if (results?.[0]) {
            parsed = buildAddressFromComponents(
              results[0].address_components || [],
              results[0].formatted_address || ""
            );
            placeDeliveryMarker(next, "Selected delivery point", results[0].formatted_address || "", false);
          }
        } catch (geoErr) {
          const msg = String(geoErr?.message || geoErr || "");
          if (/OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|429/i.test(msg)) {
            window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
          }
        }
      }

      if (!parsed) {
        const srv = await serverRequest("reverse", next, operation.signal);
        if (srv?.result) {
          parsed = {
            address: srv.result.addressLine || "",
            city: srv.result.city || "",
            state: srv.result.state || "",
            pincode: srv.result.pincode || "",
          };
          placeDeliveryMarker(next, "Selected delivery point", srv.result.formattedAddress || "", false);
        }
      }

      if (operation.id !== sequence || !dialog.open) return;
      if (parsed) {
        setFields(parsed, { preserveHouse: true });
        status(
          parsed.pincode
            ? "Pin updated. Confirm house / flat / hostel details below."
            : "Pin updated. Please verify your 6-digit PIN code below."
        );
      } else {
        status("Pin dropped. Could not resolve full street details; type your address manually below.");
      }
    } catch (error) {
      if (operation.id === sequence && dialog.open && error.name !== "AbortError") {
        status("Pin dropped. Address lookup unavailable right now — confirm your address & PIN manually.");
      }
    } finally {
      if (operation.id === sequence) {
        busy(false);
        if ($("#delivery-pin")?.value) showAvailability();
      }
    }
  }

  async function search(event) {
    event?.preventDefault?.();
    const query = ($("#location-search")?.value || "").trim();
    if (query.length < 3) return;
    const operation = beginRequest();
    busy(true);
    const resultsEl = $("#location-results");
    if (resultsEl) {
      resultsEl.replaceChildren();
      resultsEl.hidden = true;
    }
    status("Searching matching addresses…");

    try {
      let matches = [];
      if (geocoder) {
        try {
          const { results } = await geocoder.geocode({
            address: query,
            region: "IN",
            componentRestrictions: { country: "IN" },
          });
          if (Array.isArray(results)) {
            matches = results.slice(0, 5).map((item) => {
              const loc = item.geometry?.location;
              const lat = typeof loc?.lat === "function" ? loc.lat() : Number(loc?.lat);
              const lng = typeof loc?.lng === "function" ? loc.lng() : Number(loc?.lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              const parsed = buildAddressFromComponents(
                item.address_components || [],
                item.formatted_address || ""
              );
              return {
                lat,
                lng,
                formattedAddress: String(item.formatted_address || ""),
                addressLine: parsed.address,
                city: parsed.city,
                state: parsed.state,
                pincode: parsed.pincode,
              };
            }).filter(Boolean);
          }
        } catch (geoErr) {
          const msg = String(geoErr?.message || geoErr || "");
          if (/OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|429/i.test(msg)) {
            window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
          }
        }
      }

      if (!matches.length) {
        const response = await serverRequest("search", { query }, operation.signal);
        matches = Array.isArray(response?.results) ? response.results.slice(0, 5) : [];
      }

      if (operation.id !== sequence || !dialog.open) return;
      if (!matches.length) {
        status("No matching areas found. Try a nearby Delhi landmark or type your address manually.");
        return;
      }
      if (matches.length === 1) {
        const only = matches[0];
        const pt = { latitude: only.lat, longitude: only.lng };
        updateCoordinatesUI(pt);
        placeDeliveryMarker(pt, only.addressLine || "Delivery point", only.formattedAddress || "", true);
        setFields(
          {
            address: only.addressLine,
            city: only.city,
            state: only.state,
            pincode: only.pincode,
          },
          { preserveHouse: true }
        );
        if (only.pincode) showAvailability();
        status("Location found and pinned. Confirm your house / hostel number below.");
        return;
      }

      for (const match of matches) {
        const li = document.createElement("li");
        const button = document.createElement("button");
        const label = document.createElement("span");
        const strong = document.createElement("b");
        const small = document.createElement("small");
        button.type = "button";
        strong.textContent = match.addressLine || match.city || "Selected area";
        small.textContent = match.formattedAddress || "";
        label.append(strong, small);
        button.append(label);
        li.append(button);
        resultsEl.append(li);
        button.addEventListener("click", () => {
          cancelPending();
          const pt = { latitude: match.lat, longitude: match.lng };
          updateCoordinatesUI(pt);
          placeDeliveryMarker(pt, match.addressLine || "Delivery point", match.formattedAddress || "", true);
          setFields(
            {
              address: match.addressLine,
              city: match.city,
              state: match.state,
              pincode: match.pincode,
            },
            { preserveHouse: true }
          );
          resultsEl.hidden = true;
          if (match.pincode) showAvailability();
          status("Area pinned. Confirm your house / flat number below.");
          $("#location-address")?.focus({ preventScroll: true });
        });
      }
      resultsEl.hidden = false;
      status(`${matches.length} matching areas found. Select one to pin it on the map.`);
    } catch (error) {
      if (operation.id === sequence && dialog.open) {
        status(error.message || "Search failed. Please enter your address manually.");
      }
    } finally {
      if (operation.id === sequence) busy(false);
    }
  }

  function locate() {
    if (!navigator.geolocation || !window.isSecureContext) {
      status("GPS requires a secure HTTPS connection. Search above or click directly on the map.");
      return;
    }
    cancelPending();
    const id = sequence;
    busy(true);
    status("Requesting your current location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id !== sequence || !dialog.open) return;
        busy(false);
        choosePoint({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        if (id !== sequence || !dialog.open) return;
        busy(false);
        status(
          error.code === 1
            ? "Location access denied. Search above or tap anywhere on the map."
            : "Could not read your GPS position. Search above or click the map."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  async function open(seed) {
    cancelPending();
    const initial = seed || selected || { pincode: callbacks.readPin?.() || "" };
    setFields(initial);
    if ($("#location-search")) $("#location-search").value = "";
    if ($("#location-results")) $("#location-results").hidden = true;
    status("Search a place, tap the map to pin a location, or use GPS.");
    updateCoordinatesUI(initial.point || null);
    await ensureMap();
    if (map && initial.point) {
      placeDeliveryMarker(initial.point, "Saved delivery point", "", true);
    } else if (map) {
      map.setCenter(DTU_HUB);
      map.setZoom(13);
    } else if (leafletMap) {
      leafletMap.invalidateSize();
      if(initial.point)placeDeliveryMarker(initial.point,"Saved delivery point","",true);
      else leafletMap.setView([DTU_HUB.lat,DTU_HUB.lng],13);
    }
    if (initial.pincode) showAvailability();
  }

  function confirm(event) {
    event.preventDefault();
    if (!$("#delivery-form")?.reportValidity()) return;
    showAvailability();
    selected = cleanSelection({ ...fields(), point });
    if (!selected) return;
    try {
      sessionStorage.setItem("blunder:delivery-location", JSON.stringify(selected));
    } catch {}
    callbacks.onSelect?.(getSelection(), "confirm");
  }

  function clear() {
    cancelPending();
    selected = null;
    updateCoordinatesUI(null);
    setFields();
    if (deliveryMarker) deliveryMarker.map = null;
    if (leafletPin) {leafletMap?.removeLayer(leafletPin);leafletPin=null;}
    if (infoWindow) infoWindow.close();
    if (map) {
      map.setCenter(DTU_HUB);
      map.setZoom(13);
    }
    if (leafletMap) leafletMap.setView([DTU_HUB.lat,DTU_HUB.lng],13);
    try {
      sessionStorage.removeItem("blunder:delivery-location");
    } catch {}
    status("Location cleared. Search an area or tap anywhere on the map.");
    callbacks.onSelect?.(null, "clear");
  }

  $("#location-search-form")?.addEventListener("submit", search);
  $("#delivery-form")?.addEventListener("submit", confirm);
  $("#location-gps")?.addEventListener("click", locate);
  document.querySelectorAll("[data-location-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      await ensureMap();
      const query = button.dataset.locationPreset;
      if ($("#location-search")) $("#location-search").value = query;
      search({ preventDefault() {} });
    });
  });
  $("#location-check-pin")?.addEventListener("click", showAvailability);
  $("#location-clear")?.addEventListener("click", clear);

  for (const [name, id] of Object.entries(fieldIds)) {
    $("#" + id)?.addEventListener("input", () => {
      cancelPending();
      if (
        name !== "address" &&
        point &&
        boundArea[name] &&
        $("#" + id).value.trim().toLowerCase() !== boundArea[name].trim().toLowerCase()
      ) {
        updateCoordinatesUI(null);
        if (deliveryMarker) deliveryMarker.map = null;
        status("Delivery area changed. Tap the map to update your pin or continue with manual entry.");
      }
      if ($("#delivery-result")) $("#delivery-result").textContent = "";
    });
  }

  dialog.addEventListener("close", cancelPending);

  window.BlunderLocation = {
    configure: (options) => {
      callbacks = options;
    },
    open,
    getSelection,
    mergeHouseDetails,
  };
})();
