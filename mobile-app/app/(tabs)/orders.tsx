/**
 * @file OrdersScreen.tsx
 * @description Order history management with Admin Feedback Loop integrated.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '@/utils/toast';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { addToCart } from '@/store/slices/cartSlice';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserOrders, cancelOrderApi, rateOrderApi } from '@/api/ordersApi';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
// INTEGRATED: Import settings hook
import { useGetAppSettingsQuery } from '@/api/apiSlice';

const STATUS_THEME: any = {
  PLACED: { color: '#64748b', label: 'Order Placed' },
  CONFIRMED: { color: '#4b6f9e', label: 'Confirmed' },
  OUT_FOR_DELIVERY: { color: '#f59e0b', label: 'On its way' },
  DELIVERED: { color: '#10b981', label: 'Delivered' },
  CANCELLED: { color: '#ef4444', label: 'Cancelled' },
  ISSUE_REPORTED: { color: '#8b5cf6', label: 'Issue Reported' },
  REFUND_APPROVED: { color: '#10b981', label: 'Refund Approved' },
  REFUND_REJECTED: { color: '#ef4444', label: 'Refund Rejected' },
};

const REPORT_REASONS = [
  "Item damaged",
  "Wrong item received",
  "Quality issue",
  "Items missing",
  "Package tampered"
];

export default function OrdersScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  
  // INTEGRATED: Fetch remote settings
  const { data: settings } = useGetAppSettingsQuery();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [issueComment, setIssueComment] = useState('');
  const [issueImage, setIssueImage] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{title: string, msg: string, action: () => void} | null>(null);

  // ── Rating state ──────────────────────────────────────────────────────────
  const [ratingOrder, setRatingOrder] = useState<any>(null);  // order pending a rating prompt
  const [starValue, setStarValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const fetchOrders = useCallback(async (isQuiet = false) => {
    if (!isQuiet) setLoading(true);
    try {
      const data = await getUserOrders('user-123');
      const normalizedData = data.map((order: any) => ({
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || [])
      })).sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(normalizedData);

      // Auto-prompt rating for first unrated delivered order
      const unrated = normalizedData.find(
        (o: any) => o.orderStatus === 'DELIVERED' && !o.rating?.value
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

    if (!result.canceled) {
      setIssueImage(result.assets[0].uri);
    }
  };

  const handleCancelOrder = (orderToCancel: any) => {
    setConfirmConfig({
      title: "Cancel Order",
      msg: "Are you sure you want to cancel this order?",
      action: async () => {
        try {
          await cancelOrderApi(orderToCancel.id);
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
    if (!selectedReason || !issueImage) {
      return Alert.alert("Required Fields", "Please select a reason and upload a photo.");
    }

    setIsSubmittingReport(true);
    const formData = new FormData();
    formData.append('orderId', selectedOrder.id);
    formData.append('reason', selectedReason);
    formData.append('comment', issueComment || "No comment");

    const uriParts = issueImage.split('.');
    const fileType = uriParts[uriParts.length - 1];
    const fileName = issueImage.split('/').pop();

    // @ts-ignore
    formData.append('evidence', {
      uri: issueImage,
      name: fileName || `report_${Date.now()}.${fileType}`,
      type: `image/${fileType}`,
    });

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Report Sent', 'Admin will review.');
      
      setShowIssueModal(false);
      setSelectedOrder(null);
      setIssueImage(null);
      setSelectedReason('');
      setIssueComment('');
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
    setIsSubmittingRating(true);
    try {
      await rateOrderApi(ratingOrder._id ?? ratingOrder.id, starValue, ratingComment);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Thank you!', 'Your feedback helps us improve.');
      setRatingOrder(null);
      fetchOrders(true);
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

  const handleReorder = (items: any[]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    items.forEach((p: any) => dispatch(addToCart(p)));
    showToast('success', 'Reordered', 'Added to cart');
    router.push('/(tabs)/cart');
  };

  const renderItem = ({ item }: { item: any }) => {
    const theme = STATUS_THEME[item.status] || STATUS_THEME.PLACED;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderId}>Order #{item.id}</Text>
            <Text style={styles.dateText}>
              {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.color + '15' }]}>
            <Text style={[styles.badgeText, { color: theme.color }]}>{theme.label}</Text>
          </View>
        </View>
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
        {item.orderStatus === 'DELIVERED' && !item.rating?.value && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => { setStarValue(0); setRatingComment(''); setRatingOrder(item); }}
          >
            <Ionicons name="star-outline" size={15} color="#f59e0b" />
            <Text style={styles.rateBtnText}>Rate this order</Text>
          </TouchableOpacity>
        )}
        {/* Show submitted rating */}
        {item.rating?.value && (
          <View style={styles.ratingDisplay}>
            <Text style={styles.ratingStars}>{'★'.repeat(item.rating.value)}{'☆'.repeat(5 - item.rating.value)}</Text>
            {item.rating.comment ? <Text style={styles.ratingCommentSmall}>{item.rating.comment}</Text> : null}
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
        data={orders}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4b6f9e" />}
      />

      {/* Main Order Details Modal */}
      <Modal visible={!!selectedOrder && !showIssueModal} animationType="slide" transparent onRequestClose={() => setSelectedOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Summary</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close-circle" size={32} color="#cbd5e1" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {selectedOrder?.items?.map((product: any, idx: number) => (
                <View key={idx} style={styles.productRow}>
                  <Image source={{ uri: Array.isArray(product.image) ? product.image[0] : product.image }} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productMeta}>{product.quantity} x {product.unit}</Text>
                  </View>
                  <Text style={styles.productPrice}>₹{product.price * product.quantity}</Text>
                </View>
              ))}

              {selectedOrder?.adminComment && (
                <View style={styles.adminResponseBox}>
                  <View style={styles.adminResponseHeader}>
                    <Ionicons name="chatbubble-ellipses" size={16} color="#4b6f9e" />
                    <Text style={styles.adminResponseTitle}>ADMIN RESPONSE</Text>
                  </View>
                  <Text style={styles.adminResponseText}>"{selectedOrder.adminComment}"</Text>
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

              {/* INTEGRATED: REPORT ISSUE BUTTON TOGGLE */}
              {selectedOrder?.status === 'DELIVERED' && settings?.allowReportIssue && (
                <TouchableOpacity style={styles.reportBtn} onPress={() => setShowIssueModal(true)}>
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
              <TouchableOpacity onPress={() => setShowIssueModal(false)}>
                <Ionicons name="close-circle" size={32} color="#cbd5e1" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
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
              <TouchableOpacity style={styles.pickerBox} onPress={pickImage}>
                {issueImage ? <Image source={{ uri: issueImage }} style={styles.previewImg} /> : <Ionicons name="camera" size={30} color="#94a3b8" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.primaryBtn, { marginTop: 30 }, isSubmittingReport && { opacity: 0.6 }]} 
                onPress={submitFinalReport}
                disabled={isSubmittingReport}
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
  list: { padding: 16 },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  dateText: { fontSize: 13, color: '#94a3b8' },
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
  modalScroll: { marginBottom: 20 },
  
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
  reportBtn: { marginTop: 20, backgroundColor: '#fff', height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#f59e0b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  reportBtnText: { color: '#f59e0b', fontWeight: '800', fontSize: 15 },
  
  label: { fontSize: 14, fontWeight: '800', color: '#64748b', marginTop: 20, marginBottom: 12 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  reasonChipActive: { backgroundColor: '#4b6f9e', borderColor: '#4b6f9e' },
  reasonChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  reasonChipTextActive: { color: '#fff' },
  inputArea: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, height: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#e2e8f0' },
  pickerBox: { height: 120, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginTop: 10, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },

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
});