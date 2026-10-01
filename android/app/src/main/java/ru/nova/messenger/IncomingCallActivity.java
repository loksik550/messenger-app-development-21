package ru.nova.messenger;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.lang.ref.WeakReference;

public class IncomingCallActivity extends Activity {

    private static WeakReference<IncomingCallActivity> current = new WeakReference<>(null);
    private static final long RING_TIMEOUT_MS = 45000;

    private String callId;
    private String fromUser;
    private String recipient;
    private Ringtone ringtone;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean handled = false;

    static void finishIfShowing(String callId) {
        IncomingCallActivity a = current.get();
        if (a == null) return;
        if (callId == null || callId.equals(a.callId)) {
            a.runOnUiThread(() -> {
                a.handled = true;
                a.stopRinging();
                a.finishAndRemoveTask();
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showOverLockscreen();

        Intent in = getIntent();
        callId = in.getStringExtra("call_id");
        fromUser = in.getStringExtra("from_user_id");
        recipient = in.getStringExtra("recipient_id");
        String name = in.getStringExtra("sender_name");
        if (name == null || name.isEmpty()) name = "Nova";
        boolean isVideo = callId != null && callId.startsWith("video_");
        current = new WeakReference<>(this);

        setContentView(buildUi(name, isVideo, NovaMessagingService.cachedAvatar(callId)));
        startRinging();
        handler.postDelayed(() -> {
            if (!handled) {
                handled = true;
                stopRinging();
                finishAndRemoveTask();
            }
        }, RING_TIMEOUT_MS);
    }

    private void showOverLockscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#0A0814"));
        getWindow().setNavigationBarColor(Color.parseColor("#0A0814"));
    }

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private View buildUi(String name, boolean isVideo, Bitmap avatar) {
        FrameLayout root = new FrameLayout(this);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{Color.parseColor("#2B105D"), Color.parseColor("#0A0814")});
        root.setBackground(bg);

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.VERTICAL);
        top.setGravity(Gravity.CENTER_HORIZONTAL);
        FrameLayout.LayoutParams topLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP);
        topLp.topMargin = dp(110);
        root.addView(top, topLp);

        TextView label = new TextView(this);
        label.setText(isVideo ? "Видеозвонок Nova" : "Аудиозвонок Nova");
        label.setTextColor(Color.parseColor("#B3FFFFFF"));
        label.setTextSize(15);
        label.setGravity(Gravity.CENTER);
        top.addView(label);

        ImageView av = new ImageView(this);
        av.setImageBitmap(avatar != null ? avatar : NovaMessagingService.letterAvatarFor(name, fromUser == null ? name : fromUser));
        LinearLayout.LayoutParams avLp = new LinearLayout.LayoutParams(dp(128), dp(128));
        avLp.topMargin = dp(36);
        top.addView(av, avLp);

        TextView title = new TextView(this);
        title.setText(name);
        title.setTextColor(Color.WHITE);
        title.setTextSize(30);
        title.setGravity(Gravity.CENTER);
        title.setPadding(dp(24), dp(24), dp(24), 0);
        top.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Входящий звонок…");
        sub.setTextColor(Color.parseColor("#99FFFFFF"));
        sub.setTextSize(16);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, dp(8), 0, 0);
        top.addView(sub);

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams btLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        btLp.bottomMargin = dp(90);
        root.addView(buttons, btLp);

        buttons.addView(roundButton("Отклонить", Color.parseColor("#EF4444"), 135f, v -> decline()));
        View spacer = new View(this);
        buttons.addView(spacer, new LinearLayout.LayoutParams(dp(96), 1));
        buttons.addView(roundButton("Принять", Color.parseColor("#22C55E"), 0f, v -> accept()));

        return root;
    }

    private View roundButton(String text, int color, float rotation, View.OnClickListener onClick) {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);

        FrameLayout circle = new FrameLayout(this);
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.OVAL);
        d.setColor(color);
        circle.setBackground(d);
        circle.setClickable(true);
        circle.setFocusable(true);
        circle.setOnClickListener(onClick);
        circle.setContentDescription(text);

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_call);
        icon.setRotation(rotation);
        FrameLayout.LayoutParams iconLp = new FrameLayout.LayoutParams(dp(34), dp(34), Gravity.CENTER);
        circle.addView(icon, iconLp);
        col.addView(circle, new LinearLayout.LayoutParams(dp(76), dp(76)));

        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(14);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(0, dp(10), 0, 0);
        col.addView(tv);
        return col;
    }

    private void accept() {
        if (handled) return;
        handled = true;
        stopRinging();
        CallActionReceiver.dismiss(this, null);
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("nova_push_tap", "1");
        open.putExtra("call_id", callId);
        open.putExtra("from_user_id", fromUser);
        open.putExtra("is_call", "1");
        open.putExtra("call_accept", "1");
        unlockThen(() -> {
            startActivity(open);
            finishAndRemoveTask();
        });
    }

    private void unlockThen(Runnable r) {
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null && km.isKeyguardLocked() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override public void onDismissSucceeded() { r.run(); }
                @Override public void onDismissCancelled() { r.run(); }
                @Override public void onDismissError() { r.run(); }
            });
        } else {
            r.run();
        }
    }

    private void decline() {
        if (handled) return;
        handled = true;
        stopRinging();
        final String c = callId, f = fromUser, me = recipient;
        new Thread(() -> CallActionReceiver.sendDecline(c, f, me)).start();
        CallActionReceiver.dismiss(this, null);
        finishAndRemoveTask();
    }

    private void startRinging() {
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int mode = am != null ? am.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;
            if (mode == AudioManager.RINGER_MODE_NORMAL) {
                Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                ringtone = RingtoneManager.getRingtone(this, uri);
                if (ringtone != null) {
                    ringtone.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
                    ringtone.play();
                }
            }
            if (mode != AudioManager.RINGER_MODE_SILENT) {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (vibrator != null && vibrator.hasVibrator()) {
                    vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 700, 500, 700, 500}, 0));
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void stopRinging() {
        try { if (ringtone != null && ringtone.isPlaying()) ringtone.stop(); } catch (Exception ignored) { }
        try { if (vibrator != null) vibrator.cancel(); } catch (Exception ignored) { }
        ringtone = null;
        vibrator = null;
    }

    @Override
    public void onBackPressed() {
        // Назад не закрывает звонок: нужно нажать «Принять» или «Отклонить».
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        stopRinging();
        if (current.get() == this) current = new WeakReference<>(null);
        super.onDestroy();
    }
}
