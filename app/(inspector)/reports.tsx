import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Colors } from '../../constants/colors';
import Svg, { Path, Rect } from 'react-native-svg';

function FileIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#333" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#333" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ReportsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>PDF generation coming soon</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.emptyIcon}>
          <FileIcon />
        </View>
        <Text style={styles.emptyTitle}>No reports yet</Text>
        <Text style={styles.emptySubtitle}>
          Complete an inspection run to generate a branded Setcore PDF report
        </Text>

        <View style={styles.featureList}>
          {[
            'Setcore-branded cover page',
            'Inspector credentials & signature',
            'Joint-by-joint tally table',
            'Defect photos & annotations',
            'API / DS-1 / NS-2 compliance summary',
          ].map(item => (
            <View key={item} style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },

  header: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: 12, color: '#444', marginTop: 2 },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 10 },
  emptySubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },

  featureList: {
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
    gap: 12,
  },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  featureText: { fontSize: 14, color: '#888', flex: 1 },
});
