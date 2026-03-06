import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity, Modal, ScrollView,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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

interface ClientJob {
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
  total_joints: number;
  accepted: number;
  failed: number;
  rejected: number;
  total_length_ft: number;
  defect_count: number;
  run_count: number;
}

function statusConfig(status: string) {
  switch (status) {
    case 'active':    return { label: 'ACTIVE',    bg: '#0D2B1A', text: '#22C55E', dot: '#22C55E' };
    case 'completed': return { label: 'COMPLETE',  bg: '#1A1F2E', text: '#60A5FA', dot: '#60A5FA' };
    case 'approved':  return { label: 'APPROVED',  bg: '#1E1208', text: Colors.primary, dot: Colors.primary };
    default:          return { label: status.toUpperCase(), bg: '#1A1A1A', text: '#9CA3AF', dot: '#9CA3AF' };
  }
}

export default function ClientPortal() {
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [selectedJob, setSelectedJob] = useState<ClientJob | null>(null);

  async function loadJobs() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/(auth)/login'); return; }

      const { data: profile } = await supabase
        .from('users').select('full_name,company').eq('id', session.user.id).single();

      const company = (profile as any)?.company ?? '';
      setCompanyName(company);

      if (!company) { setJobs([]); return; }

      // Load all data in parallel
      const [jobsRes, runsRes, usersRes] = await Promise.all([
        supabase.from('jobs').select('*').order('created_at', { ascending: false }),
        supabase.from('inspection_runs').select('id,job_id'),
        supabase.from('users').select('id,full_name'),
      ]);

      const allJobs = (jobsRes.data ?? []).filter(
        (j: any) => (j.client ?? '').toLowerCase() === company.toLowerCase()
      );

      const userMap = new Map((usersRes.data ?? []).map((u: any) => [u.id, u.full_name]));
      const runsByJob = new Map<string, string[]>();
      for (const run of runsRes.data ?? []) {
        const arr = runsByJob.get(run.job_id) ?? [];
        arr.push(run.id);
        runsByJob.set(run.job_id, arr);
      }

      const allRunIds = (runsRes.data ?? []).map(r => r.id);
      const { data: allJointsData } = allRunIds.length > 0
        ? await supabase.from('joints').select('id,run_id,result,length').in('run_id', allRunIds)
        : { data: [] };
      const allJoints = (allJointsData ?? []) as any[];

      const jointsByRun = new Map<string, any[]>();
      for (const j of allJoints) {
        const arr = jointsByRun.get(j.run_id) ?? [];
        arr.push(j);
        jointsByRun.set(j.run_id, arr);
      }

      const jointIds = allJoints.map(j => j.id);
      const { data: defectsData } = jointIds.length > 0
        ? await supabase.from('defects').select('id,joint_id').in('joint_id', jointIds)
        : { data: [] };
      const defectCountByJoint = new Map<string, number>();
      for (const d of defectsData ?? []) {
        defectCountByJoint.set(d.joint_id, (defectCountByJoint.get(d.joint_id) ?? 0) + 1);
      }

      const enriched: ClientJob[] = allJobs.map((job: any) => {
        const runIds = runsByJob.get(job.id) ?? [];
        const joints = runIds.flatMap(rid => jointsByRun.get(rid) ?? []);
        const tally = joints.reduce((acc: any, j: any) => ({
          total_joints: acc.total_joints + 1,
          accepted: acc.accepted + (j.result === 'PASS' ? 1 : 0),
          failed: acc.failed + (j.result === 'FAIL' ? 1 : 0),
          rejected: acc.rejected + (j.result === 'REJECT' ? 1 : 0),
          total_length_ft: acc.total_length_ft + (j.length ?? 0) * 3.28084,
        }), { total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_ft: 0 });
        const defect_count = joints.reduce((sum, j) => sum + (defectCountByJoint.get(j.id) ?? 0), 0);
        return {
          ...job,
          creator_name: userMap.get(job.created_by) ?? 'Inspector',
          run_count: runIds.length,
          defect_count,
          ...tally,
        } as ClientJob;
      });

      setJobs(enriched);
    } catch (err) {
      console.error('Client portal loadJobs error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadJobs(); }, []));

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
      }},
    ]);
  }

  function renderJob({ item }: { item: ClientJob }) {
    const sc = statusConfig(item.status);
    const passRate = item.total_joints > 0
      ? Math.round((item.accepted / item.total_joints) * 100)
      : null;
    return (
      <TouchableOpacity style={styles.jobCard} onPress={() => setSelectedJob(item)} activeOpacity={0.75}>
        <View style={[styles.jobAccent, { backgroundColor: sc.dot }]} />
        <View style={styles.jobBody}>
          <View style={styles.jobTopRow}>
            <Text style={styles.jobNumber}>{item.job_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
              <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
            </View>
          </View>
          <Text style={styles.jobRig}>{item.rig} · {item.well}</Text>
          <Text style={styles.jobCountry}>{item.country}</Text>
          {item.total_joints > 0 && (
            <View style={styles.tallyRow}>
              <TallyPill label="Joints" value={item.total_joints} color={Colors.white} />
              <TallyPill label="Pass" value={item.accepted} color="#22C55E" />
              <TallyPill label="Fail" value={item.failed} color={Colors.primary} />
              <TallyPill label="Reject" value={item.rejected} color="#DC2626" />
              {passRate !== null && <TallyPill label="Pass Rate" value={`${passRate}%`} color="#60A5FA" />}
            </View>
          )}
          <View style={styles.jobBottomRow}>
            <View style={styles.standardBadge}>
              <Text style={styles.standardText}>{item.standard.replace(/_/g, ' ')}</Text>
            </View>
            <Text style={styles.jobDate}>{format(new Date(item.created_at), 'dd MMM yyyy')}</Text>
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
          <Text style={styles.loadingText}>Loading your jobs…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View style={styles.header}>
        <View>
          <SetcoreLogo width={110} color="white" />
          {companyName ? <Text style={styles.companyLabel}>{companyName}</Text> : null}
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.pageTitle}>My Jobs</Text>
        <Text style={styles.jobCount}>{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}</Text>
      </View>

      <FlatList
        data={jobs}
        renderItem={renderJob}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs(); }} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No jobs found</Text>
            <Text style={styles.emptySubtitle}>Contact your Setcore representative to create and assign inspection jobs to your account.</Text>
          </View>
        }
      />

      {/* Job detail / report modal */}
      <Modal visible={!!selectedJob} animationType="slide" presentationStyle="pageSheet">
        {selectedJob && <JobReportModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      </Modal>
    </SafeAreaView>
  );
}

