import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { showToast } from '@/utils/toast';
import { clearCart, setAppliedCartCoupon, clearAppliedCartCoupon } from '@/store/slices/cartSlice';
import { clearCheckoutDraft } from '@/store/slices/checkoutSlice';
import {
  placeOrderBackend,
  validateCouponApi,
  createMobilePaymentOrder,
  verifyMobilePayment,
} from '@/api/ordersApi';
import { getCartCalculation } from '@/api/cartApi';
import { buildDeliveryAddressPayload } from '@/utils/indiaPincode';
import { RAZORPAY_KEY_ID } from '@/src/config/constants';
import { useTenantBranding } from '@/contexts/TenantBrandingContext';
import { MOBILE_COPY, customerFacingDeliveryUnavailable } from '@/src/constants/copy';
import { useGetStoreStatusQuery } from '@/api/apiSlice';

export default function CheckoutScreen() {
  const { storeName } = useTenantBranding();
  const isExpoGo = Constants.appOwnership === 'expo';
  const { items, totalAmount, appliedCoupon } = useSelector((state: RootState) => state.cart);
  const draft = useSelector((state: RootState) => state.checkout.draft);
  const { user, token } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const router = useRouter();

  const [bill, setBill] = useState<{ grandTotal: number; deliveryFee: number }>({
    grandTotal: totalAmount,
    deliveryFee: 0,
  });
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  const { data: storeStatus } = useGetStoreStatusQuery();
  const isStoreClosed = storeStatus?.isClosed ?? false;

  useEffect(() => {
    if (items.length === 0) {
      router.replace('/(tabs)/cart');
      return;
    }
    if (!draft) {
      router.replace('/addresses');
    }
  }, [items.length, draft]);

  useEffect(() => {
    if (items.length === 0) return;
    getCartCalculation(items).then(setBill).catch(() => {});
  }, [items]);

  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const finalAmount = Math.max(0, bill.grandTotal - couponDiscount);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !token) return;
    setCouponError('');
    setIsApplyingCoupon(true);
    try {
      const result = await validateCouponApi(couponInput.trim().toUpperCase(), bill.grandTotal, token);
      dispatch(setAppliedCartCoupon({ code: result.code, discountAmount: result.discountAmount }));
      setCouponInput('');
      showToast('success', 'Coupon Applied', result.message || `Saved ₹${result.discountAmount}!`);
    } catch (err: any) {
      setCouponError(err?.message || 'Invalid coupon code');
      dispatch(clearAppliedCartCoupon());
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (isStoreClosed) {
      showToast('error', 'Store Closed', 'We are not accepting orders right now.');
      return;
    }
    if (items.length === 0) {
      showToast('error', 'Empty Cart', 'Add items first.');
      return;
    }
    if (!token) {
      showToast('info', MOBILE_COPY.auth.loginToContinueTitle, MOBILE_COPY.auth.loginToContinueMessage);
      router.push('/auth/landing');
      return;
    }
    if (!draft?.deliverySource) {
      showToast('error', 'Address required', 'Select a delivery address first.');
      router.replace('/addresses');
      return;
    }

    try {
      setIsPlacing(true);
      const addrPayload = buildDeliveryAddressPayload(draft.deliverySource);
      const orderPayload = {
        items: items.map((i: any) => ({
          productId: i.productId || String(i.id).split(':')[0],
          variantId: i.variantId || String(i.id).split(':')[1],
          qty: i.quantity,
        })),
        paymentMode: paymentMethod,
        deliveryAddress: {
          ...addrPayload,
          addressUrl: draft.addressUrl || '',
        },
        couponCode: appliedCoupon?.code ?? null,
      };

      if (paymentMethod === 'COD') {
        await placeOrderBackend(orderPayload, token);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dispatch(clearCheckoutDraft());
        dispatch(clearCart());
        router.replace('/(tabs)/order-success');
        return;
      }

      const order = await placeOrderBackend(orderPayload, token);
      const paymentData = await createMobilePaymentOrder(order.orderId, token);
      const rawPhone = ((user as any)?.phone || '').replace(/^\+91\s?/, '').slice(-10);

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
        throw new Error(
          'Online payment is unavailable in this build. Please use a development build or installed APK.',
        );
      }

      const rzpResponse: any = await razorpayModule.open({
        description: 'Grocery Order',
        currency: paymentData.currency || 'INR',
        key: RAZORPAY_KEY_ID,
        amount: String(paymentData.amount),
        name: storeName,
        order_id: paymentData.razorpay_order_id,
        prefill: {
          email: (user as any)?.email || '',
          contact: rawPhone,
          name: (user as any)?.name || '',
        },
        theme: { color: '#0F2C1D' },
      });

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
        dispatch(clearCheckoutDraft());
        dispatch(clearCart());
        router.replace('/(tabs)/order-success');
      } else {
        showToast('error', 'Payment Error', 'Verification failed. Contact support.');
      }
    } catch (error: any) {
      if (error?.code === 0 || String(error?.description).toLowerCase().includes('cancel')) {
        showToast('error', 'Cancelled', 'Payment was cancelled.');
      } else {
        showToast('error', 'Order Failed', error?.message || 'Please try again.');
      }
    } finally {
      setIsPlacing(false);
    }
  };

  if (!draft || items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color="#4b6f9e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Deliver to</Text>
            <TouchableOpacity onPress={() => router.replace('/addresses')}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.addressCard}>
            <Ionicons name="location-outline" size={20} color="#4b6f9e" />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressMode}>
                {draft.orderMode === 'others' ? 'Someone else' : 'My address'}
              </Text>
              <Text style={styles.addressText}>{draft.summaryText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemInfo} numberOfLines={1}>
                {item.quantity}x {item.name}
              </Text>
              <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>₹{totalAmount}</Text>
          </View>
          {bill.deliveryFee > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery</Text>
              <Text style={styles.totalValue}>₹{bill.deliveryFee}</Text>
            </View>
          )}
          {appliedCoupon && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: '#16a34a' }]}>Coupon ({appliedCoupon.code})</Text>
              <Text style={[styles.totalValue, { color: '#16a34a' }]}>−₹{appliedCoupon.discountAmount}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>₹{finalAmount}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coupon</Text>
          {appliedCoupon ? (
            <View style={styles.couponApplied}>
              <Ionicons name="pricetag" size={15} color="#16a34a" />
              <Text style={styles.couponAppliedText}>
                {appliedCoupon.code} · −₹{appliedCoupon.discountAmount}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  dispatch(clearAppliedCartCoupon());
                  setCouponError('');
                }}
              >
                <Ionicons name="close-circle" size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Enter coupon code"
                  placeholderTextColor="#94a3b8"
                  value={couponInput}
                  onChangeText={t => {
                    setCouponInput(t.toUpperCase());
                    setCouponError('');
                  }}
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
              </View>
              {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'ONLINE' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod('ONLINE')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="card-outline"
                size={20}
                color={paymentMethod === 'ONLINE' ? '#4b6f9e' : '#94a3b8'}
              />
              <View style={styles.paymentOptionText}>
                <Text
                  style={[styles.paymentOptionLabel, paymentMethod === 'ONLINE' && styles.paymentOptionLabelSelected]}
                >
                  Online Payment
                </Text>
                <Text style={styles.paymentOptionSub}>UPI, Cards, Net Banking</Text>
              </View>
              {paymentMethod === 'ONLINE' && <Ionicons name="checkmark-circle" size={18} color="#4b6f9e" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'COD' && styles.paymentOptionSelectedCOD]}
              onPress={() => setPaymentMethod('COD')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cash-outline"
                size={20}
                color={paymentMethod === 'COD' ? '#16a34a' : '#94a3b8'}
              />
              <View style={styles.paymentOptionText}>
                <Text
                  style={[styles.paymentOptionLabel, paymentMethod === 'COD' && styles.paymentOptionLabelCOD]}
                >
                  Cash on Delivery
                </Text>
                <Text style={styles.paymentOptionSub}>Pay when your order arrives</Text>
              </View>
              {paymentMethod === 'COD' && <Ionicons name="checkmark-circle" size={18} color="#16a34a" />}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {paymentMethod === 'COD' && (
        <View style={styles.codNote}>
          <Ionicons name="cash-outline" size={13} color="#16a34a" />
          <Text style={styles.codNoteText}>Pay on Delivery — no advance needed</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.placeOrderBtn,
          paymentMethod === 'COD' && styles.placeOrderBtnCOD,
          (isPlacing || isStoreClosed) && styles.btnDisabled,
        ]}
        onPress={handlePlaceOrder}
        activeOpacity={0.85}
        disabled={isPlacing || isStoreClosed}
      >
        {isPlacing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>
            {isStoreClosed
              ? 'Store Closed'
              : paymentMethod === 'COD'
                ? `Place Order (COD) · ₹${finalAmount}`
                : `Confirm & Pay · ₹${finalAmount}`}
          </Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#2c3e50' },
  changeLink: { fontSize: 13, fontWeight: '700', color: '#4b6f9e' },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#dbe4ef',
    alignItems: 'flex-start',
  },
  addressMode: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  addressText: { color: '#334155', flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, gap: 12 },
  itemInfo: { color: '#2c3e50', fontSize: 14, flex: 1 },
  itemPrice: { fontWeight: '600', color: '#2c3e50' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  totalValue: { fontSize: 14, fontWeight: '700', color: '#2c3e50' },
  grandTotalRow: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#dbe4ef' },
  grandTotalLabel: { fontSize: 18, fontWeight: '800', color: '#2c3e50' },
  grandTotalValue: { fontSize: 18, fontWeight: '800', color: '#4b6f9e' },
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#dbe4ef',
    letterSpacing: 0.5,
  },
  couponApplyBtn: {
    backgroundColor: '#4b6f9e',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponApplyText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    gap: 8,
  },
  couponAppliedText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#16a34a' },
  couponError: { fontSize: 12, color: '#dc2626', marginTop: 6 },
  paymentOptions: { gap: 10 },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#dbe4ef',
  },
  paymentOptionSelected: { borderColor: '#4b6f9e', backgroundColor: '#eef3fb' },
  paymentOptionSelectedCOD: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  paymentOptionText: { flex: 1 },
  paymentOptionLabel: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  paymentOptionLabelSelected: { color: '#4b6f9e' },
  paymentOptionLabelCOD: { color: '#16a34a' },
  paymentOptionSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  codNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  codNoteText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  placeOrderBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#4b6f9e',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  placeOrderBtnCOD: { backgroundColor: '#16a34a' },
  btnDisabled: { backgroundColor: '#cbd5e1' },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
