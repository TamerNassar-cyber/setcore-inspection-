import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, StatusBar, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { format } from 'date-fns';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { getJob } from '../../lib/db/jobs';
import type { Job } from '../../types';
import 'react-native-get-random-values';
import Svg, { Path } from 'react-native-svg';

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 5l-7 7 7 7" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlayIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M5 3l14 9-14 9V3z" fill={Colors.white} stroke={Colors.white} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={Colors.white} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface RunSummary {
  id: string;
  job_id: string;
  inspector_id: string;
  inspector_name: string;
  start_time: string;
  end_time?: string;
  status: string;
  total_joints: number;
  accepted: number;
  failed: number;
  rejected: number;
  total_length_ft: number;
  defect_count: number;
}

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [userRole, setUserRole] = useState('inspector');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function loadData() {
    if (!jobId) { setLoading(false); return; }
    setLoading(true);

    try {
      // Load job + session in parallel
      const [localJob, { data: { session } }] = await Promise.all([
        getJob(jobId),
        supabase.auth.getSession(),
      ]);

      let j = localJob;
      if (!j) {
        const { data } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        j = data;
      }
      setJob(j);

      if (session?.user) {
        const { data: profile } = await supabase.from('users').select('role').eq('id', session.user.id).single();
        if (profile?.role) setUserRole(profile.role);
      }

      // Load runs + all users in parallel
      const [runsRes, usersRes] = await Promise.all([
        supabase.from('inspection_runs').select('*').eq('job_id', jobId).order('start_time', { ascending: false }),
        supabase.from('users').select('id,full_name'),
      ]);

      const runsData = runsRes.data ?? [];
      const userMap = new Map((usersRes.data ?? []).map((u: any) => [u.id, u.full_name]));
      const runIds = runsData.map(r => r.id);

      // Batch load joints + defects for all runs
      const { data: allJointsData } = runIds.length > 0
        ? await supabase.from('joints').select('id,run_id,result,length').in('run_id', runIds)
        : { data: [] };
      const allJoints = (allJointsData ?? []) as any[];

      const jointIds = allJoints.map(j => j.id);
      const { data: allDefectsData } = jointIds.length > 0
        ? await supabase.from('defects').select('id,joint_id', { count: 'exact' }).in('joint_id', jointIds)
        : { data: [], count: 0 };

      // Build Maps for O(1) lookups
      const jointsByRun = new Map<string, any[]>();
      for (const j of allJoints) {
        const arr = jointsByRun.get(j.run_id) ?? [];
        arr.push(j);
        jointsByRun.set(j.run_id, arr);
      }
      const defectCountByJoint = new Map<string, number>();
      for (const d of (allDefectsData ?? []) as any[]) {
        defectCountByJoint.set(d.joint_id, (defectCountByJoint.get(d.joint_id) ?? 0) + 1);
      }

      const summaries: RunSummary[] = runsData.map(run => {
        const joints = jointsByRun.get(run.id) ?? [];
        const tally = joints.reduce((acc: any, j: any) => ({
          total_joints: acc.total_joints + 1,
          accepted: acc.accepted + (j.result === 'PASS' ? 1 : 0),
          failed: acc.failed + (j.result === 'FAIL' ? 1 : 0),
          rejected: acc.rejected + (j.result === 'REJECT' ? 1 : 0),
          total_length_ft: acc.total_length_ft + (j.length ?? 0) * 3.28084,
        }), { total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_ft: 0 });

        const defect_count = joints.reduce((sum: number, j: any) => sum + (defectCountByJoint.get(j.id) ?? 0), 0);

        return {
          ...run,
          inspector_name: userMap.get(run.inspector_id) ?? 'Inspector',
          ...tally,
          defect_count,
        } as RunSummary;
      });

      setRuns(summaries);
    } catch (err) {
      console.error('Failed to load job detail:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [jobId]);

  async function handleCompleteJob() {
    Alert.alert('Complete Job?', 'Mark this job as complete and send for supervisor review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        style: 'destructive',
        onPress: async () => {
          setCompleting(true);
          const { error } = await supabase.from('jobs').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', jobId);
          setCompleting(false);
          if (error) { Alert.alert('Error', 'Failed to update job. Please try again.'); return; }
          setJob(prev => prev ? { ...prev, status: 'completed' } : prev);
          Alert.alert('Job Complete', 'The job has been submitted for supervisor approval.');
        }
      }
    ]);
  }

  async function handleApproveJob() {
    Alert.alert('Approve Job?', 'Approve this inspection job? This finalises the results.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setApproving(true);
          const { error } = await supabase.from('jobs').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', jobId);
          setApproving(false);
          if (error) { Alert.alert('Error', 'Failed to approve job. Please try again.'); return; }
          setJob(prev => prev ? { ...prev, status: 'approved' } : prev);
          Alert.alert('Approved', 'The job has been approved.');
        }
      }
    ]);
  }

  function startNewRun() {
    router.push({ pathname: '/(inspector)/inspection', params: { jobId } });
  }

  function continueRun(runId: string) {
    router.push({ pathname: '/(inspector)/inspection', params: { jobId, runId } });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading job…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Job not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: Colors.primary, fontWeight: '700' }}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canInspect = userRole === 'inspector' || userRole === 'supervisor' || userRole === 'management';
  const canComplete = canInspect && job.status === 'active';
  const canApprove = (userRole === 'supervisor' || userRole === 'management') && job.status === 'completed';
  const jobStatusConfig = statusConfig(job.status);

  // Totals across all runs
  const grandTotal = runs.reduce((acc, r) => ({
    total_joints: acc.total_joints + r.total_joints,
    accepted: acc.accepted + r.accepted,
    failed: acc.failed + r.failed,
    rejected: acc.rejected + r.rejected,
    total_length_ft: acc.total_length_ft + r.total_length_ft,
    defect_count: acc.defect_count + r.defect_count,
  }), { total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_ft: 0, defect_count: 0 });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <BackIcon />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerJobNum}>{job.job_number}</Text>
          <Text style={styles.headerClient}>{job.client}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: jobStatusConfig.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: jobStatusConfig.dot }]} />
          <Text style={[styles.statusText, { color: jobStatusConfig.text }]}>{jobStatusConfig.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Job Info Card */}
        <View style={styles.jobInfoCard}>
          <View style={styles.jobInfoGrid}>
            <InfoCell label="RIG" value={job.rig} />
            <InfoCell label="WELL" value={job.well} />
            <InfoCell label="COUNTRY" value={job.country} />
            <InfoCell label="STANDARD" value={job.standard.replace(/_/g, ' ')} highlight />
          </View>
          {job.field ? (
            <View style={styles.jobInfoExtra}>
              <Text style={styles.infoExtraLabel}>FIELD</Text>
              <Text style={styles.infoExtraValue}>{job.field}</Text>
            </View>
          ) : null}
          {job.notes ? (
            <View style={[styles.jobInfoExtra, { borderTopWidth: 1, borderTopColor: '#1F1F1F', marginTop: 8, paddingTop: 12 }]}>
              <Text style={styles.infoExtraLabel}>NOTES</Text>
              <Text style={styles.infoExtraValue}>{job.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Grand Tally (only if runs exist) */}
        {runs.length > 0 && (
          <View style={styles.grandTallyCard}>
            <Text style={styles.sectionLabel}>CUMULATIVE TOTALS</Text>
            <View style={styles.tallyRow}>
              <TallyCell label="JOINTS" value={grandTotal.total_joints} color={Colors.white} />
              <View style={styles.tallyDiv} />
              <TallyCell label="PASS" value={grandTotal.accepted} color="#22C55E" />
              <View style={styles.tallyDiv} />
              <TallyCell label="FAIL" value={grandTotal.failed} color={Colors.primary} />
              <View style={styles.tallyDiv} />
              <TallyCell label="REJECT" value={grandTotal.rejected} color="#DC2626" />
              <View style={styles.tallyDiv} />
              <TallyCell label="FOOTAGE" value={`${Math.round(grandTotal.total_length_ft)}'`} color="#60A5FA" />
            </View>
            {grandTotal.defect_count > 0 && (
              <View style={styles.defectBanner}>
                <Text style={styles.defectBannerText}>
                  ⚠ {grandTotal.defect_count} {grandTotal.defect_count === 1 ? 'defect' : 'defects'} logged
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Inspection Runs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inspection Runs</Text>
          {canInspect && job.status !== 'approved' && (
            <TouchableOpacity style={styles.newRunBtn} onPress={startNewRun} activeOpacity={0.8}>
              <PlayIcon />
              <Text style={styles.newRunText}>NEW RUN</Text>
            </TouchableOpacity>
          )}
        </View>

        {runs.length === 0 ? (
          <View style={styles.emptyRuns}>
            <Text style={styles.emptyRunsText}>No inspection runs yet.</Text>
            <Text style={styles.emptyRunsSub}>Tap New Run to start inspecting joints.</Text>
          </View>
        ) : (
          runs.map((run, idx) => {
            const pct = run.total_joints > 0 ? Math.round((run.accepted / run.total_joints) * 100) : 0;
            return (
              <TouchableOpacity
                key={run.id}
                style={styles.runCard}
                onPress={() => continueRun(run.id)}
                activeOpacity={0.75}
              >
                <View style={styles.runTop}>
                  <View>
                    <Text style={styles.runNum}>Run #{runs.length - idx}</Text>
                    <Text style={styles.runInspector}>{run.inspector_name}</Text>
                  </View>
                  <View>
                    <Text style={styles.runDate}>{format(new Date(run.start_time), 'dd MMM yyyy')}</Text>
                    <Text style={styles.runTime}>{format(new Date(run.start_time), 'HH:mm')}</Text>
                  </View>
                </View>

                <View style={styles.runTallyRow}>
                  <RunTally label="Joints" value={run.total_joints} color={Colors.white} />
                  <RunTally label="Pass" value={run.accepted} color="#22C55E" />
                  <RunTally label="Fail" value={run.failed} color={Colors.primary} />
                  <RunTally label="Reject" value={run.rejected} color="#DC2626" />
                  <RunTally label="Footage" value={`${Math.round(run.total_length_ft)}'`} color="#60A5FA" />
                </View>

                {run.total_joints > 0 && (
                  <View style={styles.runProgressBar}>
                    <View style={[styles.runProgressPass, { width: `${(run.accepted / run.total_joints) * 100}%` as any }]} />
                    <View style={[styles.runProgressFail, { width: `${(run.failed / run.total_joints) * 100}%` as any }]} />
                    <View style={[styles.runProgressReject, { width: `${(run.rejected / run.total_joints) * 100}%` as any }]} />
                  </View>
                )}

                {run.defect_count > 0 && (
                  <Text style={styles.runDefectText}>
                    ⚠ {run.defect_count} {run.defect_count === 1 ? 'defect' : 'defects'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action */}
      {(canComplete || canApprove) && (
        <View style={styles.actionBar}>
          {canComplete && runs.length === 0 && (
            <View style={styles.completeHintBox}>
              <Text style={styles.completeHintText}>Start an inspection run before completing this job</Text>
            </View>
          )}
          {canComplete && runs.length > 0 && (
            <TouchableOpacity
              style={[styles.completeBtn, completing && { opacity: 0.6 }]}
              onPress={handleCompleteJob}
              disabled={completing}
              activeOpacity={0.85}
            >
              <CheckIcon />
              <Text style={styles.completeBtnText}>{completing ? 'COMPLETING…' : 'COMPLETE JOB'}</Text>
            </TouchableOpacity>
          )}
          {canApprove && (
            <TouchableOpacity
              style={[styles.approveBtn, approving && { opacity: 0.6 }]}
              onPress={handleApproveJob}
              disabled={approving}
              activeOpacity={0.85}
            >
              <CheckIcon />
              <Text style={styles.approveBtnText}>{approving ? 'APPROVING…' : 'APPROVE JOB'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function InfoCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={[styles.infoCellValue, highlight && { color: Colors.primary }]}>{value}</Text>
    </View>
  );
}

function TallyCell({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.tallyCell}>
      <Text style={[styles.tallyValue, { color }]}>{value}</Text>
      <Text style={styles.tallyLabel}>{label}</Text>
    </View>
  );
}

function RunTally({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.runTallyCell}>
      <Text style={[styles.runTallyValue, { color }]}>{value}</Text>
      <Text style={styles.runTallyLabel}>{label}</Text>
    </View>
  );
}

function statusConfig(status: string) {
  switch (status) {
    case 'active':    return { label: 'ACTIVE',    bg: '#0D2B1A', text: '#22C55E', dot: '#22C55E' };
    case 'completed': return { label: 'COMPLETE',  bg: '#1A1F2E', text: '#60A5FA', dot: '#60A5FA' };
    case 'approved':  return { label: 'APPROVED',  bg: '#1E1208', text: Colors.primary, dot: Colors.primary };
    case 'draft':     return { label: 'DRAFT',     bg: '#1F1A0D', text: '#F59E0B', dot: '#F59E0B' };
    default:          return { label: status.toUpperCase(), bg: '#1A1A1A', text: '#9CA3AF', dot: '#9CA3AF' };
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#555', fontSize: 15 },

  header: {
    backgroundColor: '#0A0A0A', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A', gap: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerJobNum: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1 },
  headerClient: { fontSize: 15, fontWeight: '700', color: Colors.white, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  content: { paddingHorizontal: 16, paddingTop: 16 },

  jobInfoCard: {
    backgroundColor: '#161616', borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#222',
  },
  jobInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  infoCell: { width: '50%', paddingVertical: 8, paddingRight: 12 },
  infoCellLabel: { fontSize: 10, fontWeight: '700', color: '#444', letterSpacing: 1.2, marginBottom: 3 },
  infoCellValue: { fontSize: 14, fontWeight: '700', color: Colors.white },
  jobInfoExtra: { paddingTop: 8 },
  infoExtraLabel: { fontSize: 10, fontWeight: '700', color: '#444', letterSpacing: 1.2, marginBottom: 3 },
  infoExtraValue: { fontSize: 13, color: '#888' },

  grandTallyCard: {
    backgroundColor: '#161616', borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#222',
  },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#444', letterSpacing: 1.5, marginBottom: 12 },
  tallyRow: { flexDirection: 'row' },
  tallyCell: { flex: 1, alignItems: 'center' },
  tallyValue: { fontSize: 20, fontWeight: '800' },
  tallyLabel: { fontSize: 9, color: '#444', marginTop: 3, fontWeight: '700', letterSpacing: 0.8 },
  tallyDiv: { width: 1, backgroundColor: '#1F1F1F', alignSelf: 'center', height: 28 },
  defectBanner: {
    marginTop: 12, backgroundColor: '#2B1F0D', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  defectBannerText: { color: '#F59E0B', fontSize: 13, fontWeight: '700' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  newRunBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  newRunText: { color: Colors.white, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  emptyRuns: {
    backgroundColor: '#161616', borderRadius: 12, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: '#222', borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptyRunsText: { fontSize: 15, fontWeight: '600', color: '#555' },
  emptyRunsSub: { fontSize: 13, color: '#333', marginTop: 6 },

  runCard: {
    backgroundColor: '#161616', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#222',
  },
  runTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  runNum: { fontSize: 14, fontWeight: '800', color: Colors.white },
  runInspector: { fontSize: 12, color: '#555', marginTop: 2 },
  runDate: { fontSize: 12, fontWeight: '600', color: '#888', textAlign: 'right' },
  runTime: { fontSize: 11, color: '#444', textAlign: 'right', marginTop: 2 },
  runTallyRow: { flexDirection: 'row', marginBottom: 10 },
  runTallyCell: { flex: 1, alignItems: 'center' },
  runTallyValue: { fontSize: 16, fontWeight: '800' },
  runTallyLabel: { fontSize: 9, color: '#444', marginTop: 2, fontWeight: '700', letterSpacing: 0.5 },
  runProgressBar: {
    height: 3, flexDirection: 'row', borderRadius: 2, overflow: 'hidden',
    backgroundColor: '#1A1A1A', marginBottom: 8,
  },
  runProgressPass: { height: 3, backgroundColor: '#22C55E' },
  runProgressFail: { height: 3, backgroundColor: Colors.primary },
  runProgressReject: { height: 3, backgroundColor: '#DC2626' },
  runDefectText: { fontSize: 12, color: '#F59E0B', fontWeight: '700' },

  actionBar: {
    padding: 16, backgroundColor: '#0A0A0A',
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  completeHintBox: {
    backgroundColor: '#1A1A1A', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  completeHintText: { color: '#555', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  completeBtn: {
    backgroundColor: '#1A1F2E', borderWidth: 1.5, borderColor: '#60A5FA',
    borderRadius: 10, paddingVertical: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  completeBtnText: { color: '#60A5FA', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  approveBtn: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  approveBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
});
