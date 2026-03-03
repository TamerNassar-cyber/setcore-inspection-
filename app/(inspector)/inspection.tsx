import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getJob, saveRun, getRun } from '../../lib/db/jobs';
import { saveJoint, getJointsByRun, getTally } from '../../lib/db/joints';
import { PIPE_GRADES, DEFECT_TYPES } from '../../constants/standards';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import Input from '../../components/shared/Input';
import type { Job, InspectionRun, Joint } from '../../types';
import type { InspectionResult } from '../../constants/standards';
import { format } from 'date-fns';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function InspectionScreen() {
  const { jobId, runId: existingRunId } = useLocalSearchParams<{ jobId?: string; runId?: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [run, setRun] = useState<InspectionRun | null>(null);
  const [joints, setJoints] = useState<Joint[]>([]);
  const [tally, setTally] = useState({ total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_m: 0, total_length_ft: 0 });
  const [showJointForm, setShowJointForm] = useState(false);

  // Joint form state
  const [grade, setGrade] = useState('');
  const [weight, setWeight] = useState('');
  const [od, setOd] = useState('');
  const [length, setLength] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    if (!jobId) return;
    const j = await getJob(jobId);
    setJob(j);

    let currentRun: InspectionRun | null = null;
    if (existingRunId) {
      currentRun = await getRun(existingRunId);
    } else {
      // Create a new run
      const { data: { user } } = await import('../../lib/supabase').then(m => m.supabase.auth.getUser());
      const newRun: InspectionRun = {
        id: uuidv4(),
        job_id: jobId,
        inspector_id: (user as any)?.id ?? '',
        start_time: new Date().toISOString(),
        status: 'active',
      };
      await saveRun(newRun);
      currentRun = newRun;
    }
    setRun(currentRun);
    if (currentRun) {
      const j2 = await getJointsByRun(currentRun.id);
      setJoints(j2);
      setTally(await getTally(currentRun.id));
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
    await saveJoint(joint);
    const updated = await getJointsByRun(run.id);
    setJoints(updated);
    setTally(await getTally(run.id));
    setShowJointForm(false);
    setGrade(''); setWeight(''); setOd(''); setLength(''); setSerial(''); setNotes('');
    setSaving(false);
  }

  if (!job) return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.loading}>Loading...</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{job.client}</Text>
          <Text style={styles.headerSub}>{job.rig} · {job.well}</Text>
        </View>
        <Text style={styles.standard}>{job.standard.replace(/_/g, ' ')}</Text>
      </View>

      {/* Tally Bar */}
      <View style={styles.tallyBar}>
        <TallyItem label="Total" value={tally.total_joints} color={Colors.white} />
        <TallyItem label="Pass" value={tally.accepted} color={Colors.pass} />
        <TallyItem label="Fail" value={tally.failed} color={Colors.fail} />
        <TallyItem label="Reject" value={tally.rejected} color={Colors.reject} />
        <TallyItem label="Footage (ft)" value={Math.round(tally.total_length_ft)} color={Colors.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Joint List */}
        {joints.slice().reverse().map(joint => (
          <Card key={joint.id}>
            <View style={styles.jointRow}>
              <View>
                <Text style={styles.jointNum}>Joint #{joint.joint_number}</Text>
                {joint.grade ? <Text style={styles.jointMeta}>{joint.grade} · {joint.od}" OD · {joint.length}m</Text> : null}
                {joint.serial_number ? <Text style={styles.jointSerial}>S/N: {joint.serial_number}</Text> : null}
                <Text style={styles.jointTime}>{format(new Date(joint.inspected_at), 'HH:mm:ss')}</Text>
              </View>
              <StatusBadge type="result" value={joint.result} />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Add Joint Button */}
      <View style={styles.footer}>
        <Button label="+ Add Joint" onPress={() => setShowJointForm(true)} fullWidth />
      </View>

      {/* Joint Entry Modal */}
      <Modal visible={showJointForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Joint #{joints.length + 1}</Text>
            <TouchableOpacity onPress={() => setShowJointForm(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="Grade" value={grade} onChangeText={setGrade} placeholder="e.g. P110" autoCapitalize="characters" />
              </View>
              <View style={styles.half}>
                <Input label="Weight (ppf)" value={weight} onChangeText={setWeight} placeholder="e.g. 29.7" keyboardType="decimal-pad" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Input label='OD (inches)' value={od} onChangeText={setOd} placeholder='e.g. 5.5' keyboardType="decimal-pad" />
              </View>
              <View style={styles.half}>
                <Input label="Length (m)" value={length} onChangeText={setLength} placeholder="e.g. 9.2" keyboardType="decimal-pad" />
              </View>
            </View>
            <Input label="Serial Number" value={serial} onChangeText={setSerial} placeholder="Optional" />
            <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline numberOfLines={2} />
          </ScrollView>

          {/* Result Buttons */}
          <View style={styles.resultBtns}>
            <TouchableOpacity style={[styles.resultBtn, styles.passBtn]} onPress={() => addJoint('PASS')}>
              <Text style={styles.resultBtnText}>✓ PASS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resultBtn, styles.failBtn]} onPress={() => addJoint('FAIL')}>
              <Text style={styles.resultBtnText}>✗ FAIL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resultBtn, styles.rejectBtn]} onPress={() => addJoint('REJECT')}>
              <Text style={styles.resultBtnText}>⊘ REJECT</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TallyItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.tallyItem}>
      <Text style={[styles.tallyValue, { color }]}>{value}</Text>
      <Text style={styles.tallyLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loading: { padding: 24, color: Colors.textSecondary },
  header: { backgroundColor: Colors.black, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  headerTitle: { color: Colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
  standard: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  tallyBar: { backgroundColor: '#111', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  tallyItem: { alignItems: 'center' },
  tallyValue: { fontSize: 22, fontWeight: '800' },
  tallyLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, textTransform: 'uppercase' },
  content: { padding: 16 },
  jointRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jointNum: { fontSize: 15, fontWeight: '700', color: Colors.black },
  jointMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  jointSerial: { fontSize: 12, color: Colors.textMuted },
  jointTime: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  footer: { padding: 16, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.black },
  modalClose: { color: Colors.primary, fontSize: 16 },
  modalContent: { flex: 1, padding: 16 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  resultBtns: { flexDirection: 'row', padding: 16, gap: 8, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  resultBtn: { flex: 1, paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  passBtn: { backgroundColor: Colors.pass },
  failBtn: { backgroundColor: Colors.fail },
  rejectBtn: { backgroundColor: Colors.reject },
  resultBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
});
