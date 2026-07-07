import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Linking } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOT_ID = process.env.EXPO_PUBLIC_TELEGRAM_BOT_ID || '';

function generateNonce(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function buildAuthUrl(nonce: string): string {
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
  // Strip any trailing query/hash suffix — keep only the token itself
  const str = raw.split(/[&#]/)[0];
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

const INJECTED_JS = `
(function() {
  var resolved = false;

  function checkUrlForAuth() {
    if (resolved) return;
    var currentUrl = window.location.href;
    // Match BOTH hash (#tgAuthResult=) and query (?tgAuthResult=) patterns
    var match = currentUrl.match(/[#?&]tgAuthResult=([^&#\\s]*)/);
    if (match && match[1]) {
      resolved = true;
      clearInterval(urlInterval);
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'tgAuthResult', data: match[1] })
      );
    }
  }

  // 1. Intercept SPA-style history mutations (Android Chrome doesn't always fire events)
  var origPush = history.pushState;
  if (origPush) {
    history.pushState = function() {
      origPush.apply(this, arguments);
      checkUrlForAuth();
    };
  }
  var origReplace = history.replaceState;
  if (origReplace) {
    history.replaceState = function() {
      origReplace.apply(this, arguments);
      checkUrlForAuth();
    };
  }

  // 2. Standard window event listeners
  window.addEventListener('hashchange', checkUrlForAuth);
  window.addEventListener('popstate', checkUrlForAuth);

  // 3. Aggressive 250ms polling fallback — bulletproof on Android Chrome WebView
  var urlInterval = setInterval(checkUrlForAuth, 250);

  // 4. Cleanup interval on page unload
  window.addEventListener('unload', function() { clearInterval(urlInterval); });

  // 5. Run immediately in case we are already on the result page
  checkUrlForAuth();

  // 6. Base styles — white background for seamless integration
  var style = document.createElement('style');
  style.innerHTML = [
    'body, html { background-color: #ffffff !important; background: #ffffff !important; margin: 0; padding: 0; }',
    '.tgme_widget_login_page { background-color: #ffffff !important; }',
    // When the confirmation row is visible, hide the phone row to prevent dual-state overlap
    '.tgme_widget_login_row_phone_sent ~ .tgme_widget_login_row_phone { display: none !important; }',
    // Also hide any leftover action rows (Cancel/Continue) once in confirmation step
    '.tgme_widget_login_row_phone_sent ~ .tgme_widget_login_row_actions { display: none !important; }'
  ].join(' ');
  document.head.appendChild(style);

  // 7. MutationObserver: dynamically hide phone step when confirmation step appears
  //    (Telegram widget transitions via class changes, not page navigation)
  var observer = new MutationObserver(function() {
    var sentRow = document.querySelector('.tgme_widget_login_row_phone_sent');
    var phoneRow = document.querySelector('.tgme_widget_login_row_phone');
    var actionsRow = document.querySelector('.tgme_widget_login_row_actions');
    if (sentRow) {
      // Confirmation step is now active — collapse phone step elements
      if (phoneRow) phoneRow.style.display = 'none';
      if (actionsRow) actionsRow.style.display = 'none';
    } else {
      // Back to phone entry — restore visibility
      if (phoneRow) phoneRow.style.display = '';
      if (actionsRow) actionsRow.style.display = '';
    }
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });

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
}

export default function TelegramLoginScreen({ onAuthResult }: TelegramLoginScreenProps) {
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
    if (!url) return;
    // Match BOTH hash (#tgAuthResult=) and query (?tgAuthResult=) patterns
    const match = url.match(/[#?]tgAuthResult=([^&#\s]*)/);
    if (!match || !match[1]) return;
    try {
      const data = decodeTgAuthResult(match[1]) as TelegramAuthData;
      if (data?.hash) {
        console.log('[TelegramLoginScreen] Auth result intercepted via URL change!');
        resolvedRef.current = true;
        onAuthResult(data);
      }
    } catch (err) {
      console.warn('[TelegramLoginScreen] Failed to decode tgAuthResult from URL:', err);
    }
  }

  function handleNavigationStateChange(navState: WebViewNavigation): void {
    if (navState.url) tryExtractResult(navState.url);
  }

  function handleShouldStartLoad(request: { url: string }): boolean {
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
      // Handle both postMessage shapes Telegram can emit:
      //   { type: 'tgAuthResult', data: '<token>' }  — from our INJECTED_JS
      //   { tgAuthResult: '<token>' }                — from Telegram's own widget JS
      const rawToken: string | undefined =
        (msg?.type === 'tgAuthResult' && msg?.data) ? msg.data :
        msg?.tgAuthResult ? msg.tgAuthResult :
        undefined;
      if (rawToken) {
        const data = decodeTgAuthResult(rawToken) as TelegramAuthData;
        if (data?.hash) {
          console.log('[TelegramLoginScreen] Auth result intercepted via postMessage!');
          resolvedRef.current = true;
          onAuthResult(data);
        }
      }
    } catch (_) {
      // Suppress non-critical structural parse noise from other postMessage senders
    }
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#371F80" />
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
  container: { flex: 1, width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
  webview: { flex: 1, width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
