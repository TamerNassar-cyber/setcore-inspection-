import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, RefreshControl, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import SetcoreLogo from '../../components/shared/SetcoreLogo';
import Svg, { Path } from 'react-native-svg';

function LogOutIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={Colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface InspectorStat {
  id: string;
  name: string;
  jobs: number;
  joints: number;
  defects: number;
  passRate: number;
}

interface CertWarning {
  inspector_name: string;
  cert_type: string;
  days_until_expiry: number;
}

interface RecentJob {
  id: string;
  job_number: string;
  client: string;
  rig: string;
  status: string;
  updated_at: string;
}

export default function ManagementDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');

  // KPIs
  const [totalJobs, setTotalJobs] = useState(0);
  const [activeJobs, setActiveJobs] = useState(0);
  const [forReviewJobs, setForReviewJobs] = useState(0);
  const [approvedJobs, setApprovedJobs] = useState(0);
  const [totalJointsInspected, setTotalJointsInspected] = useState(0);
  const [overallPassRate, setOverallPassRate] = useState(0);

  // Lists
  const [inspectorStats, setInspectorStats] = useState<InspectorStat[]>([]);
  const [certWarnings, setCertWarnings] = useState<CertWarning[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/(auth)/login'); return; }

      // Parallel batch load everything
      const [profileRes, jobsRes, runsRes, usersRes, qualificationsRes] = await Promise.all([
        supabase.from('users').select('full_name').eq('id', session.user.id).single(),
        supabase.from('jobs').select('id,job_number,client,rig,status,updated_at,created_by').order('updated_at', { ascending: false }),
        supabase.from('inspection_runs').select('id,job_id,inspector_id'),
        supabase.from('users').select('id,full_name,role').eq('role', 'inspector'),
        supabase.from('qualifications').select('inspector_id,cert_type,expiry_date'),
      ]);

      if (profileRes.data) setUserName(profileRes.data.full_name);

      const jobs = jobsRes.data ?? [];
      const runs = runsRes.data ?? [];
      const inspectors = usersRes.data ?? [];
      const qualifications = qualificationsRes.data ?? [];

      // KPI counts
      setTotalJobs(jobs.length);
      setActiveJobs(jobs.filter(j => j.status === 'active').length);
      setForReviewJobs(jobs.filter(j => j.status === 'completed').length);
      setApprovedJobs(jobs.filter(j => j.status === 'approved').length);

      // Joints + pass rate (needs run IDs)
      const runIds = runs.map(r => r.id);
      let totalJoints = 0;
      let totalAccepted = 0;
      if (runIds.length > 0) {
        const { data: jointsData } = await supabase
          .from('joints').select('id,run_id,result').in('run_id', runIds);
        const joints = jointsData ?? [];
        totalJoints = joints.length;
        totalAccepted = joints.filter(j => j.result === 'PASS').length;

        setTotalJointsInspected(totalJoints);
        setOverallPassRate(totalJoints > 0 ? Math.round((totalAccepted / totalJoints) * 100) : 0);

        // Inspector leaderboard
        const jointsByRun = new Map<string, number>();
        const passByRun = new Map<string, number>();
        for (const j of joints) {
          jointsByRun.set(j.run_id, (jointsByRun.get(j.run_id) ?? 0) + 1);
          if (j.result === 'PASS') passByRun.set(j.run_id, (passByRun.get(j.run_id) ?? 0) + 1);
        }

        // Defect counts per joint
        const jointIds = joints.map(j => j.id);
        let defectsByJoint = new Map<string, number>();
        if (jointIds.length > 0) {
          const { data: defectsData } = await supabase
            .from('defects').select('joint_id').in('joint_id', jointIds);
          for (const d of defectsData ?? []) {
            defectsByJoint.set(d.joint_id, (defectsByJoint.get(d.joint_id) ?? 0) + 1);
          }
        }

        // Build a Map for O(1) run lookup — avoids O(n*m) find() in the defect loop
        const runById = new Map(runs.map(r => [r.id, r]));

        // Aggregate per inspector
        const inspectorMap = new Map(inspectors.map(u => [u.id, u.full_name]));
        // Use a richer accumulator than InspectorStat to track pass counts
        type InspectorAccum = InspectorStat & { pass: number };
        const statsMap = new Map<string, InspectorAccum>();

        for (const run of runs) {
          const inspId = run.inspector_id;
          if (!inspectorMap.has(inspId)) continue;
          const existing = statsMap.get(inspId) ?? {
            id: inspId,
            name: inspectorMap.get(inspId)!,
            jobs: 0, joints: 0, defects: 0, passRate: 0, pass: 0,
          };
          existing.joints += jointsByRun.get(run.id) ?? 0;
          existing.pass += passByRun.get(run.id) ?? 0;
          statsMap.set(inspId, existing);
        }

        // Count jobs per inspector
        const jobsByInspector = new Map<string, number>();
        for (const j of jobs) {
          if (j.created_by) jobsByInspector.set(j.created_by, (jobsByInspector.get(j.created_by) ?? 0) + 1);
        }

        // Count defects per inspector via joints — O(n) with Map lookup
        const defectsPerInspector = new Map<string, number>();
        for (const joint of joints) {
          const runObj = runById.get(joint.run_id);
          if (!runObj) continue;
          const d = defectsByJoint.get(joint.id) ?? 0;
          if (d > 0) defectsPerInspector.set(runObj.inspector_id, (defectsPerInspector.get(runObj.inspector_id) ?? 0) + d);
        }

        const stats: InspectorStat[] = Array.from(statsMap.values()).map(s => ({
          id: s.id,
          name: s.name,
          jobs: jobsByInspector.get(s.id) ?? 0,
          joints: s.joints,
          defects: defectsPerInspector.get(s.id) ?? 0,
          // Pass rate = PASS joints / total joints (not joints - defects)
          passRate: s.joints > 0 ? Math.round((s.pass / s.joints) * 100) : 100,
        })).sort((a, b) => b.joints - a.joints);

        setInspectorStats(stats);
      } else {
        setTotalJointsInspected(0);
        setOverallPassRate(0);
        setInspectorStats([]);
      }

      // Cert warnings (expiring within 60 days)
      const today = new Date();
      const warnings: CertWarning[] = [];
      const inspectorNameMap = new Map(inspectors.map(u => [u.id, u.full_name]));
      for (const q of qualifications) {
        const expiry = new Date(q.expiry_date);
        const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 60) {
          warnings.push({
            inspector_name: inspectorNameMap.get(q.inspector_id) ?? 'Inspector',
            cert_type: q.cert_type,
            days_until_expiry: days,
          });
        }
      }
      setCertWarnings(warnings.sort((a, b) => a.days_until_expiry - b.days_until_expiry));

      // Recent 5 jobs
      setRecentJobs(jobs.slice(0, 5).map(j => ({
        id: j.id, job_number: j.job_number, client: j.client,
        rig: j.rig, status: j.status, updated_at: j.updated_at,
      })));
    } catch (err) {
      console.error('Management loadData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
      }},
    ]);
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'M';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Header */}
      <View style={styles.header}>
        <SetcoreLogo width={120} color="white" />
        <View style={styles.headerRight}>
          <View style={styles.mgmtPill}>
            <Text style={styles.mgmtPillText}>MANAGEMENT</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        {/* KPI Grid */}
        <Text style={styles.sectionLabel}>JOB STATUS</Text>
        <View style={styles.kpiGrid}>
          <KpiCard label="Total Jobs" value={totalJobs} color={Colors.white} />
          <KpiCard label="Active" value={activeJobs} color="#22C55E" />
          <KpiCard label="For Review" value={forReviewJobs} color="#60A5FA" />
          <KpiCard label="Approved" value={approvedJobs} color={Colors.primary} />
        </View>

        {/* Performance */}
        <Text style={styles.sectionLabel}>PERFORMANCE</Text>
        <View style={styles.perfRow}>
          <View style={[styles.perfCard, { flex: 1 }]}>
            <Text style={styles.perfValue}>{totalJointsInspected.toLocaleString()}</Text>
            <Text style={styles.perfLabel}>TOTAL JOINTS</Text>
          </View>
          <View style={[styles.perfCard, { flex: 1, borderLeftWidth: 1, borderLeftColor: '#222' }]}>
            <Text style={[styles.perfValue, { color: overallPassRate >= 90 ? '#22C55E' : overallPassRate >= 70 ? Colors.primary : '#DC2626' }]}>
              {overallPassRate}%
            </Text>
            <Text style={styles.perfLabel}>OVERALL PASS RATE</Text>
          </View>
        </View>

        {/* Cert Warnings */}
        {certWarnings.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>CERT EXPIRY WARNINGS</Text>
            <View style={styles.card}>
              {certWarnings.map((w, idx) => (
                <View key={idx} style={[styles.certRow, idx < certWarnings.length - 1 && styles.certRowBorder]}>
                  <View style={[styles.certDot, { backgroundColor: w.days_until_expiry <= 30 ? '#DC2626' : '#F59E0B' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.certName}>{w.inspector_name}</Text>
                    <Text style={styles.certType}>{w.cert_type}</Text>
                  </View>
                  <Text style={[styles.certDays, { color: w.days_until_expiry <= 30 ? '#DC2626' : '#F59E0B' }]}>
                    {w.days_until_expiry <= 0 ? 'EXPIRED' : `${w.days_until_expiry}d`}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Inspector Leaderboard */}
        {inspectorStats.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>INSPECTOR ACTIVITY</Text>
            <View style={styles.card}>
              <View style={styles.leaderboardHeader}>
                <Text style={[styles.leaderCol, { flex: 2 }]}>Inspector</Text>
                <Text style={styles.leaderCol}>Jobs</Text>
                <Text style={styles.leaderCol}>Joints</Text>
                <Text style={styles.leaderCol}>Defects</Text>
              </View>
              {inspectorStats.map((s, idx) => (
                <View key={s.id} style={[styles.leaderRow, idx < inspectorStats.length - 1 && styles.leaderRowBorder]}>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.leaderName} numberOfLines={1}>{s.name}</Text>
                  </View>
                  <Text style={styles.leaderStat}>{s.jobs}</Text>
                  <Text style={styles.leaderStat}>{s.joints}</Text>
                  <Text style={[styles.leaderStat, s.defects > 0 && { color: '#F59E0B' }]}>{s.defects}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
            <View style={styles.card}>
              {recentJobs.map((j, idx) => {
                const sc = statusConfig(j.status);
                return (
                  <TouchableOpacity
                    key={j.id}
                    style={[styles.recentRow, idx < recentJobs.length - 1 && styles.recentRowBorder]}
                    onPress={() => router.push({ pathname: '/(inspector)/job-detail', params: { jobId: j.id } })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentJobNum}>{j.job_number}</Text>
                      <Text style={styles.recentMeta}>{j.client} · {j.rig}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
                      </View>
                      <Text style={styles.recentDate}>{format(new Date(j.updated_at), 'dd MMM')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function statusConfig(status: string) {
  switch (status) {
    case 'active':    return { label: 'ACTIVE',    bg: '#0D2B1A', text: '#22C55E' };
    case 'completed': return { label: 'REVIEW',    bg: '#1A1F2E', text: '#60A5FA' };
    case 'approved':  return { label: 'APPROVED',  bg: '#1E1208', text: Colors.primary };
    default:          return { label: status.toUpperCase(), bg: '#1A1A1A', text: '#9CA3AF' };
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#555', fontSize: 15 },

  header: {
    backgroundColor: '#0A0A0A', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mgmtPill: {
    backgroundColor: '#1E1208', borderWidth: 1, borderColor: '#3D2510',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  mgmtPillText: { color: Colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  content: { paddingHorizontal: 16, paddingTop: 20 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#444',
    letterSpacing: 1.5, marginBottom: 10, marginTop: 4,
  },

  kpiGrid: {
    flexDirection: 'row', gap: 10, marginBottom: 24,
  },
  kpiCard: {
    flex: 1, backgroundColor: '#161616', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#222',
  },
  kpiValue: { fontSize: 26, fontWeight: '900' },
  kpiLabel: { fontSize: 9, color: '#555', marginTop: 4, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center' },

  perfRow: {
    flexDirection: 'row', backgroundColor: '#161616', borderRadius: 12,
    borderWidth: 1, borderColor: '#222', marginBottom: 24, overflow: 'hidden',
  },
  perfCard: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  perfValue: { fontSize: 34, fontWeight: '900', color: Colors.white },
  perfLabel: { fontSize: 9, color: '#555', marginTop: 4, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center' },

  card: {
    backgroundColor: '#161616', borderRadius: 12,
    borderWidth: 1, borderColor: '#222', marginBottom: 24, overflow: 'hidden',
  },

  certRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  certRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  certDot: { width: 8, height: 8, borderRadius: 4 },
  certName: { fontSize: 13, fontWeight: '700', color: Colors.white },
  certType: { fontSize: 11, color: '#555', marginTop: 2 },
  certDays: { fontSize: 13, fontWeight: '800' },

  leaderboardHeader: {
    flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#1F1F1F',
  },
  leaderCol: { flex: 1, fontSize: 10, fontWeight: '700', color: '#444', letterSpacing: 0.8, textAlign: 'center' },
  leaderRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  leaderRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  rankBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 10, fontWeight: '800', color: '#666' },
  leaderName: { fontSize: 13, fontWeight: '600', color: Colors.white, flex: 1 },
  leaderStat: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.white, textAlign: 'center' },

  recentRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', gap: 10 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  recentJobNum: { fontSize: 12, fontWeight: '700', color: '#555', letterSpacing: 0.8 },
  recentMeta: { fontSize: 13, fontWeight: '600', color: Colors.white, marginTop: 2 },
  recentDate: { fontSize: 10, color: '#444' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});
