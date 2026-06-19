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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { setCredentials } from '@/store/slices/authSlice';
import { hydrateCart } from '@/store/slices/cartSlice';
import { CART_STORAGE_KEY } from '@/store/store';
import { useGetCategoriesQuery, useGetProductsQuery, useGetStoreStatusQuery } from '@/api/apiSlice';
import StoreClosingSoonBanner from '@/components/StoreClosingSoonBanner';
import { extractTenantFromUrl, getActiveTenantId, saveTenantId } from '@/src/utils/tenantStorage';
import { TenantBrandingProvider, useTenantBranding } from '@/contexts/TenantBrandingContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [mounted, setMounted] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [authRestored, setAuthRestored] = useState(false);
  const { ready: brandingReady, loading: brandingLoading, logoUri } = useTenantBranding();

  // Store Status - fetched from backend
  const { data: storeStatus } = useGetStoreStatusQuery(undefined, { pollingInterval: 30_000 });
  const isClosed = storeStatus?.isClosed ?? false;
  const showClosingSoon =
    !isClosed &&
    Boolean(storeStatus?.closingSoon) &&
    (storeStatus?.minutesUntilClose ?? 0) > 0;

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

          // Only clear session when we know both tenants and they disagree (real store switch).
          if (savedTenant && activeTenant && savedTenant !== activeTenant) {
            await AsyncStorage.multiRemove(['token', 'user', 'jwtToken']);
          } else {
            dispatch(setCredentials({ user: parsedUser, token }));
          }
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

  const fontsReady = fontsLoaded || Boolean(fontError);
  const brandingSettled = brandingReady && !brandingLoading;

  useEffect(() => {
    if (!fontsReady || !brandingSettled || !authRestored) return;

    let cancelled = false;
    (async () => {
      if (logoUri) {
        try {
          await Image.prefetch(logoUri);
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;
      await SplashScreen.hideAsync();
      if (!cancelled) setAppReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [fontsReady, brandingSettled, authRestored, logoUri]);

  useEffect(() => {
    if (!mounted || !segments?.length || !appReady) return;

    let cancelled = false;

    (async () => {
      const tid = (await getActiveTenantId()).trim();
      if (cancelled) return;

      const rootSegment = segments[0];
      const inAuthFlow = rootSegment === 'auth';
      const onStoreCode = segments[1] === 'store-code';

      if (!tid && !onStoreCode) {
        router.replace('/auth/store-code');
        return;
      }

      if (!isAuthenticated && !inAuthFlow) {
        router.replace('/auth/landing');
      } else if (isAuthenticated && inAuthFlow) {
        router.replace('/(tabs)');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, segments, mounted, appReady]);

  if (!appReady) return null;

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
        <Stack.Screen name="checkout" />
        <Stack.Screen name="product/[id]" options={{ headerShown: true, headerTransparent: true, headerTitle: '' }} />
      </Stack>

      {showClosingSoon && storeStatus?.minutesUntilClose != null && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9000 }}>
          <StoreClosingSoonBanner
            minutesUntilClose={storeStatus.minutesUntilClose}
            closesAt={storeStatus.closesAt}
          />
        </View>
      )}

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
  appRoot: { flex: 1 },
});