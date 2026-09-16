# Buddy Admin Extension

This is the first admin-only build. It stores a local admin registry in Chrome extension storage and prepares member IDs, folder paths, enable/disable state, and password-free invitation files.

Cloud folder provisioning and Google authentication are intentionally marked as the next integration step; this build does not claim to write to Drive yet.

Build from the project root:

```powershell
npx vite build --config admin-extension/vite.config.ts
Copy-Item admin-extension/manifest.json admin-extension/dist/manifest.json -Force
```

Load `admin-extension/dist` at `chrome://extensions` with Developer mode enabled.
