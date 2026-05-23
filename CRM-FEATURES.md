# CRM features (v1)

## Sidebar (Outreach & CRM)

| Page | Purpose |
|------|---------|
| **Pipeline** | Kanban + lead workspace |
| **Activity log** | All team activity across leads |
| **Calendar** | Upcoming meetings & follow-ups |

## Lead workspace (open any card in Pipeline)

Tabs:

1. **Overview** — status, assign/transfer lead, last communication, next follow-up, log calls  
2. **Notes & log** — customer notes + full activity timeline  
3. **Tasks & meetings** — assign tasks, schedule calls/visits, record field visits  
4. **Email** — connect **your work Gmail**, set agenda/key points, AI draft in **your company voice**, send via Gmail (appears in Sent + CRM)

## Managers (company admin)

- Assign or **transfer** leads to any teammate  
- Assign **tasks** and **meetings** to team members  

## Reminders

- Browser notification **30 minutes before** scheduled meetings (allow notifications when prompted)  
- Keep Connect Intel open in a tab for reminders to fire  

## Mobile

- **☰ menu** on small screens  
- Lead workspace opens **full screen** on phone  

## CRM email setup

Each rep: **Email tab → Connect work Gmail** (one-time). OAuth uses the same Google Cloud client as sign-in; redirect URI stays `https://connectintel.net/api/team/email-oauth/callback`.

## Save feedback

Tasks, meetings, calls, and notes show **Saving…** / success banners and block double-clicks.

## Pipeline import

- **Pipeline → Import pipeline** (CSV/Excel) — company team and individuals  
- Company **members** can import (leads assign to them); **admins** assign from sheet or self  

## Bulk email

- **Pipeline → List** view: select leads → **Email selected**  
- AI draft per lead (agenda) or same subject/body for all (max 50)  

## WhatsApp

- **WhatsApp** tab on each lead: AI draft → **Open in WhatsApp** (your mobile on profile)  
- Mobile collected at onboarding or prompted on first login  

## Coming next

- Google Calendar sync  
- Slack / Teams notifications  
- WhatsApp Business API (server send)  
