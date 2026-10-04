import { useEffect, useState } from 'react';
import { Linking, Modal, NativeModules, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

export type CashfreeCheckoutMode = 'sandbox' | 'production';
type CashfreeCheckoutResult = 'SUCCESS' | 'FAILED' | 'CANCELLED';

type WebCheckoutRequest = {
  paymentSessionId: string;
  environment: CashfreeCheckoutMode;
  resolve: (result: CashfreeCheckoutResult) => void;
};

const ONLINE_UNAVAILABLE = 'Online payment is unavailable in this build.';

let webCheckoutRequest: WebCheckoutRequest | null = null;
const webCheckoutListeners = new Set<(request: WebCheckoutRequest | null) => void>();

function publishWebCheckout(request: WebCheckoutRequest | null) {
  webCheckoutRequest = request;
  webCheckoutListeners.forEach((listener) => listener(request));
}

function isExpoGo(): boolean {
  try {
    const constantsModule = require('expo-constants');
    const constants = constantsModule.default ?? constantsModule;
    return constants?.appOwnership === 'expo' || constants?.expoGoConfig != null;
  } catch {
    return false;
  }
}

function cashfreeNativeModulePresent(): boolean {
  if (Platform.OS === 'web' || isExpoGo()) return false;
  try {
    const modules = NativeModules as Record<string, unknown>;
    if (modules.CashfreePgApi == null) return false;
    if (Platform.OS === 'ios' && modules.CashfreeEventEmitter == null) return false;
    return true;
  } catch {
    return false;
  }
}

function openCashfreeWebCheckout(input: {
  paymentSessionId: string;
  environment: CashfreeCheckoutMode;
}): Promise<CashfreeCheckoutResult> {
  return new Promise((resolve) => {
    publishWebCheckout({
      paymentSessionId: input.paymentSessionId,
      environment: input.environment,
      resolve,
    });
  });
}

function checkoutHtml(paymentSessionId: string, environment: CashfreeCheckoutMode) {
  const session = JSON.stringify(paymentSessionId);
  const mode = JSON.stringify(environment);
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>html,body{margin:0;height:100%;background:#fff;}</style>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
</head>
<body>
<script>
  function report(status, detail) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ status: status, detail: detail || "" }));
    }
  }
  try {
    var cashfree = Cashfree({ mode: ${mode} });
    cashfree.checkout({
      paymentSessionId: ${session},
      redirectTarget: "_modal"
    }).then(function (result) {
      if (result && result.error) {
        var message = String(result.error.message || result.error.code || "");
        report(/cancel|abort/i.test(message) ? "CANCELLED" : "FAILED", message);
        return;
      }
      if (result && result.paymentDetails) {
        report("SUCCESS");
      }
    }).catch(function (error) {
      report("FAILED", error && error.message ? error.message : "Cashfree checkout failed");
    });
  } catch (error) {
    report("FAILED", error && error.message ? error.message : "Cashfree checkout failed");
  }
