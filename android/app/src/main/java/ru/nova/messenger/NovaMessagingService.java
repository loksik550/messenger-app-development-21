package ru.nova.messenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import me.leolin.shortcutbadger.ShortcutBadger;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

public class NovaMessagingService extends FirebaseMessagingService {

    public static final String CH_MESSAGES = "messages";
    public static final String CH_CALLS = "calls";
    public static final String CH_CALLS_SILENT = "calls_fullscreen";
    public static final int NOTIF_ID = 1;

    private static final java.util.Map<String, Bitmap> AVATAR_CACHE =
        java.util.Collections.synchronizedMap(new java.util.LinkedHashMap<String, Bitmap>() {
            @Override protected boolean removeEldestEntry(Map.Entry<String, Bitmap> e) { return size() > 5; }
        });

    static Bitmap cachedAvatar(String callId) {
        return callId == null ? null : AVATAR_CACHE.get(callId);
    }

    static Bitmap letterAvatarFor(String name, String seed) {
        return letterAvatar(name == null ? "N" : name, seed == null ? "nova" : seed);
    }

    private static final int[][] GRADIENTS = {
        {0xFF8B5CF6, 0xFF6366F1}, {0xFF3B82F6, 0xFF06B6D4}, {0xFFEC4899, 0xFFF43F5E},
        {0xFF10B981, 0xFF14B8A6}, {0xFFF59E0B, 0xFFF97316}, {0xFFA855F7, 0xFFEC4899},
    };

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        PushNotificationsPlugin.sendRemoteMessage(message);

        Map<String, String> data = message.getData();
        if (data == null || data.isEmpty()) return;
        if ("1".equals(data.get("cancel"))) {
            try {
                NotificationManagerCompat.from(getApplicationContext()).cancel(nz(data.get("tag"), "nova"), NOTIF_ID);
            } catch (Exception ignored) {
            }
            String t = data.get("tag");
            if (t != null && t.startsWith("call_")) IncomingCallActivity.finishIfShowing(t.substring(5));
            return;
        }
        if (MainActivity.isInForeground) return;

