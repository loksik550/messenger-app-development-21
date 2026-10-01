package ru.nova.messenger;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    public static volatile boolean isInForeground = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        NovaMessagingService.ensureChannels(this);
        savePushTap(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        savePushTap(intent);
        super.onNewIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        isInForeground = true;
        try {
            NotificationManagerCompat.from(this).cancelAll();
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        isInForeground = false;
    }

    private void savePushTap(Intent intent) {
        if (intent == null || intent.getExtras() == null) return;
        Bundle ex = intent.getExtras();
        if (!"1".equals(ex.getString("nova_push_tap"))) return;
        try {
            JSONObject o = new JSONObject();
            for (String k : new String[]{"chat_id", "group_id", "call_id", "is_call", "from_user_id"}) {
                String v = ex.getString(k);
                if (v != null) o.put(k, v);
            }
            o.put("ts", System.currentTimeMillis());
            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            prefs.edit().putString("nova_push_open", o.toString()).apply();
        } catch (Exception ignored) {
        }
        intent.removeExtra("nova_push_tap");
    }
}
