import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { Image } from "expo-image";
import { Colors, Fonts } from "@/theme/theme";
import { sendOtp } from "@/api/authApi";
import { showToast } from "@/utils/toast";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { MOBILE_COPY } from "@/src/constants/copy";

export default function Login() {
    const router = useRouter();
    const { storeName, logoUri } = useTenantBranding();
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);

    const indiaRegex = /^[6-9]\d{9}$/;
    const isValid = indiaRegex.test(phone);

    const handleNext = async () => {
        if (!isValid || loading) return;

        try {
            setLoading(true);

            await sendOtp(phone);

            router.push({
                pathname: "/auth/otp",
                params: {
                    phone,
                    mode: "login"
                }
            });

        } catch (error: any) {
            showToast("error", "Error", error?.message || "Failed to send OTP");
        } finally {
            setLoading(false);
        }


    };
        return (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <ScrollView contentContainerStyle={styles.container} bounces={false}>
                <View style={styles.brandRow}>
                  <Image
                    source={logoUri ? { uri: logoUri } : require('../../assets/logo-2.png')}
                    style={styles.brandLogo}
                    contentFit="contain"
                  />
                  <Text style={[styles.brandName, { fontFamily: Fonts.bold }]} numberOfLines={1}>
                    {storeName}
                  </Text>
                </View>
                <LottieView
                  source={require('../../assets/animations/truck.json')}
                  autoPlay
                  loop
                  style={styles.lottieHero}
                />
          
                <Text style={[styles.title, { fontFamily: Fonts.bold }]}>
                  Welcome Back
                </Text>
          
                <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>
                  {MOBILE_COPY.auth.loginSubtitle}
                </Text>
          
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
                      onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ""))}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
          
                <TouchableOpacity
                  style={[
                    styles.button,
                    (!isValid || loading) && styles.buttonDisabled
                  ]}
                  onPress={handleNext}
                  disabled={!isValid || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.buttonText, { fontFamily: Fonts.semibold }]}>
                      Send OTP
                    </Text>
                  )}
                </TouchableOpacity>
          
                <TouchableOpacity
                  style={{ marginTop: 20 }}
                  onPress={() => router.push("/auth/register")}
                >
                  <Text style={styles.switchText}>
                    {MOBILE_COPY.auth.createAccountCta}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          );
}

const styles = StyleSheet.create({
    brandRow: {
        alignItems: "center",
        marginBottom: 8,
    },
    brandLogo: {
        width: 64,
        height: 64,
        borderRadius: 14,
        marginBottom: 6,
    },
    brandName: {
        fontSize: 16,
        color: Colors.PRIMARY_TEXT,
        textAlign: "center",
        maxWidth: "100%",
    },
    container: {
        flexGrow: 1,
        backgroundColor: Colors.WHITE,
        padding: 24,
        justifyContent: "center"
    },
    lottieHero: {
        width: 250,
        height: 200,
        alignSelf: "center",
        marginBottom: 10
    },
    title: {
        fontSize: 26,
        color: Colors.PRIMARY_TEXT,
        marginBottom: 8
    },
    subtitle: {
        fontSize: 15,
        color: Colors.TEXT_MUTED,
        marginBottom: 32
    },
    inputWrapper: {
        marginBottom: 20
    },
    inputLabel: {
        fontFamily: Fonts.medium,
        fontSize: 14,
        color: Colors.PRIMARY_TEXT,
        marginBottom: 8
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    countryCodeBox: {
        height: 52,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: Colors.BG,
        justifyContent: "center",
        marginRight: 8,
        borderWidth: 1,
        borderColor: Colors.BORDER
    },
    countryCodeText: {
        fontSize: 16,
        fontWeight: "600"
    },
    input: {
        height: 52,
        borderRadius: 12,
        backgroundColor: Colors.BG,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Colors.BORDER
    },
    button: {
        height: 56,
        backgroundColor: Colors.PRIMARY,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 20
    },
    buttonDisabled: {
        backgroundColor: "#cbd5e1"
    },
    buttonText: {
        color: Colors.WHITE,
        fontSize: 18
    },
    switchText: {
        color: Colors.PRIMARY,
        textAlign: "center",
        fontSize: 14,
        fontFamily: Fonts.medium
    }
});
