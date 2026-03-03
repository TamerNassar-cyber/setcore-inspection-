import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import type { InspectionResult } from '../../constants/standards';
import type { JobStatus } from '../../types';

interface Props {
  type: 'result' | 'job';
  value: InspectionResult | JobStatus;
}

export default function StatusBadge({ type, value }: Props) {
  const config = getConfig(type, value);
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function getConfig(type: string, value: string) {
  if (type === 'result') {
    if (value === 'PASS') return { label: 'PASS', bg: Colors.passBg, color: Colors.pass };
    if (value === 'FAIL') return { label: 'FAIL', bg: Colors.failBg, color: Colors.fail };
    if (value === 'REJECT') return { label: 'REJECT', bg: Colors.rejectBg, color: Colors.reject };
  }
  if (value === 'active') return { label: 'Active', bg: Colors.passBg, color: Colors.pass };
  if (value === 'completed') return { label: 'Completed', bg: Colors.pendingBg, color: Colors.pending };
  if (value === 'approved') return { label: 'Approved', bg: Colors.passBg, color: Colors.pass };
  if (value === 'draft') return { label: 'Draft', bg: Colors.border, color: Colors.textSecondary };
  return { label: value, bg: Colors.border, color: Colors.textSecondary };
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
