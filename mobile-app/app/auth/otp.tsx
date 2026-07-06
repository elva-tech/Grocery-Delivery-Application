import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Keyboard, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useDispatch } from "react-redux";
import { setCredentials } from "@/store/slices/authSlice";
import { Colors, Fonts } from "@/theme/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";
import { sendOtp, verifyOtp } from "@/api/authApi";
import { showToast } from "@/utils/toast";
import { getActiveTenantId } from "@/src/utils/tenantStorage";
import { MOBILE_COPY } from "@/src/constants/copy";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/src/config/constants";

function splitOtpDigits(value: string): string[] {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 6).split("");
  return Array.from({ length: 6 }, (_, i) => digits[i] || "");
}

export default function OTP() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams();

  const phone = params.phone as string;
  const name = (params.name as string) || "";
  const mode = (params.mode as "signup" | "login") || "login";
  const autoSend = params.autoSend === "1";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(autoSend);
  const inputs = useRef<(TextInput | null)[]>([]);
  const autoSendStarted = useRef(false);
  const verifyInFlight = useRef(false);
  const verifySucceeded = useRef(false);

  useEffect(() => {
    if (!autoSend || autoSendStarted.current || !phone) return;
    autoSendStarted.current = true;

    (async () => {
      setSendingOtp(true);
      try {
        await sendOtp(phone as string, { mode });
        setTimer(OTP_RESEND_COOLDOWN_SECONDS);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to send OTP";
        showToast("error", "Error", msg);
        if (mode === "signup" && msg.toLowerCase().includes("already registered")) {
          setTimeout(() => router.replace({ pathname: "/auth/login", params: { phone } }), 1200);
        }
        if (mode === "login" && msg.toLowerCase().includes("sign up")) {
          setTimeout(() => router.replace({ pathname: "/auth/register", params: { phone } }), 1200);
        }
      } finally {
        setSendingOtp(false);
      }
    })();
  }, [autoSend, phone, mode, router]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  const completeLogin = useCallback(async (result: Awaited<ReturnType<typeof verifyOtp>>) => {
    const currentTenant = String(await getActiveTenantId()).trim().toLowerCase();
    const tokenTenant = String(result.user?.tenantId || "").trim().toLowerCase();
    if (currentTenant && tokenTenant && currentTenant !== tokenTenant) {
      await AsyncStorage.multiRemove(["token", "user", "jwtToken"]);
      throw new Error(
        "This account belongs to a different store. Please switch store and login again."
      );
    }

    await AsyncStorage.setItem("token", result.token!);

    await AsyncStorage.setItem(
      "user",
      JSON.stringify({
        id: result.user!.id,
        phone: result.user!.phoneNumber,
        name: result.user!.name,
        email: result.user!.email,
        address: result.user!.address,
        alternatePhone: result.user!.alternatePhone,
        tenantId: result.user!.tenantId || currentTenant,
      })
    );

    dispatch(
      setCredentials({
        user: {
          id: result.user!.id,
          phone: result.user!.phoneNumber,
          name: result.user!.name,
          email: result.user!.email,
          address: result.user!.address,
          alternatePhone: result.user!.alternatePhone,
          tenantId: result.user!.tenantId || currentTenant,
        },
        token: result.token!,
      })
    );

    verifySucceeded.current = true;

    if (mode === "signup") {
      router.replace("/auth/complete-profile");
    } else {
      router.replace("/(tabs)");
    }
  }, [dispatch, mode, router]);

  const handleVerify = useCallback(
    async (codeOverride?: string) => {
      const code = (codeOverride ?? otp.join("")).trim();
      if (code.length !== 6) return;
      if (verifyInFlight.current || verifySucceeded.current || loading) return;

      verifyInFlight.current = true;
      setLoading(true);

      try {
        if (mode === "signup") {
          const signupName = name?.trim() || "";
          if (signupName.length < 2) {
            showToast("error", "Name required", "Please enter your name on the sign up screen.");
            router.replace("/auth/register");
            return;
          }
        }

        const signupName = mode === "signup" ? name.trim() : undefined;

        const result = await verifyOtp(phone as string, code, signupName, mode);
        await completeLogin(result);
      } catch (e: unknown) {
        if (verifySucceeded.current) return;
        const msg = e instanceof Error ? e.message : "Please try again";
        showToast("error", "Verification Failed", msg);
        if (mode === "signup" && msg.toLowerCase().includes("already registered")) {
          setTimeout(() => router.replace({ pathname: "/auth/login", params: { phone } }), 1200);
        }
        if (mode === "login" && msg.toLowerCase().includes("sign up")) {
          setTimeout(() => router.replace({ pathname: "/auth/register", params: { phone } }), 1200);
        }
      } finally {
        verifyInFlight.current = false;
        if (!verifySucceeded.current) {
          setLoading(false);
        }
      }
    },
    [completeLogin, loading, mode, name, otp, phone, router]
  );

  const handleChange = (text: string, i: number) => {
    const numericText = text.replace(/[^0-9]/g, "");
    if (text && !numericText) return;

    if (numericText.length > 1) {
      const next = splitOtpDigits(numericText);
      setOtp(next);
      const joined = next.join("");
      if (joined.length === 6) {
        Keyboard.dismiss();
        void handleVerify(joined);
      } else {
        inputs.current[joined.length]?.focus();
      }
      return;
    }

    const copy = [...otp];
    copy[i] = numericText.slice(-1);
    setOtp(copy);

    if (numericText && i < 5) {
      inputs.current[i + 1]?.focus();
    }

    const joined = copy.join("");
    if (joined.length === 6) {
      Keyboard.dismiss();
      void handleVerify(joined);
    }
  };

  const handleResend = async () => {
    if (loading || sendingOtp || verifyInFlight.current) return;
    setLoading(true);
    try {
      await sendOtp(phone as string, { resend: true, mode });
      setOtp(["", "", "", "", "", ""]);
      setTimer(OTP_RESEND_COOLDOWN_SECONDS);
      verifySucceeded.current = false;
      inputs.current[0]?.focus();
    } catch {
      showToast("error", "Error", "Resend failed");
    } finally {
      setLoading(false);
    }
  };

  const otpComplete = otp.join("").length === 6;
  const verifyDisabled = !otpComplete || loading || sendingOtp;

  return (
    <View style={styles.container}>
      <LottieView
        source={require("../../assets/animations/OTP-Verification.json")}
        autoPlay
        loop
        style={styles.lottieHero}
      />

      <Text style={[styles.title, { fontFamily: Fonts.bold }]}>{MOBILE_COPY.auth.otpTitle}</Text>
      <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>
        Enter the 6-digit code sent to
      </Text>

      <Text style={[styles.subtitle, { color: Colors.PRIMARY, fontFamily: Fonts.medium }]}>
        +91 {phone}
      </Text>

      {sendingOtp ? (
        <View style={styles.sendingRow}>
          <ActivityIndicator color={Colors.PRIMARY} size="small" />
          <Text style={[styles.sendingText, { fontFamily: Fonts.regular }]}>
            Sending OTP…
          </Text>
        </View>
      ) : null}

      <View style={styles.otpContainer}>
        {otp.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => {
              inputs.current[i] = r;
            }}
            style={[styles.input, { borderColor: d ? Colors.PRIMARY : Colors.BORDER }]}
            keyboardType="number-pad"
            maxLength={6}
            value={d}
            onChangeText={(t) => handleChange(t, i)}
            editable={!loading && !verifySucceeded.current}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, verifyDisabled && styles.buttonDisabled]}
        onPress={() => handleVerify()}
        disabled={verifyDisabled}
      >
        {loading ? (
          <ActivityIndicator color={Colors.WHITE} />
        ) : (
          <Text style={[styles.buttonText, { fontFamily: Fonts.semibold }]}>
            {mode === "signup" ? "Verify & Continue" : "Verify & Sign In"}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.hint, { fontFamily: Fonts.regular }]}>
        {loading ? "Verifying… please wait, do not tap again." : "Code auto-submits when all 6 digits are entered."}
      </Text>

      <TouchableOpacity
        style={styles.resendContainer}
        onPress={handleResend}
        disabled={timer > 0 || loading || sendingOtp}
      >
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
  sendingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
  sendingText: { fontSize: 14, color: Colors.TEXT_MUTED },
  otpContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40, gap: 8 },
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
  button: {
    height: 56,
    backgroundColor: Colors.PRIMARY,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { backgroundColor: Colors.BORDER },
  buttonText: { color: Colors.WHITE, fontSize: 18 },
  hint: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.TEXT_MUTED,
    textAlign: "center",
  },
  resendContainer: { marginTop: 24, alignItems: "center" },
  resendText: { fontSize: 15, fontWeight: "600" },
});
