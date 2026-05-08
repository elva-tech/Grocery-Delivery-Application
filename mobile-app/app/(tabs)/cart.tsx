import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { addToCart, removeFromCart } from '@/store/slices/cartSlice';
import { getCartCalculation } from '@/api/cartApi';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';
import { MOBILE_COPY } from '@/src/constants/copy';

const BRAND_BLUE = '#4b6f9e';
const SUCCESS_GREEN = '#10b981';

export default function CartScreen() {
  const { items } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const router = useRouter();
  const confettiRef = useRef<any>(null);

  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryNote, setDeliveryNote] = useState('');

  /**
   * PROFESSIONAL NOTE: Calculated Badge Count
   * Summing the 'quantity' property of all items to reflect true basket size 
   * (e.g., 2 Milk + 1 Bread = 3 items) instead of just unique product count.
   */
  const totalItemsCount = useMemo(() => 
    items.reduce((acc, item) => acc + item.quantity, 0), 
  [items]);

  useEffect(() => {
    const updateCart = async () => {
      setLoading(true);
      try {
        const data = await getCartCalculation(items);

        // Trigger Confetti ONLY when transitioning from NOT free to FREE
        if (data.isFreeDelivery && !bill?.isFreeDelivery && items.length > 0) {
          confettiRef.current?.start();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        setBill(data);
      } catch (error) {
        console.error("Calculation Error", error);
      } finally {
        setLoading(false);
      }
    };
    updateCart();
  }, [items]);

  /**
   * PROFESSIONAL NOTE: Navigation Flow Correction
   * Redirecting to the address management page as the primary action.
   * Final checkout logic is deferred to the post-address selection stage.
   */
  const handleProceed = () => {
    if (!loading && items.length > 0) {
      router.push('/addresses');
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrapper}>
          <View style={styles.emptyHero}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="basket" size={80} color={BRAND_BLUE} />
            </View>
            <Text style={styles.emptyTitle}>{MOBILE_COPY.cart.emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{MOBILE_COPY.cart.emptySubtitle}</Text>
            <TouchableOpacity style={styles.shopButtonLarge} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.shopButtonText}>Browse Products</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.featureGrid}>
            <View style={styles.featureItem}><Ionicons name="flash" size={18} color="#f59e0b" /><Text style={styles.featureText}>{MOBILE_COPY.cart.quickDelivery}</Text></View>
            <View style={styles.featureItem}><Ionicons name="shield-checkmark" size={18} color={SUCCESS_GREEN} /><Text style={styles.featureText}>{MOBILE_COPY.cart.qualityChecked}</Text></View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{MOBILE_COPY.common.myCart} ({totalItemsCount})</Text>
          {bill?.isFreeDelivery && (
            <View style={styles.sprinkleBadge}>
              <Ionicons name="sparkles" size={14} color="#fff" />
              <Text style={styles.sprinkleText}>Free Delivery</Text>
            </View>
          )}
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const thumb = resolveProductImageUri(item);
            return (
            <View style={styles.cartItem}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.itemImage} contentFit="cover" />
              ) : (
                <View style={[styles.itemImage, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="image-outline" size={28} color="#94a3b8" />
                </View>
              )}
              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemUnit}>{item.unit}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>
              <View style={styles.qtyContainer}>
                <TouchableOpacity onPress={() => dispatch(removeFromCart(item.id))} style={styles.qtyBtn}>
                  <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color={item.quantity === 1 ? "#ef4444" : BRAND_BLUE} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => dispatch(addToCart(item))} style={styles.qtyBtn}>
                  <Ionicons name="add" size={16} color={BRAND_BLUE} />
                </TouchableOpacity>
              </View>
            </View>
            );
          }}
          ListFooterComponent={
            <View style={styles.footer}>
              {/* CELEBRATION CARD */}
              <View style={[styles.card, bill?.isFreeDelivery && styles.successCard]}>
                <View style={styles.rowBetween}>
                  <View style={styles.flexRow}>
                    <Ionicons
                      name={bill?.isFreeDelivery ? "gift-outline" : "bicycle-outline"}
                      size={22}
                      color={bill?.isFreeDelivery ? SUCCESS_GREEN : BRAND_BLUE}
                    />
                    <Text style={[styles.motivationText, bill?.isFreeDelivery && { color: SUCCESS_GREEN }]}>
                      {bill?.isFreeDelivery ? "You've unlocked Free Delivery!" : `Add ₹${bill?.amountToFree} more for Free Delivery`}
                    </Text>
                  </View>
                </View>
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${(bill?.progress || 0) * 100}%`, backgroundColor: bill?.isFreeDelivery ? SUCCESS_GREEN : BRAND_BLUE }]} />
                </View>
              </View>

              {/* <Text style={styles.sectionTitle}>Delivery Instructions</Text>
              <View style={styles.noteWrapper}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#94a3b8" style={{ marginTop: 14 }} />
                <TextInput
                  placeholder="Leave it at the door, ring the bell etc."
                  value={deliveryNote}
                  onChangeText={setDeliveryNote}
                  style={styles.largeNoteInput}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#cbd5e1"
                />
              </View> */}

              <View style={styles.billBox}>
                <View style={styles.billRow}><Text style={styles.billLabel}>Item Total</Text><Text style={styles.billValue}>₹{bill?.itemTotal || 0}</Text></View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery Fee</Text>
                  <Text style={[styles.billValue, bill?.isFreeDelivery && { color: SUCCESS_GREEN, fontWeight: '900' }]}>
                    {bill?.isFreeDelivery ? 'FREE' : `₹${bill?.deliveryFee || 0}`}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.billRow}><Text style={styles.totalLabel}>Grand Total</Text><Text style={styles.totalLabel}>₹{bill?.grandTotal || 0}</Text></View>
              </View>
            </View>
          }
        />
      </KeyboardAvoidingView>

      <View style={styles.actionFixed}>
        <View>
          <Text style={styles.actionPrice}>₹{bill?.grandTotal || '...'}</Text>
          <Text style={styles.actionSub}>{totalItemsCount} {totalItemsCount === 1 ? 'Item' : 'Items'} • Incl. Taxes</Text>
        </View>
        <TouchableOpacity
          style={[styles.mainBtn, (loading || items.length === 0) && { opacity: 0.7 }]}
          onPress={handleProceed}
          disabled={loading || items.length === 0}
        >
          <Text style={styles.mainBtnText}>{loading ? 'Updating...' : 'Proceed'}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* THE CONFETTI CANNON */}
      <ConfettiCannon
        count={200}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        ref={confettiRef}
        fadeOut={true}
        colors={[BRAND_BLUE, SUCCESS_GREEN, '#f59e0b', '#ef4444']}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  sprinkleBadge: { backgroundColor: SUCCESS_GREEN, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  sprinkleText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },

  listContent: { paddingBottom: 160 },

  /* FIXED ITEM CARD */
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  itemImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#f1f5f9' },
  itemDetails: { flex: 1, marginLeft: 15, justifyContent: 'center' }, // Fixed merging
  itemName: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  itemUnit: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  itemPrice: { fontSize: 17, fontWeight: '800', color: '#0f172a' },

  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#f1f5f9' },
  qtyBtn: { width: 32, height: 32, backgroundColor: '#fff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', elevation: 1 },
  qtyText: { marginHorizontal: 10, fontWeight: '800', color: '#0f172a', fontSize: 15 },

  footer: { padding: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  successCard: { borderColor: SUCCESS_GREEN, backgroundColor: '#f0fdf4' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flexRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  motivationText: { fontSize: 14, fontWeight: '800', color: '#475569', flexShrink: 1 },
  progressContainer: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 10, marginTop: 15, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 10 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 30, marginBottom: 15 },
  noteWrapper: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', minHeight: 120 },
  largeNoteInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1e293b', paddingTop: 14, textAlignVertical: 'top' },

  billBox: { marginTop: 20, backgroundColor: '#fff', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billLabel: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  billValue: { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },
  totalLabel: { fontSize: 22, fontWeight: '900', color: '#0f172a' },

  actionFixed: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionPrice: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  actionSub: { fontSize: 12, color: BRAND_BLUE, fontWeight: '700' },
  mainBtn: { backgroundColor: BRAND_BLUE, paddingHorizontal: 30, paddingVertical: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mainBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },

  emptyWrapper: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  emptyHero: { alignItems: 'center', paddingHorizontal: 40 },
  emptyIconCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginBottom: 30, borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1' },
  emptyTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  emptySubtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginTop: 12 },
  shopButtonLarge: { marginTop: 35, backgroundColor: BRAND_BLUE, paddingHorizontal: 40, paddingVertical: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  featureGrid: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: 50 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', padding: 10, borderRadius: 12 },
  featureText: { fontSize: 12, fontWeight: '700', color: '#64748b' }
});