import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { Colors, Fonts } from "@/theme/theme";
import { sendOtp } from "@/api/authApi";

export default function Register() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Validation: Starts with 6-9 and is exactly 10 digits
  const indiaRegex = /^[6-9]\d{9}$/;
  const isValid = indiaRegex.test(phone) && name.length >= 2;

  const handleNext = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      await sendOtp(`+91${phone}`);
      router.push({
        pathname: '/auth/otp',
        params: { phone, name }
      });
    } catch (error) {
      alert("Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} bounces={false}>
        <LottieView
          source={require('../../assets/animations/Cyber Security.json')}
          autoPlay loop style={styles.lottieHero}
        />

        <Text style={[styles.title, { fontFamily: Fonts.bold }]}>Create Account</Text>
        <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>Enter your details to get started</Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Mobile Number</Text>
          {/* ✅ FIXED: Changed <div> to <View> */}
          <View style={styles.inputRow}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="98765 43210"
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
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { fontFamily: Fonts.semibold }]}>Continue</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.WHITE, padding: 24, justifyContent: "center" },
  lottieHero: { width: 250, height: 200, alignSelf: "center", marginBottom: 10 },
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
});