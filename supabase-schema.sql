-- Setcore Inspection App — Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'inspector' CHECK (role IN ('inspector','supervisor','management','client')),
  company TEXT NOT NULL DEFAULT 'Setcore Petroleum Services',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspector Qualifications
CREATE TABLE IF NOT EXISTS public.qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  cert_type TEXT NOT NULL,
  cert_number TEXT NOT NULL,
  issued_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY,
  job_number TEXT NOT NULL,
  client TEXT NOT NULL,
  rig TEXT NOT NULL,
  well TEXT NOT NULL,
  field TEXT,
  country TEXT NOT NULL,
  standard TEXT NOT NULL,
  pipe_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.users(id),
  assigned_inspectors JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Runs
CREATE TABLE IF NOT EXISTS public.inspection_runs (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES public.users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  location_lat FLOAT,
  location_lng FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Joints
CREATE TABLE IF NOT EXISTS public.joints (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES public.inspection_runs(id) ON DELETE CASCADE,
  joint_number INTEGER NOT NULL,
  serial_number TEXT,
  grade TEXT,
  weight FLOAT,
  od FLOAT,
  length FLOAT,
  result TEXT NOT NULL CHECK (result IN ('PASS','FAIL','REJECT')),
  notes TEXT,
  inspected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defects
CREATE TABLE IF NOT EXISTS public.defects (
  id UUID PRIMARY KEY,
  joint_id UUID REFERENCES public.joints(id) ON DELETE CASCADE,
  defect_type TEXT NOT NULL,
  location TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('minor','major','critical')),
  description TEXT,
  photo_url TEXT,
  standard_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id),
  run_id UUID REFERENCES public.inspection_runs(id),
  pdf_url TEXT,
  generated_by UUID REFERENCES public.users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.joints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read all, write their own
CREATE POLICY "Users can view all" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "All authenticated can read jobs" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inspectors can create jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Inspectors can update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "All can read runs" ON public.inspection_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inspectors can create runs" ON public.inspection_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = inspector_id);

CREATE POLICY "All can read joints" ON public.joints FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated can insert joints" ON public.joints FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All can read defects" ON public.defects FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated can insert defects" ON public.defects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All can read qualifications" ON public.qualifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Own qualifications" ON public.qualifications FOR ALL TO authenticated USING (auth.uid() = inspector_id);

CREATE POLICY "All can read reports" ON public.reports FOR SELECT TO authenticated USING (true);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, company)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'inspector'),
    COALESCE(new.raw_user_meta_data->>'company', 'Setcore Petroleum Services')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
