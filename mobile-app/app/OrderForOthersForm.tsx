import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '@/utils/toast'; // Use your custom toast helper

export type OthersData = {
  recipientName: string;
  recipientPhone: string;
  fullAddress: string;
  landmark: string;
  note: string;
};

interface Props {
  onSubmit: (data: OthersData) => void;
  onCancel: () => void;
  initialData?: OthersData | null;
}

const EMPTY_FORM: OthersData = {
  recipientName: '',
  recipientPhone: '',
  fullAddress: '',
  landmark: '',
  note: '',
};

export default function OrderForOthersForm({ onSubmit, onCancel, initialData }: Props) {
  const [form, setForm] = useState<OthersData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with initialData if editing
  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm(EMPTY_FORM);
    }
  }, [initialData]);

  const handleDone = () => {
    // ─── VALIDATION ───
    if (!form.recipientName.trim()) {
      showToast('error', 'Missing Name', "Please enter the recipient's name");
      return;
    }
    if (form.recipientPhone.length < 10) {
      showToast('error', 'Invalid Phone', "Please enter a valid 10-digit phone number");
      return;
    }
    if (!form.fullAddress.trim() || form.fullAddress.length < 5) {
      showToast('error', 'Invalid Address', "Please provide a more detailed address");
      return;
    }

    setIsSubmitting(true);
    
    // Small timeout to give user feedback that something happened
    setTimeout(() => {
      onSubmit(form);
      setIsSubmitting(false);
    }, 400);
  };

  return (
    <View style={styles.overlay}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.modalContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Recipient Details</Text>
            <Text style={styles.subtitle}>Where should we deliver the order?</Text>
          </View>
          <TouchableOpacity 
            onPress={onCancel} 
            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          style={styles.form}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text style={styles.sectionLabel}>Contact Information</Text>
          <View style={styles.inputGroup}>
            <Ionicons name="person-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
            <TextInput 
              placeholder="Recipient's Name *" 
              placeholderTextColor="#94a3b8"
              style={styles.input} 
              value={form.recipientName}
              onChangeText={(t) => setForm(prev => ({...prev, recipientName: t}))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Ionicons name="call-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
            <TextInput 
              placeholder="Recipient's Phone *" 
              placeholderTextColor="#94a3b8"
              style={styles.input} 
              keyboardType="phone-pad"
              maxLength={10}
              value={form.recipientPhone}
              onChangeText={(t) => setForm(prev => ({...prev, recipientPhone: t.replace(/\D/g, '')}))}
            />
          </View>

          <Text style={styles.sectionLabel}>Delivery Location</Text>
          <View style={[styles.inputGroup, { alignItems: 'flex-start', paddingTop: 12 }]}>
            <Ionicons name="location-outline" size={18} color="#94a3b8" style={[styles.inputIcon, { marginTop: 2 }]} />
            <TextInput 
              placeholder="Complete Address (Flat No, Building, Street) *" 
              placeholderTextColor="#94a3b8"
              style={[styles.input, styles.textArea]} 
              multiline
              numberOfLines={3}
              value={form.fullAddress}
              onChangeText={(t) => setForm(prev => ({...prev, fullAddress: t}))}
            />
          </View>

          <TextInput 
            placeholder="Landmark (Optional)" 
            placeholderTextColor="#94a3b8"
            style={styles.inputStandalone} 
            value={form.landmark}
            onChangeText={(t) => setForm(prev => ({...prev, landmark: t}))}
          />

          <TextInput 
            placeholder="Delivery Instructions (e.g. Leave at gate)" 
            placeholderTextColor="#94a3b8"
            style={styles.inputStandalone} 
            value={form.note}
            onChangeText={(t) => setForm(prev => ({...prev, note: t}))}
          />

          <TouchableOpacity 
            style={[styles.submitBtn, isSubmitting && { opacity: 0.8 }]} 
            onPress={handleDone}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Confirm Delivery Details</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 24, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  closeBtn: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 20 },
  form: { padding: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#4b6f9e', textTransform: 'uppercase', marginBottom: 16, marginTop: 8, letterSpacing: 1 },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1e293b' },
  inputStandalone: { 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 14, 
    padding: 16, 
    marginBottom: 16, 
    fontSize: 15, 
    color: '#1e293b' 
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  submitBtn: { 
    backgroundColor: '#4b6f9e', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#4b6f9e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8 
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});