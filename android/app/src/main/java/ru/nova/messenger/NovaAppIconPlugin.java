package ru.nova.messenger;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Смена значка приложения на рабочем столе (Nova Pro).
 * В манифесте объявлены activity-alias: IconClassic, IconOcean, IconSunset, IconMono.
 * Включаем выбранный, остальные выключаем.
 */
@CapacitorPlugin(name = "NovaAppIcon")
public class NovaAppIconPlugin extends Plugin {

    private static final String[] ICONS = {"classic", "ocean", "sunset", "mono"};

    private static String aliasName(String id) {
        return "ru.nova.messenger.Icon" + Character.toUpperCase(id.charAt(0)) + id.substring(1);
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject r = new JSObject();
        r.put("value", true);
        call.resolve(r);
    }

    @PluginMethod
    public void current(PluginCall call) {
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        String cur = "classic";
        for (String id : ICONS) {
            int st = pm.getComponentEnabledSetting(new ComponentName(ctx, aliasName(id)));
            if (st == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) { cur = id; break; }
        }
        JSObject r = new JSObject();
        r.put("name", cur);
        call.resolve(r);
    }

    @PluginMethod
    public void change(PluginCall call) {
        String name = call.getString("name", "classic");
        boolean known = false;
        for (String id : ICONS) if (id.equals(name)) known = true;
        if (!known) { call.reject("Unknown icon"); return; }

        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        try {
            // Сначала включаем нужный, потом выключаем остальные — чтобы
            // на рабочем столе ни на миг не осталось ни одного значка.
            pm.setComponentEnabledSetting(
                new ComponentName(ctx, aliasName(name)),
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP);
            for (String id : ICONS) {
                if (id.equals(name)) continue;
                pm.setComponentEnabledSetting(
                    new ComponentName(ctx, aliasName(id)),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Не удалось сменить значок", e);
        }
    }
}
