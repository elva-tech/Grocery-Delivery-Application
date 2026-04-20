import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RazorpayCheckout from 'react-native-razorpay';
import { showToast } from '@/utils/toast';
import { clearCart } from '@/store/slices/cartSlice';
import {
  placeOrderBackend,
  validateCouponApi,
  createMobilePaymentOrder,
  verifyMobilePayment,
} from '@/api/ordersApi';
import { getCartCalculation } from '@/api/cartApi';
import { getAddresses } from '@/api/addresses';
import { buildDeliveryAddressPayload, formatAddressSummary } from '@/utils/indiaPincode';
import { RAZORPAY_KEY_ID, APP_BRAND } from '@/src/config/constants';
import { useGetStoreStatusQuery } from '@/api/apiSlice';

export default function CheckoutScreen() {
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);
  const { user, token } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const router = useRouter();

  const [bill, setBill] = useState<{ grandTotal: number; deliveryFee: number }>({ grandTotal: totalAmount, deliveryFee: 0 });
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  const { data: storeStatus } = useGetStoreStatusQuery();
  const isStoreClosed = storeStatus?.isClosed ?? false;

  useEffect(() => {
    if (items.length === 0) { router.replace('/(tabs)'); return; }
    getCartCalculation(items).then(setBill).catch(() => {});
    getAddresses().then(list => { if (list.length > 0) setSelectedAddress(list[0]); }).catch(() => {});
  }, [items]);

  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const finalAmount = Math.max(0, bill.grandTotal - couponDiscount);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !token) return;
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

  const handlePlaceOrder = async () => {
    if (isStoreClosed) { showToast('error', 'Store Closed', 'We are not accepting orders right now.'); return; }
    if (items.length === 0) { showToast('error', 'Empty Cart', 'Add items first.'); return; }
    if (!token) { showToast('error', 'Session Expired', 'Please log in again.'); router.push('/auth/landing'); return; }
    if (!selectedAddress) {
      showToast('error', 'Address required', 'Add a delivery address in Addresses first.');
      return;
    }

    try {
      setIsPlacing(true);

      const orderPayload = {
        items: items.map((i: any) => ({ productId: i.id, qty: i.quantity })),
        paymentMode: paymentMethod,
        deliveryAddress: buildDeliveryAddressPayload(selectedAddress),
        couponCode: appliedCoupon?.code ?? null,
      };

      if (paymentMethod === 'COD') {
        // COD: place order directly, skip Razorpay
        await placeOrderBackend(orderPayload, token);
        dispatch(clearCart());
        router.replace('/(tabs)/order-success');
        return;
      }

      // ONLINE: existing Razorpay flow
      const order = await placeOrderBackend(orderPayload, token);

      const paymentData = await createMobilePaymentOrder(order.orderId, token);
      const rawPhone = ((user as any)?.phone || '').replace(/^\+91\s?/, '').slice(-10);

      const rzpResponse: any = await RazorpayCheckout.open({
        description: 'Grocery Order',
        currency: paymentData.currency || 'INR',
        key: RAZORPAY_KEY_ID,
        amount: String(paymentData.amount),
        name: APP_BRAND,
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressCard}>
            <Ionicons name="location-outline" size={20} color="#4b6f9e" />
            <Text style={styles.addressText}>
              {selectedAddress
                ? (formatAddressSummary(selectedAddress) || selectedAddress.label || 'Saved address')
                : 'No address saved — add one in Addresses'}
            </Text>
          </View>
          {!selectedAddress && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/addresses')}>
              <Text style={{ color: '#4b6f9e', fontSize: 13, marginTop: 6, marginLeft: 4 }}>+ Add delivery address</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemInfo}>{item.quantity}x {item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Items</Text>
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
          <View style={[styles.totalRow, { borderTopWidth: 2 }]}>
            <Text style={[styles.totalLabel, { fontWeight: '800' }]}>Total</Text>
            <Text style={[styles.totalValue, { fontWeight: '800' }]}>₹{finalAmount}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coupon</Text>
          {appliedCoupon ? (
            <View style={styles.couponApplied}>
              <Ionicons name="pricetag" size={15} color="#16a34a" />
              <Text style={styles.couponAppliedText}>{appliedCoupon.code} · −₹{appliedCoupon.discountAmount}</Text>
              <TouchableOpacity onPress={() => { setAppliedCoupon(null); setCouponError(''); }}>
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
                  {isApplyingCoupon ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.couponApplyText}>Apply</Text>}
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
                <Text style={[styles.paymentOptionLabel, paymentMethod === 'ONLINE' && styles.paymentOptionLabelSelected]}>
                  Online Payment
                </Text>
                <Text style={styles.paymentOptionSub}>UPI, Cards, Net Banking</Text>
              </View>
              {paymentMethod === 'ONLINE' && (
                <Ionicons name="checkmark-circle" size={18} color="#4b6f9e" />
              )}
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
                <Text style={[styles.paymentOptionLabel, paymentMethod === 'COD' && styles.paymentOptionLabelCOD]}>
                  Cash on Delivery
                </Text>
                <Text style={styles.paymentOptionSub}>Pay when your order arrives</Text>
              </View>
              {paymentMethod === 'COD' && (
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Pay-on-delivery note */}
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
          (items.length === 0 || isPlacing || isStoreClosed) && styles.btnDisabled,
        ]}
        onPress={handlePlaceOrder}
        activeOpacity={0.85}
        disabled={items.length === 0 || isPlacing || isStoreClosed}
      >
        {isPlacing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>
            {isStoreClosed
              ? '🔴 Store Closed'
              : items.length === 0
              ? 'Your Basket is Empty'
              : paymentMethod === 'COD'
              ? `Place Order (COD)  ₹${finalAmount}`
              : `Confirm & Pay  ₹${finalAmount}`}
          </Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#2c3e50' },
  addressCard: { flexDirection: 'row', backgroundColor: '#ffffff', padding: 16, borderRadius: 14, gap: 10, borderWidth: 1, borderColor: '#dbe4ef', alignItems: 'center' },
  addressText: { color: '#7b8a9a', flex: 1, fontSize: 14, lineHeight: 20 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: { flex: 1, height: 44, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 14, fontSize: 13, fontWeight: '700', color: '#1e293b', borderWidth: 1, borderColor: '#dde6f0', letterSpacing: 1 },
  couponApplyBtn: { backgroundColor: '#4b6f9e', borderRadius: 10, height: 44, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  couponApplyText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  couponApplied: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#86efac', gap: 6 },
  couponAppliedText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#16a34a' },
  couponError: { fontSize: 12, color: '#dc2626', marginTop: 4 },
  itemInfo: { color: '#2c3e50', fontSize: 14 },
  itemPrice: { fontWeight: '600', color: '#2c3e50' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#dbe4ef' },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#4b6f9e' },
  placeOrderBtn: { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#4b6f9e', padding: 18, borderRadius: 16, alignItems: 'center' },
  placeOrderBtnCOD: { backgroundColor: '#16a34a' },
  btnDisabled: { backgroundColor: '#cbd5e1' },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  paymentOptions: { gap: 10 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 14, gap: 12, borderWidth: 1.5, borderColor: '#dbe4ef' },
  paymentOptionSelected: { borderColor: '#4b6f9e', backgroundColor: '#eef3fb' },
  paymentOptionSelectedCOD: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  paymentOptionText: { flex: 1 },
  paymentOptionLabel: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  paymentOptionLabelSelected: { color: '#4b6f9e' },
  paymentOptionLabelCOD: { color: '#16a34a' },
  paymentOptionSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  codNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginBottom: 8, backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  codNoteText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
});