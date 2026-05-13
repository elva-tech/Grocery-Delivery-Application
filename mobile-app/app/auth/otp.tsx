import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Keyboard, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useDispatch } from "react-redux";
import { setCredentials } from "@/store/slices/authSlice";
import { Colors, Fonts } from "@/theme/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";
import { sendOtp, verifyOtp } from "@/api/authApi";
import { apiSlice } from "@/api/apiSlice";
import { showToast } from "@/utils/toast";
import { getActiveTenantId } from "@/src/utils/tenantStorage";
import { clearCustomerLocalCaches } from "@/src/utils/customerLocalStorage";
import { hydrateCart } from "@/store/slices/cartSlice";
import { MOBILE_COPY } from "@/src/constants/copy";

export default function OTP() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams();

  const phone = params.phone as string;
  const name = (params.name as string) || "";
  const mode = (params.mode as "signup" | "login") || "login";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
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

    if (numericText && i < 5) {
      inputs.current[i + 1]?.focus();
    }

    if (copy.join("").length === 6) Keyboard.dismiss();
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await sendOtp(phone as string);
      setOtp(["", "", "", "", "", ""]);
      setTimer(30);
      inputs.current[0]?.focus();
    } catch (e) {
      showToast("error", "Error", "Resend failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.join("").length !== 6) return;
    setLoading(true);

    try {
      const fallbackSignupName = MOBILE_COPY.common.guestUser;
      const signupName = mode === "signup"
        ? ((name as string)?.trim() || fallbackSignupName)
        : undefined;

      const result = await verifyOtp(
        phone as string,
        otp.join(""),
        signupName,
        mode as "signup" | "login"
      );

      // `verifyOtp` already throws when token/user are missing, but TS can't infer that
      // from the optional fields. Narrow once here so the rest of this function is type-safe.
      const token = result.token;
      const user = result.user;
      if (!token || !user) {
        throw new Error(result.message || 'Verification failed');
      }

      const currentTenant = String(await getActiveTenantId()).trim().toLowerCase();
      const tokenTenant = String(user.tenantId || "").trim().toLowerCase();
      if (currentTenant && tokenTenant && currentTenant !== tokenTenant) {
        await AsyncStorage.multiRemove(['token', 'user', 'jwtToken']);
        await clearCustomerLocalCaches();
        dispatch(apiSlice.util.resetApiState());
        dispatch(hydrateCart({ items: [], totalAmount: 0, appliedCoupon: null }));
        throw new Error('This account belongs to a different store. Please switch store and login again.');
      }

      let prevUserId = '';
      try {
        const prevRaw = await AsyncStorage.getItem('user');
        if (prevRaw) prevUserId = String((JSON.parse(prevRaw) as { id?: string })?.id || '');
      } catch {
        /* ignore */
      }
      const newUserId = String(user.id || '');
      if (prevUserId && newUserId && prevUserId !== newUserId) {
        await clearCustomerLocalCaches();
        dispatch(apiSlice.util.resetApiState());
        dispatch(hydrateCart({ items: [], totalAmount: 0, appliedCoupon: null }));
      }

      await AsyncStorage.setItem('token', token);

      await AsyncStorage.setItem('user', JSON.stringify({
        id: user.id,
        phone: user.phoneNumber,
        name: user.name,
        email: user.email,
        address: user.address,
        alternatePhone: user.alternatePhone,
        tenantId: user.tenantId || currentTenant,
      }));

      dispatch(setCredentials({
        user: {
          id: user.id,
          phone: user.phoneNumber,
          name: user.name,
          email: user.email,
          address: user.address,
          alternatePhone: user.alternatePhone,
          tenantId: user.tenantId || currentTenant,
        },
        token,
      }));

      if (mode === "signup") {
        router.replace('/auth/complete-profile');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      showToast("error", "Verification Failed", e.message || "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../assets/animations/OTP-Verification.json')}
        autoPlay loop style={styles.lottieHero}
      />

      <Text style={[styles.title, { fontFamily: Fonts.bold }]}>{MOBILE_COPY.auth.otpTitle}</Text>
      <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>
  Enter the 6-digit code sent to
</Text>

<Text style={[styles.subtitle, { color: Colors.PRIMARY, fontFamily: Fonts.medium }]}>
  +91 {phone}
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
        style={[styles.button, (otp.join("").length < 6 || loading) && styles.buttonDisabled]} 
        onPress={handleVerify}
        disabled={otp.join("").length < 6 || loading}
      >
        {loading ? <ActivityIndicator color={Colors.WHITE} /> : <Text style={[styles.buttonText, { fontFamily: Fonts.semibold }]}>{mode === 'signup' ? 'Verify & Continue' : 'Verify & Sign In'}</Text>}
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
  otpContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40,  gap: 8 },
input: {
  width: 48,
  height: 56,
  borderRadius: 12,
  borderWidth: 1.5,
  textAlign: "center",
  fontSize: 20,
  fontWeight: "700",
  backgroundColor: Colors.BG,
  color: Colors.PRIMARY_TEXT,
},
  button: { height: 56, backgroundColor: Colors.PRIMARY, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  buttonDisabled: { backgroundColor: Colors.BORDER },
  buttonText: { color: Colors.WHITE, fontSize: 18 },
  resendContainer: { marginTop: 32, alignItems: "center" },
  resendText: { fontSize: 15, fontWeight: "600" }
});