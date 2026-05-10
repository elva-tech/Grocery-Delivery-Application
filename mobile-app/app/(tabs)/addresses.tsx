import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView,
  Keyboard, DeviceEventEmitter, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';

import AddressMapPicker from '@/components/AddressMapPicker';

import { clearCart } from '@/store/slices/cartSlice';
import { RootState } from '@/store/store';
import { showToast } from '@/utils/toast';
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getAddressFromCoordsDetailed,
  setPreferredDeliveryAddressId,
  getPreferredDeliveryAddressId,
  PREFERRED_DELIVERY_ADDRESS_CHANGED,
} from '@/api/addresses';
import {
  placeOrderBackend,
  validateCouponApi,
  createMobilePaymentOrder,
  verifyMobilePayment,
} from '@/api/ordersApi';
import { getCartCalculation } from '@/api/cartApi';
import { RAZORPAY_KEY_ID } from '@/src/config/constants';
import {
  buildDeliveryAddressPayload,
  formatAddressSummary,
  isValidIndianPincode,
  lookupIndianPincode,
  sanitizeIndianPincode,
} from '@/utils/indiaPincode';
import { checkDeliveryEligibility } from '@/api/deliveryEligibilityApi';
import { MOBILE_COPY, customerFacingDeliveryUnavailable } from '@/src/constants/copy';

type OrderMode = 'self' | 'others';

type OthersData = {
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  note: string;
};

const EMPTY_OTHERS: OthersData = {
  recipientName: '',
  recipientPhone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  note: '',
};

