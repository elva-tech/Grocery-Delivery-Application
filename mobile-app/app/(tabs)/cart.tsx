import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { getCartBillingSettings, calculateBillBackend, clearCartBillingSettingsCache, type CartBillingSettings } from '@/api/cartApi';
import { validateCouponApi } from '@/api/ordersApi';
import { fetchStorefrontCoupons, type StorefrontCoupon } from '@/api/storefrontCouponsApi';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';
import { MOBILE_COPY } from '@/src/constants/copy';
import { showToast } from '@/utils/toast';

const BRAND = '#4b6f9e';
const SUCCESS_GREEN = '#10b981';
const INK = '#0f172a';
const MUTED = '#64748b';
const HAIRLINE = '#eef2f6';
const CARD_BG = '#ffffff';
const PAGE_BG = '#f4f7fb';

export default function CartScreen() {
  const { items, appliedCoupon } = useSelector((state: RootState) => state.cart);
  const token = useSelector((state: RootState) => state.auth.token);
  const dispatch = useDispatch();
  const router = useRouter();
  const confettiRef = useRef<any>(null);
  const prevCartSig = useRef<string | null>(null);

  const [billingSettings, setBillingSettings] = useState<CartBillingSettings | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      clearCartBillingSettingsCache();
      void getCartBillingSettings().then(setBillingSettings);
    }, []),
  );

  const bill = useMemo(() => {
    if (items.length === 0) return null;
    return calculateBillBackend(items, billingSettings
      ? {
          freeDeliveryThreshold: billingSettings.freeDeliveryAbove,
          deliveryCharge: billingSettings.deliveryCharge,
          expressDeliveryCharge: billingSettings.expressDeliveryCharge,
          discountType: billingSettings.discountType,
          discountValue: billingSettings.discountValue,
          maxDiscount: billingSettings.maxDiscount,
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
              <Ionicons name="basket" size={80} color={BRAND} />
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{MOBILE_COPY.common.myCart}</Text>
          <View style={styles.headerRight}>
            {bill?.isFreeDelivery ? (
              <View style={styles.sprinkleBadge}>
                <Ionicons name="sparkles" size={12} color="#fff" />
                <Text style={styles.sprinkleText}>Free delivery</Text>
              </View>
            ) : null}
            <Text style={styles.headerCount}>{totalItemsCount} items</Text>
          </View>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const thumb = resolveProductImageUri(item);
            const stockLimit = item.stock != null && item.stock > 0 ? item.stock : null;
            const atMaxStock = stockLimit != null && item.quantity >= stockLimit;
            return (
              <View style={styles.cartItem}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.itemImage} contentFit="cover" />
                ) : (
                  <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                    <Ionicons name="image-outline" size={22} color="#94a3b8" />
                  </View>
                )}
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  {item.unit ? <Text style={styles.itemUnit}>{item.unit}</Text> : null}
                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                  {atMaxStock && stockLimit != null ? (
                    <Text style={styles.stockLimitHint}>
                      {MOBILE_COPY.cart.maxStockInCart(stockLimit)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.qtyContainer}>
                  <TouchableOpacity
                    onPress={() => dispatch(removeFromCart(item.id))}
                    style={styles.qtyBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons
                      name={item.quantity === 1 ? 'trash-outline' : 'remove'}
                      size={15}
                      color={item.quantity === 1 ? '#ef4444' : BRAND}
                    />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    onPress={() => dispatch(addToCart(item))}
                    style={styles.qtyBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    disabled={atMaxStock}
                  >
                    <Ionicons
                      name="add"
                      size={15}
                      color={atMaxStock ? '#cbd5e1' : BRAND}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <View style={styles.summaryWrap}>
              <View style={styles.summaryCard}>
                <View style={[styles.deliveryStrip, bill?.isFreeDelivery && styles.deliveryStripSuccess]}>
                  <Ionicons
                    name={bill?.isFreeDelivery ? 'gift-outline' : 'bicycle-outline'}
                    size={18}
                    color={bill?.isFreeDelivery ? SUCCESS_GREEN : BRAND}
                  />
                  <Text style={[styles.deliveryStripText, bill?.isFreeDelivery && styles.deliveryStripTextSuccess]}>
                    {bill?.isFreeDelivery
                      ? "You've unlocked free delivery"
                      : `Add ₹${bill?.amountToFree} more for free delivery`}
                  </Text>
                </View>
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${(bill?.progress || 0) * 100}%`,
                        backgroundColor: bill?.isFreeDelivery ? SUCCESS_GREEN : BRAND,
                      },
                    ]}
                  />
                </View>

                <View style={styles.hairline} />

                <Text style={styles.sectionEyebrow}>Bill summary</Text>
                <View style={styles.billBlock}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Item total</Text>
                    <Text style={styles.billValue}>₹{bill?.itemTotal || 0}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Delivery</Text>
                    <Text style={[styles.billValue, bill?.isFreeDelivery && styles.billValueGreen]}>
                      {bill?.isFreeDelivery ? 'Free' : `₹${bill?.deliveryFee || 0}`}
                    </Text>
                  </View>
                  {(bill?.discount ?? 0) > 0 ? (
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, styles.billLabelGreen]}>Store discount</Text>
                      <Text style={[styles.billValue, styles.billValueGreen]}>−₹{bill?.discount}</Text>
                    </View>
                  ) : null}
                  {appliedCoupon ? (
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, styles.billLabelGreen]}>Coupon</Text>
                      <Text style={[styles.billValue, styles.billValueGreen]}>−₹{appliedCoupon.discountAmount}</Text>
                    </View>
                  ) : null}
                  <View style={styles.billTotalRow}>
                    <Text style={styles.billTotalLabel}>To pay</Text>
                    <Text style={styles.billTotalValue}>₹{payableTotal}</Text>
                  </View>
                </View>

                <View style={styles.hairline} />

                <Text style={styles.sectionEyebrow}>Promo code</Text>
                {appliedCoupon ? (
                  <View style={styles.couponApplied}>
                    <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                    <View style={styles.couponAppliedBody}>
                      <Text style={styles.couponAppliedCode}>{appliedCoupon.code}</Text>
                      <Text style={styles.couponAppliedMeta}>You save ₹{appliedCoupon.discountAmount}</Text>
                    </View>
                    <TouchableOpacity onPress={handleRemoveCoupon} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.couponField}>
                      <Ionicons name="pricetag-outline" size={18} color="#94a3b8" />
                      <TextInput
                        style={styles.couponInput}
                        placeholder="Enter code"
                        placeholderTextColor="#b0bec9"
                        value={couponInput}
                        onChangeText={t => { setCouponInput(t.toUpperCase()); setCouponError(''); }}
                        autoCapitalize="characters"
                        returnKeyType="done"
                        onSubmitEditing={handleApplyCoupon}
                        editable={Boolean(bill?.grandTotal)}
                      />
                      <TouchableOpacity
                        style={[styles.couponApplyBtn, (!couponInput.trim() || isApplyingCoupon) && styles.couponApplyBtnDisabled]}
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
                    <TouchableOpacity style={styles.viewOffersBtn} onPress={openOffersSheet} activeOpacity={0.7}>
                      <Ionicons name="gift-outline" size={16} color={BRAND} />
                      <Text style={styles.viewOffersBtnText}>Browse available offers</Text>
                      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          }
        />
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
        <View style={styles.footerBar}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerAmount}>₹{payableTotal}</Text>
            <Text style={styles.footerMeta}>
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'} · incl. taxes
            </Text>
          </View>
          <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed} activeOpacity={0.88}>
            <Text style={styles.proceedBtnText}>Proceed</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* THE CONFETTI CANNON */}
      <ConfettiCannon
        count={200}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        ref={confettiRef}
        fadeOut={true}
        colors={[BRAND, SUCCESS_GREEN, '#f59e0b', '#ef4444']}
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
                <ActivityIndicator color={BRAND} />
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
  container: { flex: 1, backgroundColor: PAGE_BG },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCount: { fontSize: 13, fontWeight: '600', color: MUTED },
  sprinkleBadge: {
    backgroundColor: SUCCESS_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  sprinkleText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 16 },

  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  itemImage: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#f1f5f9' },
  itemImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  itemDetails: { flex: 1, justifyContent: 'center', minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#334155', lineHeight: 19 },
  itemUnit: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: INK, marginTop: 4 },
  stockLimitHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
    lineHeight: 15,
  },

  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 3,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: { minWidth: 22, textAlign: 'center', fontWeight: '700', color: INK, fontSize: 14 },

  summaryWrap: { paddingTop: 6 },
  summaryCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  deliveryStrip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deliveryStripSuccess: {},
  deliveryStripText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#475569', lineHeight: 18 },
  deliveryStripTextSuccess: { color: '#15803d' },
  progressContainer: {
    height: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 6 },

  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginVertical: 16,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  billBlock: { gap: 10 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabel: { fontSize: 14, fontWeight: '500', color: MUTED },
  billLabelGreen: { color: '#15803d' },
  billValue: { fontSize: 14, fontWeight: '600', color: INK },
  billValueGreen: { color: '#16a34a', fontWeight: '700' },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  billTotalLabel: { fontSize: 15, fontWeight: '700', color: INK },
  billTotalValue: { fontSize: 20, fontWeight: '800', color: BRAND, letterSpacing: -0.3 },

  couponField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8edf3',
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 52,
    gap: 10,
  },
  couponInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: INK,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    paddingRight: 4,
    letterSpacing: 1,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  couponApplyBtn: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyBtnDisabled: { opacity: 0.45 },
  couponApplyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  couponAppliedBody: { flex: 1 },
  couponAppliedCode: { fontSize: 15, fontWeight: '800', color: '#15803d', letterSpacing: 1 },
  couponAppliedMeta: { fontSize: 12, color: '#16a34a', marginTop: 2, fontWeight: '500' },
  couponError: { fontSize: 12, color: '#dc2626', marginTop: 8, marginLeft: 2 },
  viewOffersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 6,
  },
  viewOffersBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: BRAND },

  footerSafe: { backgroundColor: CARD_BG },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    gap: 12,
  },
  footerLeft: { flex: 1, minWidth: 0 },
  footerAmount: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  footerMeta: { fontSize: 11, color: MUTED, marginTop: 2, fontWeight: '500' },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexShrink: 0,
  },
  proceedBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  offerModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  offerModalSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '78%',
  },
  offerModalGrab: { alignItems: 'center', paddingVertical: 10 },
  offerGrabBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  offerModalTitle: { fontSize: 20, fontWeight: '800', color: INK },
  offerModalSub: { fontSize: 13, color: MUTED, marginTop: 6, marginBottom: 12, lineHeight: 18 },
  offerLoading: { paddingVertical: 40, alignItems: 'center' },
  offerErrText: { color: '#dc2626', fontSize: 14, paddingVertical: 20 },
  offerEmptyText: { color: MUTED, fontSize: 14, paddingVertical: 24, textAlign: 'center' },
  offerScroll: { maxHeight: 420 },
  offerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  offerCardMuted: { opacity: 0.65 },
  offerCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  offerCode: { fontSize: 16, fontWeight: '800', color: INK, letterSpacing: 1 },
  offerPill: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  offerPillText: { fontSize: 10, fontWeight: '800', color: '#b45309' },
  offerSummary: { fontSize: 14, fontWeight: '600', color: '#334155', marginTop: 6 },
  offerDesc: { fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 17 },
  offerBlocked: { fontSize: 12, fontWeight: '600', color: '#b45309', marginTop: 8 },
  offerMeta: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  offerSelectBtn: {
    marginTop: 12,
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  offerSelectBtnDisabled: { backgroundColor: '#cbd5e1' },
  offerSelectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  offerCloseFooter: { alignItems: 'center', paddingVertical: 14 },
  offerCloseFooterText: { fontSize: 15, fontWeight: '600', color: MUTED },

  emptyWrapper: { flex: 1, backgroundColor: CARD_BG, justifyContent: 'center' },
  emptyHero: { alignItems: 'center', paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  emptyTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  emptySubtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginTop: 12 },
  shopButtonLarge: {
    marginTop: 35,
    backgroundColor: BRAND,
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shopButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  featureGrid: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: 50 },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
  },
  featureText: { fontSize: 12, fontWeight: '700', color: MUTED },
});