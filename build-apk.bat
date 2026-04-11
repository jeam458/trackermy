@echo off
echo ========================================
echo  Building Downhill Tracker APK
echo ========================================
echo.

set ANDROID_HOME=C:\Users\jeam\AppData\Local\Android\Sdk
set ANDROID_SDK_ROOT=C:\Users\jeam\AppData\Local\Android\Sdk
set JAVA_HOME=C:\Program Files\Java\jdk-17

echo [1/4] Creating Android project...
npx cap sync android

echo.
echo [2/4] Building APK...
cd android
call gradlew.bat assembleDebug

echo.
echo [3/4] APK generated successfully!
echo.
echo APK location: android\app\build\outputs\apk\debug\app-debug.apk
echo.

cd ..
echo [4/4] Done!
echo.
echo To install on your device:
echo 1. Connect your phone via USB
echo 2. Enable USB debugging
echo 3. Run: adb install android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
