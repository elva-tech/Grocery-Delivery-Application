import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { useGetProductsByCategoryQuery } from '@/api/apiSlice';
import { addToCart } from '@/store/slices/cartSlice';
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

  const handleAddToCart = (product: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    dispatch(addToCart({
      ...product,
      image: Array.isArray(product.image) ? product.image[0] : product.image
    }));

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
            {products?.length || 0} items available
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

      {/* ================= PRODUCTS ================= */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4b6f9e" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : products && products.length > 0 ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() =>
                router.push({ pathname: "/product/[id]", params: { id: item.id } })
              }
              activeOpacity={0.9}
            >
              <Image source={{ uri: item.image[0] }} style={styles.productImage} contentFit="contain" />
              <View style={styles.info}>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productUnit}>{item.unit}</Text>

                <View style={styles.footer}>
                  <View>
                    <Text style={styles.productPrice}>₹{item.price}</Text>
                    {item.stock < 10 && (
                      <Text style={styles.stockWarning}>Only {item.stock} left</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAddToCart(item);
                    }}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
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
});
