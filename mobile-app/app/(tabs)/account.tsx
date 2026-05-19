import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState } from '@/store/store';
import { updateUser } from '@/store/slices/authSlice';
import { updateProfile } from '@/api/authApi';
import { showToast } from '@/utils/toast';
import { Colors, Fonts } from '@/theme/theme';

export default function AccountScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state: RootState) => state.auth);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [alternatePhone, setAlternatePhone] = useState((user?.alternatePhone || '').replace(/[^0-9]/g, '').slice(0, 10));
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) return false;
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return false;
    return true;
  }, [name, email]);

  const handleSave = async () => {
    if (!canSave) {
      showToast('error', 'Invalid Details', 'Enter valid name and email');
      return;
    }
    if (!token) {
      showToast('error', 'Session Expired', 'Please log in again');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        alternatePhone: alternatePhone.trim(),
      };
      await updateProfile(payload, token);
      dispatch(updateUser(payload));

      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        await AsyncStorage.setItem('user', JSON.stringify({ ...JSON.parse(stored), ...payload }));
      }

      showToast('success', 'Saved', 'Account details updated');
      router.back();
    } catch (error: any) {
      showToast('error', 'Update Failed', error?.message || 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Mobile Number</Text>
          <Text style={styles.infoValue}>+91 {(user?.phone || '').replace(/^\+91\s?/, '') || 'Not available'}</Text>
          <Text style={styles.infoHint}>Mobile number is verified and cannot be edited.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Profile Information</Text>

          <Text style={styles.inputLabel}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            placeholderTextColor="#94a3b8"
            maxLength={40}
          />

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Alternate Phone</Text>
          <TextInput
            style={styles.input}
            value={alternatePhone}
            onChangeText={(t) => setAlternatePhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="Optional"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || saving) && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, color: '#0f172a', fontFamily: Fonts.bold },
  content: { padding: 16, paddingBottom: 120 },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbe4ef',
    marginBottom: 12,
  },
  infoLabel: { fontSize: 12, color: '#64748b', fontFamily: Fonts.medium, marginBottom: 4 },
  infoValue: { fontSize: 16, color: '#0f172a', fontFamily: Fonts.bold },
  infoHint: { marginTop: 6, fontSize: 12, color: '#94a3b8', fontFamily: Fonts.regular },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbe4ef',
  },
  sectionTitle: { fontSize: 15, color: '#0f172a', fontFamily: Fonts.bold, marginBottom: 8 },
  inputLabel: { fontSize: 13, color: '#64748b', fontFamily: Fonts.medium, marginBottom: 6, marginTop: 10 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    color: '#0f172a',
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
  },
  saveBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontFamily: Fonts.semibold },
});
