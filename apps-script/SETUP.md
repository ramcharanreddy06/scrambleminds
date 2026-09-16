# Scrambled Minds Cloud Backend

The backend stores team chat sessions as readable `.txt` files in the admin Google Drive. It does not store Gmail passwords.

## Drive layout

```text
Scrambled Minds/
  <member-id>/
    ChatGPT/
      <conversation-title>-<conversation-id>.txt
    Claude/
    Perplexity/
    DeepSeek/
    Grok/
    Gemini/
```

## Install or update the Apps Script project

1. Sign in to Google using the admin account.
2. Open https://script.google.com/home.
3. Open the standalone project used for Scrambled Minds.
4. Replace `Code.gs` with this folder's current `Code.gs`.
5. In Project Settings, enable **Show appsscript.json manifest file in editor**.
6. Replace `appsscript.json` with this folder's manifest.
7. Click **Save all**.

## Initialize the admin Drive

1. Select `setupBuddy` in the function selector.
2. Click **Run**.
3. Approve Google Drive access if prompted.
4. Keep the generated admin key private. Do not paste it into chat or commit it to source control.

If the key was exposed, select `rotateAdminKey`, run it, and update the key locally in the admin extension.

## Deploy or update the Web App

1. Choose **Deploy â†’ New deployment** or edit the existing Web App deployment.
2. Select **Web app**.
3. Set **Execute as** to the admin account.
4. Set **Who has access** to **Anyone**.
5. Deploy and copy the account-neutral URL ending in `/exec`.
6. Do not use a Library URL or a URL containing `/macros/u/<account-number>/`.
7. Open the URL directly. A healthy deployment returns JSON containing `"ok":true` and `"service":"scrambled-minds-team-cloud"`.

## Current API actions

All actions except `health` and `doGet` require the private `adminKey` during this admin-first phase.

- `addMember`: creates the member folder and six platform folders.
- `listMembers`: returns the admin member registry.
- `syncConversation`: appends only new message sequence numbers to a session text file and deduplicates repeated sync event IDs.
- `listChats`: lists stored session files.
- `readChat`: reads a session file by Drive file ID.
- `trashChat`: moves a session file to Drive trash.
- `restoreChat`: restores a trashed session file.
- `permanentDeleteChat`: permanently removes a session file; admin-only.

Example sync payload shape:

```json
{
  "action": "syncConversation",
  "adminKey": "stored only locally",
  "memberId": "test",
  "syncEventId": "unique-event-id",
  "conversation": {
    "platform": "ChatGPT",
    "externalConversationId": "conversation-id",
    "localCaptureId": "local-id",
    "title": "Example",
    "sourceUrl": "https://chatgpt.com/",
    "capturedAt": "2026-09-12T00:00:00.000Z",
    "messages": [
      { "sequence": 1, "role": "user", "content": "Hello" },
      { "sequence": 2, "role": "assistant", "content": "Hi" }
    ]
  }
}
```

The backend uses a lock and Script Properties cursors for retry-safe append behavior. A local client queue remains necessary for offline operation.