        try {
            show(data);
        } catch (Exception ignored) {
        }
    }

    private void show(Map<String, String> data) {
        Context ctx = getApplicationContext();
        ensureChannels(ctx);

        boolean isCall = "1".equals(data.get("is_call"));
        String title = nz(data.get("title"), "Nova");
        String body = nz(data.get("body"), "Новое сообщение");
        String tag = nz(data.get("tag"), "nova");
        String senderName = nz(data.get("sender_name"), title);
        int badge = parseInt(data.get("badge"));
        String seed = nz(data.get("chat_id"), nz(data.get("group_id"), senderName));

        Bitmap avatar = null;
        String avatarUrl = data.get("avatar");
        if (avatarUrl != null && avatarUrl.startsWith("http")) {
            avatar = circle(download(avatarUrl));
        }
        if (avatar == null) avatar = letterAvatar(senderName, seed);

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        for (Map.Entry<String, String> e : data.entrySet()) open.putExtra(e.getKey(), e.getValue());
        open.putExtra("nova_push_tap", "1");
        PendingIntent pi = PendingIntent.getActivity(
            ctx, tag.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, isCall ? CH_CALLS : CH_MESSAGES)
            .setSmallIcon(R.drawable.ic_stat_nova)
            .setColor(0xFF8B5CF6)
            .setLargeIcon(avatar)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(new NotificationCompat.Builder(ctx, isCall ? CH_CALLS : CH_MESSAGES)
                .setSmallIcon(R.drawable.ic_stat_nova)
                .setColor(0xFF8B5CF6)
                .setContentTitle("Nova")
                .setContentText(isCall ? "Входящий звонок" : "Новое сообщение")
                .build())
            .setPriority(isCall ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
            .setCategory(isCall ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_MESSAGE)
            .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
            .setDefaults(NotificationCompat.DEFAULT_ALL);

        if (badge > 0) b.setNumber(badge);
        if (!isCall) applyBadge(ctx, badge);
        if (isCall) {
            String callId = data.get("call_id");
            if (callId != null) AVATAR_CACHE.put(callId, avatar);
            String callerName = senderName.replaceFirst("^📞\\s*", "");

            Intent full = new Intent(ctx, IncomingCallActivity.class);
            full.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
            full.putExtra("call_id", callId);
            full.putExtra("from_user_id", data.get("from_user_id"));
            full.putExtra("recipient_id", data.get("recipient_id"));
            full.putExtra("sender_name", callerName);
            PendingIntent fullPi = PendingIntent.getActivity(
                ctx, ("full" + tag).hashCode(), full,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Intent mainAccept = new Intent(ctx, MainActivity.class);
            mainAccept.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            mainAccept.putExtra("nova_push_tap", "1");
            mainAccept.putExtra("call_id", callId);
            mainAccept.putExtra("from_user_id", data.get("from_user_id"));
            mainAccept.putExtra("is_call", "1");
            mainAccept.putExtra("call_accept", "1");
            PendingIntent acceptPi = PendingIntent.getActivity(
                ctx, ("accept" + tag).hashCode(), mainAccept,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Intent decline = new Intent(ctx, CallActionReceiver.class);
            decline.setAction(CallActionReceiver.ACTION_DECLINE);
            decline.putExtra("call_id", callId);
            decline.putExtra("from_user_id", data.get("from_user_id"));
            decline.putExtra("recipient_id", data.get("recipient_id"));
            PendingIntent declinePi = PendingIntent.getBroadcast(
                ctx, ("decline" + tag).hashCode(), decline,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            boolean isVideo = callId != null && callId.startsWith("video_");
            b.setContentTitle(callerName)
                .setContentText(isVideo ? "Входящий видеозвонок" : "Входящий звонок")
                .setStyle(null)
                .setOngoing(true)
                .setAutoCancel(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(fullPi)
                .setFullScreenIntent(fullPi, true)
                .setTimeoutAfter(45000)
                .addAction(0, "Отклонить", declinePi)
                .addAction(0, "Принять", acceptPi);
            b.setDefaults(0);
            b.setSound(null);
            b.setVibrate(null);
            b.setOnlyAlertOnce(true);

            boolean locked = false;
            try {
                android.app.KeyguardManager km = (android.app.KeyguardManager) ctx.getSystemService(Context.KEYGUARD_SERVICE);
                android.os.PowerManager pm = (android.os.PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
                locked = (km != null && km.isKeyguardLocked()) || (pm != null && !pm.isInteractive());
            } catch (Exception ignored) {
            }
            if (MainActivity.isInForeground) return;
            boolean fullScreen = locked && canFullScreen(ctx);
            if (fullScreen) b.setChannelId(CH_CALLS_SILENT);
            try {
                NotificationManagerCompat.from(ctx).notify(tag, NOTIF_ID, b.build());
            } catch (SecurityException ignored) {
            }
            if (fullScreen) {
                try { ctx.startActivity(full); } catch (Exception ignored) { }
            }
            return;
        }

        try {
            NotificationManagerCompat.from(ctx).notify(tag, NOTIF_ID, b.build());
        } catch (SecurityException ignored) {
        }
    }

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CH_MESSAGES) == null) {
            NotificationChannel ch = new NotificationChannel(CH_MESSAGES, "Сообщения", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Новые сообщения");
            ch.setShowBadge(true);
            ch.enableVibration(true);
            ch.enableLights(true);
            ch.setLightColor(0xFF8B5CF6);
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CH_CALLS) == null) {
            NotificationChannel ch = new NotificationChannel(CH_CALLS, "Звонки", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Входящие звонки");
            ch.setShowBadge(true);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 600, 400, 600, 400, 600});
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            ch.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CH_CALLS_SILENT) == null) {
            NotificationChannel ch = new NotificationChannel(CH_CALLS_SILENT, "Звонки на заблокированном экране", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Полноэкранный входящий звонок. Звук и вибрация идут с экрана звонка.");
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setShowBadge(false);
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
    }

    static boolean canFullScreen(Context ctx) {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.canUseFullScreenIntent();
    }

    static void applyBadge(Context ctx, int count) {
        try {
            ctx.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                .edit().putInt("capacitor.badge", Math.max(0, count)).apply();
            ShortcutBadger.applyCount(ctx, Math.max(0, count));
        } catch (Exception ignored) {
        }
    }

    private static String nz(String v, String def) {
        return (v == null || v.trim().isEmpty()) ? def : v;
    }

    private static int parseInt(String v) {
        try { return v == null ? 0 : Integer.parseInt(v.trim()); } catch (Exception e) { return 0; }
    }

    private static Bitmap download(String url) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setInstanceFollowRedirects(true);
            try (InputStream in = conn.getInputStream()) {
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inPreferredConfig = Bitmap.Config.ARGB_8888;
                return BitmapFactory.decodeStream(in, null, o);
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static Bitmap circle(Bitmap src) {
        if (src == null) return null;
        int size = 192;
        int side = Math.min(src.getWidth(), src.getHeight());
        int x = (src.getWidth() - side) / 2;
        int y = (src.getHeight() - side) / 2;
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        c.drawOval(new RectF(0, 0, size, size), p);
        p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        c.drawBitmap(src, new Rect(x, y, x + side, y + side), new Rect(0, 0, size, size), p);
        return out;
    }

    private static Bitmap letterAvatar(String name, String seed) {
        int size = 192;
        int[] g = GRADIENTS[Math.abs(seed.hashCode()) % GRADIENTS.length];
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
        bg.setShader(new LinearGradient(0, 0, size, size, g[0], g[1], Shader.TileMode.CLAMP));
        c.drawOval(new RectF(0, 0, size, size), bg);
        String clean = name.replaceAll("^[^\\p{L}\\p{N}]+", "");
        String letter = clean.isEmpty() ? "N" : clean.substring(0, 1).toUpperCase();
        Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG);
        tp.setColor(Color.WHITE);
        tp.setTextSize(size * 0.45f);
        tp.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        tp.setTextAlign(Paint.Align.CENTER);
        Rect r = new Rect();
        tp.getTextBounds(letter, 0, letter.length(), r);
        c.drawText(letter, size / 2f, size / 2f + r.height() / 2f, tp);
        return out;
    }
}
