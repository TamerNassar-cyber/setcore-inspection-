import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, RefreshControl, StatusBar, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { saveJob, getJobs } from '../../lib/db/jobs';
import SetcoreLogo from '../../components/shared/SetcoreLogo';
import type { Job } from '../../types';
import { format } from 'date-fns';
import Svg, { Path, Circle } from 'react-native-svg';

function PlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function statusConfig(status: string) {
  switch (status) {
    case 'active': return { label: 'ACTIVE', bg: '#0D2B1A', text: '#22C55E', dot: '#22C55E' };
    case 'completed': return { label: 'COMPLETE', bg: '#1A1F2E', text: '#60A5FA', dot: '#60A5FA' };
    case 'draft': return { label: 'DRAFT', bg: '#1F1A0D', text: '#F59E0B', dot: '#F59E0B' };
    default: return { label: status.toUpperCase(), bg: '#1A1A1A', text: '#9CA3AF', dot: '#9CA3AF' };
  }
}

function categoryLabel(cat: string) {
  if (cat === 'DRILL_STRING') return 'Drill String';
  if (cat === 'DOWNHOLE_TOOL') return 'Downhole Tool';
  return 'OCTG';
}

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  async function loadJobs() {
    const local = await getJobs();
    setJobs(local);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
      if (data) {
        for (const job of data) await saveJob(job);
        setJobs(data);
      }
    } catch (_) {
      // offline
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadJobs(); }, []);

  const q = search.toLowerCase();
  const filtered = q
    ? jobs.filter(j =>
        j.job_number.toLowerCase().includes(q) ||
        j.client.toLowerCase().includes(q) ||
        j.rig.toLowerCase().includes(q) ||
        j.well.toLowerCase().includes(q) ||
        (j.field ?? '').toLowerCase().includes(q) ||
        j.country.toLowerCase().includes(q)
      )
    : jobs;

  function renderJob({ item }: { item: Job }) {
    const s = statusConfig(item.status);
    return (
      <TouchableOpacity
        style={styles.jobCard}
        onPress={() => router.push({ pathname: '/(inspector)/job-detail', params: { jobId: item.id } })}
        activeOpacity={0.75}
      >
        {/* Orange left accent */}
        <View style={styles.jobAccent} />

        <View style={styles.jobBody}>
          {/* Top row */}
          <View style={styles.jobTopRow}>
            <Text style={styles.jobNumber}>{item.job_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
              <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
            </View>
          </View>

          {/* Client */}
          <Text style={styles.jobClient}>{item.client}</Text>

          {/* Tags */}
          <View style={styles.jobTags}>
            <Tag icon="rig" label={item.rig} />
            <Tag icon="well" label={item.well} />
            {item.field ? <Tag icon="field" label={item.field} /> : null}
          </View>

          {/* Bottom row */}
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Header */}
      <View style={styles.header}>
        <SetcoreLogo width={130} color="white" />
        <TouchableOpacity
          style={styles.newJobBtn}
          onPress={() => router.push('/(inspector)/new-job')}
          activeOpacity={0.8}
        >
          <PlusIcon />
          <Text style={styles.newJobText}>NEW JOB</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search jobs, clients, wells…"
          placeholderTextColor="#444"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.pageTitle}>My Jobs</Text>
        <Text style={styles.jobCount}>{filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}</Text>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderJob}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadJobs(); }}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Path d="M20 7H4C2.895 7 2 7.895 2 9v11c0 1.105.895 2 2 2h16c1.105 0 2-.895 2-2V9c0-1.105-.895-2-2-2z" stroke="#333" strokeWidth={1.5} />
                <Path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="#333" strokeWidth={1.5} />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>{search ? 'No matches' : 'No jobs yet'}</Text>
            <Text style={styles.emptySubtitle}>{search ? `No jobs found for "${search}"` : 'Tap + New Job to create your first inspection job'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Tag({ icon, label }: { icon: string; label: string }) {
  const icons: Record<string, string> = { rig: '⚙', well: '◎', field: '◈' };
  return (
    <View style={styles.tag}>
      <Text style={styles.tagIcon}>{icons[icon] ?? '·'}</Text>
      <Text style={styles.tagLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },

  searchContainer: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  searchInput: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.white,
  },

  header: {
    backgroundColor: '#0A0A0A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  newJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  newJobText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  subHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  jobCount: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },

  list: { paddingHorizontal: 16, paddingBottom: 24 },

  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  jobAccent: {
    width: 4,
    backgroundColor: Colors.primary,
  },
  jobBody: {
    flex: 1,
    padding: 14,
  },
  jobTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jobNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  jobClient: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  jobTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#222',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagIcon: { fontSize: 10, color: '#666' },
  tagLabel: { fontSize: 12, color: '#AAA', fontWeight: '500' },
  jobBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  standardBadge: {
    backgroundColor: '#1E1208',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3D2510',
  },
  standardText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  jobDate: {
    fontSize: 11,
    color: '#444',
    fontWeight: '500',
  },

  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
});
