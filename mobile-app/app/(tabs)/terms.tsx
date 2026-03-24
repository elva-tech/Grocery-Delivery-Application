import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: 'Terms of Service' }} />
      
      <Text style={styles.header}>Terms and Conditions</Text>
      <Text style={styles.date}>Last Updated: January 2026</Text>

      <View style={styles.section}>
        <Text style={styles.title}>1. Delivery Policy</Text>
        <Text style={styles.body}>
          Enandi specializes in fresh daily deliveries. Orders placed before 10:00 PM will be delivered the following morning between 5:00 AM and 8:00 AM.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>2. Pricing & Payments</Text>
        <Text style={styles.body}>
          All prices are inclusive of GST. We reserve the right to adjust pricing based on market fluctuations for fresh produce and dairy.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>3. Returns & Refunds</Text>
        <Text style={styles.body}>
          Due to the perishable nature of our products, returns are only accepted at the time of delivery if the packaging is damaged or the product is spoiled.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  date: { fontSize: 12, color: '#7b8a9a', marginBottom: 24 },
  section: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '700', color: '#4b6f9e', marginBottom: 8 },
  body: { fontSize: 14, color: '#2c3e50', lineHeight: 22 }
});