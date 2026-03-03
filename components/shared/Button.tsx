import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export default function Button({ label, onPress, variant = 'primary', loading, disabled, style, fullWidth }: Props) {
  const bg = variant === 'primary' ? Colors.primary
    : variant === 'danger' ? Colors.fail
    : variant === 'secondary' ? Colors.black
    : 'transparent';

  const textColor = variant === 'ghost' ? Colors.primary : Colors.white;
  const borderColor = variant === 'ghost' ? Colors.primary : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor, borderWidth: variant === 'ghost' ? 1.5 : 0 },
        fullWidth && styles.full,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  full: { width: '100%' },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
});
