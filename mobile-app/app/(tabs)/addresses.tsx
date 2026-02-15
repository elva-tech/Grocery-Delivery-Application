import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { clearCart } from '@/store/slices/cartSlice';
import { RootState } from '@/store/store';
import { showToast } from '@/utils/toast';

import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { getAddresses, addAddress, getAddressFromCoords } from '@/api/addresses';

type Address = {
  id: string;
  label: string;
  full: string;
  phone: string;
  altPhone?: string;
  landmark?: string;
};

export default function AddressesScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [label, setLabel] = useState('');
  const [full, setFull] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [landmark, setLandmark] = useState('');

  const [showMap, setShowMap] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [region, setRegion] = useState<any>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await getAddresses();
    setAddresses(data as Address[]);
  };

  const fetchAddressFromBackend = async (lat: number, lng: number) => {
    setIsFetchingAddress(true);
    try {
      const formattedAddress = await getAddressFromCoords(lat, lng);
      setFull(formattedAddress);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingAddress(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setMapLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('error', 'Permission Denied', 'Location access is required');
        return;
      }
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const initialRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setRegion(initialRegion);
      setShowMap(true);
      fetchAddressFromBackend(location.coords.latitude, location.coords.longitude);
    } catch (err) {
      showToast('error', 'Location Error', 'Could not get position');
    } finally {
      setMapLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!label || !full || !phone) {
      showToast('error', 'Missing Fields', 'Please fill all required fields');
      return;
    }
    const newAddr = await addAddress({ label, full, phone, altPhone, landmark });
    setAddresses(prev => [...prev, newAddr as Address]);
    resetForm();
    showToast('success', 'Added!', 'Address saved successfully');
  };

  const resetForm = () => {
    setLabel(''); setFull(''); setPhone(''); setAltPhone(''); setLandmark('');
    setAdding(false);
  };

  const handleConfirm = () => {
    if (!items || items.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('error', 'Empty Cart', 'Please add items to cart before placing order');
      return;
    }
    if (addresses.length === 0 || !selectedId) {
      showToast('error', 'Select Address', 'Please select a delivery address');
      return;
    }
    if (adding) {
      showToast('info', 'Form Open', 'Please save or cancel the address first');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dispatch(clearCart());
    router.replace('/(tabs)/order-success');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.title}>Select Address</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.cartSummary}>
        <View style={styles.cartRow}>
          <Ionicons name="cart-outline" size={20} color="#4b6f9e" />
          <Text style={styles.cartText}>{items?.length || 0} items</Text>
        </View>
        <Text style={styles.cartAmount}>₹{totalAmount?.toFixed(2) || '0.00'}</Text>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No saved addresses.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, selectedId === item.id && styles.selected]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedId(item.id);
            }}
          >
            <Ionicons name="location-outline" size={20} color="#4b6f9e" />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.full}>{item.full}</Text>
              <Text style={styles.meta}>📞 {item.phone}</Text>
              {item.altPhone && <Text style={styles.meta}>Alt: {item.altPhone}</Text>}
              {item.landmark && <Text style={styles.meta}>Landmark: {item.landmark}</Text>}
            </View>
            {selectedId === item.id && <Ionicons name="checkmark-circle" size={20} color="#4b6f9e" />}
          </TouchableOpacity>
        )}
      />

      {adding ? (
        <View style={styles.form}>
          <TouchableOpacity style={styles.locationLoaderBtn} onPress={handleUseCurrentLocation}>
            {mapLoading ? <ActivityIndicator size="small" color="#4b6f9e" /> : (
              <><Ionicons name="navigate" size={16} color="#4b6f9e" /><Text style={styles.locationLoaderText}>Use Real-time Location</Text></>
            )}
          </TouchableOpacity>
          <TextInput placeholder="Label (Home / Work) *" value={label} onChangeText={setLabel} style={styles.input} />
          <TextInput placeholder="Full Address *" value={isFetchingAddress ? "Fetching..." : full} onChangeText={setFull} style={[styles.input, { height: 60 }]} multiline />
          <TextInput placeholder="Phone *" value={phone} onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))} style={styles.input} keyboardType="phone-pad" maxLength={10} />
          <TextInput placeholder="Alt Phone (optional)" value={altPhone} onChangeText={(t) => setAltPhone(t.replace(/[^0-9]/g, ''))} style={styles.input} keyboardType="phone-pad" maxLength={10} />
          <TextInput placeholder="Landmark (optional)" value={landmark} onChangeText={setLandmark} style={styles.input} />
          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
          <Ionicons name="add-circle-outline" size={20} color="#4b6f9e" />
          <Text style={styles.addText}>Add New Address</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.confirmBtn, (items?.length === 0 || !selectedId || adding) && { opacity: 0.35 }]}
        disabled={items?.length === 0 || !selectedId || adding}
        onPress={handleConfirm}
      >
        <Text style={styles.confirmText}>{items?.length === 0 ? 'Cart is Empty' : 'Confirm Order'}</Text>
      </TouchableOpacity>

      <Modal visible={showMap} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            provider={PROVIDER_GOOGLE} style={{ flex: 1 }} initialRegion={region}
            onRegionChangeComplete={(r) => { setRegion(r); fetchAddressFromBackend(r.latitude, r.longitude); }}
          />
          <View style={styles.markerFixed} pointerEvents="none"><Ionicons name="location" size={40} color="#ef4444" /></View>
          <View style={styles.mapOverlay}>
            <Text style={styles.mapAddrPreview}>{isFetchingAddress ? "Locating..." : full}</Text>
            <TouchableOpacity style={styles.mapConfirmBtn} onPress={() => setShowMap(false)}>
               <Text style={styles.mapConfirmText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: '700', color: '#2c3e50' },
  cartSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e9f0f8', padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#dbe4ef' },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartText: { fontSize: 14, fontWeight: '600', color: '#2c3e50' },
  cartAmount: { fontSize: 18, fontWeight: '700', color: '#4b6f9e' },
  empty: { textAlign: 'center', color: '#64748b', marginVertical: 20, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5edf5' },
  selected: { borderColor: '#4b6f9e', backgroundColor: '#eef4fb', borderWidth: 2 },
  label: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  full: { fontSize: 12, color: '#475569', marginBottom: 4 },
  meta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, marginTop: 10, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dbe4ef' },
  addText: { color: '#4b6f9e', fontWeight: '700', fontSize: 15 },
  form: { marginTop: 10, backgroundColor: '#ffffff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#dbe4ef' },
  input: { backgroundColor: '#f6f9fc', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5edf5', marginBottom: 10, fontSize: 14 },
  formButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#dbe4ef' },
  cancelText: { color: '#7b8a9a', fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: '#4b6f9e', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  confirmBtn: { marginTop: 20, backgroundColor: '#4b6f9e', padding: 16, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  locationLoaderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, marginBottom: 12, backgroundColor: '#eef4fb', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#4b6f9e' },
  locationLoaderText: { color: '#4b6f9e', fontWeight: '700', fontSize: 13 },
  markerFixed: { left: '50%', marginLeft: -20, marginTop: -40, position: 'absolute', top: '50%', zIndex: 10 },
  mapOverlay: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#fff', padding: 20, borderRadius: 20, elevation: 10 },
  mapAddrPreview: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 15, textAlign: 'center' },
  mapConfirmBtn: { backgroundColor: '#4b6f9e', padding: 15, borderRadius: 12, alignItems: 'center' },
  mapConfirmText: { color: '#fff', fontWeight: '800', fontSize: 16 }
});