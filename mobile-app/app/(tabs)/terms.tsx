import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { APP_BRAND } from '@/src/config/constants';

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
      {
        heading: 'Contact Us',
        body: 'Email: support@kmfgrocery.com\nPhone: +91 98765 43210\n\nOur support team is available during standard business hours.',
      },
    ],
  },
};

export default function LegalScreen() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  const key = (page as string) || 'terms';
  const content = PAGES[key] || PAGES.terms;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: content.title }} />

      <Text style={styles.header}>{content.title}</Text>
      <Text style={styles.date}>Last Updated: January 2026</Text>

      {content.sections.map((s, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.title}>{s.heading}</Text>
          <Text style={styles.body}>{s.body}</Text>
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
});