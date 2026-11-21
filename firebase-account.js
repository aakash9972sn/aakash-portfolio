/* Firebase Account, Google Profile Fetch, Custom Avatar Upload & Firestore Sync */
(() => {
  'use strict';

  const OperationType = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  };

  let auth;
  let db;
  let fs;
  let au;
  let initPromise;
  let configCache;
  let currentProfile = {
    displayName: '',
    photoURL: '',
    photoDataUrl: '',
    bestGuessScore: null,
  };

  const assetBase = new URL('.', document.currentScript?.src || location.href);
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('firebase-account.css?v=20261120-account2', assetBase).href;
  document.head.append(sheet);

  const SVG = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    caret: '<svg class="account-launcher-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    googleG: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.09.73-2.48 1.16-4.22 1.16-3.25 0-6-2.19-6.98-5.14H1.01v3.14C3.05 21.2 7.24 24 12 24Z"/><path fill="#FBBC05" d="M5.02 14.01c-.25-.73-.39-1.52-.39-2.34s.14-1.61.39-2.34V6.19H1.01A11.99 11.99 0 0 0 0 11.67c0 1.93.46 3.76 1.01 5.48l4.01-3.14Z"/><path fill="#EA4335" d="M12 4.75c1.79 0 3.4.62 4.67 1.82l3.5-3.5C18.07 1.19 15.3 0 12 0 7.24 0 3.05 2.8 1.01 6.86l4.01 3.14C6 6.94 8.75 4.75 12 4.75Z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  };

  /* Header Account Button */
  const launch = document.createElement('button');
  launch.className = 'account-launcher';
  launch.type = 'button';
  launch.dataset.signedIn = 'false';
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-label', 'Account and cloud sync');

  const launchAvatar = document.createElement('span');
  launchAvatar.className = 'account-launcher-avatar';
  launchAvatar.innerHTML = SVG.user;

  const launchLabel = document.createElement('span');
  launchLabel.className = 'account-launcher-label';
  launchLabel.textContent = 'Sign in';

  launch.append(launchAvatar, launchLabel);
  launch.insertAdjacentHTML('beforeend', SVG.caret);

  /* Dialog Modal */
  const bar = document.createElement('dialog');
  bar.className = 'account-panel';
  bar.setAttribute('aria-labelledby', 'cloud-account-title');

  const head = document.createElement('div');
  head.className = 'account-panel-head';

  const titleGroup = document.createElement('div');
  const eyebrow = document.createElement('span');
  eyebrow.className = 'account-eyebrow';
  eyebrow.textContent = 'PORTFOLIO ACCOUNT · CLOUD SYNC';

  const heading = document.createElement('h2');
  heading.id = 'cloud-account-title';
  heading.textContent = 'Sign in to your account';
  titleGroup.append(eyebrow, heading);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'account-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close account dialog');
  close.onclick = () => bar.close();

  head.append(titleGroup, close);

  /* Signed-out section */
  const signedOutView = document.createElement('div');
  const welcomeCard = document.createElement('div');
  welcomeCard.className = 'account-welcome-card';

  const intro = document.createElement('p');
  intro.className = 'account-intro';
  intro.textContent = 'Sign in with Google to sync your profile, bookmarks, and activity across sessions.';

  const perks = document.createElement('ul');
  perks.className = 'account-perks';
  perks.innerHTML = `
    <li>${SVG.check}<span>Sync your name &amp; profile photo or upload a custom photo</span></li>
    <li>${SVG.check}<span>Bookmark project case studies &amp; workshop pages</span></li>
    <li>${SVG.check}<span>Keep quiz scores &amp; activity synced to the cloud</span></li>
  `;
  welcomeCard.append(intro, perks);

  const login = document.createElement('button');
  login.type = 'button';
  login.className = 'account-google-btn';
  const loginText = document.createElement('span');
  loginText.textContent = 'Continue with Google';
  login.innerHTML = SVG.googleG;
  login.append(loginText);

  signedOutView.append(welcomeCard, login);

  /* Signed-in section */
  const signedInView = document.createElement('div');
  signedInView.hidden = true;

  const profileCard = document.createElement('div');
  profileCard.className = 'account-profile-card';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'account-avatar-wrap';

  const avatarRing = document.createElement('div');
  avatarRing.className = 'account-avatar-ring';
  avatarRing.textContent = 'A';

  const camBtn = document.createElement('button');
  camBtn.type = 'button';
  camBtn.className = 'account-avatar-cam';
  camBtn.title = 'Upload custom photo';
  camBtn.setAttribute('aria-label', 'Upload custom profile photo');
  camBtn.innerHTML = SVG.camera;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp';
  fileInput.hidden = true;

  avatarWrap.append(avatarRing, camBtn, fileInput);

  const profileMeta = document.createElement('div');
  profileMeta.className = 'account-profile-meta';

  const profileName = document.createElement('p');
  profileName.className = 'account-profile-name';
  profileName.textContent = 'Account';

  const profileEmail = document.createElement('p');
  profileEmail.className = 'account-profile-email';
  profileEmail.textContent = '';

  const photoActions = document.createElement('div');
  photoActions.className = 'account-photo-actions';

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'account-chip-btn';
  uploadBtn.textContent = 'Upload photo';

  const resetPhotoBtn = document.createElement('button');
  resetPhotoBtn.type = 'button';
  resetPhotoBtn.className = 'account-chip-btn';
  resetPhotoBtn.textContent = 'Use Google photo';
  resetPhotoBtn.hidden = true;

  photoActions.append(uploadBtn, resetPhotoBtn);
  profileMeta.append(profileName, profileEmail, photoActions);
  profileCard.append(avatarWrap, profileMeta);

  const nameForm = document.createElement('form');
  nameForm.className = 'account-name-form';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'account-name-input';
  nameInput.maxLength = 120;
  nameInput.placeholder = 'Your display name';
  nameInput.setAttribute('aria-label', 'Display name');
  const saveNameBtn = document.createElement('button');
  saveNameBtn.type = 'submit';
  saveNameBtn.className = 'account-name-save';
  saveNameBtn.textContent = 'Save name';
  nameForm.append(nameInput, saveNameBtn);

  const actionsGrid = document.createElement('div');
  actionsGrid.className = 'account-actions-grid';

  const bookmark = document.createElement('button');
  bookmark.type = 'button';
  bookmark.className = 'account-action-btn';
  bookmark.innerHTML = `${SVG.bookmark}<strong>Bookmark page</strong><span>Save this page to cloud</span>`;

  const saved = document.createElement('button');
  saved.type = 'button';
  saved.className = 'account-action-btn';
  saved.innerHTML = `${SVG.folder}<strong>My saved data</strong><span>Bookmarks &amp; history</span>`;

  const myResultsBtn = document.createElement('button');
  myResultsBtn.type = 'button';
  myResultsBtn.className = 'account-action-btn';
  myResultsBtn.innerHTML = `${SVG.folder}<strong>My Results</strong><span>All tests · weak &amp; strong topics</span>`;
  actionsGrid.append(bookmark, saved, myResultsBtn);

  const signOutBtn = document.createElement('button');
  signOutBtn.type = 'button';
  signOutBtn.className = 'account-signout-btn';
  signOutBtn.textContent = 'Sign out';

  signedInView.append(profileCard, nameForm, actionsGrid, signOutBtn);

  const status = document.createElement('span');
  status.className = 'account-status-bar';
  status.setAttribute('role', 'status');

  bar.append(head, signedOutView, signedInView, status);
  document.body.append(bar);

  /* Mount launcher cleanly inside header action bar */
  const headerActionsTarget = document.querySelector('.top-links, .header-actions');
  const homeHeader = document.querySelector('.site-home .header');
  const subHeader = document.querySelector('.report-header, .case-header');
  if (headerActionsTarget) {
    headerActionsTarget.append(launch);
  } else if (homeHeader) {
    const utils = document.createElement('div');
    utils.className = 'header-actions';
    const githubLink = homeHeader.querySelector('.github-nav');
    utils.append(launch);
    if (githubLink) {
      homeHeader.insertBefore(utils, githubLink);
      utils.append(githubLink);
    } else {
      homeHeader.append(utils);
    }
  } else if (subHeader) {
    const utils = document.createElement('div');
    utils.className = 'header-actions';
    const rightLink = subHeader.querySelector('.github-nav, .back-link');
    utils.append(launch);
    if (rightLink) {
      subHeader.insertBefore(utils, rightLink);
      utils.append(rightLink);
    } else {
      subHeader.append(utils);
    }
  } else {
    const navTarget = document.querySelector('#main-navigation');
    if (navTarget) {
      navTarget.append(launch);
    } else {
      const row = document.createElement('div');
      row.className = 'account-fallback';
      row.append(launch);
      document.body.prepend(row);
    }
  }

  launch.onclick = () => {
    bar.showModal();
    prepareSignIn();
  };
  bar.addEventListener('close', () => launch.focus());

  const message = (s) => {
    status.textContent = s;
  };

  function sanitizeId(raw) {
    const cleaned = String(raw || 'item')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 128);
    return cleaned || 'home';
  }

  function handleFirestoreError(error, operationType, path) {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth?.currentUser?.uid ?? null,
        email: auth?.currentUser?.email ?? null,
        emailVerified: auth?.currentUser?.emailVerified ?? null,
        isAnonymous: auth?.currentUser?.isAnonymous ?? null,
        tenantId: auth?.currentUser?.tenantId ?? null,
        providerInfo:
          auth?.currentUser?.providerData?.map((provider) => ({
            providerId: provider.providerId,
            email: provider.email,
          })) || [],
      },
      operationType,
      path,
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  async function loadConfig() {
    if (configCache) return configCache;
    const urls = [new URL('firebase-applet-config.json', assetBase).href, '/firebase-applet-config.json'];
    for (const url of urls) {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        const ct = (response.headers.get('content-type') || '').toLowerCase();
        if (!response.ok || ct.includes('text/html')) continue;
        const text = await response.text();
        if (!text || text.trim().startsWith('<')) continue;
        configCache = JSON.parse(text);
        return configCache;
      } catch {}
    }
    throw new Error('Could not load firebase-applet-config.json');
  }

  async function testConnection() {
    try {
      await fs.getDocFromServer(fs.doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
    }
  }

  function extractGoogleIdentity(user) {
    if (!user) return { name: '', photo: '', email: '' };
    const providerMatch = Array.isArray(user.providerData) ? user.providerData : [];
    const nameFromProvider = providerMatch.find((p) => p?.displayName)?.displayName || '';
    const photoFromProvider = providerMatch.find((p) => p?.photoURL)?.photoURL || '';
    const emailFromProvider = providerMatch.find((p) => p?.email)?.email || '';
    const email = String(user.email || emailFromProvider || '').trim();
    const fallbackName = email ? email.split('@')[0] : 'Account';
    const name = String(user.displayName || nameFromProvider || fallbackName)
      .trim()
      .slice(0, 120);
    const photo = String(user.photoURL || photoFromProvider || '')
      .trim()
      .slice(0, 1000);
    return { name, photo, email };
  }

  function setAvatarContent(container, src, initials) {
    container.replaceChildren();
    if (src) {
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.src = src;
      img.onerror = () => {
        container.textContent = initials;
      };
      container.append(img);
    } else {
      container.textContent = initials;
    }
  }

  function renderIdentityUI(user) {
    if (user) {
      const google = extractGoogleIdentity(user);
      const effectiveName = (currentProfile.displayName || google.name || 'Account').trim();
      const firstName = effectiveName.split(/\s+/)[0] || 'Account';
      const initials = effectiveName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'A';
      const effectivePhoto = currentProfile.photoDataUrl || currentProfile.photoURL || google.photo;

      launch.dataset.signedIn = 'true';
      launchLabel.textContent = firstName;
      launch.setAttribute('aria-label', `Account signed in as ${effectiveName}`);
      setAvatarContent(launchAvatar, effectivePhoto, initials.charAt(0));

      heading.textContent = 'Your profile & cloud sync';
      signedOutView.hidden = true;
      signedInView.hidden = false;

      profileName.textContent = effectiveName;
      profileEmail.textContent = google.email || 'Signed in with Google';
      if (document.activeElement !== nameInput) {
        nameInput.value = effectiveName;
      }
      setAvatarContent(avatarRing, effectivePhoto, initials);
      resetPhotoBtn.hidden = !(currentProfile.photoDataUrl && (google.photo || currentProfile.photoURL));

      if (!status.textContent || status.textContent.startsWith('Progress stays')) {
        message(`Signed in as ${effectiveName}`);
      }
      window.dispatchEvent(new CustomEvent('aakash:account-state', {
        detail: { signedIn: true, profile: { ...currentProfile, displayName: effectiveName } },
      }));
    } else {
      currentProfile = { displayName: '', photoURL: '', photoDataUrl: '', bestGuessScore: null };
      launch.dataset.signedIn = 'false';
      launchLabel.textContent = 'Sign in';
      launch.setAttribute('aria-label', 'Sign in to account');
      launchAvatar.replaceChildren();
      launchAvatar.innerHTML = SVG.user;

      heading.textContent = 'Sign in to your account';
      signedInView.hidden = true;
      signedOutView.hidden = false;
      loginText.textContent = 'Continue with Google';
      message('Progress stays on this device until you sign in.');
      window.dispatchEvent(new CustomEvent('aakash:account-state', {
        detail: { signedIn: false, profile: null },
      }));
    }
  }

  async function ensureUserProfile(user, forceRefresh = false) {
    if (!user) return null;
    const path = `users/${user.uid}`;
    const ref = fs.doc(db, 'users', user.uid);
    const google = extractGoogleIdentity(user);
    let snap;
    try {
      snap = await fs.getDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (!snap.exists()) {
      const initialData = {
        uid: user.uid,
        displayName: google.name,
        ...(google.photo ? { photoURL: google.photo } : {}),
        createdAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp(),
      };
      try {
        await fs.setDoc(ref, initialData);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
      currentProfile = {
        displayName: google.name,
        photoURL: google.photo,
        photoDataUrl: '',
        bestGuessScore: null,
      };
      renderIdentityUI(user);
      return currentProfile;
    }

    const existing = snap.data() || {};
    const updates = {};
    if ((!existing.displayName || existing.displayName === 'Account') && google.name && google.name !== 'Account') {
      updates.displayName = google.name;
    }
    if (google.photo && existing.photoURL !== google.photo) {
      updates.photoURL = google.photo;
    }
    if (Object.keys(updates).length > 0 && (forceRefresh || !existing.displayName || existing.displayName === 'Account')) {
      try {
        await fs.updateDoc(ref, {
          ...updates,
          updatedAt: fs.serverTimestamp(),
        });
      } catch (error) {
        console.warn('Could not refresh profile fields:', error);
      }
    }

    const cloudBest = Number.isInteger(existing.bestGuessScore) && existing.bestGuessScore >= 1
      ? existing.bestGuessScore
      : null;
    if (cloudBest) {
      try {
        const localBest = Number(localStorage.getItem('bestScore'));
        if (!Number.isFinite(localBest) || localBest < 1 || cloudBest < localBest) {
          localStorage.setItem('bestScore', String(cloudBest));
        }
      } catch {}
    }

    currentProfile = {
      displayName: String(existing.displayName || updates.displayName || google.name || '').slice(0, 120),
      photoURL: String(updates.photoURL || existing.photoURL || google.photo || '').slice(0, 1000),
      photoDataUrl: String(existing.photoDataUrl || '').slice(0, 150000),
      bestGuessScore: cloudBest,
    };
    renderIdentityUI(user);
    return currentProfile;
  }

  async function compressImageToDataUrl(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      throw new Error('Choose a PNG, JPEG, or WebP image.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Image must be smaller than 10 MB.');
    }
    const bitmapUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not read the selected image.'));
        el.src = bitmapUrl;
      });
      const size = 192;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#16221c';
      ctx.fillRect(0, 0, size, size);
      const minSide = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
      const sx = Math.max(0, Math.floor(((img.naturalWidth || img.width) - minSide) / 2));
      const sy = Math.max(0, Math.floor(((img.naturalHeight || img.height) - minSide) / 2));
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

      let dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      if (dataUrl.length > 130000) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.68);
      }
      if (dataUrl.length > 148000) {
        throw new Error('Image is still too large after compression. Choose a simpler photo.');
      }
      return dataUrl;
    } finally {
      URL.revokeObjectURL(bitmapUrl);
    }
  }

  async function updateProfileFields(fields, successMsg) {
    const user = auth?.currentUser;
    if (!user) return;
    await ensureUserProfile(user);
    const path = `users/${user.uid}`;
    const ref = fs.doc(db, 'users', user.uid);
    try {
      await fs.updateDoc(ref, {
        ...fields,
        updatedAt: fs.serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    currentProfile = {
      ...currentProfile,
      ...fields,
    };
    renderIdentityUI(user);
    message(successMsg);
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const config = await loadConfig();
      const prefix = 'https://www.gstatic.com/firebasejs/11.10.0/';
      const [app, a, f] = await Promise.all([
        import(prefix + 'firebase-app.js'),
        import(prefix + 'firebase-auth.js'),
        import(prefix + 'firebase-firestore.js'),
      ]);
      au = a;
      fs = f;

      const instance = app.getApps().length ? app.getApp() : app.initializeApp(config);
      auth = a.getAuth(instance);
      db = f.getFirestore(instance, config.firestoreDatabaseId);

      try {
        await a.setPersistence(auth, a.browserLocalPersistence);
      } catch {
        try {
          await a.setPersistence(auth, a.inMemoryPersistence);
        } catch {
          // Continue with default persistence
        }
      }

      testConnection();

      await new Promise((resolve) => {
        let settled = false;
        a.onAuthStateChanged(auth, async (user) => {
          renderIdentityUI(user);
          if (user) {
            try {
              await ensureUserProfile(user, true);
            } catch (err) {
              console.warn('Profile load warning:', err);
            }
          }
          if (!settled) {
            settled = true;
            resolve();
          }
        });
      });
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
    return initPromise;
  }

  function buildValidatedPayload(collection, rawId, data, uid) {
    if (collection === 'bookmarks') {
      return {
        uid,
        url: String(data?.url || location.href).slice(0, 500),
        title: String(data?.title || document.title || 'Portfolio page').slice(0, 200),
      };
    }
    if (collection === 'testAttempts') {
      const payload = {
        uid,
        testId: String(data?.testId || rawId).slice(0, 100),
      };
      if (data?.title != null) payload.title = String(data.title).slice(0, 200);
      if (typeof data?.score === 'number' && Number.isFinite(data.score)) payload.score = data.score;
      if (typeof data?.total === 'number' && Number.isFinite(data.total)) payload.total = data.total;
      if (data?.at != null) payload.at = String(data.at).slice(0, 64);
      for (const key of ['exam','subject','examId','subjectId']) {
        if (data?.[key] != null) payload[key] = String(data[key]).slice(0, 100);
      }
      for (const key of ['correct','wrong','unattempted','excluded','accuracy']) {
        const value = Number(data?.[key]);
        if (data?.[key] != null && Number.isFinite(value)) payload[key] = value;
      }
      function safeStats(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
        return Object.fromEntries(Object.entries(obj).slice(0, 125).map(([k,v]) => [
          String(k).slice(0, 110),
          Object.fromEntries(['correct','wrong','skipped','unattempted','excluded','total']
            .map(key => [key, Math.max(0, Math.min(1000, Number(v?.[key]) || 0))]))
        ]));
      }
      if (data?.topicStats) payload.topicStats = safeStats(data.topicStats);
      if (data?.unitStats) payload.unitStats = safeStats(data.unitStats);
      return payload;
    }
    if (collection === 'orders') {
      const payload = {
        uid,
        orderId: String(data?.orderId || rawId).slice(0, 100),
      };
      if (data?.title != null) payload.title = String(data.title).slice(0, 200);
      if (data?.status != null) payload.status = String(data.status).slice(0, 50);
      if (typeof data?.total === 'number' && Number.isFinite(data.total)) payload.total = data.total;
      return payload;
    }
    return null;
  }

  async function save(collection, id, data) {
    if (!auth?.currentUser || !['testAttempts', 'bookmarks', 'orders'].includes(collection)) {
      return false;
    }
    const uid = auth.currentUser.uid;
    const docId = sanitizeId(id);
    try {
      await ensureUserProfile(auth.currentUser);
      const ref = fs.doc(db, 'users', uid, collection, docId);
      const existingSnap = await fs.getDoc(ref);
      const payload = buildValidatedPayload(collection, docId, data, uid);
      if (!payload) return false;

      if (!existingSnap.exists()) {
        await fs.setDoc(ref, {
          ...payload,
          createdAt: fs.serverTimestamp(),
          updatedAt: fs.serverTimestamp(),
        });
      } else {
        const updatePayload = { ...payload };
        delete updatePayload.uid;
        await fs.updateDoc(ref, {
          ...updatePayload,
          updatedAt: fs.serverTimestamp(),
        });
      }
      message('Saved to your cloud account.');
      return true;
    } catch (error) {
      console.error('Cloud save error:', error);
      message('Cloud save unavailable. Your local progress is unchanged.');
      return false;
    }
  }

  function signInError(error) {
    const code = error?.code || 'auth/sdk-unavailable';
    const messages = {
      'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
      'auth/popup-closed-by-user': 'Sign-in was cancelled. You can continue browsing locally.',
      'auth/cancelled-popup-request': 'Another sign-in popup is already open.',
      'auth/unauthorized-domain': 'Google sign-in is not authorized for this domain.',
      'auth/operation-not-allowed': 'Google sign-in is not enabled for this Firebase project.',
      'auth/invalid-api-key': 'The Firebase sign-in configuration needs attention.',
      'auth/network-request-failed': 'Could not reach Google sign-in. Check your connection and retry.',
      'auth/sdk-unavailable': 'Sign-in could not load. Check your connection and retry.',
    };
    message((messages[code] || 'Sign-in could not finish. Please retry.') + ' (' + code + ')');
  }

  async function prepareSignIn() {
    login.disabled = true;
    loginText.textContent = 'Preparing Google sign-in…';
    try {
      await init();
      loginText.textContent = 'Continue with Google';
      login.disabled = false;
      renderIdentityUI(auth.currentUser);
    } catch (error) {
      loginText.textContent = 'Sign-in unavailable';
      login.disabled = false;
      signInError(error);
    }
  }

  login.onclick = async () => {
    if (!auth || !au) {
      await prepareSignIn();
      if (!auth || !au) return;
    }
    login.disabled = true;
    loginText.textContent = 'Opening Google…';
    try {
      const provider = new au.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      provider.addScope('profile');
      provider.addScope('email');
      const cred = await au.signInWithPopup(auth, provider);

      try {
        localStorage.setItem('aakash.cloud.enabled', '1');
      } catch {}

      const user = cred?.user || auth.currentUser;
      try {
        await ensureUserProfile(user, true);
        await window.AakashAccount.syncLocal();
      } catch (err) {
        console.error('Profile sync error:', err);
        message('Signed in! Cloud sync hit an error; your local progress is safe.');
      }
    } catch (error) {
      signInError(error);
    } finally {
      login.disabled = false;
      loginText.textContent = 'Continue with Google';
    }
  };

  signOutBtn.onclick = async () => {
    if (!auth || !au) return;
    signOutBtn.disabled = true;
    try {
      await au.signOut(auth);
      try {
        localStorage.removeItem('aakash.cloud.enabled');
      } catch {}
    } finally {
      signOutBtn.disabled = false;
    }
  };

  const openFilePicker = () => fileInput.click();
  camBtn.onclick = openFilePicker;
  uploadBtn.onclick = openFilePicker;

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    uploadBtn.disabled = true;
    camBtn.disabled = true;
    message('Processing and uploading photo…');
    try {
      const dataUrl = await compressImageToDataUrl(file);
      await updateProfileFields({ photoDataUrl: dataUrl }, 'Profile photo updated.');
    } catch (error) {
      message(error?.message || 'Could not update photo. Try a PNG/JPEG under 10 MB.');
    } finally {
      uploadBtn.disabled = false;
      camBtn.disabled = false;
    }
  };

  resetPhotoBtn.onclick = async () => {
    resetPhotoBtn.disabled = true;
    try {
      await updateProfileFields({ photoDataUrl: '' }, 'Restored your Google profile photo.');
    } catch {
      message('Could not restore Google photo right now.');
    } finally {
      resetPhotoBtn.disabled = false;
    }
  };

  nameForm.onsubmit = async (event) => {
    event.preventDefault();
    const trimmed = nameInput.value.trim().slice(0, 120);
    if (!trimmed) {
      message('Display name cannot be empty.');
      return;
    }
    saveNameBtn.disabled = true;
    try {
      await updateProfileFields({ displayName: trimmed }, 'Display name saved.');
    } catch {
      message('Could not save display name. Please retry.');
    } finally {
      saveNameBtn.disabled = false;
    }
  };

  bookmark.onclick = () => {
    save('bookmarks', location.pathname || 'home', {
      title: document.title,
      url: location.href,
    });
  };

  window.AakashAccount = {
    save,
    openDialog() {
      bar.showModal();
      prepareSignIn();
    },
    getState() {
      return {
        signedIn: Boolean(auth?.currentUser),
        uid: auth?.currentUser?.uid || null,
        profile: auth?.currentUser ? { ...currentProfile } : null,
      };
    },
    async bestGuess(score) {
      const numericScore = Math.trunc(Number(score));
      if (!auth?.currentUser || !Number.isInteger(numericScore) || numericScore < 1 || numericScore > 100000) return;
      const uid = auth.currentUser.uid;
      const path = `users/${uid}`;
      const google = extractGoogleIdentity(auth.currentUser);
      let updatedBest = null;
      try {
        await fs.runTransaction(db, async (tx) => {
          const ref = fs.doc(db, 'users', uid);
          const snap = await tx.get(ref);
          if (!snap.exists()) {
            updatedBest = numericScore;
            tx.set(ref, {
              uid,
              displayName: google.name,
              ...(google.photo ? { photoURL: google.photo } : {}),
              bestGuessScore: numericScore,
              createdAt: fs.serverTimestamp(),
              updatedAt: fs.serverTimestamp(),
            });
            return;
          }
          const old = snap.data()?.bestGuessScore;
          if (!old || numericScore < old) {
            updatedBest = numericScore;
            tx.update(ref, {
              bestGuessScore: numericScore,
              updatedAt: fs.serverTimestamp(),
            });
          } else {
            updatedBest = old;
          }
        });
        if (updatedBest) {
          currentProfile = { ...currentProfile, bestGuessScore: updatedBest };
          try {
            const localBest = Number(localStorage.getItem('bestScore'));
            if (!Number.isFinite(localBest) || localBest < 1 || updatedBest < localBest) {
              localStorage.setItem('bestScore', String(updatedBest));
            }
          } catch {}
          window.dispatchEvent(new CustomEvent('aakash:account-state', {
            detail: { signedIn: true, profile: { ...currentProfile } },
          }));
        }
      } catch (error) {
        console.error('Best guess sync failed:', error);
        message('Score is saved locally; cloud sync is unavailable.');
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    async list(collection) {
      if (!auth?.currentUser) return [];
      if (!['testAttempts', 'bookmarks', 'orders'].includes(collection)) return [];
      const uid = auth.currentUser.uid;
      const path = `users/${uid}/${collection}`;
      try {
        const q = fs.query(
          fs.collection(db, 'users', uid, collection),
          fs.where('uid', '==', uid)
        );
        const snap = await fs.getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    async syncLocal() {
      // Backfill earlier submitted attempts and reset-safe local daily summaries.
      try {
        const history = JSON.parse(localStorage.getItem('tclab.analysis.history.v1') || '[]');
        if (Array.isArray(history)) {
          for (const entry of history.slice(-300)) {
            if (entry?.testId && entry?.at) {
              await save('testAttempts', String(entry.testId) + '-' + String(entry.at), {
                ...entry, title: entry.title || entry.testId
              });
            }
          }
        }
      } catch {}
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('tclab.result.')) {
          try {
            const result = JSON.parse(localStorage.getItem(key));
            const history = JSON.parse(localStorage.getItem('tclab.analysis.history.v1') || '[]');
            const detail = Array.isArray(history) ? history.find(h => h.testId === result.testId && h.at === result.at) : null;
            await save('testAttempts', `${result.testId || 'test'}-${result.at || 'latest'}`, { ...result, ...detail });
          } catch {}
        }
      }
      const score = Number(localStorage.getItem('bestScore'));
      if (score > 0) await this.bestGuess(score);
    },
  };


  /* Account-wide test intelligence: each attempt is counted once by its test ID
     and submission timestamp; classifications require multiple distinct days. */
  function aggregateResults(entries) {
    const all = new Map();
    for (const attempt of entries) {
      const date = new Date(Number(attempt.at));
      if (!Number.isFinite(date.getTime())) continue;
      const day = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') +
        '-' + String(date.getDate()).padStart(2,'0');
      for (const [type, stats] of [['chapter', attempt.unitStats], ['topic', attempt.topicStats]]) {
        if (!stats || typeof stats !== 'object') continue;
        for (const [name, counts] of Object.entries(stats)) {
          if (!name || name === '__proto__' || name === 'constructor') continue;
          const key = JSON.stringify([attempt.examId || attempt.exam || 'Unknown exam',
            attempt.subjectId || attempt.subject || 'Unknown subject', type, name]);
          if (!all.has(key)) all.set(key, {
            exam: attempt.exam || attempt.examId || 'Exam',
            subject: attempt.subject || attempt.subjectId || 'Subject',
            type, name, correct:0, wrong:0, skipped:0, correctDays:new Set(), wrongDays:new Set(),
            seenDays:new Set()
          });
          const item = all.get(key);
          const c = Math.max(0, Number(counts?.correct) || 0);
          const w = Math.max(0, Number(counts?.wrong) || 0);
          const skipped = Math.max(0, Number(counts?.skipped ?? counts?.unattempted) || 0);
          item.correct += c; item.wrong += w; item.skipped += skipped;
          if (c) item.correctDays.add(day);
          if (w) item.wrongDays.add(day);
          if (c || w || skipped) item.seenDays.add(day);
        }
      }
    }
    const rows = [...all.values()].map(x => ({
      ...x, days: x.seenDays.size, errorDays:x.wrongDays.size, successDays:x.correctDays.size,
      category: x.wrongDays.size >= 2 && x.wrong >= x.correct ? 'Weak' :
        x.correctDays.size >= 2 && x.wrong === 0 ? 'Strong' : 'Developing'
    }));
    return {
      weak: rows.filter(x => x.category === 'Weak').sort((a,b)=>b.errorDays-a.errorDays || b.wrong-a.wrong),
      strong: rows.filter(x => x.category === 'Strong').sort((a,b)=>b.successDays-a.successDays || b.correct-a.correct),
      developing: rows.filter(x => x.category === 'Developing').sort((a,b)=>b.wrong-a.wrong)
    };
  }

  function createResultsDialog(entries) {
    const dialog = document.createElement('dialog');
    dialog.className = 'account-records account-my-results';
    dialog.setAttribute('aria-label','My Results');
    const head = document.createElement('div');
    head.className = 'account-records-head';
    const title = document.createElement('h2');
    title.textContent = 'My Results';
    const close = document.createElement('button');
    close.className = 'account-close'; close.type = 'button'; close.textContent = '×';
    close.setAttribute('aria-label','Close My Results');
    close.onclick = () => dialog.close();
    head.append(title,close); dialog.append(head);
    const help = document.createElement('p');
    help.textContent = 'All saved test attempts, daily progress, weak chapters/topics and strong areas. A topic is Weak after mistakes on at least two different days (with wrong ≥ correct); Strong after correct answers on at least two different days with no mistakes. Otherwise it stays Developing.';
    dialog.append(help);
    const sorted = entries.slice().sort((a,b)=>Number(b.at)-Number(a.at));
    const summary = document.createElement('div');
    summary.className = 'account-result-summary';
    const count = (key) => sorted.reduce((sum,r)=>sum+(Number(r[key])||0),0);
    for (const [label,value] of [['Tests', sorted.length],['Correct',count('correct')],
      ['Wrong',count('wrong')],['Skipped',count('unattempted')]]) {
      const item = document.createElement('div'); const number = document.createElement('strong');
      number.textContent = String(value); const caption = document.createElement('span');
      caption.textContent = label; item.append(number,caption); summary.append(item);
    }
    dialog.append(summary);
    const intelligence = aggregateResults(sorted);
    for (const [titleText,items,description] of [
      ['Weak chapters & topics',intelligence.weak,'Repeated errors on two or more different days'],
      ['Strong chapters & topics',intelligence.strong,'Consistently right across two or more days'],
      ['Developing / insufficient evidence',intelligence.developing,'Mixed results or fewer than two distinct days']
    ]) {
      const section = document.createElement('section'); section.className = 'account-result-category';
      const h = document.createElement('h3'); h.textContent = titleText;
      const sub = document.createElement('p'); sub.textContent = description;
      section.append(h,sub);
      if (!items.length) {
        const empty = document.createElement('p'); empty.textContent = 'No topics in this category yet.';
        section.append(empty);
      } else {
        for (const item of items.slice(0,100)) {
          const row = document.createElement('div'); row.className = 'account-result-item';
          const name = document.createElement('b'); name.textContent = item.name + ' · ' +
            (item.type === 'chapter' ? 'Chapter / unit' : 'Topic');
          const desc = document.createElement('span'); desc.textContent = item.exam + ' · ' + item.subject +
            ' | ' + item.correct + ' correct · ' + item.wrong + ' wrong · ' + item.skipped +
            ' skipped | ' + item.successDays + ' correct-day(s), ' + item.errorDays + ' error-day(s)';
          row.append(name,desc); section.append(row);
        }
      }
      dialog.append(section);
    }

    const log = document.createElement('section'); log.className = 'account-result-category';
    const logTitle = document.createElement('h3'); logTitle.textContent = 'All test results · day by day';
    log.append(logTitle);
    if (!sorted.length) {
      const blank = document.createElement('p'); blank.textContent = 'No test attempts saved in this account yet.';
      log.append(blank);
    }
    const days = new Map();
    for (const item of sorted) {
      const date = new Date(Number(item.at));
      const day = Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-IN',
        {day:'numeric',month:'short',year:'numeric'}) : 'Date unknown';
      if (!days.has(day)) days.set(day,[]);
      days.get(day).push(item);
    }
    for (const [day,records] of days) {
      const dateTitle = document.createElement('h4');
      dateTitle.textContent = day + ' · ' + records.length + ' test(s)';
      log.append(dateTitle);
      for (const attempt of records) {
        const row = document.createElement('div'); row.className = 'account-result-item';
        const heading = document.createElement('b'); heading.textContent = String(attempt.title || attempt.testId || 'Test');
        const info = document.createElement('span');
        info.textContent = String(attempt.exam || '') + ' · ' + String(attempt.subject || '') +
          ' | ' + (attempt.correct ?? '—') + ' correct, ' + (attempt.wrong ?? '—') +
          ' wrong, ' + (attempt.unattempted ?? '—') + ' skipped' +
          (attempt.accuracy != null ? ' · ' + attempt.accuracy + '% accuracy' : '') +
          (attempt.score != null ? ' · Score ' + attempt.score + '/' + attempt.total : '');
        row.append(heading, info);
        const topicEntries = Object.entries(attempt.topicStats || {});
        if (topicEntries.length) {
          const details = document.createElement('details');
          const label = document.createElement('summary'); label.textContent = 'Topics in this test';
          details.append(label);
          for (const [name,stat] of topicEntries) {
            const p = document.createElement('p');
            p.textContent = name + ': ' + (stat.correct || 0) + ' correct, ' +
              (stat.wrong || 0) + ' wrong, ' + (stat.skipped || stat.unattempted || 0) + ' skipped';
            details.append(p);
          }
          row.append(details);
        } else {
          const note = document.createElement('small');
          note.textContent = 'Older result: detailed topic data was not saved.';
          row.append(note);
        }
        log.append(row);
      }
    }
    dialog.append(log);
    document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove());
    dialog.showModal();
  }

  myResultsBtn.onclick = async () => {
    if (!auth?.currentUser) {
      message('Sign in to view My Results.');
      return;
    }
    myResultsBtn.disabled = true;
    message('Loading test history from your account…');
    try {
      const cloud = await window.AakashAccount.list('testAttempts');
      if (!Array.isArray(cloud)) throw new Error('Cloud result history unavailable.');
      // Merge device records only when attributed to this signed-in account,
      // or when their attempt ID already exists in this account's cloud data.
      const uid = auth.currentUser.uid;
      let device = [];
      try {
        const raw = JSON.parse(localStorage.getItem('tclab.analysis.history.v1') || '[]');
        if (Array.isArray(raw)) device = raw;
      } catch {}
      const ids = new Set(cloud.map(x => String(x.testId) + ':' + String(x.at)));
      const merged = new Map(cloud.map(x => [String(x.testId) + ':' + String(x.at), x]));
      for (const row of device) {
        if (!row?.testId || !row?.at) continue;
        const key = String(row.testId) + ':' + String(row.at);
        if (row.ownerUid !== uid && !ids.has(key)) continue;
        const base = merged.get(key) || {};
        merged.set(key, { ...base, ...row,
          topicStats: row.topicStats || base.topicStats,
          unitStats: row.unitStats || base.unitStats });
      }
      createResultsDialog([...merged.values()]);
      message('My Results loaded.');
    } catch (error) {
      console.error('My Results load failed:',error);
      message('Could not load cloud results. Please retry.');
    } finally {
      myResultsBtn.disabled = false;
    }
  };

  saved.onclick = async () => {
    if (!auth?.currentUser) {
      message('Sign in to view your saved data.');
      return;
    }
    try {
      const dialog = document.createElement('dialog');
      dialog.className = 'account-records';
      dialog.setAttribute('aria-label', 'Your saved data');

      const recordsHead = document.createElement('div');
      recordsHead.className = 'account-records-head';
      const recordsTitle = document.createElement('h2');
      recordsTitle.textContent = 'My saved data';
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'account-close';
      closeBtn.textContent = '×';
      closeBtn.setAttribute('aria-label', 'Close saved data');
      closeBtn.onclick = () => dialog.close();
      recordsHead.append(recordsTitle, closeBtn);
      dialog.append(recordsHead);

      if (currentProfile.bestGuessScore) {
        const gameHeading = document.createElement('h3');
        gameHeading.textContent = 'Perfect Guess';
        const gameRow = document.createElement('p');
        gameRow.textContent = `Personal Best: ${currentProfile.bestGuessScore} ${currentProfile.bestGuessScore === 1 ? 'attempt' : 'attempts'}`;
        dialog.append(gameHeading, gameRow);
      }

      for (const name of ['bookmarks', 'testAttempts', 'orders']) {
        const h = document.createElement('h3');
        h.textContent = { bookmarks: 'Bookmarks', testAttempts: 'Test history', orders: 'Order history' }[name];
        dialog.append(h);
        const items = await window.AakashAccount.list(name);
        if (!items.length) {
          const empty = document.createElement('p');
          empty.className = 'empty-row';
          empty.textContent = 'Nothing saved yet.';
          dialog.append(empty);
          continue;
        }
        for (const item of items) {
          const p = document.createElement('p');
          p.textContent = item.title || item.id;
          if (
            name === 'bookmarks' &&
            typeof item.url === 'string' &&
            (item.url.startsWith('/') ||
              item.url.startsWith(location.origin) ||
              item.url.startsWith('https://aakash9972sn.github.io/'))
          ) {
            const a = document.createElement('a');
            a.href = item.url;
            a.textContent = p.textContent;
            p.replaceChildren(a);
          }
          dialog.append(p);
        }
      }
      document.body.append(dialog);
      dialog.addEventListener('close', () => dialog.remove());
      dialog.showModal();
    } catch (err) {
      console.error('Failed to load saved data:', err);
      message('Saved data could not be loaded. Please retry.');
    }
  };

  // Restore existing session automatically if user previously signed in
  try {
    if (localStorage.getItem('aakash.cloud.enabled')) {
      init().catch(() => message('Cloud connection unavailable. You can continue locally.'));
    }
  } catch {}
})();
