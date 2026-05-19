import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors, Fonts } from "@/theme/theme";
import { StoreLogo } from '@/src/components/StoreLogo';
import { saveTenantId } from "@/src/utils/tenantStorage";
import { ACTIVE_API_URL } from "@/src/config/constants";

export default function StoreCodeEntry() {
  const router = useRouter();

  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 4) {
      setError("Please enter a valid 4-character store code");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${ACTIVE_API_URL}/api/tenant/by-code/${trimmed}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Invalid store code");
        return;
      }

      await saveTenantId(data.tenantId);
      router.replace("/auth/landing");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <StoreLogo layout="stack" size={72} style={styles.brandMark} />
        <Text style={[styles.title, { fontFamily: Fonts.bold }]}>Enter Store Code</Text>
        <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>
          Ask your store for a 4-character code, or scan the QR at the counter.
        </Text>

        <TextInput
          style={[styles.input, { fontFamily: Fonts.semibold }]}
          value={code}
          onChangeText={(t) => {
            setError("");
            setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4));
          }}
          placeholder="ABCD"
          placeholderTextColor={Colors.TEXT_MUTED}
          autoCapitalize="characters"
          maxLength={4}
          keyboardType="default"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {error !== "" && (
          <Text style={[styles.error, { fontFamily: Fonts.regular }]}>{error}</Text>
        )}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.WHITE} />
          ) : (
            <Text style={[styles.btnText, { fontFamily: Fonts.semibold }]}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={[styles.backText, { fontFamily: Fonts.regular }]}>← Back</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  brandMark: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    color: Colors.PRIMARY_TEXT,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.TEXT_MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  input: {
    width: "100%",
    height: 64,
    borderWidth: 2,
    borderColor: Colors.BORDER,
    borderRadius: 14,
    textAlign: "center",
    fontSize: 28,
    letterSpacing: 10,
    color: Colors.PRIMARY_TEXT,
    backgroundColor: Colors.BG,
    marginBottom: 12,
  },
  error: {
    color: Colors.ERROR,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  btn: {
    width: "100%",
    height: 56,
    backgroundColor: Colors.PRIMARY,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    elevation: 4,
    shadowColor: Colors.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: Colors.WHITE,
    fontSize: 18,
  },
  backBtn: {
    marginTop: 24,
    padding: 8,
  },
  backText: {
    color: Colors.TEXT_MUTED,
    fontSize: 14,
  },
});
