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
import { RAZORPAY_KEY_ID, APP_BRAND } from '@/src/config/constants';

export default function CheckoutScreen() {
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);
  const { user, token } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const router = useRouter();

  const [bill, setBill] = useState<{ grandTotal: number; deliveryFee: number }>({ grandTotal: totalAmount, deliveryFee: 0 });
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

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
    if (items.length === 0) { showToast('error', 'Empty Cart', 'Add items first.'); return; }
    if (!token) { showToast('error', 'Session Expired', 'Please log in again.'); router.push('/auth/landing'); return; }

    try {
      setIsPlacing(true);

      const order = await placeOrderBackend(
        {
          items: items.map((i: any) => ({ productId: i.id, qty: i.quantity })),
          paymentMode: 'ONLINE',
          deliveryAddress: selectedAddress
            ? { line1: selectedAddress.full || selectedAddress.label, lat: 0, lng: 0 }
            : { line1: 'Address not selected', lat: 0, lng: 0 },
          couponCode: appliedCoupon?.code ?? null,
        },
        token,
      );

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
                ? (selectedAddress.full || selectedAddress.label || 'Saved address')
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
      </ScrollView>

      <TouchableOpacity
        style={[styles.placeOrderBtn, (items.length === 0 || isPlacing) && styles.btnDisabled]}
        onPress={handlePlaceOrder}
        activeOpacity={0.85}
        disabled={items.length === 0 || isPlacing}
      >
        {isPlacing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>
            {items.length === 0 ? 'Your Basket is Empty' : `Confirm & Pay ₹${finalAmount}`}
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
  placeOrderBtn: { margin: 20, backgroundColor: '#4b6f9e', padding: 18, borderRadius: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#cbd5e1' },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});