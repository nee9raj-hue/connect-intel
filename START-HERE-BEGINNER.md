# Connect Intel — Complete beginner guide

Follow these steps **in order**. Each step tells you exactly what to click or type.

---

## What you are building

**Connect Intel** is a website where people can:

- Sign in with Google (no long signup form)
- Search for business leads (people at companies)
- Save leads and export to Excel (CSV)

Right now it runs on **your Mac** for testing. After Part 4, it will run on the **internet** so anyone can open a link.

---

# PART 1 — Open the app on your Mac (15 minutes)

### Step 1.1 — Check Node.js is installed

Node.js runs the app tools on your computer.

1. Open **Terminal** (press `Cmd + Space`, type `Terminal`, press Enter)
2. Type this and press Enter:

```bash
node --version
```

- If you see something like `v20.x.x` or `v22.x.x` → **good, go to Step 1.2**
- If you see `command not found` → install Node:
  1. Go to https://nodejs.org
  2. Download the **LTS** version (green button)
  3. Install it (Next, Next, Finish)
  4. **Close Terminal and open it again**
  5. Run `node --version` again

---

### Step 1.2 — Open the project folder

In Terminal, copy and paste this **whole line** and press Enter:

```bash
cd "/Users/apple/Downloads/Connect intel"
```

You should not see an error. This moves you into your project folder.

---

### Step 1.3 — Install dependencies (first time only)

Copy and paste:

```bash
cd frontend && npm install && cd ..
```

Wait until it finishes (can take 1–3 minutes). You will see a progress bar or lots of text — that is normal.

---

### Step 1.4 — Start the app

**Easy way (recommended):**

1. Open **Finder**
2. Go to **Downloads** → **Connect intel**
3. **Double-click** the file: `OPEN CONNECT INTEL.command`
4. If Mac says “cannot be opened”:
   - Right-click the file → **Open** → **Open** again
5. A small black **Terminal** window opens
6. Your **browser** should open automatically to something like `http://localhost:4173`

**Keep the Terminal window open** while you use the app. To stop the app: click the Terminal window and press `Ctrl + C`.

---

**Alternative way (Terminal):**

```bash
cd "/Users/apple/Downloads/Connect intel"
npx serve .
```

Open the link it shows (example: `http://localhost:3000`).

---

### Step 1.5 — Try the app

1. You should see the **Connect Intel** home page
2. Click **Continue with Google** (demo mode — no real Google account needed yet)
3. You should enter the **People Search** screen
4. Click filters on the left, then **Search leads**

If this works, Part 1 is done.

---

# PART 2 — Real Google login (optional but recommended before going live)

Demo Google login works for testing. For **real** Google accounts you need a free Google Cloud setup.

### Step 2.1 — Create a Google Cloud project

1. Open browser → https://console.cloud.google.com
2. Sign in with your **Google account**
3. Top bar: click the project dropdown → **New Project**
4. Name: `Connect Intel` → **Create**
5. Wait ~30 seconds, then select that project from the dropdown

---

### Step 2.2 — Configure OAuth consent screen

1. Left menu → **APIs & Services** → **OAuth consent screen**
2. User type: choose **External** → **Create**
3. Fill in only required fields:
   - App name: `Connect Intel`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue** through the steps (you can skip scopes and test users for now if unsure)
5. On **Test users** (if shown): click **Add users** → add your Gmail address → Save

---

### Step 2.3 — Create OAuth Client ID

1. Left menu → **APIs & Services** → **Credentials**
2. Top: **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Connect Intel Web`
5. **Authorized JavaScript origins** — click **+ Add URI** and add these one at a time:

```
http://localhost:5173
http://localhost:4173
http://localhost:3000
```

(You will add your Vercel URL in Part 4 after deploy.)

6. Leave **Authorized redirect URIs** empty (not needed for our button login)
7. Click **Create**
8. A popup shows **Your Client ID** — copy it (looks like `123456789-xxxx.apps.googleusercontent.com`)

---

### Step 2.4 — Put the Client ID in your project

1. Open Finder → **Connect intel** → **frontend** folder
2. Create a new file named exactly: `.env`  
   (If Mac hides the dot: open Terminal and run:)

```bash
cd "/Users/apple/Downloads/Connect intel/frontend"
touch .env
open -e .env
```

3. In the file, paste **one line** (replace with your real Client ID):

```
VITE_GOOGLE_CLIENT_ID=paste-your-client-id-here.apps.googleusercontent.com
```

4. Save and close the file

---

### Step 2.5 — Test real Google login locally

1. Stop the app if it is running (`Ctrl + C` in Terminal)
2. Start dev mode:

```bash
cd "/Users/apple/Downloads/Connect intel/frontend"
npm run dev
```

3. Browser opens `http://localhost:5173`
4. Click **Continue with Google** — pick your real Google account
5. You should land in the app with your name and photo

Part 2 done.

---

# PART 3 — Put your code on GitHub (20 minutes)

GitHub stores your code online so Vercel can deploy it.

### Step 3.1 — Create a GitHub account

