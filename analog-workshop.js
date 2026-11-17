/**
 * Analog Circuit Analysis, Design & Testing - Interactive Scripts
 * Department of ECE · Delhi Technological University
 */

document.addEventListener('DOMContentLoaded', () => {
  initBjtCalculator();
  initBodeExplorer();
  initNotesGallery();
  initLightbox();
  initScrollSpy();
});

/* ==========================================================================
   1. BJT Quiescent Operating Point Calculator
   ========================================================================== */
function initBjtCalculator() {
  const vccSlider = document.getElementById('calc-vcc');
  const icSlider = document.getElementById('calc-ic');
  const betaSlider = document.getElementById('calc-beta');

  const vccValDisp = document.getElementById('vcc-val-disp');
  const icValDisp = document.getElementById('ic-val-disp');
  const betaValDisp = document.getElementById('beta-val-disp');

  // Outputs
  const outVre = document.getElementById('out-vre');
  const outRe = document.getElementById('out-re');
  const outVb = document.getElementById('out-vb');
  const outR1 = document.getElementById('out-r1');
  const outR2 = document.getElementById('out-r2');
  const outRc = document.getElementById('out-rc');
  const outReSmall = document.getElementById('out-re-small');
  const outVc = document.getElementById('out-vc');

  if (!vccSlider || !icSlider || !betaSlider) return;

  function update() {
    const vcc = parseFloat(vccSlider.value);
    const ic_ma = parseFloat(icSlider.value);
    const beta = parseFloat(betaSlider.value);

    vccValDisp.textContent = `${vcc.toFixed(1)} V`;
    icValDisp.textContent = `${ic_ma.toFixed(1)} mA`;
    betaValDisp.textContent = `${beta.toFixed(0)}`;

    const ic = ic_ma / 1000.0; // Amperes
    const ib = ic / beta;

    // Rule of thumb: V_RE ≈ 10% of V_CC
    const vre = 0.10 * vcc;
    const re = vre / ic;

    // Base voltage: V_B = V_E + V_BE (0.7V)
    const vb = vre + 0.70;

    // Voltage divider current: I_div = 10 * I_B
    const idiv = 10 * ib;
    const r2 = vb / idiv;
    const r1 = (vcc - vb) / (idiv + ib);

    // Dynamic range collector voltage: V_C = (V_CC + V_RE + 0.3) / 2
    const vc = (vcc + vre + 0.3) / 2.0;
    const rc = (vcc - vc) / ic;

    // Small signal dynamic resistance: r_e = V_T / I_C (V_T = 26mV)
    const re_dynamic = 26.0 / ic_ma;

    // Update displays
    if (outVre) outVre.textContent = `${vre.toFixed(2)} V`;
    if (outRe) outRe.textContent = `${Math.round(re)} Ω`;
    if (outVb) outVb.textContent = `${vb.toFixed(2)} V`;
    if (outR1) outR1.textContent = formatResistor(r1);
    if (outR2) outR2.textContent = formatResistor(r2);
    if (outRc) outRc.textContent = formatResistor(rc);
    if (outReSmall) outReSmall.textContent = `${re_dynamic.toFixed(2)} Ω`;
    if (outVc) outVc.textContent = `${vc.toFixed(2)} V`;
  }

  function formatResistor(valInOhms) {
    if (valInOhms >= 1000000) {
      return `${(valInOhms / 1000000).toFixed(1)} MΩ`;
    }
    if (valInOhms >= 1000) {
      return `${(valInOhms / 1000).toFixed(1)} kΩ`;
    }
    return `${Math.round(valInOhms)} Ω`;
  }

  vccSlider.addEventListener('input', update);
  icSlider.addEventListener('input', update);
  betaSlider.addEventListener('input', update);

  update();
}

/* ==========================================================================
   2. Middlebrook EET Bode Plot & Shelf Explorer
   ========================================================================== */
