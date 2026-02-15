import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { showToast } from '@/utils/toast';
import { saveNewOrder } from '@/api/ordersApi';

export default function CheckoutScreen() {
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    if (items.length === 0) {
      router.replace('/(tabs)');
    }
  }, [items]);

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      showToast('error', 'Empty Basket', 'Please add items to your basket first.');
      return;
    }

    try {
      const orderItems = items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        unit: item.unit,
        image: Array.isArray(item.image) ? item.image[0] : item.image
      }));

      const orderData = {
        userId: 'user-123',
        status: 'PLACED',
        deliverySlot: '7-10 AM',
        address: '123, Green Apartments, Bengaluru, 560001',
        totalAmount: totalAmount,
        items: orderItems
      };

      await saveNewOrder(orderData);

      showToast('success', 'Order Placed!', 'Your fresh milk will arrive tomorrow morning.');

      // ✅ navigate WITHOUT params
      router.replace('/(tabs)/order-success');

    } catch (error) {
      showToast('error', 'Order Failed', 'Please try again.');
    }
  };

  const isCartEmpty = items.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressCard}>
            <Ionicons name="location-outline" size={20} color="#4b6f9e" />
            <Text style={styles.addressText}>
              123, Green Apartments, Bengaluru, 560001
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemInfo}>
                {item.quantity}x {item.name}
              </Text>
              <Text style={styles.itemPrice}>
                ₹{item.price * item.quantity}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{totalAmount}</Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.placeOrderBtn, isCartEmpty && styles.btnDisabled]}
        onPress={handlePlaceOrder}
        activeOpacity={0.85}
        disabled={isCartEmpty}
      >
        <Text style={styles.btnText}>
          {isCartEmpty ? "Your Basket is Empty" : `Confirm & Pay ₹${totalAmount}`}
        </Text>
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
  itemInfo: { color: '#2c3e50', fontSize: 14 },
  itemPrice: { fontWeight: '600', color: '#2c3e50' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#dbe4ef' },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#4b6f9e' },
  placeOrderBtn: { margin: 20, backgroundColor: '#4b6f9e', padding: 18, borderRadius: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#cbd5e1' },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});