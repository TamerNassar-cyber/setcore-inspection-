import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, Modal, TextInput, StatusBar,
  Image, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '../../constants/colors';
import { getJob, saveRun, getRun } from '../../lib/db/jobs';
import { saveJoint, getJointsByRun, getTally } from '../../lib/db/joints';
import type { Job, InspectionRun, Joint } from '../../types';
import type { InspectionResult } from '../../constants/standards';
import { DEFECT_TYPES } from '../../constants/standards';
import type { DefectType } from '../../constants/standards';
import { format } from 'date-fns';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import Svg, { Path, Circle } from 'react-native-svg';

const LOCATIONS = [
  { code: 'box_end', label: 'Box End' },
  { code: 'body', label: 'Body' },
  { code: 'pin_end', label: 'Pin End' },
];

const SEVERITIES = [
  { code: 'minor', label: 'MINOR', color: '#F59E0B', bg: '#2B2200' },
  { code: 'major', label: 'MAJOR', color: Colors.primary, bg: '#2B1A0D' },
  { code: 'critical', label: 'CRITICAL', color: '#DC2626', bg: '#2B0D0D' },
];

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

function CameraIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
        stroke="#999" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx="12" cy="13" r="4" stroke="#999" strokeWidth={1.5} />
    </Svg>
  );
}

function ScanIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8h10M7 12h10M7 16h6" stroke={Colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

  // Joint form fields
  const [grade, setGrade] = useState('');
  const [weight, setWeight] = useState('');
  const [od, setOd] = useState('');
  const [length, setLength] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Barcode scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLocked = useRef(false);

  // Defect form state
  const [showDefectForm, setShowDefectForm] = useState(false);
  const [pendingJointId, setPendingJointId] = useState<string | null>(null);
  const [pendingJointNum, setPendingJointNum] = useState(0);
  const [defectType, setDefectType] = useState<DefectType | ''>('');
  const [defectLocation, setDefectLocation] = useState('');
  const [defectSeverity, setDefectSeverity] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [defectPhotoUri, setDefectPhotoUri] = useState<string | null>(null);
  const [savingDefect, setSavingDefect] = useState(false);

  async function loadData() {
    if (!jobId) return;

    let j = await getJob(jobId);
    if (!j) {
      const { supabase } = await import('../../lib/supabase');
      const { data } = await supabase.from('jobs').select('*').eq('id', jobId).single();
      j = data;
    }
    setJob(j);

    const { supabase } = await import('../../lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();

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
        inspector_id: session?.user?.id ?? '',
        start_time: new Date().toISOString(),
        status: 'active',
      };
      // Silently capture GPS location on native
      if (Platform.OS !== 'web') {
        try {
          const Location = await import('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: (Location as any).Accuracy?.Balanced ?? 4 });
            newRun.location_lat = loc.coords.latitude;
            newRun.location_lng = loc.coords.longitude;
          }
        } catch (_) {}
      }
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

    await saveJoint(joint);
    const { supabase } = await import('../../lib/supabase');
    try { await supabase.from('joints').insert({ ...joint, synced: undefined }); } catch (_) {}

    const updated = await getJointsByRun(run.id);
    if (updated.length > 0) {
      setJoints(updated);
      setTally(await getTally(run.id));
    } else {
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

    // Reset joint form and close it
    setGrade(''); setWeight(''); setOd(''); setLength(''); setSerial(''); setNotes('');
    setSaving(false);
    setShowJointForm(false);

    // Auto-open defect form for FAIL / REJECT
    if (result === 'FAIL' || result === 'REJECT') {
      setPendingJointId(joint.id);
      setPendingJointNum(joint.joint_number);
      setShowDefectForm(true);
    }
  }

  async function openScanner() {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Barcode scanning is available on the mobile app.');
      return;
    }
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Camera access is needed to scan barcodes.');
        return;
      }
    }
    scanLocked.current = false;
    setShowScanner(true);
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scanLocked.current) return;
    scanLocked.current = true;
    setSerial(data);
    setShowScanner(false);
  }

  async function pickPhoto() {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status === 'granted') {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images' as any,
          quality: 0.75,
          allowsEditing: true,
        });
        if (!result.canceled) setDefectPhotoUri(result.assets[0].uri);
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      quality: 0.75,
      allowsEditing: true,
    });
    if (!result.canceled) setDefectPhotoUri(result.assets[0].uri);
  }

  async function saveDefect(skip: boolean) {
    if (skip || !pendingJointId) {
      resetDefectForm();
      return;
    }
    if (!defectType || !defectSeverity) {
      Alert.alert('Required Fields', 'Please select a defect type and severity before saving.');
      return;
    }

    setSavingDefect(true);

    let photoUrl: string | undefined;
    if (defectPhotoUri) {
      try {
        const { supabase } = await import('../../lib/supabase');
        const fileName = `${pendingJointId}-${Date.now()}.jpg`;
        const response = await fetch(defectPhotoUri);
        const blob = await response.blob();
        const { data: uploadData } = await supabase.storage
          .from('defect-photos')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('defect-photos')
            .getPublicUrl(fileName);
          photoUrl = publicUrl;
        }
      } catch (_) {}
    }

    const defect = {
      id: uuidv4(),
      joint_id: pendingJointId,
      defect_type: defectType,
      location: defectLocation || null,
      severity: defectSeverity,
      description: defectDescription || null,
      photo_url: photoUrl ?? null,
    };

    try {
      const { supabase } = await import('../../lib/supabase');
      await supabase.from('defects').insert(defect);
    } catch (_) {}

    setSavingDefect(false);
    resetDefectForm();
  }

  function resetDefectForm() {
    setShowDefectForm(false);
    setPendingJointId(null);
    setPendingJointNum(0);
    setDefectType('');
    setDefectLocation('');
    setDefectSeverity('');
    setDefectDescription('');
    setDefectPhotoUri(null);
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
        <TouchableOpacity style={styles.fab} onPress={() => setShowJointForm(true)} activeOpacity={0.85}>
          <Text style={styles.fabText}>+ ADD JOINT</Text>
        </TouchableOpacity>
      </View>

      {/* ── Joint Entry Modal ── */}
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
            <View style={styles.serialRow}>
              <View style={{ flex: 1 }}>
                <FormField label="SERIAL NUMBER" value={serial} onChangeText={setSerial} placeholder="Optional — or scan barcode" />
              </View>
              {Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.scanBtn} onPress={openScanner} activeOpacity={0.7}>
                  <ScanIcon />
                </TouchableOpacity>
              )}
            </View>
            <FormField label="NOTES" value={notes} onChangeText={setNotes} placeholder="Optional field notes…" multiline numberOfLines={3} />
          </ScrollView>

          <View style={styles.resultRow}>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: '#0D2B1A', borderColor: '#22C55E' }]}
              onPress={() => addJoint('PASS')} disabled={saving} activeOpacity={0.8}
            >
              <Text style={[styles.resultBtnIcon, { color: '#22C55E' }]}>✓</Text>
              <Text style={[styles.resultBtnText, { color: '#22C55E' }]}>PASS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: '#2B1A0D', borderColor: Colors.primary }]}
              onPress={() => addJoint('FAIL')} disabled={saving} activeOpacity={0.8}
            >
              <Text style={[styles.resultBtnIcon, { color: Colors.primary }]}>✗</Text>
              <Text style={[styles.resultBtnText, { color: Colors.primary }]}>FAIL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: '#2B0D0D', borderColor: '#DC2626' }]}
              onPress={() => addJoint('REJECT')} disabled={saving} activeOpacity={0.8}
            >
              <Text style={[styles.resultBtnIcon, { color: '#DC2626' }]}>⊘</Text>
              <Text style={[styles.resultBtnText, { color: '#DC2626' }]}>REJECT</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Barcode Scanner Modal ── */}
      <Modal visible={showScanner} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan Barcode / QR Code</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowScanner(false)}>
              <XIcon />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'datamatrix', 'ean13', 'ean8'] }}
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
              <Text style={styles.scannerHint}>Align barcode within the frame</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Defect Logging Modal ── */}
      <Modal visible={showDefectForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={[styles.modalHeader, styles.defectModalHeader]}>
            <View>
              <Text style={styles.defectModalTitle}>Log Defect</Text>
              <Text style={styles.defectModalSub}>Joint #{pendingJointNum}</Text>
            </View>
            <TouchableOpacity onPress={() => saveDefect(true)} style={styles.modalCloseBtn}>
              <XIcon />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            {/* Defect Type */}
            <Text style={styles.defectSectionLabel}>DEFECT TYPE *</Text>
            <View style={styles.defectTypeGrid}>
              {DEFECT_TYPES.map(dt => (
                <TouchableOpacity
                  key={dt.code}
                  style={[styles.defectTypeChip, defectType === dt.code && styles.defectTypeChipActive]}
                  onPress={() => setDefectType(dt.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.defectTypeChipText, defectType === dt.code && styles.defectTypeChipTextActive]}>
                    {dt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Location */}
            <Text style={[styles.defectSectionLabel, { marginTop: 22 }]}>LOCATION ON JOINT</Text>
            <View style={styles.locationRow}>
              {LOCATIONS.map(loc => (
                <TouchableOpacity
                  key={loc.code}
                  style={[styles.locationBtn, defectLocation === loc.code && styles.locationBtnActive]}
                  onPress={() => setDefectLocation(defectLocation === loc.code ? '' : loc.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.locationBtnText, defectLocation === loc.code && styles.locationBtnTextActive]}>
                    {loc.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Severity */}
            <Text style={[styles.defectSectionLabel, { marginTop: 22 }]}>SEVERITY *</Text>
            <View style={styles.severityRow}>
              {SEVERITIES.map(sev => (
                <TouchableOpacity
                  key={sev.code}
                  style={[
                    styles.severityBtn,
                    { borderColor: defectSeverity === sev.code ? sev.color : '#2A2A2A' },
                    defectSeverity === sev.code && { backgroundColor: sev.bg },
                  ]}
                  onPress={() => setDefectSeverity(sev.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.severityBtnText, { color: defectSeverity === sev.code ? sev.color : '#555' }]}>
                    {sev.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={[styles.defectSectionLabel, { marginTop: 22 }]}>DESCRIPTION</Text>
            <TextInput
              style={styles.defectDescInput}
              value={defectDescription}
              onChangeText={setDefectDescription}
              placeholder="Describe the defect — location, extent, measurements…"
              placeholderTextColor="#444"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Photo */}
            <Text style={[styles.defectSectionLabel, { marginTop: 22 }]}>PHOTO</Text>
            {defectPhotoUri ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: defectPhotoUri }} style={styles.photoPreview} resizeMode="cover" />
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setDefectPhotoUri(null)}>
                  <Text style={styles.photoRemoveBtnText}>Remove Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoPickerBtn} onPress={pickPhoto} activeOpacity={0.7}>
                <CameraIcon />
                <Text style={styles.photoPickerText}>
                  {Platform.OS === 'web' ? 'Choose Photo' : 'Take Photo / Choose from Library'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Action row */}
          <View style={styles.defectActionRow}>
            <TouchableOpacity style={styles.skipBtn} onPress={() => saveDefect(true)} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>SKIP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveDefectBtn, savingDefect && { opacity: 0.6 }]}
              onPress={() => saveDefect(false)}
              disabled={savingDefect}
              activeOpacity={0.85}
            >
              <Text style={styles.saveDefectBtnText}>{savingDefect ? 'SAVING…' : 'SAVE DEFECT'}</Text>
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
    case 'PASS':   return { borderColor: '#22C55E', badgeBg: '#0D2B1A', badgeText: '#22C55E', resultLabel: 'PASS' };
    case 'FAIL':   return { borderColor: Colors.primary, badgeBg: '#2B1A0D', badgeText: Colors.primary, resultLabel: 'FAIL' };
    case 'REJECT': return { borderColor: '#DC2626', badgeBg: '#2B0D0D', badgeText: '#DC2626', resultLabel: 'REJECT' };
    default:       return { borderColor: '#333', badgeBg: '#1A1A1A', badgeText: '#666', resultLabel: result };
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
  backBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerClient: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  headerMeta: { color: '#555', fontSize: 12, marginTop: 1 },
  standardPill: { backgroundColor: '#1E1208', borderWidth: 1, borderColor: '#3D2510', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  standardPillText: { color: Colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  tallyPanel: { backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#1A1A1A', paddingBottom: 12 },
  tallyRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 14, paddingBottom: 12 },
  tallyCell: { flex: 1, alignItems: 'center' },
  tallyValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tallyLabel: { fontSize: 9, color: '#444', marginTop: 3, fontWeight: '700', letterSpacing: 0.8 },
  tallyDivider: { width: 1, height: 32, backgroundColor: '#1F1F1F', alignSelf: 'center' },
  progressBar: { height: 4, flexDirection: 'row', marginHorizontal: 16, borderRadius: 2, overflow: 'hidden', backgroundColor: '#1A1A1A' },
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
  resultBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, alignItems: 'center', minWidth: 62 },
  resultBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  fabContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#0A0A0A',
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  fab: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabText: { color: Colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 2 },

  // Shared modal
  modal: { flex: 1, backgroundColor: '#0F0F0F' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20 },
  formRow: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.2, marginBottom: 8 },
  formInput: { backgroundColor: '#161616', borderWidth: 1.5, borderColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.white },
  formInputMulti: { paddingTop: 13, height: 80, textAlignVertical: 'top' },

  serialRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  scanBtn: {
    width: 48, height: 48, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.primary, backgroundColor: '#1E1208',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },

  // Scanner
  scannerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  scannerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  scannerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  scannerFrame: {
    width: 260, height: 180, borderWidth: 2, borderColor: Colors.primary,
    borderRadius: 12, backgroundColor: 'transparent',
  },
  scannerHint: {
    color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600',
    marginTop: 20, textAlign: 'center',
  },

  resultRow: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#1A1A1A' },
  resultBtn: { flex: 1, paddingVertical: 16, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, gap: 4 },
  resultBtnIcon: { fontSize: 18, fontWeight: '900' },
  resultBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // Defect modal
  defectModalHeader: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  defectModalTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  defectModalSub: { fontSize: 12, color: '#666', marginTop: 2 },

  defectSectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.2, marginBottom: 12,
  },

  defectTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  defectTypeChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#2A2A2A',
    backgroundColor: '#161616',
  },
  defectTypeChipActive: { borderColor: Colors.primary, backgroundColor: '#1E1208' },
  defectTypeChipText: { fontSize: 13, color: '#666', fontWeight: '600' },
  defectTypeChipTextActive: { color: Colors.primary },

  locationRow: { flexDirection: 'row', gap: 10 },
  locationBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#2A2A2A', backgroundColor: '#161616',
    alignItems: 'center',
  },
  locationBtnActive: { borderColor: '#60A5FA', backgroundColor: '#0D1E2B' },
  locationBtnText: { fontSize: 13, fontWeight: '700', color: '#555' },
  locationBtnTextActive: { color: '#60A5FA' },

  severityRow: { flexDirection: 'row', gap: 10 },
  severityBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 8,
    borderWidth: 1.5, backgroundColor: '#161616', alignItems: 'center',
  },
  severityBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  defectDescInput: {
    backgroundColor: '#161616', borderWidth: 1.5, borderColor: '#2A2A2A',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: Colors.white, height: 100, textAlignVertical: 'top',
  },

  photoPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#161616', borderWidth: 1.5, borderColor: '#2A2A2A',
    borderRadius: 10, borderStyle: 'dashed', padding: 18,
  },
  photoPickerText: { fontSize: 14, color: '#666', fontWeight: '600' },
  photoContainer: { gap: 12 },
  photoPreview: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#161616' },
  photoRemoveBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#2B0D0D', borderWidth: 1, borderColor: '#DC2626' },
  photoRemoveBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },

  defectActionRow: {
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  skipBtn: {
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#2A2A2A', backgroundColor: '#161616',
    alignItems: 'center',
  },
  skipBtnText: { color: '#555', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  saveDefectBtn: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  saveDefectBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
});
