# Enterprise SSO setup (Azure AD / Okta)

One-command Vercel wiring after you have IdP credentials.

## Prerequisites

- Vercel CLI logged in (`vercel whoami`)
- **Azure AD** or **Okta** app registration with redirect URI:

```
https://connectintel.net/api/auth/sso/callback
```

## Azure AD (Microsoft Entra)

1. [Create app registration](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade)
2. **Redirect URI (Web):** `https://connectintel.net/api/auth/sso/callback`
3. **Certificates & secrets** → New client secret
4. Copy **Tenant ID**, **Client ID**, **Client secret**

```bash
cp .env.enterprise-sso.example .env.enterprise-sso.local
# fill AZURE_AD_* values

npm run sso:connect
```

Or flags:

```bash
npm run sso:connect -- --provider azure-ad \
  --tenant-id <tenant> --client-id <id> --client-secret <secret>
```

## Okta

```bash
npm run sso:connect -- --provider okta \
  --domain your-org.okta.com --client-id <id> --client-secret <secret>
```

## Verify

After deploy:

```bash
curl -s https://connectintel.net/api/public-config | jq '.auth.enterprise'
```

`azure-ad` (or `okta`) should show `"configured": true` and a `startUrl`.

Sign in at https://connectintel.net → **Sign in with Microsoft** (or Okta) appears.

## Rollback

Remove on Vercel: `AUTH_PROVIDER`, `AZURE_AD_*` / `OKTA_*`. Redeploy. Google + email login unchanged.