</script>
</body>
</html>`;
}

function isUpiIntent(url: string) {
  return /^(upi|tez|gpay|phonepe|paytmmp|bhim|credpay):/i.test(url);
}

function isCashfreeReturn(url: string) {
  return /thankyou|txStatus=SUCCESS|order_status=PAID|payment_status=SUCCESS/i.test(url);
}

export function CashfreeCheckoutHost() {
  const [request, setRequest] = useState<WebCheckoutRequest | null>(webCheckoutRequest);

  useEffect(() => {
    const listener = (next: WebCheckoutRequest | null) => setRequest(next);
    webCheckoutListeners.add(listener);
    return () => {
      webCheckoutListeners.delete(listener);
    };
  }, []);

  const finish = (result: CashfreeCheckoutResult) => {
    const active = webCheckoutRequest;
    if (!active) return;
    publishWebCheckout(null);
    active.resolve(result);
  };

  const onNavigation = (nav: WebViewNavigation) => {
    if (isCashfreeReturn(nav.url || '')) finish('SUCCESS');
  };

  return (
    <Modal visible={request != null} animationType="slide" onRequestClose={() => finish('CANCELLED')}>
      <View style={styles.screen}>
        <View style={styles.bar}>
          <Text style={styles.title}>Pay online</Text>
          <Pressable onPress={() => finish('CANCELLED')} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        {request ? (
          <WebView
            style={styles.web}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            source={{
              html: checkoutHtml(request.paymentSessionId, request.environment),
              baseUrl: request.environment === 'production'
                ? 'https://www.enandi.online/'
                : 'https://sandbox.cashfree.com/',
            }}
            onNavigationStateChange={onNavigation}
            onShouldStartLoadWithRequest={(event) => {
              if (isUpiIntent(event.url)) {
                Linking.openURL(event.url).catch(() => undefined);
                return false;
              }
              if (isCashfreeReturn(event.url)) finish('SUCCESS');
              return true;
            }}
            onMessage={(event) => {
              try {
                const payload = JSON.parse(event.nativeEvent.data) as { status?: CashfreeCheckoutResult };
                if (payload.status === 'SUCCESS' || payload.status === 'FAILED' || payload.status === 'CANCELLED') {
                  finish(payload.status);
                }
              } catch {
                finish('FAILED');
              }
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * Opens Cashfree checkout. Expo Go has no Cashfree native module, so it uses
 * Cashfree's web checkout inside the app. A dev build uses the native SDK.
 */
export function startCashfreeCheckout(input: {
  paymentSessionId: string;
  orderId: string;
  environment: CashfreeCheckoutMode;
}): Promise<CashfreeCheckoutResult> {
  if (!cashfreeNativeModulePresent()) {
    return openCashfreeWebCheckout(input);
  }

  return new Promise((resolve, reject) => {
    let CFPaymentGatewayService: {
      setCallback: (callback: {
        onVerify: (orderID: string) => void;
        onError: (error: { getMessage?: () => string; getCode?: () => string }, orderID: string) => void;
      }) => void;
      removeCallback: () => void;
      doWebPayment: (session: unknown) => void;
    };
    let CFSession: new (sessionId: string, orderId: string, environment: string) => unknown;
    let CFEnvironment: { PRODUCTION: string; SANDBOX: string };

    try {
      CFPaymentGatewayService = require('react-native-cashfree-pg-sdk').CFPaymentGatewayService;
      const contract = require('cashfree-pg-api-contract');
      CFSession = contract.CFSession;
      CFEnvironment = contract.CFEnvironment;
    } catch {
      reject(new Error(ONLINE_UNAVAILABLE));
      return;
    }

    const finish = (result: CashfreeCheckoutResult) => {
      try {
        CFPaymentGatewayService.removeCallback();
      } catch {
        // The checkout callback is already cleared.
      }
      resolve(result);
    };

    CFPaymentGatewayService.setCallback({
      onVerify() {
        finish('SUCCESS');
      },
      onError(error) {
        const message = String(error?.getMessage?.() || '');
        const code = String(error?.getCode?.() || '');
        const cancelled = /cancel/i.test(message) || /cancel/i.test(code) || code === '0';
        finish(cancelled ? 'CANCELLED' : 'FAILED');
      },
    });

    try {
      const environment =
        input.environment === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
      CFPaymentGatewayService.doWebPayment(
        new CFSession(input.paymentSessionId, input.orderId, environment),
      );
    } catch {
      try {
        CFPaymentGatewayService.removeCallback();
      } catch {
        // Nothing to clear when checkout never opened.
      }
      reject(new Error(ONLINE_UNAVAILABLE));
    }
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 48 : 0 },
  bar: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  close: { fontSize: 16, color: '#4b6f9e', fontWeight: '600' },
  web: { flex: 1 },
});
