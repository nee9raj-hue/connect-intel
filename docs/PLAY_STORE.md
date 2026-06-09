# Publish Connect Intel on Google Play

The Android app is a **Capacitor** shell that loads **https://connectintel.net** in a full-screen WebView. Web updates deploy via Vercel; you only resubmit to Play when native config, icons, or version change.

**App ID:** `net.connectintel.app`  
**Privacy policy:** https://connectintel.net/privacy

---

## 1. One-time setup on your Mac

### Install tools

1. **Android Studio** — https://developer.android.com/studio  
   - During setup, install **Android SDK**, **SDK Platform 36**, and **Android SDK Build-Tools**.
2. **JDK 17+** — Android Studio bundles one, or install Temurin 17.

Set environment (add to `~/.zshrc` if needed):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

### Google Sign-In for Android (required)

Google blocks web OAuth inside the app WebView. The app uses **native Google Sign-In** on Android. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**:

1. Keep your existing **Web client** (used by connectintel.net).
2. Create an **Android** OAuth client:
   - Package name: `net.connectintel.app`
   - SHA-1 certificate fingerprint (see below)

Get SHA-1 from your upload keystore:

```bash
keytool -list -v -keystore connect-intel-upload.jks -alias connect-intel | grep SHA1
```

For debug builds during testing, also add the debug keystore SHA-1:

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

After adding SHA-1, wait a few minutes before testing sign-in on device.

### Google Play Console

1. Create a [Google Play Console](https://play.google.com/console) account (**$25 one-time**).
2. Create app → **Connect Intel** → default language **English** → App / Game → **Free**.

---

## 2. Create upload keystore (once — keep safe)

From the **repo root**:

```bash
keytool -genkeypair -v \
  -keystore connect-intel-upload.jks \
  -alias connect-intel \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Connect Intel, OU=Mobile, O=Connect Intel, L=, ST=, C=US"
```

Store the `.jks` file and passwords somewhere secure (password manager + backup). **If you lose this, you cannot update the same Play listing.**

Configure signing:

```bash
cp android/keystore.properties.example android/keystore.properties
# Edit android/keystore.properties with your passwords and keystore path
```

Move `connect-intel-upload.jks` next to `android/` or update `storeFile` in `keystore.properties`.

---

## 3. Build the release bundle (AAB)

From the **repo root**:

```bash
npm run android:sync    # build web + copy to Android project
npm run android:bundle  # produces android/app/build/outputs/bundle/release/app-release.aab
```

Or open in Android Studio:

```bash
npm run android:open
```

Then **Build → Generate Signed Bundle / APK → Android App Bundle → release**.

---

## 4. Play Console listing (first release)

### Store listing

| Field | Suggestion |
|--------|------------|
| **Short description** | B2B CRM, AI lead search, and Chithi team chat for sales teams. |
| **Full description** | Connect Intel helps B2B teams find prospects, manage pipeline, email from Gmail, and chat with teammates in Chithi. Sign in with Google, collaborate on leads, and run campaigns from one workspace. |
| **App icon** | Use `frontend/public/pwa-512.png` (512×512) |
| **Feature graphic** | 1024×500 banner (create in Figma/Canva with logo + tagline) |
| **Phone screenshots** | 2–8 screenshots from the app (pipeline, Chithi, mobile CRM) |

### Required URLs

- **Privacy policy:** https://connectintel.net/privacy  
- **Website:** https://connectintel.net  
- **Contact email:** invite@connectintel.net (or your support address)

### App content

- **Content rating** — complete the questionnaire (business/productivity, no mature content).
- **Target audience** — 18+ / business users.
- **Data safety** — declare Google sign-in, CRM data, email (Gmail OAuth when connected). Align with your privacy policy.
- **Ads** — No (unless you add ads later).

### Release

1. **Production → Create new release**
2. Upload `app-release.aab`
3. Release name: `1.0.0 (1)`
4. Submit for review (often 1–7 days first time)

---

## 5. Updating the app

| Change type | Action |
|-------------|--------|
| Web UI / Chithi / CRM logic | Deploy to Vercel only — app loads live site |
| Native icons, splash, permissions | Bump `versionCode` + `versionName` in `android/app/build.gradle`, rebuild AAB, new Play release |
| New Capacitor plugins | Same as native change |

Example version bump in `android/app/build.gradle`:

```gradle
versionCode 2
versionName "1.0.1"
```

---

## 6. Useful commands

```bash
npm run android:sync      # npm run build + cap sync android
npm run android:open      # open Android Studio
npm run android:bundle    # release AAB for Play Store
```

### Local dev against production

Default config loads `https://connectintel.net`. To point at a local Vite server:

```bash
CAPACITOR_SERVER_URL=http://10.0.2.2:5173 npx cap sync android   # Android emulator → host machine
```

---

## 7. Checklist before submit

- [ ] Signed AAB builds without errors  
- [ ] App opens, Google sign-in works, Chithi loads  
- [ ] Privacy policy URL live  
- [ ] Data safety form matches OAuth / CRM data use  
- [ ] Test on a real Android device (not just emulator)

---

## Troubleshooting

**Gradle / Java errors** — Open in Android Studio once; use **Embedded JDK 21**. If sync fails on `jcenter()`, run `npm install` at repo root (applies patch), then **File → Sync Project with Gradle Files**. **Do not** upgrade Android Gradle Plugin to 9.x via the Upgrade Assistant — stay on **8.13.0** (Capacitor default).

**Sign-in fails on Android** — Add Android OAuth client with package `net.connectintel.app` and your keystore SHA-1. Deploy latest web code to Vercel (native sign-in button lives in the web bundle).

**Gradle / Java errors** — Open project in Android Studio once; let it sync Gradle.

**White screen** — Confirm device has internet; app loads connectintel.net.

**Sign-in fails in WebView** — Ensure Google OAuth authorized origins include `https://connectintel.net` (already used for web).

**Play rejection (WebView wrapper)** — Emphasize full CRM + team chat functionality in listing; app is not a simple bookmark.
