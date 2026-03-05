export type StandardCode =
  | 'API_5CT'
  | 'API_5B'
  | 'API_5C1'
  | 'API_5DP'
  | 'API_7_1'
  | 'API_7_2'
  | 'API_RP_7G'
  | 'API_RP_7G_2'
  | 'API_11D1'
  | 'DS1_CAT1'
  | 'DS1_CAT2'
  | 'DS1_CAT3'
  | 'DS1_CAT4'
  | 'DS1_CAT5'
  | 'NS2'
  | 'ADNOC'
  | 'ARAMCO'
  | 'KOC';

export type PipeCategory = 'OCTG' | 'DRILL_STRING' | 'DOWNHOLE_TOOL';

export interface Standard {
  code: StandardCode;
  name: string;
  fullName: string;
  category: PipeCategory;
  description: string;
}

export const STANDARDS: Standard[] = [
  // OCTG
  { code: 'API_5CT', name: 'API 5CT', fullName: 'API Specification 5CT', category: 'OCTG', description: 'Casing and Tubing' },
  { code: 'API_5B', name: 'API 5B', fullName: 'API Specification 5B', category: 'OCTG', description: 'Threading, Gauging and Inspection of Casing, Tubing and Line Pipe Threads' },
  { code: 'API_5C1', name: 'API 5C1', fullName: 'API Recommended Practice 5C1', category: 'OCTG', description: 'Care and Use of Casing and Tubing' },
  { code: 'NS2', name: 'NS-2', fullName: 'TH Hill NS-2', category: 'OCTG', description: 'New and Used Tubular Inspection' },
  // Drill String
  { code: 'API_5DP', name: 'API 5DP', fullName: 'API Specification 5DP', category: 'DRILL_STRING', description: 'Drill Pipe' },
  { code: 'API_7_1', name: 'API 7-1', fullName: 'API Specification 7-1', category: 'DRILL_STRING', description: 'Rotary Drill Stem Elements' },
  { code: 'API_7_2', name: 'API 7-2', fullName: 'API Specification 7-2', category: 'DRILL_STRING', description: 'Threading and Gauging of Rotary Shouldered Connections' },
  { code: 'API_RP_7G', name: 'API RP 7G', fullName: 'API RP 7G', category: 'DRILL_STRING', description: 'Drill Stem Design and Operating Limits' },
  { code: 'API_RP_7G_2', name: 'API RP 7G-2', fullName: 'API RP 7G-2', category: 'DRILL_STRING', description: 'Inspection and Classification of Used Drill Stem Elements' },
  { code: 'DS1_CAT1', name: 'DS-1 Cat 1', fullName: 'TH Hill DS-1 Category 1', category: 'DRILL_STRING', description: 'Visual inspection only' },
  { code: 'DS1_CAT2', name: 'DS-1 Cat 2', fullName: 'TH Hill DS-1 Category 2', category: 'DRILL_STRING', description: 'Visual + dimensional inspection' },
  { code: 'DS1_CAT3', name: 'DS-1 Cat 3', fullName: 'TH Hill DS-1 Category 3', category: 'DRILL_STRING', description: 'Visual + dimensional + NDT' },
  { code: 'DS1_CAT4', name: 'DS-1 Cat 4', fullName: 'TH Hill DS-1 Category 4', category: 'DRILL_STRING', description: 'Full NDT inspection' },
  { code: 'DS1_CAT5', name: 'DS-1 Cat 5', fullName: 'TH Hill DS-1 Category 5', category: 'DRILL_STRING', description: 'Most rigorous inspection' },
  // Downhole
  { code: 'API_11D1', name: 'API 11D1', fullName: 'API Specification 11D1', category: 'DOWNHOLE_TOOL', description: 'Packers and Bridge Plugs' },
  // Client supplements
  { code: 'ADNOC', name: 'ADNOC', fullName: 'ADNOC Supplemental Requirements', category: 'OCTG', description: 'Abu Dhabi National Oil Company requirements' },
  { code: 'ARAMCO', name: 'Saudi Aramco', fullName: 'Saudi Aramco SAES-L-610', category: 'OCTG', description: 'Saudi Aramco tubular inspection requirements' },
  { code: 'KOC', name: 'KOC', fullName: 'Kuwait Oil Company Standards', category: 'OCTG', description: 'Kuwait Oil Company requirements' },
];

