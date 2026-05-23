# Moved: use company account only

Personal Gmail is **not** used anymore.

**Open this file instead:** [COMPANY-GOOGLE-SETUP.md](./COMPANY-GOOGLE-SETUP.md)

Short version:

1. Sign in to **https://console.cloud.google.com** as **invite@connectintel.net** only  
2. Create project **Connect Intel**  
3. OAuth **Internal** + **Gmail API** + **Web OAuth client**  
4. Put **Client ID** + **Client secret** on Vercel (replace old personal keys)  
5. Redeploy → app **Team** → **Connect invite@connectintel.net**
