import { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Keyboard } from 'react-native';
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
import { apiSlice, useGetCategoriesQuery, useGetProductsQuery, useGetStoreStatusQuery } from '@/api/apiSlice';
import { extractTenantFromUrl, getActiveTenantId, saveTenantId } from '@/src/utils/tenantStorage';
import { clearCustomerLocalCaches } from '@/src/utils/customerLocalStorage';
import { TenantBrandingProvider } from '@/contexts/TenantBrandingContext';

SplashScreen.preventAutoHideAsync();

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
  const { data: storeStatus } = useGetStoreStatusQuery();
const isClosed = storeStatus?.isClosed;

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  // Restore auth + cart from AsyncStorage on app start (never hydrate cart without a valid session).
  useEffect(() => {
    (async () => {
      try {
        const [token, userStr, cartStr] = await Promise.all([
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem(CART_STORAGE_KEY),
        ]);
        let sessionValid = false;

        if (token && userStr) {
          let parsedUser = JSON.parse(userStr) as Record<string, unknown>;
          const activeTenant = String(await getActiveTenantId()).trim().toLowerCase();
          let savedTenant = String(parsedUser?.tenantId || '').trim().toLowerCase();

          // Older APKs / partial payloads may omit tenantId — do not wipe a valid JWT for that.
          if (!savedTenant && activeTenant) {
            parsedUser = { ...parsedUser, tenantId: activeTenant };
            savedTenant = activeTenant;
            try {
              await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
            } catch {
              /* ignore */
            }
          }

          // Store switch: drop auth + wipe local cart/addresses so another tenant's data never leaks.
          if (savedTenant && activeTenant && savedTenant !== activeTenant) {
            await AsyncStorage.multiRemove(['token', 'user', 'jwtToken']);
            await clearCustomerLocalCaches();
            dispatch(apiSlice.util.resetApiState());
            dispatch(hydrateCart({ items: [], totalAmount: 0, appliedCoupon: null }));
          } else {
            dispatch(setCredentials({ user: parsedUser, token }));
            sessionValid = true;
          }
        }

        if (sessionValid && cartStr) {
          dispatch(hydrateCart(JSON.parse(cartStr)));
        } else if (!sessionValid && cartStr) {
          await AsyncStorage.removeItem(CART_STORAGE_KEY);
          dispatch(hydrateCart({ items: [], totalAmount: 0, appliedCoupon: null }));
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
    <View
      style={styles.appRoot}
      onStartShouldSetResponderCapture={() => {
        Keyboard.dismiss();
        return false;
      }}
    >
      <StatusBar style="dark" translucent />
  
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/landing" />
        <Stack.Screen name="auth/store-code" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ headerShown: true, headerTransparent: true, headerTitle: '' }} />
      </Stack>
  
      {/* 🔥 GLOBAL STORE CLOSED POPUP */}
      {isClosed && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 9999,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: '#fff',
            padding: 28,
            borderRadius: 24,
            width: '85%',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 10
          }}>
            <Text style={{ fontSize: 22, fontWeight: '900' }}>
              Store Closed
            </Text>
  
            <Text style={{ marginTop: 10, textAlign: 'center', color: '#555' }}>
              {storeStatus?.reason}
            </Text>
  
            {(storeStatus as any)?.type === "TIME" && (
              <Text style={{ marginTop: 12, fontWeight: '600' }}>
                {(storeStatus as any).startTime} - {(storeStatus as any).endTime}
              </Text>
            )}
  
            {(storeStatus as any)?.type === "DATE" && (
              <>
                <Text style={{ marginTop: 12 }}>
                  {(storeStatus as any).startDate} → {(storeStatus as any).endDate}
                </Text>
  
                <Text style={{ marginTop: 4, fontWeight: '600' }}>
                  {(storeStatus as any).startTime} - {(storeStatus as any).endTime}
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <TenantBrandingProvider>
        <SafeAreaProvider>
          <RootLayoutNav />
          <Toast config={toastConfig} />
        </SafeAreaProvider>
      </TenantBrandingProvider>
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
  appRoot: { flex: 1 },
  logoAnimation: {
    width: 300,
    height: 300,
  },
});