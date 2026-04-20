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
import { Colors, Fonts } from "@/theme/theme";
import { sendOtp } from "@/api/authApi";
import { showToast } from "@/utils/toast";

export default function Login() {
    const router = useRouter();
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
                <LottieView
                  source={require('../../assets/animations/Cyber Security.json')}
                  autoPlay
                  loop
                  style={styles.lottieHero}
                />
          
                <Text style={[styles.title, { fontFamily: Fonts.bold }]}>
                  Welcome Back
                </Text>
          
                <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>
                  Enter your phone number to continue
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
                    New here? Create account
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          );
}

const styles = StyleSheet.create({
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
