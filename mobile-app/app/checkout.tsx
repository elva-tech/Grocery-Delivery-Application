import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToast } from '@/utils/toast';
import { clearCart, setAppliedCartCoupon, clearAppliedCartCoupon } from '@/store/slices/cartSlice';
import { clearCheckoutDraft } from '@/store/slices/checkoutSlice';
import {
  placeOrderBackend,
  validateCouponApi,
  createMobilePaymentOrder,
  verifyMobilePayment,
} from '@/api/ordersApi';
import { calculateBillBackend, getCartCalculation } from '@/api/cartApi';
import { fetchStorefrontCoupons, type StorefrontCoupon } from '@/api/storefrontCouponsApi';
import { formatDeliveryPrice, standardDeliveryPriceLabel } from '@/utils/deliveryBilling';
import { buildDeliveryAddressPayload } from '@/utils/indiaPincode';
import { RAZORPAY_KEY_ID } from '@/src/config/constants';
import { useTenantBranding } from '@/contexts/TenantBrandingContext';
import { MOBILE_COPY, customerFacingCheckoutError } from '@/src/constants/copy';
import { useGetStoreStatusQuery, useGetAppSettingsQuery, isCodPaymentEnabled, isOnlinePaymentEnabled, isExpressDeliveryChoiceEnabled } from '@/api/apiSlice';
import type { DeliveryType } from '@/api/cartApi';

const BRAND = '#4b6f9e';
const INK = '#0f172a';
const MUTED = '#64748b';
const HAIRLINE = '#eef2f6';
const CARD_BG = '#ffffff';
const PAGE_BG = '#f4f7fb';

