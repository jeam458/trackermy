# Uso: source scripts/android-env.sh
# JDK 21 (requerido por @capacitor/android) y SDK instalado con Homebrew.
export JAVA_HOME="${JAVA_HOME:-$HOME/jdk/jdk-21.0.10+7/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/usr/local/share/android-commandlinetools}"
export PATH="$JAVA_HOME/bin:$PATH"
