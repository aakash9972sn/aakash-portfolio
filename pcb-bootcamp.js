/**
 * PCB Designing Bootcamp Case Study - Interactive Controller
 * Delhi Technological University AICTE IDEA Lab
 */

'use strict';

// 11-Step PCB Design Workflow Data
const workflowSteps = [
  {
    num: '01',
    phase: 'System Concept',
    title: 'Understanding Circuit Requirements',
    lead: 'The first step in electronic hardware design is understanding the intended electrical function.',
    description: 'Hardware design begins with specifying the electrical function, operational voltages, power supply limits, signal frequencies, and physical form factor. Component selection must be made with awareness of packaging, availability, and thermal constraints before schematic capture starts.',
    points: [
      'Identification of active components (ICs, microcontrollers) and passive components (resistors, capacitors, inductors)',
      'Definition of power rails, input/output signals, and ground references',
      'Determination of mechanical dimensions, connector orientations, and mounting clearances',
      'Establishing acceptable operating temperature ranges and thermal dissipation needs'
    ],
    learningConcept: 'Understanding electrical connectivity and defining circuit parameters before layout.',
    constraints: 'A circuit schematic cannot fix flaws in initial functional logic or electrical component sizing.'
  },
  {
    num: '02',
    phase: 'EDA Schematic Editor',
    title: 'Schematic Capture',
    lead: 'The circuit is represented using standardized electrical symbols and logical connections.',
    description: 'Components are selected from the EDWinXP library, placed in the schematic workspace, and wired together using electrical nets. Net labels are assigned to keep diagrams readable. Reference designators (R1, C1, U1) and component values are systematically defined.',
    points: [
      'Selection of standardized symbols from EDWinXP component libraries',
      'Establishing electrical nodes (nets) connecting component pins',
      'Assignment of reference designators (R1, C1, U1) and part parameters',
      'Preparation of electrical netlist transferring connectivity to PCB layout'
    ],
    learningConcept: 'Understanding electrical connectivity and how a circuit diagram represents component relationships logically, independent of physical location.',
    constraints: 'A schematic communicates logical connections only; it does not represent physical board positions or copper trace geometries.'
  },
  {
    num: '03',
    phase: 'EDA Component Packaging',
    title: 'Component Packaging & Footprint Assignment',
    lead: 'Connecting each schematic symbol to its corresponding physical landing pattern.',
    description: 'While a schematic symbol shows pins logically, a footprint specifies the exact copper pad layout, drill hole diameters (for through-hole), courtyard boundary, and silkscreen outline required to solder the physical component onto the board.',
    points: [
      'Matching logical schematic pins to physical package pad numbers',
      'Selecting through-hole technology (THT) or surface-mount technology (SMT) packages',
      'Verifying pad pitch, lead dimensions, and mechanical tolerances',
      'Checking manufacturer land pattern guidelines to avoid soldering defects'
    ],
    learningConcept: 'Understanding the relationship between component symbols, pin assignments, and physical PCB packages.',
    constraints: 'Selecting an incorrect footprint will cause assembly failure because component pins will physically fail to align with pads.'
  },
  {
    num: '04',
    phase: 'Physical Mechanical Domain',
    title: 'Defining the PCB Outline',
    lead: 'Establishing the physical geometric boundary and mechanical mounting constraints of the board.',
    description: 'In the EDWinXP Layout Editor, the board boundary is established on the board outline layer. This defines the usable board area, mounting hole locations, keep-out zones near edges, and fixed connector placements determined by the product enclosure.',
    points: [
      'Drawing precise board dimensions and perimeter contours',
      'Placing mechanical mounting holes with proper copper keep-out margins',
      'Setting edge clearance rules to prevent copper exposure during board routing or scoring',
      'Aligning edge connectors and interfaces with external enclosure openings'
    ],
    learningConcept: 'Understanding how electrical design transitions into the physical constraints of an engineering enclosure.',
    constraints: 'Mechanical boundaries set hard limits on available routing channels and component placement density.'
  },
  {
    num: '05',
    phase: 'EDA Layout Editor',
    title: 'Component Placement',
    lead: 'Arranging component footprints within the board outline to optimize signal flow and assembly.',
    description: 'Placement is the most decisive stage in PCB design. Components are positioned considering logical signal flow (input to output), keeping bypass capacitors directly adjacent to IC power pins, and grouping related circuit blocks together to minimize trace crossings.',
    points: [
      'Strategic grouping of functional subsystems (power, analog, digital, I/O)',
      'Minimizing distances between interconnected nodes to simplify trace routing',
      'Placing connectors and user interfaces along board edges for accessible cabling',
      'Orienting polarized components systematically to ease manual and automated assembly'
    ],
    learningConcept: 'Understanding why component arrangement dictates routing feasibility, assembly efficiency, and circuit performance.',
    constraints: 'Poor component placement creates congested routing channels and cannot be compensated for by routing alone.'
  },
  {
    num: '06',
    phase: 'EDA Routing Engine',
    title: 'Copper Trace Routing',
    lead: 'Converting logical electrical nets into physical copper pathways on designated board layers.',
    description: 'Routing replaces abstract nets with physical conductive copper traces. Using EDWinXP routing tools, traces are drawn between pads. Critical design considerations include trace widths (sized for current-carrying capacity), clearances between adjacent traces to prevent bridging, and using vias for layer transitions.',
    points: [
      'Implementing manual, semi-automatic, or constrained auto-routing in EDWinXP',
      'Assigning sufficient trace width according to current levels and thermal limits',
      'Maintaining required electrical clearance between adjacent conductive paths',
      'Employing 45-degree or curved trace turns rather than sharp 90-degree corners'
    ],
    learningConcept: 'Understanding how electrical nets become physical copper pathways with physical impedance and spatial limits.',
    constraints: 'Trace widths depend on engineering requirements and manufacturing capabilities; no single universal width applies to all traces.'
  },
  {
    num: '07',
    phase: 'Verification Engine',
    title: 'Design Verification & Rule Checking (DRC)',
    lead: 'Executing automated software audits to catch clearance violations and unrouted nets.',
    description: 'Before releasing a board design, EDWinXP Design Rule Checking (DRC) is run against manufacturing constraint files. DRC rigorously checks trace-to-trace clearance, trace-to-pad clearance, drill-to-copper margins, and identifies any unrouted nets or dangling stubs.',
    points: [
      'Running Design Rule Checking (DRC) against specified fabricator tolerances',
      'Verifying 100% netlist completion (no unrouted or floating connections)',
      'Checking annular ring widths around through-hole pads and vias',
      'Inspecting silkscreen-over-pad violations to prevent solder joint contamination'
    ],
    learningConcept: 'Understanding the importance of algorithmic verification in catching human layout oversights prior to expensive manufacturing runs.',
    constraints: 'DRC validates geometric and physical rules; it does not test whether the circuit logic or component values will work electrically.'
  },
  {
    num: '08',
    phase: 'Manufacturing Preparation',
    title: 'Manufacturing Documentation (Gerber & NC Drill)',
    lead: 'Generating standard industrial data files that communicate board geometry to fabricators.',
    description: 'The EDWinXP Fabrication Manager outputs industry-standard manufacturing packages: RS-274X Gerber files for each copper layer, solder mask, silkscreen, and board edge, alongside NC Drill (Excellon) files defining hole coordinates and tool sizes.',
    points: [
      'Generation of RS-274X Gerber files for top/bottom copper, masks, and silkscreens',
      'Exporting NC Drill (Excellon format) files specifying exact X/Y hole coordinates',
      'Creating drill charts detailing hole diameters, plating status, and hole counts',
      'Packaging fabrication notes covering board thickness, copper weight, and surface finish'
    ],
    learningConcept: 'Understanding how a digital layout converts into standard digital photoplotter and CNC drilling instructions.',
    constraints: 'Fabricators build strictly to the Gerber artwork and drill data; discrepancies between schematic and Gerber result in defective boards.'
  },
  {
    num: '09',
    phase: 'Industrial Fabrication',
    title: 'PCB Fabrication (Bare Board Production)',
    lead: 'Translating digital manufacturing files into physical bare printed circuit boards.',
    description: 'The fabrication process involves cutting copper-clad FR-4 laminate, drilling holes with CNC machines, photolithographic patterning of copper traces, chemical etching of unwanted copper, through-hole copper plating for vias, applying liquid photoimageable solder mask, and silkscreen printing.',
    points: [
      'Substrate preparation using glass-reinforced epoxy laminate (e.g. FR-4)',
      'Photolithographic exposure and chemical etching to define conductive copper tracks',
      'Electroless copper deposition to plate drill holes and establish via interconnections',
      'Application and thermal curing of protective solder mask and legend silkscreen'
    ],
    learningConcept: 'Gaining conceptual understanding of the chemical, mechanical, and photolithographic steps used in industrial board fabrication.',
    constraints: 'Fabrication processes require precise chemical tolerances; understanding these tolerances informs better board layout decisions.'
  },
  {
    num: '10',
    phase: 'Hardware Assembly',
    title: 'Component Assembly',
    lead: 'Mounting and soldering electronic components onto the fabricated bare PCB.',
    description: 'During assembly, components are physically populated onto the board. Solder paste is applied via stencils for surface-mount components, followed by pick-and-place and reflow soldering. Through-hole components are inserted and wave-soldered or hand-soldered, paying strict attention to component polarity.',
    points: [
      'Application of solder paste onto surface-mount pads using precision stencils',
      'Component placement aligning IC leads with respective pads according to pin 1 markers',
      'Reflow soldering for SMT and hand/wave soldering for through-hole terminals',
      'Ensuring smooth solder wetting without cold joints or unintended bridging'
    ],
    learningConcept: 'Understanding how component packages, soldering clearances, and lead geometries affect physical hardware assembly.',
    constraints: 'Correct component orientation (diodes, polarized capacitors, ICs) is vital; inverted components can cause immediate short circuits.'
  },
  {
    num: '11',
    phase: 'Testing & Verification',
    title: 'Quality Assurance & Functional Inspection',
    lead: 'Inspecting physical boards and testing electrical continuity before powering systems.',
    description: 'The completed board undergoes rigorous inspection. Optical inspection checks for solder bridges, voids, and component alignment. Multimeter continuity tests verify ground and power rails are not shorted together before progressive bench power testing.',
    points: [
      'Optical microscope inspection for solder bridges, tombstones, and alignment',
      'Continuity and isolation testing across power rails using digital multimeters',
      'Power-on validation checking regulated voltage rails before installing sensitive ICs',
      'Functional validation confirming the board operates according to intended specifications'
    ],
    learningConcept: 'Appreciating the distinction between software design verification and physical hardware validation in the lab.',
    constraints: 'Testing requires systematic isolation; powering an untested board directly can cause catastrophic damage if shorts exist.'
  }
];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initWorkflowInteractive();
  initLightboxes();
  initScrollspy();
});

