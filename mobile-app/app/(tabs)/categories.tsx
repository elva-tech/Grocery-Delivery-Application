import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useGetCategoriesQuery, useGetProductsByCategoryQuery } from '@/api/apiSlice';
import { addToCart } from '@/store/slices/cartSlice';
import { showToast } from '@/utils/toast';

export default function CategoriesScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const { data: categories = [], isLoading: catLoading } = useGetCategoriesQuery();
  const didAutoSelectParent = useRef(false);


  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [activeSubCatId, setActiveSubCatId] = useState<string | null>(null);

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

  const { data: products = [], isLoading: prodLoading } =
    useGetProductsByCategoryQuery(activeParentId || '', { skip: !activeParentId });

  const filteredProducts = useMemo(
    () => products.filter(p => p.subCategoryId === activeSubCatId),
    [products, activeSubCatId]
  );

  const handleAddToCart = (product: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch(addToCart({
      ...product,
      image: Array.isArray(product.image) ? product.image[0] : product.image
    }));
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
                      <Image source={{ uri: item.image[0] }} style={styles.categoryImage} />
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
                          <Image source={{ uri: sub.image[0] }} style={styles.categoryImage} />
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
          {prodLoading ? (
            <ActivityIndicator color="#4b6f9e" style={{ marginTop: 40 }} />
          ) : filteredProducts.length > 0 ? (
            <FlatList
              data={filteredProducts}
              keyExtractor={item => item.id}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.productList}
              columnWrapperStyle={styles.row}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productCard}
                  onPress={() =>
                    router.push({ pathname: '/product/[id]', params: { id: item.id } })
                  }
                >
                  <Image source={{ uri: item.image[0] }} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.productUnit}>{item.unit}</Text>
                    <View style={styles.productFooter}>
                      <Text style={styles.productPrice}>₹{item.price}</Text>
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAddToCart(item);
                        }}
                      >
                        <Ionicons name="add" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
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

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: '#7b8a9a', marginTop: 16 }
});
