import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../../constants/colors';

export default function ManagementScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><Text style={styles.title}>Management Dashboard</Text></View>
      <View style={styles.center}><Text style={styles.sub}>Coming in Phase 3</Text></View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.black, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sub: { color: Colors.textSecondary },
});
