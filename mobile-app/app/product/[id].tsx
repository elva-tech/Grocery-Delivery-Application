/**
 * @file ProductDetailScreen.tsx
 * @description Product detail view with full-bleed image gallery and cart logic fixes.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, removeFromCart } from '@/store/slices/cartSlice';
import { RootState } from '@/store/store';
import { useGetProductsQuery } from '@/api/apiSlice';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { showToast } from '@/utils/toast';
import { resolveProductImageGallery, resolveProductImageUri } from '@/utils/resolveProductImageUri';
import { buildCartPayload, cartLineId, getDefaultVariant } from '@/utils/productVariants';
import { MOBILE_COPY } from '@/src/constants/copy';

const { width } = Dimensions.get('window');
const BRAND_BLUE = '#4b6f9e';
const CARD_WIDTH = width - 40;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const [activeIndex, setActiveIndex] = useState(0);

  // Data Fetching
  const { data: allProducts } = useGetProductsQuery();
  const product = allProducts?.find(p => p.id === id);

  const defaultVariant = useMemo(
    () => (product ? getDefaultVariant(product) : null),
    [product]
  );
  const [selectedVariantId, setSelectedVariantId] = useState('');
  useEffect(() => {
    if (defaultVariant) setSelectedVariantId(defaultVariant.variantId);
  }, [id, defaultVariant?.variantId]);

  const selectedVariant = useMemo(() => {
    if (!product || !defaultVariant) return null;
    const list = product.variants?.length ? product.variants : [defaultVariant];
    return list.find((v) => v.variantId === selectedVariantId) || defaultVariant;
  }, [product, selectedVariantId, defaultVariant]);

  const lineId = product && selectedVariant
    ? cartLineId(product.id, selectedVariant.variantId)
    : '';

  const cartItem = useSelector((state: RootState) =>
    lineId ? state.cart.items.find((item) => item.id === lineId) : undefined
  );

  // Smooth Scroll Handler for Image Gallery
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(xOffset / CARD_WIDTH);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  }, [activeIndex]);

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
          <Text style={styles.errorText}>Product not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const images = resolveProductImageGallery(product);
  const primaryImage = resolveProductImageUri(product);

  const handleAddToCart = () => {
    if (!product || !selectedVariant || selectedVariant.availableQty <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch(addToCart(buildCartPayload(product, selectedVariant)));
    showToast('success', MOBILE_COPY.home.addToCartToastTitle, `${product.name} ${MOBILE_COPY.home.addToCartToastSuffix}`);
  };

  const variantOptions = product?.variants?.length ? product.variants : defaultVariant ? [defaultVariant] : [];
  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const displayUnit = selectedVariant?.label ?? product?.unit ?? '';
  const displayStock = selectedVariant?.availableQty ?? product?.stock ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerCircleBtn}>
              <Ionicons name="chevron-back" size={24} color="#1e293b" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} style={styles.headerCircleBtn}>
              <Ionicons name="basket-outline" size={22} color="#1e293b" />
              {cartItem && <View style={styles.cartBadge} />}
            </TouchableOpacity>
          )
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* FULL-BLEED IMAGE CARD */}
        <View style={styles.topSection}>
          <View style={styles.imageCard}>
            <ScrollView
              horizontal
              pagingEnabled
              decelerationRate="fast"
              snapToInterval={CARD_WIDTH}
              snapToAlignment="center"
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {images.length > 0 ? (
                images.map((img, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image
                      source={{ uri: img }}
                      style={styles.mainImage}
                      contentFit="contain" // Fills the container entirely
                      transition={300}
                    />
                  </View>
                ))
              ) : (
                <View style={styles.imageWrapper}>
                  <View style={[styles.mainImage, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="image-outline" size={64} color="#cbd5e1" />
                  </View>
                </View>
              )}
            </ScrollView>

            {images.length > 1 && (
              <View style={styles.paginationDots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, activeIndex === i && styles.activeDot]} />
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.rowBetween}>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{MOBILE_COPY.product.featuredItem}</Text>
            </View>
            <TouchableOpacity style={styles.wishlistBtn}>
              <Ionicons name="heart-outline" size={22} color={BRAND_BLUE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.unitDetail}>{displayUnit} • {MOBILE_COPY.product.packedForDelivery}</Text>

          {variantOptions.length > 1 && (
            <View style={styles.variantPickerWrap}>
              <Text style={styles.variantPickerLabel}>Select option</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.variantChips}>
                {variantOptions.map((v) => {
                  const active = v.variantId === selectedVariantId;
                  const disabled = v.availableQty <= 0;
                  return (
                    <TouchableOpacity
                      key={v.variantId}
                      disabled={disabled}
                      onPress={() => setSelectedVariantId(v.variantId)}
                      style={[
                        styles.variantChip,
                        active && styles.variantChipActive,
                        disabled && styles.variantChipDisabled,
                      ]}
                    >
                      <Text style={[styles.variantChipText, active && styles.variantChipTextActive]}>
                        {v.label} · ₹{v.price}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.metaRow}>
            <View style={styles.stockBadge}>
              <View style={[styles.stockDot, displayStock > 10 ? styles.inStock : styles.lowStock]} />
              <Text style={styles.stockText}>
                {displayStock > 10 ? 'In Stock' : displayStock > 0 ? `Hurry, only ${displayStock} left` : 'Out of Stock'}
              </Text>
            </View>
          </View>
          {/* PRODUCT DESCRIPTION */}
          <View style={{ marginTop: 20, backgroundColor: '#f8fafc', padding: 16, borderRadius: 20 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
              About this product
            </Text>
            <Text style={{ fontSize: 15, color: '#475569', lineHeight: 22, fontWeight: '500' }}>
              {product.description || `${product.name} ${MOBILE_COPY.product.descriptionFallbackPrefix}`}
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Product Features</Text>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}><Ionicons name="leaf-outline" size={20} color={BRAND_BLUE} /></View>
              <Text style={styles.featureText}>{MOBILE_COPY.product.featureFreshQuality}</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}><Ionicons name="shield-checkmark-outline" size={20} color={BRAND_BLUE} /></View>
              <Text style={styles.featureText}>{MOBILE_COPY.product.featureQualityAssured}</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}><Ionicons name="snow-outline" size={20} color={BRAND_BLUE} /></View>
              <Text style={styles.featureText}>Temperature Controlled</Text>
            </View>
          </View>

          {/* FIXED: Basket redirect logic only shows for THIS product */}
          {/* UPDATED BASKET BANNER */}
          {cartItem && (
            <TouchableOpacity
              style={styles.basketRedirect}
              onPress={() => router.push('/(tabs)/cart')}
            >
              <View style={styles.redirectInner}>
                <Ionicons name="bag-check" size={20} color={BRAND_BLUE} />
              <Text style={styles.basketRedirectText}>{MOBILE_COPY.product.addedToCartBanner}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={BRAND_BLUE} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* FIXED FOOTER BAR */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerLabel}>Grand Total</Text>
          <Text style={styles.footerPrice}>₹{displayPrice}</Text>
        </View>

        {cartItem ? (
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); dispatch(removeFromCart(lineId)); }}
              style={styles.qtyBtn}
            >
              <Ionicons name="remove" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.countText}>{cartItem.quantity}</Text>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleAddToCart(); }}
              style={styles.qtyBtn}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={handleAddToCart}>
            <Ionicons name="basket-outline" size={20} color="#fff" />
            <Text style={styles.addBtnText}>{MOBILE_COPY.common.addToCart}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfdfe' },
  scrollContent: { paddingTop: 100, paddingBottom: 120 },

  headerCircleBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 12,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4
  },
  cartBadge: {
    position: 'absolute', top: 10, right: 10, width: 10, height: 10,
    borderRadius: 5, backgroundColor: '#e74c3c', borderWidth: 2, borderColor: '#fff'
  },

  topSection: { paddingHorizontal: 20, marginBottom: 20 },
  imageCard: {
    width: CARD_WIDTH, aspectRatio: 1, backgroundColor: '#fff', borderRadius: 30,
    overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, elevation: 5
  },
  imageWrapper: { width: CARD_WIDTH, height: CARD_WIDTH },
  mainImage: { width: '100%', height: '100%', backgroundColor: '#ffffff', },

  paginationDots: {
    position: 'absolute', bottom: 15, alignSelf: 'center', flexDirection: 'row', gap: 6
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1' },
  activeDot: { width: 18, backgroundColor: BRAND_BLUE },

  infoContainer: {
    flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 35, borderTopRightRadius: 35,
    padding: 24, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 20, elevation: 1
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryTag: { backgroundColor: '#eef2f7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  categoryText: { color: BRAND_BLUE, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' },
  wishlistBtn: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 12 },

  name: { fontSize: 28, fontWeight: '800', color: '#2c3e50', marginTop: 12 },
  unitDetail: { fontSize: 14, color: '#94a3b8', marginTop: 4, fontWeight: '600' },

  metaRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  inStock: { backgroundColor: '#2ecc71' },
  lowStock: { backgroundColor: '#e67e22' },
  stockText: { fontSize: 12, color: '#7b8a9a', fontWeight: '500' },

  variantPickerWrap: { marginTop: 16 },
  variantPickerLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 },
  variantChips: { flexGrow: 0 },
  variantChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  variantChipActive: { borderColor: BRAND_BLUE, backgroundColor: '#f0f7ff' },
  variantChipDisabled: { opacity: 0.4 },
  variantChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  variantChipTextActive: { color: BRAND_BLUE },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#2c3e50', marginBottom: 15 },

  featuresList: { gap: 12 },
  featureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 15,
    backgroundColor: '#f8fafc', padding: 12, borderRadius: 15
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 1 },
  featureText: { fontSize: 15, color: '#2c3e50', fontWeight: '600' },

basketRedirect: {
    marginTop: 25, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#f0f7ff', 
    padding: 16, 
    borderRadius: 18, 
    borderWidth: 1, 
    borderColor: '#d0e3ff'
  },
  redirectInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  basketRedirectText: { 
    color: BRAND_BLUE, 
    fontWeight: '700', 
    fontSize: 15,
    letterSpacing: -0.3 // Gives it a more premium, tight look
  },

  footer: {
    position: 'absolute', bottom: 0, width: width,
    paddingHorizontal: 20, paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9',
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingBottom: 35
  },
  footerLeft: { flex: 1 },
  footerLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  footerPrice: { fontSize: 26, fontWeight: '900', color: '#2c3e50' },
  addBtn: {
    backgroundColor: BRAND_BLUE, flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 25, paddingVertical: 16, borderRadius: 18
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND_BLUE, borderRadius: 18, padding: 6 },
  qtyBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  countText: { marginHorizontal: 15, fontWeight: '800', fontSize: 20, color: '#fff' },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#e74c3c', marginTop: 16, marginBottom: 20 },
  backBtn: { backgroundColor: BRAND_BLUE, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: 'bold' }
});