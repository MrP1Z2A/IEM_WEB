# IEM desktop app (Windows and Mac)

A secure Windows app around the live website, **https://iemsms.com**.

- **No separate copy of the web app.** The app loads the live site, so every Netlify deploy reaches desktop users the moment they reload. Web, desktop (and later mobile) all use the same Supabase data.
- Logins are remembered per computer, the same way a browser remembers them.
- Website changes **never** need a new desktop release. Only changes inside `desktop/` do.

## What the app adds on top of the website

| Feature | Notes |
| --- | --- |
| Single window | Opening IEM again brings the existing window to the front. |
| Remembers size/position | Saved in `%APPDATA%\IEM\window-state.json`. |
| Offline screen | Friendly "Can't reach IEM" page that reconnects automatically. |
| External links | Links to other sites (Zoom, YouTube, …) open in the normal browser. |
| Camera, microphone, screen share | Allowed for iemsms.com only. Screen share shows a "Choose what to share" picker. |
| Windows notifications | Available to the website through `window.iemDesktop.notify(...)` (see below). |
| Right-click menu | Copy/paste, spelling suggestions, save image, copy link. |
| Menu bar | Hidden; press **Alt** to show (reload, zoom, check for updates, about). |
| Auto-update | Checks GitHub Releases at start-up and every 4 hours, then asks to restart. |

## For the website: `window.iemDesktop`

Inside the app, the website can detect the desktop app and use extra features. In a normal browser `window.iemDesktop` is `undefined`, so always check first:

```ts
if (window.iemDesktop?.isDesktop) {
  window.iemDesktop.notify({ title: 'New message', body: 'From Ms. Lee' });
  window.iemDesktop.flashTaskbar();
}
```

| Member | Purpose |
| --- | --- |
| `isDesktop` | `true` inside the app |
| `version` | Desktop app version, e.g. `"1.0.0"` |
| `platform` | `"win32"` |
| `notify({ title, body?, silent? })` | Shows a Windows notification; clicking it focuses IEM |
| `flashTaskbar()` | Flashes the taskbar button if the app isn't focused |

The user agent also ends with `IEMDesktop/<version>`.

## Develop

```bash
cd desktop
npm install
npm start            # opens https://iemsms.com
npm run start:local  # opens http://localhost:5173 (run `npm run dev` in the repo root first)
```

## Release a new desktop version

1. Bump `version` in `desktop/package.json` (e.g. `1.0.1`) and commit.
2. Push a matching tag:
   ```bash
   git tag desktop-v1.0.1
   git push origin desktop-v1.0.1
   ```
3. The **Desktop app (Windows)** GitHub Action builds `IEM-Setup-1.0.1.exe` and publishes it as a GitHub Release. Installed apps update themselves within a few hours.

For a test build without publishing, run the workflow manually (Actions → Desktop app (Windows) → Run workflow) and download the installer from the run's artifacts.

> Auto-update reads the repository's **latest** GitHub Release. If you ever publish releases for something else in this repo, mark them as pre-release so they don't become "latest".

## Installing

Share the `IEM-Setup-x.y.z.exe` link from the GitHub Release page. The installer needs no admin rights and adds Desktop and Start-menu shortcuts.

Because the installer is not code-signed, Windows SmartScreen shows **"Windows protected your PC"** the first time. Users click **More info → Run anyway**. A code-signing certificate removes this warning.

## Mac

The same app is built for Mac as `IEM-x.y.z-mac.dmg` (one file for both Intel and Apple-silicon Macs)
by the **Mac** job of the same GitHub Action. Download it from the run's **IEM-Mac-app** artifact.

**Installing:** open the `.dmg`, drag **IEM** into **Applications**, then open it. Because the app is
not signed with a paid Apple Developer certificate, macOS blocks it the first time:

1. Open IEM once and click **Done** on the warning.
2. Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to IEM, then confirm.

After that it opens normally. An Apple Developer account ($99/year) would remove this warning (signing + notarization).

**Mac differences:**

- Camera and microphone: macOS asks the first time.
- Screen sharing: macOS needs **Screen & System Audio Recording** permission (IEM explains how when needed).
- No automatic app updates on Mac (macOS only allows them for signed apps). Website changes still appear instantly;
  for a new desktop version, Help → Check for updates opens the downloads page.
