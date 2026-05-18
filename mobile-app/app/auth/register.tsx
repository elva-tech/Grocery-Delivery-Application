import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Colors, Fonts } from "@/theme/theme";
import { sendOtp } from "@/api/authApi";
import { showToast } from "@/utils/toast";
import { StoreLogo } from "@/components/StoreLogo";
import { MOBILE_COPY } from "@/src/constants/copy";

export default function Register() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const indiaRegex = /^[6-9]\d{9}$/;
  const isValid = indiaRegex.test(phone.trim());

  const handleNext = async () => {
    if (!isValid || loading) return;

    setLoading(true);
    try {
      await sendOtp(phone as string);
      
      router.push({
        pathname: '/auth/otp',
        params: {
          phone,
          mode: "signup"
        }
      });
    } catch (error: any) {
      showToast("error", "Error", error?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} bounces={false}>
        <StoreLogo layout="stack" size={64} showTagline style={styles.brandRow} />

        <Text style={[styles.title, { fontFamily: Fonts.bold }]}>Create Account</Text>
        <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>{MOBILE_COPY.auth.registerSubtitle}</Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Mobile Number</Text>
          <View style={styles.inputRow}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="98765 43210"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { fontFamily: Fonts.semibold }]}>Send OTP</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchBtn} onPress={() => router.push("/auth/login")}>
          <Text style={styles.switchText}>{MOBILE_COPY.auth.signInCta}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: "center", marginBottom: 8 },
  brandLogo: { width: 64, height: 64, borderRadius: 14, marginBottom: 6 },
  brandName: { fontSize: 16, color: Colors.PRIMARY_TEXT, textAlign: "center", maxWidth: "100%" },
  container: { flexGrow: 1, backgroundColor: Colors.WHITE, padding: 24, justifyContent: "center" },
  title: { fontSize: 26, color: Colors.PRIMARY_TEXT, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.TEXT_MUTED, marginBottom: 32 },
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.PRIMARY_TEXT, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center" },
  countryCodeBox: { height: 52, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.BG, justifyContent: "center", marginRight: 8, borderWidth: 1, borderColor: Colors.BORDER },
  countryCodeText: { fontSize: 16, fontWeight: "600" },
  input: { height: 52, borderRadius: 12, backgroundColor: Colors.BG, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, borderColor: Colors.BORDER },
  button: { height: 56, backgroundColor: Colors.PRIMARY, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 20 },
  buttonDisabled: { backgroundColor: "#cbd5e1" },
  buttonText: { color: Colors.WHITE, fontSize: 18 },
  switchBtn: { marginTop: 18, alignSelf: "center" },
  switchText: { color: Colors.PRIMARY, fontSize: 14, fontFamily: Fonts.medium },
});