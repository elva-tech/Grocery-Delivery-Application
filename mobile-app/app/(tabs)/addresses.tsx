import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useDispatch, useSelector } from 'react-redux';

import { clearCart } from '@/store/slices/cartSlice';
import { RootState } from '@/store/store';
import { showToast } from '@/utils/toast';
import { getAddresses, addAddress, getAddressFromCoords, createOrder } from '@/api/addresses';

type OrderMode = 'self' | 'others';

type OthersData = {
  recipientName: string;
  recipientPhone: string;
  fullAddress: string;
  landmark: string;
  note: string;
};

const EMPTY_OTHERS: OthersData = {
  recipientName: '',
  recipientPhone: '',
  fullAddress: '',
  landmark: '',
  note: '',
};

export default function AddressesScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const [orderMode, setOrderMode] = useState<OrderMode>('self');
  const [adding, setAdding] = useState(false);
  const [showOthersModal, setShowOthersModal] = useState(false);
  const [othersForm, setOthersForm] = useState<OthersData>(EMPTY_OTHERS);
  const [othersConfirmed, setOthersConfirmed] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false); // New state for API call
  const [label, setLabel] = useState('');
  const [full, setFull] = useState('');
  const [phone, setPhone] = useState('');
  const [landmark, setLandmark] = useState('');

  const [showMap, setShowMap] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [region, setRegion] = useState<any>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoadingAddresses(true);
      const data = await getAddresses();
      setAddresses(data);
    } catch {
      showToast('error', 'Error', 'Could not load addresses');
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleAddPersonal = async () => {
    if (!label.trim() || !full.trim() || !phone.trim()) {
      showToast('error', 'Missing Fields', 'Label, Address and Phone are required');
      return;
    }
    setIsSaving(true);
    try {
      const newAddr = await addAddress({ label, full, phone, landmark });
      setAddresses(prev => [...prev, newAddr]);
      setSelectedId(newAddr.id);
      setAdding(false);
      setLabel(''); setFull(''); setPhone(''); setLandmark('');
    } catch (e: any) {
      showToast('error', 'Save Failed', e?.message || 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmOthers = () => {
    if (!othersForm.recipientName || !othersForm.recipientPhone || !othersForm.fullAddress) {
      showToast('error', 'Missing Info', 'Name, Phone and Address are required');
      return;
    }
    if (othersForm.recipientPhone.length !== 10) {
      showToast('error', 'Invalid Phone', '10 digits required');
      return;
    }
    setOthersConfirmed(true);
    setShowOthersModal(false);
    setOrderMode('others');
  };

 // inside AddressesScreen component...

const handleFinalConfirm = async () => {
  // 1. Basic Guard
  if (!items || items.length === 0) {
    showToast('error', 'Empty Cart', 'Add items before placing an order.');
    return;
  }

  // 2. Address/Recipient Guard
  if (orderMode === 'self' && !selectedId) {
    showToast('error', 'Required', 'Select a delivery address');
    return;
  }
  if (orderMode === 'others' && !othersConfirmed) {
    showToast('error', 'Required', 'Enter recipient details');
    return;
  }

  try {
    setIsPlacingOrder(true);
    // 3. THE DATA PAYLOAD
    // This is how you distinguish between 'Self' and 'Others' for the backend
    const orderPayload = {
      items: items,
      total: totalAmount,
      orderType: orderMode, // 'self' or 'others'
      addressId: orderMode === 'self' ? selectedId : null,
      recipientDetails: orderMode === 'others' ? othersForm : null,
    };

    console.log("SENDING ORDER TO API:", orderPayload);

    // FIX: Calling the actual API function
    const response = await createOrder(orderPayload);

    if (response.success) {
      // 4. Success Actions
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // IMPORTANT: Clear the "Others" data so the next order doesn't reuse it
      setOthersForm(EMPTY_OTHERS);
      setOthersConfirmed(false);
      
      dispatch(clearCart());
      router.replace('/(tabs)/order-success');
    }
  } catch (error) {
    showToast('error', 'Order Failed', 'Please try again');
  } finally {
    setIsPlacingOrder(false);
  }
};

  const fetchAddressFromBackend = useCallback(async (lat: number, lng: number) => {
    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setIsFetchingAddress(true);
    try {
      const formatted = await getAddressFromCoords(lat, lng, controller.signal);
      if (!controller.signal.aborted) setFull(formatted);
    } catch (e: any) {
      console.error(e);
    } finally {
      if (!controller.signal.aborted) setIsFetchingAddress(false);
    }
  }, []);

  const handleUseLocation = async () => {
    setMapLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showToast('error', 'Denied', 'Permission needed');
      setMapLoading(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const reg = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
    setRegion(reg);
    setMapLoading(false);
    setShowMap(true);
    fetchAddressFromBackend(reg.latitude, reg.longitude);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout Details</Text>
        <View style={{ width: 24 }} />
      </View>

      {!adding && (
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[styles.modeBtn, orderMode === 'self' && styles.modeBtnActive]}
            onPress={() => setOrderMode('self')}
          >
            <Text style={[styles.modeBtnText, orderMode === 'self' && styles.modeBtnTextActive]}>For Myself</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, orderMode === 'others' && styles.modeBtnActive]}
            onPress={() => {
              if (!othersConfirmed) {
                setShowOthersModal(true);
              } else {
                setOrderMode('others');
              }
            }}
          >
            <Text style={[styles.modeBtnText, orderMode === 'others' && styles.modeBtnTextActive]}>For Someone Else</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {adding ? (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>New Personal Address</Text>

            {/* FIX 3: GPS button with dotted border + location icon */}
            <TouchableOpacity style={styles.locBtn} onPress={handleUseLocation} disabled={mapLoading}>
              {mapLoading ? (
                <ActivityIndicator size="small" color="#4b6f9e" />
              ) : (
                <View style={styles.locBtnInner}>
                  <View style={styles.locIconCircle}>
                    <Ionicons name="locate" size={18} color="#fff" />
                  </View>
                  <View style={styles.locBtnTextContainer}>
                    <Text style={styles.locBtnTitle}>Use Current Location</Text>
                    <Text style={styles.locBtnSubtitle}>Auto-fill address via GPS</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#4b6f9e" />
                </View>
              )}
            </TouchableOpacity>

            <TextInput placeholder="Label (Home/Work) *" value={label} onChangeText={setLabel} style={styles.input} />
            <TextInput
              placeholder="Full Address *"
              value={full}
              onChangeText={setFull}
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />
            <TextInput placeholder="Phone Number *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} maxLength={10} />
            <TextInput placeholder="Landmark (Optional)" value={landmark} onChangeText={setLandmark} style={styles.input} />

            <View style={styles.row}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdding(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddPersonal} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save & Select</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            {orderMode === 'self' ? (
              <View>
                <Text style={styles.sectionLabel}>Select Saved Address</Text>
                {loadingAddresses ? (
                  <ActivityIndicator style={{ marginTop: 20 }} />
                ) : (
                  addresses.map(addr => (
                    <TouchableOpacity
                      key={addr.id}
                      style={[styles.addrCard, selectedId === addr.id && styles.addrSelected]}
                      onPress={() => setSelectedId(addr.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addrLabel}>{addr.label}</Text>
                        <Text style={styles.addrFull}>{addr.full}</Text>
                      </View>
                      {selectedId === addr.id && <Ionicons name="checkmark-circle" size={24} color="#4b6f9e" />}
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity style={styles.addNewPersonalBtn} onPress={() => setAdding(true)}>
                  <Ionicons name="add" size={20} color="#4b6f9e" />
                  <Text style={styles.addNewPersonalText}>Add New Personal Address</Text>
                </TouchableOpacity>
              </View>
            ) : (
              othersConfirmed && (
                <View style={styles.othersSummaryCard}>
                  <View style={styles.othersSummaryHeader}>
                    <Ionicons name="gift-outline" size={20} color="#4b6f9e" />
                    <Text style={styles.othersSummaryTitle}>RECIPIENT DETAILS</Text>
                  </View>
                  <Text style={styles.othersSummaryName}>{othersForm.recipientName} • {othersForm.recipientPhone}</Text>
                  <Text style={styles.othersSummaryAddr}>{othersForm.fullAddress}</Text>
                  {othersForm.landmark ? <Text style={styles.othersSummaryLandmark}>Near: {othersForm.landmark}</Text> : null}
                  <TouchableOpacity style={styles.editOthersBtn} onPress={() => setShowOthersModal(true)}>
                    <Text style={styles.editOthersText}>Edit Details</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </View>
        )}
      </ScrollView>

      {!adding && (
        <View style={styles.footer}>
          {(!items || items.length === 0) ? (
            <View style={styles.emptyCartFooter}>
              <View style={styles.emptyCartIconWrap}>
                <Ionicons name="cart-outline" size={22} color="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
                <Text style={styles.emptyCartSub}>Add items to place an order</Text>
              </View>
              <TouchableOpacity style={styles.emptyCartBtn} onPress={() => router.back()}>
                <Text style={styles.emptyCartBtnText}>Browse</Text>
                <Ionicons name="arrow-forward" size={14} color="#4b6f9e" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.confirmBtn, isPlacingOrder && { opacity: 0.8 }]} 
              onPress={handleFinalConfirm} 
              disabled={isPlacingOrder}
              activeOpacity={0.85}
            >
              <View style={styles.confirmBtnInner}>
                {isPlacingOrder ? (
                  <ActivityIndicator color="#fff" style={{ flex: 1 }} />
                ) : (
                  <>
                    <View style={styles.confirmBtnLeft}>
                      <Text style={styles.confirmBtnItemCount}>{items.length} item{items.length > 1 ? 's' : ''}</Text>
                      <Text style={styles.confirmBtnText}>Place Order</Text>
                    </View>
                    <View style={styles.confirmBtnRight}>
                      <Text style={styles.confirmBtnAmount}>₹{totalAmount}</Text>
                      <Ionicons name="arrow-forward-circle" size={22} color="rgba(255,255,255,0.8)" />
                    </View>
                  </>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* FIX 2: Others Modal — avoidSoftInputAdjust with keyboardShouldPersistTaps so form doesn't collapse */}
      <Modal
        visible={showOthersModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowOthersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order for Someone Else</Text>
              <TouchableOpacity onPress={() => setShowOthersModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              <ScrollView
                style={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 60 }}
              >
                <Text style={styles.inputLabel}>RECIPIENT INFO</Text>
                <TextInput
                  placeholder="Recipient Name *"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.recipientName}
                  onChangeText={t => setOthersForm({ ...othersForm, recipientName: t })}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Recipient Phone *"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.recipientPhone}
                  onChangeText={t => setOthersForm({ ...othersForm, recipientPhone: t.replace(/\D/g, '') })}
                  keyboardType="phone-pad"
                  style={styles.input}
                  maxLength={10}
                />

                <Text style={styles.inputLabel}>DELIVERY ADDRESS</Text>
                <TextInput
                  placeholder="Flat, Floor, Building, Area *"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.fullAddress}
                  onChangeText={t => setOthersForm({ ...othersForm, fullAddress: t })}
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                />
                <TextInput
                  placeholder="Landmark (Optional)"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.landmark}
                  onChangeText={t => setOthersForm({ ...othersForm, landmark: t })}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Instruction (e.g. Leave with guard)"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.note}
                  onChangeText={t => setOthersForm({ ...othersForm, note: t })}
                  style={styles.input}
                />

                <TouchableOpacity style={styles.saveBtn} onPress={handleConfirmOthers}>
                  <Text style={styles.saveBtnText}>Confirm Delivery Details</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Map Modal */}
      <Modal visible={showMap} animationType="fade">
        <View style={{ flex: 1 }}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={region}
            onRegionChangeComplete={r => fetchAddressFromBackend(r.latitude, r.longitude)}
          />
          <View style={styles.markerFixed} pointerEvents="none">
            <Ionicons name="location" size={40} color="#ef4444" />
          </View>
          <View style={styles.mapFooter}>
            <Text style={styles.mapAddr}>{isFetchingAddress ? 'Fetching address...' : full}</Text>
            <TouchableOpacity style={styles.mapConfirmBtn} onPress={() => setShowMap(false)}>
              <Text style={styles.mapConfirmBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  modeToggleContainer: { flexDirection: 'row', padding: 4, backgroundColor: '#e2e8f0', margin: 16, borderRadius: 12 },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  modeBtnActive: { backgroundColor: '#4b6f9e' },
  modeBtnText: { color: '#64748b', fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },
  sectionLabel: { marginHorizontal: 16, fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase' },
  addrCard: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#f1f5f9' },
  addrSelected: { borderColor: '#4b6f9e', backgroundColor: '#f0f7ff' },
  addrLabel: { fontWeight: '700', fontSize: 15, color: '#1e293b' },
  addrFull: { fontSize: 13, color: '#64748b', marginTop: 4 },
  addNewPersonalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, padding: 16, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#4b6f9e', borderRadius: 12 },
  addNewPersonalText: { color: '#4b6f9e', fontWeight: '700', marginLeft: 6 },
  formContainer: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 16, elevation: 5, shadowOpacity: 0.1 },
  formTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },

  // FIX 3: GPS button styles
  locBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#4b6f9e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#f0f7ff',
  },
  locBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4b6f9e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locBtnTextContainer: { flex: 1 },
  locBtnTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  locBtnSubtitle: { fontSize: 11, color: '#64748b', marginTop: 1 },

  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 14, color: '#1e293b' },
  row: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#64748b', fontWeight: '600' },
  saveBtn: { flex: 2, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#4b6f9e' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  footer: { padding: 16, paddingBottom: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  emptyCartFooter: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4f8', borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: '#dde6f0' },
  emptyCartIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  emptyCartTitle: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  emptyCartSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  emptyCartBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#dde6f0' },
  emptyCartBtnText: { fontSize: 13, fontWeight: '700', color: '#4b6f9e' },
  confirmBtn: { backgroundColor: '#4b6f9e', borderRadius: 16, shadowColor: '#4b6f9e', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  confirmBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20 },
  confirmBtnLeft: { flexDirection: 'column' },
  confirmBtnItemCount: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  confirmBtnText: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 1 },
  confirmBtnRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmBtnAmount: { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalCloseBtn: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  inputLabel: { fontSize: 11, fontWeight: '900', color: '#4b6f9e', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },

  // Others summary
  othersSummaryCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 16, borderLeftWidth: 5, borderLeftColor: '#4b6f9e' },
  othersSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  othersSummaryTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8' },
  othersSummaryName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  othersSummaryAddr: { color: '#64748b', marginTop: 4 },
  othersSummaryLandmark: { fontSize: 12, color: '#4b6f9e', marginTop: 2, fontWeight: '600' },
  editOthersBtn: { marginTop: 12, padding: 8, backgroundColor: '#f1f5f9', alignSelf: 'flex-start', borderRadius: 8 },
  editOthersText: { fontSize: 12, color: '#4b6f9e', fontWeight: '700' },

  // Map
  markerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40 },
  mapFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  mapAddr: { marginBottom: 15, color: '#1e293b', fontWeight: '500' },
  mapConfirmBtn: { backgroundColor: '#4b6f9e', padding: 18, borderRadius: 12, alignItems: 'center' },
  mapConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});