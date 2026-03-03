import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { saveJob, getJobs } from '../../lib/db/jobs';
import Card from '../../components/shared/Card';
import StatusBadge from '../../components/shared/StatusBadge';
import Button from '../../components/shared/Button';
import type { Job } from '../../types';
import { format } from 'date-fns';

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadJobs() {
    // Load from local DB first (offline support)
    const local = await getJobs();
    setJobs(local);

    // Then try to sync from Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        for (const job of data) await saveJob(job);
        setJobs(data);
      }
    } catch (_) {
      // Offline — use local data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadJobs(); }, []);

  function renderJob({ item }: { item: Job }) {
    return (
      <TouchableOpacity onPress={() => router.push({ pathname: '/(inspector)/inspection', params: { jobId: item.id } })}>
        <Card>
          <View style={styles.jobHeader}>
            <Text style={styles.jobNumber}>{item.job_number}</Text>
            <StatusBadge type="job" value={item.status} />
          </View>
          <Text style={styles.jobClient}>{item.client}</Text>
          <View style={styles.jobMeta}>
            <Text style={styles.metaText}>🛢 {item.rig}</Text>
            <Text style={styles.metaText}>📍 {item.well}</Text>
            <Text style={styles.metaText}>📐 {item.standard}</Text>
          </View>
          <Text style={styles.jobDate}>{format(new Date(item.created_at), 'dd MMM yyyy')}</Text>
        </Card>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
        <Button label="+ New Job" onPress={() => router.push('/(inspector)/new-job')} style={styles.newBtn} />
      </View>

      <FlatList
        data={jobs}
        renderItem={renderJob}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No jobs yet</Text>
            <Text style={styles.emptySubText}>Create a new job to start inspecting</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.black },
  title: { fontSize: 20, fontWeight: '800', color: Colors.white },
  newBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  list: { padding: 16 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  jobNumber: { fontSize: 16, fontWeight: '700', color: Colors.black },
  jobClient: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  jobMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 8 },
  metaText: { fontSize: 13, color: Colors.textSecondary },
  jobDate: { fontSize: 12, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySubText: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
});
