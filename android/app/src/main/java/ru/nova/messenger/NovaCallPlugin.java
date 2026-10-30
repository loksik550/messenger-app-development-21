package ru.nova.messenger;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NovaCall")
public class NovaCallPlugin extends Plugin {

    @PluginMethod
    public void callStarted(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).setOverLockscreen(true);
            IncomingCallActivity.finishIfShowing(null);
            CallActionReceiver.dismissAllCalls(getContext());
            call.resolve();
        });
    }

    @PluginMethod
    public void callEnded(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).setOverLockscreen(false);
            IncomingCallActivity.finishIfShowing(null);
            CallActionReceiver.dismissAllCalls(getContext());
            call.resolve();
        });
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("open_failed");
        }
    }
}
