# Fix Google sign-in errors (401, origin_mismatch)

## Error 400: origin_mismatch (customer cannot log in)

**Cause:** The app moved to **https://connectintel.net** but Google OAuth still only allows the old URL (e.g. `connect-intel-mocha.vercel.app`).

**Fix (5 minutes):**

1. [Google Cloud Console](https://console.cloud.google.com) → project **Connect Intel**
2. **Google Auth Platform** → **Clients** → your **Web application** client
3. **Authorized JavaScript origins** → **+ ADD URI** — add **both**:

```text
https://connectintel.net
https://www.connectintel.net
```

4. **Authorized redirect URIs** → add (for team invite email connect):

```text
https://connectintel.net/api/team/email-oauth/callback
```

5. **Save**
6. **OAuth consent screen** → **Branding** / **App domain**:
   - Home page: `https://connectintel.net`
   - Authorized domains: `connectintel.net`
7. **Audience** → must be **External** and **Published** (or add `sales@alvarfresh.com` as a **Test user** while in Testing)

Customers like `sales@alvarfresh.com` need **Published** app — Internal-only blocks non-@connectintel.net emails.

8. Wait **5–10 minutes**, then customer tries again in **Incognito** on `https://connectintel.net` (not the old vercel.app link).

**No Vercel redeploy needed** for origin changes — only Google Console.

---

# Fix: Error 401 invalid_client / OAuth client was not found

This means Google does not recognize the **Client ID** your live site is sending.

---

## Fix checklist (do in order)

### 1. Copy the correct ID from Google (not the secret)

1. [Google Cloud Console](https://console.cloud.google.com) → pick the **same project** where you added test users  
2. **Google Auth Platform** → **Clients**  
3. Click your **Web application** client (type must be **Web**, not Android/iOS)  
4. Copy **Client ID** — ends with `.apps.googleusercontent.com`  
5. Do **NOT** copy **Client secret** (that causes 401)

---

### 2. Fix Vercel environment variable

1. [vercel.com](https://vercel.com) → **connect-intel** → **Settings** → **Environment Variables**  
2. Find `VITE_GOOGLE_CLIENT_ID`  
3. **Delete** it and **add again** (avoids hidden spaces):

| Field | Value |
|-------|--------|
| Name | `VITE_GOOGLE_CLIENT_ID` |
| Value | paste Client ID only — **no quotes**, no spaces before/after |
| Environments | Production + Preview + Development |

4. **Save**

---

### 3. Add your live URL in Google

**Clients** → your Web client → **Authorized JavaScript origins**:

```
https://connectintel.net
```

Also keep for local testing:

```
http://localhost:5173
```

**Save**

---

### 4. Redeploy on Vercel (required)

Env vars only apply after a new build:

1. **Deployments** → latest → **⋯** → **Redeploy**  
2. Wait until **Ready**  
3. Hard refresh the site: `Cmd + Shift + R`

---

### 5. Test

Open: https://connectintel.net  

- Button should **not** say `(demo)`  
- Google sign-in should open without 401  

---

## Common mistakes

| Mistake | Result |
|---------|--------|
| Pasted **Client secret** instead of Client ID | 401 invalid_client |
| Quotes in Vercel value: `"123...com"` | 401 |
| Wrong Google Cloud **project** | 401 |
| Deleted and recreated client, old ID on Vercel | 401 |
| Forgot to **Redeploy** after env change | Still broken |
| Client type is Android/iOS, not **Web** | 401 |

---

## Still broken?

Create a **new** Web client in Google:

1. **Clients** → **Create client** → **Web application**  
2. Name: `Connect Intel Production`  
3. Origins: `https://connectintel.net` and `http://localhost:5173`  
4. Copy the **new** Client ID into Vercel → Redeploy  
