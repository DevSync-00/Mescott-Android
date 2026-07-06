import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Linking } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOT_ID = process.env.EXPO_PUBLIC_TELEGRAM_BOT_ID || '';

function generateNonce(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function buildAuthUrl(nonce: string): string {
  // Use the widget page — this renders just the "Log in with Telegram" button
  // with no phone number form. The button opens the Telegram app directly.
  return (
    `https://oauth.telegram.org/auth` +
    `?bot_id=${BOT_ID}` +
    `&origin=https%3A%2F%2Foauth.telegram.org` +
    `&return_to=https%3A%2F%2Foauth.telegram.org%2Fauth%2Fcallback` +
    `&request_access=write` +
    `&embed=1` +
    `&nonce=${nonce}`
  );
}

function decodeTgAuthResult(raw: string): Record<string, any> {
  const str = raw.split('&')[0];
  try {
    const urlDecoded = decodeURIComponent(str);
    if (urlDecoded.trimStart().startsWith('{')) return JSON.parse(urlDecoded);
  } catch (_) {}

  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
  const decoded = atob(padded);
  const json = decodeURIComponent(
    decoded.split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  );
  return JSON.parse(json);
}

// Injected JS that:
// 1. Hides ALL of Telegram's default UI text (the form header, instructions, domain name, bot name links)
// 2. Styles the single login button to match Mescott's design
// 3. Intercepts the auth result hash as before
const INJECTED_JS = `
(function() {

  // ── Intercept auth result ──────────────────────────────────────────────
  function checkHash(url) {
    var match = url.match(/#tgAuthResult=([^&]*)/);
    if (match && match[1]) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ tgAuthResult: match[1] }));
    }
  }

  var origPush = history.pushState.bind(history);
  history.pushState = function(state, title, url) {
    origPush(state, title, url);
    if (url) checkHash(String(url));
  };
  window.addEventListener('hashchange', function() { checkHash(window.location.href); });
  checkHash(window.location.href);

  // ── Hide noisy UI and re-skin the button ──────────────────────────────
  var style = document.createElement('style');
  style.textContent = \`
    /* Hide the header block: icons, title text, instruction paragraph */
    .tgme_widget_login_wrap > .tgme_widget_login_header,
    .tgme_widget_login_wrap > p,
    .tgme_widget_login_wrap > .tgme_widget_login_row:not(:last-child),
    .tgme_widget_login > .tgme_widget_login_header,
    .tgme_widget_login > p,
    .widget_login_header,
    .widget_login_description,
    .tgme_widget_login_icon,
    .tgme_widget_login_row.tgme_widget_login_row_phone {
      display: none !important;
    }

    /* Center just the button */
    body, html { background: #ffffff !important; margin: 0; padding: 0; }
    .tgme_widget_login_wrap, .tgme_widget_login {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      min-height: 100vh !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    /* Style the login button to match Mescott */
    .tgme_widget_login_btn,
    a[href*="tg://"],
    .tgme_widget_login_button {
      background: #229ED9 !important;
      color: #ffffff !important;
      border-radius: 25px !important;
      border: none !important;
      padding: 14px 40px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      font-family: -apple-system, sans-serif !important;
      text-decoration: none !important;
      display: inline-block !important;
      min-width: 220px !important;
      text-align: center !important;
      cursor: pointer !important;
    }

    /* Hide everything else that isn't the button row */
    .tgme_widget_login_wrap > *:not(.tgme_widget_login_row:last-child) {
      display: none !important;
    }
  \`;
  document.head.appendChild(style);

  // Re-apply after DOM settles (Telegram renders async)
  setTimeout(function() { document.head.appendChild(style.cloneNode(true)); }, 800);
  setTimeout(function() { document.head.appendChild(style.cloneNode(true)); }, 1800);

  true;
})();
`;

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginScreenProps {
  onAuthResult: (data: TelegramAuthData) => void;
  onCancel?: () => void;
}

export default function TelegramLoginScreen({ onAuthResult, onCancel }: TelegramLoginScreenProps) {
  const [nonce, setNonce] = useState<string>(generateNonce);
  const [webViewKey, setWebViewKey] = useState<string>('tg-webview-initial');
  const [loading, setLoading] = useState(true);
  const resolvedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem('webview_reset_key').then((val) => {
      if (val) {
        setWebViewKey(`reset-${val}`);
        setNonce(generateNonce());
      }
    });
  }, []);

  function tryExtractResult(url: string): void {
    if (resolvedRef.current) return;
    const match = url.match(/#tgAuthResult=([^&\s]*)/);
    if (!match || !match[1]) return;
    try {
      const data = decodeTgAuthResult(match[1]) as TelegramAuthData;
      if (data?.hash) {
        resolvedRef.current = true;
        onAuthResult(data);
      }
    } catch (err) {
      console.warn('[TelegramLoginScreen] Failed to decode tgAuthResult:', err);
    }
  }

  function handleNavigationStateChange(navState: WebViewNavigation): void {
    if (navState.url) tryExtractResult(navState.url);
  }

  function handleShouldStartLoad(request: { url: string }): boolean {
    // Let tg:// deep links open the Telegram app natively
    if (request.url.startsWith('tg://')) {
      Linking.openURL(request.url).catch(() => {});
      return false;
    }
    tryExtractResult(request.url);
    return true;
  }

  function handleMessage(event: { nativeEvent: { data: string } }): void {
    if (resolvedRef.current) return;
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg?.tgAuthResult) {
        const data = decodeTgAuthResult(msg.tgAuthResult) as TelegramAuthData;
        if (data?.hash) {
          resolvedRef.current = true;
          onAuthResult(data);
        }
      }
    } catch (err) {
      console.warn('[TelegramLoginScreen] postMessage parse error:', err);
    }
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#229ED9" />
        </View>
      )}
      <WebView
        key={webViewKey}
        source={{ uri: buildAuthUrl(nonce) }}
        incognito={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        injectedJavaScript={INJECTED_JS}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});