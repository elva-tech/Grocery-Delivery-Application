import Toast from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Production toast notification system
 * MilkBasket-style UX:
 * - Non-blocking
 * - Icon + text
 * - Auto dismiss
 * - No modal
 * - No interruption
 */
export const showToast = (
  type: ToastType,
  title: string,
  message?: string
) => {
  Toast.show({
    type,                // success | error | info | warning
    text1: title,
    text2: message,
    position: 'bottom',
    visibilityTime: 2500,
    autoHide: true,
    bottomOffset: 60,
  });
};

// Usage examples:
// showToast('success', 'Added', 'Item added to cart')
// showToast('error', 'Failed', 'Something went wrong')
// showToast('info', 'Note', 'Feature coming soon')
// showToast('warning', 'Warning', 'Check your input')
