package ru.nova.messenger;

import android.Manifest;
import android.content.ContentResolver;
import android.database.Cursor;
import android.provider.ContactsContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Чтение телефонной книги. Нужно только разрешение READ_CONTACTS —
 * Nova ничего не записывает в контакты телефона.
 */
@CapacitorPlugin(
    name = "NovaContacts",
    permissions = { @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts") }
)
public class NovaContactsPlugin extends Plugin {

    private boolean granted() {
        return getPermissionState("contacts") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void getContacts(PluginCall call) {
        if (!granted()) {
            requestPermissionForAlias("contacts", call, "afterPermission");
            return;
        }
        readAll(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (!granted()) {
            call.reject("denied");
            return;
        }
        readAll(call);
    }

    private void readAll(PluginCall call) {
        getBridge().execute(() -> {
            try {
                Map<String, String> names = new LinkedHashMap<>();
                Map<String, Set<String>> phones = new LinkedHashMap<>();
                ContentResolver cr = getContext().getContentResolver();
                String[] proj = {
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.CommonDataKinds.Phone.NORMALIZED_NUMBER,
                };
                try (Cursor c = cr.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, proj, null, null, null)) {
                    if (c != null) {
                        while (c.moveToNext()) {
                            String id = c.getString(0);
                            String name = c.getString(1);
                            String num = c.getString(2);
                            // Некоторые телефоны (Xiaomi, TECNO, Honor) хранят номер только в «нормализованном» поле
                            if (num == null || num.trim().isEmpty()) num = c.getString(3);
                            if (id == null || num == null || num.trim().isEmpty()) continue;
                            if (!names.containsKey(id)) names.put(id, name == null ? "" : name);
                            Set<String> set = phones.get(id);
                            if (set == null) { set = new LinkedHashSet<>(); phones.put(id, set); }
                            set.add(num);
                        }
                    }
                }
                JSArray list = new JSArray();
                for (Map.Entry<String, String> e : names.entrySet()) {
                    JSObject o = new JSObject();
                    o.put("name", e.getValue());
                    JSArray nums = new JSArray();
                    for (String p : phones.get(e.getKey())) nums.put(p);
                    o.put("phones", nums);
                    list.put(o);
                }
                JSObject res = new JSObject();
                res.put("contacts", list);
                call.resolve(res);
            } catch (Exception ex) {
                call.reject("read: " + ex.getMessage());
            }
        });
    }
}