function initBodeExplorer() {
  const buttons = document.querySelectorAll('.bode-btn');
  const svgPath = document.getElementById('bode-curve');
  const zeroMarker = document.getElementById('bode-zero-marker');
  const poleMarker = document.getElementById('bode-pole-marker');
  const zeroFreqDisp = document.getElementById('bode-fz-disp');
  const poleFreqDisp = document.getElementById('bode-fp-disp');
  const midbandGainDisp = document.getElementById('bode-midgain-disp');

  if (!buttons.length || !svgPath) return;

  // Preset component values: R_E = 200 Ω, r_e = 2.6 Ω, R_C = 1000 Ω
  const RE = 200;
  const re_dyn = 2.6;
  const RC = 1000;

  // Low frequency gain: RC / RE = 5 (14 dB)
  // High frequency midband gain: RC / re = 384.6 (51.7 dB)

  function setCapacitor(c_microfarads) {
    const C = c_microfarads * 1e-6;

    // f_z = 1 / (2 * pi * RE * C)
    const fz = 1.0 / (2 * Math.PI * RE * C);

    // f_p = 1 / (2 * pi * (RE || re) * C)
    const req = (RE * re_dyn) / (RE + re_dyn);
    const fp = 1.0 / (2 * Math.PI * req * C);

    if (zeroFreqDisp) zeroFreqDisp.textContent = `${Math.round(fz)} Hz`;
    if (poleFreqDisp) poleFreqDisp.textContent = `${(fp / 1000).toFixed(1)} kHz`;
    if (midbandGainDisp) midbandGainDisp.textContent = `~51.7 dB (A_v ≈ 385)`;

    // Draw SVG Path across 4 decades (1 Hz to 100 kHz)
    // Box dimensions: viewBox="0 0 600 240"
    // Margins: left=50, right=570, top=30, bottom=200
    // Gain mapping: 14 dB -> Y = 190, 52 dB -> Y = 50
    // Log frequency mapping: 1Hz -> X=60, 100kHz -> X=560
    const xMin = 60;
    const xMax = 560;
    const yLow = 190;
    const yHigh = 55;

    // Log coordinates
    const logMin = Math.log10(1);      // 0
    const logMax = Math.log10(100000); // 5

    function getX(f) {
      const logF = Math.log10(Math.max(1, f));
      return xMin + ((logF - logMin) / (logMax - logMin)) * (xMax - xMin);
    }

    const xZ = getX(fz);
    const xP = getX(fp);

    // Build smooth curve path
    const pathD = `M ${xMin} ${yLow} ` +
      `L ${Math.max(xMin, xZ - 20)} ${yLow} ` +
      `C ${xZ} ${yLow}, ${xZ + 15} ${yLow - 15}, ${xZ + (xP - xZ) * 0.5} ${(yLow + yHigh) / 2} ` +
      `C ${xP - 15} ${yHigh + 15}, ${xP} ${yHigh}, ${Math.min(xMax, xP + 25)} ${yHigh} ` +
      `L ${xMax} ${yHigh}`;

    svgPath.setAttribute('d', pathD);

    if (zeroMarker) {
      zeroMarker.setAttribute('cx', xZ);
      zeroMarker.setAttribute('cy', yLow);
    }
    if (poleMarker) {
      poleMarker.setAttribute('cx', xP);
      poleMarker.setAttribute('cy', yHigh);
    }
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('active');
      const val = parseFloat(btn.getAttribute('data-cap'));
      setCapacitor(val);
    });
  });

  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cap === '47')));
  // Default: 47uF
  setCapacitor(47);
}

/* ==========================================================================
   3. Lecture Notes Gallery & Stage Switcher
   ========================================================================== */
const isSubfolder = window.location.pathname.includes('/workshops/') || window.location.href.includes('/workshops/');
const assetPrefix = isSubfolder ? '../../' : '';

