# IEM mobile app (Android)

An Android app that opens the live website, **https://iemsms.com**, built with [Capacitor](https://capacitorjs.com).

- **No separate copy of the web app.** The app loads the live site, so every Netlify deploy reaches phone users the moment the page reloads. Web, Windows and Android all use the same Supabase data.
- Website changes **never** need a new app build. Only changes inside `mobile/` do.
- Logins are remembered on each phone, like in a browser.

## What the app adds on top of the website

| Feature | Notes |
| --- | --- |
| Downloads | PDF reports, Excel exports and homework files are saved to **Downloads/IEM** and opened. |
| Links | "Open in new tab" links (YouTube, Zoom, PDFs) open in the phone's browser. |
| Camera & microphone | For live classes. Android asks the first time. Screen sharing is not possible on phones. |
| File uploads | The normal "choose file" button works (gallery, files, camera). |
| Back button | Goes back a page; on the first page it puts IEM in the background (you stay logged in). |
| Offline screen | "Can't reach IEM" page that reconnects automatically (`www/offline.html`). |

The code for these is in `android/app/src/main/java/com/iemsms/app/IemAndroidPlugin.java` and
`android/app/src/main/res/raw/iem_bridge.js`. Only pages from iemsms.com (and the Netlify
address) can use them.

The website can detect the app: its user agent ends with `IEMMobile/<version>`.

## Known limitation

PDF **previews inside the page** (the PDF viewer popup) stay blank, because Android's web view
cannot show PDFs. Use the **Download** or **Open in new tab** buttons instead. Fixing the preview
needs a small website change (planned for the mobile screen review).

## Get the APK

GitHub builds it automatically on pull requests that change `mobile/`:
**Actions → Mobile app (Android) → latest run → Artifacts → IEM-Android-app**.

To install: copy the `.apk` to the phone, open it, and allow "Install unknown apps" for the
browser/file manager when Android asks.

### Signing (important before sharing widely)

Without extra setup, each build is signed with a temporary test key. Android then refuses to
install a newer build over an older one: users must uninstall the old app first (they just log
in again). To make updates seamless, create a permanent key once and add it as GitHub
repository secrets: `IEM_KEYSTORE_BASE64`, `IEM_KEYSTORE_PASSWORD`, `IEM_KEY_ALIAS`,
`IEM_KEY_PASSWORD`. Keep a backup of that key; losing it means users must reinstall.

## Develop locally

Requires Node 22+, JDK 21 and Android Studio.

```bash
cd mobile
npm install
npx cap sync android
npx cap open android   # opens Android Studio; press Run
```
