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

const INJECTED_JS = `
(function() {
  function checkHash() {
    var match = window.location.hash.match(/#tgAuthResult=([^&]*)/);
    if (match && match[1]) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tgAuthResult', data: match[1] }));
    }
  }
  window.addEventListener('hashchange', checkHash);
  checkHash();
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
      if (msg?.type === 'tgAuthResult' && msg?.data) {
        const data = decodeTgAuthResult(msg.data) as TelegramAuthData;
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