/**
 * Interactive Workflow Pipeline Switcher
 */
function initWorkflowInteractive() {
  const track = document.querySelector('#workflow-nav-track');
  const stageCard = document.querySelector('#workflow-stage-detail');
  if (!track || !stageCard) return;

  // Render navigation pills
  track.innerHTML = workflowSteps.map((step, idx) => `
    <button class="workflow-pill ${idx === 0 ? 'active' : ''}" data-step-index="${idx}" aria-label="Step ${step.num}: ${step.title}">
      <span class="num">${step.num}</span>
      <span class="title">${step.title}</span>
    </button>
  `).join('');

  // Handle click on pill
  const pills = track.querySelectorAll('.workflow-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const idx = parseInt(pill.dataset.stepIndex, 10);
      updateWorkflowStage(idx);
    });
  });

  // Render initial step (0)
  updateWorkflowStage(0);

  function updateWorkflowStage(idx) {
    const data = workflowSteps[idx];
    if (!data) return;

    // Update active pill
    pills.forEach((p, i) => {
      p.classList.toggle('active', i === idx);
      p.setAttribute('aria-pressed', String(i === idx));
    });

    // Populate stage card with smooth transition
    stageCard.style.opacity = '0.3';
    setTimeout(() => {
      stageCard.innerHTML = `
        <div class="stage-top-meta">
          <div class="stage-badge-cluster">
            <span class="stage-num-badge">STEP ${data.num} OF 11</span>
            <span class="stage-phase-label">${data.phase}</span>
          </div>
          <h3>${data.title}</h3>
        </div>
        <div class="stage-body-grid">
          <div class="stage-prose">
            <p><strong>${data.lead}</strong></p>
            <p>${data.description}</p>
            <ul class="stage-check-items">
              ${data.points.map(pt => `<li>${pt}</li>`).join('')}
            </ul>
          </div>
          <div class="stage-aside-box">
            <h4><span>💡</span> Core Learning Concept</h4>
            <p>${data.learningConcept}</p>
            <div class="stage-caution-note">
              <strong>Engineering Consideration:</strong>
              ${data.constraints}
            </div>
          </div>
        </div>
      `;
      stageCard.style.opacity = '1';
    }, 150);
  }
}

/**
 * Lightbox Controller for Certificate and Poster
 */
function initLightboxes() {
  const modal = document.getElementById('case-lightbox');
  if (!modal) return;
  const open = prepareDocumentViewer(modal, 'active');
  document.querySelectorAll('[data-lightbox-src]').forEach(trigger => {
    bindDocumentTrigger(trigger, () => open(trigger, trigger.dataset.lightboxSrc, trigger.dataset.lightboxCaption || 'Workshop document'));
  });
}
/**
 * Scrollspy for Sticky Navigation
 */
function initScrollspy() {
  const navLinks = document.querySelectorAll('.subnav-links a[href^="#"]');
  if (!navLinks.length) return;

  const sections = Array.from(navLinks).map(link => {
    const id = link.getAttribute('href');
    return document.querySelector(id);
  }).filter(Boolean);

  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + 120;
    let currentId = '';

    sections.forEach(sec => {
      if (sec.offsetTop <= scrollPos) {
        currentId = '#' + sec.id;
      }
    });

    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === currentId);
    });
  }, { passive: true });
}
