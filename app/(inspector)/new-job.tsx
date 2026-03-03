import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { saveJob } from '../../lib/db/jobs';
import { STANDARDS } from '../../constants/standards';
import Input from '../../components/shared/Input';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import type { Job } from '../../types';
import type { StandardCode, PipeCategory } from '../../constants/standards';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function NewJobScreen() {
  const [jobNumber, setJobNumber] = useState('');
  const [client, setClient] = useState('');
  const [rig, setRig] = useState('');
  const [well, setWell] = useState('');
  const [field, setField] = useState('');
  const [country, setCountry] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<StandardCode | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PipeCategory | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const categories: PipeCategory[] = ['OCTG', 'DRILL_STRING', 'DOWNHOLE_TOOL'];
  const filteredStandards = selectedCategory
    ? STANDARDS.filter(s => s.category === selectedCategory)
    : STANDARDS;

  async function handleCreate() {
    if (!jobNumber || !client || !rig || !well || !country || !selectedStandard || !selectedCategory) {
      Alert.alert('Missing Fields', 'Please fill in all required fields and select a standard.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const job: Job = {
      id: uuidv4(),
      job_number: jobNumber,
      client,
      rig,
      well,
      field: field || undefined,
      country,
      standard: selectedStandard,
      pipe_category: selectedCategory,
      status: 'active',
      created_by: user?.id ?? '',
      assigned_inspectors: [user?.id ?? ''],
      created_at: now,
      updated_at: now,
      notes: notes || undefined,
    };

    // Save locally first
    await saveJob(job);

    // Try to save to Supabase
    try {
      await supabase.from('jobs').insert(job);
    } catch (_) { /* offline - will sync later */ }

    setSaving(false);
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Job</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.sectionTitle}>Job Details</Text>
          <Input label="Job Number *" value={jobNumber} onChangeText={setJobNumber} placeholder="e.g. SC-2025-001" autoCapitalize="characters" />
          <Input label="Client *" value={client} onChangeText={setClient} placeholder="e.g. ADNOC" />
          <Input label="Rig *" value={rig} onChangeText={setRig} placeholder="e.g. National Drilling #42" />
          <Input label="Well *" value={well} onChangeText={setWell} placeholder="e.g. BU-HASA-123" autoCapitalize="characters" />
          <Input label="Field" value={field} onChangeText={setField} placeholder="e.g. Bu Hasa" />
          <Input label="Country *" value={country} onChangeText={setCountry} placeholder="e.g. UAE" />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Pipe Category *</Text>
          <View style={styles.chips}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                onPress={() => { setSelectedCategory(cat); setSelectedStandard(null); }}
              >
                <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                  {cat.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Inspection Standard *</Text>
          {filteredStandards.map(s => (
            <TouchableOpacity
              key={s.code}
              style={[styles.standardRow, selectedStandard === s.code && styles.standardRowActive]}
              onPress={() => setSelectedStandard(s.code)}
            >
              <View>
                <Text style={[styles.standardName, selectedStandard === s.code && styles.standardNameActive]}>{s.name}</Text>
                <Text style={styles.standardDesc}>{s.description}</Text>
              </View>
              {selectedStandard === s.code && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          ))}
        </Card>

        <Card>
          <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline numberOfLines={3} />
        </Card>

        <Button label="Create Job" onPress={handleCreate} loading={saving} fullWidth style={styles.createBtn} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.black, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: Colors.primary, fontSize: 15, fontWeight: '600', width: 60 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.white },
  content: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.black, marginBottom: 16 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  standardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  standardRowActive: { backgroundColor: Colors.primary + '11', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 8 },
  standardName: { fontSize: 14, fontWeight: '600', color: Colors.black },
  standardNameActive: { color: Colors.primary },
  standardDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  check: { color: Colors.primary, fontSize: 18, fontWeight: '800' },
  createBtn: { marginBottom: 40 },
});
