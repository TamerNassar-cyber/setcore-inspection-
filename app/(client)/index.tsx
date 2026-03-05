import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Colors } from '../../constants/colors';
import SetcoreLogo from '../../components/shared/SetcoreLogo';
import Svg, { Path } from 'react-native-svg';

function LockIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"
        stroke={Colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ClientScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <View style={styles.header}>
        <SetcoreLogo width={130} color="white" />
      </View>
      <View style={styles.center}>
        <View style={styles.iconBox}>
          <LockIcon />
        </View>
        <Text style={styles.title}>Client Portal</Text>
        <Text style={styles.sub}>
          Your dedicated portal for viewing inspection reports and job status is being prepared.
        </Text>
        <View style={styles.divider} />
        <Text style={styles.contact}>Contact your Setcore representative for access.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    backgroundColor: '#0A0A0A', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#1E1208', borderWidth: 1, borderColor: '#3D2510',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 12, textAlign: 'center' },
  sub: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22 },
  divider: { width: 40, height: 2, backgroundColor: Colors.primary, marginVertical: 24, borderRadius: 2 },
  contact: { fontSize: 13, color: '#444', textAlign: 'center', fontStyle: 'italic' },
});
