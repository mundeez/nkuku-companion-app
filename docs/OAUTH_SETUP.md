# Social Login OAuth Setup Guide

This guide covers setting up OAuth credentials for Google, Facebook, Apple, and Microsoft social login.

## Overview

The Nkuku Companion App supports social login with four providers. Each provider is optional — when its env vars are blank, the provider is disabled and its button doesn't show.

After obtaining credentials, add them to your `.env` file and restart the API container.

---

## 1. Google

### Prerequisites
- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

### Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Create a new project (or select existing) → e.g. "Nkuku Companion"
3. Go to **OAuth consent screen**:
   - User type: **External** (or Internal if you have a Google Workspace)
   - App name: `Nkuku Companion`
   - Support email: your email
   - Authorized domains: `nkuku.deeztechnology.solutions` (your production domain)
   - Scopes: `email`, `profile`, `openid`
   - Save and continue
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**:
   - Application type: **Web application** (for web OAuth) AND **Android/iOS** (for mobile)
   - **Web**: Authorized redirect URIs:
     - `http://localhost:30000/api/v1/auth/social/callback` (dev)
     - `https://nkuku.deeztechnology.solutions/api/v1/auth/social/callback` (prod)
   - **Android**: Package name from `android/app/build.gradle.kts` (`applicationId`)
   - **iOS**: Bundle ID from Xcode project
5. Copy the **Client ID** and **Client Secret**

### Environment Variables
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Mobile (Android)
- Add the `google-services.json` file to `apps/mobile/android/app/`
- The `google_sign_in` Flutter package reads the client ID from this file
- Download it from Cloud Console → Credentials → your Android OAuth client → "Download JSON"

### Mobile (iOS)
- Add the `GoogleService-Info.plist` file to `apps/mobile/ios/Runner/`
- Update `Info.plist` → `CFBundleURLSchemes` → replace `YOUR_REVERSED_CLIENT_ID` with the reversed client ID from the plist

---

## 2. Facebook

### Prerequisites
- A Facebook account
- Access to [Facebook Developers](https://developers.facebook.com/)

### Steps

1. Go to [Facebook Developers](https://developers.facebook.com/) → **My Apps** → **Create App**
2. App type: **Consumer**
3. App name: `Nkuku Companion`
4. Add product: **Facebook Login**
5. Go to **Settings** → **Basic**:
   - Copy **App ID** and **App Secret**
   - Privacy Policy URL: `https://nkuku.deeztechnology.solutions/privacy`
   - App Domains: `nkuku.deeztechnology.solutions`
6. Go to **Facebook Login** → **Settings**:
   - Valid OAuth Redirect URIs:
     - `https://nkuku.deeztechnology.solutions/api/v1/auth/social/callback`
   - Client OAuth Login: **Yes**
7. Go to **App Review** → toggle **Live** (requires verified business)

### Environment Variables
```env
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
```

### Mobile (Android)
- Update `apps/mobile/android/app/src/main/res/values/strings.xml`:
  - `facebook_app_id`: your App ID
  - `facebook_client_token`: your Client Token (Settings → Advanced → Security)
  - `fb_login_protocol_scheme`: `fb<your_app_id>`
- Add your Android key hash to Facebook app settings:
  ```bash
  keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | base64
  ```

### Mobile (iOS)
- Update `apps/mobile/ios/Runner/Info.plist`:
  - `FacebookAppID`: your App ID
  - `FacebookClientToken`: your Client Token
  - `CFBundleURLSchemes` → `fb<your_app_id>`

---

## 3. Apple

### Prerequisites
- An Apple Developer account ($99/year)
- Access to [Apple Developer Portal](https://developer.apple.com/)

### Steps

1. Go to [Apple Developer Portal](https://developer.apple.com/) → **Certificates, IDs & Profiles** → **Identifiers**
2. Create or select your App ID (e.g. `com.deeztechnology.nkuku`):
   - Enable **Sign in with Apple** capability
3. Go to **Keys** → **Create a key**:
   - Name: `Nkuku SignIn with Apple`
   - Enable **Sign in with Apple** → Configure → select your App ID
   - Download the `.p8` key file (you can only download it once!)
   - Note the **Key ID**
4. Go to **Identifiers** → your App ID → **Sign in with Apple**:
   - Note your **Team ID** (found in top-right corner of developer portal)
5. Configure Service ID (for web login):
   - Create a new **Services ID** (e.g. `com.deeztechnology.nkuku.web`)
   - Enable **Sign in with Apple**
   - Return URLs: `https://nkuku.deeztechnology.solutions/api/v1/auth/social/callback`

### Environment Variables
```env
APPLE_CLIENT_ID=com.deeztechnology.nkuku.web  # Services ID for web
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
your-key-content-here
-----END PRIVATE KEY-----"
```

### Mobile (iOS)
- In Xcode → **Signing & Capabilities** → add **Sign in with Apple** capability
- The `sign_in_with_apple` Flutter package handles the native flow

### Mobile (Android)
- Apple Sign In is not available on Android (Apple platform only)
- The button will be hidden on Android automatically

---

## 4. Microsoft

### Prerequisites
- A Microsoft account (personal or work/school)
- Access to [Azure Portal](https://portal.azure.com/) or [Microsoft Entra ID](https://entra.microsoft.com/)

### Steps

1. Go to [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: `Nkuku Companion`
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
4. Redirect URI (Web):
   - `https://nkuku.deeztechnology.solutions/api/v1/auth/social/callback`
5. After creation, note the **Application (client) ID**
6. Go to **Certificates & secrets** → **New client secret**:
   - Copy the **Value** (not the Secret ID)
7. Go to **Authentication** → check **ID tokens** under Implicit grant
8. Go to **API permissions** → ensure `openid`, `profile`, `email` are granted

### Environment Variables
```env
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
```

### Mobile
- Microsoft sign-in on mobile uses the web OAuth flow (redirect to browser)
- No additional SDK configuration needed — the API handles token verification

---

## Verification

After setting up credentials:

1. Restart the API: `docker compose restart api`
2. Check the config endpoint:
   ```bash
   curl http://localhost:30001/api/v1/auth/social/config
   ```
   Configured providers should show `"configured": true`.
3. Test on the web login page — social login buttons should appear for configured providers.
4. Test on mobile — social login buttons should appear for configured providers.

## Production Checklist

- [ ] All OAuth redirect URIs use HTTPS production domain
- [ ] Facebook app is in "Live" mode (requires business verification)
- [ ] Apple key file is securely stored (can only be downloaded once)
- [ ] Microsoft client secret hasn't expired (default 1-2 years)
- [ ] Privacy policy URL is accessible
- [ ] Terms of service URL is accessible
- [ ] Test each provider end-to-end on both web and mobile