export type InspectionResult = 'PASS' | 'FAIL' | 'REJECT';

export type DefectType =
  | 'DRIFT'
  | 'THREAD_DAMAGE'
  | 'CORROSION'
  | 'BODY_DEFECT'
  | 'COUPLING_DEFECT'
  | 'PITTING'
  | 'WASH'
  | 'SLIP_CUT'
  | 'MECHANICAL_DAMAGE'
  | 'DIMENSIONAL'
  | 'COATING'
  | 'OTHER';

export const DEFECT_TYPES: { code: DefectType; label: string }[] = [
  { code: 'DRIFT', label: 'Drift / ID Restriction' },
  { code: 'THREAD_DAMAGE', label: 'Thread Damage' },
  { code: 'CORROSION', label: 'Corrosion' },
  { code: 'BODY_DEFECT', label: 'Body Defect' },
  { code: 'COUPLING_DEFECT', label: 'Coupling Defect' },
  { code: 'PITTING', label: 'Pitting' },
  { code: 'WASH', label: 'Wash / Erosion' },
  { code: 'SLIP_CUT', label: 'Slip Cut' },
  { code: 'MECHANICAL_DAMAGE', label: 'Mechanical Damage' },
  { code: 'DIMENSIONAL', label: 'Dimensional Non-conformance' },
  { code: 'COATING', label: 'Coating Defect' },
  { code: 'OTHER', label: 'Other' },
];

export const PIPE_GRADES = ['J55', 'K55', 'N80', 'L80', 'C90', 'T95', 'P110', 'Q125', 'V150', 'S135', 'G105', 'E75', 'X95'];

// ── Acceptance Criteria Reference (API 5CT / DS-1 / NS-2 guidance) ────────────
// These are field-guidance criteria. Always verify against the applicable standard.
export interface AcceptanceCriteria {
  pass: string[];
  fail: string[];
  reject: string[];
  note?: string;
}

