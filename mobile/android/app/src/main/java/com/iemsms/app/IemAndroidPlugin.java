package com.iemsms.app;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Adds the phone-specific behaviour the IEM website needs inside the app:
 *  - saves downloaded files (PDF reports, Excel exports, homework files) to Downloads/IEM
 *  - opens "new tab" links (YouTube, Zoom, PDFs...) in the phone's normal browser
 *  - makes the Back button go back a page, or send the app to the background
 *
 * Only pages from the IEM website can talk to this code.
 */
@CapacitorPlugin(name = "IemAndroid")
public class IemAndroidPlugin extends Plugin {

    private static final String TAG = "IemAndroid";
    private static final String DOWNLOAD_FOLDER = "IEM";
    private static final Set<String> TRUSTED_ORIGINS = new HashSet<>(
        Arrays.asList("https://iemsms.com", "https://www.iemsms.com", "https://adminsmstest1.netlify.app")
    );

    private final ExecutorService background = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        WebView webView = getBridge().getWebView();
        setUpWebsiteBridge(webView);
        setUpDownloadListener(webView);
        setUpBackButton(webView);
    }

    // ---------------------------------------------------------------------
    // Website <-> app connection

    private void setUpWebsiteBridge(WebView webView) {
        if (
            !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            Logger.warn(TAG, "This phone's WebView is too old for in-app downloads; please update Android System WebView.");
            return;
        }

        WebViewCompat.addWebMessageListener(webView, "IEMAndroid", TRUSTED_ORIGINS, (view, message, sourceOrigin, isMainFrame, reply) -> {
            if (!isMainFrame || message.getData() == null) return;
            handleMessage(message.getData());
        });

        WebViewCompat.addDocumentStartJavaScript(webView, readBridgeScript(), TRUSTED_ORIGINS);
    }

    private String readBridgeScript() {
        try (InputStream in = getContext().getResources().openRawResource(R.raw.iem_bridge)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            Logger.error(TAG, "Could not read iem_bridge.js", e);
            return "";
        }
    }

    private void handleMessage(String json) {
        try {
            JSONObject message = new JSONObject(json);
            switch (message.optString("type")) {
                case "save":
                    String name = message.optString("name");
                    String mime = message.optString("mime", "application/octet-stream");
                    String data = message.optString("data");
                    background.execute(() -> saveFile(name, mime, data));
                    break;
                case "download":
                    downloadUrl(message.optString("url"), message.optString("name"), null);
                    break;
                case "open":
                    openInBrowser(message.optString("url"));
                    break;
                case "error":
                    toast(message.optString("message", "Something went wrong."));
                    break;
                default:
                    break;
            }
        } catch (Exception e) {
            Logger.error(TAG, "Bad message from website", e);
        }
    }

    // ---------------------------------------------------------------------
    // Files the website creates itself (PDFs, Excel exports)

    private void saveFile(String requestedName, String givenMime, String base64) {
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            String name = cleanFileName(requestedName, givenMime);
            String mime = betterMimeType(name, givenMime);
            Context context = getContext();
            Uri uri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = context.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + DOWNLOAD_FOLDER);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IOException("Could not create the file");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IOException("Could not open the file");
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } else {
                // Older Android: save in the app's own Downloads folder (no permission needed).
                File folder = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (folder == null) folder = new File(context.getFilesDir(), "downloads");
                if (!folder.exists() && !folder.mkdirs()) throw new IOException("Could not create folder");
                File file = uniqueFile(folder, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
            }

            final Uri savedUri = uri;
            getActivity().runOnUiThread(() -> {
                toast("Saved to Downloads/" + DOWNLOAD_FOLDER + ": " + name);
                openFile(savedUri, mime);
            });
        } catch (Exception e) {
            Logger.error(TAG, "Saving file failed", e);
            toast("Could not save the file.");
        }
    }

    private void openFile(Uri uri, String mime) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, mime);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException e) {
            toast("Saved. Install an app that can open this type of file to view it.");
        }
    }

    // ---------------------------------------------------------------------
    // Files on the internet (homework attachments, resources...)

    private void setUpDownloadListener(WebView webView) {
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
            downloadUrl(url, URLUtil.guessFileName(url, contentDisposition, mimeType), mimeType);
        });
    }

    private void downloadUrl(String url, String requestedName, String mimeType) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        try {
            Context context = getContext();
            String mime = mimeType;
            if (mime == null || mime.isEmpty()) {
                String extension = MimeTypeMap.getFileExtensionFromUrl(url);
                mime = extension == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase());
            }
            String name = (requestedName == null || requestedName.trim().isEmpty())
                ? URLUtil.guessFileName(url, null, mime)
                : requestedName;
            name = cleanFileName(name, mime);

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            if (mime != null) request.setMimeType(mime);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            request.addRequestHeader("User-Agent", getBridge().getWebView().getSettings().getUserAgentString());
            request.setTitle(name);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, DOWNLOAD_FOLDER + "/" + name);
            } else {
                request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, name);
            }

            DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);
            toast("Downloading " + name + "…");
        } catch (Exception e) {
            Logger.error(TAG, "Download failed", e);
            openInBrowser(url);
        }
    }

    // ---------------------------------------------------------------------
    // Links and Back button

    private void openInBrowser(String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException e) {
            toast("No app found to open this link.");
        }
    }

    private void setUpBackButton(WebView webView) {
        getActivity()
            .getOnBackPressedDispatcher()
            .addCallback(
                getActivity(),
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            // Keep IEM running (and logged in) instead of closing it.
                            getActivity().moveTaskToBack(true);
                        }
                    }
                }
            );
    }

    // ---------------------------------------------------------------------
    // Helpers

    private static String cleanFileName(String name, String mime) {
        String clean = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (clean.isEmpty() || clean.equals(".") || clean.equals("..")) clean = "IEM-download";
        if (clean.length() > 120) clean = clean.substring(clean.length() - 120);
        if (!clean.contains(".") && mime != null) {
            String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
            if (extension != null) clean = clean + "." + extension;
        }
        return clean;
    }

    // Some exports (e.g. Excel) arrive as a generic type; use the file extension instead
    // so Android knows which app can open the file.
    private static String betterMimeType(String name, String mime) {
        if (mime != null && !mime.isEmpty() && !mime.equals("application/octet-stream")) return mime;
        int dot = name.lastIndexOf('.');
        if (dot >= 0) {
            String fromExtension = MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase());
            if (fromExtension != null) return fromExtension;
        }
        return "application/octet-stream";
    }

    private static File uniqueFile(File folder, String name) {
        File file = new File(folder, name);
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String extension = dot > 0 ? name.substring(dot) : "";
        int counter = 1;
        while (file.exists()) {
            file = new File(folder, base + " (" + counter++ + ")" + extension);
        }
        return file;
    }

    private void toast(String text) {
        getActivity().runOnUiThread(() -> Toast.makeText(getContext(), text, Toast.LENGTH_LONG).show());
    }
}
