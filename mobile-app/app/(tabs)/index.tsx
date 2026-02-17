/**
 * @file HomeScreen.tsx
 * @architecture Clean Architecture / Feature-Based
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, TextInput, Dimensions, Keyboard, Platform
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';


// Domain Imports
import { useGetCategoriesQuery, useGetProductsQuery } from '@/api/apiSlice';
import { addToCart } from '@/store/slices/cartSlice';
import { showToast } from '@/utils/toast';
import { RootState } from '@/store/store';
import { PROMO_BANNERS, APP_CONFIG } from '@/api/mockData'; // Added APP_CONFIG

// Constants for UI consistency
const { width } = Dimensions.get('window');
const BRAND_BLUE = '#4b6f9e';
const COLUMN_COUNT = 3;

/* ========================================================================
   UTILITY HELPER FUNCTIONS
   ======================================================================== */

const resolveImage = (img: any) => {
  if (!img) return null;
  if (Array.isArray(img)) return img[0] || null;
  if (typeof img === 'string') return img;
  if (typeof img === 'object' && img.url) return img.url;
  return null;
};

const getFitMode = (img: string | null) => {
  if (!img) return "contain";
  return "cover";
};

/* ========================================================================
   SUB-COMPONENTS (Memoized for 60FPS)
   ======================================================================== */

const StaticBannerCarousel = React.memo(({ banners }: { banners: any[] }) => {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;

    const timer = setInterval(() => {
      setIndex(prev => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * (width - 32), animated: true });
        return next;
      });
    }, 5000);

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
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
          setIndex(newIndex);
        }}
      >
        {banners.map((banner) => (
          <TouchableOpacity key={banner.id} activeOpacity={0.9} style={styles.promoCard}>
            <Image
              source={{ uri: banner.image }}
              style={styles.promoImage}
              contentFit="cover"
              transition={200}
            />
            {banner.title && (
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerPromoText}>{banner.title}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.dotContainer}>
        {banners.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.activeDot]} />
        ))}
      </View>
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

  /**
   * GENERIC BRANDING LOGIC
   * Fetches configuration from mockData (intended for Backend transition).
   */
  const [branding, setBranding] = useState({
    name: APP_CONFIG.brandName || "Enandi",
    logo: APP_CONFIG.logoUrl || null
  });

  // API Hooks
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: allProducts = [] } = useGetProductsQuery();

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allProducts;
    return allProducts.filter(item => item.name?.toLowerCase().includes(query));
  }, [searchQuery, allProducts]);

  const handleAddToCart = useCallback((product: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const productForCart = {
      ...product,
      image: Array.isArray(product.image) ? product.image[0] : product.image
    };
    dispatch(addToCart(productForCart));
    showToast('success', 'Added!', `${product.name} added to basket`);
  }, [dispatch]);

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      <View style={styles.topBar}>
        <View style={styles.logoContainer}>
          {/* FIX: Replaced hardcoded logo with dynamic source for white-labeling */}
          <Image
            source={branding.logo ? { uri: branding.logo } : require('../../assets/logo-2.png')}
            style={styles.logoImage}
            contentFit="cover"
          />
          <View>
            {/* FIX: Brand name is now dynamic from APP_CONFIG */}
            <Text style={styles.brandName}>{branding.name}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={12} color={BRAND_BLUE} />
              <Text style={styles.brandTagline}>Delivery in minutes</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(tabs)/profile')}
        >
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.userImage} cachePolicy="memory-disk" />
          ) : (
            <Ionicons name="person-circle" size={44} color="#2c3e50" />
          )}
        </TouchableOpacity>
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
          <StaticBannerCarousel banners={PROMO_BANNERS || []} />

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
              const img = resolveImage(item.image);
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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
          >
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: item.image?.[0] }}
                style={styles.productImage}
                contentFit={getFitMode(item.image?.[0])}
              />
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productPrice}>₹{item.price}</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => handleAddToCart(item)}>
                <Text style={styles.addText}>ADD</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  headerWrapper: { paddingHorizontal: 16 },
  listContent: { paddingBottom: 40 },
  row: { justifyContent: 'flex-start', paddingHorizontal: 8 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoImage: { width: 44, height: 44, marginRight: 12, borderRadius: 12 },
  brandName: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  brandTagline: { fontSize: 12, color: '#64748b', fontWeight: '600', marginLeft: 2 },
  profileButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  userImage: { width: '100%', height: '100%' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 15, color: '#334155', marginLeft: 10, height: '100%' },

  promoContainer: { marginBottom: 12 },
  promoCard: { width: width - 32, height: 160, borderRadius: 20, overflow: 'hidden', marginRight: 16 },
  promoImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 12 },
  bannerPromoText: { color: '#fff', fontWeight: '800', fontSize: 16 },
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
});