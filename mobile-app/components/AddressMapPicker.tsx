import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import type { AddressMapPickerProps } from './AddressMapPicker.types';

export default function AddressMapPicker({
  visible,
  region,
  line1,
  isFetchingAddress,
  onRegionChangeComplete,
  onConfirm,
}: AddressMapPickerProps) {
  return (
    <Modal visible={visible} animationType="fade">
      <View style={{ flex: 1 }}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={region ?? undefined}
          onRegionChangeComplete={onRegionChangeComplete}
        />
        <View style={styles.markerFixed} pointerEvents="none">
          <Ionicons name="location" size={40} color="#ef4444" />
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
  markerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40 },
  mapFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  mapAddr: { marginBottom: 15, color: '#1e293b', fontWeight: '500' },
  mapConfirmBtn: { backgroundColor: '#4b6f9e', padding: 18, borderRadius: 12, alignItems: 'center' },
  mapConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
