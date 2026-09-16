# Scrambled Minds

Scrambled Minds is a browser-extension system for capturing project-related conversations from supported AI platforms and synchronizing them to a Google Drive backend through Google Apps Script.

This repository is a public, setup-driven copy of the working Scrambled Minds project. The runtime behavior is preserved. Installation-specific values are intentionally left blank and must be supplied locally during setup.

## Supported platforms

- ChatGPT
- Claude
- Gemini
- Perplexity
- DeepSeek
- Grok

## Repository layout

- `scrambled-minds-admin-extension/` — admin extension source, admin UI, Apps Script backend, tests, and build files.
- `member-extension-template/` — the member Chrome extension template.
- `PUBLIC_SETUP.txt` — full installation and deployment instructions.
- `apps-script/SETUP.md` — backend-specific reference notes.

## Important security rule

Do not commit any of the following:

- Apps Script deployment URLs belonging to a private workspace
- Admin keys
- Member activation tokens
- Private member email addresses
- Exported invite JSON files

The member template contains placeholders in `member-extension-template/src/member-config.js`. Replace them only in a local member copy, or use a local ignored file when working from a clone.

## Quick start

1. Follow `PUBLIC_SETUP.txt` from top to bottom.
2. Deploy the Apps Script backend from `apps-script`.
3. Build and load the admin extension from `scrambled-minds-admin-extension/admin-extension/dist`.
4. Create each member record in the admin extension and export that member's invite.
5. Copy the member template for the member, fill its local `src/member-config.js`, and load the complete folder in Chrome.
6. Turn capture on only for project conversations.

The original working source folders are not part of this public repository. This copy is the release workspace; no production credentials are included.
