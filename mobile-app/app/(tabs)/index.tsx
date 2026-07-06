/**
 * @file HomeScreen.tsx
 * @architecture Clean Architecture / Feature-Based
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Keyboard,
  Platform,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';


// Domain Imports
import { useGetCategoriesQuery, useGetProductsQuery, useGetStoreStatusQuery } from '@/api/apiSlice';
import { addToCart } from '@/store/slices/cartSlice';
import { buildCartPayload, getPurchasableVariant, isProductPurchasable } from '@/utils/productVariants';
import { showToast } from '@/utils/toast';
import { RootState } from '@/store/store';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';
import { useTenantBranding } from '@/contexts/TenantBrandingContext';
import { StoreLogo } from '@/src/components/StoreLogo';
import { fetchBanners, type BannerRecord } from '@/api/bannerApi';
import {
  getAddresses,
  pickPreferredSavedAddress,
  getAddressFromCoordsDetailed,
  PREFERRED_DELIVERY_ADDRESS_CHANGED,
} from '@/api/addresses';
import { checkDeliveryEligibility } from '@/api/deliveryEligibilityApi';
import { parseAddressLatLng } from '@/utils/coordinates';
import { formatDeliverToDisplay } from '@/utils/indiaPincode';
import { MOBILE_COPY, customerFacingDeliveryUnavailable, customerFacingMapServiceError } from '@/src/constants/copy';
import * as Location from 'expo-location';

// Constants for UI consistency
const { width } = Dimensions.get('window');
const BRAND_BLUE = '#4b6f9e';
const COLUMN_COUNT = 3;
/** Same visual rhythm as website hero (PromoBanners ~240px desktop; compact on phone). */
const BANNER_SLIDE_WIDTH = width - 32;
const BANNER_HEIGHT = 220;
const BANNER_AUTOPLAY_MS = 4000;

/* ========================================================================
   UTILITY HELPER FUNCTIONS
   ======================================================================== */

const getFitMode = (img: string | null) => {
  if (!img) return "contain";
  return "cover";
};

/* ========================================================================
   SUB-COMPONENTS (Memoized for 60FPS)
   ======================================================================== */

const BannerSkeleton = React.memo(function BannerSkeleton() {
  return (
    <View style={styles.bannerSkeleton} accessibilityLabel="Loading promotional banners">
      <ActivityIndicator size="small" color={BRAND_BLUE} />
      <Text style={styles.bannerSkeletonText}>Loading offers…</Text>
    </View>
  );
});

/** Mirrors website PromoBanners: GET /api/banners → `data`, image via resolveProductImageUri, title overlay. */
const StaticBannerCarousel = React.memo(function StaticBannerCarousel({ banners }: { banners: BannerRecord[] }) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;

    const timer = setInterval(() => {
      setIndex(prev => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * BANNER_SLIDE_WIDTH, animated: true });
        return next;
      });
    }, BANNER_AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [banners]);

  return (
    <View style={styles.promoContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={BANNER_SLIDE_WIDTH}
        snapToAlignment="start"
        contentContainerStyle={styles.promoScrollContent}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / BANNER_SLIDE_WIDTH);
          setIndex(Math.min(Math.max(0, newIndex), banners.length - 1));
        }}
      >
        {banners.map((banner) => {
          const imageSrc = resolveProductImageUri(banner);
          const key = String(banner._id ?? banner.id ?? banner.title);
          return (
            <TouchableOpacity key={key} activeOpacity={0.92} style={styles.promoCard}>
              <View style={styles.promoSlideInner}>
                {imageSrc ? (
                  <Image
                    source={{ uri: imageSrc }}
                    style={styles.promoImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[styles.promoImage, styles.bannerPlaceholder]}>
                    <Text style={styles.bannerPlaceholderText}>No Image</Text>
                  </View>
                )}
                {banner.title ? (
                  <View style={styles.promoTitleOverlay} pointerEvents="none">
                    <Text style={styles.promoTitleText} numberOfLines={2}>
                      {banner.title}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {banners.length > 1 ? (
        <View style={styles.dotContainer}>
          {banners.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.activeDot]} />
          ))}
        </View>
      ) : null}
    </View>
  );
});

