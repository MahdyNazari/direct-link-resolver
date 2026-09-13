# direct-link-resolver — mobile (Android)

A Capacitor + React GUI for `resolveLink`/`downloadFile` from
[`direct-link-resolver`](../../packages/direct-link-resolver), targeting Android.

This app depends on `direct-link-resolver` as a **local npm workspace package**
(symlinked from `packages/direct-link-resolver`, not installed from the
registry). Any change to the core library requires rebuilding it before this
app will see the change — see [Development](#development) below.

## Prerequisites

- **Node.js 22+** (required by the Capacitor CLI; earlier versions fail with
  `[fatal] The Capacitor CLI requires NodeJS >=22.0.0`, even if a newer Node is
  installed elsewhere on the machine — check `node -v` / `where node` for a
  stale PATH entry if you hit this).
- **Android Studio**, primarily as a source of:
  - a compatible JDK (bundled at `<Android Studio install dir>/jbr`), and
  - the Android SDK (see [SDK setup](#android-sdk-setup) if the GUI installer
    fails to complete — this happened during initial setup and the
    command-line path below is more reliable).
- Network access to `dl.google.com` and `repo.maven.apache.org` (Gradle
  dependency resolution) and to Android Studio's own SDK download endpoint. If
  these are filtered on your network, see
  [Working around filtered/unreliable network access](#working-around-filteredunreliable-network-access).

## Setup

From the **repo root**:

```bash
npm install
npm run build --workspace=packages/direct-link-resolver
```

Verify the workspace link resolved correctly (should be a symlink, not a
copy):

```bash
ls -la apps/mobile/node_modules/direct-link-resolver
```

## Development

```bash
cd apps/mobile
npm run dev        # Vite dev server, for iterating on the React UI in a browser
```

The dev server does **not** exercise `capacitorFileSink.ts` (it's a browser
context, `@capacitor/filesystem` has no native bridge there) — it's only
useful for UI iteration. To test the real download path, build for Android
(below).

## Building for Android

```bash
cd apps/mobile
npm run build          # tsc --noEmit && vite build → dist/
npx cap sync android    # copies dist/ + syncs native plugins into android/
```

Then either:

- **Via Android Studio** (recommended for the first run, gives clearer error
  UI for SDK/Gradle issues):
  ```bash
  npx cap open android
  ```
  Then **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

- **Directly via Gradle** (no Android Studio UI needed once the SDK/JDK are
  configured — see below):
  ```bash
  cd android
  gradlew.bat assembleDebug     # Windows
  ```

Output APK:
```
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

This is a **debug-signed** APK — fine for installing directly on a device via
"install from unknown sources," not for any real distribution (Play Store or
otherwise), which needs a release keystore — out of scope for now.

Remember: `npx cap sync android` must be re-run after every `npm run build`;
it does not watch `dist/`.

## Known environment issues (Windows) and how they were resolved

These were all hit during initial setup on a Windows machine with Android
Studio installed to a non-default drive/path. Documented here so the next
person (or you, on a different machine) doesn't have to rediscover them.

### `rolldown` native binding error on `vite build`

```
Error: Cannot find native binding. npm has a bug related to optional
dependencies (npm/cli#4828)
```

Fix: delete `node_modules` and `package-lock.json` **at the repo root** (not
just `apps/mobile`) and reinstall:

```bash
rm -rf node_modules apps/mobile/node_modules packages/direct-link-resolver/node_modules
rm package-lock.json
npm install
```

### `Unsupported class file major version 69` when running `gradlew`

This means Gradle is running under a JDK newer than the bundled Gradle version
supports — "major version 69" is Java 25. The fix is to point Gradle at
Android Studio's bundled JDK (JBR) instead of whatever `JAVA_HOME` resolves to
system-wide.

**Do this at the user level, not the project level** — a hardcoded,
machine-specific path in the committed `android/gradle.properties` would break
the build for anyone else (or you, on a different machine, or a future CI
job). Add it to your personal Gradle config instead:

```
# %USERPROFILE%\.gradle\gradle.properties  (Windows) — NOT committed to this repo
org.gradle.java.home=C:\\Path\\To\\Android Studio\\jbr
```

### Android SDK setup, when the Android Studio GUI installer stalls or fails silently

If the graphical SDK Manager / first-run Setup Wizard fails to complete (no
clear error, or install appears "stuck"), use the command-line tools instead
— they give explicit, per-package progress and error output instead of a
silent GUI failure:

1. Download **"Command line tools only"** for Windows from
   https://developer.android.com/studio#command-tools (a browser download, so
   you can see if it actually completes — unlike the in-app downloader).
2. Lay it out as:
   ```
   <sdk-root>\cmdline-tools\latest\bin\sdkmanager.bat
   ```
   (the zip extracts to a `cmdline-tools` folder; its *contents* go inside a
   new `latest` subfolder — an extra nesting level here is a common mistake).
3. Accept licenses and install packages explicitly:
   ```cmd
   cd <sdk-root>\cmdline-tools\latest\bin
   sdkmanager.bat --sdk_root=<sdk-root> --licenses
   sdkmanager.bat --sdk_root=<sdk-root> "platform-tools" "platforms;android-34" "build-tools;34.0.0"
   ```
4. Point the project at it via `apps/mobile/android/local.properties`
   (already gitignored, create it yourself):
   ```
   sdk.dir=C\:\\path\\to\\sdk-root
   ```
   (note the escaping: `:` → `\:`, `\` → `\\`.)

### Working around filtered/unreliable network access

Gradle needs to reach `dl.google.com` and `repo.maven.apache.org` to resolve
the Android Gradle Plugin and its transitive dependencies (as does Android
Studio's own SDK downloader, separately). If your network filters or
unreliably reaches these, dependency resolution fails with `Could not find
com.android.tools.build:gradle:...` even though the version exists.

**Fix used here:** a Gradle *init script* (applies to every Gradle project on
the machine, not just this one — and lives outside the repo, so it's not
something every contributor needs to know about unless they hit the same
issue) that adds an accessible mirror before `google()`/`mavenCentral()`:

```groovy
// %USERPROFILE%\.gradle\init.d\mirrors.init.gradle  — NOT committed to this repo
allprojects {
    buildscript {
        repositories {
            maven { url 'https://maven.aliyun.com/repository/google' }
            maven { url 'https://maven.aliyun.com/repository/public' }
            maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
        }
    }
    repositories {
        maven { url 'https://maven.aliyun.com/repository/google' }
        maven { url 'https://maven.aliyun.com/repository/public' }
    }
}
```

This mirror choice (Aliyun) happened to be reachable from the network this was
set up on; it may not be the right choice for every network — the pattern
(an `init.d` script adding a reachable mirror ahead of the defaults) is the
reusable part, not the specific URL.

If the Android Studio SDK downloader itself is also filtered (separate from
Gradle's dependency resolution, and not fixable with the script above), use
the command-line `sdkmanager` route in the previous section instead — it goes
through the same filtered domains, so this generally requires an actual
network-level fix (VPN, etc.) rather than a mirror substitution.

## Storage location (design decision, not a bug)

Downloaded files are written to the app-scoped external storage directory:

```
Android/data/<applicationId>/files/Documents/
```

via Capacitor's `Directory.Documents`. This requires **no runtime storage
permission** on Android 10+ (scoped storage).

Writing directly into the public `Download/` folder instead would require the
MediaStore API or Storage Access Framework, neither of which the core
`@capacitor/filesystem` plugin exposes — that's intentionally out of scope for
this pass. A "share to another app" / "move to Downloads" flow is a reasonable
follow-up if the app-scoped location proves inconvenient in practice.

## `DownloadSink` implementation notes

`src/capacitorFileSink.ts` implements the core library's `DownloadSink`
interface (`write`/`finish`/`abort`) to preserve the constant-memory streaming
guarantee from `downloadFile()`: the first chunk is written with
`Filesystem.writeFile`, every subsequent chunk is appended with
`Filesystem.appendFile`, each individually base64-encoded — chunks are never
accumulated in memory before being flushed to disk.
