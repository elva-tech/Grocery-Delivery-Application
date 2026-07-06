import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useGetCategoriesQuery, useGetProductsByCategoryQuery } from '@/api/apiSlice';
import { addToCart } from '@/store/slices/cartSlice';
import { buildCartPayload, getPurchasableVariant, isProductPurchasable } from '@/utils/productVariants';
import { showToast } from '@/utils/toast';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';

export default function CategoriesScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const { data: categories = [], isLoading: catLoading } = useGetCategoriesQuery();
  const didAutoSelectParent = useRef(false);


  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [activeSubCatId, setActiveSubCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;

  const parentCategories = useMemo(
    () => categories.filter(c => c.parentId === null),
    [categories]
  );

  const subCategories = useMemo(
    () => categories.filter(c => c.parentId === activeParentId),
    [categories, activeParentId]
  );

  // useEffect(() => {
  //   if (!activeParentId && parentCategories.length > 0) {
  //     setActiveParentId(parentCategories[0].id);
  //   }
  // }, [parentCategories, activeParentId]);
  
useEffect(() => {
  if (
    !didAutoSelectParent.current &&
    parentCategories.length > 0
  ) {
    setActiveParentId(parentCategories[0].id);
    didAutoSelectParent.current = true;
  }
}, [parentCategories]);

  useEffect(() => {
    if (activeParentId && subCategories.length > 0) {
      setActiveSubCatId(subCategories[0].id);
    }
  }, [activeParentId, subCategories]);

  const activeParent = parentCategories.find(c => c.id === activeParentId);

  const { data: products = [], isLoading: prodLoading } =
    useGetProductsByCategoryQuery(activeParent?.name || '', { skip: !activeParent });

  const filteredProducts = useMemo(() => {
    // const base = products.filter(p => p.subCategoryId === activeSubCatId);

    // If a sub-category is selected, filter products by that sub-category
    const activeSub = subCategories.find(c => c.id === activeSubCatId);

const base = activeSub
  ? products.filter(p =>
      p.subcategory?.toLowerCase() === activeSub.name.toLowerCase()
    )
  : products;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(p => p.name?.toLowerCase().includes(q));
  }, [products, activeSubCatId, searchQuery]);

  // Reset page when filter / search changes
  useEffect(() => { setCurrentPage(1); }, [activeParentId, activeSubCatId, searchQuery]);

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
    if (resolveProductImageUri(product)) payload.image = resolveProductImageUri(product)!;
    dispatch(addToCart(payload));
    showToast('success', 'Added', `${product.name} added to basket`);
  };

  if (catLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4b6f9e" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.headerTitle}>Categories</Text>

      <View style={styles.content}>

        {/* ================= SIDEBAR ================= */}
        <View style={styles.sidebar}>
          <FlatList
            data={parentCategories}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isActiveParent = activeParentId === item.id;
              const parentSubs = categories.filter(c => c.parentId === item.id);
              const parentThumb = resolveProductImageUri(item);

              return (
                <View>
                  {/* -------- PARENT -------- */}
                  <TouchableOpacity
                    style={[styles.categoryTab, isActiveParent && styles.categoryTabActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                      if (activeParentId === item.id) {
                        setActiveParentId(null);
                        setActiveSubCatId(null);
                      } else {
                        setActiveParentId(item.id);
                      }
                    }}

                  >
                    <View style={[
                      styles.categoryImageContainer,
                      isActiveParent && styles.categoryImageActive
                    ]}>
                      {parentThumb ? (
                        <Image source={{ uri: parentThumb }} style={styles.categoryImage} />
                      ) : (
                        <Ionicons name="image-outline" size={22} color="#94a3b8" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.categoryText,
                        isActiveParent && styles.categoryTextActive
                      ]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>

                  {/* -------- SUB CATEGORIES (REUSE PARENT STYLES) -------- */}
                  {isActiveParent && parentSubs.map(sub => {
                    const isActiveSub = activeSubCatId === sub.id;
                    const subThumb = resolveProductImageUri(sub);

                    return (
                      <TouchableOpacity
                        key={sub.id}
                        style={[styles.categoryTab, isActiveSub && styles.categoryTabActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setActiveSubCatId(sub.id);
                        }}
                      >
                        <View style={[
                          styles.categoryImageContainer,
                          isActiveSub && styles.categoryImageActive
                        ]}>
                          {subThumb ? (
                            <Image source={{ uri: subThumb }} style={styles.categoryImage} />
                          ) : (
                            <Ionicons name="image-outline" size={22} color="#94a3b8" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.categoryText,
                            isActiveSub && styles.categoryTextActive
                          ]}
                          numberOfLines={2}
                        >
                          {sub.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            }}
          />
        </View>

        {/* ================= PRODUCTS ================= */}
        <View style={styles.productsArea}>

          {/* Search bar */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products…"
                placeholderTextColor="#b0bec5"
                value={searchQuery}
                onChangeText={t => setSearchQuery(t)}
                returnKeyType="search"
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
            {filteredProducts.length > 0 && (
              <Text style={styles.resultCount}>{filteredProducts.length}</Text>
            )}
          </View>

          {prodLoading ? (
            <ActivityIndicator color="#4b6f9e" style={{ marginTop: 40 }} />
          ) : filteredProducts.length > 0 ? (
            <FlatList
              data={paginatedProducts}
              keyExtractor={item => item.id}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.productList}
              columnWrapperStyle={styles.row}
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
                const thumb = resolveProductImageUri(item);
                const inStock = isProductPurchasable(item);
                return (
                <TouchableOpacity
                  style={[styles.productCard, !inStock && styles.productCardOutOfStock]}
                  onPress={() =>
                    router.push({ pathname: '/product/[id]', params: { id: item.id } })
                  }
                >
                  {!inStock && (
                    <View style={styles.oosBadge}>
                      <Text style={styles.oosBadgeText}>OUT OF STOCK</Text>
                    </View>
                  )}
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={[styles.productImage, !inStock && styles.productImageMuted]} />
                  ) : (
                    <View style={[styles.productImage, { justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="image-outline" size={36} color="#cbd5e1" />
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, !inStock && styles.productNameMuted]} numberOfLines={2}>{item.name}</Text>
                    <Text style={[styles.productUnit, !inStock && styles.productUnitMuted]}>{item.unit}</Text>
                    <View style={styles.productFooter}>
                      <Text style={[styles.productPrice, !inStock && styles.productPriceMuted]}>₹{item.price}</Text>
                      {inStock ? (
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleAddToCart(item);
                          }}
                        >
                          <Ionicons name="add" size={16} color="#fff" />
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
              <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>No products</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },

  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#2c3e50'
  },

  content: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f6f9fc'
  },

  sidebar: {
    width: 96,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#dbe4ef'
  },

  categoryTab: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6
  },

  categoryTabActive: {
    backgroundColor: '#e9f0f8'
  },

  categoryImageContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#dbe4ef'
  },

  categoryImageActive: {
    borderColor: '#4b6f9e',
    backgroundColor: '#e9f0f8'
  },

  categoryImage: {
    width: 40,
    height: 40,
    borderRadius: 10
  },

  categoryText: {
    fontSize: 10.5,
    color: '#7b8a9a',
    textAlign: 'center',
    fontWeight: '500'
  },

  categoryTextActive: {
    color: '#2c3e50',
    fontWeight: '700'
  },

  productsArea: { flex: 1, backgroundColor: '#f6f9fc' },
  productList: { padding: 12 },
  row: { justifyContent: 'space-between' },

  productCard: {
    flex: 0.48,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe4ef'
  },

  productImage: { width: '100%', height: 120, backgroundColor: '#eef3f8' },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '600', color: '#2c3e50', height: 34 },
  productUnit: { fontSize: 11, color: '#7b8a9a', marginBottom: 6 },

  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  productPrice: { fontSize: 15, fontWeight: '700', color: '#2c3e50' },

  addButton: {
    backgroundColor: '#4b6f9e',
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  soldOutPillText: { color: '#64748b', fontSize: 8, fontWeight: '800' },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: '#7b8a9a', marginTop: 16 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe4ef',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },

  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e9f0f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#f1f5f9' },
  pageLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2c3e50',
    minWidth: 50,
    textAlign: 'center',
  },
});
