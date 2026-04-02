import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Keyboard, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useDispatch } from "react-redux";
import { setCredentials } from "@/store/slices/authSlice";
import { Colors, Fonts } from "@/theme/theme";
import { sendOtp, verifyOtp } from "@/api/authApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";

export default function OTP() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { phone, name } = useLocalSearchParams();

  const [otp, setOtp] = useState(["", "", "", ""]);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (text: string, i: number) => {
    const numericText = text.replace(/[^0-9]/g, ''); 
    if (text && !numericText) return;

    const copy = [...otp];
    copy[i] = numericText.slice(-1);
    setOtp(copy);
    
    if (numericText && i < 3) {
      inputs.current[i + 1]?.focus();
    }
    if (copy.join("").length === 4) Keyboard.dismiss();
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await sendOtp(`+91${phone}`);
      setOtp(["", "", "", ""]);
      setTimer(30);
      inputs.current[0]?.focus();
    } catch (e) {
      alert("Resend failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.join("").length !== 4) return;
    setLoading(true);

    try {
      const result = await verifyOtp(
        `+91${phone}`,
        otp.join(""),
        name as string,
        'signup'
      );

      if (!result.token || !result.user) throw new Error(result.message || 'Verification failed');

      await AsyncStorage.setItem('token', result.token);
      await AsyncStorage.setItem('user', JSON.stringify({
        id: result.user.id,
        phone: result.user.phoneNumber,
        name: result.user.name || (name as string),
      }));

      dispatch(setCredentials({
        user: {
          id: result.user.id,
          phone: result.user.phoneNumber,
          name: result.user.name || (name as string),
        },
        token: result.token,
      }));

      router.replace('/(tabs)');
    } catch (e: any) {
      alert(e.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../assets/animations/Security System.json')}
        autoPlay loop style={styles.lottieHero}
      />

      <Text style={[styles.title, { fontFamily: Fonts.bold }]}>Verification</Text>
      <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>
        Enter the 4-digit code sent to <Text style={{ color: Colors.PRIMARY }}>+91 {phone}</Text>
      </Text>

      <View style={styles.otpContainer}>
        {otp.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputs.current[i] = r; }}
            style={[styles.input, { borderColor: otp[i] ? Colors.PRIMARY : Colors.BORDER }]}
            keyboardType="number-pad"
            maxLength={1}
            value={d}
            onChangeText={(t) => handleChange(t, i)}
          />
        ))}
      </View>

      <TouchableOpacity 
        style={[styles.button, (otp.join("").length < 4 || loading) && styles.buttonDisabled]} 
        onPress={handleVerify}
        disabled={otp.join("").length < 4 || loading}
      >
        {loading ? <ActivityIndicator color={Colors.WHITE} /> : <Text style={[styles.buttonText, { fontFamily: Fonts.semibold }]}>Verify & Login</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.resendContainer} onPress={handleResend} disabled={timer > 0 || loading}>
        <Text style={[styles.resendText, { color: timer > 0 ? Colors.TEXT_MUTED : Colors.PRIMARY }]}>
          {timer > 0 ? `Resend code in ${timer}s` : "Resend Code"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: "center", backgroundColor: Colors.WHITE },
  lottieHero: { width: 220, height: 220, alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 28, color: Colors.PRIMARY_TEXT },
  subtitle: { fontSize: 16, color: Colors.TEXT_MUTED, marginTop: 12, marginBottom: 40, lineHeight: 24 },
  otpContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40 },
  input: { width: 64, height: 64, borderRadius: 16, borderWidth: 1.5, textAlign: "center", fontSize: 24, fontWeight: "700", backgroundColor: Colors.BG, color: Colors.PRIMARY_TEXT },
  button: { height: 56, backgroundColor: Colors.PRIMARY, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  buttonDisabled: { backgroundColor: Colors.BORDER },
  buttonText: { color: Colors.WHITE, fontSize: 18 },
  resendContainer: { marginTop: 32, alignItems: "center" },
  resendText: { fontSize: 15, fontWeight: "600" }
});