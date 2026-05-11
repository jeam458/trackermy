#!/usr/bin/env bash
# Compila el APK de depuración. Requiere JDK 21+ (Capacitor 8) y Android SDK.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-$HOME/.jdks/temurin-21/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [[ ! -x "${JAVA_HOME}/bin/java" ]]; then
  echo "No se encontró Java en JAVA_HOME=$JAVA_HOME" >&2
  echo "Instala Temurin 21 o exporta JAVA_HOME hacia un JDK 21." >&2
  exit 1
fi
cd "$ROOT/android"
chmod +x ./gradlew
./gradlew assembleDebug
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "APK listo: $APK"
ls -la "$APK"
