// Add future projects and workshops here. Cards, filters and counts update automatically.
// See README.md for examples. Optional `level` adds a badge such as 'Basic' or 'Real-world use'.
window.portfolioEntries = [
  {
    id: 'perfect-guess', type: 'project', title: 'Perfect Guess',
    category: 'Browser game', artwork: 'guess',
    description: 'A little logic, a little luck. Find the number with higher-or-lower hints and try to beat your best score.',
    tags: ['JavaScript', 'Game development'],
    href: 'https://aakash9972sn.github.io/perfect_guess/', action: 'Play game'
  },
  {
    id: 'biology-test', type: 'project', title: 'Biology Test',
    category: 'Learning tool', artwork: 'quiz',
    description: 'A timed biology quiz with saved progress, question navigation, and answers to review after the test.',
    tags: ['JavaScript', 'Interactive learning'],
    href: 'https://aakash9972sn.github.io/newTest/', action: 'Try the quiz'
  },
  {
    id: 'blunder-pro-max', type: 'project', title: 'Blunder Pro Max',
    category: 'Frontend experiment', artwork: 'shop',
    description: 'A storefront prototype exploring product layouts, responsive styling, and simple cart interactions.',
    tags: ['HTML / CSS', 'JavaScript'],
    href: 'https://aakash9972sn.github.io/my-website/', action: 'Open website'
  },
  {
    id: 'rfid-card-detection', type: 'project', title: 'RFID Card Detection System',
    category: 'Embedded systems', level: 'Basic', artwork: 'rfid',
    description: 'An Arduino UNO and MFRC522 reader that detects 13.56 MHz cards over SPI, reads their UID and signals registered or unregistered cards with LEDs and a buzzer.',
    tags: ['Arduino UNO', 'MFRC522', 'SPI'],
    href: 'rfid-card-detection.html', action: 'Explore the build'
  },
  {
    id: 'smart-id-attendance', type: 'project', title: 'Smart ID Entry–Exit & Time Analytics',
    category: 'Embedded IoT', level: 'Real-world use', artwork: 'attendance',
    description: 'An ESP32-S3 system with entry and exit NFC readers, an RTC and offline microSD logging that turns card scans into daily, monthly and custom-range presence reports.',
    tags: ['ESP32-S3', 'PN532 NFC', 'Data analytics'],
    href: 'smart-id-attendance.html', action: 'Explore the system'
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
