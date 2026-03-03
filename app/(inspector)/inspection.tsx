import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, Modal, TextInput, StatusBar,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getJob, saveRun, getRun } from '../../lib/db/jobs';
import { saveJoint, getJointsByRun, getTally } from '../../lib/db/joints';
import type { Job, InspectionRun, Joint } from '../../types';
import type { InspectionResult } from '../../constants/standards';
import { format } from 'date-fns';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import Svg, { Path, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 5l-7 7 7 7" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function XIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke="#666" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function InspectionScreen() {
  const { jobId, runId: existingRunId } = useLocalSearchParams<{ jobId?: string; runId?: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [run, setRun] = useState<InspectionRun | null>(null);
  const [joints, setJoints] = useState<Joint[]>([]);
  const [tally, setTally] = useState({ total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_m: 0, total_length_ft: 0 });
  const [showJointForm, setShowJointForm] = useState(false);

  const [grade, setGrade] = useState('');
  const [weight, setWeight] = useState('');
  const [od, setOd] = useState('');
  const [length, setLength] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    if (!jobId) return;

    // Try local DB first, fall back to Supabase on web
    let j = await getJob(jobId);
    if (!j) {
      const { supabase } = await import('../../lib/supabase');
      const { data } = await supabase.from('jobs').select('*').eq('id', jobId).single();
      j = data;
    }
    setJob(j);

    const { supabase } = await import('../../lib/supabase');
    const { data: { user } } = await supabase.auth.getUser();

    let currentRun: InspectionRun | null = null;
    if (existingRunId) {
      currentRun = await getRun(existingRunId);
      if (!currentRun) {
        const { data } = await supabase.from('inspection_runs').select('*').eq('id', existingRunId).single();
        currentRun = data;
      }
    } else {
      const newRun: InspectionRun = {
        id: uuidv4(),
        job_id: jobId,
        inspector_id: (user as any)?.id ?? '',
        start_time: new Date().toISOString(),
        status: 'active',
      };
      await saveRun(newRun);
      try { await supabase.from('inspection_runs').insert(newRun); } catch (_) {}
      currentRun = newRun;
    }
    setRun(currentRun);
    if (currentRun) {
      const localJoints = await getJointsByRun(currentRun.id);
      if (localJoints.length > 0) {
        setJoints(localJoints);
        setTally(await getTally(currentRun.id));
      } else {
        // Web: fetch from Supabase
        const { data: remoteJoints } = await supabase
          .from('joints').select('*')
          .eq('run_id', currentRun.id)
          .order('joint_number', { ascending: true });
        if (remoteJoints) setJoints(remoteJoints);
        const t = remoteJoints?.reduce((acc: any, j: any) => ({
          total_joints: acc.total_joints + 1,
          accepted: acc.accepted + (j.result === 'PASS' ? 1 : 0),
          failed: acc.failed + (j.result === 'FAIL' ? 1 : 0),
          rejected: acc.rejected + (j.result === 'REJECT' ? 1 : 0),
          total_length_m: acc.total_length_m + (j.length ?? 0),
          total_length_ft: acc.total_length_ft + (j.length ?? 0) * 3.28084,
        }), { total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_m: 0, total_length_ft: 0 });
        if (t) setTally(t);
      }
    }
  }

  useEffect(() => { loadData(); }, [jobId]);

  async function addJoint(result: InspectionResult) {
    if (!run) return;
    setSaving(true);
    const joint: Joint = {
      id: uuidv4(),
      run_id: run.id,
      joint_number: joints.length + 1,
      serial_number: serial || undefined,
      grade: grade || undefined,
      weight: weight ? parseFloat(weight) : undefined,
      od: od ? parseFloat(od) : undefined,
      length: length ? parseFloat(length) : undefined,
      result,
      notes: notes || undefined,
      inspected_at: new Date().toISOString(),
      synced: false,
    };
    // Save locally (native) and to Supabase (web + sync)
    await saveJoint(joint);
    const { supabase } = await import('../../lib/supabase');
    try { await supabase.from('joints').insert({ ...joint, synced: undefined }); } catch (_) {}

    const updated = await getJointsByRun(run.id);
    if (updated.length > 0) {
      setJoints(updated);
      setTally(await getTally(run.id));
    } else {
      // Web: update state directly
      const newJoints = [...joints, joint];
      setJoints(newJoints);
      const t = newJoints.reduce((acc, j) => ({
        total_joints: acc.total_joints + 1,
        accepted: acc.accepted + (j.result === 'PASS' ? 1 : 0),
        failed: acc.failed + (j.result === 'FAIL' ? 1 : 0),
        rejected: acc.rejected + (j.result === 'REJECT' ? 1 : 0),
        total_length_m: acc.total_length_m + (j.length ?? 0),
        total_length_ft: acc.total_length_ft + (j.length ?? 0) * 3.28084,
      }), { total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_m: 0, total_length_ft: 0 });
      setTally(t);
    }
    setShowJointForm(false);
    setGrade(''); setWeight(''); setOd(''); setLength(''); setSerial(''); setNotes('');
    setSaving(false);
  }

  if (!job) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading inspection…</Text>
      </View>
    </SafeAreaView>
  );

  const totalForBar = tally.total_joints || 1;
  const passWidth = (tally.accepted / totalForBar) * 100;
  const failWidth = (tally.failed / totalForBar) * 100;
  const rejectWidth = (tally.rejected / totalForBar) * 100;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <BackIcon />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerClient}>{job.client}</Text>
          <Text style={styles.headerMeta}>{job.rig} · {job.well}</Text>
        </View>
        <View style={styles.standardPill}>
          <Text style={styles.standardPillText}>{job.standard.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {/* Tally Panel */}
      <View style={styles.tallyPanel}>
        <View style={styles.tallyRow}>
          <TallyCell label="TOTAL" value={tally.total_joints} color={Colors.white} />
          <View style={styles.tallyDivider} />
          <TallyCell label="PASS" value={tally.accepted} color="#22C55E" />
          <View style={styles.tallyDivider} />
          <TallyCell label="FAIL" value={tally.failed} color={Colors.primary} />
          <View style={styles.tallyDivider} />
          <TallyCell label="REJECT" value={tally.rejected} color="#DC2626" />
          <View style={styles.tallyDivider} />
          <TallyCell label="FOOTAGE" value={`${Math.round(tally.total_length_ft)}'`} color="#60A5FA" />
        </View>

        {/* Progress bar */}
        {tally.total_joints > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressSegment, { width: `${passWidth}%` as any, backgroundColor: '#22C55E' }]} />
            <View style={[styles.progressSegment, { width: `${failWidth}%` as any, backgroundColor: Colors.primary }]} />
            <View style={[styles.progressSegment, { width: `${rejectWidth}%` as any, backgroundColor: '#DC2626' }]} />
          </View>
        )}
      </View>

      {/* Joint List */}
      <ScrollView contentContainerStyle={styles.jointList}>
        {joints.slice().reverse().map(joint => {
          const { borderColor, badgeBg, badgeText, resultLabel } = resultStyle(joint.result);
          return (
            <View key={joint.id} style={[styles.jointCard, { borderLeftColor: borderColor }]}>
              <View style={styles.jointLeft}>
                <Text style={styles.jointNum}>Joint #{joint.joint_number}</Text>
                {joint.grade || joint.od ? (
                  <Text style={styles.jointSpec}>
                    {[joint.grade, joint.od ? `${joint.od}" OD` : null, joint.length ? `${joint.length}m` : null].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {joint.serial_number ? <Text style={styles.jointSerial}>S/N {joint.serial_number}</Text> : null}
                <Text style={styles.jointTime}>{format(new Date(joint.inspected_at), 'HH:mm:ss')}</Text>
              </View>
              <View style={[styles.resultBadge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.resultBadgeText, { color: badgeText }]}>{resultLabel}</Text>
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Joint FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowJointForm(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+ ADD JOINT</Text>
        </TouchableOpacity>
      </View>

      {/* Joint Entry Modal */}
      <Modal visible={showJointForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Joint #{joints.length + 1}</Text>
            <TouchableOpacity onPress={() => setShowJointForm(false)} style={styles.modalCloseBtn}>
              <XIcon />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <View style={styles.formRow}>
              <FormField label="GRADE" value={grade} onChangeText={setGrade} placeholder="P110" autoCapitalize="characters" style={styles.half} />
              <FormField label="WEIGHT (ppf)" value={weight} onChangeText={setWeight} placeholder="29.7" keyboardType="decimal-pad" style={styles.half} />
            </View>
            <View style={styles.formRow}>
              <FormField label='OD (inches)' value={od} onChangeText={setOd} placeholder="5.5" keyboardType="decimal-pad" style={styles.half} />
              <FormField label="LENGTH (m)" value={length} onChangeText={setLength} placeholder="9.2" keyboardType="decimal-pad" style={styles.half} />
            </View>
            <FormField label="SERIAL NUMBER" value={serial} onChangeText={setSerial} placeholder="Optional" />
            <FormField label="NOTES" value={notes} onChangeText={setNotes} placeholder="Optional field notes…" multiline numberOfLines={3} />
          </ScrollView>

          {/* Result Buttons */}
          <View style={styles.resultRow}>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: '#0D2B1A', borderColor: '#22C55E' }]}
              onPress={() => addJoint('PASS')}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[styles.resultBtnIcon, { color: '#22C55E' }]}>✓</Text>
              <Text style={[styles.resultBtnText, { color: '#22C55E' }]}>PASS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: '#2B1A0D', borderColor: Colors.primary }]}
              onPress={() => addJoint('FAIL')}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[styles.resultBtnIcon, { color: Colors.primary }]}>✗</Text>
              <Text style={[styles.resultBtnText, { color: Colors.primary }]}>FAIL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: '#2B0D0D', borderColor: '#DC2626' }]}
              onPress={() => addJoint('REJECT')}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[styles.resultBtnIcon, { color: '#DC2626' }]}>⊘</Text>
              <Text style={[styles.resultBtnText, { color: '#DC2626' }]}>REJECT</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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