/* ========================================================================
   MAIN COMPONENT
   ======================================================================== */

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth?.user);
  const token = useSelector((state: RootState) => state.auth.token);

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const { tagline, heroBadge } = useTenantBranding();

  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [deliverToText, setDeliverToText] = useState<string>(MOBILE_COPY.home.deliverToFallback);
  const [deliveryEligibility, setDeliveryEligibility] = useState<{
    checking: boolean;
    eligible: boolean | null;
    message: string;
  }>({
    checking: false,
    eligible: null,
    message: '',
  });

  const refreshDeliverToRow = useCallback(async () => {
    try {
      if (!token) {
        setDeliverToText(MOBILE_COPY.home.deliverToFallback);
        return;
      }
      const list = await getAddresses();
      const addr = await pickPreferredSavedAddress(list);
      setDeliverToText(formatDeliverToDisplay(addr, MOBILE_COPY.home.deliverToFallback));
    } catch {
      setDeliverToText(MOBILE_COPY.home.deliverToFallback);
    }
  }, [token]);

  const refreshDeliveryEligibility = useCallback(async () => {
    setDeliveryEligibility(prev => ({ ...prev, checking: true, message: '' }));
    try {
      const list = token ? await getAddresses() : [];
      const addr = list.length > 0 ? await pickPreferredSavedAddress(list) : null;
      const coordsFromAddr = addr ? parseAddressLatLng(addr as { lat?: unknown; lng?: unknown }) : null;

      let lat: number | null = coordsFromAddr?.lat ?? null;
      let lng: number | null = coordsFromAddr?.lng ?? null;

      if (lat == null || lng == null) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setDeliveryEligibility({
            checking: false,
            eligible: null,
            message: MOBILE_COPY.home.deliveryLocationPermissionDenied,
          });
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;

        if (!addr) {
          try {
            const rev = await getAddressFromCoordsDetailed(lat, lng);
            const line = rev.line1?.trim();
            setDeliverToText(
              line ? `${MOBILE_COPY.home.nearPrefix}${line}` : MOBILE_COPY.home.currentLocationDeliverTo,
            );
          } catch {
            setDeliverToText(MOBILE_COPY.home.currentLocationDeliverTo);
          }
        }
      }

      const result = await checkDeliveryEligibility(lat, lng);
      const eligible =
        typeof result.isEligible === 'boolean'
          ? result.isEligible
          : typeof result.eligible === 'boolean'
            ? result.eligible
            : false;

      setDeliveryEligibility({
        checking: false,
        eligible,
        message: typeof result.message === 'string' ? result.message : '',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : MOBILE_COPY.home.deliveryCheckFailed;
      setDeliveryEligibility({
        checking: false,
        eligible: null,
        message: msg,
      });
    }
  }, [token]);

  const loadBanners = useCallback(async () => {
    setBannerLoading(true);
    setBannerError(null);
    try {
      const list = await fetchBanners();
      setBanners(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load banners';
      setBannerError(msg);
      setBanners([]);
    } finally {
      setBannerLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBanners();
    const sub = DeviceEventEmitter.addListener('tenant-changed', () => {
      loadBanners();
    });
    return () => sub.remove();
  }, [loadBanners]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PREFERRED_DELIVERY_ADDRESS_CHANGED, () => {
      void (async () => {
        await refreshDeliverToRow();
        await refreshDeliveryEligibility();
      })();
    });
    return () => sub.remove();
  }, [refreshDeliverToRow, refreshDeliveryEligibility]);

  // API Hooks
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: allProducts = [], refetch: refetchProducts } = useGetProductsQuery();
  const { data: storeStatus } = useGetStoreStatusQuery(undefined, { pollingInterval: 15000 });
  const isStoreClosed = storeStatus?.isClosed ?? false;

  useFocusEffect(
    useCallback(() => {
      void refetchProducts();
      void (async () => {
        await refreshDeliverToRow();
        await refreshDeliveryEligibility();
      })();
    }, [refetchProducts, refreshDeliverToRow, refreshDeliveryEligibility]),
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allProducts;
    return allProducts.filter(item => item.name?.toLowerCase().includes(query));
  }, [searchQuery, allProducts]);

  const handleAddToCart = useCallback((product: any) => {
    if (isStoreClosed) {
      showToast('error', 'Store Closed', 'We are not accepting orders right now.');
      return;
    }
    const variant = getPurchasableVariant(product);
    if (!variant) {
      showToast('error', 'Out of stock', `${product.name} is currently unavailable.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const payload = buildCartPayload(product, variant);
    if (resolveProductImageUri(product)) payload.image = resolveProductImageUri(product)!;
    dispatch(addToCart(payload));
    showToast('success', MOBILE_COPY.home.addToCartToastTitle, `${product.name} ${MOBILE_COPY.home.addToCartToastSuffix}`);
  }, [dispatch, isStoreClosed]);

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      <View style={styles.headerTopRow}>
        <StoreLogo layout="header" size={48} showTagline style={styles.headerBrandBlock} />
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityLabel="Open profile"
        >
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.userImage} cachePolicy="memory-disk" />
          ) : (
            <Ionicons name="person-circle" size={40} color="#2c3e50" />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.deliverCard}
        onPress={() => {
          if (!token) {
            showToast('info', MOBILE_COPY.auth.loginToContinueTitle, MOBILE_COPY.auth.loginToContinueMessage);
            router.push('/auth/landing');
            return;
          }
          router.push('/(tabs)/addresses');
        }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Delivery address"
      >
        <View style={styles.deliverIconWrap}>
          <Ionicons name="location-sharp" size={22} color={BRAND_BLUE} />
        </View>
        <View style={styles.deliverTextCol}>
          <Text style={styles.deliverEyebrow}>DELIVER TO</Text>
          <Text style={styles.deliverMain} numberOfLines={2}>
            {deliverToText}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </TouchableOpacity>

      {deliveryEligibility.checking ? (
        <View style={[styles.deliveryBanner, styles.deliveryBannerChecking]}>
          <ActivityIndicator size="small" color={BRAND_BLUE} />
          <Text style={styles.deliveryBannerText}>{MOBILE_COPY.home.deliveryCheckingLabel}</Text>
        </View>
      ) : deliveryEligibility.eligible === false ? (
        <View style={[styles.deliveryBanner, styles.deliveryBannerBad]}>
          <Ionicons name="alert-circle" size={18} color="#dc2626" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.deliveryBannerTitle}>{MOBILE_COPY.home.deliveryUnavailableTitle}</Text>
            <Text style={styles.deliveryBannerSub}>
              {customerFacingDeliveryUnavailable(deliveryEligibility.message)}
            </Text>
          </View>
        </View>
      ) : deliveryEligibility.eligible === true ? null : deliveryEligibility.message ? (
        <View style={[styles.deliveryBanner, styles.deliveryBannerWarn]}>
          <Ionicons name="information-circle-outline" size={18} color="#b45309" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.deliveryBannerTitleWarn}>{MOBILE_COPY.home.deliveryCheckUnavailableTitle}</Text>
            <Text style={styles.deliveryBannerSubWarn}>
              {customerFacingMapServiceError(deliveryEligibility.message)}
            </Text>
          </View>
        </View>
      ) : null}

      {heroBadge ? (
        <View style={styles.heroBadgePill}>
          <Text style={styles.heroBadgeText}>{heroBadge}</Text>
        </View>
      ) : null}

      {tagline ? (
        <View style={styles.taglineWrap}>
          <Text style={styles.taglineText}>{tagline}</Text>
        </View>
      ) : null}

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#94a3b8" />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
          blurOnSubmit={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {!searchQuery && (
        <>
          {bannerLoading ? (
            <BannerSkeleton />
          ) : banners.length > 0 ? (
            <StaticBannerCarousel banners={banners} />
          ) : null}
          {bannerError && !bannerLoading ? (
            <TouchableOpacity style={styles.bannerRetry} onPress={loadBanners} activeOpacity={0.75}>
              <Ionicons name="image-outline" size={18} color="#64748b" />
              <Text style={styles.bannerRetryText}>{bannerError}</Text>
              <Text style={styles.bannerRetryAction}>Tap to retry</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/categories')}>
              <Text style={styles.seeAll}>{MOBILE_COPY.common.viewAll}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catList}>
            {(categories || []).filter((c: any) => c.parentId === null).map((item: any) => {
              const img = resolveProductImageUri(item);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.catCard}
                  onPress={() => router.push({ pathname: "/category/[id]", params: { id: item.id, name: item.name } })}
                >
                  <View style={styles.catImgBox}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.catImg} contentFit="contain" />
                    ) : (
                      <Ionicons name="image-outline" size={22} color="#94a3b8" />
                    )}
                  </View>
                  <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={styles.productsTitle}>
        {searchQuery ? `Results for "${searchQuery}"` : MOBILE_COPY.home.recommendedForYou}
      </Text>

      {isStoreClosed && (
        <View style={styles.closedBanner}>
          <Ionicons name="lock-closed" size={16} color="#fff" />
          <Text style={styles.closedBannerText}>
            Store is currently CLOSED · Orders are paused
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader()}
        numColumns={COLUMN_COUNT}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item }) => {
          const thumb = resolveProductImageUri(item);
          const inStock = isProductPurchasable(item);
          return (
          <TouchableOpacity
            style={[styles.productCard, !inStock && styles.productCardOutOfStock]}
            onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
          >
            {!inStock && (
              <View style={styles.oosBadge}>
                <Text style={styles.oosBadgeText}>OUT OF STOCK</Text>
              </View>
            )}
            <View style={[styles.imageWrapper, !inStock && styles.imageWrapperMuted]}>
              {thumb ? (
                <Image
                  source={{ uri: thumb }}
                  style={styles.productImage}
                  contentFit={getFitMode(thumb)}
                />
              ) : (
                <View style={[styles.productImage, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="image-outline" size={28} color="#94a3b8" />
                </View>
              )}
            </View>
            <View style={styles.productInfo}>
              <Text style={[styles.productName, !inStock && styles.productNameMuted]} numberOfLines={2}>{item.name}</Text>
              <Text style={[styles.productPrice, !inStock && styles.productPriceMuted]}>₹{item.price}</Text>
              {inStock ? (
                <TouchableOpacity
                  style={[styles.addButton, isStoreClosed && { backgroundColor: '#94a3b8' }]}
                  onPress={() => handleAddToCart(item)}
                  disabled={isStoreClosed}
                >
                  <Text style={styles.addText}>ADD</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.soldOutButton}>
                  <Text style={styles.soldOutText}>SOLD OUT</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  headerWrapper: { paddingHorizontal: 16 },
  listContent: { paddingBottom: 40 },
  row: { justifyContent: 'flex-start', paddingHorizontal: 8 },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    gap: 10,
  },
  headerBrandBlock: { flex: 1, minWidth: 0, justifyContent: 'center' },
  logoImage: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#f8fafc' },
  brandName: { fontSize: 19, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  deliverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  deliverIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deliverTextCol: { flex: 1, minWidth: 0 },
  deliverEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  deliverMain: { fontSize: 14, fontWeight: '600', color: '#1e293b', lineHeight: 19 },
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  deliveryBannerChecking: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  deliveryBannerBad: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  deliveryBannerOk: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  deliveryBannerWarn: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  deliveryBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#64748b' },
  deliveryBannerTextOk: { flex: 1, fontSize: 12, fontWeight: '700', color: '#166534' },
  deliveryBannerTitle: { fontSize: 11, fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 },
  deliveryBannerSub: { fontSize: 13, fontWeight: '600', color: '#991b1b', marginTop: 4, lineHeight: 18 },
  deliveryBannerTitleWarn: { fontSize: 11, fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.5 },
  deliveryBannerSubWarn: { fontSize: 12, fontWeight: '600', color: '#92400e', marginTop: 4, lineHeight: 17 },
  deliverStoreHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 4,
  },
  heroBadgePill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: BRAND_BLUE, letterSpacing: 0.3 },
  taglineWrap: {
    marginTop: 10,
    paddingHorizontal: 2,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  taglineText: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 18,
    fontWeight: '500',
  },
  profileButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  userImage: { width: '100%', height: '100%' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 15, color: '#334155', marginLeft: 10, height: '100%' },

  bannerSkeleton: {
    height: BANNER_HEIGHT,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bannerSkeletonText: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
  },
  bannerRetry: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  bannerRetryText: { flex: 1, fontSize: 13, color: '#991b1b', fontWeight: '600', minWidth: '60%' },
  bannerRetryAction: { fontSize: 12, fontWeight: '800', color: BRAND_BLUE },

  promoContainer: { marginBottom: 12 },
  promoScrollContent: { paddingRight: 0 },
  promoCard: {
    width: BANNER_SLIDE_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 0,
    backgroundColor: '#0f172a',
    shadowColor: '#1e3a5f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  promoSlideInner: { width: '100%', height: '100%', position: 'relative' },
  promoImage: { width: '100%', height: '100%' },
  bannerPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e2e8f0' },
  bannerPlaceholderText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  promoTitleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  promoTitleText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dotContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', marginHorizontal: 3 },
  activeDot: { backgroundColor: BRAND_BLUE, width: 18 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  seeAll: { color: BRAND_BLUE, fontSize: 14, fontWeight: '700' },
  catList: { marginBottom: 20 },
  catCard: { alignItems: 'center', marginRight: 12, width: 70 },
  catImgBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  catImg: { width: '100%', height: '100%' },
  catName: { fontSize: 11, fontWeight: '600', color: '#475569' },

  productsTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, color: BRAND_BLUE, marginTop: 10 },
  productCard: {
    width: (width - 48) / 3,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    marginRight: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  imageWrapper: { width: '100%', height: 90, marginBottom: 6, padding: 4, },
  productImage: { width: '100%', height: '100%' },
  productInfo: { flex: 1, alignItems: 'center' },
  productName: { fontSize: 11, fontWeight: '600', color: '#334155', height: 32, textAlign: 'center' },
  productPrice: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginVertical: 4 },
  addButton: { width: '100%', paddingVertical: 5, borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: BRAND_BLUE },
  addText: { color: BRAND_BLUE, fontWeight: '800', fontSize: 11, textAlign: 'center' },
  productCardOutOfStock: { opacity: 0.65, backgroundColor: '#f8fafc' },
  oosBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  oosBadgeText: { color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  imageWrapperMuted: { opacity: 0.55 },
  productNameMuted: { color: '#94a3b8' },
  productPriceMuted: { color: '#cbd5e1' },
  soldOutButton: {
    width: '100%',
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  soldOutText: { color: '#64748b', fontWeight: '800', fontSize: 9, textAlign: 'center' },
  closedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginTop: 8, marginBottom: 4 },
  closedBannerText: { color: '#fff', fontWeight: '700', fontSize: 13, flexShrink: 1 },
});