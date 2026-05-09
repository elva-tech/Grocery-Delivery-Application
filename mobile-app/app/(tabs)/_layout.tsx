import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Colors } from '../../theme/theme'; 

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.PRIMARY,
        tabBarInactiveTintColor: Colors.TEXT_MUTED,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#dbe4ef',
          // FIX: Dynamic height based on safe area insets for all Android devices
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 60 + (insets.bottom > 0 ? insets.bottom : 10),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          paddingTop: 8,
          overflow: 'visible',
          elevation: 8, // Adds shadow for Android to distinguish from nav bar
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.semibold,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Basket',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? 'cart' : 'cart-outline'} size={24} color={color} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="order-success" options={{ href: null }} />
      <Tabs.Screen name="terms" options={{ href: null }} />
      <Tabs.Screen name="addresses" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
      
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  badge: {
    position: 'absolute',
    right: -10,
    top: -6,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
    elevation: 5,
  },
  badgeText: { 
    color: '#fff', 
    fontSize: 10, 
    fontFamily: Fonts.bold, // Custom font applied
    lineHeight: 12 
  },
});