function FormField({ label, style, ...props }: any) {
  return (
    <View style={[styles.formField, style]}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, props.multiline && styles.formInputMulti]}
        placeholderTextColor="#666"
        {...props}
      />
    </View>
  );
}

function resultStyle(result: string) {
  switch (result) {
    case 'PASS': return { borderColor: '#22C55E', badgeBg: '#0D2B1A', badgeText: '#22C55E', resultLabel: 'PASS' };
    case 'FAIL': return { borderColor: Colors.primary, badgeBg: '#2B1A0D', badgeText: Colors.primary, resultLabel: 'FAIL' };
    case 'REJECT': return { borderColor: '#DC2626', badgeBg: '#2B0D0D', badgeText: '#DC2626', resultLabel: 'REJECT' };
    default: return { borderColor: '#333', badgeBg: '#1A1A1A', badgeText: '#666', resultLabel: result };
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#555', fontSize: 15 },

  header: {
    backgroundColor: '#0A0A0A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerClient: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  headerMeta: { color: '#555', fontSize: 12, marginTop: 1 },
  standardPill: {
    backgroundColor: '#1E1208',
    borderWidth: 1,
    borderColor: '#3D2510',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  standardPillText: { color: Colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  tallyPanel: {
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 12,
  },
  tallyRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 12,
  },
  tallyCell: { flex: 1, alignItems: 'center' },
  tallyValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tallyLabel: { fontSize: 9, color: '#444', marginTop: 3, fontWeight: '700', letterSpacing: 0.8 },
  tallyDivider: { width: 1, height: 32, backgroundColor: '#1F1F1F', alignSelf: 'center' },
  progressBar: {
    height: 4,
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  progressSegment: { height: 4 },

  jointList: { paddingHorizontal: 16, paddingTop: 12 },
  jointCard: {
    backgroundColor: '#161616',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  jointLeft: { flex: 1 },
  jointNum: { fontSize: 14, fontWeight: '700', color: Colors.white },
  jointSpec: { fontSize: 12, color: '#666', marginTop: 3 },
  jointSerial: { fontSize: 11, color: '#444', marginTop: 2 },
  jointTime: { fontSize: 11, color: '#333', marginTop: 4 },
  resultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 62,
  },
  resultBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  fab: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: Colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 2 },

  // Modal
  modal: { flex: 1, backgroundColor: '#0F0F0F' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20 },
  formRow: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.2, marginBottom: 8 },
  formInput: {
    backgroundColor: '#161616',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.white,
  },
  formInputMulti: { paddingTop: 13, height: 80, textAlignVertical: 'top' },

  resultRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  resultBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    gap: 4,
  },
  resultBtnIcon: { fontSize: 18, fontWeight: '900' },
  resultBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
});
