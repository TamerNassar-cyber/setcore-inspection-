-- ============================================================
-- Setcore Inspection — Phase 2 Migration
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Allow supervisors and management to update any job (for approvals)
CREATE POLICY "Supervisors can update any job" ON public.jobs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('supervisor', 'management')
    )
  );

-- 2. Allow inspectors/anyone to INSERT into qualifications
--    (current policy only allows ALL which requires inspector_id = auth.uid())
-- The existing "Own qualifications" policy covers INSERT correctly — no change needed.

-- 3. Storage bucket for defect photos
--    (Run this ONLY if the bucket does not already exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('defect-photos', 'defect-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for defect-photos bucket
CREATE POLICY "Authenticated users can upload defect photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'defect-photos');

CREATE POLICY "Defect photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'defect-photos');

CREATE POLICY "Users can delete own defect photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'defect-photos' AND auth.uid() = owner);

-- 5. Add missing UPDATE policy for inspection runs (supervisor completion)
CREATE POLICY "Supervisors can update inspection runs" ON public.inspection_runs
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = inspector_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('supervisor', 'management')
    )
  );

-- 6. Allow INSERT for qualifications by the owner
--    Supplement the existing "Own qualifications" ALL policy explicitly for INSERT
-- (The existing policy covers this — no change needed)

-- Done. Your Phase 2 features are now fully configured.
