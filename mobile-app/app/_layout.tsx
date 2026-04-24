import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { store, RootState } from '@/store/store';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/utils/toastConfig';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { setCredentials } from '@/store/slices/authSlice';
import { hydrateCart } from '@/store/slices/cartSlice';
import { CART_STORAGE_KEY } from '@/store/store';
import { useGetCategoriesQuery, useGetProductsQuery, useGetStoreStatusQuery } from '@/api/apiSlice';
import { extractTenantFromUrl, saveTenantId } from '@/src/utils/tenantStorage';

SplashScreen.preventAutoHideAsync();

const formatTime = (iso?: string) => {
  if (!iso) return '';

  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

function ClosingWarningCard({ countdown, endTime }: { countdown: number; endTime?: string | null }) {
  const pct = countdown / 300;

  const bgColor = countdown > 180 ? '#f59e0b' : countdown > 60 ? '#f97316' : '#ef4444';
  const pulse = countdown <= 60;

  const fmt = (iso?: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    });
  };

  const fmtCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 12,
      borderRadius: 16, overflow: 'hidden',
      shadowColor: bgColor, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    }}>
      {/* Card body */}
      <View style={{
        backgroundColor: '#fff',
        borderWidth: 2, borderColor: bgColor,
        borderRadius: 16, padding: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        {/* Icon */}
        <View style={{
          width: 40, height: 40, borderRadius: 12,
          backgroundColor: bgColor,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 18 }}>⏱️</Text>
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>
            Closing Soon
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 2 }}>
            Order before{' '}
            <Text style={{ color: bgColor, fontWeight: '900' }}>{fmt(endTime)}</Text>
          </Text>
        </View>

        {/* Countdown */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: bgColor, fontVariant: ['tabular-nums'] }}>
            {fmtCountdown(countdown)}
          </Text>
          <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            remaining
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ height: 4, backgroundColor: '#f1f5f9', marginHorizontal: 4, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{
          height: '100%', width: `${pct * 100}%`,
          backgroundColor: bgColor, borderRadius: 4,
        }} />
      </View>
    </View>
  );
}

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [mounted, setMounted] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimationFinished(true);
    }, 3000); // max wait 3s

    return () => clearTimeout(timeout);
  }, []);
  const [authRestored, setAuthRestored] = useState(false);

  // Store Status - fetched from backend
