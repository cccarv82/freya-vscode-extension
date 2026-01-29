# FREYA VSCode/Cursor Extension

Local-first status assistant for VSCode/Cursor.

## Features
- Bootstrap or update a FREYA workspace (agents + scripts + data) using `npx @cccarv82/freya`
- GUI commands to generate reports:
  - Executive report (`npm run status`)
  - Scrum Master weekly (`npm run sm-weekly`)
  - Blockers report (`npm run blockers`)
  - Daily summary (`npm run daily`)
- One-click publish last generated report to:
  - Discord (Incoming Webhook)
  - Microsoft Teams (Incoming Webhook)

## Setup
1) Install extension
2) Open a folder in VSCode/Cursor
3) Run command: `FREYA: Init Workspace`

## Configuration
- `freya.workspaceFolder` (default: `freya`)
- `freya.discordWebhookUrl`
- `freya.teamsWebhookUrl`

## Notes
- Publishing uses incoming webhooks (recommended for MVP). No external deps.
- Report posting truncates to ~1800 chars to avoid webhook limits.
