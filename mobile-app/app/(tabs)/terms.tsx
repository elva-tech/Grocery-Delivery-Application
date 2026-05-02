import React from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { APP_BRAND, SUPPORT_PHONE } from '@/src/config/constants';
import { useTenantBranding } from '@/contexts/TenantBrandingContext';

const BRAND = APP_BRAND;

const PAGES: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
  terms: {
    title: 'Terms of Service',
    sections: [
      {
        heading: '1. Delivery Policy',
        body: `${BRAND} specialises in fresh daily deliveries. Orders placed before 10:00 PM will be delivered the following morning between 5:00 AM and 8:00 AM.`,
      },
      {
        heading: '2. Pricing & Payments',
        body: 'All prices are inclusive of GST. We reserve the right to adjust pricing based on market fluctuations for fresh produce and dairy.',
      },
      {
        heading: '3. Account Accuracy',
        body: 'You are responsible for providing correct delivery and contact information.',
      },
      {
        heading: '4. Use of Service',
        body: 'Our services are intended for personal use. Any commercial resale of products is prohibited.',
      },
      {
        heading: '5. Modifications',
        body: `${BRAND} reserves the right to update these terms to reflect changes in our business or legal requirements.`,
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'Information Collection',
        body: 'We collect only necessary details such as your name, delivery address, and contact number to facilitate our services.',
      },
      {
        heading: 'Data Usage',
        body: 'Your data is used to personalise your experience, process transactions, and send service-related updates.',
      },
      {
        heading: 'Security',
        body: 'We implement advanced security protocols to protect your data from unauthorised access or disclosure.',
      },
      {
        heading: 'Third Parties',
        body: 'We do not sell, trade, or rent your personal information to third parties for marketing purposes.',
      },
      {
        heading: 'Cookies & Storage',
        body: 'Our app uses local storage to remember your session and cart items for a smoother experience.',
      },
    ],
  },
  refund: {
    title: 'Refund Policy',
    sections: [
      {
        heading: 'Quality Claims',
        body: 'If a product does not meet the specified quality standards, please report it within 12 hours of delivery using the "Report Issue" button in Order History.',
      },
      {
        heading: 'Damaged Goods',
        body: 'For items received in a damaged or tampered state, a full refund or replacement will be provided upon verification.',
      },
      {
        heading: 'Processing Time',
        body: `Approved refunds are credited to your original payment method or ${BRAND} Wallet within 3–5 business days.`,
      },
      {
        heading: 'Non-Returnable Items',
        body: 'Due to the perishable nature of our goods, we do not accept physical returns, but we offer full financial resolution for valid issues.',
      },
    ],
  },
  faqs: {
    title: 'FAQs',
    sections: [
      {
        heading: 'How do I place an order?',
        body: 'Browse our categories, add items to your basket, and proceed to checkout. Select your delivery address to confirm.',
      },
      {
        heading: 'Can I edit an existing order?',
        body: 'Orders can be cancelled while they are in "Placed" or "Confirmed" status. Once "Out for Delivery," no changes can be made.',
      },
      {
        heading: 'What if my items are damaged?',
        body: 'Use the "Report Issue" button in your Order History. Upload a photo and our team will process a refund or replacement within 24 hours.',
      },
      {
        heading: 'Is my payment information secure?',
        body: 'Yes. All transactions are processed through Razorpay, a PCI-DSS compliant payment gateway. We never store your card details.',
      },
    ],
  },
  about: {
    title: 'About Us',
    sections: [
      {
        heading: `About ${BRAND}`,
        body: `At ${BRAND}, we are committed to delivering pure, high-quality dairy and grocery products to your doorstep. Our platform bridges the gap between quality producers and health-conscious consumers.`,
      },
      {
        heading: 'Our Mission',
        body: 'To foster a culture where every product delivered is handled with utmost care, maintaining its natural nutritional profile.',
      },
      
    ],
  },
};

