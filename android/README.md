# Nova — Android-проект

Это нативный Android-модуль приложения Nova (Capacitor 6 + Java).

- **applicationId / package**: `ru.nova.messenger`
- **app name**: Nova
- **minSdk**: 26 (Android 8.0+)
- **targetSdk / compileSdk**: 34 (Android 14)
- **versionCode**: 1
- **versionName**: 1.0.0

## Структура

```
android/
├── app/                          ← главный модуль приложения (его и видит APK Editor Studio)
│   ├── src/main/
│   │   ├── AndroidManifest.xml  ← манифест с разрешениями
│   │   ├── java/ru/nova/messenger/MainActivity.java
│   │   ├── res/                  ← иконки, цвета, строки, темы
│   │   └── assets/
│   │       ├── capacitor.config.json
│   │       ├── capacitor.plugins.json
│   │       └── public/           ← сюда `npx cap sync` копирует dist/ (веб-часть)
│   ├── build.gradle             ← конфиг сборки модуля
│   └── proguard-rules.pro
├── capacitor-cordova-android-plugins/   ← модуль Cordova-плагинов (пустой стаб)
├── gradle/wrapper/               ← Gradle Wrapper config
├── build.gradle                  ← top-level build
├── settings.gradle               ← список модулей
├── capacitor.settings.gradle    ← подключение Capacitor-плагинов
├── variables.gradle              ← версии SDK и зависимостей
└── gradle.properties
```

## Что нужно сделать на компьютере перед первой сборкой

Папка `android/app/build/` (где APK), `android/.gradle/`, `gradlew`, бинарники
`gradle-wrapper.jar` не коммитятся (см. `.gitignore`). Они появятся после
первого запуска `npx cap sync android`.

1. Установи **Android Studio** и **JDK 17**.
2. В корне веб-проекта запусти:
   ```bash
   bun install
   bun run build
   npx cap sync android
   ```
   После этого:
   - В `android/app/src/main/assets/public/` появится собранная веб-часть
   - В `android/gradle/wrapper/gradle-wrapper.jar` — бинарник Gradle Wrapper
   - В `android/gradlew` / `android/gradlew.bat` — стартовые скрипты
3. Открой папку `android/` в Android Studio (File → Open) — он сам всё подгрузит.

## Сборка APK

**Debug APK** (для теста на телефоне):
```bash
cd android
./gradlew assembleDebug
```
Результат → `android/app/build/outputs/apk/debug/app-debug.apk`

**Release AAB** (для Google Play, нужен ключ подписи):
```bash
./gradlew bundleRelease
```
Результат → `android/app/build/outputs/bundle/release/app-release.aab`

## APK Editor Studio

Открывай `android/app/build/outputs/apk/debug/app-debug.apk` — APK Editor
Studio сразу распознает приложение и покажет манифест, ресурсы, иконки.

Сам проект (исходники) — это папка `android/app/`. APK Editor Studio работает
именно с собранными APK, но открыть и изучить структуру модуля в нём не получится
— для редактирования кода используй Android Studio.
