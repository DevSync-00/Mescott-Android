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

const buildInjectedJs = (phoneNumber: string) => `
(function() {
  // 1. Intercept hash change
  function checkHash() {
    var match = window.location.hash.match(/#tgAuthResult=([^&]*)/);
    if (match && match[1]) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tgAuthResult', data: match[1] }));
    }
  }
  window.addEventListener('hashchange', checkHash);
  checkHash();

  // 2. Automate phone form fill
  function attemptFill() {
    var phoneInput = document.getElementById('login-phone');
    if (phoneInput) {
      if (phoneInput.value !== "${phoneNumber}") {
        phoneInput.value = "${phoneNumber}";
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Look for the Next button
      var nextBtn = document.querySelector('button.btn-primary') || 
                    document.querySelector('button') || 
                    document.querySelector('.btn');
      if (nextBtn && nextBtn.textContent && nextBtn.textContent.toLowerCase().includes('next')) {
        nextBtn.click();
        return true;
      }
    }

    // 3. Automate "Log in as <Name>" if already authenticated
    var buttons = document.querySelectorAll('button, a.btn, div.btn');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (btn.textContent && btn.textContent.toLowerCase().includes('log in as')) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  var attempts = 0;
  var interval = setInterval(function() {
    attempts++;
    if (attemptFill() || attempts > 30) {
      clearInterval(interval);
    }
  }, 250);

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
  phoneNumber: string;
  onAuthResult: (data: TelegramAuthData) => void;
  onCancel?: () => void;
}

export default function TelegramLoginScreen({ phoneNumber, onAuthResult, onCancel }: TelegramLoginScreenProps) {
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

  const injectedJs = buildInjectedJs(phoneNumber);

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
        injectedJavaScript={injectedJs}
        injectedJavaScriptBeforeContentLoaded={injectedJs}
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
