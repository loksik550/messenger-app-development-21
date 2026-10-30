package ru.nova.messenger;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import ru.rustore.sdk.appupdate.listener.InstallStateUpdateListener;
import ru.rustore.sdk.appupdate.manager.RuStoreAppUpdateManager;
import ru.rustore.sdk.appupdate.manager.factory.RuStoreAppUpdateManagerFactory;
import ru.rustore.sdk.appupdate.model.AppUpdateInfo;
import ru.rustore.sdk.appupdate.model.AppUpdateOptions;
import ru.rustore.sdk.appupdate.model.AppUpdateType;
import ru.rustore.sdk.appupdate.model.InstallState;
import ru.rustore.sdk.appupdate.model.InstallStatus;
import ru.rustore.sdk.appupdate.model.UpdateAvailability;

/**
 * Обновление Nova прямо в приложении через RuStore SDK.
 * check()  — есть ли новая версия в RuStore;
 * start()  — скачать обновление в фоне (события "progress" / "state");
 * complete() — установить скачанное и перезапустить приложение.
 */
@CapacitorPlugin(name = "NovaUpdate")
public class NovaUpdatePlugin extends Plugin {
    private static final String TAG = "NovaUpdate";
    private RuStoreAppUpdateManager manager;
    private AppUpdateInfo lastInfo;
    private InstallStateUpdateListener listener;
    private final AppUpdateOptions silent = new AppUpdateOptions.Builder().appUpdateType(AppUpdateType.SILENT).build();

    private RuStoreAppUpdateManager mgr() {
        if (manager == null) manager = RuStoreAppUpdateManagerFactory.INSTANCE.create(getContext().getApplicationContext());
        return manager;
    }

    @PluginMethod
    public void check(PluginCall call) {
        try {
            mgr().getAppUpdateInfo()
                .addOnSuccessListener((AppUpdateInfo info) -> {
                    lastInfo = info;
                    JSObject r = new JSObject();
                    r.put("available", info.getUpdateAvailability() == UpdateAvailability.UPDATE_AVAILABLE);
                    r.put("downloaded", info.getInstallStatus() == InstallStatus.DOWNLOADED);
                    r.put("versionCode", info.getAvailableVersionCode());
                    call.resolve(r);
                })
                .addOnFailureListener(e -> call.reject("check failed: " + e.getMessage()));
        } catch (Throwable t) {
            call.reject("RuStore SDK unavailable: " + t.getMessage());
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (lastInfo == null) { call.reject("call check() first"); return; }
        try {
            if (listener != null) { try { mgr().unregisterListener(listener); } catch (Throwable ignored) {} }
            listener = new InstallStateUpdateListener() { @Override public void onStateUpdated(InstallState state) {
                JSObject ev = new JSObject();
                int st = state.getInstallStatus();
                long total = state.getTotalBytesToDownload();
                ev.put("status", st == InstallStatus.DOWNLOADED ? "downloaded" : st == InstallStatus.DOWNLOADING ? "downloading"
                    : st == InstallStatus.FAILED ? "failed" : "pending");
                ev.put("progress", total > 0 ? (int) (state.getBytesDownloaded() * 100 / total) : 0);
                notifyListeners("state", ev);
                if (st == InstallStatus.DOWNLOADED || st == InstallStatus.FAILED) {
                    try { mgr().unregisterListener(listener); } catch (Throwable ignored) {}
                }
            } };
            mgr().registerListener(listener);
            mgr().startUpdateFlow(lastInfo, silent)
                .addOnSuccessListener(code -> call.resolve())
                .addOnFailureListener(e -> {
                    try { mgr().unregisterListener(listener); } catch (Throwable ignored) {}
                    call.reject("start failed: " + e.getMessage());
                });
        } catch (Throwable t) {
            call.reject("start error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void complete(PluginCall call) {
        try {
            mgr().completeUpdate(silent)
                .addOnSuccessListener(v -> call.resolve())
                .addOnFailureListener(e -> call.reject("complete failed: " + e.getMessage()));
        } catch (Throwable t) {
            Log.w(TAG, "complete error: " + t.getMessage());
            call.reject("complete error: " + t.getMessage());
        }
    }
}
