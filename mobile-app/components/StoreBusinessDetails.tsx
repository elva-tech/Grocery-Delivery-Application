import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { TenantDetails } from '@/api/tenantApi';

function present(value?: string | null): string {
  return String(value ?? '').trim();
}

export type StoreBusinessFields = {
  legalName: string;
  storeName: string;
  storeAddress: string;
  contactNumber: string;
  email: string;
};

export function getStoreBusinessFields(
  tenant: TenantDetails | null | undefined,
  fallbackStoreName = '',
): StoreBusinessFields {
  return {
    legalName: present(tenant?.legalName) || present(tenant?.ownerName),
    storeName: present(tenant?.storeName) || present(fallbackStoreName),
    storeAddress: present(tenant?.storeAddress),
    contactNumber: present(tenant?.phoneNumber),
    email: present(tenant?.contactEmail),
  };
}

function formatContact(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length === 10) return `+91 ${digits}`;
  return phone;
}

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
};

type StoreBusinessDetailsProps = {
  tenant: TenantDetails | null | undefined;
  fallbackStoreName?: string;
};

export default function StoreBusinessDetails({
  tenant,
  fallbackStoreName = '',
}: StoreBusinessDetailsProps) {
  const fields = getStoreBusinessFields(tenant, fallbackStoreName);
  const rows: Row[] = [];

  if (fields.legalName) {
    rows.push({ icon: 'briefcase-outline', label: 'Legal Name', value: fields.legalName });
  }
  if (fields.storeName) {
    rows.push({ icon: 'storefront-outline', label: 'Store Name', value: fields.storeName });
  }
  if (fields.storeAddress) {
    rows.push({ icon: 'location-outline', label: 'Address', value: fields.storeAddress });
  }
  if (fields.contactNumber) {
    const digits = fields.contactNumber.replace(/\D/g, '').slice(-10);
    rows.push({
      icon: 'call-outline',
      label: 'Contact',
      value: formatContact(fields.contactNumber),
      onPress: digits ? () => Linking.openURL(`tel:${digits}`) : undefined,
    });
  }
  if (fields.email) {
    rows.push({
      icon: 'mail-outline',
      label: 'Email',
      value: fields.email,
      onPress: () => Linking.openURL(`mailto:${fields.email}`),
    });
  }

  if (rows.length === 0) return null;

  return (
    <View>
      {rows.map((row) => {
        const body = (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name={row.icon} size={22} color="#4b6f9e" />
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value}>{row.value}</Text>
            </View>
            {row.onPress ? (
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            ) : null}
          </>
        );

        if (row.onPress) {
          return (
            <TouchableOpacity
              key={row.label}
              style={styles.card}
              onPress={row.onPress}
              activeOpacity={0.7}
            >
              {body}
            </TouchableOpacity>
          );
        }

        return (
          <View key={row.label} style={styles.card}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  body: { flex: 1, minWidth: 0 },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 21 },
});
