package dev.kira.chat;

import android.app.Activity;
import android.app.AlertDialog;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.io.IOException;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

/**
 * Hosts the single-file Kira app in a WebView. Everything runs on the device:
 * the page is served from a fixed https origin out of the APK's assets, and any
 * other request is refused.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + HOST + "/Kira.html";
    private static final int REQ_FILE = 1;
    private static final int REQ_SAVE = 2;
    private static final int NIGHT_BG = 0xFF0D1517;
    private static final int DAWN_BG = 0xFFF7F5EF;
    // All export storage and provider I/O is serialized, including across activity recreation.
    private static final ExecutorService EXPORT_IO = Executors.newSingleThreadExecutor();
    private static final String SAVE_PICKER_OPEN = "kira.savePickerOpen";
    private static final String SAVE_PICKER_ID = "kira.savePickerId";
    // Closes an open dialog, or leaves a secondary screen; reports whether it did.
    private static final String BACK_SCRIPT =
        "(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true;}"
        + "var a=document.querySelector('.nav-item.active[data-screen]');"
        + "if(a&&a.dataset.screen!=='conversation'){"
        + "document.querySelector('.nav-item[data-screen=conversation]').click();return true;}"
        + "return false;})()";

    private FrameLayout root;
    private WebView web;
    private ValueCallback<Uri[]> filePicker;
    private PendingExportStore exports;
    private boolean exportBusy;
    private boolean savePickerOpen;
    private String savePickerId;
    private OnBackInvokedCallback backCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        exports = new PendingExportStore(new File(getNoBackupFilesDir(), "exports"));
        savePickerId = state != null ? state.getString(SAVE_PICKER_ID) : null;
        savePickerOpen = state != null && state.getBoolean(SAVE_PICKER_OPEN, false) && savePickerId != null;
        exportBusy = savePickerOpen;
        root = new FrameLayout(this);
        root.setBackgroundColor(NIGHT_BG);
        web = new WebView(this);
        web.setBackgroundColor(NIGHT_BG);
        root.addView(web, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        applyInsets();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Host(), "KiraHost");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("blob".equals(u.getScheme()) || "data".equals(u.getScheme())) return null;
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) {
                    String path = u.getPath();
                    if ("/Kira.html".equals(path) || "/".equals(path)) return page();
                }
                return refuse();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return true; // the app has no external links
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (filePicker != null) filePicker.onReceiveValue(null);
                filePicker = cb;
                try {
                    startActivityForResult(p.createIntent(), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    filePicker = null;
                    return false;
                }
                return true;
            }
        });

        if (state == null || web.restoreState(state) == null) web.loadUrl(APP_URL);
        registerBack();
        if (!savePickerOpen) recoverExport();
    }

    private WebResourceResponse page() {
        try {
            InputStream in = getAssets().open("Kira.html");
            WebResourceResponse r = new WebResourceResponse("text/html", "utf-8", in);
            r.setStatusCodeAndReasonPhrase(200, "OK");
            return r;
        } catch (IOException e) {
            return refuse();
        }
    }

    private static WebResourceResponse refuse() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8",
            new java.io.ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(403, "Offline");
        return r;
    }

    /** Edge-to-edge is mandatory on recent Android; keep the page clear of bars and the keyboard. */
    private void applyInsets() {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                l = bars.left; t = bars.top; r = bars.right; b = Math.max(bars.bottom, ime.bottom);
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop();
                r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return Build.VERSION.SDK_INT >= 30
                ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
        });
        if (Build.VERSION.SDK_INT < 30) {
            root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        } else {
            getWindow().setDecorFitsSystemWindows(false);
        }
    }

    private void applyTheme(boolean dawn) {
        int bg = dawn ? DAWN_BG : NIGHT_BG;
        root.setBackgroundColor(bg);
        web.setBackgroundColor(bg);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            int mask = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            android.view.WindowInsetsController controller = decor.getWindowInsetsController();
            if (controller != null) controller.setSystemBarsAppearance(dawn ? mask : 0, mask);
        } else {
            int f = decor.getSystemUiVisibility();
            int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
            decor.setSystemUiVisibility(dawn ? f | light : f & ~light);
        }
    }

    private void registerBack() {
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
    }

    private void handleBack() {
        web.evaluateJavascript(BACK_SCRIPT, handled -> {
            if (!"true".equals(handled)) finish();
        });
    }

    @Override
    // API 33+ uses the registered OnBackInvokedCallback; this override only handles older OSes.
    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT >= 33) super.onBackPressed();
        else handleBack();
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        if (req == REQ_FILE && filePicker != null) {
            filePicker.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            filePicker = null;
        } else if (req == REQ_SAVE) {
            // A result belongs to the export that opened this picker, even if another
            // activity has since discarded it and staged a different pending export.
            if (!savePickerOpen || savePickerId == null) return;
            String expectedId = savePickerId;
            savePickerOpen = false;
            savePickerId = null;
            exportBusy = true;
            Uri destination = result == RESULT_OK && data != null ? data.getData() : null;
            if (result == RESULT_OK && destination == null) {
                exportResult("error", "export", "The document picker returned no file. The pending export is retained.");
                return;
            }
            EXPORT_IO.execute(() -> completeExport(destination, expectedId));
        } else {
            super.onActivityResult(req, result, data);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putBoolean(SAVE_PICKER_OPEN, savePickerOpen);
        out.putString(SAVE_PICKER_ID, savePickerId);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        }
        if (filePicker != null) {
            filePicker.onReceiveValue(null);
            filePicker = null;
        }
        web.removeJavascriptInterface("KiraHost");
        root.removeView(web);
        web.destroy();
        super.onDestroy();
    }

    private void openSavePicker(PendingExportStore.Entry entry) {
        if (isDestroyed() || isFinishing()) return; // durable staging is recovered on the next launch
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, entry.name);
        savePickerOpen = true;
        savePickerId = entry.id;
        exportBusy = true;
        try {
            startActivityForResult(intent, REQ_SAVE);
        } catch (ActivityNotFoundException | SecurityException e) {
            savePickerOpen = false;
            savePickerId = null;
            exportBusy = false;
            exportResult("error", entry.name, "No app can save files here. The export remains available to retry.");
        }
    }

    private void completeExport(Uri destination, String expectedId) {
        String name = "export";
        try {
            // Check identity before opening/truncating the document provider's file.
            // EXPORT_IO serializes this check, the write, and all staging/discards.
            PendingExportStore.Entry entry = exports.requireEntry(expectedId);
            name = entry.name;
            if (destination == null) {
                exports.discard(expectedId);
                exportResult("cancelled", name, "Export cancelled");
                return;
            }
            try (OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                exports.writeTo(expectedId, out);
            }
            // Clear only after the provider has successfully closed the destination.
            try {
                exports.discard(expectedId);
                exportResult("saved", name, "Saved " + name);
            } catch (IOException e) {
                exportResult("saved", name, "Saved " + name + ". A pending local copy remains available.");
            }
        } catch (IOException | RuntimeException e) {
            exportResult("error", name, "Could not save the file. The pending export is retained; retry Export to recover it.");
        }
    }

    private void exportResult(String status, String name, String message) {
        runOnUiThread(() -> {
            if (isDestroyed() || isFinishing()) return;
            exportBusy = false;
            Toast.makeText(this, message, "error".equals(status) ? Toast.LENGTH_LONG : Toast.LENGTH_SHORT).show();
            String detail = "{status:" + JSONObject.quote(status) + ",name:" + JSONObject.quote(name)
                + ",message:" + JSONObject.quote(message) + "}";
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('kira-export-result',{detail:"
                + detail + "}));", null);
        });
    }

    private void recoverExport() {
        exportBusy = true;
        EXPORT_IO.execute(() -> {
            try {
                PendingExportStore.Entry entry = exports.peek();
                runOnUiThread(() -> {
                    if (isDestroyed() || isFinishing()) return;
                    if (entry == null) { exportBusy = false; return; }
                    new AlertDialog.Builder(this)
                        .setTitle("Finish pending export")
                        .setMessage("A saved copy of " + entry.name + " is waiting for a destination.")
                        .setPositiveButton("Save", (dialog, which) -> openSavePicker(entry))
                        .setNegativeButton("Discard", (dialog, which) ->
                            EXPORT_IO.execute(() -> completeExport(null, entry.id)))
                        .setOnCancelListener(dialog -> exportBusy = false)
                        .show();
                });
            } catch (IOException | RuntimeException e) {
                runOnUiThread(() -> {
                    if (isDestroyed() || isFinishing()) return;
                    new AlertDialog.Builder(this)
                        .setTitle("Damaged pending export")
                        .setMessage("This unfinished export cannot be read. Your conversation is still saved in Kira. Discard the damaged copy to export again.")
                        .setPositiveButton("Discard", (dialog, which) -> EXPORT_IO.execute(() -> {
                            try {
                                exports.discardDamaged();
                                exportResult("cancelled", "export", "Damaged pending export discarded");
                            } catch (IOException | RuntimeException failure) {
                                exportResult("error", "export", "Could not discard the pending export");
                            }
                        }))
                        .setNegativeButton("Keep", (dialog, which) -> exportBusy = false)
                        .setOnCancelListener(dialog -> exportBusy = false)
                        .show();
                });
            }
        });
    }

    /** Called by the page as window.KiraHost. */
    private final class Host {
        @JavascriptInterface
        public void saveFile(String name, String text) {
            runOnUiThread(() -> {
                if (isDestroyed() || isFinishing()) return;
                if (exportBusy) {
                    Toast.makeText(MainActivity.this, "Finish or cancel the current export first", Toast.LENGTH_LONG).show();
                    return;
                }
                exportBusy = true;
                EXPORT_IO.execute(() -> {
                    try {
                        try {
                            if (exports.peek() != null) { runOnUiThread(MainActivity.this::recoverExport); return; }
                        } catch (IOException damaged) {
                            runOnUiThread(MainActivity.this::recoverExport);
                            return;
                        }
                        PendingExportStore.Entry entry = exports.stage(name, text);
                        runOnUiThread(() -> openSavePicker(entry));
                    } catch (IOException | RuntimeException e) {
                        exportResult("error", name, "Could not prepare the export. Your conversation has not changed.");
                    }
                });
            });
        }

        @JavascriptInterface
        public void setTheme(String theme) {
            runOnUiThread(() -> { if (!isDestroyed()) applyTheme("dawn".equals(theme)); });
        }

    }
}
