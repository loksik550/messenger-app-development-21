# Add project specific ProGuard rules here.
-keep public class * extends android.app.Activity
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
