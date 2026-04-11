# 📱 Generar APK para Android

## Opción 1: PWA Builder (Recomendado - Más fácil)

### ✅ Ventajas:
- No requiere Android Studio
- Genera APK en minutos
- App funciona offline (con Service Worker)

### 📋 Pasos:

1. **Sube tu app a internet**:
   ```bash
   # Opción A: Vercel (gratis)
   npm install -g vercel
   vercel --prod
   
   # Opción B: Netlify (gratis)
   npm install -g netlify-cli
   netlify deploy --prod
   ```

2. **Ve a PWA Builder**:
   - Abre: https://www.pwabuilder.com/
   - Ingresa la URL de tu app
   - Click en "Build My PWA"

3. **Descarga el APK**:
   - Selecciona "Android"
   - Descarga el paquete
   - Instala en tu celular

---

## Opción 2: Android Studio (Más control)

### Requisitos:
- Android Studio instalado
- Java JDK 17+
- 4GB+ de espacio en disco

### Pasos:

1. **Instala Android Studio**:
   - Descarga: https://developer.android.com/studio
   - Instala y configura SDK de Android

2. **Crea un proyecto TWA**:
   - Abre Android Studio
   - File → New → New Project
   - Selecciona "Empty Activity"
   - Minimum SDK: API 21

3. **Agrega la dependencia TWA**:
   En `build.gradle` (app level):
   ```gradle
   dependencies {
       implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
   }
   ```

4. **Configura AndroidManifest.xml**:
   ```xml
   <activity android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
             android:exported="true">
       <meta-data android:name="android.support.customtabs.trusted.DEFAULT_URL"
                  android:value="https://tu-url.com" />
       <intent-filter>
           <action android:name="android.intent.action.MAIN" />
           <category android:name="android.intent.category.LAUNCHER" />
       </intent-filter>
   </activity>
   ```

5. **Build APK**:
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - El APK estará en: `app/build/outputs/apk/debug/`

---

## Opción 3: Capacitor (App nativa completa)

### Pasos:

1. **Build de producción**:
   ```bash
   npm run build
   npm run start
   ```

2. **Configura Capacitor**:
   ```bash
   npx cap add android
   npx cap sync
   ```

3. **Abre en Android Studio**:
   ```bash
   npx cap open android
   ```

4. **Build APK**:
   - En Android Studio: Build → Build APK
   - O por comando: `./gradlew assembleDebug`

---

## 🎯 Recomendación para tu caso:

**Usa PWA Builder** porque:
- ✅ Tu app ya es PWA (tiene manifest y service worker)
- ✅ No requiere instalar Android Studio
- ✅ Funciona offline
- ✅ Se actualiza automáticamente
- ✅ Genera APK en 5 minutos

### 📲 Instalar APK en tu celular:

1. **Habilita instalación de fuentes desconocidas**:
   - Settings → Security → Unknown sources
   - O Settings → Apps → Special access → Install unknown apps

2. **Transfiere el APK a tu celular**:
   - USB
   - Google Drive
   - Email
   - Bluetooth

3. **Instala**:
   - Abre el archivo APK en tu celular
   - Click en "Instalar"
   - ¡Listo!

---

## 🔗 URLs de tu app:

- **Local**: http://localhost:3000
- **Producción**: (sube a Vercel/Netlify primero)

---

**¿Quieres que te ayude a subir tu app a Vercel para generar el APK?**
