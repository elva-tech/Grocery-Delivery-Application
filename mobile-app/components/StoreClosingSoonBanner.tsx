import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOBILE_COPY } from '@/src/constants/copy';
import { storeClosingSoonMessage } from '@/src/utils/storeHours';

type Props = {
  minutesUntilClose: number;
  closesAt?: string | null;
};

export default function StoreClosingSoonBanner({ minutesUntilClose, closesAt }: Props) {
  const insets = useSafeAreaInsets();
  const message = storeClosingSoonMessage(minutesUntilClose, closesAt, {
    closingInMinutes: MOBILE_COPY.store.closingInMinutes,
    closingAt: MOBILE_COPY.store.closingAt,
  });

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.iconCircle}>
        <Ionicons name="time-outline" size={18} color="#fff" />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.eyebrow}>{MOBILE_COPY.store.closingSoonTitle}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d97706',
    zIndex: 9000,
    elevation: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
});
