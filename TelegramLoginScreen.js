import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';

// ---------------------------------------------------------------------------
// Flow overview:
//  1. Open oauth.telegram.org/auth?bot_id=...&origin=...&return_to=...
//  2. User authenticates in the Telegram app (deep-linked automatically).
//  3. Telegram redirects to return_to with #tgAuthResult=<base64url-json>
//  4. We intercept that URL in the WebView and decode the payload.
//  5. POST to our Edge Function → verify HMAC → get back a Supabase session.
//  6. Set session on supabase client → AppNavigator detects user → navigate.
// ---------------------------------------------------------------------------

const BOT_ID = process.env.EXPO_PUBLIC_TELEGRAM_BOT_ID ?? '';

const ORIGIN    = 'https://oauth.telegram.org';
const RETURN_TO = 'https://oauth.telegram.org/auth/callback';

// A unique nonce per screen mount forces Telegram to show the account
// chooser / phone prompt instead of silently re-using the last session.
const buildAuthUrl = (nonce) =>
  `https://oauth.telegram.org/auth` +
  `?bot_id=${BOT_ID}` +
  `&origin=${encodeURIComponent(ORIGIN)}` +
  `&return_to=${encodeURIComponent(RETURN_TO)}` +
  `&request_access=write` +
  `&embed=0` +
  `&nonce=${nonce}`;

// Injected JS: clears any stored Telegram session cookies, then watches for
// the tgAuthResult fragment so the user must authenticate fresh every time.
const INJECTED_JS = `
(function() {
  // Clear all cookies for oauth.telegram.org so previous sessions don't
  // auto-resume. This runs before the page renders its own JS.
  try {
    document.cookie.split(';').forEach(function(c) {
      var name = c.trim().split('=')[0];
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.telegram.org';
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=oauth.telegram.org';
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    });
  } catch(e) {}

  function checkHash() {
    try {
      var hash = window.location.hash;
      if (hash && hash.indexOf('tgAuthResult=') !== -1) {
        var idx = hash.indexOf('tgAuthResult=');
        var result = hash.slice(idx + 'tgAuthResult='.length);
        if (result) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'tgAuthResult', data: result })
          );
        }
      }
    } catch(e) {}
  }

  checkHash();
  window.addEventListener('hashchange', checkHash);

  var origPush = history.pushState;
  history.pushState = function() { origPush.apply(this, arguments); checkHash(); };
  var origReplace = history.replaceState;
  history.replaceState = function() { origReplace.apply(this, arguments); checkHash(); };

  var origError = console.error;
  console.error = function() {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'consoleError', msg: Array.from(arguments).join(' ') })
    );
    origError.apply(this, arguments);
  };

  true;
})();
`;

/** Decode a tgAuthResult value → JS object.
 *  Telegram encodes it as base64url(JSON). However the fragment may arrive
 *  URL-encoded (%7B...%7D) or with extra query params appended after a '&'.
 *  We handle all variants here.
 */
