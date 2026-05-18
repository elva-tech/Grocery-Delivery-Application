import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';

import { useTenantBranding } from '@/contexts/TenantBrandingContext';
import { splitBrandWords, storeInitials } from '@/src/utils/brandWords';
import { Colors } from '@/theme/theme';

const BRAND_BLUE = '#4b6f9e';

export type StoreLogoLayout = 'mark' | 'header' | 'stack' | 'splash';

export type StoreLogoProps = {
  size?: number;
  layout?: StoreLogoLayout;
  style?: StyleProp<ViewStyle>;
  showTagline?: boolean;
};

function BrandNameText({
  storeName,
  variant,
}: {
  storeName: string;
  variant: 'header' | 'stack' | 'splash';
}) {
  const { head, tail } = splitBrandWords(storeName);
  const nameStyle =
    variant === 'splash'
      ? styles.splashName
      : variant === 'stack'
        ? styles.stackName
        : styles.headerName;

  return (
    <Text style={nameStyle} numberOfLines={2}>
      {head}
      {tail ? <Text style={styles.nameAccent}>{tail}</Text> : null}
    </Text>
  );
}

export function StoreLogo({
  size = 48,
  layout = 'mark',
  style,
  showTagline = false,
}: StoreLogoProps) {
  const { storeName, logoUri, tagline, loading } = useTenantBranding();
  const borderRadius = Math.round(size * 0.28);
  const showLoader = loading && !logoUri && !storeName;

  const mark = showLoader ? (
    <View style={[styles.markBox, { width: size, height: size, borderRadius }]}>
      <ActivityIndicator size="small" color={Colors.PRIMARY} />
    </View>
  ) : logoUri ? (
    <Image
      source={{ uri: logoUri }}
      style={[styles.markImage, { width: size, height: size, borderRadius }]}
      contentFit="contain"
    />
  ) : (
    <View style={[styles.fallbackMark, { width: size, height: size, borderRadius }]}>
      <Text style={[styles.fallbackInitials, { fontSize: Math.max(14, size * 0.34) }]}>
        {storeInitials(storeName)}
      </Text>
    </View>
  );

  if (layout === 'mark') {
    return <View style={style}>{mark}</View>;
  }

  if (layout === 'splash') {
    return (
      <View style={[styles.splashWrap, style]}>
        {mark}
        <BrandNameText storeName={storeName} variant="splash" />
        {showTagline && tagline ? (
          <Text style={styles.tagline} numberOfLines={2}>
            {tagline}
          </Text>
        ) : null}
      </View>
    );
  }

  if (layout === 'stack') {
    return (
      <View style={[styles.stackWrap, style]}>
        {mark}
        <BrandNameText storeName={storeName} variant="stack" />
        {showTagline && tagline ? (
          <Text style={styles.stackTagline} numberOfLines={1}>
            {tagline}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.headerRow, style]}>
      {mark}
      <View style={styles.headerTextCol}>
        <BrandNameText storeName={storeName} variant="header" />
        {showTagline && tagline ? (
          <Text style={styles.tagline} numberOfLines={1}>
            {tagline}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  markBox: {
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  markImage: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fallbackMark: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackInitials: {
    fontWeight: '900',
    color: BRAND_BLUE,
    letterSpacing: -0.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  nameAccent: {
    color: BRAND_BLUE,
  },
  stackWrap: {
    alignItems: 'center',
  },
  stackName: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  stackTagline: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: BRAND_BLUE,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  splashWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  splashName: {
    marginTop: 20,
    fontSize: 26,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '800',
    color: BRAND_BLUE,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.65,
  },
});
