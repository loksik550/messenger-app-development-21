# ProGuard rules для Nova Messenger
# Включают обфускацию, минификацию и удаление логов в release-сборке.

# ── Базовые правила Android ────────────────────────────────────────────
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# ── Capacitor: интерфейсы между JS и Java ──────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# ── WebView: интерфейсы для JS ─────────────────────────────────────────
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# ── AndroidX и Material Components ─────────────────────────────────────
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ── Удаляем все логи в release (защита от утечек) ──────────────────────
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# ── Удаляем System.out.println ─────────────────────────────────────────
-assumenosideeffects class java.io.PrintStream {
    public void println(%);
    public void println(**);
    public void print(%);
    public void print(**);
}

# ── Скрываем имена исходных файлов в стектрейсах ───────────────────────
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable

# ── Сохраняем enum-классы корректно ────────────────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Сохраняем Parcelable ───────────────────────────────────────────────
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# ── Сохраняем нативные методы ──────────────────────────────────────────
-keepclasseswithmembernames class * {
    native <methods>;
}

# ── Подавляем предупреждения для библиотек без полных правил ───────────
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
