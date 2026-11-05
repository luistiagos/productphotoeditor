#!/usr/bin/env bash
# Regera o bundle do editor, o APK debug e instala no aparelho de $ANDROID_SERIAL (padrão: emulator-5554).
set -euo pipefail
cd "$(dirname "$0")/../.."
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
export JAVA_HOME="${JAVA_HOME:-D:\DevCaches\jdk-17}"
(cd editor-web && npm run build >/dev/null)
./gradlew :app:assembleDebug -q 2>&1 | grep -v -e '^w:' -e 'SDK processing' || true
adb install -r app/build/outputs/apk/debug/app-debug.apk | tail -1
