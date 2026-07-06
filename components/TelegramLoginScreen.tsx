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
  // Helper: extract tgAuthResult from EITHER hash or query string and post to RN
  function scanAndPost() {
    var full = window.location.href;
    var match = full.match(/[#?]tgAuthResult=([^&#\\s]*)/);
    if (match && match[1]) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'tgAuthResult', data: match[1] })
      );
    }
  }

  // 1. Fire immediately on script injection (page already at result URL)
  scanAndPost();

  // 2. Fire on hash changes (Telegram's default redirect mechanism)
  window.addEventListener('hashchange', scanAndPost);

  // 3. Fire on popstate (SPA-style navigation inside the OAuth frame)
  window.addEventListener('popstate', scanAndPost);

  // 4. Blend background for seamless white integration
  var style = document.createElement('style');
  style.innerHTML = [
    'body, html { background-color: #ffffff !important; background: #ffffff !important; }',
    '.tgme_widget_login_page { background-color: #ffffff !important; }'
  ].join(' ');
  document.head.appendChild(style);

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
