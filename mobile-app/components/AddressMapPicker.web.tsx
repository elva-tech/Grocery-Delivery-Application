import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { AddressMapPickerProps } from './AddressMapPicker.types';

/** react-native-maps is native-only; web uses GPS-derived coords + manual confirmation. */
export default function AddressMapPicker({
  visible,
  line1,
  isFetchingAddress,
  onConfirm,
}: AddressMapPickerProps) {
  return (
    <Modal visible={visible} animationType="fade">
      <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
        <View style={styles.webMapPlaceholder}>
          <Ionicons name="map-outline" size={48} color="#94a3b8" />
          <Text style={styles.webTitle}>Map preview unavailable on web</Text>
          <Text style={styles.webSub}>
            Your location was captured. Adjust the pin on iOS or Android, or edit the address fields below.
          </Text>
        </View>
        <View style={styles.mapFooter}>
          <Text style={styles.mapAddr}>{isFetchingAddress ? 'Fetching address...' : line1}</Text>
          <TouchableOpacity style={styles.mapConfirmBtn} onPress={onConfirm}>
            <Text style={styles.mapConfirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  webMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  webTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  webSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  mapFooter: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  mapAddr: { marginBottom: 15, color: '#1e293b', fontWeight: '500' },
  mapConfirmBtn: { backgroundColor: '#4b6f9e', padding: 18, borderRadius: 12, alignItems: 'center' },
  mapConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
