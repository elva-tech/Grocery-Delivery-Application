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
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [loading, setLoading] = useState(false);

  const indiaRegex = /^[6-9]\d{9}$/;
  const isValid =indiaRegex.test(phone.trim()) &&
  name.trim().length >= 2 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
  address.trim().length >= 5;
  // console.log({
  //   phone,
  //   name,
  //   email,
  //   address,
  //   isValid
  // });
  // console.log({
  //   phoneValid: indiaRegex.test(phone.trim()),
  //   nameValid: name.trim().length >= 2,
  //   emailValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
  //   addressValid: address.trim().length >= 5,
  // });

  const handleNext = async () => {
    console.log("CLICKED SEND OTP");
    if (!isValid) return;

    setLoading(true);
    try {
      await sendOtp(phone as string); // ✅ FIXED
      
      router.push({
        pathname: '/auth/otp',
        params: {
          phone,
          name,
          email,
          address,
          alternatePhone,
          mode: "signup"
        }
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

        {/* Name */}
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

        {/* Phone */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Mobile Number</Text>
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

        {/* Email */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Address */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your address"
            value={address}
            onChangeText={setAddress}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Alternate Phone */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Alternate Phone (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional"
            keyboardType="number-pad"
            maxLength={10}
            value={alternatePhone}
            onChangeText={(text) => setAlternatePhone(text.replace(/[^0-9]/g, ''))}
          />
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