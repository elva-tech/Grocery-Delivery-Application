import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { addToCart, removeFromCart, setAppliedCartCoupon, clearAppliedCartCoupon } from '@/store/slices/cartSlice';
import { getCartBillingSettings, calculateBillBackend } from '@/api/cartApi';
import { validateCouponApi } from '@/api/ordersApi';
import { fetchStorefrontCoupons, type StorefrontCoupon } from '@/api/storefrontCouponsApi';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';
import { MOBILE_COPY } from '@/src/constants/copy';
import { showToast } from '@/utils/toast';

const BRAND_BLUE = '#4b6f9e';
const SUCCESS_GREEN = '#10b981';

export default function CartScreen() {
  const { items, appliedCoupon } = useSelector((state: RootState) => state.cart);
  const token = useSelector((state: RootState) => state.auth.token);
  const dispatch = useDispatch();
  const router = useRouter();
  const confettiRef = useRef<any>(null);
  const prevCartSig = useRef<string | null>(null);

  const [billingSettings, setBillingSettings] = useState<{
    freeDeliveryAbove: number;
    deliveryCharge: number;
  } | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [offersVisible, setOffersVisible] = useState(false);
  const [storeOffers, setStoreOffers] = useState<StorefrontCoupon[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [selectingCode, setSelectingCode] = useState<string | null>(null);

  /**
   * PROFESSIONAL NOTE: Calculated Badge Count
   * Summing the 'quantity' property of all items to reflect true basket size 
   * (e.g., 2 Milk + 1 Bread = 3 items) instead of just unique product count.
   */
  const totalItemsCount = useMemo(() => 
    items.reduce((acc, item) => acc + item.quantity, 0), 
  [items]);

  const cartSig = useMemo(() => items.map(i => `${i.id}:${i.quantity}`).join('|'), [items]);

  useEffect(() => {
    if (prevCartSig.current !== null && prevCartSig.current !== cartSig && appliedCoupon) {
      dispatch(clearAppliedCartCoupon());
      showToast('info', 'Offer removed', 'Your cart changed. Re-apply your code if it still applies.');
    }
    prevCartSig.current = cartSig;
  }, [cartSig, appliedCoupon, dispatch]);

  useEffect(() => {
    void getCartBillingSettings().then(setBillingSettings);
  }, []);

  const bill = useMemo(() => {
    if (items.length === 0) return null;
    return calculateBillBackend(items, billingSettings
      ? {
          freeDeliveryThreshold: billingSettings.freeDeliveryAbove,
          deliveryCharge: billingSettings.deliveryCharge,
        }
      : undefined);
  }, [items, billingSettings]);

  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const payableTotal = Math.max(0, (bill?.grandTotal ?? 0) - couponDiscount);

  /** Item subtotal — backend min-order checks match website checkout. */
  const cartAmountForCoupon = bill?.itemTotal ?? 0;

  const applyCouponCode = async (rawCode: string, opts?: { closeOffers?: boolean }) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    if (!token) {
      showToast('info', MOBILE_COPY.auth.loginToContinueTitle, MOBILE_COPY.auth.loginToContinueMessage);
      router.push('/auth/landing');
      return;
    }
    if (cartAmountForCoupon <= 0) {
      showToast('error', 'Wait', 'Bill is still updating.');
      return;
    }
    setCouponError('');
    setIsApplyingCoupon(true);
    try {
      const result = await validateCouponApi(code, cartAmountForCoupon, token);
      dispatch(setAppliedCartCoupon({ code: result.code, discountAmount: result.discountAmount }));
      setCouponInput('');
      if (opts?.closeOffers) setOffersVisible(false);
      showToast('success', 'Coupon applied', result.message || `You saved ₹${result.discountAmount}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setCouponError(err?.message || 'Invalid code');
      dispatch(clearAppliedCartCoupon());
    } finally {
      setIsApplyingCoupon(false);
      setSelectingCode(null);
    }
  };

  const handleApplyCoupon = () => void applyCouponCode(couponInput);

  const openOffersSheet = async () => {
    setOffersVisible(true);
    setOffersError('');
    setOffersLoading(true);
    try {
      const list = await fetchStorefrontCoupons(Math.max(0, cartAmountForCoupon), token);
      setStoreOffers(list);
    } catch (e: unknown) {
      setOffersError(e instanceof Error ? e.message : 'Could not load offers');
      setStoreOffers([]);
    } finally {
      setOffersLoading(false);
    }
  };

  const handleSelectOffer = async (c: StorefrontCoupon) => {
    if (!c.applicableNow) {
      if (c.blockedMessage) showToast('info', 'Not available', c.blockedMessage);
      return;
    }
    setSelectingCode(c.code);
    await applyCouponCode(c.code, { closeOffers: true });
  };

  const handleRemoveCoupon = () => {
    dispatch(clearAppliedCartCoupon());
    setCouponError('');
    setCouponInput('');
  };

  const prevFreeDelivery = useRef<boolean | null>(null);
  useEffect(() => {
    if (!bill) {
      prevFreeDelivery.current = null;
      return;
    }
    if (bill.isFreeDelivery && prevFreeDelivery.current === false && items.length > 0) {
      confettiRef.current?.start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevFreeDelivery.current = Boolean(bill.isFreeDelivery);
  }, [bill?.isFreeDelivery, items.length]);

  /** Cart → delivery address → checkout (payment & place order). */
  const handleProceed = () => {
    if (items.length === 0) return;
    if (!token) {
      showToast('info', MOBILE_COPY.auth.loginToContinueTitle, MOBILE_COPY.auth.loginToContinueMessage);
      router.push('/auth/landing');
      return;
    }
    router.push('/addresses');
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
                <Text style={styles.billBoxTitle}>Bill summary</Text>
                <View style={styles.billRow}><Text style={styles.billLabel}>Item total</Text><Text style={styles.billValue}>₹{bill?.itemTotal || 0}</Text></View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery fee</Text>
                  <Text style={[styles.billValue, bill?.isFreeDelivery && { color: SUCCESS_GREEN, fontWeight: '900' }]}>
                    {bill?.isFreeDelivery ? 'FREE' : `₹${bill?.deliveryFee || 0}`}
                  </Text>
                </View>

                <Text style={styles.couponSectionLabel}>Promo code</Text>
                {appliedCoupon ? (
                  <View style={styles.couponApplied}>
                    <Ionicons name="pricetag" size={16} color="#16a34a" />
                    <Text style={styles.couponAppliedText}>
                      {appliedCoupon.code} · −₹{appliedCoupon.discountAmount}
                    </Text>
                    <TouchableOpacity onPress={handleRemoveCoupon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={20} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.couponRow}>
                    <TextInput
                      style={styles.couponInput}
                      placeholder="Enter code"
                      placeholderTextColor="#94a3b8"
                      value={couponInput}
                      onChangeText={t => { setCouponInput(t.toUpperCase()); setCouponError(''); }}
                      autoCapitalize="characters"
                      returnKeyType="done"
                      onSubmitEditing={handleApplyCoupon}
                      editable={Boolean(bill?.grandTotal)}
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
                )}
                {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}

                {!appliedCoupon ? (
                  <TouchableOpacity style={styles.viewOffersBtn} onPress={openOffersSheet}>
                    <Ionicons name="gift-outline" size={18} color={BRAND_BLUE} />
                    <Text style={styles.viewOffersBtnText}>View available offers</Text>
                    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}

                <View style={styles.divider} />
                {appliedCoupon ? (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>To pay</Text>
                    <Text style={styles.totalLabel}>₹{payableTotal}</Text>
                  </View>
                ) : (
                  <View style={styles.billRow}><Text style={styles.totalLabel}>To pay</Text><Text style={styles.totalLabel}>₹{bill?.grandTotal || 0}</Text></View>
                )}
              </View>
            </View>
          }
        />
      </KeyboardAvoidingView>

      <View style={styles.actionFixed}>
        <View>
          <Text style={styles.actionPrice}>
            ₹{appliedCoupon ? payableTotal : bill?.grandTotal ?? 0}
          </Text>
          <Text style={styles.actionSub}>
            {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            {appliedCoupon ? ' · incl. offer' : ''} · Incl. taxes
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.mainBtn, items.length === 0 && { opacity: 0.7 }]}
          onPress={handleProceed}
          disabled={items.length === 0}
        >
          <Text style={styles.mainBtnText}>Proceed</Text>
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

      <Modal visible={offersVisible} animationType="slide" transparent onRequestClose={() => setOffersVisible(false)}>
        <Pressable style={styles.offerModalOverlay} onPress={() => setOffersVisible(false)}>
          <Pressable style={styles.offerModalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.offerModalGrab}>
              <View style={styles.offerGrabBar} />
            </View>
            <Text style={styles.offerModalTitle}>Available offers</Text>
            <Text style={styles.offerModalSub}>Discount applies on item total (before delivery).</Text>
            {offersLoading ? (
              <View style={styles.offerLoading}>
                <ActivityIndicator color={BRAND_BLUE} />
              </View>
            ) : offersError ? (
              <Text style={styles.offerErrText}>{offersError}</Text>
            ) : storeOffers.length === 0 ? (
              <Text style={styles.offerEmptyText}>No active offers right now. Check back later.</Text>
            ) : (
              <ScrollView style={styles.offerScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {storeOffers.map(c => {
                  const busy = selectingCode === c.code && isApplyingCoupon;
                  return (
                    <View key={c.code} style={[styles.offerCard, !c.applicableNow && styles.offerCardMuted]}>
                      <View style={styles.offerCardTop}>
                        <Text style={styles.offerCode}>{c.code}</Text>
                        {c.firstTimeUserOnly ? (
                          <View style={styles.offerPill}>
                            <Text style={styles.offerPillText}>First order</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.offerSummary}>{c.discountSummary}</Text>
                      {c.description ? <Text style={styles.offerDesc}>{c.description}</Text> : null}
                      {!c.applicableNow && c.blockedMessage ? (
                        <Text style={styles.offerBlocked}>{c.blockedMessage}</Text>
                      ) : (
                        <Text style={styles.offerMeta}>
                          Valid till {new Date(c.validTo).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={[styles.offerSelectBtn, (!c.applicableNow || busy) && styles.offerSelectBtnDisabled]}
                        disabled={!c.applicableNow || busy}
                        onPress={() => void handleSelectOffer(c)}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.offerSelectBtnText}>{c.applicableNow ? 'Apply' : 'Not applicable'}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.offerCloseFooter} onPress={() => setOffersVisible(false)}>
              <Text style={styles.offerCloseFooterText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  billBoxTitle: { fontSize: 13, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billLabel: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  billValue: { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },
  totalLabel: { fontSize: 22, fontWeight: '900', color: '#0f172a' },

  couponSectionLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', marginTop: 8, marginBottom: 8 },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    letterSpacing: 1,
  },
  couponApplyBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 88,
  },
  couponApplyText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 8,
  },
  couponAppliedText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#15803d' },
  couponError: { fontSize: 12, color: '#dc2626', marginTop: 6 },
  viewOffersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  viewOffersBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: BRAND_BLUE },

  offerModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  offerModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '78%',
  },
  offerModalGrab: { alignItems: 'center', paddingVertical: 10 },
  offerGrabBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  offerModalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  offerModalSub: { fontSize: 12, color: '#64748b', marginTop: 6, marginBottom: 12 },
  offerLoading: { paddingVertical: 40, alignItems: 'center' },
  offerErrText: { color: '#dc2626', fontSize: 14, paddingVertical: 20 },
  offerEmptyText: { color: '#64748b', fontSize: 14, paddingVertical: 24 },
  offerScroll: { maxHeight: 420 },
  offerCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  offerCardMuted: { opacity: 0.72 },
  offerCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  offerCode: { fontSize: 16, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },
  offerPill: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  offerPillText: { fontSize: 10, fontWeight: '800', color: '#b45309' },
  offerSummary: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 6 },
  offerDesc: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 17 },
  offerBlocked: { fontSize: 12, fontWeight: '600', color: '#b45309', marginTop: 8 },
  offerMeta: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  offerSelectBtn: {
    marginTop: 12,
    backgroundColor: BRAND_BLUE,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  offerSelectBtnDisabled: { backgroundColor: '#cbd5e1' },
  offerSelectBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  offerCloseFooter: { alignItems: 'center', paddingVertical: 14 },
  offerCloseFooterText: { fontSize: 15, fontWeight: '700', color: '#64748b' },

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