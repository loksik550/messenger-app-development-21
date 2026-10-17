package ru.nova.messenger;

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
}
