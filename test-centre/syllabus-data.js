/* Official Syllabus Registry for GATE 2027 ECE, CUET PG (SCQP17 & SCQP28), and NEET UG.
   Strictly aligns AI MCQ generation and unit dropdowns with official exam syllabi. */
(function () {
  'use strict';

  window.TEST_CENTRE_SYLLABI = {
    gate: {
      examLabel: 'GATE 2027 ECE (EC)',
      badge: 'Official IIT GATE 2027 EC Syllabus',
      subjects: {
        'gate-em': {
          source: 'GATE 2027 EC · Section 1: Engineering Mathematics',
          units: [
            {
              id: 'em-1',
              title: '1.1 Linear Algebra',
              topics: 'Vector space, basis, linear dependence and independence, matrix algebra, eigenvalues and eigenvectors, rank, solution of linear equations — existence and uniqueness.'
            },
            {
              id: 'em-2',
              title: '1.2 Calculus',
              topics: 'Mean value theorems, theorems of integral calculus, evaluation of definite and improper integrals, partial derivatives, maxima and minima, multiple integrals, line, surface and volume integrals, Taylor series.'
            },
            {
              id: 'em-3',
              title: '1.3 Differential Equations',
              topics: 'First order equations (linear and nonlinear), higher order linear differential equations, Cauchy’s and Euler’s equations, methods of solution using variation of parameters, complementary function and particular integral, partial differential equations, variable separable method, initial and boundary value problems.'
            },
            {
              id: 'em-4',
              title: '1.4 Vector Analysis',
              topics: 'Vectors in plane and space, vector operations, gradient, divergence and curl, Gauss’s, Green’s and Stokes’ theorems.'
            },
            {
              id: 'em-5',
              title: '1.5 Complex Analysis',
              topics: 'Analytic functions, Cauchy’s integral theorem, Cauchy’s integral formula; sequences, series, convergence tests, Taylor and Laurent series; residue theorem.'
            },
            {
              id: 'em-6',
              title: '1.6 Probability and Statistics',
              topics: 'Mean, median, mode, standard deviation; combinatorial probability, probability distributions (binomial, Poisson, exponential, normal), joint and conditional probability.'
            }
          ]
        },
        'gate-nt': {
          source: 'GATE 2027 EC · Section 2: Networks, Signals and Systems (Networks)',
          units: [
            {
              id: 'nt-1',
              title: '2.1 Circuit Analysis & Theorems',
              topics: 'Node and mesh analysis, superposition, Thevenin’s theorem, Norton’s theorem, reciprocity theorem, sinusoidal steady state analysis: phasors, complex power, maximum power transfer.'
            },
            {
              id: 'nt-2',
              title: '2.2 Time & Frequency Domain & Two-Port Networks',
              topics: 'Time and frequency domain analysis of linear circuits: RL, RC and RLC circuits, solution of network equations using Laplace transform; linear 2-port network parameters, wye-delta transformation.'
            }
          ]
        },
        'gate-ss': {
          source: 'GATE 2027 EC · Section 2: Networks, Signals and Systems (Signals)',
          units: [
            {
              id: 'ss-1',
              title: '2.3 Continuous-Time Signals & LTI Systems',
              topics: 'Representation of continuous-time signals, shifting and scaling properties, linear time-invariant and causal systems; LTI system properties: causality, stability, impulse response, convolution, poles and zeros, parallel and cascade structure, frequency response, group delay, phase delay.'
            },
            {
              id: 'ss-2',
              title: '2.4 Fourier Series, Fourier & Laplace Transforms & Sampling',
              topics: 'Fourier series representation of continuous-time periodic signals, sampling theorem, applications of Fourier transform and Laplace transform.'
            },
            {
              id: 'ss-3',
              title: '2.5 Discrete-Time Signals, DTFT, DFT & z-Transform',
              topics: 'Discrete-time signals: sequences, representation of signals on orthogonal basis, sampling and reconstruction; discrete systems: attributes, z-Transform, analysis of LSI systems, frequency analysis, inverse systems, discrete Fourier transform (DFT), fast Fourier transform algorithm, implementation of discrete time systems.'
            }
          ]
        },
        'gate-ed': {
          source: 'GATE 2027 EC · Section 3: Electronic Devices',
          units: [
            {
              id: 'ed-1',
              title: '3.1 Semiconductor Physics & Carrier Transport',
              topics: 'Energy bands in intrinsic and extrinsic semiconductors, equilibrium carrier concentration, direct and indirect band-gap semiconductors. Carrier transport: diffusion current, drift current, mobility and resistivity, generation and recombination of carriers, Poisson and continuity equations.'
            },
            {
              id: 'ed-2',
              title: '3.2 Junctions, BJT & Optoelectronic Devices',
              topics: 'P-N junction, Zener diode, BJT, LED, photodiode and solar cell.'
            },
            {
              id: 'ed-3',
              title: '3.3 MOS Capacitor & MOSFET Physics',
              topics: 'MOS capacitor, MOSFET, I-V characteristics, and scaling.'
            }
          ]
        },
        'gate-ac': {
          source: 'GATE 2027 EC · Section 4: Analog Circuits',
          units: [
            {
              id: 'ac-1',
              title: '4.1 Diode Circuits',
              topics: 'Diode circuits: clipping, clamping and rectifiers.'
            },
            {
              id: 'ac-2',
              title: '4.2 BJT & MOSFET Amplifiers',
              topics: 'BJT and MOSFET amplifiers: biasing, AC coupling, small signal analysis, frequency response. Current mirrors and differential amplifiers.'
            },
            {
              id: 'ac-3',
              title: '4.3 Op-Amp Circuits, Filters & Oscillators',
              topics: 'Op-amp circuits: amplifiers, summers, differentiators, integrators, active filters, Schmitt triggers and oscillators. Feedback topologies, Miller compensation, stability and phase margin.'
            }
          ]
        },
        'gate-dc': {
          source: 'GATE 2027 EC · Section 5: Digital Circuits',
          units: [
            {
              id: 'dc-1',
              title: '5.1 Number Representations & Combinational Logic',
              topics: 'Number representations: binary, integer and floating-point numbers. Combinatorial circuits: Boolean algebra, minimization of functions using Boolean identities and Karnaugh map, logic gates and their static CMOS implementations, arithmetic circuits, code converters, multiplexers, decoders.'
            },
            {
              id: 'dc-2',
              title: '5.2 Sequential Circuits & Timing',
              topics: 'Sequential circuits: latches and flip-flops, counters, shift-registers, finite state machines, propagation delay, setup and hold time, critical path delay.'
            },
            {
              id: 'dc-3',
              title: '5.3 Data Converters & Semiconductor Memories',
              topics: 'Data converters: sample and hold circuits, ADCs and DACs. Semiconductor memories: ROM, SRAM, DRAM.'
            },
            {
              id: 'dc-4',
              title: '5.4 Computer Organization',
              topics: 'Computer organization: machine instructions and addressing modes, ALU, data-path and control unit, instruction pipelining.'
            }
          ]
        },
        'gate-cs': {
          source: 'GATE 2027 EC · Section 6: Control Systems',
          units: [
            {
              id: 'cs-1',
              title: '6.1 Modelling, Feedback & Time Response',
              topics: 'Basic control system components; feedback principle; transfer function; block diagram representation; signal flow graph; transient and steady-state analysis of LTI systems.'
            },
            {
              id: 'cs-2',
              title: '6.2 Stability & Frequency Response',
              topics: 'Frequency response; Routh-Hurwitz and Nyquist stability criteria; Bode and root-locus plots.'
            },
            {
              id: 'cs-3',
              title: '6.3 Compensators, PID & State-Space Analysis',
              topics: 'Lag, lead and lag-lead compensation; PID controllers; state-space representation and solution of state equation of LTI systems.'
            }
          ]
        },
        'gate-comm': {
          source: 'GATE 2027 EC · Section 7: Communications',
          units: [
            {
              id: 'comm-1',
              title: '7.1 Random Processes & Analog Communication',
              topics: 'Random processes: autocorrelation and power spectral density, properties of white noise, filtering of random signals through LTI systems. Analog communications: amplitude modulation and demodulation, angle modulation and demodulation, spectra of AM and FM, superheterodyne receivers.'
            },
            {
              id: 'comm-2',
              title: '7.2 Information Theory',
              topics: 'Information theory: entropy, mutual information and channel capacity theorem.'
            },
            {
              id: 'comm-3',
              title: '7.3 Digital Communication & Error Control Coding',
              topics: 'Digital communications: PCM, DPCM, digital modulation schemes (ASK, PSK, FSK, QAM), bandwidth, inter-symbol interference, MAP, ML detection, matched filter receiver, SNR and BER. Fundamentals of error correction, Hamming codes, CRC.'
            }
          ]
        },
        'gate-emt': {
          source: 'GATE 2027 EC · Section 8: Electromagnetics',
          units: [
            {
              id: 'emt-1',
              title: '8.1 Maxwell’s Equations & Plane Waves',
              topics: 'Maxwell’s equations: differential and integral forms and their interpretation, boundary conditions, wave equation, Poynting vector. Plane waves and properties: reflection and refraction, polarization, phase and group velocity, propagation through various media, skin depth.'
            },
            {
              id: 'emt-2',
              title: '8.2 Transmission Lines & Waveguides',
              topics: 'Transmission lines: equations, characteristic impedance, impedance matching, impedance transformation, S-parameters, Smith chart. Rectangular and circular waveguides, light propagation in optical fibers.'
            },
            {
              id: 'emt-3',
              title: '8.3 Antennas & Arrays',
              topics: 'Dipole and monopole antennas, linear antenna arrays.'
            }
          ]
        },
        'gate-ga': {
          source: 'GATE 2027 · General Aptitude (GA)',
          units: [
            {
              id: 'ga-1',
              title: 'GA 1: Verbal Aptitude',
              topics: 'Basic English grammar: tenses, articles, adjectives, prepositions, conjunctions, verb-noun agreement; vocabulary: words, idioms and phrases in context; reading and comprehension; narrative sequencing.'
            },
            {
              id: 'ga-2',
              title: 'GA 2: Quantitative Aptitude',
              topics: 'Data interpretation (bar graphs, pie charts, tables, 2D/3D plots); numerical computation and estimation: ratios, percentages, powers, exponents, logarithms, permutations and combinations, series; mensuration and geometry; elementary statistics and probability.'
            },
            {
              id: 'ga-3',
              title: 'GA 3: Analytical & Spatial Aptitude',
              topics: 'Logic: deduction and induction, analogy, numerical relations and reasoning; spatial transformations: translation, rotation, scaling, mirroring, assembling, grouping, paper folding and cutting.'
            }
          ]
        }
      }
    },

    'cuet-pg': {
      examLabel: 'CUET PG (NTA)',
      badge: 'Official CUET PG (SCQP17 & SCQP28) Syllabus',
      subjects: {
        'cuet-life-sciences': {
          source: 'CUET PG Life Sciences · SCQP17 (75 MCQs · +4/−1)',
          units: [
            {
              id: 'ls-1',
              title: 'Unit 1: Techniques',
              topics: 'Principles and applications of chromatography, spectroscopy, microscopy, electrophoresis, centrifugation, blotting, PCR & radioisotope techniques.'
            },
            {
              id: 'ls-2',
              title: 'Unit 2: Chromatin Structure & Function',
              topics: 'Organization of chromosomes in prokaryotes and eukaryotes, chromatin types, centromere, telomere and concept of gene.'
            },
            {
              id: 'ls-3',
              title: 'Unit 3: Biochemistry',
              topics: 'Structure and functions of proteins, DNA, carbohydrates, lipids & vitamins; Bioenergetics, Glycolysis, TCA cycle, Electron Transport System and ATP synthesis, oxidation and synthesis of fatty acid, membrane structure and function.'
            },
            {
              id: 'ls-4',
              title: 'Unit 4: Biotechnology',
              topics: 'Recombinant DNA technology, principles of gene cloning, applications of biotechnology in medicine, industry and agriculture, animal & plant cell culture, environmental biotechnology.'
            },
            {
              id: 'ls-5',
              title: 'Unit 5: Microbiology',
              topics: 'Diversity of microbes, bacterial reproduction, antimicrobial agents, significance of microbes in industry and agriculture, antigen, antibody, complement systems, immunity, vaccines, plant virus, animal virus and environmental microbiology.'
            },
            {
              id: 'ls-6',
              title: 'Unit 6: Molecular Genetics',
              topics: 'Principles of inheritance, linkage & crossing over, chromosomal aberrations, extrachromosomal inheritance, replication, transcription, translation, DNA repair and population genetics.'
            },
            {
              id: 'ls-7',
              title: 'Unit 7: Plant Sciences',
              topics: 'Bryophytes, Pteridophytes, Gymnosperms, Angiosperms, vascular system in plants, economic importance of plants, photosynthesis, photoperiodism, vernalization, and biogeochemical cycle.'
            },
            {
              id: 'ls-8',
              title: 'Unit 8: Animal Sciences',
              topics: 'Characteristics of invertebrates and vertebrates, anatomy and physiology of different systems of humans, nerve impulse transmission, endocrinology, human diseases, apoptosis and cancer, inherited diseases, animal cell culture.'
            }
          ]
        },
        'cuet-zoology': {
          source: 'CUET PG Zoology · SCQP28 (75 MCQs · +4/−1)',
          units: [
            {
              id: 'zoo-1',
              title: 'Unit 1: Cell Biology',
              topics: 'Cell organelles, plasma membrane structure and transport, cytoskeleton, cell cycle, mitosis, meiosis, and cell signaling.'
            },
            {
              id: 'zoo-2',
              title: 'Unit 2: Biochemistry',
              topics: 'Structure and metabolism of carbohydrates, lipids, proteins and nucleic acids; enzymes, enzyme kinetics, vitamins, and bioenergetics.'
            },
            {
              id: 'zoo-3',
              title: 'Unit 3: Molecular Biology',
              topics: 'DNA replication, transcription, RNA processing, genetic code, translation, gene regulation (lac & trp operons), and DNA repair mechanisms.'
            },
            {
              id: 'zoo-4',
              title: 'Unit 4: Ecology',
              topics: 'Ecosystem structure and function, energy flow, food chains and webs, population growth models, community interactions, ecological succession, and biogeochemical cycles.'
            },
            {
              id: 'zoo-5',
              title: 'Unit 5: Evolution',
              topics: 'Origin of life, evolutionary theories (Lamarckism, Darwinism, Neo-Darwinism), Hardy-Weinberg equilibrium, genetic drift, natural selection, speciation, and phylogenetic patterns.'
            },
            {
              id: 'zoo-6',
              title: 'Unit 6: Biodiversity & Environment Conservation',
              topics: 'Biodiversity hotspots, IUCN Red List categories, threats to biodiversity, in-situ and ex-situ conservation strategies, national parks, wildlife sanctuaries, and environmental protection.'
            },
            {
              id: 'zoo-7',
              title: 'Unit 7: Immunology',
              topics: 'Innate and adaptive immunity, lymphoid organs, B and T lymphocytes, immunoglobulin classes, MHC molecules, antigen-antibody reactions, hypersensitivity, and vaccines.'
            },
            {
              id: 'zoo-8',
              title: 'Unit 8: Genetics',
              topics: 'Mendelian inheritance and deviations, linkage and gene mapping, sex determination and dosage compensation, chromosomal aberrations, mutation, and pedigree analysis.'
            },
            {
              id: 'zoo-9',
              title: 'Unit 9: Bio Techniques',
              topics: 'Light, phase-contrast and electron microscopy, centrifugation, chromatography, gel electrophoresis, PCR, blotting, ELISA, RIA, and spectrophotometry.'
            },
            {
              id: 'zoo-10',
              title: 'Unit 10: Vertebrates and Invertebrates',
              topics: 'Taxonomic classification, general characteristics, larval forms, coelom, symmetry, and comparative anatomy of chordates and non-chordates.'
            },
            {
              id: 'zoo-11',
              title: 'Unit 11: Developmental Biology',
              topics: 'Gametogenesis, fertilization, cleavage patterns, blastulation, gastrulation, fate maps, embryonic induction, organogenesis, metamorphosis, and regeneration.'
            },
            {
              id: 'zoo-12',
              title: 'Unit 12: Biostatistics',
              topics: 'Measures of central tendency (mean, median, mode), dispersion (standard deviation, variance), probability distributions, chi-square test, student t-test, ANOVA, and correlation/regression.'
            },
            {
              id: 'zoo-13',
              title: 'Unit 13: Animal Physiology',
              topics: 'Digestion, respiration, blood and circulation, excretion and osmoregulation, nerve impulse conduction, muscle contraction, sensory organs, and endocrine regulation.'
            },
            {
              id: 'zoo-14',
              title: 'Unit 14: Recombinant DNA Technology',
              topics: 'Restriction endonucleases, cloning and expression vectors, cDNA and genomic libraries, gene cloning, transgenic animals, CRISPR/gene editing, and biomedical applications.'
            }
          ]
        }
      }
    },

    neet: {
      examLabel: 'NEET UG (NTA)',
      badge: 'NTA NEET UG Official NCERT Syllabus',
      subjects: {
        'neet-bio': {
          source: 'NEET UG Biology · Class 11 & 12 NCERT',
          units: [
            { id: 'bio-1', title: 'Unit 1: Diversity in Living World', topics: 'Five kingdom classification, biological classification, plant kingdom (algae to angiosperms), animal kingdom chordates and non-chordates.' },
            { id: 'bio-2', title: 'Unit 2: Structural Organisation in Animals & Plants', topics: 'Morphology and anatomy of flowering plants, animal tissues, structural organization of frog and cockroach.' },
            { id: 'bio-3', title: 'Unit 3: Cell Structure & Function', topics: 'Prokaryotic & eukaryotic cell organelles, biomolecules, enzymes, cell cycle, mitosis and meiosis.' },
            { id: 'bio-4', title: 'Unit 4: Plant Physiology', topics: 'Photosynthesis in higher plants, cellular respiration, plant growth and regulators (auxin, gibberellin, cytokinin, ethylene, ABA).' },
            { id: 'bio-5', title: 'Unit 5: Human Physiology', topics: 'Breathing and gas exchange, body fluids & circulation, excretory products, locomotion & movement, neural control, chemical coordination and integration.' },
            { id: 'bio-6', title: 'Unit 6: Reproduction', topics: 'Sexual reproduction in flowering plants, human reproduction, gametogenesis, menstrual cycle, embryonic development, reproductive health.' },
            { id: 'bio-7', title: 'Unit 7: Genetics & Evolution', topics: 'Mendelian inheritance, molecular basis of inheritance (replication, transcription, translation, lac operon), human genome, evolutionary mechanisms and Hardy-Weinberg.' },
            { id: 'bio-8', title: 'Unit 8: Biology & Human Welfare', topics: 'Human health and disease, immunity, AIDS, cancer, drugs, microbes in household, industrial and sewage welfare.' },
            { id: 'bio-9', title: 'Unit 9: Biotechnology & Its Applications', topics: 'Principles and processes of biotechnology, rDNA tools, PCR, bioreactors, Bt crops, gene therapy, molecular diagnostics.' },
            { id: 'bio-10', title: 'Unit 10: Ecology & Environment', topics: 'Organisms and populations, ecosystem productivity and pyramids, biodiversity conservation, hotspots and red data book.' }
          ]
        },
        'neet-phy': {
          source: 'NEET UG Physics · Class 11 & 12 NCERT',
          units: [
            { id: 'phy-1', title: 'Unit 1: Kinematics & Laws of Motion', topics: 'Units and dimensions, errors, motion in 1D/2D, projectile, Newton’s laws, friction, circular motion dynamics.' },
            { id: 'phy-2', title: 'Unit 2: Work, Energy, Rotational Motion & Gravitation', topics: 'Work-energy theorem, conservative forces, collisions, moment of inertia, angular momentum, rolling, Kepler’s laws, orbital & escape velocity.' },
            { id: 'phy-3', title: 'Unit 3: Bulk Matter, Thermodynamics & KTG', topics: 'Elasticity, fluid mechanics, viscosity, surface tension, thermal properties, laws of thermodynamics, Carnot engine, kinetic theory of gases.' },
            { id: 'phy-4', title: 'Unit 4: Oscillations & Waves', topics: 'SHM, pendulum, damped/undamped energy, progressive waves, Doppler shift in sound, standing waves, organ pipes, beats.' },
            { id: 'phy-5', title: 'Unit 5: Electrostatics & Current Electricity', topics: 'Coulomb’s law, Gauss’s law, electric potential, capacitors, Ohm’s law, Kirchhoff’s laws, Wheatstone bridge, meter bridge, potentiometer concepts.' },
            { id: 'phy-6', title: 'Unit 6: Magnetism, EMI & AC Circuits', topics: 'Biot-Savart, Ampere’s law, Lorentz force, Faraday & Lenz laws, self & mutual inductance, LCR AC resonance, transformers, EM waves.' },
            { id: 'phy-7', title: 'Unit 7: Ray & Wave Optics', topics: 'Mirrors, lenses, prism, optical instruments, Huygens principle, Young’s double-slit interference, diffraction, polarization.' },
            { id: 'phy-8', title: 'Unit 8: Modern Physics & Electronic Devices', topics: 'Photoelectric effect, de Broglie wavelength, Bohr atom, radioactivity & binding energy, p-n junction diode, Zener regulator, logic gates.' }
          ]
        },
        'neet-chem': {
          source: 'NEET UG Chemistry · Physical, Organic & Inorganic NCERT',
          units: [
            { id: 'chem-1', title: 'Unit 1: Atomic Structure & Mole Concept', topics: 'Stoichiometry, limiting reagent, Bohr model, quantum numbers, electronic configuration, periodic trends.' },
            { id: 'chem-2', title: 'Unit 2: Bonding, Thermodynamics & Equilibrium', topics: 'VSEPR, hybridization, MOT, enthalpy, entropy, Gibbs energy, Kp/Kc, Le Chatelier, ionic equilibrium, pH & buffers, solubility product.' },
            { id: 'chem-3', title: 'Unit 3: Solutions, Electrochemistry & Kinetics', topics: 'Raoult’s law, colligative properties, Nernst equation, conductance, Kohlrausch’s law, rate law, order, Arrhenius equation.' },
            { id: 'chem-4', title: 'Unit 4: Inorganic p, d, f-Block & Coordination', topics: 'Periodic group trends, transition metals, lanthanoids, crystal field splitting, isomerism and IUPAC naming of coordination compounds.' },
            { id: 'chem-5', title: 'Unit 5: GOC, Hydrocarbons & Haloalkanes', topics: 'Inductive, resonance, hyperconjugation, carbocation stability, isomerism, alkanes/alkenes/alkynes/aromatics, SN1/SN2 and E1/E2 reactions.' },
            { id: 'chem-6', title: 'Unit 6: Oxygen, Nitrogen Compounds & Biomolecules', topics: 'Alcohols, phenols, ethers, aldehydes, ketones, carboxylic acids, amines, diazonium salts, carbohydrates, amino acids, proteins, nucleic acids.' }
          ]
        }
      }
    }
  };
})();
