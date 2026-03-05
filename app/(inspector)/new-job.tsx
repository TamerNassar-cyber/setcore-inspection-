import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { saveJob } from '../../lib/db/jobs';
import { STANDARDS } from '../../constants/standards';
import Input from '../../components/shared/Input';
import type { Job } from '../../types';
import type { StandardCode, PipeCategory } from '../../constants/standards';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import Svg, { Path } from 'react-native-svg';

function XIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke="#666" strokeWidth={2} strokeLinecap="round" />
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

const CATEGORY_INFO: Record<PipeCategory, { label: string; desc: string; icon: string }> = {
  OCTG: { label: 'OCTG', desc: 'Casing, tubing & line pipe', icon: '⬡' },
  DRILL_STRING: { label: 'Drill String', desc: 'Drill pipe, collars & subs', icon: '⬢' },
  DOWNHOLE_TOOL: { label: 'Downhole Tool', desc: 'MWD, LWD & other tools', icon: '⬣' },
};

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
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const now = new Date().toISOString();
    const job: Job = {
      id: uuidv4(),
      job_number: jobNumber,
      client, rig, well,
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
    await saveJob(job);
    try { await supabase.from('jobs').insert(job); } catch (_) {}
    setSaving(false);
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <XIcon />
        </TouchableOpacity>
        <Text style={styles.title}>New Job</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>{saving ? 'SAVING…' : 'CREATE'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Section: Job Details */}
        <Text style={styles.sectionLabel}>JOB DETAILS</Text>
        <View style={styles.card}>
          <Input
            label="Job Number *"
            value={jobNumber}
            onChangeText={setJobNumber}
            placeholder="e.g. SC-2025-001"
            autoCapitalize="characters"
          />
          <Input label="Client *" value={client} onChangeText={setClient} placeholder="e.g. ADNOC" />
          <Input label="Rig *" value={rig} onChangeText={setRig} placeholder="e.g. National Drilling #42" />
          <Input label="Well *" value={well} onChangeText={setWell} placeholder="e.g. BU-HASA-123" autoCapitalize="characters" />
          <Input label="Field" value={field} onChangeText={setField} placeholder="e.g. Bu Hasa" />
          <Input label="Country *" value={country} onChangeText={setCountry} placeholder="e.g. UAE" />
          <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline numberOfLines={2} />
        </View>

        {/* Section: Pipe Category */}
        <Text style={styles.sectionLabel}>PIPE CATEGORY *</Text>
        <View style={styles.categoryRow}>
          {categories.map(cat => {
            const info = CATEGORY_INFO[cat];
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryCard, active && styles.categoryCardActive]}
                onPress={() => { setSelectedCategory(cat); setSelectedStandard(null); }}
                activeOpacity={0.75}
              >
                <Text style={styles.categoryIcon}>{info.icon}</Text>
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{info.label}</Text>
                <Text style={styles.categoryDesc}>{info.desc}</Text>
                {active && (
                  <View style={styles.categoryCheck}>
                    <CheckIcon />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section: Standard */}
        <Text style={styles.sectionLabel}>INSPECTION STANDARD *</Text>
        <View style={styles.card}>
          {filteredStandards.map((s, idx) => {
            const active = selectedStandard === s.code;
            return (
              <TouchableOpacity
                key={s.code}
                style={[
                  styles.standardRow,
                  idx < filteredStandards.length - 1 && styles.standardRowBorder,
                  active && styles.standardRowActive,
                ]}
                onPress={() => setSelectedStandard(s.code)}
                activeOpacity={0.7}
              >
                <View style={styles.standardLeft}>
                  <Text style={[styles.standardCode, active && { color: Colors.primary }]}>{s.name}</Text>
                  <Text style={styles.standardDesc}>{s.description}</Text>
                </View>
                <View style={[styles.standardRadio, active && styles.standardRadioActive]}>
                  {active && <View style={styles.standardRadioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },

  header: {
    backgroundColor: '#0A0A0A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.white },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  saveBtnText: { color: Colors.white, fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  content: { paddingHorizontal: 16, paddingTop: 20 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#444',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },

  card: {
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#222',
  },

  categoryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#222',
    position: 'relative',
  },
  categoryCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#1E1208',
  },
  categoryIcon: { fontSize: 20, marginBottom: 8, color: '#555' },
  categoryLabel: { fontSize: 12, fontWeight: '800', color: '#888', textAlign: 'center', marginBottom: 4 },
  categoryLabelActive: { color: Colors.primary },
  categoryDesc: { fontSize: 10, color: '#444', textAlign: 'center', lineHeight: 14 },
  categoryCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  standardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  standardRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  standardRowActive: {
    backgroundColor: '#1E1208',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  standardLeft: { flex: 1 },
  standardCode: { fontSize: 14, fontWeight: '700', color: Colors.white },
  standardDesc: { fontSize: 12, color: '#555', marginTop: 3 },
  standardRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardRadioActive: { borderColor: Colors.primary },
  standardRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
});
