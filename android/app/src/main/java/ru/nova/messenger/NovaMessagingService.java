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
    public static final int NOTIF_ID = 1;

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
            return;
        }
        if (MainActivity.isInForeground && !"1".equals(data.get("is_call"))) return;

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
            b.setTimeoutAfter(45000);
            b.setFullScreenIntent(pi, true);
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
