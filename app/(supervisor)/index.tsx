import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, RefreshControl, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
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

type FilterStatus = 'all' | 'active' | 'completed' | 'approved';

interface JobRow {
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
  run_count: number;
  total_joints: number;
  defect_count: number;
}

function statusConfig(status: string) {
  switch (status) {
    case 'active':    return { label: 'ACTIVE',    bg: '#0D2B1A', text: '#22C55E', dot: '#22C55E' };
    case 'completed': return { label: 'FOR REVIEW', bg: '#1A1F2E', text: '#60A5FA', dot: '#60A5FA' };
    case 'approved':  return { label: 'APPROVED',  bg: '#1E1208', text: Colors.primary, dot: Colors.primary };
    case 'draft':     return { label: 'DRAFT',     bg: '#1F1A0D', text: '#F59E0B', dot: '#F59E0B' };
    default:          return { label: status.toUpperCase(), bg: '#1A1A1A', text: '#9CA3AF', dot: '#9CA3AF' };
  }
}

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'For Review' },
  { key: 'active', label: 'Active' },
  { key: 'approved', label: 'Approved' },
];

export default function SupervisorDashboard() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('supervisor');
  const [userName, setUserName] = useState('');

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    // Get current user info
    const { data: profile } = await supabase.from('users').select('full_name,role').eq('id', session.user.id).single();
    if (profile) {
      setUserName(profile.full_name);
      setUserRole(profile.role);
    }

    // Load all jobs
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!jobsData) { setLoading(false); setRefreshing(false); return; }

    // Enrich each job with creator name, run count, joint count
    const enriched = await Promise.all(jobsData.map(async (job) => {
      const [creatorRes, runsRes] = await Promise.all([
        supabase.from('users').select('full_name').eq('id', job.created_by).single(),
        supabase.from('inspection_runs').select('id').eq('job_id', job.id),
      ]);

      const runIds = runsRes.data?.map(r => r.id) ?? [];

      let total_joints = 0;
      let defect_count = 0;

      if (runIds.length > 0) {
        const [jointsRes] = await Promise.all([
          supabase.from('joints').select('id', { count: 'exact', head: true }).in('run_id', runIds),
        ]);
        total_joints = jointsRes.count ?? 0;

        // Count defects via joints in these runs
        if (total_joints > 0) {
          const { data: jointIds } = await supabase.from('joints').select('id').in('run_id', runIds);
          if (jointIds && jointIds.length > 0) {
            const { count } = await supabase
              .from('defects')
              .select('id', { count: 'exact', head: true })
              .in('joint_id', jointIds.map(j => j.id));
            defect_count = count ?? 0;
          }
        }
      }

      return {
        ...job,
        creator_name: creatorRes.data?.full_name ?? 'Inspector',
        run_count: runIds.length,
        total_joints,
        defect_count,
      } as JobRow;
    }));

    setJobs(enriched);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  // Counts for filter badges
  const counts = {
    all: jobs.length,
    completed: jobs.filter(j => j.status === 'completed').length,
    active: jobs.filter(j => j.status === 'active').length,
    approved: jobs.filter(j => j.status === 'approved').length,
  };

  function renderJob({ item }: { item: JobRow }) {
    const s = statusConfig(item.status);
    const isPendingReview = item.status === 'completed';
    return (
      <TouchableOpacity
        style={[styles.jobCard, isPendingReview && styles.jobCardHighlight]}
        onPress={() => router.push({ pathname: '/(inspector)/job-detail', params: { jobId: item.id } })}
        activeOpacity={0.75}
      >
        <View style={[styles.jobAccent, { backgroundColor: isPendingReview ? '#60A5FA' : Colors.primary }]} />
        <View style={styles.jobBody}>
          <View style={styles.jobTopRow}>
            <Text style={styles.jobNumber}>{item.job_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
              <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
            </View>
          </View>

          <Text style={styles.jobClient}>{item.client}</Text>
          <Text style={styles.jobMeta}>{item.rig} · {item.well} · {item.country}</Text>

          <View style={styles.jobStats}>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>{item.run_count} {item.run_count === 1 ? 'run' : 'runs'}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>{item.total_joints} joints</Text>
            </View>
            {item.defect_count > 0 && (
              <View style={[styles.statPill, styles.statPillDefect]}>
                <Text style={[styles.statPillText, { color: '#F59E0B' }]}>⚠ {item.defect_count} defects</Text>
              </View>
            )}
          </View>

          <View style={styles.jobBottomRow}>
            <Text style={styles.jobInspector}>{item.creator_name}</Text>
            <Text style={styles.jobDate}>{format(new Date(item.created_at), 'dd MMM yyyy')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '?';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Header */}
      <View style={styles.header}>
        <SetcoreLogo width={120} color="white" />
        <View style={styles.headerRight}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{userRole.toUpperCase()}</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <SummaryCell label="Total Jobs" value={jobs.length} color={Colors.white} />
        <View style={styles.summaryDiv} />
        <SummaryCell label="For Review" value={counts.completed} color="#60A5FA" />
        <View style={styles.summaryDiv} />
        <SummaryCell label="Active" value={counts.active} color="#22C55E" />
        <View style={styles.summaryDiv} />
        <SummaryCell label="Approved" value={counts.approved} color={Colors.primary} />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
            {counts[f.key] > 0 && (
              <View style={[styles.filterBadge, filter === f.key && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filter === f.key && styles.filterBadgeTextActive]}>
                  {counts[f.key]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderJob}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No jobs found</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'completed' ? 'No jobs pending review.' : 'No jobs in this category.'}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },

  header: {
    backgroundColor: '#0A0A0A', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rolePill: {
    backgroundColor: '#1E1208', borderWidth: 1, borderColor: '#3D2510',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  rolePillText: { color: Colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 13, fontWeight: '800' },

  summaryBar: {
    backgroundColor: '#0A0A0A', flexDirection: 'row',
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 9, color: '#444', marginTop: 2, fontWeight: '700', letterSpacing: 0.8 },
  summaryDiv: { width: 1, backgroundColor: '#1F1F1F', alignSelf: 'center', height: 26 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#161616',
  },
  filterTabActive: { borderColor: Colors.primary, backgroundColor: '#1E1208' },
  filterTabText: { fontSize: 12, fontWeight: '700', color: '#555' },
  filterTabTextActive: { color: Colors.primary },
  filterBadge: {
    backgroundColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
  },
  filterBadgeActive: { backgroundColor: Colors.primary },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: '#666' },
  filterBadgeTextActive: { color: Colors.white },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  jobCard: {
    flexDirection: 'row', backgroundColor: '#161616',
    borderRadius: 12, marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#222',
  },
  jobCardHighlight: { borderColor: '#1A2840' },
  jobAccent: { width: 4 },
  jobBody: { flex: 1, padding: 14 },
  jobTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  jobNumber: { fontSize: 11, fontWeight: '700', color: '#444', letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  jobClient: { fontSize: 17, fontWeight: '700', color: Colors.white, marginBottom: 3 },
  jobMeta: { fontSize: 12, color: '#555', marginBottom: 10 },
  jobStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  statPill: { backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statPillDefect: { backgroundColor: '#2B1F0D' },
  statPillText: { fontSize: 11, color: '#888', fontWeight: '600' },
  jobBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobInspector: { fontSize: 12, color: '#555', fontWeight: '600' },
  jobDate: { fontSize: 11, color: '#333' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#555' },
  emptySubtitle: { fontSize: 13, color: '#333', marginTop: 6, textAlign: 'center' },
});
