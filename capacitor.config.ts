import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Modo APK offline (recomendado): `CAPACITOR_STATIC=1` al hacer `cap sync`.
 * La UI va empaquetada en `out/` (Next `output: 'export'`). Sigue siendo un WebView,
 * pero carga archivos locales; datos en montaña requieren caché/red cuando toque Supabase/mapas.
 *
 * Modo remoto: sin CAPACITOR_STATIC, `webDir` es `www` y opcionalmente `server.url` apunta a Next desplegado.
 */
const isBundled = process.env.CAPACITOR_STATIC === '1';

const serverUrl = isBundled
  ? undefined
  : (
      process.env.CAPACITOR_SERVER_URL?.trim() ||
      process.env.CAPACITOR_DEV_URL?.trim()
    );

const server: CapacitorConfig['server'] | undefined =
  !isBundled && serverUrl
    ? {
        url: serverUrl.replace(/\/$/, ''),
        androidScheme: serverUrl.startsWith('https') ? 'https' : 'http',
        cleartext: serverUrl.startsWith('http://'),
      }
    : undefined;

const config: CapacitorConfig = {
  appId: 'com.dhtracker.app',
  appName: 'GuardDh',
  webDir: isBundled ? 'out' : 'www',
  android: {
    buildOptions: {
      keystorePath: '',
      keystorePassword: '',
      keystoreAlias: '',
      keystoreAliasPassword: '',
    },
  },
  ...(server ? { server } : {}),
  plugins: {
    BackgroundGeolocation: {
      locationProvider: "DISTANCE_FILTER_PROVIDER",
      desiredAccuracy: "HIGH",
      stationaryRadius: 50,
      distanceFilter: 10,
      notificationTitle: "GuardDh",
      notificationText: "Registrando ruta GPS en segundo plano",
      debug: false,
      interval: 10000,
      fastestInterval: 5000,
      activitiesInterval: 10000
    }
  }
};

export default config;
