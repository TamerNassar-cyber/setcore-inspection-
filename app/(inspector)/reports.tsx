import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity, Modal, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import SetcoreLogo from '../../components/shared/SetcoreLogo';
import Svg, { Path } from 'react-native-svg';

function XIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke="#666" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

interface ReportJob {
  id: string;
  job_number: string;
  client: string;
  rig: string;
  well: string;
  field?: string;
  country: string;
  standard: string;
  status: string;
  created_at: string;
  creator_name: string;
  runs: ReportRun[];
}

interface ReportRun {
  id: string;
  inspector_name: string;
  start_time: string;
  end_time?: string;
  total_joints: number;
  accepted: number;
  failed: number;
  rejected: number;
  total_length_ft: number;
  defects: ReportDefect[];
}

interface ReportDefect {
  id: string;
  defect_type: string;
  location?: string;
  severity: string;
  description?: string;
}

export default function ReportsScreen() {
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ReportJob | null>(null);

  async function loadReports() {
    try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const userId = session.user.id;
    // Fire profile + all jobs in parallel — filter inspectors client-side
    const [profileRes, allJobsRes] = await Promise.all([
      supabase.from('users').select('role').eq('id', userId).single(),
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
    ]);
    const role = (profileRes.data as any)?.role ?? 'inspector';
    const jobsData = role === 'inspector'
      ? (allJobsRes.data ?? []).filter((j: any) => j.created_by === userId)
      : (allJobsRes.data ?? []);
    if (jobsData.length === 0) { setJobs([]); return; }

    const jobIds = jobsData.map(j => j.id);

    // Batch load everything in parallel — no N+1 queries
    const [runsRes, usersRes] = await Promise.all([
      supabase.from('inspection_runs').select('*').in('job_id', jobIds).order('start_time', { ascending: true }),
      supabase.from('users').select('id,full_name'),
    ]);

    const allRuns = runsRes.data ?? [];
    const userMap = new Map((usersRes.data ?? []).map((u: any) => [u.id, u.full_name]));
    const runIds = allRuns.map(r => r.id);

    // Load joints and defects for all runs in 2 more queries
    const { data: allJointsData } = runIds.length > 0
      ? await supabase.from('joints').select('id,run_id,result,length').in('run_id', runIds)
      : { data: [] };
    const allJoints = (allJointsData ?? []) as any[];

    const jointIds = allJoints.map(j => j.id);
    const { data: allDefectsData } = jointIds.length > 0
      ? await supabase.from('defects').select('id,joint_id,defect_type,location,severity,description').in('joint_id', jointIds)
      : { data: [] };

    // Build lookup maps for O(1) enrichment
    const jointsByRun = new Map<string, any[]>();
    for (const j of allJoints) {
      const arr = jointsByRun.get(j.run_id) ?? [];
      arr.push(j);
      jointsByRun.set(j.run_id, arr);
    }

    const defectsByJoint = new Map<string, ReportDefect[]>();
    for (const d of (allDefectsData ?? []) as any[]) {
      const arr = defectsByJoint.get(d.joint_id) ?? [];
      arr.push(d as ReportDefect);
      defectsByJoint.set(d.joint_id, arr);
    }

    const runsByJob = new Map<string, any[]>();
    for (const r of allRuns) {
      const arr = runsByJob.get(r.job_id) ?? [];
      arr.push(r);
      runsByJob.set(r.job_id, arr);
    }

    // Enrich in memory — no more queries needed
    const enriched: ReportJob[] = jobsData.map(job => {
      const jobRuns: ReportRun[] = (runsByJob.get(job.id) ?? []).map(run => {
        const joints = jointsByRun.get(run.id) ?? [];
        const tally = joints.reduce((acc: any, j: any) => ({
          total_joints: acc.total_joints + 1,
          accepted: acc.accepted + (j.result === 'PASS' ? 1 : 0),
          failed: acc.failed + (j.result === 'FAIL' ? 1 : 0),
          rejected: acc.rejected + (j.result === 'REJECT' ? 1 : 0),
          total_length_ft: acc.total_length_ft + (j.length ?? 0) * 3.28084,
        }), { total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_ft: 0 });

        const defects: ReportDefect[] = joints.flatMap((j: any) => defectsByJoint.get(j.id) ?? []);

        return {
          ...run,
          inspector_name: userMap.get(run.inspector_id) ?? 'Inspector',
          ...tally,
          defects,
        };
      });

      return {
        ...job,
        creator_name: userMap.get(job.created_by) ?? 'Inspector',
        runs: jobRuns,
      } as ReportJob;
    });

    setJobs(enriched);
    } catch (err) {
      console.error('loadReports error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadReports(); }, []));

  function renderJobCard({ item }: { item: ReportJob }) {
    const totalJoints = item.runs.reduce((a, r) => a + r.total_joints, 0);
    const totalPass = item.runs.reduce((a, r) => a + r.accepted, 0);
    const totalFail = item.runs.reduce((a, r) => a + r.failed, 0);
    const totalReject = item.runs.reduce((a, r) => a + r.rejected, 0);
    const totalFt = item.runs.reduce((a, r) => a + r.total_length_ft, 0);
    const totalDefects = item.runs.reduce((a, r) => a + r.defects.length, 0);
    const sc = statusConfig(item.status);

    return (
      <TouchableOpacity style={styles.reportCard} onPress={() => setSelectedJob(item)} activeOpacity={0.75}>
        <View style={[styles.reportAccent, { backgroundColor: sc.dot }]} />
        <View style={styles.reportBody}>
          <View style={styles.reportTop}>
            <View>
              <Text style={styles.reportJobNum}>{item.job_number}</Text>
              <Text style={styles.reportClient}>{item.client}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
            </View>
          </View>

          <Text style={styles.reportMeta}>{item.rig} · {item.well} · {item.country}</Text>

          {totalJoints > 0 ? (
            <View style={styles.reportTallyRow}>
              <MiniTally label="Joints" value={totalJoints} color={Colors.white} />
              <MiniTally label="Pass" value={totalPass} color="#22C55E" />
              <MiniTally label="Fail" value={totalFail} color={Colors.primary} />
              <MiniTally label="Reject" value={totalReject} color="#DC2626" />
              <MiniTally label="Footage" value={`${Math.round(totalFt)}'`} color="#60A5FA" />
            </View>
          ) : (
            <Text style={styles.noDataText}>No inspection data yet</Text>
          )}

          <View style={styles.reportBottom}>
            <Text style={styles.reportCreator}>{item.creator_name} · {item.runs.length} {item.runs.length === 1 ? 'run' : 'runs'}</Text>
            {totalDefects > 0 && <Text style={styles.reportDefects}>⚠ {totalDefects} defects</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading reports…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View style={styles.header}>
        <Text style={styles.pageTitle}>Reports</Text>
        <Text style={styles.jobCount}>{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}</Text>
      </View>

      <FlatList
        data={jobs}
        renderItem={renderJobCard}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadReports(); }}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptySubtitle}>Create jobs and run inspections to generate reports.</Text>
          </View>
        }
      />

      {/* Report Detail Modal */}
      <Modal visible={!!selectedJob} animationType="slide" presentationStyle="pageSheet">
        {selectedJob && <ReportModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      </Modal>
    </SafeAreaView>
  );
}

function ReportModal({ job, onClose }: { job: ReportJob; onClose: () => void }) {
  const grandTotal = job.runs.reduce((acc, r) => ({
    total_joints: acc.total_joints + r.total_joints,
    accepted: acc.accepted + r.accepted,
    failed: acc.failed + r.failed,
    rejected: acc.rejected + r.rejected,
    total_length_ft: acc.total_length_ft + r.total_length_ft,
    defect_count: acc.defect_count + r.defects.length,
  }), { total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_ft: 0, defect_count: 0 });

  const passRate = grandTotal.total_joints > 0
    ? Math.round((grandTotal.accepted / grandTotal.total_joints) * 100)
    : 0;

  const allDefects = job.runs.flatMap(r => r.defects.map(d => ({ ...d, inspector: r.inspector_name })));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={styles.modalTitle}>{job.job_number}</Text>
          <Text style={styles.modalSub}>{job.client} — {format(new Date(job.created_at), 'dd MMM yyyy')}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <XIcon />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.reportDetailContent}>

        {/* Setcore Branding */}
        <View style={styles.reportBrand}>
          <SetcoreLogo width={140} color="white" />
          <View style={styles.reportBrandDivider} />
          <Text style={styles.reportBrandTitle}>FIELD INSPECTION REPORT</Text>
        </View>

        {/* Job Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>JOB DETAILS</Text>
          <View style={styles.detailCard}>
            <DetailRow label="Job Number" value={job.job_number} />
            <DetailRow label="Client" value={job.client} />
            <DetailRow label="Rig" value={job.rig} />
            <DetailRow label="Well" value={job.well} />
            {job.field ? <DetailRow label="Field" value={job.field} /> : null}
            <DetailRow label="Country" value={job.country} />
            <DetailRow label="Standard" value={job.standard.replace(/_/g, ' ')} highlight />
            <DetailRow label="Inspector" value={job.creator_name} />
            <DetailRow label="Date" value={format(new Date(job.created_at), 'dd MMMM yyyy')} />
            <DetailRow label="Status" value={job.status.toUpperCase()} last />
          </View>
        </View>

        {/* Summary Tally */}
        {grandTotal.total_joints > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INSPECTION SUMMARY</Text>
            <View style={styles.summaryCard}>
              <View style={styles.passRateCircle}>
                <Text style={styles.passRateValue}>{passRate}%</Text>
                <Text style={styles.passRateLabel}>PASS RATE</Text>
              </View>
              <View style={styles.summaryTally}>
                <SummaryRow label="Total Joints" value={grandTotal.total_joints} color={Colors.white} />
                <SummaryRow label="Accepted (Pass)" value={grandTotal.accepted} color="#22C55E" />
                <SummaryRow label="Failed" value={grandTotal.failed} color={Colors.primary} />
                <SummaryRow label="Rejected" value={grandTotal.rejected} color="#DC2626" />
                <SummaryRow label="Total Footage" value={`${Math.round(grandTotal.total_length_ft)} ft`} color="#60A5FA" />
                <SummaryRow label="Inspection Runs" value={job.runs.length} color={Colors.white} />
              </View>
            </View>
          </View>
        )}

        {/* Defect Summary */}
        {allDefects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DEFECTS LOGGED ({allDefects.length})</Text>
            {allDefects.map((d, idx) => (
              <View key={d.id} style={styles.defectRow}>
                <View style={[styles.defectSeverityDot, { backgroundColor: severityColor(d.severity) }]} />
                <View style={styles.defectInfo}>
                  <Text style={styles.defectType}>{formatDefectType(d.defect_type)}</Text>
                  <Text style={styles.defectMeta}>
                    {[d.location ? formatLocation(d.location) : null, d.severity.toUpperCase()].filter(Boolean).join(' · ')}
                  </Text>
                  {d.description ? <Text style={styles.defectDesc}>{d.description}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Run-by-Run Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RUN BREAKDOWN</Text>
          {job.runs.map((run, idx) => (
            <View key={run.id} style={styles.runBreakCard}>
              <Text style={styles.runBreakTitle}>Run {idx + 1} — {run.inspector_name}</Text>
              <Text style={styles.runBreakDate}>{format(new Date(run.start_time), 'dd MMM yyyy, HH:mm')}</Text>
              <View style={styles.runBreakTally}>
                <Text style={styles.runBreakStat}>Joints: <Text style={{ color: Colors.white }}>{run.total_joints}</Text></Text>
                <Text style={styles.runBreakStat}>Pass: <Text style={{ color: '#22C55E' }}>{run.accepted}</Text></Text>
                <Text style={styles.runBreakStat}>Fail: <Text style={{ color: Colors.primary }}>{run.failed}</Text></Text>
                <Text style={styles.runBreakStat}>Reject: <Text style={{ color: '#DC2626' }}>{run.rejected}</Text></Text>
              </View>
              {run.defects.length > 0 && (
                <Text style={styles.runBreakDefects}>{run.defects.length} defect{run.defects.length !== 1 ? 's' : ''} logged</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.reportFooter}>
          <Text style={styles.footerLine}>Setcore Petroleum Services</Text>
          <Text style={styles.footerSub}>Generated {format(new Date(), 'dd MMMM yyyy HH:mm')}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, highlight, last }: { label: string; value: string; highlight?: boolean; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: Colors.primary }]}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.summaryRowItem}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={[styles.summaryRowValue, { color }]}>{value}</Text>
    </View>
  );
}

function MiniTally({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.miniTallyCell}>
      <Text style={[styles.miniTallyValue, { color }]}>{value}</Text>
      <Text style={styles.miniTallyLabel}>{label}</Text>
    </View>
  );
}

function severityColor(sev: string) {
  if (sev === 'critical') return '#DC2626';
  if (sev === 'major') return Colors.primary;
  return '#F59E0B';
}

function formatDefectType(code: string) {
  const map: Record<string, string> = {
    DRIFT: 'Drift / ID Restriction',
    THREAD_DAMAGE: 'Thread Damage',
    CORROSION: 'Corrosion',
    BODY_DEFECT: 'Body Defect',
    COUPLING_DEFECT: 'Coupling Defect',
    PITTING: 'Pitting',
    WASH: 'Wash / Erosion',
    SLIP_CUT: 'Slip Cut',
    MECHANICAL_DAMAGE: 'Mechanical Damage',
    DIMENSIONAL: 'Dimensional Non-conformance',
    COATING: 'Coating Defect',
    OTHER: 'Other',
  };
  return map[code] ?? code;
}

function formatLocation(code: string) {
  const map: Record<string, string> = { box_end: 'Box End', body: 'Body', pin_end: 'Pin End' };
  return map[code] ?? code;
}

function statusConfig(status: string) {
  switch (status) {
    case 'active':    return { label: 'ACTIVE',   bg: '#0D2B1A', text: '#22C55E', dot: '#22C55E' };
    case 'completed': return { label: 'COMPLETE', bg: '#1A1F2E', text: '#60A5FA', dot: '#60A5FA' };
    case 'approved':  return { label: 'APPROVED', bg: '#1E1208', text: Colors.primary, dot: Colors.primary };
    default:          return { label: status.toUpperCase(), bg: '#1A1A1A', text: '#9CA3AF', dot: '#9CA3AF' };
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#555', fontSize: 15 },

  header: {
    backgroundColor: '#0A0A0A', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  jobCount: { fontSize: 13, color: '#555', fontWeight: '600' },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  reportCard: {
    flexDirection: 'row', backgroundColor: '#161616',
    borderRadius: 12, marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#222',
  },
  reportAccent: { width: 4 },
  reportBody: { flex: 1, padding: 14 },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  reportJobNum: { fontSize: 11, fontWeight: '700', color: '#444', letterSpacing: 1 },
  reportClient: { fontSize: 17, fontWeight: '700', color: Colors.white },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  reportMeta: { fontSize: 12, color: '#555', marginBottom: 10 },
  reportTallyRow: { flexDirection: 'row', marginBottom: 8 },
  miniTallyCell: { flex: 1, alignItems: 'center' },
  miniTallyValue: { fontSize: 14, fontWeight: '800' },
  miniTallyLabel: { fontSize: 9, color: '#444', marginTop: 1, fontWeight: '700' },
  noDataText: { fontSize: 12, color: '#333', marginBottom: 8, fontStyle: 'italic' },
  reportBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportCreator: { fontSize: 11, color: '#444' },
  reportDefects: { fontSize: 11, color: '#F59E0B', fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#555', marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: '#333', textAlign: 'center', lineHeight: 20 },

  // Modal
  modalHeader: {
    backgroundColor: '#0A0A0A', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  modalSub: { fontSize: 12, color: '#555', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },

  reportDetailContent: { padding: 20 },

  reportBrand: { alignItems: 'center', marginBottom: 24 },
  reportBrandDivider: { width: 40, height: 3, backgroundColor: Colors.primary, marginTop: 14, marginBottom: 10, borderRadius: 2 },
  reportBrandTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 3 },

  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#444', letterSpacing: 1.5, marginBottom: 10 },

  detailCard: { backgroundColor: '#161616', borderRadius: 12, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  detailLabel: { fontSize: 13, color: '#555' },
  detailValue: { fontSize: 13, fontWeight: '700', color: Colors.white, textAlign: 'right', flex: 1, marginLeft: 12 },

  summaryCard: { backgroundColor: '#161616', borderRadius: 12, borderWidth: 1, borderColor: '#222', padding: 16, flexDirection: 'row', gap: 16 },
  passRateCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D2B1A',
  },
  passRateValue: { fontSize: 20, fontWeight: '900', color: '#22C55E' },
  passRateLabel: { fontSize: 8, fontWeight: '700', color: '#22C55E', letterSpacing: 0.5 },
  summaryTally: { flex: 1, gap: 6 },
  summaryRowItem: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryRowLabel: { fontSize: 12, color: '#555' },
  summaryRowValue: { fontSize: 12, fontWeight: '800' },

  defectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  defectSeverityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  defectInfo: { flex: 1 },
  defectType: { fontSize: 13, fontWeight: '700', color: Colors.white },
  defectMeta: { fontSize: 11, color: '#555', marginTop: 2 },
  defectDesc: { fontSize: 12, color: '#888', marginTop: 4, lineHeight: 16 },

  runBreakCard: {
    backgroundColor: '#161616', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#222',
  },
  runBreakTitle: { fontSize: 14, fontWeight: '700', color: Colors.white },
  runBreakDate: { fontSize: 11, color: '#555', marginTop: 2, marginBottom: 8 },
  runBreakTally: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  runBreakStat: { fontSize: 12, color: '#555' },
  runBreakDefects: { fontSize: 12, color: '#F59E0B', fontWeight: '700', marginTop: 6 },

  reportFooter: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1A1A1A', paddingTop: 20, marginTop: 12 },
  footerLine: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },
  footerSub: { fontSize: 11, color: 'rgba(255,255,255,0.18)', marginTop: 4 },
});
