package ru.nova.messenger;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class CallActionReceiver extends BroadcastReceiver {

    public static final String ACTION_DECLINE = "ru.nova.messenger.CALL_DECLINE";
    static final String CHAT_API = "https://functions.poehali.dev/b97ade88-cc88-4702-a461-4c386efd5ca3";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_DECLINE.equals(intent.getAction())) return;
        String callId = intent.getStringExtra("call_id");
        String fromUser = intent.getStringExtra("from_user_id");
        String me = intent.getStringExtra("recipient_id");
        dismiss(context, callId);
        if (callId == null || fromUser == null || me == null) return;
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                sendDecline(callId, fromUser, me);
            } finally {
                pr.finish();
            }
        }).start();
    }

    static void dismiss(Context ctx, String callId) {
        try {
            NotificationManagerCompat.from(ctx).cancel("call_" + callId, NovaMessagingService.NOTIF_ID);
        } catch (Exception ignored) {
        }
        IncomingCallActivity.finishIfShowing(callId);
    }

    static void sendDecline(String callId, String toUser, String me) {
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
