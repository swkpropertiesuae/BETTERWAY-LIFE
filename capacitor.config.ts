/**
 * Capacitor Native iOS (App Store / TestFlight) & Android (Google Play Store) Configuration
 * Package ID: com.betterwaymortgages.one
 */
const config = {
  appId: 'com.betterwaymortgages.one',
  appName: 'Betterway ONE',
  webDir: 'public',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://betterway-life.vercel.app/os/mobile',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#021125',
    preferredContentMode: 'mobile',
    scheme: 'BetterwayONE',
  },
  android: {
    backgroundColor: '#021125',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#021125',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#021125',
    },
  },
};

export default config;
