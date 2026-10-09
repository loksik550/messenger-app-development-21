package ru.nova.messenger;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class CallActionReceiver extends BroadcastReceiver {

    public static final String ACTION_DECLINE = "ru.nova.messenger.CALL_DECLINE";
    public static final String ACTION_REPLY = "ru.nova.messenger.MSG_REPLY";
    public static final String ACTION_READ = "ru.nova.messenger.MSG_READ";
    public static final String KEY_REPLY = "nova_reply_text";
    static final String CHAT_API = "https://functions.poehali.dev/b97ade88-cc88-4702-a461-4c386efd5ca3";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_REPLY.equals(action) || ACTION_READ.equals(action)) {
            handleMessageAction(context, intent, ACTION_REPLY.equals(action));
            return;
        }
        if (!ACTION_DECLINE.equals(action)) return;
        String callId = intent.getStringExtra("call_id");
        String fromUser = intent.getStringExtra("from_user_id");
        String me = intent.getStringExtra("recipient_id");
        dismiss(context, callId);
        if (callId == null || fromUser == null || me == null) return;
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                sendDecline(context, callId, fromUser, me);
            } finally {
                pr.finish();
            }
        }).start();
    }

    private void handleMessageAction(Context ctx, Intent intent, boolean isReply) {
        final String chatId = intent.getStringExtra("chat_id");
        final String groupId = intent.getStringExtra("group_id");
        final String me = intent.getStringExtra("recipient_id");
        final String tag = intent.getStringExtra("tag");
        String text = null;
        if (isReply) {
            android.os.Bundle res = androidx.core.app.RemoteInput.getResultsFromIntent(intent);
            CharSequence cs = res != null ? res.getCharSequence(KEY_REPLY) : null;
            text = cs == null ? null : cs.toString().trim();
            if (text == null || text.isEmpty()) return;
        }
        if (me == null || (chatId == null && groupId == null)) return;
        final String body = text;
        final PendingResult pr = goAsync();
        new Thread(() -> {
            boolean ok = false;
            try {
                JSONObject req = new JSONObject();
                if (isReply) {
                    if (groupId != null) {
                        req.put("action", "send_group_message");
                        req.put("group_id", Long.parseLong(groupId));
                    } else {
                        req.put("action", "send_message");
                        req.put("chat_id", Long.parseLong(chatId));
                    }
                    req.put("text", body);
                    req.put("client_id", -System.currentTimeMillis());
                } else {
                    if (groupId != null) {
                        req.put("action", "mark_group_read");
                        req.put("group_id", Long.parseLong(groupId));
                    } else {
                        req.put("action", "mark_read");
                        req.put("chat_id", Long.parseLong(chatId));
                    }
                }
                String tk = authToken(ctx);
                ok = post(req, me, tk) / 100 == 2;
                if (isReply && ok) post(new JSONObject().put("action", "track").put("feature", "notif_reply"), me, tk);
            } catch (Exception ignored) {
            } finally {
                finishMessageNotification(ctx, tag, isReply, ok, body);
                pr.finish();
            }
        }).start();
    }

    private static void finishMessageNotification(Context ctx, String tag, boolean isReply, boolean ok, String text) {
        try {
            NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
            if (!isReply || ok) {
                nm.cancel(tag, NovaMessagingService.NOTIF_ID);
                if (isReply && ok) {
                    androidx.core.app.NotificationCompat.Builder b = new androidx.core.app.NotificationCompat.Builder(ctx, NovaMessagingService.CH_MESSAGES)
                        .setSmallIcon(R.drawable.ic_stat_nova)
                        .setColor(0xFF8B5CF6)
                        .setContentTitle("Ответ отправлен")
                        .setContentText(text)
                        .setSilent(true)
                        .setTimeoutAfter(2500)
                        .setAutoCancel(true);
                    nm.notify(tag, NovaMessagingService.NOTIF_ID, b.build());
                }
            } else {
                androidx.core.app.NotificationCompat.Builder b = new androidx.core.app.NotificationCompat.Builder(ctx, NovaMessagingService.CH_MESSAGES)
                    .setSmallIcon(R.drawable.ic_stat_nova)
                    .setColor(0xFF8B5CF6)
                    .setContentTitle("Не удалось отправить ответ")
                    .setContentText("Нет связи. Откройте Nova и отправьте ещё раз.")
                    .setSilent(true)
                    .setAutoCancel(true);
                nm.notify(tag, NovaMessagingService.NOTIF_ID, b.build());
            }
        } catch (SecurityException ignored) {
        }
    }

    static String authToken(Context ctx) {
        try {
            SharedPreferences p = ctx.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            return p.getString("nova_auth_token", null);
        } catch (Exception e) {
            return null;
        }
    }

    private static int post(JSONObject body, String me, String token) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(CHAT_API).openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-User-Id", me);
            if (token != null && !token.isEmpty()) conn.setRequestProperty("X-Auth-Token", token);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            return conn.getResponseCode();
        } catch (Exception e) {
            return 0;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    static void dismiss(Context ctx, String callId) {
        try {
            NotificationManagerCompat.from(ctx).cancel("call_" + callId, NovaMessagingService.NOTIF_ID);
        } catch (Exception ignored) {
        }
        IncomingCallActivity.finishIfShowing(callId);
    }

    static void sendDecline(Context ctx, String callId, String toUser, String me) {
        HttpURLConnection conn = null;
        try {
            JSONObject body = new JSONObject();
            body.put("action", "call_signal");
            body.put("call_id", callId);
            body.put("to_user_id", Long.parseLong(toUser));
            body.put("type", "decline");
            conn = (HttpURLConnection) new URL(CHAT_API).openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-User-Id", me);
            String tk = authToken(ctx);
            if (tk != null && !tk.isEmpty()) conn.setRequestProperty("X-Auth-Token", tk);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            conn.getResponseCode();
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