function decodeTgAuthResult(raw) {
  try {
    // Strip anything after the first '&' (extra query params)
    const str = raw.split('&')[0];

    // If it looks like it's already URL-encoded JSON, decode it directly
    const urlDecoded = decodeURIComponent(str);
    if (urlDecoded.startsWith('{')) {
      return JSON.parse(urlDecoded);
    }

    // Otherwise treat as base64url
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    const decoded = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(decoded);
  } catch (e) {
    console.warn('[TelegramLoginScreen] decodeTgAuthResult failed:', e.message, 'raw:', raw?.slice(0, 80));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const TelegramLoginScreen = ({ navigation }) => {
  const { loginWithTelegram } = useAuth();
  const webViewRef = useRef(null);

  // Use refs for flags to avoid stale-closure bugs
  const processingRef = useRef(false);
  const pageLoadedRef = useRef(false);

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fatalError, setFatalError] = useState(null);
  // webViewKey changes → WebView fully remounts → fresh session, no cached cookies
  const [webViewKey, setWebViewKey] = useState('initial');
  // nonce makes the auth URL unique per mount so Telegram prompts fresh
  const [nonce, setNonce] = useState(() => Math.random().toString(36).slice(2));

  // On mount, check if logout happened since last visit and force a fresh key
  useEffect(() => {
    AsyncStorage.getItem('webview_reset_key').then((val) => {
      if (val) {
        setWebViewKey(`reset-${val}`);
        setNonce(Math.random().toString(36).slice(2));
      }
    });
  }, []);

  // ── Auth result handler ──────────────────────────────────────────────────
  const handleTelegramResult = useCallback(
    async (base64Result) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);

      try {
        const authData = decodeTgAuthResult(base64Result);
        console.log('[Telegram] decoded auth data:', JSON.stringify({
          ...authData,
          hash: authData?.hash?.slice(0, 8) + '...',
        }));
        if (!authData || !authData.id || !authData.hash) {
          throw new Error('Invalid Telegram auth payload.');
        }
        await loginWithTelegram(authData);
        // AppNavigator detects user change and navigates automatically.
      } catch (err) {
        processingRef.current = false;
        setIsProcessing(false);
        Alert.alert(
          'Login Failed',
          err.message || 'Could not complete Telegram login. Please try again.',
          [{ text: 'OK' }],
        );
        setErrorMessage(err.message || 'Could not complete Telegram login.');
      }
    },
    [loginWithTelegram],
  );

  // ── URL interception (fragment-based redirect) ───────────────────────────
  const extractResult = (url = '') => {
    const idx = url.indexOf('#tgAuthResult=');
    if (idx !== -1) return url.slice(idx + '#tgAuthResult='.length);
    return null;
  };

  const handleNavigationStateChange = useCallback(
    (navState) => {
      const result = extractResult(navState.url);
      if (result) handleTelegramResult(result);
    },
    [handleTelegramResult],
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (request) => {
      // Let tg:// deep links through (Telegram app opens natively)
      if (request.url?.startsWith('tg://')) return true;

      const result = extractResult(request.url);
      if (result) {
        handleTelegramResult(result);
        return false; // stop WebView from navigating
      }
      return true;
    },
    [handleTelegramResult],
  );

  // ── Messages from injected JS ────────────────────────────────────────────
  const handleMessage = useCallback(
    (event) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg?.type === 'tgAuthResult' && msg?.data) {
          handleTelegramResult(msg.data);
        } else if (msg?.type === 'consoleError') {
          console.warn('[TelegramWebView]', msg.msg);
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [handleTelegramResult],
  );

  // ── Load state handlers ──────────────────────────────────────────────────
  const handleLoadStart = useCallback(() => {
    if (!pageLoadedRef.current) setIsPageLoading(true);
  }, []);

  const handleLoadEnd = useCallback(() => {
    pageLoadedRef.current = true;
    setIsPageLoading(false);
  }, []);

  // Only treat HTTP errors (4xx/5xx) or complete network failures as fatal.
  // Sub-resource errors (images, iframes) fire onError too — ignore those.
  const handleError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('[TelegramWebView] error:', nativeEvent);
    // nativeEvent.code < 0 are network-level failures (no connectivity, DNS, etc.)
    // nativeEvent.code > 0 are typically sub-resource/HTTP errors — don't kill the screen
    if (!pageLoadedRef.current) {
      setIsPageLoading(false);
      setFatalError(nativeEvent?.description || 'Could not load Telegram login page.');
    }
  }, []);

  const handleHttpError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    // 4xx/5xx on the main frame
    if (nativeEvent?.statusCode >= 400 && !pageLoadedRef.current) {
      setIsPageLoading(false);
      setFatalError(`Telegram returned HTTP ${nativeEvent.statusCode}.`);
    }
  }, []);

  const handleRetry = () => {
    processingRef.current = false;
    pageLoadedRef.current = false;
    const newNonce = Math.random().toString(36).slice(2);
    setNonce(newNonce);
    setWebViewKey(`retry-${newNonce}`);
    setFatalError(null);
    setIsProcessing(false);
    setIsPageLoading(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (!BOT_ID) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <View style={styles.backButtonCircle}>
                <Ionicons name="chevron-back" size={22} color="#000" />
              </View>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Continue with Telegram</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.centeredContent}>
            <Ionicons name="settings-outline" size={52} color={COLORS.primary} />
            <Text style={styles.setupTitle}>Bot ID not configured</Text>
            <Text style={styles.setupBody}>
              Add to your .env file:{'\n\n'}
              <Text style={styles.setupCode}>EXPO_PUBLIC_TELEGRAM_BOT_ID=your_bot_id</Text>
              {'\n\n'}
              Get your bot ID from @BotFather, then register your domain with /setdomain.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.backButtonCircle}>
              <Ionicons name="chevron-back" size={22} color="#000" />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Continue with Telegram</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.webViewContainer}>
          {/* Fatal error replaces entire WebView area */}
          {fatalError ? (
            <View style={styles.centeredContent}>
              <Ionicons name="warning-outline" size={52} color={COLORS.error} />
              <Text style={styles.errorText}>{fatalError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              key={webViewKey}
              ref={webViewRef}
              source={{ uri: buildAuthUrl(nonce) }}
              style={styles.webView}
              injectedJavaScript={INJECTED_JS}
              onNavigationStateChange={handleNavigationStateChange}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onMessage={handleMessage}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleHttpError}
              javaScriptEnabled
              domStorageEnabled
              incognito={true}
              allowsInlineMediaPlayback
              originWhitelist={['https://*', 'http://*', 'tg://*']}
              userAgent={
                Platform.OS === 'android'
                  ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
                  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
              }
            />
          )}

          {/* Spinner overlay — only while initial page is loading */}
          {(isPageLoading || isProcessing) && !fatalError && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.overlayText}>
                {isProcessing ? 'Signing you in…' : 'Loading…'}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backButton: { padding: 4 },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.secondary,
  },
  headerSpacer: { width: 48 },
  webViewContainer: { flex: 1 },
  webView: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  errorText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  setupTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.secondary,
  },
  setupBody: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 24,
  },
  setupCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
  },
});

export default TelegramLoginScreen;
