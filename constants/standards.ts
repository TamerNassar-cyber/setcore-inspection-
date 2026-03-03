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
