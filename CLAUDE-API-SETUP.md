# Enable Claude lead search on live site

Your app calls **`/api/search-leads`** on Vercel (API key stays on the server).

## Steps

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Vercel → **connect-intel** → **Settings** → **Environment Variables**
3. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key (starts with `sk-ant-`)
   - Environments: Production, Preview, Development
4. **Deployments** → **Redeploy**
5. Search again on [connect-intel-mocha.vercel.app](https://connect-intel-mocha.vercel.app)

Without this key, search uses **Indian demo leads** only (Jaipur exporter etc. in sample data).

## After Apollo.io (later)

Apollo will replace Claude for people data; Hunter.io will verify emails. UI is already structured for that switch.
