/**
 * @file OrdersScreen.tsx
 * @description Order history management with Admin Feedback Loop integrated.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, TextInput, Alert, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '@/utils/toast';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '@/store/slices/cartSlice';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUserOrders,
  cancelOrderApi,
  rateOrderApi,
  reportOrderIssueApi,
  uploadReturnEvidenceApi,
  downloadOrderSummaryPdfApi,
} from '@/api/ordersApi';
import { RootState } from '@/store/store';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
// INTEGRATED: Import settings hook
import { useGetAppSettingsQuery } from '@/api/apiSlice';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';
import { getCustomerOrderStatusTheme, getOnlineRefundSubtitle } from '@/src/utils/orderStatusDisplay';
import {
  filterAndSortCustomerOrders,
  ORDER_STATUS_FILTERS,
  ORDER_SORT_OPTIONS,
  type OrderSortBy,
  type OrderStatusFilter,
} from '@/src/utils/customerOrderList';

const REPORT_REASONS = [
  "Item damaged",
  "Wrong item received",
  "Quality issue",
  "Items missing",
  "Package tampered"
];

const hasOrderRating = (order: any) => {
  const rating = order?.rating;
  if (typeof rating === 'number') return rating > 0;
  if (typeof rating === 'string') return Number(rating) > 0;
  if (!rating || typeof rating !== 'object') return false;
  const rawValue = rating.value ?? rating.stars ?? rating.rating ?? rating.score;
  return Number(rawValue) > 0;
};

export default function OrdersScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { token } = useSelector((state: RootState) => state.auth);
  
  // INTEGRATED: Fetch remote settings
  const { data: settings } = useGetAppSettingsQuery();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [issueComment, setIssueComment] = useState('');
  /** Local file:// URI for preview only (not sent to returns API). */
  const [issueImage, setIssueImage] = useState<string | null>(null);
  /** Cloudinary URL from POST /api/upload — sent as evidenceUrl on submit. */
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [evidenceUploadError, setEvidenceUploadError] = useState<string | null>(null);
  const evidenceUploadSeq = useRef(0);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{title: string, msg: string, action: () => void} | null>(null);

  // ── Rating state ──────────────────────────────────────────────────────────
  const [ratingOrder, setRatingOrder] = useState<any>(null);  // order pending a rating prompt
  const [starValue, setStarValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isDownloadingSummary, setIsDownloadingSummary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('all');
  const [sortBy, setSortBy] = useState<OrderSortBy>('newest');

  const fetchOrders = useCallback(async (isQuiet = false, options?: { skipRatingPrompt?: boolean }) => {
    if (!isQuiet) setLoading(true);
    try {
      const data = await getUserOrders();
      const normalizedData = data.map((order: any) => ({
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || [])
      })).sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(normalizedData);

      if (options?.skipRatingPrompt) return;

      // Auto-prompt rating for first unrated delivered order
      const unrated = normalizedData.find(
        (o: any) => o.status === 'DELIVERED' && !hasOrderRating(o)
      );
      if (unrated) {
        const skippedKey = `@rating_skipped_${unrated._id ?? unrated.id}`;
        const skipped = await AsyncStorage.getItem(skippedKey);
        if (!skipped) {
          setStarValue(0);
          setRatingComment('');
          setRatingOrder(unrated);
        }
      }
    } catch (err) {
      showToast('error', 'Sync Failed', 'Please check your connection');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const resetIssueReportFields = useCallback(() => {
    setIssueImage(null);
    setEvidenceUrl(null);
    setSelectedReason('');
    setIssueComment('');
    evidenceUploadSeq.current += 1;
    setIsUploadingEvidence(false);
    setEvidenceUploadError(null);
  }, []);

  const uploadEvidenceFromAsset = async (
    localUri: string,
    asset: { fileName?: string | null; mimeType?: string | null },
  ) => {
    const seq = ++evidenceUploadSeq.current;
    setIsUploadingEvidence(true);
    setEvidenceUploadError(null);
    setEvidenceUrl(null);

    const name =
      asset.fileName ??
      `evidence_${Date.now()}.${localUri.split('.').pop()?.split('?')[0] || 'jpg'}`;
    const mime = asset.mimeType ?? 'image/jpeg';

    try {
      const { url } = await uploadReturnEvidenceApi(localUri, name, mime);
      if (seq !== evidenceUploadSeq.current) return;
      setEvidenceUrl(url);
      setEvidenceUploadError(null);
      showToast('success', 'Photo uploaded', 'Evidence is ready to submit.');
    } catch (e: any) {
      if (seq !== evidenceUploadSeq.current) return;
      setEvidenceUrl(null);
      const msg = e?.message || 'Could not upload evidence. Try again.';
      setEvidenceUploadError(msg);
      showToast('error', 'Upload failed', msg);
    } finally {
      if (seq === evidenceUploadSeq.current) setIsUploadingEvidence(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "Gallery access is required for evidence.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setIssueImage(asset.uri);
    await uploadEvidenceFromAsset(asset.uri, asset);
  };

  const canSubmitIssue =
    Boolean(selectedReason && evidenceUrl && !isUploadingEvidence && !isSubmittingReport);

  const submitIssueHint = useMemo(() => {
    if (canSubmitIssue) return null;
    const parts: string[] = [];
    if (!selectedReason) parts.push('select a reason');
    if (isUploadingEvidence) parts.push('wait for photo upload');
    else if (!evidenceUrl) {
      parts.push(
        evidenceUploadError
          ? 'photo upload failed — tap the image to try again'
          : 'upload a photo',
      );
    }
    if (!parts.length) return null;
    return `To submit: ${parts.join(', ')}.`;
  }, [
    canSubmitIssue,
    selectedReason,
    evidenceUrl,
    isUploadingEvidence,
    evidenceUploadError,
  ]);

  const handleCancelOrder = (orderToCancel: any) => {
    setConfirmConfig({
      title: "Cancel Order",
      msg: "Are you sure you want to cancel this order?",
      action: async () => {
        try {
          await cancelOrderApi(orderToCancel.id);
          setOrders(prev =>
            prev.map(o =>
              o.id === orderToCancel.id || o._id === orderToCancel._id
                ? { ...o, status: 'CANCELLED' }
                : o
            )
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast('success', 'Order Cancelled', 'Success.');
          setSelectedOrder(null);
          fetchOrders(true);
        } catch (err) {
          showToast('error', 'Failed', 'Could not cancel.');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const submitFinalReport = async () => {
    if (!selectedReason) {
      return Alert.alert('Required Fields', 'Please select a reason.');
    }
    if (!evidenceUrl) {
      return Alert.alert(
        'Required Fields',
        isUploadingEvidence
          ? 'Please wait for the photo to finish uploading.'
          : 'Please select a photo and wait for upload to complete.',
      );
    }

    setIsSubmittingReport(true);
    try {
      if (!token) throw new Error('Not authenticated');
      await reportOrderIssueApi(
        selectedOrder._id ?? selectedOrder.id,
        selectedReason,
        issueComment || 'No comment',
        token,
        evidenceUrl,
      );
      // Optimistic local update
      setOrders(prev =>
        prev.map((o: any) =>
          o.id === selectedOrder.id || o._id === selectedOrder._id
            ? { ...o, status: 'ISSUE_REPORTED', issueDetails: { reason: selectedReason, comment: issueComment } }
            : o
        )
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Report Sent', 'Admin will review.');
      
      setShowIssueModal(false);
      setSelectedOrder(null);
      resetIssueReportFields();
      fetchOrders(true);
    } catch (err) {
      showToast('error', 'Error', 'Submission failed.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const skipRating = async () => {
    if (!ratingOrder) return;
    const key = `@rating_skipped_${ratingOrder._id ?? ratingOrder.id}`;
    await AsyncStorage.setItem(key, '1');
    setRatingOrder(null);
  };

  const submitRating = async () => {
    if (starValue === 0) return showToast('error', 'Select Stars', 'Please tap a star to rate.');
    if (!ratingOrder) return;
    const orderId = String(ratingOrder._id ?? ratingOrder.id);
    setIsSubmittingRating(true);
    try {
      await rateOrderApi(orderId, starValue, ratingComment);
      const ratingPayload = {
        value: starValue,
        comment: ratingComment.trim(),
        createdAt: new Date().toISOString(),
      };
      setOrders((prev) =>
        prev.map((o) => {
          const id = String(o._id ?? o.id);
          return id === orderId ? { ...o, rating: ratingPayload } : o;
        }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Thank you!', 'Your feedback helps us improve.');
      setRatingOrder(null);
      setStarValue(0);
      setRatingComment('');
      fetchOrders(true, { skipRatingPrompt: true });
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Could not submit rating.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchOrders(); }, [fetchOrders]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchOrders(true);
  }, [fetchOrders]);

  const displayOrders = useMemo(
    () => filterAndSortCustomerOrders(orders, searchQuery, statusFilter, sortBy),
    [orders, searchQuery, statusFilter, sortBy],
  );

  const handleReorder = (items: any[]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    items.forEach((p: any) => dispatch(addToCart(p)));
    showToast('success', 'Reordered', 'Added to cart');
    router.push('/(tabs)/cart');
  };

  const handleDownloadOrderSummary = async () => {
    const orderId = selectedOrder?._id ?? selectedOrder?.id;
    if (!orderId) return;
    setIsDownloadingSummary(true);
    try {
      await downloadOrderSummaryPdfApi(String(orderId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Order summary', 'Use the share menu to save or open the PDF.');
    } catch (err: any) {
      showToast(
        'error',
        'Download failed',
        err?.message || 'Could not download order summary.',
      );
    } finally {
      setIsDownloadingSummary(false);
    }
  };

  const renderListToolbar = () => (
    <View style={styles.toolbar}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search order ID, items, date…"
          placeholderTextColor="#94a3b8"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {ORDER_STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterChip, statusFilter === f.id && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.id)}
          >
            <Text style={[styles.filterChipText, statusFilter === f.id && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.sortRow}>
        <Text style={styles.resultCount}>
          {displayOrders.length} of {orders.length} orders
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ORDER_SORT_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.sortChip, sortBy === o.id && styles.sortChipActive]}
              onPress={() => setSortBy(o.id)}
            >
              <Text style={[styles.sortChipText, sortBy === o.id && styles.sortChipTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const theme = getCustomerOrderStatusTheme(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderMain}>
            <Text style={styles.orderId}>Order #{item.id?.slice(0, 10)}</Text>
            <Text style={styles.dateText}>
              {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.color + '15' }]}>
            <Text style={[styles.badgeText, { color: theme.color }]} numberOfLines={2}>
              {theme.label}
            </Text>
          </View>
        </View>
        {item.status === 'PLACED' && theme.subtitle ? (
          <Text style={styles.awaitingSubtitle}>{theme.subtitle}</Text>
        ) : null}
        {getOnlineRefundSubtitle(item) ? (
          <Text style={styles.refundSubtitle}>{getOnlineRefundSubtitle(item)}</Text>
        ) : null}
        <View style={styles.detailsRow}>
          <Text style={styles.itemCount}>{item.items?.length || 0} Items</Text>
          <Text style={styles.totalPrice}>₹{item.totalAmount}</Text>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSelectedOrder(item)}>
            <Text style={styles.secondaryBtnText}>View Items</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => handleReorder(item.items)}>
            <Ionicons name="repeat" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Reorder</Text>
          </TouchableOpacity>
        </View>
        {/* Rate button for unrated delivered orders */}
        {item.status === 'DELIVERED' && !hasOrderRating(item) && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => {
              setStarValue(0); setRatingComment(''); setRatingOrder(item);
            }}
          >
            <Ionicons name="star-outline" size={15} color="#f59e0b" />
            <Text style={styles.rateBtnText}>Rate this order</Text>
          </TouchableOpacity>
        )}
        {/* Show submitted rating */}
        {hasOrderRating(item) && (
          <View style={styles.ratingDisplay}>
            {(() => {
              const raw = Number(item?.rating?.value ?? item?.rating?.stars ?? item?.rating?.rating ?? item?.rating?.score ?? item?.rating ?? 0);
              const safeValue = Math.max(0, Math.min(5, raw));
              return (
                <Text style={styles.ratingStars}>
                  {'★'.repeat(safeValue)}
                  {'☆'.repeat(5 - safeValue)}
                </Text>
              );
            })()}
            {item?.rating?.comment ? <Text style={styles.ratingCommentSmall}>{item.rating.comment}</Text> : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order History</Text>
      </View>

      <FlatList
        style={styles.listView}
        data={displayOrders}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id ?? item._id)}
        ListHeaderComponent={orders.length > 0 ? renderListToolbar : null}
        contentContainerStyle={[
          styles.list,
          displayOrders.length === 0 && { flexGrow: 1 },
        ]}
        scrollEnabled
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4b6f9e" />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>
                {orders.length === 0 ? 'No orders yet' : 'No matching orders'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {orders.length === 0
                  ? 'Your orders will appear here after you place one.'
                  : 'Try a different search or filter.'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Main Order Details Modal */}
      <Modal visible={!!selectedOrder && !showIssueModal} animationType="slide" transparent onRequestClose={() => setSelectedOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
  <View style={{ flex: 1 }}>
    <Text style={styles.modalTitle}>Order Summary</Text>
    <Text
      numberOfLines={1}
      style={{
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 2
      }}
    >
      Order #{(selectedOrder?._id ?? selectedOrder?.id)}
    </Text>
  </View>

  <TouchableOpacity onPress={() => setSelectedOrder(null)}>
    <Ionicons name="close-circle" size={32} color="#cbd5e1" />
  </TouchableOpacity>
</View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {selectedOrder?.status === 'PLACED' && (
                <View style={styles.awaitingBanner}>
                  <Ionicons name="time-outline" size={18} color="#d97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.awaitingBannerTitle}>
                      {getCustomerOrderStatusTheme('PLACED').label}
                    </Text>
                    <Text style={styles.awaitingBannerText}>
                      {getCustomerOrderStatusTheme('PLACED').subtitle}
                    </Text>
                  </View>
                </View>
              )}
              {/* Delivery info row */}
              {(selectedOrder?.address || selectedOrder?.deliverySlot) && (
                <View style={styles.deliveryInfoBox}>
                  {selectedOrder?.address && (
                    <View style={styles.deliveryInfoRow}>
                      <Ionicons name="location-outline" size={15} color="#4b6f9e" />
                      <Text style={styles.deliveryInfoText} numberOfLines={2}>{selectedOrder.address}</Text>
                    </View>
                  )}
                  {selectedOrder?.deliverySlot && (
                    <View style={styles.deliveryInfoRow}>
                      <Ionicons name="time-outline" size={15} color="#4b6f9e" />
                      <Text style={styles.deliveryInfoText}>{selectedOrder.deliverySlot}</Text>
                    </View>
                  )}
                </View>
              )}
              {selectedOrder?.status === 'OUT_FOR_DELIVERY' && (
                <View style={styles.partnerBox}>
                  <Text style={styles.partnerTitle}>Delivery Partner</Text>
                  <Text style={styles.partnerName}>
                    {selectedOrder?.deliveryPartner?.name || 'Will be assigned soon'}
                  </Text>
                  <Text style={styles.partnerPhone}>
                    {selectedOrder?.deliveryPartner?.phoneNumber
                      ? `Mobile: ${selectedOrder.deliveryPartner.phoneNumber}`
                      : 'Mobile number will appear once assigned'}
                  </Text>
                  {selectedOrder?.deliveryPartner?.phoneNumber && (
                    <TouchableOpacity
                      style={styles.partnerCallBtn}
                      onPress={() => Linking.openURL(`tel:${selectedOrder.deliveryPartner.phoneNumber}`)}
                    >
                      <Ionicons name="call-outline" size={15} color="#fff" />
                      <Text style={styles.partnerCallBtnText}>Contact Partner</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {selectedOrder?.items?.map((product: any, idx: number) => {
                const thumb = resolveProductImageUri(product);
                return (
                <View key={idx} style={styles.productRow}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, { justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="image-outline" size={22} color="#94a3b8" />
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productMeta}>{product.quantity} x {product.unit}</Text>
                  </View>
                  <Text style={styles.productPrice}>₹{product.price * product.quantity}</Text>
                </View>
                );
              })}

              {selectedOrder?.adminComment && (
                <View style={styles.adminResponseBox}>
                  <View style={styles.adminResponseHeader}>
                    <Ionicons name="chatbubble-ellipses" size={16} color="#4b6f9e" />
                    <Text style={styles.adminResponseTitle}>ADMIN RESPONSE</Text>
                  </View>
                  <Text style={styles.adminResponseText}>{`"${selectedOrder.adminComment}"`}</Text>
                  {selectedOrder.resolvedAt && (
                    <Text style={styles.adminResponseDate}>
                      Resolved on: {new Date(selectedOrder.resolvedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Total Paid</Text>
                <Text style={styles.billValue}>₹{selectedOrder?.totalAmount}</Text>
              </View>
              
              {/* INTEGRATED: CANCEL ORDER BUTTON TOGGLE */}
              {(selectedOrder?.status === 'PLACED' || selectedOrder?.status === 'CONFIRMED') && settings?.allowOrderCancellation && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelOrder(selectedOrder)}>
                  <Text style={styles.cancelBtnText}>Cancel Order</Text>
                </TouchableOpacity>
              )}

              {selectedOrder?.status === 'DELIVERED' && (
                <TouchableOpacity
                  style={styles.downloadSummaryBtn}
                  onPress={handleDownloadOrderSummary}
                  disabled={isDownloadingSummary}
                >
                  {isDownloadingSummary ? (
                    <ActivityIndicator color="#059669" size="small" />
                  ) : (
                    <Ionicons name="download-outline" size={18} color="#059669" />
                  )}
                  <Text style={styles.downloadSummaryBtnText}>
                    {isDownloadingSummary ? 'Preparing PDF…' : 'Download Order Summary'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* INTEGRATED: REPORT ISSUE BUTTON TOGGLE */}
              {selectedOrder?.status === 'DELIVERED' &&
                (settings?.allowReportIssue || settings?.allowRefunds) &&
                !['ISSUE_REPORTED', 'REFUND_APPROVED', 'REFUND_REJECTED'].includes(selectedOrder?.status) && (
                <TouchableOpacity
                  style={styles.reportBtn}
                  onPress={() => {
                    resetIssueReportFields();
                    setShowIssueModal(true);
                  }}
                >
                  <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                  <Text style={styles.reportBtnText}>Report Issue / Refund</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ISSUE REPORT MODAL */}
      <Modal visible={showIssueModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refund / Issue</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowIssueModal(false);
                  resetIssueReportFields();
                }}
              >
                <Ionicons name="close-circle" size={32} color="#cbd5e1" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>Reason for report</Text>
              <View style={styles.reasonGrid}>
                {REPORT_REASONS.map((r) => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.reasonChip, selectedReason === r && styles.reasonChipActive]} 
                    onPress={() => setSelectedReason(r)}
                  >
                    <Text style={[styles.reasonChipText, selectedReason === r && styles.reasonChipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Describe the issue</Text>
              <TextInput style={styles.inputArea} placeholder="Details..." multiline value={issueComment} onChangeText={setIssueComment} />

              <Text style={styles.label}>Upload Evidence</Text>
              <TouchableOpacity
                style={styles.pickerBox}
                onPress={pickImage}
                disabled={isUploadingEvidence}
              >
                {issueImage ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: issueImage }} style={styles.previewImg} />
                    {isUploadingEvidence && (
                      <View style={styles.previewLoading}>
                        <ActivityIndicator color="#ffffff" />
                      </View>
                    )}
                  </View>
                ) : (
                  <Ionicons name="camera" size={30} color="#94a3b8" />
                )}
              </TouchableOpacity>
              {issueImage && isUploadingEvidence && (
                <Text style={styles.uploadHint}>Uploading evidence…</Text>
              )}
              {issueImage && evidenceUrl && !isUploadingEvidence && (
                <Text style={styles.uploadHintReady}>Evidence uploaded — you can submit.</Text>
              )}
              {issueImage && evidenceUploadError && !isUploadingEvidence && (
                <Text style={styles.uploadHintError}>{evidenceUploadError}</Text>
              )}

              {submitIssueHint ? (
                <Text style={styles.submitHint}>{submitIssueHint}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { marginTop: 30 },
                  !canSubmitIssue && { opacity: 0.6 },
                ]}
                onPress={() => {
                  if (!canSubmitIssue) {
                    Alert.alert('Cannot submit yet', submitIssueHint || 'Complete all required fields.');
                    return;
                  }
                  submitFinalReport();
                }}
                disabled={isSubmittingReport || isUploadingEvidence}
              >
                {isSubmittingReport ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit the issue</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* CONFIRMATION POPUP */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{confirmConfig?.title}</Text>
            <Text style={styles.alertMsg}>{confirmConfig?.msg}</Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity style={styles.alertSecondary} onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.alertSecondaryText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.alertPrimary} onPress={() => { confirmConfig?.action(); setShowConfirmModal(false); }}>
                <Text style={styles.alertPrimaryText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RATING MODAL */}
      <Modal visible={!!ratingOrder} transparent animationType="fade" onRequestClose={skipRating}>
        <View style={styles.alertOverlay}>
          <View style={[styles.alertBox, { paddingBottom: 28 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.alertTitle}>Rate Your Order</Text>
              <TouchableOpacity onPress={skipRating}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.alertMsg, { marginBottom: 20 }]}>
              How was your experience with order #{String(ratingOrder?._id ?? ratingOrder?.id).slice(-6)}?
            </Text>

            {/* Star selector */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => { setStarValue(s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                  <Ionicons
                    name={s <= starValue ? 'star' : 'star-outline'}
                    size={36}
                    color={s <= starValue ? '#f59e0b' : '#d1d5db'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Optional comment */}
            <TextInput
              style={[styles.inputArea, { marginBottom: 20, minHeight: 70 }]}
              placeholder="Any comments? (optional)"
              multiline
              value={ratingComment}
              onChangeText={setRatingComment}
              maxLength={300}
            />

            <View style={styles.alertButtons}>
              <TouchableOpacity style={styles.alertSecondary} onPress={skipRating}>
                <Text style={styles.alertSecondaryText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertPrimary, isSubmittingRating && { opacity: 0.6 }]}
                onPress={submitRating}
                disabled={isSubmittingRating}
              >
                {isSubmittingRating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.alertPrimaryText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Styles remain identical to your original provided code
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  listView: { flex: 1 },
  list: { padding: 16, paddingBottom: 120 },
  toolbar: { marginBottom: 12, gap: 10 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b', paddingVertical: 10 },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: { backgroundColor: '#4b6f9e', borderColor: '#4b6f9e' },
  filterChipText: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  filterChipTextActive: { color: '#fff' },
  sortRow: { gap: 8 },
  resultCount: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  sortChipActive: { backgroundColor: '#e0e7ff' },
  sortChipText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  sortChipTextActive: { color: '#4b6f9e' },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', elevation: 2 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  cardHeaderMain: { flex: 1, minWidth: 0, paddingRight: 4 },
  orderId: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: '44%',
    flexShrink: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'right',
    lineHeight: 14,
  },
  dateText: { fontSize: 13, color: '#94a3b8' },
  awaitingSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
    marginBottom: 10,
    marginTop: -4,
    lineHeight: 18,
    flexShrink: 1,
  },
  refundSubtitle: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 10, marginTop: -4 },
  awaitingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  awaitingBannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  awaitingBannerText: { fontSize: 13, fontWeight: '600', color: '#b45309', marginTop: 4, lineHeight: 18, flexShrink: 1 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f8fafc' },
  itemCount: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  totalPrice: { fontWeight: '900', color: '#1e293b', fontSize: 18 },
  footer: { flexDirection: 'row', gap: 10 },
  
  primaryBtn: { flex: 1, backgroundColor: '#4b6f9e', height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { flex: 0.5, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { color: '#64748b', fontWeight: '700' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  modalScroll: { marginBottom: 20, flexGrow: 0 },
  modalScrollContent: { paddingBottom: 8 },
  
  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  productImage: { width: 60, height: 60, borderRadius: 14, backgroundColor: '#f8fafc' },
  productInfo: { flex: 1, marginLeft: 16 },
  productName: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  productMeta: { fontSize: 13, color: '#94a3b8' },
  productPrice: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  
  modalFooter: { borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 20 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabel: { fontSize: 18, fontWeight: '700', color: '#64748b' },
  billValue: { fontSize: 24, fontWeight: '900', color: '#4b6f9e' },
  cancelBtn: { marginTop: 20, backgroundColor: '#fff', height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 16 },
  downloadSummaryBtn: {
    marginTop: 16,
    backgroundColor: '#fff',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#6ee7b7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  downloadSummaryBtnText: { color: '#059669', fontWeight: '800', fontSize: 15 },
  reportBtn: { marginTop: 12, backgroundColor: '#fff', height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#f59e0b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  reportBtnText: { color: '#f59e0b', fontWeight: '800', fontSize: 15 },
  
  label: { fontSize: 14, fontWeight: '800', color: '#64748b', marginTop: 20, marginBottom: 12 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  reasonChipActive: { backgroundColor: '#4b6f9e', borderColor: '#4b6f9e' },
  reasonChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  reasonChipTextActive: { color: '#fff' },
  inputArea: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, height: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#e2e8f0' },
  pickerBox: { height: 120, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginTop: 10, overflow: 'hidden' },
  previewWrap: { width: '100%', height: '100%' },
  previewImg: { width: '100%', height: '100%' },
  previewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadHint: { marginTop: 8, fontSize: 13, color: '#64748b', fontWeight: '600' },
  uploadHintReady: { marginTop: 8, fontSize: 13, color: '#059669', fontWeight: '600' },
  uploadHintError: { marginTop: 8, fontSize: 13, color: '#dc2626', fontWeight: '600' },
  submitHint: { marginTop: 12, fontSize: 13, color: '#64748b', fontWeight: '600', textAlign: 'center' },

  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  alertTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 10 },
  alertMsg: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  alertButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  alertPrimary: { flex: 1, backgroundColor: '#ef4444', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  alertPrimaryText: { color: '#fff', fontWeight: '800' },
  alertSecondary: { flex: 1, backgroundColor: '#f1f5f9', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  alertSecondaryText: { color: '#64748b', fontWeight: '800' },

  adminResponseBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  adminResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  adminResponseTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4b6f9e',
    letterSpacing: 1,
  },
  adminResponseText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  adminResponseDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 12,
  },

  // Rating
  rateBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  rateBtnText: { color: '#b45309', fontWeight: '800', fontSize: 13 },
  ratingDisplay: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingStars: { fontSize: 16, color: '#f59e0b', letterSpacing: 1 },
  ratingCommentSmall: { fontSize: 12, color: '#78716c', flex: 1, fontStyle: 'italic' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 10, marginTop: 8 },
  sectionHeaderText: { fontSize: 13, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBadge: { backgroundColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  deliveryInfoBox: { backgroundColor: '#f0f7ff', borderRadius: 12, padding: 12, marginBottom: 16, gap: 8 },
  deliveryInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  deliveryInfoText: { fontSize: 13, color: '#334155', flex: 1, lineHeight: 18 },
  partnerBox: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  partnerTitle: { fontSize: 11, fontWeight: '900', color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.6 },
  partnerName: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  partnerPhone: { fontSize: 13, color: '#475569', marginTop: 3 },
  partnerCallBtn: { marginTop: 10, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 },
  partnerCallBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748b' },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 32 },
});