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


// Domain Imports
import { useGetCategoriesQuery, useGetProductsQuery, useGetStoreStatusQuery } from '@/api/apiSlice';
import { addToCart } from '@/store/slices/cartSlice';
import { showToast } from '@/utils/toast';
import { RootState } from '@/store/store';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';
import { useTenantBranding } from '@/contexts/TenantBrandingContext';
import { fetchBanners, type BannerRecord } from '@/api/bannerApi';

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

const BannerSkeleton = React.memo(() => (
  <View style={styles.bannerSkeleton} accessibilityLabel="Loading promotional banners">
    <ActivityIndicator size="small" color={BRAND_BLUE} />
    <Text style={styles.bannerSkeletonText}>Loading offers…</Text>
  </View>
));

/** Mirrors website PromoBanners: GET /api/banners → `data`, image via resolveProductImageUri, title overlay. */
const StaticBannerCarousel = React.memo(({ banners }: { banners: BannerRecord[] }) => {
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

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const { storeName, logoUri, tagline, heroBadge, storeAddressLine } = useTenantBranding();

  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);

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

  // API Hooks
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: allProducts = [] } = useGetProductsQuery();
  const { data: storeStatus } = useGetStoreStatusQuery(undefined, { pollingInterval: 30000 });
  const isStoreClosed = storeStatus?.isClosed ?? false;

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const productForCart = {
      ...product,
      image: resolveProductImageUri(product) ?? undefined
    };
    dispatch(addToCart(productForCart));
    showToast('success', 'Added!', `${product.name} added to basket`);
  }, [dispatch, isStoreClosed]);

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      <View style={styles.headerTopRow}>
        <Image
          source={logoUri ? { uri: logoUri } : require('../../assets/logo-2.png')}
          style={styles.logoImage}
          contentFit="contain"
        />
        <View style={styles.headerBrandBlock}>
          <Text style={styles.brandName} numberOfLines={1}>
            {storeName}
          </Text>
        </View>
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
        onPress={() => router.push('/(tabs)/addresses')}
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
            Add or change your home / work address for delivery
          </Text>
          {storeAddressLine ? (
            <Text style={styles.deliverStoreHint} numberOfLines={1}>
              Store · {storeAddressLine}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </TouchableOpacity>

      {heroBadge ? (
        <View style={styles.heroBadgePill}>
          <Text style={styles.heroBadgeText}>{heroBadge}</Text>
        </View>
      ) : null}

      <View style={styles.taglineWrap}>
        <Text style={styles.taglineText}>{tagline}</Text>
      </View>

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

          <View style={styles.leafBanner}>
            <View style={styles.leafContent}>
              <View>
                <Text style={styles.leafTitle}>Farm Fresh Delivery</Text>
                <Text style={styles.leafSubtitle}>Organic goodness delivered.</Text>
              </View>
              <Ionicons name="leaf" size={24} color={BRAND_BLUE} />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/categories')}>
              <Text style={styles.seeAll}>See All</Text>
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
        {searchQuery ? `Results for "${searchQuery}"` : 'Curated for You'}
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
          return (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
          >
            <View style={styles.imageWrapper}>
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
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productPrice}>₹{item.price}</Text>
              <TouchableOpacity style={[styles.addButton, isStoreClosed && { backgroundColor: '#94a3b8' }]} onPress={() => handleAddToCart(item)}>
                <Text style={styles.addText}>ADD</Text>
              </TouchableOpacity>
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

  leafBanner: { backgroundColor: '#f0f9ff', borderRadius: 16, padding: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: BRAND_BLUE },
  leafContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leafTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  leafSubtitle: { fontSize: 11, color: '#64748b' },

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
  closedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginTop: 8, marginBottom: 4 },
  closedBannerText: { color: '#fff', fontWeight: '700', fontSize: 13, flexShrink: 1 },
});