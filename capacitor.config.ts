import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dhtracker.app',
  appName: 'Downhill Tracker',
  webDir: 'out',
  plugins: {
    BackgroundGeolocation: {
      locationProvider: "DISTANCE_FILTER_PROVIDER",
      desiredAccuracy: "HIGH",
      stationaryRadius: 50,
      distanceFilter: 10,
      notificationTitle: "Downhill Tracker",
      notificationText: "Registrando ruta GPS en segundo plano",
      debug: false,
      interval: 10000,
      fastestInterval: 5000,
      activitiesInterval: 10000
    }
  }
};

export default config;
