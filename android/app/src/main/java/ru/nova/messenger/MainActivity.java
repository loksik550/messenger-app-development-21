package ru.nova.messenger;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    public static volatile boolean isInForeground = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NovaCallPlugin.class);
        super.onCreate(savedInstanceState);
        NovaMessagingService.ensureChannels(this);
        handleCallIntent(getIntent());
        savePushTap(getIntent());
    }

    // Принятый звонок показываем поверх экрана блокировки:
    // разговор идёт без ввода пароля, как в обычной «звонилке».
    void setOverLockscreen(boolean on) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(on);
                setTurnScreenOn(on);
            } else if (on) {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
            }
            if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (Exception ignored) {
        }
    }

    private void handleCallIntent(Intent intent) {
        if (intent == null || intent.getExtras() == null) return;
        if (!"1".equals(intent.getStringExtra("call_accept"))) return;
        setOverLockscreen(true);
        IncomingCallActivity.finishIfShowing(null);
        CallActionReceiver.dismissAllCalls(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        handleCallIntent(intent);
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
            for (String k : new String[]{"chat_id", "group_id", "call_id", "is_call", "from_user_id", "call_accept"}) {
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