1. Go to https://github.com
2. Sign up if you do not have an account (free)

---

### Step 3.2 — Create a new repository

1. Click **+** (top right) → **New repository**
2. Repository name: `connect-intel`
3. Leave it **Public** or **Private** (your choice)
4. **Do NOT** check “Add a README” (you already have files)
5. Click **Create repository**

---

### Step 3.3 — Upload your code from Terminal

GitHub will show commands. Use these (copy each block, paste in Terminal, Enter):

```bash
cd "/Users/apple/Downloads/Connect intel"
git init
git add .
git commit -m "Connect Intel initial version"
```

Set your name for Git (only once ever):

```bash
git config user.email "your-email@example.com"
git config user.name "Your Name"
```

Then connect to GitHub (replace `YOUR_USERNAME` with your GitHub username):

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/connect-intel.git
git push -u origin main
```

- It may ask you to **log in to GitHub** in the browser — follow the prompts
- If it asks for password, use a **Personal Access Token** (GitHub → Settings → Developer settings → Tokens)

When `git push` finishes without error, your code is on GitHub.

---

# PART 4 — Deploy to the internet with Vercel (20 minutes)

Vercel hosts your website for free and gives you a link like `https://connect-intel.vercel.app`.

### Step 4.1 — Create Vercel account

1. Go to https://vercel.com
2. Click **Sign Up**
3. Choose **Continue with GitHub** (easiest)

---

### Step 4.2 — Import your project

1. Vercel dashboard → **Add New…** → **Project**
2. Find **connect-intel** in the list → click **Import**
3. **Configure Project** screen:
   - Framework Preset: leave as detected or **Other**
   - Root Directory: leave as **.** (dot = whole repo)
   - Vercel should read `vercel.json` automatically:
     - Build Command: `cd frontend && npm ci && npm run build`
     - Output Directory: `site`
4. **Environment Variables** — click to expand:
   - Name: `VITE_GOOGLE_CLIENT_ID`
   - Value: paste the same Client ID from Part 2
   - Check **Production**, **Preview**, **Development**
5. Click **Deploy**
6. Wait 1–3 minutes until you see **Congratulations**

---

### Step 4.3 — Add your live URL to Google

1. Copy your Vercel URL (example: `https://connect-intel-abc123.vercel.app`)
2. Go back to Google Cloud → **Credentials** → click your OAuth client
3. Under **Authorized JavaScript origins**, add:

```
https://connect-intel-abc123.vercel.app
```

(Use your real URL, no slash at the end)

4. **Save**

---

### Step 4.4 — Redeploy (important after adding Google URL)

1. Vercel → your project → **Deployments**
2. Latest deployment → **⋯** (three dots) → **Redeploy**

---

### Step 4.5 — Test the live site

1. Open your Vercel URL in browser
2. Click **Continue with Google** with your real account
3. Try **People Search**

Share this link with others — they can use the app from anywhere.

---

# PART 5 — Custom domain (optional, later)

When you buy a domain (e.g. `connectintel.com`):

1. Vercel → Project → **Settings** → **Domains**
2. Add your domain and follow DNS instructions
3. Add `https://connectintel.com` to Google **Authorized JavaScript origins**
4. Redeploy on Vercel

---

# PART 6 — When you change the app later

After editing files in `frontend/src/`:

```bash
cd "/Users/apple/Downloads/Connect intel"
git add .
git commit -m "Describe what you changed"
git push
```

Vercel will **automatically** rebuild and update the live site (if GitHub is connected).

To refresh files on your Mac:

```bash
cd "/Users/apple/Downloads/Connect intel"
npm run deploy:copy
```

---

# Quick troubleshooting

| Problem | What to do |
|--------|------------|
| Blank page when double-clicking HTML | Use `OPEN CONNECT INTEL.command` instead |
| `command not found: npm` | Install Node.js from nodejs.org |
| Google login fails on live site | Add Vercel URL to Google origins + redeploy |
| Google shows "Access blocked" | Add your email as **Test user** in OAuth consent screen (while app is in Testing mode) |
| `git push` rejected | Check GitHub username in remote URL |
| Mac blocks .command file | Right-click → Open |

---

# Files you should know

| File / folder | What it is |
|---------------|------------|
| `frontend/src/` | Edit the app UI and features here |
| `frontend/.env` | Your Google Client ID (secret — do not share publicly) |
| `OPEN CONNECT INTEL.command` | Double-click to run app on Mac |
| `START-HERE-BEGINNER.md` | This guide |
| `DEPLOY-NOW.md` | Shorter deploy reference |
| `vercel.json` | Tells Vercel how to build your site |

---

# Order checklist

- [ ] Part 1 — App opens on Mac  
- [ ] Part 2 — Google Client ID in `.env` (optional for demo)  
- [ ] Part 3 — Code on GitHub  
- [ ] Part 4 — Live on Vercel + Google origins updated  
- [ ] Share link with your team  

You do **not** need to do everything in one day. Part 1 is enough to see the app working on your computer.
