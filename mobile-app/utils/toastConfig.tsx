import { BaseToast, ErrorToast } from 'react-native-toast-message';

export const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#4b6f9e' }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      text1Style={{ fontSize: 14, fontWeight: '600', color: '#2c3e50' }}
      text2Style={{ fontSize: 13, color: '#7b8a9a' }}
    />
  ),

  error: (props: any) => (
    <ErrorToast
      {...props}
      text1Style={{ fontSize: 14, fontWeight: '600' }}
      text2Style={{ fontSize: 13, color: '#7b8a9a' }}
    />
  ),

  info: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#5b7eed' }}
      text1Style={{ fontSize: 14, fontWeight: '600' }}
      text2Style={{ fontSize: 13, color: '#7b8a9a' }}
    />
  ),
};
