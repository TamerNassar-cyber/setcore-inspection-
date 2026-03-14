/**
 * Hand-crafted Supabase Database type derived from the confirmed schema.
 * Re-run `npx supabase gen types typescript --project-id lzclwevvexvvwhfvswhq`
 * (after `supabase login`) to regenerate from the live schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'inspector' | 'supervisor' | 'management' | 'client';
          company: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: 'inspector' | 'supervisor' | 'management' | 'client';
          company: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: 'inspector' | 'supervisor' | 'management' | 'client';
          company?: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          job_number: string;
          client: string;
          rig: string;
          well: string;
          field: string | null;
          country: string;
          standard: string;
          pipe_category: string;
          status: 'draft' | 'active' | 'completed' | 'approved' | 'cancelled';
          created_by: string;
          assigned_inspectors: string[];
          created_at: string;
          updated_at: string | null;
          notes: string | null;
        };
        Insert: {
          id: string;
          job_number: string;
          client: string;
          rig: string;
          well: string;
          field?: string | null;
          country: string;
          standard: string;
          pipe_category: string;
          status?: 'draft' | 'active' | 'completed' | 'approved' | 'cancelled';
          created_by: string;
          assigned_inspectors: string[];
          created_at?: string;
          updated_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          job_number?: string;
          client?: string;
          rig?: string;
          well?: string;
          field?: string | null;
          country?: string;
          standard?: string;
          pipe_category?: string;
          status?: 'draft' | 'active' | 'completed' | 'approved' | 'cancelled';
          created_by?: string;
          assigned_inspectors?: string[];
          created_at?: string;
          updated_at?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      inspection_runs: {
        Row: {
          id: string;
          job_id: string;
          inspector_id: string;
          start_time: string;
          end_time: string | null;
          status: 'active' | 'completed' | 'approved';
          location_lat: number | null;
          location_lng: number | null;
        };
        Insert: {
          id: string;
          job_id: string;
          inspector_id: string;
          start_time: string;
          end_time?: string | null;
          status?: 'active' | 'completed' | 'approved';
          location_lat?: number | null;
          location_lng?: number | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          inspector_id?: string;
          start_time?: string;
          end_time?: string | null;
          status?: 'active' | 'completed' | 'approved';
          location_lat?: number | null;
          location_lng?: number | null;
        };
        Relationships: [];
      };
      joints: {
        Row: {
          id: string;
          run_id: string;
          joint_number: number;
          serial_number: string | null;
          grade: string | null;
          weight: number | null;
          od: number | null;
          length: number | null;
          result: 'PASS' | 'FAIL' | 'REJECT';
          notes: string | null;
          inspected_at: string;
        };
        Insert: {
          id: string;
          run_id: string;
          joint_number: number;
          serial_number?: string | null;
          grade?: string | null;
          weight?: number | null;
          od?: number | null;
          length?: number | null;
          result: 'PASS' | 'FAIL' | 'REJECT';
          notes?: string | null;
          inspected_at: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          joint_number?: number;
          serial_number?: string | null;
          grade?: string | null;
          weight?: number | null;
          od?: number | null;
          length?: number | null;
          result?: 'PASS' | 'FAIL' | 'REJECT';
          notes?: string | null;
          inspected_at?: string;
        };
        Relationships: [];
      };
      defects: {
        Row: {
          id: string;
          joint_id: string;
          defect_type: string;
          location: string | null;
          severity: 'minor' | 'major' | 'critical';
          description: string | null;
          photo_url: string | null;
          standard_reference: string | null;
        };
        Insert: {
          id: string;
          joint_id: string;
          defect_type: string;
          location?: string | null;
          severity: 'minor' | 'major' | 'critical';
          description?: string | null;
          photo_url?: string | null;
          standard_reference?: string | null;
        };
        Update: {
          id?: string;
          joint_id?: string;
          defect_type?: string;
          location?: string | null;
          severity?: 'minor' | 'major' | 'critical';
          description?: string | null;
          photo_url?: string | null;
          standard_reference?: string | null;
        };
        Relationships: [];
      };
      qualifications: {
        Row: {
          id: string;
          inspector_id: string;
          cert_type: string;
          cert_number: string;
          issued_date: string;
          expiry_date: string;
          document_url: string | null;
        };
        Insert: {
          id: string;
          inspector_id: string;
          cert_type: string;
          cert_number: string;
          issued_date: string;
          expiry_date: string;
          document_url?: string | null;
        };
        Update: {
          id?: string;
          inspector_id?: string;
          cert_type?: string;
          cert_number?: string;
          issued_date?: string;
          expiry_date?: string;
          document_url?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// ── Convenience aliases ────────────────────────────────────────────────────────

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
