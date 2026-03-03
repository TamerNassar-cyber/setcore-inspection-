import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import Card from '../../components/shared/Card';
import { format } from 'date-fns';

export default function ReportsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📄</Text>
        <Text style={styles.emptyText}>No reports yet</Text>
        <Text style={styles.emptySubText}>Complete an inspection to generate a report</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.black, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySubText: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
});
