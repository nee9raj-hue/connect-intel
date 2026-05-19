# Google login setup — matches YOUR screen (2026 Google Auth Platform)

Your screenshot shows the **new** Google interface:

**Google Auth Platform → Overview**

The old menu path (`APIs & Services → OAuth consent screen`) has moved. Use the steps below instead.

---

## Step 1 — You are here (Overview)

You see:

- “You haven't configured any OAuth clients for this project yet”
- Button: **Create OAuth client**

**Do not click that yet.** Set up Audience and Branding first (2 minutes).

---

## Step 2 — Audience (this is where Test users live)

1. In the **left sidebar**, click **Audience** (under Google Auth Platform)
2. You will see **User type**:
   - Choose **External** (so anyone with a Google account can sign in later)
   - Click **Save** or **Create** if asked
3. Scroll down on the same page — look for **Publishing status**:
   - It will say **Testing** (this is normal for new apps)
4. Find the section **Test users**:
   - Click **+ Add users**
   - Type your **Gmail address** (the one you will use to sign in)
     - Example: `yourname@gmail.com`
   - Click **Save**
5. **Important:** Only emails listed as test users can log in while the app is in **Testing** mode.

If you do not see “Test users”:

- Make sure **External** is selected
- Make sure publishing status is **Testing** (not Production yet)
- Try clicking **Audience** again and scroll the whole page

---

## Step 3 — Branding (app name users see)

1. Left sidebar → click **Branding**
2. Fill in:
   - **App name:** `Connect Intel`
   - **User support email:** your Gmail
   - **App logo:** optional (skip for now)
3. Click **Save**

---

## Step 4 — Create OAuth client (Credentials)

1. Left sidebar → click **Clients**
2. Click **+ Create client** (or **Create OAuth client** from Overview)
3. **Application type:** Web application
4. **Name:** `Connect Intel Web`
5. **Authorized JavaScript origins** — click **+ Add URI** and add:

```
http://localhost:5173
http://localhost:4173
```

(Add your Vercel URL later after deploy, e.g. `https://your-app.vercel.app`)

6. **Authorized redirect URIs** — leave **empty** (our app does not need this)
7. Click **Create**
8. Copy the **Client ID** (ends with `.apps.googleusercontent.com`)

---

## Step 5 — Put Client ID in your project

1. Terminal:

```bash
cd "/Users/apple/Downloads/Connect intel/frontend"
open -e .env
```

2. Paste (use your real ID):

```
VITE_GOOGLE_CLIENT_ID=paste-client-id-here.apps.googleusercontent.com
```

3. Save (`Cmd + S`)

---

## Step 6 — Test on your Mac

```bash
cd "/Users/apple/Downloads/Connect intel/frontend"
npm run dev
```

1. Browser opens `http://localhost:5173`
2. Click **Continue with Google**
3. Sign in with the **same Gmail** you added as a test user

---

## Common errors

| Message | Fix |
|--------|-----|
| **Access blocked: app has not completed verification** | Add your Gmail under **Audience → Test users** |
| **Error 400: redirect_uri_mismatch** | You do not need redirect URIs; use **Web application** and only JavaScript origins |
| **The given origin is not allowed** | Add `http://localhost:5173` under **Clients → your client → JavaScript origins** |
| **This app is blocked** | Sign in only with an email listed in Test users |

---

## Sidebar map (your screen)

| Menu item | What it is |
|-----------|------------|
| **Overview** | Summary (where you were stuck) |
| **Branding** | App name & logo |
| **Audience** | External / Internal + **Test users** ← you need this |
| **Clients** | OAuth Client ID ← create here |
| **Data Access** | Scopes (skip for basic login) |
| **Verification Center** | Only needed when going public at scale |

---

## After deploy (Vercel)

1. **Clients** → edit your client → add origin: `https://YOUR-APP.vercel.app`
2. Vercel → Environment variable: `VITE_GOOGLE_CLIENT_ID`
3. Redeploy