export const DEFECT_CRITERIA: Record<DefectType, AcceptanceCriteria> = {
  DRIFT: {
    pass: ['Full drift mandrel passes without restriction'],
    fail: ['Slight restriction — re-clean and re-drift before final verdict'],
    reject: ['Drift mandrel cannot pass — ID is non-conforming'],
    note: 'API 5CT §10.4 / NS-2 §6.3: Drift test required on all OCTG',
  },
  THREAD_DAMAGE: {
    pass: ['Minor surface rust removable by cleaning', 'No form deviation after cleaning'],
    fail: ['Thread surface damage ≤ 1 thread — can be re-cut or replaced', 'Light galling repairable by running tool'],
    reject: ['Damaged, missing, or broken threads > 1', 'Severe galling, torn crests, or non-conforming thread form', 'Coupling with damaged last-engagement threads'],
    note: 'API 5B §7 / NS-2 §5.4: All threads must gauge within tolerance',
  },
  CORROSION: {
    pass: ['Light surface rust — no pitting, removable with wire brush', 'Rust staining on body only'],
    fail: ['Scattered pitting depth < 12.5% nominal wall', 'Surface corrosion area < 10% of pipe surface'],
    reject: ['Pitting depth ≥ 12.5% of nominal wall thickness', 'General corrosion reducing wall to < 87.5% nominal', 'Corrosion extending to thread roots'],
    note: 'API 5CT §10.2 / NS-2 §6.1: Nominal wall = specified wall per grade',
  },
  BODY_DEFECT: {
    pass: ['Cosmetic surface marks < 1/8" depth with no sharp bottom'],
    fail: ['Dent or gouge without crack, depth < 10% wall, length < 1/2 OD', 'Lap or seam < 5% wall depth'],
    reject: ['Any crack or seam — regardless of depth', 'Gouge with stress raiser (sharp bottom)', 'Dent depth > 10% wall or with crack'],
    note: 'API 5CT §10.3: Defects that impair structural integrity require rejection',
  },
  COUPLING_DEFECT: {
    pass: ['Coupling tight, properly made-up, threads conform'],
    fail: ['Coupling loose but threads not damaged — re-torque and re-inspect', 'Minor face damage not affecting seal'],
    reject: ['Missing coupling', 'Coupling cracked or split', 'Thread damage on coupling > 1 thread'],
    note: 'NS-2 §5.5 / API 5CT §10.6: Coupling condition critical for pressure integrity',
  },
  PITTING: {
    pass: ['Pitting depth < 5% of nominal wall, isolated, no sharp bottoms'],
    fail: ['Pitting depth 5–12.5% of nominal wall', 'Cluster pitting area < 3 sq inches'],
    reject: ['Pitting depth > 12.5% of nominal wall', 'Cluster pitting area > 3 sq inches', 'Pitting on thread flanks or roots'],
    note: 'NS-2 §6.2: Measure deepest pit with pit depth gauge relative to pipe surface',
  },
  WASH: {
    pass: ['No evidence of erosion or wash-out'],
    fail: ['Minor erosion on body only, depth < 10% wall'],
    reject: ['Thread wash — any depth', 'Body wash reducing wall < 87.5% nominal', 'Wash-out on connection seal area'],
    note: 'API RP 7G-2 §7.8: Wash on drill string connections is immediate reject',
  },
  SLIP_CUT: {
    pass: ['No slip marks present'],
    fail: ['Slip marks depth < 10% wall, cumulative length < 6 inches on any single mark'],
    reject: ['Slip cut depth > 10% nominal wall', 'Multiple slip cuts reducing effective wall', 'Sharp-bottomed cuts with cracking'],
    note: 'DS-1 §3.2: Slip-cut severity directly relates to compression service fitness',
  },
  MECHANICAL_DAMAGE: {
    pass: ['Cosmetic marks, no sharp edges, < 1/16" depth, no cracks'],
    fail: ['Dent without wall reduction, depth < 1/4" no sharp bottom', 'Minor impact mark with smooth contour'],
    reject: ['Dent with associated crack or sharp defect', 'Impact damage reducing OD by > 1%', 'Any damage to connection face or thread'],
    note: 'API 5CT §10.3: Assess for cracking using MPI or LPI after mechanical damage',
  },
  DIMENSIONAL: {
    pass: ['OD within API 5CT table tolerance', 'Wall thickness ≥ 87.5% of nominal'],
    fail: ['OD slightly out of tolerance — measure full pipe for pattern'],
    reject: ['OD outside API 5CT tolerance limits', 'Wall thickness < 87.5% of nominal at any point', 'Length outside purchased specification'],
    note: 'API 5CT §10.1: Measure OD at minimum 4 points around circumference per joint',
  },
  COATING: {
    pass: ['Coating intact, bonded, no holidays or disbondment', 'Minor handling marks within spec'],
    fail: ['Small holidays (< 4 sq cm) repairable per coating spec', 'Coating disbonded at cut ends only'],
    reject: ['Widespread coating disbondment on pipe body', 'Coating failure in corrosive service beyond repair spec', 'Internal coating disbondment > acceptance limit'],
    note: 'Verify acceptance limits against specific coating product specification',
  },
  OTHER: {
    pass: ['Document defect fully with photo', 'Engineering review recommended'],
    fail: ['Defect does not meet reject criteria but does not meet pass — consult supervisor'],
    reject: ['Defect renders pipe unfit for service in the opinion of the inspector'],
    note: 'Document all observations. Non-standard defects require supervisor sign-off.',
  },
};

export const NDT_METHODS = ['UT', 'MPI', 'LPI', 'VT', 'EMI', 'RFET', 'TOFD'];

export const CERT_TYPES = [
  'DS-1 Certification',
  'NS-2 Certification',
  'ASNT NDT Level I',
  'ASNT NDT Level II',
  'ASNT NDT Level III',
  'PCN Level I',
  'PCN Level II',
  'PCN Level III',
  'ADNOC Approved Inspector',
  'Saudi Aramco Approved Inspector',
  'KOC Approved Inspector',
  'Medical Eyesight Certificate',
  'API Training Certificate',
];
