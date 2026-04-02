import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView, Image } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '@/store/slices/authSlice'; 
import { clearCart } from '@/store/slices/cartSlice'; 
import { RootState } from '@/store/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { showToast } from '@/utils/toast';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts } from '@/theme/theme'; // Use your primary blue tokens

export default function ProfileScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { items } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const router = useRouter();

  const [profileImage, setProfileImage] = useState<string | null>(null);

  const handleLogout = async () => {
    showToast('info', 'Logout', 'Logging you out...');
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setTimeout(() => {
      dispatch(logout());
      dispatch(clearCart());
      router.replace('/auth/landing');
      showToast('success', 'Logged Out', 'Come back soon!');
    }, 600);
  };

  const handleProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('error', 'Permission denied', 'Gallery access required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
      showToast('success', 'Updated', 'Profile photo updated');
    }
  };

  const menuItems = [
    {
      icon: 'cart-outline',
      label: 'Cart',
      badge: items?.length || 0,
      onPress: () => router.push('/(tabs)/cart')
    },
    {
      icon: 'receipt-outline',
      label: 'Order History',
      onPress: () => router.push('/(tabs)/orders')
    },
    {
      icon: 'heart-outline',
      label: 'Favorites',
      onPress: () => showToast('info', 'Coming Soon', 'Favorites feature is coming soon')
    },
    {
      icon: 'location-outline',
      label: 'Saved Addresses',
      onPress: () => router.push('/(tabs)/addresses')
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      onPress: () => showToast('info', 'Notifications', 'No new notifications')
    },
    {
      icon: 'help-circle-outline',
      label: 'Customer Support',
      onPress: () => Linking.openURL('tel:+919876543210')
    },
    {
      icon: 'document-text-outline',
      label: 'Terms & Conditions',
      onPress: () => router.push('/(tabs)/terms')
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handleProfileImage} activeOpacity={0.8}>
            <View style={styles.avatarContainer}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera-outline" size={16} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>

          {/* DYNAMIC USER DATA */}
          <Text style={styles.userNameText}>{user?.name || 'Guest User'}</Text>
          <Text style={styles.phoneText}>+91 {user?.phone || '00000 00000'}</Text>

          <View style={styles.memberBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.PRIMARY} />
            <Text style={styles.memberStatus}>Verified Member</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.menuItem} 
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name={item.icon as any} size={22} color={Colors.PRIMARY} />
                </View>
                <Text style={styles.menuText}>{item.label}</Text>
              </View>
              <View style={styles.menuRight}>
                {item.badge !== undefined && item.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={22} color="#b91c1c" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.appInfo}>
          <Text style={styles.appName}>Enandi – Fresh Milk Delivery</Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <Text style={styles.copyrightText}>© 2026 Enandi</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f6f9fc' 
  },
  profileCard: { 
    alignItems: 'center', 
    paddingVertical: 36,
    backgroundColor: '#ffffff',
    marginBottom: 16
  },
  avatarContainer: { 
    position: 'relative' 
  },
  avatar: { 
    width: 96, 
    height: 96, 
    borderRadius: 48, 
    backgroundColor: Colors.PRIMARY, // Use Theme Color
    justifyContent: 'center', 
    alignItems: 'center'
  },
  avatarImage: {
    width: 96, 
    height: 96, 
    borderRadius: 48
  },
  avatarText: { 
    color: '#ffffff', 
    fontSize: 32, 
    fontFamily: Fonts.bold 
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: Colors.PRIMARY,
    borderRadius: 14,
    padding: 6,
    borderWidth: 3,
    borderColor: '#fff'
  },
  userNameText: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.PRIMARY_TEXT,
    marginTop: 14,
  },
  phoneText: { 
    fontSize: 15, 
    fontFamily: Fonts.medium,
    color: Colors.TEXT_MUTED, 
    marginTop: 2 
  },
  memberBadge: {
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 6, 
    backgroundColor: Colors.PRIMARY_SOFT || '#e9f0f8',
    paddingHorizontal: 12, 
    paddingVertical: 6,
    borderRadius: 20, 
    marginTop: 8
  },
  memberStatus: { 
    color: Colors.PRIMARY, 
    fontFamily: Fonts.semibold, 
    fontSize: 13 
  },
  menuSection: { 
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe4ef'
  },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1, 
    borderBottomColor: '#edf2f7'
  },
  menuLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconCircle: {
    width: 40, 
    height: 40, 
    borderRadius: 10,
    backgroundColor: Colors.PRIMARY_SOFT || '#e9f0f8',
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12
  },
  menuText: { 
    flex: 1, 
    fontSize: 16, 
    fontFamily: Fonts.medium,
    color: Colors.PRIMARY_TEXT 
  },
  badge: {
    backgroundColor: Colors.PRIMARY,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: Fonts.bold
  },
  logoutButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginHorizontal: 16, 
    marginTop: 8,
    padding: 16, 
    borderRadius: 14,
    backgroundColor: '#fff1f0',
    borderWidth: 1, 
    borderColor: '#ffdada'
  },
  logoutText: { 
    color: '#b91c1c', 
    marginLeft: 10, 
    fontFamily: Fonts.bold, 
    fontSize: 16 
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6
  },
  appName: { 
    fontSize: 14, 
    fontFamily: Fonts.semibold, 
    color: '#64748b' 
  },
  versionText: { 
    fontSize: 12, 
    color: '#94a3b8' 
  },
  copyrightText: { 
    fontSize: 11, 
    color: '#cbd5e1' 
  }
});