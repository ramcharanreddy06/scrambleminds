# Scrambled Minds Member Template

This is the reusable member-extension template. It contains the capture, local queue, duplicate filtering, and cloud synchronization behavior used by a member installation.

## Configure one private copy

1. Copy this complete folder for one member.
2. Open the copied folder's `src/member-config.js`.
3. Fill in the deployed Apps Script `/exec` URL, the exact member ID, the member's email, and the activation token.
4. Do not add the admin key.
5. Do not commit the configured copy or its invite to GitHub.
6. Load the complete private copy through `chrome://extensions` with Developer mode enabled.

Capture starts OFF. Turn it ON only for project research and turn it OFF for personal AI conversations. The member extension supports ChatGPT, Claude, Gemini, Perplexity, DeepSeek, and Grok. It does not run a server and does not require the admin laptop to be online.

See `../PUBLIC_SETUP.txt` for the complete backend, admin, member, update, and troubleshooting instructions.
