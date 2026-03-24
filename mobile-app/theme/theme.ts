/**
 * @file Theme.ts
 * @description Native-first design tokens. No web-bloat.
 */

export const Colors = {
  PRIMARY: '#4b6f9e',
  PRIMARY_SOFT: '#e9f0f8',
  PRIMARY_TEXT: '#2c3e50',
  BORDER: '#dbe4ef',
  BG: '#f6f9fc',
  TEXT_MUTED: '#7b8a9a',
  WHITE: '#ffffff',
  SUCCESS: '#10b981', // Added for orders/cart
  ERROR: '#ef4444'    // Added for validation
};

export const Fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold'
};

// Pure style objects for React Native StyleSheet.create()
export const TextStyles = {
  headerLarge: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.PRIMARY_TEXT,
    lineHeight: 32,
  },
  headerMedium: {
    fontFamily: Fonts.semibold,
    fontSize: 18,
    color: Colors.PRIMARY_TEXT,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.TEXT_MUTED,
  },
  caption: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.TEXT_MUTED,
  }
};