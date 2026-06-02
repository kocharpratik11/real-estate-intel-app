# Android Publishing Guide — Asset Brain

Project: `asset-brain`
EAS Project ID: `d5940bc8-2ee5-4fe5-9623-ae41404b97bb`
EAS Owner: `kocharpratik11`
Android Package: `com.assetbrain.app`
Current Version: `1.0.0` (versionCode: 1)

---

## Step 0 — Prerequisites (one-time)

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account (expo.dev)
eas login

# Verify you're logged in
eas whoami
```

---

## Step 1 — Quick share with test users (APK, no Play Store)

Builds a standalone `.apk` that anyone can sideload on Android.

```bash
cd /Users/kocharpratik11/REIP/real-estate-intel-app
eas build --platform android --profile preview
```

- Build runs on EAS cloud (~15 min)
- When done, EAS prints a download URL
- Share that URL with your tester
- Tester: enable **Settings → Install unknown apps** on their phone, download, install

> Use this for your brother right now. No Play Store account needed.

---

## Step 2 — Google Play Developer account

1. Go to https://play.google.com/console
2. Pay **$25 one-time** registration fee
3. Complete identity verification — takes **1–3 days**
4. Once approved, create a new app:
   - App name: `Asset Brain`
   - Default language: English (US)
   - App or Game: **App**
   - Free or Paid: **Free**

---

## Step 3 — Production build (AAB for Play Store)

```bash
eas build --platform android --profile production
```

- Produces an `.aab` (Android App Bundle) — required by Play Store
- Download the `.aab` from the EAS dashboard when complete
- EAS dashboard: https://expo.dev/accounts/kocharpratik11/projects/asset-brain/builds

---

## Step 4 — Internal Testing (fastest path, no Google review)

Up to 100 testers by Gmail. Available immediately after uploading.

1. In Play Console → **Testing → Internal testing → Create new release**
2. Upload the `.aab` from Step 3
3. Add release notes (e.g. "Initial test build")
4. Save and roll out
5. Go to **Testers** tab → add Gmail addresses
6. Testers receive an opt-in link → they accept → app appears in their Play Store

---

## Step 5 — Store listing (required before production)

### Short description (80 chars max)
```
Real estate portfolio management with AI-powered insights
```

### Full description
```
Asset Brain is a real estate portfolio management app for landlords and property investors.

Track rent collection, manage leases and tenants, monitor maintenance, and get AI-powered briefings across your entire portfolio.

Features:
• Portfolio dashboard with health scores and collection rates
• Rent tracking and one-tap payment recording
• Lease and tenant management with auto-generated rent charges
• Maintenance ticket tracking by priority
• AI daily/weekly/monthly portfolio briefings
• Scenario modeling — Hold, Refinance, Sell, Buy Another
• Portfolio optimizer ranked by annual benefit
• Action queue with emergency and warning alerts
```

### Screenshots required
Minimum 2, Google recommends 8. Take from simulator:
- Home screen (hero card + quick stats)
- Portfolio list
- Property detail (units tab)
- Rent ledger
- Intelligence → Alerts tab
- Intelligence → Optimizer tab
- Intelligence → Scenarios tab
- Lease creation sheet

### Assets needed
| Asset | Size |
|-------|------|
| App icon | 512×512 PNG |
| Feature graphic | 1024×500 PNG |
| Phone screenshots | Min 2, 16:9 or 9:16 |

---

## Step 6 — Privacy policy (required)

Google requires a publicly hosted privacy policy URL.

**Quickest option:** Create a public Notion page or GitHub Gist.

**Must mention:**
- Email and name collected via Supabase Auth for authentication
- Device push tokens stored for notifications
- Property and financial data stored on Supabase (encrypted at rest)
- Data is not sold to third parties
- Users can request data deletion by emailing [your email]
- Uses Anthropic Claude API for AI features (no user data stored by Anthropic beyond the request)

---

## Step 7 — Data Safety form (in Play Console)

Under **Policy → App content → Data safety**, declare:

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email address | Yes | No | Authentication |
| Name | Yes | No | Account display |
| Device/other IDs | Yes | No | Push notifications |
| Financial info | Yes | No | Core app functionality |
| App activity | Yes | No | Analytics/crash reporting |

---

## Step 8 — Closed Testing → Production

Google requires this before public listing:
1. **Closed Testing** — at least **20 testers** for at least **14 days**
2. After 14 days, apply for production access
3. Google reviews the app — **3–7 days** (first submission takes longer)

---

## Releasing updates

Every new release needs an incremented `versionCode` in `app.json`:

```json
"android": {
  "versionCode": 2
}
```

Then rebuild and upload:
```bash
eas build --platform android --profile production
```
Upload new `.aab` in Play Console → Production → Create new release.

---

## Useful commands

```bash
# Check build status
eas build:list

# View logs for a specific build
eas build:view

# Submit directly to Play Store (requires service account key setup)
eas submit --platform android

# Check your current EAS account
eas whoami
```

---

## Timeline summary

| Milestone | When |
|-----------|------|
| Brother gets APK (sideload) | Today |
| Google account approved | 1–3 days after $25 payment |
| Internal Testing live on Play Store | Same day as account approval |
| Closed Testing complete | 14 days after starting |
| Production (public listing) | 3–7 days after Google review |
| **Total to public** | **~3–5 weeks** |

---

## Key links

- EAS Dashboard: https://expo.dev/accounts/kocharpratik11/projects/asset-brain
- Play Console: https://play.google.com/console
- EAS Docs: https://docs.expo.dev/build/introduction/
- Play Store listing best practices: https://developer.android.com/distribute/best-practices/launch/store-listing