function JobReportModal({ job, onClose }: { job: ClientJob; onClose: () => void }) {
  const sc = statusConfig(job.status);
  const passRate = job.total_joints > 0
    ? Math.round((job.accepted / job.total_joints) * 100)
    : 0;
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

      <ScrollView contentContainerStyle={styles.reportContent}>
        {/* Branding */}
        <View style={styles.brandRow}>
          <SetcoreLogo width={130} color="white" />
          <View style={styles.brandDivider} />
          <Text style={styles.brandTitle}>INSPECTION REPORT</Text>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>JOB STATUS</Text>
          <View style={[styles.statusCard, { backgroundColor: sc.bg, borderColor: sc.dot }]}>
            <View style={[styles.statusDot, { backgroundColor: sc.dot, width: 10, height: 10, borderRadius: 5 }]} />
            <Text style={[styles.statusCardText, { color: sc.text }]}>{sc.label}</Text>
          </View>
        </View>

        {/* Job Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>JOB DETAILS</Text>
          <View style={styles.detailCard}>
            <DetailRow label="Rig" value={job.rig} />
            <DetailRow label="Well" value={job.well} />
            {job.field ? <DetailRow label="Field" value={job.field} /> : null}
            <DetailRow label="Country" value={job.country} />
            <DetailRow label="Standard" value={job.standard.replace(/_/g, ' ')} highlight />
            <DetailRow label="Inspector" value={job.creator_name} />
            <DetailRow label="Date" value={format(new Date(job.created_at), 'dd MMMM yyyy')} last />
          </View>
        </View>

        {/* Summary */}
        {job.total_joints > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INSPECTION SUMMARY</Text>
            <View style={styles.summaryCard}>
              <View style={styles.passRateCircle}>
                <Text style={styles.passRateValue}>{passRate}%</Text>
                <Text style={styles.passRateLabel}>PASS RATE</Text>
              </View>
              <View style={styles.summaryStats}>
                <SummaryRow label="Total Joints" value={job.total_joints} color={Colors.white} />
                <SummaryRow label="Accepted (Pass)" value={job.accepted} color="#22C55E" />
                <SummaryRow label="Failed" value={job.failed} color={Colors.primary} />
                <SummaryRow label="Rejected" value={job.rejected} color="#DC2626" />
                <SummaryRow label="Total Footage" value={`${Math.round(job.total_length_ft)} ft`} color="#60A5FA" />
              </View>
            </View>
            {job.defect_count > 0 && (
              <View style={styles.defectBanner}>
                <Text style={styles.defectBannerText}>⚠ {job.defect_count} {job.defect_count === 1 ? 'defect' : 'defects'} logged</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.reportFooter}>
          <Text style={styles.footerLine}>Setcore Petroleum Services</Text>
          <Text style={styles.footerSub}>For the latest report contact your Setcore representative</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TallyPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.tallyPill}>
      <Text style={[styles.tallyValue, { color }]}>{value}</Text>
      <Text style={styles.tallyLabel}>{label}</Text>
    </View>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#555', fontSize: 15 },

  header: {
    backgroundColor: '#0A0A0A', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  companyLabel: { fontSize: 10, color: Colors.primary, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  signOutBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#161616',
  },
  signOutText: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  subHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
  jobCount: { fontSize: 13, color: '#555', fontWeight: '600' },

  list: { paddingHorizontal: 16, paddingBottom: 24 },

  jobCard: {
    flexDirection: 'row', backgroundColor: '#161616',
    borderRadius: 12, marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#222',
  },
  jobAccent: { width: 4 },
  jobBody: { flex: 1, padding: 14 },
  jobTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  jobNumber: { fontSize: 12, fontWeight: '700', color: '#555', letterSpacing: 1 },
  jobRig: { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 2 },
  jobCountry: { fontSize: 12, color: '#555', marginBottom: 10 },
  tallyRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  tallyPill: { alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  tallyValue: { fontSize: 14, fontWeight: '800' },
  tallyLabel: { fontSize: 9, color: '#555', fontWeight: '700', letterSpacing: 0.5, marginTop: 1 },
  jobBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  standardBadge: { backgroundColor: '#1E1208', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#3D2510' },
  standardText: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.3 },
  jobDate: { fontSize: 11, color: '#444' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

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

  reportContent: { padding: 20 },

  brandRow: { alignItems: 'center', marginBottom: 24 },
  brandDivider: { width: 40, height: 3, backgroundColor: Colors.primary, marginTop: 14, marginBottom: 10, borderRadius: 2 },
  brandTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 3 },

  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#444', letterSpacing: 1.5, marginBottom: 10 },

  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 10, borderWidth: 1 },
  statusCardText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  detailCard: { backgroundColor: '#161616', borderRadius: 12, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  detailLabel: { fontSize: 13, color: '#555' },
  detailValue: { fontSize: 13, fontWeight: '700', color: Colors.white, textAlign: 'right', flex: 1, marginLeft: 12 },

  summaryCard: { backgroundColor: '#161616', borderRadius: 12, borderWidth: 1, borderColor: '#222', padding: 16, flexDirection: 'row', gap: 16 },
  passRateCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D2B1A',
  },
  passRateValue: { fontSize: 20, fontWeight: '900', color: '#22C55E' },
  passRateLabel: { fontSize: 8, fontWeight: '700', color: '#22C55E', letterSpacing: 0.5 },
  summaryStats: { flex: 1, gap: 6 },
  summaryRowItem: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryRowLabel: { fontSize: 12, color: '#555' },
  summaryRowValue: { fontSize: 12, fontWeight: '800' },

  defectBanner: {
    marginTop: 10, backgroundColor: '#2B1F0D', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  defectBannerText: { color: '#F59E0B', fontSize: 13, fontWeight: '700' },

  reportFooter: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1A1A1A', paddingTop: 20, marginTop: 12 },
  footerLine: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },
  footerSub: { fontSize: 11, color: 'rgba(255,255,255,0.18)', marginTop: 4, textAlign: 'center' },
});
