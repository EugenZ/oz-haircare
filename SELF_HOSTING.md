# Self-hosting notes

This archive contains source only. It does not include a deployment, account
credentials, the local node_modules folder, or the previous Sites metadata.

## Local

1. Install Node.js 22.13 or newer.
2. Run npm install.
3. Run npx vinext dev for a local preview.
4. Run npx vinext build before publishing.

The app is a vinext / Cloudflare Worker-compatible project. Use a host that
supports that output, or adapt the build output to your chosen platform.

## Before real use

- Replace placeholder Instagram links in app/page.tsx.
- Replace stock photos with owned or licensed photos.
- Connect the booking form to a real email, CRM, or server endpoint. The
  current form only shows a local confirmation and does not send submissions.
- Add the specialist name, city, contact details, and legal privacy copy.
