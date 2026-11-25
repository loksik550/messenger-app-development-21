package ru.nova.messenger;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.util.ArrayList;
import java.util.List;

/**
 * Приём фото, видео, файлов и текста из системного меню «Поделиться».
 * Файлы копируются во временную папку приложения, а веб-часть читает их частями
 * и показывает выбор чата.
 */
@CapacitorPlugin(name = "NovaShare")
public class NovaSharePlugin extends Plugin {

    private static final int MAX_FILES = 10;
    private static final int MAX_CHUNK = 2 * 1024 * 1024;

    private Intent pending;
    private final List<File> files = new ArrayList<>();
    private final List<String> mimes = new ArrayList<>();
    private final List<String> names = new ArrayList<>();

    @Override
    public void load() {
        Intent i = getActivity() != null ? getActivity().getIntent() : null;
        if (isShare(i)) pending = i;
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (isShare(intent)) {
            pending = intent;
            notifyListeners("shared", new JSObject(), true);
        }
    }

    private static boolean isShare(Intent i) {
        if (i == null) return false;
        String a = i.getAction();
        return Intent.ACTION_SEND.equals(a) || Intent.ACTION_SEND_MULTIPLE.equals(a);
    }

    @SuppressWarnings("deprecation")
    private static List<Uri> streams(Intent i) {
        List<Uri> out = new ArrayList<>();
        try {
            if (Intent.ACTION_SEND_MULTIPLE.equals(i.getAction())) {
                ArrayList<Uri> list = Build.VERSION.SDK_INT >= 33
                    ? i.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class)
                    : i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (list != null) out.addAll(list);
            } else {
                Uri u = Build.VERSION.SDK_INT >= 33
                    ? i.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class)
                    : i.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) out.add(u);
            }
        } catch (Exception ignored) {
        }
        if (out.isEmpty() && i.getClipData() != null) {
            for (int k = 0; k < i.getClipData().getItemCount(); k++) {
                Uri u = i.getClipData().getItemAt(k).getUri();
                if (u != null) out.add(u);
            }
        }
        return out;
    }

    private String displayName(ContentResolver cr, Uri u, int idx, String mime) {
        String name = null;
        try (Cursor c = cr.query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {
        }
        if (name == null || name.isEmpty()) {
            String ext = mime != null && mime.contains("/") ? mime.substring(mime.indexOf('/') + 1) : "bin";
            if (ext.contains(";")) ext = ext.substring(0, ext.indexOf(';'));
            name = "shared_" + idx + "." + ext;
        }
        return name.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    /** Забрать то, чем поделились: список файлов и текст. Пусто — ничего не присылали. */
    @PluginMethod
    public void take(PluginCall call) {
        final Intent i = pending;
        pending = null;
        if (i == null) {
            JSObject r = new JSObject();
            r.put("files", new JSArray());
            r.put("text", "");
            call.resolve(r);
            return;
        }
        if (getActivity() != null && getActivity().getIntent() == i) {
            getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
        }
        getBridge().execute(() -> {
            try {
                cleanup();
                ContentResolver cr = getContext().getContentResolver();
                File dir = new File(getContext().getCacheDir(), "nova_share");
                if (!dir.exists()) dir.mkdirs();
                JSArray arr = new JSArray();
                List<Uri> list = streams(i);
                for (int k = 0; k < list.size() && k < MAX_FILES; k++) {
                    Uri u = list.get(k);
                    String mime = cr.getType(u);
                    if (mime == null) mime = i.getType();
                    if (mime == null || mime.endsWith("/*")) mime = "application/octet-stream";
                    String name = displayName(cr, u, k, mime);
                    File f = new File(dir, System.currentTimeMillis() + "_" + k + "_" + name);
                    long size = 0;
                    try (InputStream in = cr.openInputStream(u); FileOutputStream out = new FileOutputStream(f)) {
                        if (in == null) continue;
                        byte[] buf = new byte[64 * 1024];
                        int n;
                        while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); size += n; }
                    }
                    files.add(f);
                    mimes.add(mime);
                    names.add(name);
                    JSObject o = new JSObject();
                    o.put("index", files.size() - 1);
                    o.put("name", name);
                    o.put("mime", mime);
                    o.put("size", size);
                    arr.put(o);
                }
                String text = "";
                CharSequence t = i.getCharSequenceExtra(Intent.EXTRA_TEXT);
                if (t != null) text = t.toString();
                String subject = i.getStringExtra(Intent.EXTRA_SUBJECT);
                if (text.isEmpty() && subject != null) text = subject;
                JSObject r = new JSObject();
                r.put("files", arr);
                r.put("text", text);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Не удалось открыть файл: " + e.getMessage());
            }
        });
    }

    /** Прочитать часть файла (base64), чтобы веб-часть собрала его целиком. */
    @PluginMethod
    public void read(PluginCall call) {
        final int index = call.getInt("index", -1);
        final long offset = call.getLong("offset", 0L);
        final int length = Math.min(call.getInt("length", MAX_CHUNK), MAX_CHUNK);
        if (index < 0 || index >= files.size()) { call.reject("Файл не найден"); return; }
        getBridge().execute(() -> {
            try (RandomAccessFile raf = new RandomAccessFile(files.get(index), "r")) {
                raf.seek(offset);
                byte[] buf = new byte[length];
                int n = raf.read(buf);
                JSObject r = new JSObject();
                r.put("data", n > 0 ? Base64.encodeToString(buf, 0, n, Base64.NO_WRAP) : "");
                r.put("read", Math.max(n, 0));
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Не удалось прочитать файл: " + e.getMessage());
            }
        });
    }

    /** Удалить временные копии после отправки. */
    @PluginMethod
    public void clear(PluginCall call) {
        cleanup();
        call.resolve();
    }

    private void cleanup() {
        for (File f : files) {
            try { f.delete(); } catch (Exception ignored) { }
        }
        files.clear();
        mimes.clear();
        names.clear();
        try {
            File dir = new File(getContext().getCacheDir(), "nova_share");
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
        } catch (Exception ignored) {
        }
    }
}
