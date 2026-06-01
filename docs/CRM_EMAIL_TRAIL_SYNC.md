# CRM email trail sync

Connect Intel only imports **trail mail** for a lead — not the user's full Gmail inbox.

## What counts as trail mail

1. Messages in a Gmail **thread** already linked from CRM (outbound send or prior sync).
2. **Seed** before any CRM thread exists: outbound from the rep's work mailbox **to** the lead only.
3. **Bounce / NDR** messages from mailer-daemon or postmaster that reference the lead address.

Unrelated inbox messages (other contacts, newsletters, personal mail) are never stored.

## Bounce detection

During trail sync, delivery failure messages are detected via sender, subject, body, and `X-Failed-Recipients` when present. The lead is marked with `emailBouncedAt` and shown as invalid in the pipeline (same icon family as format validation).

Bounce detection varies by provider; Gmail is the supported sync path today.

## User action

Pipeline → lead → Email → **Sync trail** (requires work Gmail with read scope).
