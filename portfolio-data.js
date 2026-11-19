// Add future projects and workshops here. Cards, filters and counts update automatically.
// See README.md for examples. Optional `level` adds a badge such as 'Basic' or 'Real-world use'.
window.portfolioEntries = [
  {
    id: 'rfid-card-detection', type: 'project', title: 'RFID Card Detection System',
    category: 'Embedded systems', level: 'Foundation project', artwork: 'rfid',
    description: 'A complete look at contactless identification: RF coupling, SPI wiring, UID processing and feedback with an Arduino UNO and MFRC522 reader.',
    tags: ['Arduino UNO', 'MFRC522', 'SPI'],
    href: 'rfid-card-detection.html', action: 'Explore the build'
  },
  {
    id: 'smart-id-attendance', type: 'project', title: 'Smart ID Entry–Exit & Time Analytics',
    category: 'Embedded IoT', level: 'System design', artwork: 'attendance',
    description: 'A proposed ESP32-S3 architecture for offline event logging, replaceable credentials and session-based presence reports. Explore the design and try the analytics.',
    tags: ['ESP32-S3', 'PN532 NFC', 'Time analytics'],
    href: 'smart-id-attendance.html', action: 'Explore the system'
  },
  {
    id: 'perfect-guess', type: 'project', title: 'Perfect Guess',
    category: 'Browser game', artwork: 'guess',
    description: 'A little logic, a little luck. Find the number with higher-or-lower hints and try to beat your best score.',
    tags: ['JavaScript', 'Game development'],
    href: 'https://aakash9972sn.github.io/perfect_guess/', action: 'Play game'
  },
  {
    id: 'biology-test', type: 'project', title: 'Test Centre — NEET & GATE',
    category: 'Learning tool', artwork: 'quiz',
    description: 'A practice-test centre with subject-wise tests for NEET (Physics, Chemistry, Biology) and GATE. Live timers, a question palette, exam marking, saved progress and full solutions.',
    tags: ['JavaScript', 'NEET & GATE', 'Practice tests'],
    href: 'https://aakash9972sn.github.io/newTest/', action: 'Open the test centre'
  },
  {
    id: 'blunder-pro-max', type: 'project', title: 'Blunder — Everyday Store',
    category: 'Grocery commerce', level: 'Full-stack build', artwork: 'shop',
    description: 'A grocery storefront with search, saved items, delivery maps and an AI shopping helper. Its order backend supports COD, verified payments and automatic seller notifications; live checkout requires hosting and provider setup.',
    tags: ['JavaScript', 'Node.js', 'SQLite'],
    href: 'https://aakash9972sn.github.io/my-website/', action: 'Explore the store'
  },
  {
    id: 'analog-workshop', type: 'workshop', title: 'Analog Circuit Analysis, Design & Testing',
    category: 'Electronics & circuit design', artwork: 'analog',
    date: '2026-06-03', dateLabel: '3–4 June 2026', organization: 'Department of ECE · DTU',
    description: 'Learning design-oriented analysis, BJT biasing, amplifier design, and Middlebrook’s Extra Element Theorem through workshop notes and examples.',
    tags: ['Analog circuits', 'DOA', 'EET'],
    href: 'analog-circuit-analysis-design.html', action: 'Explore my learning'
  },
  {
    id: 'pcb-bootcamp', type: 'workshop', title: 'PCB Designing Bootcamp',
    category: 'From schematic to reality', artwork: 'pcb',
    date: '2026-02-13', dateLabel: '13–14 February 2026', organization: 'AICTE IDEA Lab · DTU',
    description: 'Exploring the journey from circuit schematic to board layout, fabrication, assembly, and quality checks with EDWinXP.',
    tags: ['EDWinXP', 'PCB design', 'Hardware'],
    href: 'pcb-designing-bootcamp.html', action: 'Explore my learning'
  }
];
