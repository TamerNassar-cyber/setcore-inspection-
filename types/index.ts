import type { StandardCode, InspectionResult, DefectType, PipeCategory } from '../constants/standards';

export type UserRole = 'inspector' | 'supervisor' | 'management' | 'client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company: string;
  phone?: string;
  avatar_url?: string;
}

export interface Qualification {
  id: string;
  inspector_id: string;
  cert_type: string;
  cert_number: string;
  issued_date: string;
  expiry_date: string;
  document_url?: string;
  is_expired: boolean;
  days_until_expiry: number;
}

export type JobStatus = 'draft' | 'active' | 'completed' | 'approved' | 'cancelled';

export interface Job {
  id: string;
  job_number: string;
  client: string;
  rig: string;
  well: string;
  field?: string;
  country: string;
  standard: StandardCode;
  pipe_category: PipeCategory;
  status: JobStatus;
  created_by: string;
  assigned_inspectors: string[];
  created_at: string;
  updated_at: string;
  notes?: string;
}

export type RunStatus = 'active' | 'completed' | 'approved';

export interface InspectionRun {
  id: string;
  job_id: string;
  inspector_id: string;
  start_time: string;
  end_time?: string;
  status: RunStatus;
  location_lat?: number;
  location_lng?: number;
}

export interface Joint {
  id: string;
  run_id: string;
  joint_number: number;
  serial_number?: string;
  grade?: string;
  weight?: number;
  od?: number;
  length?: number;
  result: InspectionResult;
  notes?: string;
  inspected_at: string;
  synced: boolean;
}

export interface Defect {
  id: string;
  joint_id: string;
  defect_type: DefectType;
  location?: string;
  severity: 'minor' | 'major' | 'critical';
  description?: string;
  photo_url?: string;
  photo_local_uri?: string;
  standard_reference?: string;
  synced: boolean;
}

export interface Tally {
  run_id: string;
  total_joints: number;
  accepted: number;
  rejected: number;
  failed: number;
  total_length_m: number;
  total_length_ft: number;
}

export interface Report {
  id: string;
  job_id: string;
  run_id?: string;
  pdf_url?: string;
  pdf_local_uri?: string;
  generated_by: string;
  generated_at: string;
}