export default function AddressesScreen() {
  const isExpoGo = Constants.appOwnership === 'expo';
  const router = useRouter();
  const dispatch = useDispatch();
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);
  const { user, token } = useSelector((state: RootState) => state.auth);

  const [bill, setBill] = useState<{ grandTotal: number; deliveryFee: number; isFreeDelivery: boolean }>(
    { grandTotal: totalAmount, deliveryFee: 0, isFreeDelivery: false },
  );
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const [orderMode, setOrderMode] = useState<OrderMode>('self');
  const [adding, setAdding] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressInputMode, setAddressInputMode] = useState<'auto' | 'manual'>('auto');
  const [showOthersModal, setShowOthersModal] = useState(false);
  const [othersForm, setOthersForm] = useState<OthersData>(EMPTY_OTHERS);
  const [othersConfirmed, setOthersConfirmed] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false); // New state for API call
  const [label, setLabel] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [pincode, setPincode] = useState('');
  const [othersPinLoading, setOthersPinLoading] = useState(false);
  const [addrLat, setAddrLat] = useState(0);
  const [addrLng, setAddrLng] = useState(0);
  const [phone, setPhone] = useState((user?.phone || '').replace(/^\+91\s*/, ''));

  const [showMap, setShowMap] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [region, setRegion] = useState<any>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  const [deliveryEligibility, setDeliveryEligibility] = useState<{
    checking: boolean;
    eligible: boolean | null;
    message: string;
    mapLink: string;
  }>({ checking: false, eligible: null, message: '', mapLink: '' });
  /** PIN-centered coords for “Someone else” — passed into orders after eligibility passes. */
  const [othersGeo, setOthersGeo] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!token) {
      setAddresses([]);
      setSelectedId(null);
      setLoadingAddresses(false);
      return;
    }
    void load();
  }, [token]);

  /** Same probe as Home / Checkout — saved address or recipient PIN (geocoded). */
  useEffect(() => {
    let cancelled = false;

    const applyProbeResult = (result: any) => {
      const eligible =
        typeof result?.isEligible === 'boolean'
          ? result.isEligible
          : typeof result?.eligible === 'boolean'
            ? result.eligible
            : false;
      const mapLink =
        (typeof result?.mapLink === 'string' && result.mapLink.trim()) ||
        (typeof result?.map_link === 'string' && result.map_link.trim()) ||
        '';
      setDeliveryEligibility({
        checking: false,
        eligible,
        message: typeof result?.message === 'string' ? result.message : '',
        mapLink,
      });
    };

    const run = async () => {
      if (orderMode === 'others') {
        if (!othersConfirmed) {
          setOthersGeo(null);
          setDeliveryEligibility({ checking: false, eligible: null, message: '', mapLink: '' });
          return;
        }
        const p = sanitizeIndianPincode(othersForm.pincode);
        if (!isValidIndianPincode(p)) {
          setOthersGeo(null);
          setDeliveryEligibility({ checking: false, eligible: null, message: '', mapLink: '' });
          return;
        }
        setDeliveryEligibility(prev => ({ ...prev, checking: true, message: '', mapLink: '' }));
        try {
          const geos = await Location.geocodeAsync(`${p}, India`);
          if (cancelled) return;
          if (!geos || geos.length === 0) {
            setOthersGeo(null);
            setDeliveryEligibility({
              checking: false,
              eligible: null,
              message: 'Could not locate this PIN for delivery check.',
              mapLink: '',
            });
            return;
          }
          const { latitude: plat, longitude: plng } = geos[0];
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) {
            setOthersGeo(null);
            setDeliveryEligibility({
              checking: false,
              eligible: null,
              message: 'Could not locate this PIN for delivery check.',
              mapLink: '',
            });
            return;
          }
          setOthersGeo({ lat: plat, lng: plng });
          const result = await checkDeliveryEligibility(plat, plng);
          if (cancelled) return;
          applyProbeResult(result);
        } catch (e: unknown) {
          if (cancelled) return;
          setOthersGeo(null);
          setDeliveryEligibility({
            checking: false,
            eligible: null,
            message: e instanceof Error ? e.message : 'Could not verify delivery.',
            mapLink: '',
          });
        }
        return;
      }

      setOthersGeo(null);

      if (!selectedId) {
        setDeliveryEligibility({ checking: false, eligible: null, message: '', mapLink: '' });
        return;
      }
      const sel = addresses.find((a: any) => String(a?.id) === String(selectedId));
      if (!sel) {
        setDeliveryEligibility({ checking: false, eligible: null, message: '', mapLink: '' });
        return;
      }
      const lat = Number(sel.lat);
      const lng = Number(sel.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        setDeliveryEligibility({
          checking: false,
          eligible: null,
          message:
            'Add a map pin for this address (Use Current Location when editing) to verify delivery.',
          mapLink: '',
        });
        return;
      }
      setDeliveryEligibility(prev => ({ ...prev, checking: true, message: '', mapLink: '' }));
      try {
        const result = await checkDeliveryEligibility(lat, lng);
        if (cancelled) return;
        applyProbeResult(result);
      } catch (e: unknown) {
        if (cancelled) return;
        setDeliveryEligibility({
          checking: false,
          eligible: null,
          message: e instanceof Error ? e.message : 'Could not verify delivery.',
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [orderMode, selectedId, addresses, othersConfirmed, othersForm.pincode]);

  useEffect(() => {
    if (items && items.length > 0) {
      getCartCalculation(items).then(setBill).catch(() => {
        setBill({ grandTotal: totalAmount, deliveryFee: 0, isFreeDelivery: false });
      });
    }
  }, [items, totalAmount]);

  const load = async () => {
    try {
      setLoadingAddresses(true);
      const data = await getAddresses();
      setAddresses(data);
      const pref = await getPreferredDeliveryAddressId();
      if (data.length === 0) {
        await setPreferredDeliveryAddressId(null);
        setSelectedId(null);
      } else if (pref && data.some((a: any) => a?.id === pref)) {
        setSelectedId(pref);
      } else {
        const fallback = (data.find((a: any) => a?.isDefault) || data[0]) as { id: string };
        setSelectedId(fallback.id);
        await setPreferredDeliveryAddressId(fallback.id);
      }
    } catch {
      showToast('error', 'Error', 'Could not load addresses');
    } finally {
      setLoadingAddresses(false);
    }
  };

  const clearPersonalAddressEditor = () => {
    setEditingAddressId(null);
    setAdding(false);
    setLabel('');
    setLine1('');
    setLine2('');
    setLandmark('');
    setCity('');
    setStateField('');
    setPincode('');
    setPhone((user?.phone || '').replace(/^\+91\s*/, ''));
    setAddrLat(0);
    setAddrLng(0);
    setRegion(null);
    setAddressInputMode('auto');
  };

  const startEditAddress = (addr: any) => {
    const lat = Number(addr.lat);
    const lng = Number(addr.lng);
    const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
    setEditingAddressId(String(addr.id));
    setAddressInputMode(hasPin ? 'auto' : 'manual');
    setLabel(String(addr.label || ''));
    setLine1(String(addr.line1 || ''));
    setLine2(String(addr.line2 || ''));
    setLandmark(String(addr.landmark || ''));
    setCity(String(addr.city || ''));
    setStateField(String(addr.state || ''));
    setPincode(String(addr.pincode || '').replace(/\D/g, '').slice(0, 6));
    setPhone(String(addr.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, '').slice(-10));
    setAddrLat(hasPin ? lat : 0);
    setAddrLng(hasPin ? lng : 0);
    if (hasPin) {
      setRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } else {
      setRegion(null);
    }
    setAdding(true);
  };

  const confirmDeleteAddress = (addr: any) => {
    Alert.alert(
      'Delete address',
      `Remove "${addr.label || 'this address'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAddress(String(addr.id));
              await load();
              DeviceEventEmitter.emit(PREFERRED_DELIVERY_ADDRESS_CHANGED);
              showToast('success', 'Removed', 'Address deleted');
            } catch (e: any) {
              showToast('error', 'Error', e?.message || 'Could not delete');
            }
          },
        },
      ],
    );
  };

  const handleAddPersonal = async () => {
    if (!label.trim() || !line1.trim() || !landmark.trim() || !phone.trim()) {
      showToast('error', 'Missing Fields', 'Label, address line 1, landmark, and phone are required');
      return;
    }
    const p = sanitizeIndianPincode(pincode);
    if (!isValidIndianPincode(p)) {
      showToast('error', 'PIN', 'Enter a valid 6-digit Indian PIN code');
      return;
    }
    setIsSaving(true);
    try {
      const lookup = await lookupIndianPincode(p);
      if (!lookup.ok) {
        showToast('error', 'PIN', 'PIN code not found');
        setIsSaving(false);
        return;
      }
      // Same as website AddressModal save: lat/lng come from the MAP PIN / GPS session, not from landmark text or PIN-only guesswork.
      let lat = Number(addrLat);
      let lng = Number(addrLng);
      const hasMapPin =
        Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

      if (!hasMapPin) {
        const rl = region?.latitude;
        const rlng = region?.longitude;
        if (Number.isFinite(rl) && Number.isFinite(rlng) && ((rl as number) !== 0 || (rlng as number) !== 0)) {
          lat = rl as number;
          lng = rlng as number;
        }
      }

      const stillNeedCoords =
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        (lat === 0 && lng === 0);

      // Manual-only fallback: user never opened the map — approximate from PIN (less accurate than a pin).
      if (stillNeedCoords && addressInputMode === 'manual') {
        try {
          const geos = await Location.geocodeAsync(`${lookup.pincode}, India`);
          if (Array.isArray(geos) && geos.length > 0) {
            const g = geos[0];
            if (Number.isFinite(g.latitude) && Number.isFinite(g.longitude)) {
              lat = g.latitude;
              lng = g.longitude;
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        showToast(
          'error',
          'Pin on map',
          'Use Current Location and adjust the map pin to your spot — delivery uses that latitude/longitude (same as the website).',
        );
        setIsSaving(false);
        return;
      }
      const full = formatAddressSummary({
        line1,
        line2,
        landmark,
        city: lookup.city,
        state: lookup.state,
        pincode: lookup.pincode,
      });
      const patch = {
        label,
        line1,
        line2,
        landmark,
        city: lookup.city,
        state: lookup.state,
        pincode: lookup.pincode,
        full,
        phone,
        lat,
        lng,
      };

      if (editingAddressId) {
        const updated = await updateAddress(editingAddressId, patch);
        setAddresses(prev => prev.map(a => (String(a.id) === editingAddressId ? updated : a)));
        setSelectedId(editingAddressId);
        await setPreferredDeliveryAddressId(editingAddressId);
        DeviceEventEmitter.emit(PREFERRED_DELIVERY_ADDRESS_CHANGED);
      } else {
        const newAddr = await addAddress(patch);
        setAddresses(prev => [...prev, newAddr]);
        setSelectedId(newAddr.id);
        await setPreferredDeliveryAddressId(newAddr.id);
        DeviceEventEmitter.emit(PREFERRED_DELIVERY_ADDRESS_CHANGED);
      }

      clearPersonalAddressEditor();
    } catch (e: any) {
      showToast('error', 'Save Failed', e?.message || 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmOthers = async () => {
    if (!othersForm.recipientName || !othersForm.recipientPhone || !othersForm.line1.trim()) {
      showToast('error', 'Missing Info', 'Name, phone, and address line 1 are required');
      return;
    }
    if (!othersForm.landmark.trim()) {
      showToast('error', 'Landmark', 'Landmark is required');
      return;
    }
    if (othersForm.recipientPhone.length !== 10) {
      showToast('error', 'Invalid Phone', '10 digits required');
      return;
    }
    const p = sanitizeIndianPincode(othersForm.pincode);
    if (!isValidIndianPincode(p)) {
      showToast('error', 'PIN', 'Enter a valid 6-digit Indian PIN');
      return;
    }
    setOthersPinLoading(true);
    const lookup = await lookupIndianPincode(p);
    setOthersPinLoading(false);
    if (!lookup.ok) {
      showToast('error', 'PIN', 'PIN code not found');
      return;
    }
    setOthersForm(prev => ({
      ...prev,
      pincode: lookup.pincode,
      city: lookup.city,
      state: lookup.state,
    }));
    setOthersConfirmed(true);
    setShowOthersModal(false);
    setOrderMode('others');
  };

  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const finalAmount = Math.max(0, bill.grandTotal - couponDiscount);

  const deliveryGateActive =
    (orderMode === 'self' && Boolean(selectedId)) || (orderMode === 'others' && othersConfirmed);

  const deliveryPayBlocked =
    deliveryGateActive &&
    (deliveryEligibility.checking ||
      deliveryEligibility.eligible === false ||
      (deliveryEligibility.eligible === null && Boolean(deliveryEligibility.message.trim())));

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    if (!token) {
      showToast('info', MOBILE_COPY.auth.loginToContinueTitle, MOBILE_COPY.auth.loginToContinueMessage);
      router.push('/auth/landing');
      return;
    }
    setCouponError('');
    setIsApplyingCoupon(true);
    try {
      const result = await validateCouponApi(couponInput.trim().toUpperCase(), bill.grandTotal, token);
      setAppliedCoupon({ code: result.code, discountAmount: result.discountAmount });
      setCouponInput('');
      showToast('success', 'Coupon Applied', result.message || `Saved ₹${result.discountAmount}!`);
    } catch (err: any) {
      setCouponError(err?.message || 'Invalid coupon code');
      setAppliedCoupon(null);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
    setCouponInput('');
  };

  const handleFinalConfirm = async () => {
    if (!items || items.length === 0) {
      showToast('error', 'Empty Cart', 'Add items before placing an order.');
      return;
    }
    if (orderMode === 'self' && !selectedId) {
      showToast('error', 'Required', 'Select a delivery address');
      return;
    }
    if (deliveryGateActive) {
      if (deliveryEligibility.checking) {
        showToast('info', 'Please wait', 'Checking delivery for this address…');
        return;
      }
      if (deliveryEligibility.eligible === false) {
        showToast(
          'error',
          MOBILE_COPY.delivery.unavailableToastTitle,
          customerFacingDeliveryUnavailable(deliveryEligibility.message) ||
            MOBILE_COPY.delivery.checkoutBlockedHint,
        );
        return;
      }
      if (deliveryEligibility.eligible === null && deliveryEligibility.message.trim()) {
        showToast(
          'error',
          MOBILE_COPY.home.deliveryCheckUnavailableTitle,
          deliveryEligibility.message,
        );
        return;
      }
    }
    if (orderMode === 'others' && !othersConfirmed) {
      showToast('error', 'Required', 'Enter recipient details');
      return;
    }
    if (!token) {
      showToast('info', MOBILE_COPY.auth.loginToContinueTitle, MOBILE_COPY.auth.loginToContinueMessage);
      router.push('/auth/landing');
      return;
    }

    try {
      setIsPlacingOrder(true);

      const deliverySource =
        orderMode === 'self'
          ? addresses.find((a: any) => a.id === selectedId)
          : {
              line1: othersForm.line1,
              line2: othersForm.line2,
              landmark: othersForm.landmark,
              city: othersForm.city,
              state: othersForm.state,
              pincode: othersForm.pincode,
              recipientName: othersForm.recipientName,
              recipientPhone: othersForm.recipientPhone,
              phone: othersForm.recipientPhone,
              isMyAddress: false,
              lat: othersGeo?.lat ?? 0,
              lng: othersGeo?.lng ?? 0,
            };

      if (!deliverySource) {
        showToast('error', 'Address', 'Select a delivery address');
        setIsPlacingOrder(false);
        return;
      }

      const addrPayload = buildDeliveryAddressPayload(deliverySource);
      const order = await placeOrderBackend(
        {
          items: items.map((i: any) => ({ productId: i.id, qty: i.quantity })),
          paymentMode: 'ONLINE',
          deliveryAddress: {
            ...addrPayload,
            addressUrl: deliveryEligibility.mapLink || '',
          },
          couponCode: appliedCoupon?.code ?? null,
        },
        token,
      );

      const paymentData = await createMobilePaymentOrder(order.orderId, token);

      const rawPhone = ((user as any)?.phone || '').replace(/^\+91\s?/, '').slice(-10);

      const rzpOptions = {
        description: 'Grocery Order',
        currency: paymentData.currency || 'INR',
        key: RAZORPAY_KEY_ID,
        amount: String(paymentData.amount),
        name: 'Grocery Order',
        order_id: paymentData.razorpay_order_id,
        prefill: {
          email: (user as any)?.email || '',
          contact: rawPhone,
          name: (user as any)?.name || '',
        },
        theme: { color: '#0F2C1D' },
      };

      // Expo Go does not include react-native-razorpay native module.
      // Require at call time so this screen can still load in Expo Go.
      if (isExpoGo) {
        throw new Error('Online payment is unavailable in Expo Go. Use a dev build/APK for Razorpay.');
      }

      let razorpayModule: any = null;
      if (Platform.OS !== 'web') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          razorpayModule = require('react-native-razorpay')?.default;
        } catch {
          razorpayModule = null;
        }
      }
      if (!RAZORPAY_KEY_ID) {
        throw new Error('Payment configuration missing. Please contact support.');
      }
      if (!razorpayModule || typeof razorpayModule.open !== 'function') {
        throw new Error('Online payment is unavailable in this build. Please use a development build or installed APK.');
      }

      const rzpResponse: any = await razorpayModule.open(rzpOptions);

      const verified = await verifyMobilePayment(
        {
          order_id: order.orderId,
          razorpay_order_id: rzpResponse.razorpay_order_id,
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_signature: rzpResponse.razorpay_signature,
        },
        token,
      );

      if (verified.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setOthersForm(EMPTY_OTHERS);
        setOthersConfirmed(false);
        setAppliedCoupon(null);
        dispatch(clearCart());
        router.replace('/(tabs)/order-success');
      } else {
        showToast('error', 'Payment Error', 'Verification failed. Contact support.');
      }
    } catch (error: any) {
      if (error?.code === 0 || String(error?.description).toLowerCase().includes('cancel')) {
        showToast('error', 'Cancelled', 'Payment was cancelled');
      } else {
        showToast('error', 'Order Failed', error?.message || 'Please try again');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  /** Only captures pin + reverse-geocoded fields. Delivery eligibility runs on Home / Checkout (like storefront). */
  const handleMapConfirm = () => {
    const lat = addrLat;
    const lng = addrLng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      showToast('error', 'Location', 'Pick a spot on the map first.');
      return;
    }
    Keyboard.dismiss();
    setShowMap(false);
  };

  const fetchAddressFromBackend = useCallback(async (lat: number, lng: number) => {
    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setIsFetchingAddress(true);
    try {
      const detailed = await getAddressFromCoordsDetailed(lat, lng, controller.signal);
      if (!controller.signal.aborted) {
        setLine1(detailed.line1);
        if (detailed.city) setCity(detailed.city);
        if (detailed.state) setStateField(detailed.state);
        if (detailed.pincode) setPincode(detailed.pincode);
        setAddrLat(lat);
        setAddrLng(lng);
      }
    } catch (e: any) {
      // Expected when user moves the map quickly and we cancel the previous lookup.
      if (e?.name !== 'AbortError') {
        console.error(e);
      }
    } finally {
      if (!controller.signal.aborted) setIsFetchingAddress(false);
    }
  }, []);

  const handleUseLocation = async () => {
    // Match website UX: choosing current location should open the address form immediately.
    if (!adding) setAdding(true);
    // Fresh flow clears label; editing keeps the user's saved label.
    if (!editingAddressId) setLabel('');
    setMapLoading(true);
    try {
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
      setAddrLat(reg.latitude);
      setAddrLng(reg.longitude);
      setShowMap(true);
      fetchAddressFromBackend(reg.latitude, reg.longitude);
    } catch (e: any) {
      showToast('error', 'Location', e?.message || 'Could not get current location');
    } finally {
      setMapLoading(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Checkout Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loginGateBody}>
          <Ionicons name="lock-closed-outline" size={56} color="#4b6f9e" />
          <Text style={styles.loginGateTitle}>{MOBILE_COPY.auth.loginToContinueTitle}</Text>
          <Text style={styles.loginGateSubtitle}>{MOBILE_COPY.auth.loginToContinueMessage}</Text>
          <TouchableOpacity style={styles.loginGateBtn} onPress={() => router.push('/auth/landing')} activeOpacity={0.85}>
            <Text style={styles.loginGateBtnText}>Log in</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.formTitle}>{editingAddressId ? 'Edit Personal Address' : 'New Personal Address'}</Text>
            <Text style={styles.formSubtitle}>Choose how you want to add address details</Text>

            <View style={styles.inputModeWrap}>
              <TouchableOpacity
                style={[styles.inputModeBtn, addressInputMode === 'auto' && styles.inputModeBtnActive]}
                onPress={() => setAddressInputMode('auto')}
              >
                <Ionicons
                  name="locate-outline"
                  size={16}
                  color={addressInputMode === 'auto' ? '#fff' : '#64748b'}
                />
                <Text style={[styles.inputModeText, addressInputMode === 'auto' && styles.inputModeTextActive]}>
                  Auto Detect
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inputModeBtn, addressInputMode === 'manual' && styles.inputModeBtnActive]}
                onPress={() => setAddressInputMode('manual')}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={addressInputMode === 'manual' ? '#fff' : '#64748b'}
                />
                <Text style={[styles.inputModeText, addressInputMode === 'manual' && styles.inputModeTextActive]}>
                  Manual Entry
                </Text>
              </TouchableOpacity>
            </View>

            {addressInputMode === 'auto' ? (
              <>
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
                        <Text style={styles.locBtnSubtitle}>Auto-fill address from GPS pin</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#4b6f9e" />
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.gpsStateCard}>
                  <Ionicons
                    name={line1 ? 'checkmark-circle' : 'information-circle-outline'}
                    size={16}
                    color={line1 ? '#16a34a' : '#64748b'}
                  />
                  <Text style={styles.gpsStateText} numberOfLines={2}>
                    {isFetchingAddress
                      ? 'Fetching current address...'
                      : line1
                      ? `Detected: ${line1}`
                      : 'Tap "Use Current Location" to detect your address.'}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.manualHintCard}>
                <Ionicons name="create-outline" size={16} color="#64748b" />
                <Text style={styles.manualHintText}>
                  Enter address fields manually if GPS is not accurate.
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Address Type *</Text>
            <TextInput
              placeholder="Home / Office / Other"
              placeholderTextColor="#94a3b8"
              value={label}
              onChangeText={setLabel}
              autoCorrect={false}
              autoCapitalize="words"
              autoComplete="off"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Address Line 1 *</Text>
            <TextInput
              placeholder="House / Building / Street"
              placeholderTextColor="#94a3b8"
              value={line1}
              onChangeText={setLine1}
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              editable={addressInputMode === 'manual' || !line1}
              multiline
            />
            <Text style={styles.fieldLabel}>Address Line 2</Text>
            <TextInput
              placeholder="Apartment / Floor (optional)"
              placeholderTextColor="#94a3b8"
              value={line2}
              onChangeText={setLine2}
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Landmark *</Text>
            <TextInput
              placeholder="Near..."
              placeholderTextColor="#94a3b8"
              value={landmark}
              onChangeText={setLandmark}
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>City *</Text>
            <TextInput
              placeholder="City"
              placeholderTextColor="#94a3b8"
              value={city}
              onChangeText={setCity}
              editable={addressInputMode === 'manual'}
              style={[styles.input, addressInputMode !== 'manual' && { backgroundColor: '#f1f5f9' }]}
            />
            <Text style={styles.fieldLabel}>State *</Text>
            <TextInput
              placeholder="State"
              placeholderTextColor="#94a3b8"
              value={stateField}
              onChangeText={setStateField}
              editable={addressInputMode === 'manual'}
              style={[styles.input, addressInputMode !== 'manual' && { backgroundColor: '#f1f5f9' }]}
            />
            <Text style={styles.fieldLabel}>PIN Code *</Text>
            <TextInput
              placeholder="6-digit PIN"
              placeholderTextColor="#94a3b8"
              value={pincode}
              onChangeText={t => setPincode(t.replace(/\D/g, '').slice(0, 6))}
              onBlur={async () => {
                const p = sanitizeIndianPincode(pincode);
                if (p.length !== 6 || !isValidIndianPincode(p)) return;
                const r = await lookupIndianPincode(p);
                if (r.ok) {
                  setPincode(r.pincode);
                  setCity(r.city);
                  setStateField(r.state);
                }
              }}
              keyboardType="number-pad"
              style={styles.input}
              maxLength={6}
            />
            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              placeholder="10-digit mobile number"
              placeholderTextColor="#94a3b8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
              maxLength={10}
            />

            <View style={styles.row}>
              <TouchableOpacity style={styles.cancelBtn} onPress={clearPersonalAddressEditor}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddPersonal} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingAddressId ? 'Update & Select' : 'Save & Select'}</Text>
                )}
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
                    <View
                      key={addr.id}
                      style={[styles.addrCard, selectedId === addr.id && styles.addrSelected]}
                    >
                      <TouchableOpacity
                        style={styles.addrCardMain}
                        onPress={() => {
                          setSelectedId(addr.id);
                          void setPreferredDeliveryAddressId(addr.id);
                          DeviceEventEmitter.emit(PREFERRED_DELIVERY_ADDRESS_CHANGED);
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.addrLabel}>{addr.label}</Text>
                          <Text style={styles.addrFull}>{formatAddressSummary(addr)}</Text>
                        </View>
                        {selectedId === addr.id ? (
                          <Ionicons name="checkmark-circle" size={24} color="#4b6f9e" />
                        ) : null}
                      </TouchableOpacity>
                      <View style={styles.addrCardToolbar}>
                        <TouchableOpacity
                          style={styles.addrToolbarBtn}
                          onPress={() => startEditAddress(addr)}
                          accessibilityLabel="Edit address"
                        >
                          <Ionicons name="pencil-outline" size={18} color="#4b6f9e" />
                          <Text style={styles.addrToolbarBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.addrToolbarBtn}
                          onPress={() => confirmDeleteAddress(addr)}
                          accessibilityLabel="Delete address"
                        >
                          <Ionicons name="trash-outline" size={18} color="#dc2626" />
                          <Text style={[styles.addrToolbarBtnText, styles.addrToolbarBtnDanger]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
                {orderMode === 'self' && selectedId && !loadingAddresses ? (
                  <>
                    {deliveryEligibility.checking ? (
                      <View style={[styles.deliveryBannerAddr, styles.deliveryBannerAddrNeutral]}>
                        <ActivityIndicator size="small" color="#4b6f9e" />
                        <Text style={styles.deliveryBannerAddrText}>Checking delivery for this address…</Text>
                      </View>
                    ) : deliveryEligibility.eligible === false ? (
                      <View style={[styles.deliveryBannerAddr, styles.deliveryBannerAddrBad]}>
                        <Ionicons name="alert-circle" size={18} color="#dc2626" />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.deliveryBannerAddrTitle}>
                            {MOBILE_COPY.home.deliveryUnavailableTitle}
                          </Text>
                          <Text style={styles.deliveryBannerAddrSub}>
                            {customerFacingDeliveryUnavailable(deliveryEligibility.message)}
                          </Text>
                        </View>
                      </View>
                    ) : deliveryEligibility.eligible === null && deliveryEligibility.message ? (
                      <View style={[styles.deliveryBannerAddr, styles.deliveryBannerAddrWarn]}>
                        <Ionicons name="information-circle-outline" size={18} color="#b45309" />
                        <Text style={styles.deliveryBannerAddrWarnText}>{deliveryEligibility.message}</Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
                <TouchableOpacity
                  style={styles.addNewPersonalBtn}
                  onPress={() => {
                    setEditingAddressId(null);
                    clearPersonalAddressEditor();
                    setAddressInputMode('auto');
                    setAdding(true);
                  }}
                >
                  <Ionicons name="add" size={20} color="#4b6f9e" />
                  <Text style={styles.addNewPersonalText}>Add New Personal Address</Text>
                </TouchableOpacity>
              </View>
            ) : (
              othersConfirmed && (
                <>
                  <View style={styles.othersSummaryCard}>
                    <View style={styles.othersSummaryHeader}>
                      <Ionicons name="gift-outline" size={20} color="#4b6f9e" />
                      <Text style={styles.othersSummaryTitle}>RECIPIENT DETAILS</Text>
                    </View>
                    <Text style={styles.othersSummaryName}>{othersForm.recipientName} • {othersForm.recipientPhone}</Text>
                    <Text style={styles.othersSummaryAddr}>{formatAddressSummary(othersForm)}</Text>
                    {othersForm.landmark ? <Text style={styles.othersSummaryLandmark}>Near: {othersForm.landmark}</Text> : null}
                    <TouchableOpacity style={styles.editOthersBtn} onPress={() => setShowOthersModal(true)}>
                      <Text style={styles.editOthersText}>Edit Details</Text>
                    </TouchableOpacity>
                  </View>
                  {deliveryEligibility.checking ? (
                    <View style={[styles.deliveryBannerAddr, styles.deliveryBannerAddrNeutral]}>
                      <ActivityIndicator size="small" color="#4b6f9e" />
                      <Text style={styles.deliveryBannerAddrText}>Checking delivery to recipient PIN…</Text>
                    </View>
                  ) : deliveryEligibility.eligible === false ? (
                    <View style={[styles.deliveryBannerAddr, styles.deliveryBannerAddrBad]}>
                      <Ionicons name="alert-circle" size={18} color="#dc2626" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.deliveryBannerAddrTitle}>{MOBILE_COPY.home.deliveryUnavailableTitle}</Text>
                        <Text style={styles.deliveryBannerAddrSub}>
                          {customerFacingDeliveryUnavailable(deliveryEligibility.message)}
                        </Text>
                      </View>
                    </View>
                  ) : deliveryEligibility.eligible === null && deliveryEligibility.message ? (
                    <View style={[styles.deliveryBannerAddr, styles.deliveryBannerAddrWarn]}>
                      <Ionicons name="information-circle-outline" size={18} color="#b45309" />
                      <Text style={styles.deliveryBannerAddrWarnText}>{deliveryEligibility.message}</Text>
                    </View>
                  ) : null}
                </>
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
  <View>
    <View style={styles.couponRow}>
      {appliedCoupon ? (
        <View style={styles.couponApplied}>
          <Ionicons name="pricetag" size={15} color="#16a34a" />
          <Text style={styles.couponAppliedText}>
            {appliedCoupon.code} · –₹{appliedCoupon.discountAmount}
          </Text>
          <TouchableOpacity onPress={handleRemoveCoupon} style={{ marginLeft: 6 }}>
            <Ionicons name="close-circle" size={17} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.couponInput}
            placeholder="Coupon code"
            placeholderTextColor="#94a3b8"
            value={couponInput}
            onChangeText={t => { setCouponInput(t.toUpperCase()); setCouponError(''); }}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleApplyCoupon}
          />
          <TouchableOpacity
            style={[styles.couponApplyBtn, (!couponInput.trim() || isApplyingCoupon) && { opacity: 0.5 }]}
            onPress={handleApplyCoupon}
            disabled={!couponInput.trim() || isApplyingCoupon}
          >
            {isApplyingCoupon ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.couponApplyText}>Apply</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>

    {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}

    <TouchableOpacity
      style={[
        styles.confirmBtn,
        isPlacingOrder && { opacity: 0.85 },
        deliveryPayBlocked && styles.confirmBtnDisabled,
      ]}
      onPress={handleFinalConfirm}
      disabled={isPlacingOrder || deliveryPayBlocked}
      activeOpacity={0.85}
    >
      <View style={styles.confirmBtnInner}>
        {isPlacingOrder ? (
          <ActivityIndicator color="#fff" style={{ flex: 1 }} />
        ) : (
          <>
            <View style={styles.confirmBtnLeft}>
              <Text style={styles.confirmBtnItemCount}>{items.length} item{items.length > 1 ? 's' : ''}</Text>
              <Text style={[styles.confirmBtnText, deliveryPayBlocked && styles.confirmBtnTextMuted]}>
                {deliveryGateActive && deliveryEligibility.checking
                  ? 'Checking delivery…'
                  : deliveryGateActive && deliveryEligibility.eligible === false
                    ? 'Outside delivery area'
                    : deliveryGateActive &&
                        deliveryEligibility.eligible === null &&
                        deliveryEligibility.message.trim()
                      ? 'Verify recipient PIN'
                      : 'Pay & Place Order'}
              </Text>
            </View>
            <View style={styles.confirmBtnRight}>
              <Text style={[styles.confirmBtnAmount, deliveryPayBlocked && styles.confirmBtnTextMuted]}>
                ₹{finalAmount}
              </Text>
              <Ionicons
                name="arrow-forward-circle"
                size={22}
                color={deliveryPayBlocked ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.8)'}
              />
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  </View>
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
                  placeholder="Address line 1 *"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.line1}
                  onChangeText={t => setOthersForm({ ...othersForm, line1: t })}
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                />
                <TextInput
                  placeholder="Address line 2 (optional)"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.line2}
                  onChangeText={t => setOthersForm({ ...othersForm, line2: t })}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Landmark *"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.landmark}
                  onChangeText={t => setOthersForm({ ...othersForm, landmark: t })}
                  style={styles.input}
                />
                <TextInput
                  placeholder="City (from PIN)"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.city}
                  editable={false}
                  style={[styles.input, { backgroundColor: '#f1f5f9' }]}
                />
                <TextInput
                  placeholder="State (from PIN)"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.state}
                  editable={false}
                  style={[styles.input, { backgroundColor: '#f1f5f9' }]}
                />
                <TextInput
                  placeholder="PIN code *"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.pincode}
                  onChangeText={t => setOthersForm({ ...othersForm, pincode: t.replace(/\D/g, '').slice(0, 6) })}
                  onBlur={async () => {
                    const p = sanitizeIndianPincode(othersForm.pincode);
                    if (p.length !== 6 || !isValidIndianPincode(p)) return;
                    setOthersPinLoading(true);
                    const r = await lookupIndianPincode(p);
                    setOthersPinLoading(false);
                    if (r.ok) {
                      setOthersForm(prev => ({ ...prev, pincode: r.pincode, city: r.city, state: r.state }));
                    }
                  }}
                  keyboardType="number-pad"
                  style={styles.input}
                  maxLength={6}
                />
                <TextInput
                  placeholder="Instruction (e.g. Leave with guard)"
                  placeholderTextColor="#94a3b8"
                  value={othersForm.note}
                  onChangeText={t => setOthersForm({ ...othersForm, note: t })}
                  style={styles.input}
                />

                <TouchableOpacity style={styles.saveBtn} onPress={handleConfirmOthers} disabled={othersPinLoading}>
                  <Text style={styles.saveBtnText}>{othersPinLoading ? 'Checking PIN…' : 'Confirm Delivery Details'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <AddressMapPicker
        visible={showMap}
        region={region}
        line1={line1}
        isFetchingAddress={isFetchingAddress}
        onRegionChangeComplete={r => {
          setAddrLat(r.latitude);
          setAddrLng(r.longitude);
          fetchAddressFromBackend(r.latitude, r.longitude);
        }}
        onConfirm={handleMapConfirm}
        onClose={() => {
          Keyboard.dismiss();
          setShowMap(false);
        }}
      />
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
  addrCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  addrCardMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 10 },
  addrCardToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fafbfc',
  },
  addrToolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addrToolbarBtnText: { fontSize: 13, fontWeight: '700', color: '#4b6f9e' },
  addrToolbarBtnDanger: { color: '#dc2626' },
  addrSelected: { borderColor: '#4b6f9e', backgroundColor: '#f0f7ff' },
  addrLabel: { fontWeight: '700', fontSize: 15, color: '#1e293b' },
  addrFull: { fontSize: 13, color: '#64748b', marginTop: 4 },
  addNewPersonalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, padding: 16, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#4b6f9e', borderRadius: 12 },
  addNewPersonalText: { color: '#4b6f9e', fontWeight: '700', marginLeft: 6 },
  formContainer: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 16, elevation: 5, shadowOpacity: 0.1 },
  formTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
  formSubtitle: { fontSize: 12, color: '#64748b', marginBottom: 12, marginTop: -8 },
  inputModeWrap: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  inputModeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe4ef',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  inputModeBtnActive: { backgroundColor: '#4b6f9e', borderColor: '#4b6f9e' },
  inputModeText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  inputModeTextActive: { color: '#fff' },
  gpsStateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  gpsStateText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 17 },
  manualHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  manualHintText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 17 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 2,
  },

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
  deliveryBannerAddr: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  deliveryBannerAddrNeutral: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  deliveryBannerAddrBad: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  deliveryBannerAddrWarn: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  deliveryBannerAddrText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#64748b' },
  deliveryBannerAddrTitle: { fontSize: 13, fontWeight: '800', color: '#991b1b' },
  deliveryBannerAddrSub: { fontSize: 12, fontWeight: '600', color: '#991b1b', marginTop: 4, lineHeight: 17 },
  deliveryBannerAddrWarnText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400e', lineHeight: 17 },

  confirmBtn: { backgroundColor: '#4b6f9e', borderRadius: 16, shadowColor: '#4b6f9e', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  confirmBtnDisabled: { backgroundColor: '#94a3b8', shadowOpacity: 0.08, elevation: 2 },
  confirmBtnTextMuted: { opacity: 0.85 },
  confirmBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20 },
  confirmBtnLeft: { flexDirection: 'column' },
  confirmBtnItemCount: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  confirmBtnText: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 1 },
  confirmBtnRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmBtnAmount: { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Coupon
  couponRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  couponInput: { flex: 1, height: 42, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 14, fontSize: 13, fontWeight: '700', color: '#1e293b', borderWidth: 1, borderColor: '#dde6f0', letterSpacing: 1 },
  couponApplyBtn: { backgroundColor: '#4b6f9e', borderRadius: 10, height: 42, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  couponApplyText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  couponApplied: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#86efac', gap: 6 },
  couponAppliedText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#16a34a' },
  couponError: { fontSize: 12, color: '#dc2626', marginBottom: 6, marginLeft: 2 },

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

  loginGateBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  loginGateTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 20, textAlign: 'center' },
  loginGateSubtitle: { fontSize: 15, color: '#64748b', marginTop: 12, textAlign: 'center', lineHeight: 22 },
  loginGateBtn: {
    marginTop: 28,
    backgroundColor: '#4b6f9e',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginGateBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },

});