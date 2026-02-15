import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearCart } from '@/store/slices/cartSlice';
import { useDispatch } from 'react-redux';

const { width } = Dimensions.get('window');

const BRAND_BLUE = '#4b6f9e';
const SUCCESS_GREEN = '#10b981';
const WARNING_GOLD = '#f59e0b';

export default function OrderSuccessScreen() {
  const [orderId, setOrderId] = useState<string | null>(null);

  const router = useRouter();
  const dispatch = useDispatch();
  const confettiRef = useRef<any>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadOrderId = async () => {
      const id = await AsyncStorage.getItem('@last_order_id');
      setOrderId(id);
    };

    loadOrderId();

    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true })
    ]).start();

    dispatch(clearCart());

    const timer = setTimeout(() => {
      confettiRef.current?.start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  const handleTrackOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(tabs)/orders');
  };

  const handleBackHome = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ConfettiCannon
        ref={confettiRef}
        count={100}
        origin={{ x: width / 2, y: -20 }}
        fadeOut
        autoStart={false}
        colors={[BRAND_BLUE, SUCCESS_GREEN, WARNING_GOLD, '#ef4444', '#ffffff']}
      />

      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={64} color="#ffffff" />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', width: '100%' }}>
          <Text style={styles.title}>Order Placed!</Text>
          <Text style={styles.subtitle}>
            Your dairy essentials are being prepared{'\n'}and will arrive soon.
          </Text>

          {orderId && (
           <View style={styles.idBadge}>
  <Text style={styles.idLabel}>ORDER ID: {String(orderId)}</Text>
</View>

          )}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.trackButton} onPress={handleTrackOrder} activeOpacity={0.8}>
          <Ionicons name="navigate-outline" size={20} color="#ffffff" />
          <Text style={styles.trackButtonText}>Track Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeButton} onPress={handleBackHome} activeOpacity={0.7}>
          <Text style={styles.homeButtonText}>Return to Shop</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconContainer: { marginBottom: 30 },
  iconCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: SUCCESS_GREEN, justifyContent: 'center', alignItems: 'center', shadowColor: SUCCESS_GREEN, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  title: { fontSize: 32, fontWeight: '900', color: '#1e293b', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  idBadge: { backgroundColor: '#eef2ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  idLabel: { fontSize: 13, fontWeight: '700', color: BRAND_BLUE, letterSpacing: 0.5 },
  footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, gap: 12 },
  trackButton: { backgroundColor: BRAND_BLUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 60, borderRadius: 20, elevation: 3 },
  trackButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  homeButton: { height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  homeButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600' }
});