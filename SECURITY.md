# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in this project, please email the
maintainer privately (do not open a public GitHub issue with exploit details).

Include:

* A short description of the impact
* Steps to reproduce
* Affected URL / component if known

Please do **not** include secrets, session tokens, or personal chat content from
live rooms.

We aim to acknowledge reports within a few days.

## Design constraints (intentional)

* No user accounts or passwords
* No database — rooms exist only in memory on the realtime server
* Reconnect tokens are temporary, room-scoped, and stored only in the browser
  `sessionStorage` for the current tab
* Chat, nicknames, and prompts are not retained after a room is destroyed

## Production hardening already in place

* CORS allowlist (no `*` in production)
* Socket payload validation and size limits
* Per-IP / per-socket rate limiting
* Host authorization derived from server room state
* Security headers on API and frontend
* Prompt-import size / count limits
* Kick removes the socket from the room and applies a short ban

## Out of scope for this app

* Permanent identity / OAuth
* End-to-end encrypted chat
* Content moderation AI
* CDN WAF configuration (platform-level)
