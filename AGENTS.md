# BMSPORT YVN — native iOS

- Keep this a native Swift + SwiftUI app, iOS 17+. Never replace with WebView, HTML or PWA.
- Service identity is fixed: BMSPORT YVN, Ереван, @bmsport_yvn.
- Use SwiftData on device. Never reset or silently replace an unreadable store with an empty/in-memory store. In-memory is for explicit UI tests only.
- Keep drafts permissive; validate before finalizing/exporting. Surface storage and PDF errors.
- Treat existing payload JSON as persisted schema: add backward compatible decoding/migrations before changing fields.
- No customer data in logs, analytics, test fixtures or network requests.
- PDF must preserve Cyrillic/Armenian and arbitrary length text on A4, with headers and page numbers.
- On macOS run unit/UI tests with the shared BMSport scheme; manually inspect a multipage PDF and Share Sheet on a physical iPhone.
- Do not claim an Xcode build, device installation, or test run unless actually performed.