export default function CheckoutScreen() {
  const { storeName } = useTenantBranding();
  const isExpoGo = Constants.appOwnership === 'expo';
  const { items, totalAmount, appliedCoupon } = useSelector((state: RootState) => state.cart);
  const draft = useSelector((state: RootState) => state.checkout.draft);
  const { user, token } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const router = useRouter();

  const [bill, setBill] = useState<ReturnType<typeof calculateBillBackend>>({
    itemTotal: totalAmount,
    grandTotal: totalAmount,
    deliveryFee: 0,
    discount: 0,
    saved: 0,
    isFreeDelivery: false,
    amountToFree: 0,
    progress: 0,
  });
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [offersVisible, setOffersVisible] = useState(false);
  const [storeOffers, setStoreOffers] = useState<StorefrontCoupon[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [selectingCode, setSelectingCode] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const orderPlacedRef = useRef(false);

  const { data: storeStatus } = useGetStoreStatusQuery();
  const {
    data: appSettings,
    isLoading: settingsLoading,
    refetch: refetchAppSettings,
  } = useGetAppSettingsQuery(undefined, { refetchOnMountOrArgChange: true });
  const isStoreClosed = storeStatus?.isClosed ?? false;
  const showCod = Boolean(appSettings) && isCodPaymentEnabled(appSettings);
  const showOnline = Boolean(appSettings) && isOnlinePaymentEnabled(appSettings);
  const showDeliveryTypeChoice = isExpressDeliveryChoiceEnabled(appSettings);
  const effectiveDeliveryType = showDeliveryTypeChoice ? deliveryType : 'STANDARD';

  useFocusEffect(
    useCallback(() => {
      refetchAppSettings();
    }, [refetchAppSettings]),
  );

  useEffect(() => {
    if (!appSettings) return;
    if (showOnline && !showCod) setPaymentMethod('ONLINE');
    else if (showCod && !showOnline) setPaymentMethod('COD');
  }, [appSettings, showCod, showOnline]);

  const completeOrderSuccess = async (orderId: string) => {
    orderPlacedRef.current = true;
    if (orderId) {
      await AsyncStorage.setItem('@last_order_id', String(orderId));
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dispatch(clearCheckoutDraft());
    dispatch(clearAppliedCartCoupon());
    dispatch(clearCart());
    router.replace('/(tabs)/order-success');
  };

  useEffect(() => {
    if (orderPlacedRef.current) return;
    if (items.length === 0) {
      router.replace('/(tabs)/cart');
      return;
    }
    if (!draft) {
      router.replace('/addresses');
    }
  }, [items.length, draft]);

  useEffect(() => {
    if (!showDeliveryTypeChoice && deliveryType !== 'STANDARD') {
      setDeliveryType('STANDARD');
    }
  }, [showDeliveryTypeChoice, deliveryType]);

  useEffect(() => {
    if (items.length === 0) return;
    if (appSettings) {
      setBill(calculateBillBackend(items, {
        freeDeliveryThreshold: appSettings.freeDeliveryAbove,
        deliveryCharge: appSettings.deliveryCharge,
        expressDeliveryCharge: appSettings.expressDeliveryCharge,
        discountType: appSettings.discountType,
        discountValue: appSettings.discountValue,
        maxDiscount: appSettings.maxDiscount,
      }, effectiveDeliveryType));
      return;
    }
    getCartCalculation(items, effectiveDeliveryType).then(setBill).catch(() => {});
  }, [items, effectiveDeliveryType, appSettings]);

  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const finalAmount = Math.max(0, bill.grandTotal - couponDiscount);
  const cartAmountForCoupon = bill.itemTotal ?? 0;
  const expressDeliveryDescription =
    appSettings?.expressDeliveryDescription?.trim() || 'Faster delivery from the store';

  const applyCouponCode = async (rawCode: string, opts?: { closeOffers?: boolean }) => {
    const code = rawCode.trim().toUpperCase();
    if (!code || !token) return;
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
      showToast('success', 'Coupon Applied', result.message || `Saved ₹${result.discountAmount}!`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setCouponError(err?.message || 'Invalid coupon code');
      dispatch(clearAppliedCartCoupon());
    } finally {
      setIsApplyingCoupon(false);
      setSelectingCode(null);
    }
  };

  const handleApplyCoupon = () => void applyCouponCode(couponInput);

  const openOffersSheet = async () => {
    if (!token) {
      showToast('info', MOBILE_COPY.auth.loginToContinueTitle, MOBILE_COPY.auth.loginToContinueMessage);
      router.push('/auth/landing');
      return;
    }
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
        deliveryType: effectiveDeliveryType,
        deliveryAddress: {
          ...addrPayload,
          addressUrl: draft.addressUrl || '',
        },
        couponCode: appliedCoupon?.code ?? null,
      };

      if (paymentMethod === 'COD') {
        const order = await placeOrderBackend(orderPayload, token);
        await completeOrderSuccess(String(order.orderId || ''));
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
      const razorpayKey = paymentData.key_id || RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        throw new Error(MOBILE_COPY.checkout.onlinePaymentUnavailable);
      }
      if (!razorpayModule || typeof razorpayModule.open !== 'function') {
        throw new Error(
          'Online payment is unavailable in this build. Please use a development build or installed APK.',
        );
      }

      const rzpResponse: any = await razorpayModule.open({
        description: 'Grocery Order',
        currency: paymentData.currency || 'INR',
        key: razorpayKey,
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
        await completeOrderSuccess(String(order.orderId || ''));
      } else {
        showToast('error', 'Payment Error', 'Verification failed. Contact support.');
      }
    } catch (error: any) {
      if (error?.code === 0 || String(error?.description).toLowerCase().includes('cancel')) {
        showToast('error', 'Cancelled', 'Payment was cancelled.');
      } else {
        showToast(
          'error',
          'Order Failed',
          customerFacingCheckoutError(error?.message, { code: error?.code }),
        );
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Delivery */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>Deliver to</Text>
            <TouchableOpacity onPress={() => router.replace('/addresses')} hitSlop={8}>
              <Text style={styles.cardAction}>Change</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.addressRow}>
            <View style={styles.addressIconWrap}>
              <Ionicons name="location" size={18} color={BRAND} />
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.addressMode}>
                {draft.orderMode === 'others' ? 'Someone else' : 'My address'}
              </Text>
              <Text style={styles.addressText}>{draft.summaryText}</Text>
            </View>
          </View>
        </View>

        {/* Order + bill + promo + payment — single premium surface */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrowStandalone}>Order summary</Text>

          <View style={styles.itemsBlock}>
            {items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <Text style={styles.itemInfo} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
              </View>
            ))}
          </View>

          {showDeliveryTypeChoice && appSettings && (
            <View style={styles.deliverySegmentWrap}>
              <View style={styles.deliverySegment}>
                <TouchableOpacity
                  style={[
                    styles.deliverySegmentBtn,
                    deliveryType === 'STANDARD' && styles.deliverySegmentBtnActive,
                  ]}
                  onPress={() => setDeliveryType('STANDARD')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.deliverySegmentLabel,
                      deliveryType === 'STANDARD' && styles.deliverySegmentLabelActive,
                    ]}
                  >
                    Standard
                  </Text>
                  <Text style={styles.deliverySegmentPrice}>
                    {standardDeliveryPriceLabel(totalAmount, appSettings)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.deliverySegmentBtn,
                    deliveryType === 'EXPRESS' && styles.deliverySegmentBtnExpress,
                  ]}
                  onPress={() => setDeliveryType('EXPRESS')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.deliverySegmentLabel,
                      deliveryType === 'EXPRESS' && styles.deliverySegmentLabelExpress,
                    ]}
                  >
                    Express
                  </Text>
                  <Text style={styles.deliverySegmentPrice}>
                    {formatDeliveryPrice(appSettings.expressDeliveryCharge)}
                  </Text>
                </TouchableOpacity>
              </View>
              {deliveryType === 'EXPRESS' && !!expressDeliveryDescription && (
                <Text style={styles.deliverySegmentHint} numberOfLines={2}>
                  {expressDeliveryDescription}
                </Text>
              )}
            </View>
          )}

          <View style={styles.billBlock}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Subtotal</Text>
              <Text style={styles.billValue}>₹{totalAmount}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery</Text>
              <Text style={[styles.billValue, bill.isFreeDelivery && styles.billValueGreen]}>
                {bill.isFreeDelivery ? 'Free' : `₹${bill.deliveryFee}`}
              </Text>
            </View>
            {(bill.discount ?? 0) > 0 && (
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, styles.billLabelGreen]}>Store discount</Text>
                <Text style={[styles.billValue, styles.billValueGreen]}>−₹{bill.discount}</Text>
              </View>
            )}
            {appliedCoupon && (
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, styles.billLabelGreen]}>Coupon</Text>
                <Text style={[styles.billValue, styles.billValueGreen]}>−₹{appliedCoupon.discountAmount}</Text>
              </View>
            )}
            <View style={styles.billTotalRow}>
              <Text style={styles.billTotalLabel}>Total</Text>
              <Text style={styles.billTotalValue}>₹{finalAmount}</Text>
            </View>
          </View>

          <View style={styles.hairline} />

          <Text style={styles.inlineSectionLabel}>Promo code</Text>
          {appliedCoupon ? (
            <View style={styles.couponApplied}>
              <View style={styles.couponAppliedIcon}>
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              </View>
              <View style={styles.couponAppliedBody}>
                <Text style={styles.couponAppliedCode}>{appliedCoupon.code}</Text>
                <Text style={styles.couponAppliedMeta}>You save ₹{appliedCoupon.discountAmount}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  dispatch(clearAppliedCartCoupon());
                  setCouponError('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
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
                  onChangeText={t => {
                    setCouponInput(t.toUpperCase());
                    setCouponError('');
                  }}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={handleApplyCoupon}
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

          {(settingsLoading || showCod || showOnline) && (
            <>
              <View style={styles.hairline} />
              <Text style={styles.inlineSectionLabel}>Payment</Text>
              {settingsLoading ? (
                <ActivityIndicator color={BRAND} style={styles.paymentLoader} />
              ) : (
                <View style={styles.paymentList}>
                  {showOnline && (
                    <TouchableOpacity
                      style={[styles.paymentRow, paymentMethod === 'ONLINE' && styles.paymentRowSelected]}
                      onPress={() => setPaymentMethod('ONLINE')}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.paymentIconWrap, paymentMethod === 'ONLINE' && styles.paymentIconWrapOnline]}>
                        <Ionicons name="card-outline" size={18} color={paymentMethod === 'ONLINE' ? BRAND : '#94a3b8'} />
                      </View>
                      <View style={styles.paymentCopy}>
                        <Text style={[styles.paymentTitle, paymentMethod === 'ONLINE' && styles.paymentTitleSelected]}>
                          Pay online
                        </Text>
                        <Text style={styles.paymentSub}>UPI · Cards · Net banking</Text>
                      </View>
                      <View style={[styles.radioOuter, paymentMethod === 'ONLINE' && styles.radioOuterSelected]}>
                        {paymentMethod === 'ONLINE' ? <View style={styles.radioInner} /> : null}
                      </View>
                    </TouchableOpacity>
                  )}
                  {showCod && (
                    <TouchableOpacity
                      style={[styles.paymentRow, paymentMethod === 'COD' && styles.paymentRowSelectedCod]}
                      onPress={() => setPaymentMethod('COD')}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.paymentIconWrap, paymentMethod === 'COD' && styles.paymentIconWrapCod]}>
                        <Ionicons name="cash-outline" size={18} color={paymentMethod === 'COD' ? '#16a34a' : '#94a3b8'} />
                      </View>
                      <View style={styles.paymentCopy}>
                        <Text style={[styles.paymentTitle, paymentMethod === 'COD' && styles.paymentTitleCod]}>
                          Cash on delivery
                        </Text>
                        <Text style={styles.paymentSub}>Pay when your order arrives</Text>
                      </View>
                      <View style={[styles.radioOuter, paymentMethod === 'COD' && styles.radioOuterCod]}>
                        {paymentMethod === 'COD' ? <View style={[styles.radioInner, styles.radioInnerCod]} /> : null}
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {paymentMethod === 'COD' && (
          <View style={styles.codNote}>
            <Ionicons name="information-circle-outline" size={14} color="#16a34a" />
            <Text style={styles.codNoteText}>No advance payment needed</Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.placeOrderBtn,
            paymentMethod === 'COD' && styles.placeOrderBtnCOD,
            (isPlacing || isStoreClosed) && styles.btnDisabled,
          ]}
          onPress={handlePlaceOrder}
          activeOpacity={0.88}
          disabled={isPlacing || isStoreClosed}
        >
          {isPlacing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.placeOrderInner}>
              <Text style={styles.btnText}>
                {isStoreClosed
                  ? 'Store closed'
                  : paymentMethod === 'COD'
                    ? 'Place order'
                    : 'Confirm & pay'}
              </Text>
              {!isStoreClosed && (
                <Text style={styles.btnAmount}>₹{finalAmount}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

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
                <ActivityIndicator color="#4b6f9e" />
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
                          Valid till{' '}
                          {new Date(c.validTo).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: CARD_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, letterSpacing: -0.2 },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 12 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardEyebrowStandalone: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  cardAction: { fontSize: 13, fontWeight: '600', color: BRAND },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  addressIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef3fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBody: { flex: 1, paddingTop: 2 },
  addressMode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressText: { color: '#334155', fontSize: 15, lineHeight: 22, fontWeight: '500' },

  itemsBlock: { gap: 10, marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemQty: { width: 28, fontSize: 13, fontWeight: '700', color: MUTED, paddingTop: 1 },
  itemInfo: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20, fontWeight: '500' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: INK },

  deliverySegmentWrap: { marginTop: 16, marginBottom: 4 },
  deliverySegment: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  deliverySegmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  deliverySegmentBtnActive: {
    backgroundColor: CARD_BG,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  deliverySegmentBtnExpress: {
    backgroundColor: CARD_BG,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  deliverySegmentLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deliverySegmentLabelActive: { color: BRAND },
  deliverySegmentLabelExpress: { color: '#4f46e5' },
  deliverySegmentPrice: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 3 },
  deliverySegmentHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
    paddingHorizontal: 8,
  },

  billBlock: { marginTop: 16, gap: 10 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabel: { fontSize: 14, fontWeight: '500', color: MUTED },
  billLabelGreen: { color: '#15803d' },
  billValue: { fontSize: 14, fontWeight: '600', color: INK },
  billValueGreen: { color: '#16a34a', fontWeight: '700' },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  billTotalLabel: { fontSize: 16, fontWeight: '700', color: INK },
  billTotalValue: { fontSize: 22, fontWeight: '800', color: BRAND, letterSpacing: -0.5 },

  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginVertical: 18,
  },
  inlineSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

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
  couponAppliedIcon: { width: 28, alignItems: 'center' },
  couponAppliedBody: { flex: 1 },
  couponAppliedCode: { fontSize: 15, fontWeight: '800', color: '#15803d', letterSpacing: 1 },
  couponAppliedMeta: { fontSize: 12, color: '#16a34a', marginTop: 2, fontWeight: '500' },
  couponError: { fontSize: 12, color: '#dc2626', marginTop: 8, marginLeft: 2 },
  viewOffersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  viewOffersBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: BRAND },

  paymentLoader: { marginVertical: 8 },
  paymentList: { gap: 8 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    gap: 12,
  },
  paymentRowSelected: { backgroundColor: '#f8fafc' },
  paymentRowSelectedCod: { backgroundColor: '#f8fdf9' },
  paymentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconWrapOnline: { backgroundColor: '#eef3fb' },
  paymentIconWrapCod: { backgroundColor: '#ecfdf5' },
  paymentCopy: { flex: 1 },
  paymentTitle: { fontSize: 15, fontWeight: '600', color: '#475569' },
  paymentTitleSelected: { color: INK, fontWeight: '700' },
  paymentTitleCod: { color: INK, fontWeight: '700' },
  paymentSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: BRAND },
  radioOuterCod: { borderColor: '#16a34a' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND },
  radioInnerCod: { backgroundColor: '#16a34a' },

  footer: {
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  codNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  codNoteText: { fontSize: 12, color: '#16a34a', fontWeight: '500' },
  placeOrderBtn: {
    backgroundColor: BRAND,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  placeOrderBtnCOD: { backgroundColor: '#16a34a' },
  btnDisabled: { backgroundColor: '#cbd5e1' },
  placeOrderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  btnAmount: { color: 'rgba(255,255,255,0.92)', fontSize: 16, fontWeight: '800' },

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
});
