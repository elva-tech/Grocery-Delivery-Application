import React from "react";

import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { useRouter } from "expo-router";

import { Colors, Fonts } from "@/theme/theme";

import { useTenantBranding } from "@/contexts/TenantBrandingContext";

import { StoreLogo } from '@/src/components/StoreLogo';
import { isCustomerBuild } from '@/src/utils/customer';

export default function Landing() {
  const router = useRouter();
  const { storeName, heroTitle, heroSubtitle } = useTenantBranding();
  const customerBuild = isCustomerBuild();
  return (

    <View style={styles.container}>

      <View style={styles.logoContainer}>

        <StoreLogo layout="mark" size={140} />

      </View>



      <Text style={[styles.title, { fontFamily: Fonts.bold }]}>

        {heroTitle || `Welcome to ${storeName}`}

      </Text>

      <Text style={[styles.subtitle, { fontFamily: Fonts.regular }]}>

        {heroSubtitle}

      </Text>



      <TouchableOpacity

        style={styles.button}

        onPress={() => router.push('/auth/login')}

      >

        <Text style={[styles.buttonText, { fontFamily: Fonts.semibold }]}>Login</Text>

      </TouchableOpacity>



      <TouchableOpacity

        style={[styles.button, { marginTop: 10 }]}

        onPress={() => router.push('/auth/register')}

      >

        <Text style={[styles.buttonText, { fontFamily: Fonts.semibold }]}>Sign Up</Text>

      </TouchableOpacity>

      {!customerBuild ? (
        <TouchableOpacity
          style={styles.storeCodeBtn}
          onPress={() => router.push('/auth/store-code')}
        >
          <Text style={[styles.storeCodeText, { fontFamily: Fonts.regular }]}>
            Enter Store Code
          </Text>
        </TouchableOpacity>
      ) : null}

    </View>

  );

}



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: Colors.WHITE,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 30,

  },

  logoContainer: {

    marginBottom: 24,

    alignItems: 'center',

    justifyContent: 'center',

  },

  title: {

    fontSize: 28,

    color: Colors.PRIMARY_TEXT,

    textAlign: "center",

    marginBottom: 12,

  },

  subtitle: {

    fontSize: 16,

    color: Colors.TEXT_MUTED,

    textAlign: "center",

    marginBottom: 48,

    lineHeight: 22,

  },

  button: {

    width: "100%",

    height: 56,

    backgroundColor: Colors.PRIMARY,

    borderRadius: 16,

    alignItems: "center",

    justifyContent: "center",

    elevation: 4,

    shadowColor: Colors.PRIMARY,

    shadowOffset: { width: 0, height: 4 },

    shadowOpacity: 0.2,

    shadowRadius: 8,

  },

  buttonText: {

    color: Colors.WHITE,

    fontSize: 18,

  },

  storeCodeBtn: {

    marginTop: 24,

    padding: 10,

  },

  storeCodeText: {

    fontSize: 14,

    color: Colors.TEXT_MUTED,

    textDecorationLine: "underline",

  },

});