function CustomerSupportScreen() {
  const { storeName, supportEmail, supportPhone, supportHours, loading, error } =
    useTenantBranding();

  const phoneLine = (supportPhone || SUPPORT_PHONE).trim();
  const phoneDigits = phoneLine.replace(/\D/g, '');
  const mail = supportEmail.trim();

  const openMail = () => {
    if (mail) Linking.openURL(`mailto:${mail}`);
  };
  const openTel = () => {
    if (phoneDigits) Linking.openURL(`tel:${phoneDigits}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.supportLoading]}>
        <ActivityIndicator size="large" color="#4b6f9e" />
        <Text style={styles.supportLoadingText}>Loading store contact…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.supportScroll}>
      {error ? (
        <Text style={styles.supportError}>{error}</Text>
      ) : null}

      <View style={styles.supportIntro}>
        <Text style={styles.supportIntroTitle}>{storeName}</Text>
        <Text style={styles.supportIntroSub}>
          Reach the store team the same way as on our website — details below are set by your store.
        </Text>
      </View>

      {mail ? (
        <TouchableOpacity style={styles.supportCard} onPress={openMail} activeOpacity={0.7}>
          <View style={styles.supportIconCircle}>
            <Ionicons name="mail-outline" size={22} color="#4b6f9e" />
          </View>
          <View style={styles.supportCardBody}>
            <Text style={styles.supportCardLabel}>Email</Text>
            <Text style={styles.supportCardValue}>{mail}</Text>
            <Text style={styles.supportCardHint}>Tap to send an email</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      ) : (
        <View style={[styles.supportCard, styles.supportCardMuted]}>
          <Ionicons name="mail-outline" size={22} color="#94a3b8" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.supportCardLabel}>Email</Text>
            <Text style={styles.supportCardMutedText}>
              This store has not published a support email yet. Ask the store admin to add it in the admin panel.
            </Text>
          </View>
        </View>
      )}

      {phoneDigits ? (
        <TouchableOpacity style={styles.supportCard} onPress={openTel} activeOpacity={0.7}>
          <View style={styles.supportIconCircle}>
            <Ionicons name="call-outline" size={22} color="#4b6f9e" />
          </View>
          <View style={styles.supportCardBody}>
            <Text style={styles.supportCardLabel}>Phone</Text>
            <Text style={styles.supportCardValue}>{phoneLine}</Text>
            <Text style={styles.supportCardHint}>Tap to call</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      ) : null}

      {supportHours ? (
        <View style={[styles.supportCard, styles.supportCardStatic]}>
          <View style={styles.supportIconCircle}>
            <Ionicons name="time-outline" size={22} color="#4b6f9e" />
          </View>
          <View style={styles.supportCardBody}>
            <Text style={styles.supportCardLabel}>Support hours</Text>
            <Text style={styles.supportCardValue}>{supportHours}</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.supportFooter}>© 2026 {storeName || BRAND}</Text>
    </ScrollView>
  );
}

export default function LegalScreen() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  const key = (page as string) || 'terms';

  if (key === 'support') {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Customer Support' }} />
        <CustomerSupportScreen />
      </>
    );
  }

  const content = PAGES[key] || PAGES.terms;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: content.title }} />

      <Text style={styles.header}>{content.title}</Text>
      <Text style={styles.date}>Last Updated: January 2026</Text>

      {content.sections.map((s, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.title}>{s.heading}</Text>
          <Text style={styles.body}>
  {s.body.split('\n').map((line, index) => {
    if (line.startsWith('Phone:')) {
      const phone = line.replace('Phone: ', '');
      return (
        <Text key={index} onPress={() => Linking.openURL(`tel:${phone}`)}>
          {line + '\n'}
        </Text>
      );
    }

    if (line.startsWith('Email:')) {
      const email = line.replace('Email: ', '');
      return (
        <Text key={index} onPress={() => Linking.openURL(`mailto:${email}`)}>
          {line + '\n'}
        </Text>
      );
    }

    return <Text key={index}>{line + '\n'}</Text>;
  })}
</Text>
        </View>
      ))}

      <Text style={styles.footer}>© 2026 {BRAND}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  date: { fontSize: 12, color: '#7b8a9a', marginBottom: 24 },
  section: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '700', color: '#4b6f9e', marginBottom: 8 },
  body: { fontSize: 14, color: '#2c3e50', lineHeight: 22 },
  footer: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 24 },

  supportScroll: { padding: 20, paddingBottom: 48 },
  supportLoading: { justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  supportLoadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  supportError: { color: '#dc2626', fontSize: 13, marginBottom: 16 },
  supportIntro: { marginBottom: 20 },
  supportIntroTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  supportIntroSub: { fontSize: 14, color: '#64748b', lineHeight: 21 },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  supportCardStatic: { backgroundColor: '#fff' },
  supportCardMuted: { alignItems: 'flex-start' },
  supportIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  supportCardBody: { flex: 1, minWidth: 0 },
  supportCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  supportCardValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  supportCardHint: { fontSize: 12, color: '#4b6f9e', marginTop: 4, fontWeight: '600' },
  supportCardMutedText: { fontSize: 13, color: '#64748b', lineHeight: 19, marginTop: 4 },
  supportFooter: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 28 },
});