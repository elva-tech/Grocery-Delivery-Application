import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, Fonts } from "@/theme/theme";
import { getAddressFromCoordsDetailed } from "@/api/addresses";
import { updateProfile } from "@/api/authApi";
import { showToast } from "@/utils/toast";
import { RootState } from "@/store/store";
import { updateUser } from "@/store/slices/authSlice";

type OnboardingStep = "details" | "address";

export default function CompleteProfile() {
  const router = useRouter();
  const dispatch = useDispatch();
  const authUser = useSelector((state: RootState) => state.auth.user);

  const [step, setStep] = useState<OnboardingStep>("details");
  const [name, setName] = useState(authUser?.name || "");
  const [email, setEmail] = useState(authUser?.email || "");
  const [alternatePhone, setAlternatePhone] = useState(authUser?.alternatePhone || "");
  const [addressInputMode, setAddressInputMode] = useState<"auto" | "manual">("auto");
  /** True when address fields were filled by GPS reverse-geocode (not user typing). */
  const [addressAutoFilled, setAddressAutoFilled] = useState(false);
  const [addressLine, setAddressLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);
  const [detectingAddress, setDetectingAddress] = useState(false);

  const composedAddress = useMemo(() => {
    return [addressLine, landmark, city, stateField, pincode].map(v => String(v || "").trim()).filter(Boolean).join(", ");
  }, [addressLine, landmark, city, stateField, pincode]);

  const goHome = () => {
    router.replace("/(tabs)");
  };

  const persistLocalUser = async (patch: Record<string, any>) => {
    const currentRaw = await AsyncStorage.getItem("user");
    const currentUser = currentRaw ? JSON.parse(currentRaw) : {};
    const nextUser = { ...currentUser, ...patch };
    await AsyncStorage.setItem("user", JSON.stringify(nextUser));
    dispatch(updateUser(patch));
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim(),
        alternatePhone: alternatePhone.trim(),
      });
      await persistLocalUser({
        name: name.trim() || authUser?.name || "",
        email: email.trim(),
        alternatePhone: alternatePhone.trim(),
      });
      setStep("address");
    } catch (error: any) {
      showToast("error", "Profile", error?.message || "Could not save details");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    if (addressLine.trim().length < 2) {
      showToast("error", "Address", "Address line must be at least 2 characters");
      return;
    }
    if (city.trim().length < 2) {
      showToast("error", "Address", "City must be at least 2 characters");
      return;
    }
    if (stateField.trim().length < 2) {
      showToast("error", "Address", "State must be at least 2 characters");
      return;
    }
    if (pincode.trim().length !== 6) {
      showToast("error", "Address", "Please enter a valid 6-digit PIN code");
      return;
    }

    setSaving(true);
    try {
      const profileName = String(name || authUser?.name || "Guest User").trim();
      await updateProfile({
        name: profileName.length >= 2 ? profileName : "Guest User",
        address: composedAddress,
      });
      await persistLocalUser({
        name: profileName.length >= 2 ? profileName : "Guest User",
        address: composedAddress,
      });
      goHome();
    } catch (error: any) {
      showToast("error", "Address", error?.message || "Could not save address");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoDetectAddress = async () => {
    setDetectingAddress(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showToast("error", "Permission", "Location permission is required");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const detailed = await getAddressFromCoordsDetailed(loc.coords.latitude, loc.coords.longitude);
      if (detailed.line1) setAddressLine(detailed.line1);
      if (detailed.city) setCity(detailed.city);
      if (detailed.state) setStateField(detailed.state);
      if (detailed.pincode) setPincode(detailed.pincode);
      setAddressAutoFilled(true);
      showToast("success", "Address detected", "You can edit the details if needed");
    } catch (error: any) {
      showToast("error", "Location", error?.message || "Could not detect address");
    } finally {
      setDetectingAddress(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { fontFamily: Fonts.bold }]}>Complete your profile</Text>
        <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>
          {step === "details" ? "Step 1 of 2 - Personal details" : "Step 2 of 2 - Address details"}
        </Text>

        {step === "details" ? (
          <>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Alternate Mobile Number</Text>
              <TextInput
                style={styles.input}
                value={alternatePhone}
                onChangeText={(text) => setAlternatePhone(text.replace(/[^0-9]/g, "").slice(0, 10))}
                placeholder="Optional"
                keyboardType="number-pad"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => router.back()} disabled={saving}>
                <Text style={styles.outlineText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, styles.inlinePrimaryBtn]} onPress={handleSaveDetails} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Next</Text>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep("address")} disabled={saving}>
              <Text style={styles.secondaryText}>Skip</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.modeWrap}>
              <TouchableOpacity
                style={[styles.modeBtn, addressInputMode === "auto" && styles.modeBtnActive]}
                onPress={() => setAddressInputMode("auto")}
              >
                <Text style={[styles.modeBtnText, addressInputMode === "auto" && styles.modeBtnTextActive]}>Auto Detect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, addressInputMode === "manual" && styles.modeBtnActive]}
                onPress={() => {
                  setAddressInputMode("manual");
                  setAddressAutoFilled(false);
                }}
              >
                <Text style={[styles.modeBtnText, addressInputMode === "manual" && styles.modeBtnTextActive]}>Manual Entry</Text>
              </TouchableOpacity>
            </View>

            {addressInputMode === "auto" ? (
              <TouchableOpacity style={styles.detectBtn} onPress={handleAutoDetectAddress} disabled={detectingAddress}>
                {detectingAddress ? (
                  <ActivityIndicator color={Colors.PRIMARY} />
                ) : (
                  <Text style={styles.detectBtnText}>Use Current Location</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Address Line 1</Text>
              <TextInput
                style={styles.input}
                value={addressLine}
                onChangeText={setAddressLine}
                placeholder="House / Building / Street"
                placeholderTextColor="#94a3b8"
                editable={addressInputMode === "manual" || !addressAutoFilled}
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Landmark</Text>
              <TextInput
                style={styles.input}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Near..."
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor="#94a3b8"
                editable={addressInputMode === "manual" || !addressAutoFilled}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={styles.input}
                  value={stateField}
                  onChangeText={setStateField}
                  placeholder="State"
                  placeholderTextColor="#94a3b8"
                  editable={addressInputMode === "manual" || !addressAutoFilled}
                />
              </View>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Text style={styles.inputLabel}>PIN Code</Text>
                <TextInput
                  style={styles.input}
                  value={pincode}
                  onChangeText={(text) => setPincode(text.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                placeholder="6-digit PIN code"
                  placeholderTextColor="#94a3b8"
                  editable={addressInputMode === "manual" || !addressAutoFilled}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (addressLine.trim().length < 2 || city.trim().length < 2 || stateField.trim().length < 2 || pincode.trim().length !== 6) && { opacity: 0.7 },
              ]}
              onPress={handleSaveAddress}
              disabled={saving || addressLine.trim().length < 2 || city.trim().length < 2 || stateField.trim().length < 2 || pincode.trim().length !== 6}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save and Finish</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={goHome} disabled={saving}>
              <Text style={styles.secondaryText}>Skip</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.WHITE },
  container: { flexGrow: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 26, color: Colors.PRIMARY_TEXT, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.TEXT_MUTED, marginBottom: 24 },
  inputWrapper: { marginBottom: 14 },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.PRIMARY_TEXT, marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.BG,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    color: Colors.PRIMARY_TEXT,
  },
  row: { flexDirection: "row", gap: 10 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  outlineBtn: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.WHITE,
  },
  outlineText: { color: Colors.PRIMARY_TEXT, fontSize: 16, fontFamily: Fonts.semibold },
  modeWrap: { flexDirection: "row", gap: 10, marginBottom: 14 },
  modeBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.BG,
  },
  modeBtnActive: { backgroundColor: Colors.PRIMARY, borderColor: Colors.PRIMARY },
  modeBtnText: { color: Colors.TEXT_MUTED, fontSize: 13, fontFamily: Fonts.semibold },
  modeBtnTextActive: { color: Colors.WHITE },
  detectBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  detectBtnText: { color: Colors.PRIMARY, fontSize: 14, fontFamily: Fonts.semibold },
  primaryBtn: {
    marginTop: 12,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  inlinePrimaryBtn: { flex: 1, marginTop: 0 },
  primaryText: { color: Colors.WHITE, fontSize: 16, fontFamily: Fonts.semibold },
  secondaryBtn: { marginTop: 12, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  secondaryText: { color: Colors.PRIMARY, fontSize: 14, fontFamily: Fonts.medium },
});
