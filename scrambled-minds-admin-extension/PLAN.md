# Scrambled Minds Team Cloud — Revised Implementation Plan

## Goal
Build a zero-cost, multi-member browser extension system that captures conversations from ChatGPT, Claude, Perplexity, DeepSeek, Grok, and Gemini, then stores them as readable text files in one admin-owned Google Drive cloud through a Google Apps Script backend.

## Final architecture

```text
AI website
  -> member browser extension
  -> optional local relay/queue server on that member's laptop
  -> Google Apps Script backend
  -> admin-owned Google Drive text files
```

Every member can be on a different network. No member's laptop is required for another member's uploads.

## Storage model

```text
Scrambled Minds/
  member-name-or-id/
    ChatGPT/
      session-title.txt
    Claude/
      session-title.txt
    Perplexity/
    DeepSeek/
    Grok/
    Gemini/
```

Each session text file contains owner, platform, session title, timestamps, and ordered user/assistant messages. Messages are sent as soon as they are captured; local queuing is used only for failures or temporary offline operation.

## Identity and security

- Never store Gmail passwords in extension files.
- Use Google OAuth/sign-in and revocable tokens.
- The admin creates members and sends invitations.
- The backend maps verified email/account identity to a member ID and folder.
- A personalized extension may contain a non-secret member ID, but backend authorization is authoritative.
- Admin has a separate management role.
- The backend, not a client-side folder name, enforces member ownership and deletion permissions.

## Admin extension

Build an admin-only extension or admin panel that can:

1. Sign in the administrator.
2. Create, invite, enable, disable, and remove members.
3. Create the member's cloud folder structure.
4. Generate a blank/member extension package or activation configuration.
5. Browse all team chats.
6. Manage trash, restore, and permanent deletion.
7. Show sync health, pending uploads, and quota/storage warnings.

## Member extension

Build a reusable blank template that:

- Prompts the member to sign in.
- Verifies the member with the backend.
- Captures supported AI conversations.
- Sends each message/session update immediately.
- Saves unsent data locally.
- Retries safely with idempotent event IDs.
- Never exposes another member's credentials or folder.

## Permissions

- All authenticated team members can view team chats through Buddy.
- A member can move only their own chats to recoverable trash.
- A member cannot delete or edit another member's chats.
- Owners/admins can restore trash according to policy.
- Permanent deletion requires owner/admin authorization.
- Raw Drive access should not grant broad edit/delete privileges that bypass Buddy's controls.

## Local relay/server behavior

Each member may run a local server from their own extension package. It is a relay and offline queue, not the source of truth.

- Ram's server does not need to be running for Charan.
- Charan's server sends directly to the same Apps Script backend.
- If a member's local server is unavailable, the extension can queue locally and retry.
- Local server addresses must never be treated as the security boundary.

## Implementation phases

### Phase 1 — Rebaseline current project
- Preserve the working Manifest V3 build.
- Replace the localhost placeholder API contract with a provider-neutral sync contract.
- Separate capture, queue, authentication, cloud transport, and UI modules.
- Add configuration for organization ID, backend URL, and environment.

### Phase 2 — Google Apps Script backend
- Create the web app endpoint for authenticated sync.
- Implement member registry and organization membership.
- Implement OAuth/session verification without storing passwords.
- Create Drive folders and session `.txt` files.
- Append message records safely and preserve ordering.
- Add idempotency, conflict/version handling, retry-safe responses, and audit events.
- Implement owner-only trash/permanent deletion rules.

### Phase 3 — Local queue and relay
- Persist every captured message/session update locally until acknowledged.
- Retry transient failures with exponential backoff.
- Detect quota/full-storage responses and display actionable status.
- Add export of pending chats before uninstall/reset.
- Make the local relay optional and usable from different networks.

### Phase 4 — Admin experience
- Build member management.
- Build folder provisioning.
- Build invitation/activation flow.
- Build chat browser with member/platform/session navigation.
- Build trash, restore, permanent-delete, and audit views.

### Phase 5 — Platform adapters
Implement and test adapters in this order:

1. ChatGPT
2. Claude
3. Gemini
4. Perplexity
5. DeepSeek
6. Grok

Each adapter must capture session title, conversation identity, ordered messages, edits/regenerations where possible, and navigation changes without duplicate captures.

### Phase 6 — Security and reliability
- Verify backend authorization for every read/write/delete operation.
- Add token revocation and member disable behavior.
- Validate extension permissions and content-script scope.
- Add sanitization for Drive filenames and text content.
- Protect against concurrent writes and duplicate events.
- Add backup/export and recovery documentation.

### Phase 7 — Testing and packaging
- Unit tests for normalization, identity, queueing, idempotency, permissions, and file formatting.
- Backend tests for multi-member isolation and deletion rules.
- Browser tests for all six platforms where available.
- Test laptop shutdown, offline capture, retry, cloud quota, duplicate delivery, and member removal.
- Produce admin package, blank member package, setup.txt, and deployment instructions.

## Acceptance criteria

- A new member can be added by the admin without editing source code.
- A member's first chat creates the correct member/platform/session `.txt` file.
- Every captured message is preserved in order.
- Five or more members on different networks can upload independently.
- No Gmail password is stored in extension files or the backend.
- Team members can view all chats through the authorized interface.
- Members cannot delete another member's chat.
- Temporary outages do not lose queued chats.
- A host laptop can be switched off without stopping other members' uploads.
- The final packages are loadable in Chrome/Chromium and documented.

## Constraints and risks

- Google Apps Script and Drive quotas are finite and can change.
- Free storage is limited by the admin account's Drive quota.
- Direct raw Drive permissions could bypass application-level ownership rules and must be restricted.
- AI websites change their DOM and may require adapter maintenance.
- The extension must not claim real-time cloud delivery when a message is still queued locally.

## Immediate next work

1. Freeze the old placeholder-sync direction.
2. Implement the revised provider-neutral data model and local queue contract.
3. Build a minimal Apps Script backend that provisions one member folder and writes one session `.txt` file.
4. Connect the existing ChatGPT adapter end-to-end.
5. Add admin/member authentication and permission tests before adding the remaining five adapters.
