import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, StatusBar, Modal, TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { CERT_TYPES } from '../../constants/standards';
import type { User, Qualification } from '../../types';
import Svg, { Path } from 'react-native-svg';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

function LogOutIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={Colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={Colors.white} strokeWidth={2.5} strokeLinecap="round" />
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

function ShieldIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);

  // Add cert modal state
  const [showCertModal, setShowCertModal] = useState(false);
  const [certType, setCertType] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [savingCert, setSavingCert] = useState(false);

  async function loadProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    const authUser = session?.user;
    if (!authUser) return;
    const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (profile) setUser(profile);
    await loadQuals(authUser.id);
  }

  async function loadQuals(userId: string) {
    const { data: quals } = await supabase
      .from('qualifications').select('*')
      .eq('inspector_id', userId)
      .order('expiry_date', { ascending: true });
    if (quals) {
      setQualifications(quals.map(q => ({
        ...q,
        days_until_expiry: differenceInDays(new Date(q.expiry_date), new Date()),
        is_expired: new Date(q.expiry_date) < new Date(),
      })));
    }
  }

  useEffect(() => { loadProfile(); }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  async function handleSaveCert() {
    if (!certType) { Alert.alert('Required', 'Please select a certification type.'); return; }
    if (!certNumber.trim()) { Alert.alert('Required', 'Please enter the certificate number.'); return; }
    // Date validation: expect YYYY-MM-DD
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(issuedDate)) { Alert.alert('Invalid Date', 'Issued date must be in format YYYY-MM-DD (e.g. 2024-01-15)'); return; }
    if (!dateRe.test(expiryDate)) { Alert.alert('Invalid Date', 'Expiry date must be in format YYYY-MM-DD (e.g. 2026-01-15)'); return; }
    if (new Date(expiryDate) <= new Date(issuedDate)) { Alert.alert('Invalid Dates', 'Expiry date must be after issued date.'); return; }

    setSavingCert(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { setSavingCert(false); return; }

    const { error } = await supabase.from('qualifications').insert({
      id: uuidv4(),
      inspector_id: userId,
      cert_type: certType,
      cert_number: certNumber.trim(),
      issued_date: issuedDate,
      expiry_date: expiryDate,
    });

    setSavingCert(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setShowCertModal(false);
    setCertType(''); setCertNumber(''); setIssuedDate(''); setExpiryDate('');
    await loadQuals(userId);
  }

  function certConfig(days: number, expired: boolean) {
    if (expired) return { color: '#DC2626', bg: '#2B0D0D', label: 'EXPIRED' };
    if (days <= 30) return { color: '#DC2626', bg: '#2B0D0D', label: `${days}d left` };
    if (days <= 90) return { color: '#F59E0B', bg: '#2B1F0D', label: `${days}d left` };
    return { color: '#22C55E', bg: '#0D2B1A', label: `${days}d left` };
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : '?';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>My Profile</Text>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <LogOutIcon />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Profile Card */}
        {user && (
          <View style={styles.profileCard}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
            <Text style={styles.userName}>{user.full_name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
              </View>
              {user.company && (
                <View style={styles.companyBadge}>
                  <Text style={styles.companyText}>{user.company}</Text>
                </View>
              )}
            </View>
            <View style={styles.statsRow}>
              <StatCell label="Qualifications" value={String(qualifications.length)} />
              <View style={styles.statDivider} />
              <StatCell label="Active" value={String(qualifications.filter(q => !q.is_expired).length)} />
              <View style={styles.statDivider} />
              <StatCell
                label="Expiring Soon"
                value={String(qualifications.filter(q => !q.is_expired && q.days_until_expiry <= 90).length)}
                highlight
              />
            </View>
          </View>
        )}

        {/* Certifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Certifications & Qualifications</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCertModal(true)} activeOpacity={0.8}>
              <PlusIcon />
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
          </View>

          {qualifications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No certifications added yet.</Text>
              <Text style={styles.emptySubtext}>Add your API, DS-1, or other qualifications.</Text>
            </View>
          ) : (
            qualifications.map(q => {
              const c = certConfig(q.days_until_expiry, q.is_expired);
              return (
                <View key={q.id} style={styles.certCard}>
                  <View style={[styles.certAccent, { backgroundColor: c.color }]} />
                  <View style={styles.certBody}>
                    <View style={styles.certTopRow}>
                      <View style={styles.certLeft}>
                        <Text style={styles.certType}>{q.cert_type}</Text>
                        <Text style={styles.certNumber}>Cert #{q.cert_number}</Text>
                        <Text style={styles.certDate}>
                          Issued {format(new Date(q.issued_date), 'dd MMM yyyy')} · Expires {format(new Date(q.expiry_date), 'dd MMM yyyy')}
                        </Text>
                      </View>
                      <View style={[styles.expiryBadge, { backgroundColor: c.bg }]}>
                        <ShieldIcon color={c.color} />
                        <Text style={[styles.expiryText, { color: c.color }]}>{c.label}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Certification Modal */}
      <Modal visible={showCertModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Certification</Text>
            <TouchableOpacity onPress={() => setShowCertModal(false)} style={styles.modalCloseBtn}>
              <XIcon />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            <Text style={styles.fieldLabel}>CERTIFICATION TYPE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.certTypeScroll} contentContainerStyle={styles.certTypeScrollContent}>
              {CERT_TYPES.map(ct => (
                <TouchableOpacity
                  key={ct}
                  style={[styles.certTypeChip, certType === ct && styles.certTypeChipActive]}
                  onPress={() => setCertType(ct)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.certTypeChipText, certType === ct && styles.certTypeChipTextActive]}>{ct}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {certType !== '' && (
              <View style={styles.selectedCertBanner}>
                <Text style={styles.selectedCertText}>Selected: {certType}</Text>
              </View>
            )}

            <View style={{ marginTop: 20 }}>
              <Text style={styles.fieldLabel}>CERTIFICATE NUMBER *</Text>
              <TextInput
                style={styles.input}
                value={certNumber}
                onChangeText={setCertNumber}
                placeholder="e.g. DS1-2024-12345"
                placeholderTextColor="#444"
                autoCapitalize="characters"
              />
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.fieldLabel}>ISSUED DATE (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                value={issuedDate}
                onChangeText={setIssuedDate}
                placeholder="e.g. 2024-01-15"
                placeholderTextColor="#444"
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.fieldLabel}>EXPIRY DATE (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholder="e.g. 2026-01-15"
                placeholderTextColor="#444"
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.saveCertBtn, savingCert && { opacity: 0.6 }]}
              onPress={handleSaveCert}
              disabled={savingCert}
              activeOpacity={0.85}
            >
              <Text style={styles.saveCertBtnText}>{savingCert ? 'SAVING…' : 'SAVE CERTIFICATION'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, highlight && { color: Colors.primary }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  pageTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
  },
  signOutText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  content: { padding: 16 },

  profileCard: {
    backgroundColor: '#161616', borderRadius: 16, marginBottom: 20,
    paddingTop: 32, paddingBottom: 0, borderWidth: 1, borderColor: '#222',
    alignItems: 'center', overflow: 'hidden',
  },
  avatarRing: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 3,
    borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatar: { width: 78, height: 78, borderRadius: 39, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '900', color: Colors.white },
  userName: { fontSize: 20, fontWeight: '800', color: Colors.white },
  userEmail: { fontSize: 13, color: '#555', marginTop: 4, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  roleBadge: { backgroundColor: '#1E1208', borderWidth: 1, borderColor: '#3D2510', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleText: { color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  companyBadge: { backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A' },
  companyText: { color: '#888', fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1F1F1F', width: '100%', paddingVertical: 16 },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.white },
  statLabel: { fontSize: 11, color: '#444', marginTop: 3, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#1F1F1F' },

  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: Colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  emptyCard: {
    backgroundColor: '#161616', borderRadius: 12, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: '#222', borderStyle: 'dashed',
  },
  emptyText: { fontSize: 15, color: '#555', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#333', marginTop: 6, textAlign: 'center' },

  certCard: {
    flexDirection: 'row', backgroundColor: '#161616', borderRadius: 12,
    marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#222',
  },
  certAccent: { width: 4 },
  certBody: { flex: 1, padding: 14 },
  certTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  certLeft: { flex: 1 },
  certType: { fontSize: 15, fontWeight: '700', color: Colors.white },
  certNumber: { fontSize: 12, color: '#555', marginTop: 3 },
  certDate: { fontSize: 12, color: '#444', marginTop: 2 },
  expiryBadge: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  expiryText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },

  // Modal
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

  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.2, marginBottom: 10 },

  certTypeScroll: { marginHorizontal: -20 },
  certTypeScrollContent: { paddingHorizontal: 20, gap: 8 },
  certTypeChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#2A2A2A', backgroundColor: '#161616',
  },
  certTypeChipActive: { borderColor: Colors.primary, backgroundColor: '#1E1208' },
  certTypeChipText: { fontSize: 13, color: '#666', fontWeight: '600' },
  certTypeChipTextActive: { color: Colors.primary },

  selectedCertBanner: {
    marginTop: 12, backgroundColor: '#1E1208', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  selectedCertText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  input: {
    backgroundColor: '#161616', borderWidth: 1.5, borderColor: '#2A2A2A',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.white,
  },

  modalActions: {
    padding: 16, backgroundColor: '#0A0A0A',
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  saveCertBtn: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  saveCertBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
});