const { data: storeStatus, refetch: refetchStoreStatus } = useGetStoreStatusQuery(undefined, {
  pollingInterval: 5000,
});
const isClosed = !(storeStatus?.isOpen ?? true);

 const [closingCountdown, setClosingCountdown] = useState(300);
  const [showClosingWarning, setShowClosingWarning] = useState(false);
  const cachedEndTime = useRef<string | null>(null);
  const intervalRef = useRef<any>(null);

  const startCountdown = () => {
    const endTimeToUse = cachedEndTime.current;
    if (!endTimeToUse) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const endMs      = new Date(endTimeToUse).getTime();
    const fiveMinsMs = 5 * 60 * 1000;
    const tick = () => {
      const msLeft = endMs - Date.now();
      if (msLeft <= fiveMinsMs && msLeft > 0) {
        setShowClosingWarning(true);
        setClosingCountdown(Math.floor(msLeft / 1000));
      } else {
        setShowClosingWarning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (msLeft <= 0) refetchStoreStatus();
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
  };

  useEffect(() => {
    if (storeStatus?.endTime) cachedEndTime.current = storeStatus.endTime;
    if (storeStatus && !storeStatus.isOpen) {
      setShowClosingWarning(false);
      return;
    }
    startCountdown();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [storeStatus?.isOpen, storeStatus?.endTime]);

  // Restart countdown when app comes back to foreground
  useEffect(() => {
    const { AppState } = require('react-native');
    const sub = AppState.addEventListener('change', (state: string) => {
      if (state === 'active') startCountdown();
    });
    return () => sub.remove();
  }, []);

  // Watch for store open time — refetch instantly when it arrives
  useEffect(() => {
    if (!isClosed || !storeStatus?.nextChange) return;
    const openMs = new Date(storeStatus.nextChange).getTime();
    const msUntilOpen = openMs - Date.now();
    if (msUntilOpen <= 0 || msUntilOpen > 10 * 60 * 1000) return;
    const id = setTimeout(() => refetchStoreStatus(), msUntilOpen);
    return () => clearTimeout(id);
  }, [isClosed, storeStatus?.nextChange]);

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  // Restore auth + cart from AsyncStorage on app start
  useEffect(() => {
    (async () => {
      try {
        const [token, userStr, cartStr] = await Promise.all([
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem(CART_STORAGE_KEY),
        ]);
        if (token && userStr) {
          dispatch(setCredentials({ user: JSON.parse(userStr), token }));
        }
        if (cartStr) {
          dispatch(hydrateCart(JSON.parse(cartStr)));
        }
      } catch (_) {
        // ignore
      } finally {
        setAuthRestored(true);
      }
    })();
  }, []);

  // ── Deep link / QR tenant resolution ────────────────────────────────────────
  useEffect(() => {
    // Cold start: app opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        const tenantId = extractTenantFromUrl(url);
        if (tenantId) saveTenantId(tenantId);
      }
    });

    // Warm start: app already open when deep link arrives
    const sub = Linking.addEventListener('url', (event) => {
      const tenantId = extractTenantFromUrl(event.url);
      if (tenantId) saveTenantId(tenantId);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (!mounted || !segments?.length || !fontsLoaded || !animationFinished || !authRestored) return;

    const rootSegment = segments[0];
    const inAuthFlow = rootSegment === 'auth';

    // Production-safe redirect check
    if (!isAuthenticated && !inAuthFlow) {
      router.replace('/auth/landing');
    } else if (isAuthenticated && inAuthFlow) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, mounted, fontsLoaded, animationFinished]);

  if (!fontsLoaded && !fontError) return null;

  if (!animationFinished) {
    return (
      <View style={styles.animationContainer}>
        <LottieView
          source={require('../assets/animations/Loading_car.json')}
          autoPlay
          loop={false}
          onAnimationFinish={() => setAnimationFinished(true)}
          style={styles.logoAnimation}
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" translucent />

   <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/landing" />
        <Stack.Screen name="auth/store-code" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ headerShown: true, headerTransparent: true, headerTitle: '' }} />
      </Stack>

      {/* ── 5-min closing warning card ── */}
      {showClosingWarning && !isClosed && (
        <View style={{ position: 'absolute', bottom: 90, left: 0, right: 0, zIndex: 999 }}>
          <ClosingWarningCard countdown={closingCountdown} endTime={storeStatus?.endTime} />
        </View>
      )}

      {/* 🔥 GLOBAL STORE CLOSED POPUP */}
      {isClosed && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: '#fff', padding: 28, borderRadius: 24,
            width: '85%', alignItems: 'center', shadowColor: '#000',
            shadowOpacity: 0.2, shadowRadius: 10, elevation: 10,
          }}>
            {/* Icon */}
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: '#ef4444', justifyContent: 'center',
              alignItems: 'center', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 28 }}>🔒</Text>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '900', color: '#111' }}>
              Store Closed
            </Text>

            <Text style={{ marginTop: 8, textAlign: 'center', color: '#555', lineHeight: 20 }}>
              {storeStatus?.reason || "We are currently not accepting orders"}
            </Text>

            {/* REGULAR */}
            {storeStatus?.type === "TIME" && storeStatus?.startTime && storeStatus?.endTime && (
              <View style={{
                marginTop: 16, backgroundColor: '#fef2f2',
                borderRadius: 12, padding: 14, width: '100%',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#b91c1c', marginBottom: 4 }}>
                  Store Timings
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#dc2626' }}>
                  {formatTime(storeStatus.startTime)} → {formatTime(storeStatus.endTime)}
                </Text>
                <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  Daily schedule
                </Text>
              </View>
            )}

            {/* OCCASIONAL */}
            {storeStatus?.type === "DATE" && storeStatus?.startDate && storeStatus?.endDate && (
              <View style={{
                marginTop: 16, backgroundColor: '#fff7ed',
                borderRadius: 12, padding: 14, width: '100%',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#c2410c', marginBottom: 6 }}>
                  Temporarily Closed
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#ea580c' }}>
                  {new Date(storeStatus.startDate).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short',
                    hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                  {" → "}
                  {new Date(storeStatus.endDate).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short',
                    hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </Text>
                {storeStatus?.reason && (
                  <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                    {storeStatus.reason}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <RootLayoutNav />
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  animationContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoAnimation: {
    width: 300,
    height: 300,
  },
});