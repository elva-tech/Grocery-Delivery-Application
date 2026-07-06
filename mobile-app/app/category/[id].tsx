import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { useGetProductsByCategoryQuery } from '@/api/apiSlice';
import { addToCart } from '@/store/slices/cartSlice';
import { buildCartPayload, getPurchasableVariant, isProductPurchasable } from '@/utils/productVariants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { showToast } from '@/utils/toast';
import { RootState } from '@/store/store';

export default function CategoryScreen() {
  const { id, name } = useLocalSearchParams();
  const dispatch = useDispatch();
  const router = useRouter();
  const { data: products, isLoading } = useGetProductsByCategoryQuery(id as string);
  const cartCount = useSelector((state: RootState) => state.cart.items.length);

  // 🔹 UI-only interaction state
  const [showTip, setShowTip] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p: any) => p.name?.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAddToCart = (product: any) => {
    const variant = getPurchasableVariant(product);
    if (!variant) {
      showToast('error', 'Out of stock', `${product.name} is currently unavailable.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const payload = buildCartPayload(product, variant);
    if (Array.isArray(product.image) && product.image[0]) payload.image = product.image[0];
    dispatch(addToCart(payload));

    showToast('success', 'Added!', `${product.name} added to basket`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: (name as string) || 'Products',
          headerTintColor: '#2c3e50',
          headerStyle: { backgroundColor: '#ffffff' }
        }}
      />

      {/* ================= INTERACTIVE CATEGORY HEADER ================= */}
      <View style={styles.categoryHeader}>
        <View>
          <Text style={styles.categoryTitle}>{name}</Text>
          <Text style={styles.categoryMeta}>
            {filteredProducts.length} items available
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            showToast('info', 'Updated', 'Stock refreshed');
          }}
        >
          <Ionicons name="refresh" size={18} color="#4b6f9e" />
        </TouchableOpacity>
      </View>

      {/* ================= DISMISSIBLE USER TIP ================= */}
      {showTip && (
        <TouchableOpacity
          style={styles.tipCard}
          activeOpacity={0.9}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowTip(false);
          }}
        >
          <Ionicons name="information-circle" size={20} color="#4b6f9e" />
          <Text style={styles.tipText}>
            Tap any product to view details • Tap + to add instantly
          </Text>
          <Ionicons name="close" size={18} color="#7b8a9a" />
        </TouchableOpacity>
      )}

      {/* ================= SEARCH BAR ================= */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products…"
            placeholderTextColor="#b0bec5"
            value={searchQuery}
            onChangeText={t => { setSearchQuery(t); setCurrentPage(1); }}
            returnKeyType="search"
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setCurrentPage(1); }}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        {searchQuery.trim() !== '' && (
          <Text style={styles.resultCount}>{filteredProducts.length} results</Text>
        )}
      </View>

      {/* ================= PRODUCTS ================= */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4b6f9e" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : products && products.length > 0 ? (
        <FlatList
          data={paginatedProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                >
                  <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? '#c0cdd8' : '#4b6f9e'} />
                </TouchableOpacity>
                <Text style={styles.pageLabel}>{currentPage} / {totalPages}</Text>
                <TouchableOpacity
                  onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                >
                  <Ionicons name="chevron-forward" size={16} color={currentPage === totalPages ? '#c0cdd8' : '#4b6f9e'} />
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const inStock = isProductPurchasable(item);
            const purchasableQty = getPurchasableVariant(item)?.availableQty ?? 0;
            return (
            <TouchableOpacity
              style={[styles.productCard, !inStock && styles.productCardOutOfStock]}
              onPress={() =>
                router.push({ pathname: "/product/[id]", params: { id: item.id } })
              }
              activeOpacity={0.9}
            >
              {!inStock && (
                <View style={styles.oosBadge}>
                  <Text style={styles.oosBadgeText}>OUT OF STOCK</Text>
                </View>
              )}
              <Image source={{ uri: item.image[0] }} style={[styles.productImage, !inStock && styles.productImageMuted]} contentFit="contain" />
              <View style={styles.info}>
                <Text style={[styles.productName, !inStock && styles.productNameMuted]} numberOfLines={2}>{item.name}</Text>
                <Text style={[styles.productUnit, !inStock && styles.productUnitMuted]}>{item.unit}</Text>

                <View style={styles.footer}>
                  <View>
                    <Text style={[styles.productPrice, !inStock && styles.productPriceMuted]}>₹{item.price}</Text>
                    {inStock && purchasableQty < 10 && purchasableQty > 0 && (
                      <Text style={styles.stockWarning}>Only {purchasableQty} left</Text>
                    )}
                  </View>

                  {inStock ? (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAddToCart(item);
                      }}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.soldOutPill}>
                      <Text style={styles.soldOutPillText}>SOLD OUT</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            );
          }}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={80} color="#dbe4ef" />
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptyText}>Check back soon for new items</Text>
        </View>
      )}

      {/* ================= FLOATING CART ================= */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={styles.floatingCart}
          onPress={() => router.push('/(tabs)/cart')}
        >
          <Ionicons name="basket" size={28} color="#fff" />
          <View style={styles.floatingBadge}>
            <Text style={styles.floatingBadgeText}>{cartCount}</Text>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },

  /* ---------- CATEGORY HEADER ---------- */
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
  },
  categoryMeta: {
    fontSize: 12,
    color: '#7b8a9a',
  },
  refreshBtn: {
    backgroundColor: '#eef3f8',
    padding: 8,
    borderRadius: 10,
  },

  /* ---------- TIP ---------- */
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe4ef',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: '#4b6f9e',
    fontWeight: '500',
  },

  /* ---------- LIST ---------- */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 14, color: '#7b8a9a' },

  listContent: { padding: 16, paddingBottom: 32 },
  row: { justifyContent: 'space-between' },

  productCard: {
    flex: 0.48,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe4ef',
  },
  productImage: { width: '100%', height: 140, backgroundColor: '#f1f5f9' },
  info: { padding: 12 },

  productName: { fontSize: 14, fontWeight: '600', color: '#2c3e50', height: 36 },
  productUnit: { fontSize: 12, color: '#7b8a9a', marginBottom: 8 },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  productPrice: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
  stockWarning: { fontSize: 10, color: '#c47a2c', fontWeight: '600' },

  addButton: {
    backgroundColor: '#4b6f9e',
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productCardOutOfStock: { opacity: 0.65, backgroundColor: '#f8fafc' },
  productImageMuted: { opacity: 0.55 },
  productNameMuted: { color: '#94a3b8' },
  productUnitMuted: { color: '#cbd5e1' },
  productPriceMuted: { color: '#cbd5e1' },
  oosBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  oosBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  soldOutPill: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  soldOutPillText: { color: '#64748b', fontSize: 9, fontWeight: '800' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#2c3e50', marginTop: 20 },
  emptyText: { fontSize: 14, color: '#7b8a9a' },

  floatingCart: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#4b6f9e',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#e11d48',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  floatingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe4ef',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#2c3e50',
    padding: 0,
  },
  resultCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b6f9e',
    backgroundColor: '#e9f0f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 20,
  },
  pageBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e9f0f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#f1f5f9' },
  pageLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
    minWidth: 55,
    textAlign: 'center',
  },
});