const NOTES_DATA = [
  {
    pg: 'Page 1',
    src: 'assets/analog-notes-cover.png',
    title: 'Cover Sheet: Title & Pedagogical Lineage',
    desc: 'Inspired by Late Prof. R. David Middlebrook (Caltech), Prof. Ali Hajimiri (Caltech), and Prof. Behzad Razavi (UCLA). Dept of ECE, DTU.'
  },
  {
    pg: 'Page 2',
    src: 'assets/analog-notes-page-2.png',
    title: 'DOA Philosophy: Analysis vs. Design & Low-Entropy',
    desc: 'Why design is fundamentally under-constrained (N_vars > N_eqs), and why engineers must never blindly cross-multiply algebraic equations.'
  },
  {
    pg: 'Page 3',
    src: 'assets/analog-notes-page-3.png',
    title: 'Terminal Resistance & Dominance Rules',
    desc: 'Determining the resistance seen by circuit nodes and capacitors; series vs. parallel dominance principles.'
  },
  {
    pg: 'Page 4',
    src: 'assets/analog-notes-page-4.png',
    title: 'Practical Voltage Sources & The Loading Effect',
    desc: 'Internal source impedance Rs, load resistance RL, and the vital role of buffer stages in avoiding signal degradation.'
  },
  {
    pg: 'Page 5',
    src: 'assets/analog-notes-page-5.png',
    title: 'Exponential BJT IC vs. VBE & Thermal Sensitivity',
    desc: 'The Ebers-Moll relationship, why a 10% shift in VBE causes a 300% surge in IC, and the catastrophic failure of fixed base bias.'
  },
  {
    pg: 'Page 9',
    src: 'assets/analog-notes-page-9.png',
    title: 'The 10% V_CC Biasing Rule & E24 Lab Sizing',
    desc: 'Setting V_RE = 10% of V_CC, emitter resistor calculation, base divider sizing (I_div = 10 I_B), and symmetric dynamic swing.'
  },
  {
    pg: 'Page 10',
    src: 'assets/analog-notes-page-10.png',
    title: 'Small-Signal CE Amplifier & Inspection Gain Formula',
    desc: 'Dynamic emitter resistance r_e = VT/IC = 2.6 Ω, input impedance Rin, and writing the voltage gain expression by direct inspection.'
  },
  {
    pg: 'Page 14',
    src: 'assets/analog-notes-page-14.png',
    title: "Middlebrook's Extra Element Theorem (EET) Derivation",
    desc: 'The master EET formulation: A(s) = A|_{Z->inf} * (1 + Zn/Z) / (1 + Zd/Z), with driving point (Zd) and null double-injection (Zn) proofs.'
  },
  {
    pg: 'Page 16',
    src: 'assets/analog-notes-page-16.png',
    title: 'Emitter Bypass Capacitor C2 Pole-Zero Shelf Analysis',
    desc: 'Calculating wz = 1 / (C2 * RE) and wp = 1 / (C2 * (RE || r_e\')), sketching the low-to-midband frequency response shelf.'
  },
  {
    pg: 'Page 17',
    src: 'assets/analog-notes-page-17.png',
    title: 'Dual Extra Element Theorem (DEET) & Series Elements',
    desc: 'Formulation of DEET with short-circuit reference condition (Z->0) for input coupling capacitors and conclusion.'
  }
];

function initNotesGallery() {
  const thumbList = document.getElementById('notes-thumb-list');
  const stageImg = document.getElementById('notes-stage-img');
  const stageTitle = document.getElementById('notes-stage-title');
  const stageDesc = document.getElementById('notes-stage-desc');

  if (!thumbList || !stageImg) return;

  thumbList.innerHTML = '';

  NOTES_DATA.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.className = `thumb-item ${index === 0 ? 'active' : ''}`;
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(index === 0));
    btn.innerHTML = `
      <span class="thumb-pg-num">${item.pg}</span>
      <div class="thumb-info">
        <strong>${item.title.split(':')[0]}</strong>
        <span>${item.title.split(':')[1] || ''}</span>
      </div>
    `;

    const fullSrc = `${assetPrefix}${item.src}`;

    btn.addEventListener('click', () => {
      thumbList.querySelectorAll('.thumb-item').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('active');

      stageImg.src = fullSrc;
      stageImg.alt = item.title;
      if (stageTitle) stageTitle.textContent = item.title;
      if (stageDesc) stageDesc.textContent = item.desc;
    });

    thumbList.appendChild(btn);
  });
}

/* ==========================================================================
   4. Lightbox Modal for Fullscreen Document Inspection
   ========================================================================== */
function initLightbox() {
  const modal = document.getElementById('lightbox-modal');
  if (!modal) return;
  const open = prepareDocumentViewer(modal, 'open');
  const poster = document.getElementById('hero-poster-trigger');
  bindDocumentTrigger(poster, () => open(poster, `${assetPrefix}assets/analog-workshop-brochure.png`, 'Official DTU ECE Workshop Brochure'));
  const notes = document.getElementById('notes-stage-frame');
  bindDocumentTrigger(notes, () => {
    const image = document.getElementById('notes-stage-img');
    open(notes, image.src, document.getElementById('notes-stage-title').textContent);
  });
}
/* ==========================================================================
   5. Scroll-Spy for Sub-Navigation
   ========================================================================== */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.subnav-links a');

  if (!sections.length || !navLinks.length) return;

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 120;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  });
}

// Equations are native MathML in the HTML, so they display without JavaScript.
