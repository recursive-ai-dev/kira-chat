package dev.kira.chat;

import android.app.Activity;
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
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

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
    private String pendingName;
    private String pendingText;
    private OnBackInvokedCallback backCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
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

        if (state != null) web.restoreState(state);
        else web.loadUrl(APP_URL);
        registerBack();
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
            return WindowInsets.CONSUMED;
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
            decor.getWindowInsetsController().setSystemBarsAppearance(dawn ? mask : 0, mask);
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
            String text = pendingText;
            pendingText = null;
            if (result == RESULT_OK && data != null && data.getData() != null && text != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    out.write(text.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this, "Saved " + pendingName, Toast.LENGTH_SHORT).show();
                } catch (IOException | RuntimeException e) {
                    Toast.makeText(this, "Could not save the file", Toast.LENGTH_LONG).show();
                }
            }
        } else {
            super.onActivityResult(req, result, data);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
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
        web.destroy();
        super.onDestroy();
    }

    /** Called by the page as window.KiraHost. */
    private final class Host {
        @JavascriptInterface
        public void saveFile(String name, String text) {
            runOnUiThread(() -> {
                pendingName = name;
                pendingText = text;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/json")
                    .putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (ActivityNotFoundException e) {
                    pendingText = null;
                    Toast.makeText(MainActivity.this, "No app can save files here", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void setTheme(String theme) {
            runOnUiThread(() -> applyTheme("dawn".equals(theme)));
        }
    }
}
