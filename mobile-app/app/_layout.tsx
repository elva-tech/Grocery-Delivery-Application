import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { setCredentials } from '@/store/slices/authSlice';
import { hydrateCart } from '@/store/slices/cartSlice';
import { CART_STORAGE_KEY } from '@/store/store';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [mounted, setMounted] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);
  const [authRestored, setAuthRestored] = useState(false);

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
          source={require('../assets/animations/Welcome.json')}
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
        {/* Fixed: Use redirect or simple stack config without 'href' */}
        {/* <Stack.Screen name="index" />  */}
        <Stack.Screen name="auth/landing" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ headerShown: true, headerTransparent: true, headerTitle: '' }} />
      </Stack>
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