package ru.nova.messenger;

import android.app.Activity;
import android.util.Log;

import ru.rustore.sdk.appupdate.listener.InstallStateUpdateListener;
import ru.rustore.sdk.appupdate.manager.RuStoreAppUpdateManager;
import ru.rustore.sdk.appupdate.manager.factory.RuStoreAppUpdateManagerFactory;
import ru.rustore.sdk.appupdate.model.AppUpdateInfo;
import ru.rustore.sdk.appupdate.model.AppUpdateOptions;
import ru.rustore.sdk.appupdate.model.AppUpdateType;
import ru.rustore.sdk.appupdate.model.InstallState;
import ru.rustore.sdk.appupdate.model.InstallStatus;
import ru.rustore.sdk.appupdate.model.UpdateAvailability;

final class NovaAutoUpdate {
    private static final String TAG = "NovaAutoUpdate";
    private static boolean started = false;

    private NovaAutoUpdate() {}

    static void check(Activity activity) {
        if (started) return;
        started = true;
        final RuStoreAppUpdateManager manager;
        try {
            manager = RuStoreAppUpdateManagerFactory.INSTANCE.create(activity.getApplicationContext());
        } catch (Throwable t) {
            Log.w(TAG, "RuStore SDK unavailable: " + t.getMessage());
            return;
        }
        final AppUpdateOptions silent = new AppUpdateOptions.Builder().appUpdateType(AppUpdateType.SILENT).build();
        final InstallStateUpdateListener[] holder = new InstallStateUpdateListener[1];
        holder[0] = new InstallStateUpdateListener() {
            @Override
            public void onStateUpdated(InstallState state) {
                int st = state.getInstallStatus();
                if (st == InstallStatus.DOWNLOADED) {
                    try { manager.unregisterListener(holder[0]); } catch (Throwable ignored) {}
                    manager.completeUpdate(silent)
                        .addOnFailureListener(e -> Log.w(TAG, "complete failed: " + e.getMessage()));
                } else if (st == InstallStatus.FAILED) {
                    try { manager.unregisterListener(holder[0]); } catch (Throwable ignored) {}
                }
            }
        };
        try {
            manager.getAppUpdateInfo()
                .addOnSuccessListener((AppUpdateInfo info) -> {
                    if (info.getUpdateAvailability() != UpdateAvailability.UPDATE_AVAILABLE) return;
                    manager.registerListener(holder[0]);
                    manager.startUpdateFlow(info, silent)
                        .addOnFailureListener(e -> {
                            Log.w(TAG, "start failed: " + e.getMessage());
                            try { manager.unregisterListener(holder[0]); } catch (Throwable ignored) {}
                        });
                })
                .addOnFailureListener(e -> Log.w(TAG, "info failed: " + e.getMessage()));
        } catch (Throwable t) {
            Log.w(TAG, "update check error: " + t.getMessage());
        }
    }
}
