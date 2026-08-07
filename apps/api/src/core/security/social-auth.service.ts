/**
 * Social authentication verification service.
 *
 * Verifies identity tokens / access tokens from external providers
 * (Google, Facebook, Apple, Microsoft) and extracts the user's
 * provider-scoped identity (providerUserId, email, name).
 *
 * Two verification modes:
 * 1. ID token verification (Google, Apple, Microsoft) — the client (mobile
 *    SDK or web callback) sends a JWT ID token that we verify using the
 *    provider's public keys.
 * 2. Access token verification (Facebook) — the client sends a Facebook
 *    access token that we verify by calling the Graph API.
 *
 * For the web OAuth flow, the client may also send an authorization code
 * which the API exchanges for tokens with the provider's token endpoint.
 */

import { OAuth2Client } from 'google-auth-library';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export type SocialProvider = 'google' | 'facebook' | 'apple' | 'microsoft';

export interface SocialUserInfo {
  providerUserId: string;
  email?: string;
  name?: string;
}

// ── Google ───────────────────────────────
// Google ID tokens are verified using google-auth-library, which handles
// JWKS fetching and token signature verification automatically.
let googleClient: OAuth2Client | null = null;

function getGoogleClient(): OAuth2Client {
  if (!googleClient) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID not configured');
    }
    googleClient = new OAuth2Client(clientId);
  }
  return googleClient;
}

async function verifyGoogle(idToken: string): Promise<SocialUserInfo> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const ticket = await getGoogleClient().verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error('Invalid Google token: missing payload');
  }
  return {
    providerUserId: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}

// ── Facebook ─────────────────────────────
// Facebook access tokens are verified by calling the Graph API /me endpoint.
// We also verify the token against our app's app secret for extra security.
async function verifyFacebook(accessToken: string): Promise<SocialUserInfo> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not configured');
  }

  // Verify the token is valid for our app
  const inspectUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`;
  const inspectRes = await fetch(inspectUrl);
  const inspectData = await inspectRes.json() as any;
  if (!inspectData?.data?.is_valid) {
    throw new Error('Invalid Facebook access token');
  }
  if (inspectData.data.app_id !== appId) {
    throw new Error('Facebook token is for a different app');
  }

  // Get user info
  const meUrl = `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`;
  const meRes = await fetch(meUrl);
  const meData = await meRes.json() as any;
  if (!meData?.id) {
    throw new Error('Failed to get Facebook user info');
  }
  return {
    providerUserId: meData.id,
    email: meData.email,
    name: meData.name,
  };
}

// ── Apple ────────────────────────────────
// Apple ID tokens are JWTs signed with Apple's private key. We verify them
// using Apple's public JWKS endpoint.
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
let appleJWKS: any = null;

function getAppleJWKS() {
  if (!appleJWKS) {
    appleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  }
  return appleJWKS;
}

async function verifyApple(idToken: string): Promise<SocialUserInfo> {
  const clientId = process.env.APPLE_CLIENT_ID; // Service ID
  if (!clientId) {
    throw new Error('APPLE_CLIENT_ID not configured');
  }

  const { payload } = await jwtVerify(idToken, getAppleJWKS(), {
    issuer: 'https://appleid.apple.com',
    audience: clientId,
  });

  if (!payload.sub) {
    throw new Error('Invalid Apple token: missing subject');
  }

  // Apple may not always provide email in the ID token (only on first login)
  const email = payload.email as string | undefined;
  const name = (payload as any).name as string | undefined;

  return {
    providerUserId: payload.sub as string,
    email,
    name,
  };
}

// ── Microsoft ────────────────────────────
// Microsoft ID tokens are JWTs signed with Microsoft's public keys.
// We verify using the Microsoft JWKS endpoint.
const MICROSOFT_JWKS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
let microsoftJWKS: any = null;

function getMicrosoftJWKS() {
  if (!microsoftJWKS) {
    microsoftJWKS = createRemoteJWKSet(new URL(MICROSOFT_JWKS_URL));
  }
  return microsoftJWKS;
}

async function verifyMicrosoft(idToken: string): Promise<SocialUserInfo> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID not configured');
  }

  // Microsoft's issuer varies by tenant. For common/multi-tenant apps,
  // we verify the issuer starts with the expected prefix.
  const { payload } = await jwtVerify(idToken, getMicrosoftJWKS(), {
    audience: clientId,
  });

  // Verify issuer — Microsoft uses different issuers per tenant
  const issuer = payload.iss as string;
  if (!issuer || !issuer.startsWith('https://login.microsoftonline.com/')) {
    throw new Error('Invalid Microsoft token issuer');
  }

  if (!payload.sub) {
    throw new Error('Invalid Microsoft token: missing subject');
  }

  // Microsoft provides email in the 'email' or 'preferred_username' claim
  const email = (payload.email || payload.preferred_username) as string | undefined;
  const name = payload.name as string | undefined;

  return {
    providerUserId: payload.sub as string,
    email,
    name,
  };
}

// ── Public API ───────────────────────────

/**
 * Verify a social provider token and return the user's info.
 *
 * @param provider The social provider name
 * @param token The ID token (Google, Apple, Microsoft) or access token (Facebook)
 * @returns The user's provider-scoped identity
 */
export async function verifySocialToken(
  provider: SocialProvider,
  token: string,
): Promise<SocialUserInfo> {
  switch (provider) {
    case 'google':
      return verifyGoogle(token);
    case 'facebook':
      return verifyFacebook(token);
    case 'apple':
      return verifyApple(token);
    case 'microsoft':
      return verifyMicrosoft(token);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Exchange an authorization code for tokens with the provider's token endpoint.
 * Used by the web OAuth redirect flow.
 *
 * @param provider The social provider name
 * @param code The authorization code from the OAuth redirect
 * @param redirectUri The redirect URI used in the initial auth request
 * @returns The ID token (or access token for Facebook) from the provider
 */
export async function exchangeCodeForToken(
  provider: SocialProvider,
  code: string,
  redirectUri: string,
): Promise<string> {
  switch (provider) {
    case 'google': {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error('Google OAuth not configured');
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const data = await res.json() as any;
      if (!data.id_token) throw new Error('Failed to exchange Google code: no id_token');
      return data.id_token as string;
    }
    case 'facebook': {
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      if (!appId || !appSecret) throw new Error('Facebook OAuth not configured');
      const res = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
        }),
      });
      const data = await res.json() as any;
      if (!data.access_token) throw new Error('Failed to exchange Facebook code: no access_token');
      return data.access_token as string;
    }
    case 'apple': {
      const clientId = process.env.APPLE_CLIENT_ID;
      const teamId = process.env.APPLE_TEAM_ID;
      const keyId = process.env.APPLE_KEY_ID;
      const privateKey = process.env.APPLE_PRIVATE_KEY;
      if (!clientId || !teamId || !keyId || !privateKey) {
        throw new Error('Apple OAuth not configured');
      }
      // Apple requires a client_secret JWT signed with the private key
      const clientSecret = await createAppleClientSecret(clientId, teamId, keyId, privateKey);
      const res = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const data = await res.json() as any;
      if (!data.id_token) throw new Error('Failed to exchange Apple code: no id_token');
      return data.id_token as string;
    }
    case 'microsoft': {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error('Microsoft OAuth not configured');
      const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const data = await res.json() as any;
      if (!data.id_token) throw new Error('Failed to exchange Microsoft code: no id_token');
      return data.id_token as string;
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Create a client_secret JWT for Apple Sign In.
 * Apple requires the client_secret to be a JWT signed with the private key
 * associated with your Sign in with Apple key.
 */
async function createAppleClientSecret(
  clientId: string,
  teamId: string,
  keyId: string,
  privateKey: string,
): Promise<string> {
  const { SignJWT } = await import('jose');
  // Parse the private key (PEM format)
  const key = await import('jose').then(jose => jose.importPKCS8(privateKey, 'ES256'));
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600) // 1 hour
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(key);
}

/**
 * Get the OAuth authorization URL for a provider (web redirect flow).
 */
export function getAuthorizationUrl(
  provider: SocialProvider,
  redirectUri: string,
  state: string,
): string {
  switch (provider) {
    case 'google': {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    case 'facebook': {
      const appId = process.env.FACEBOOK_APP_ID;
      if (!appId) throw new Error('FACEBOOK_APP_ID not configured');
      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email public_profile',
        state,
      });
      return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
    }
    case 'apple': {
      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) throw new Error('APPLE_CLIENT_ID not configured');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'name email',
        state,
        response_mode: 'form_post',
      });
      return `https://appleid.apple.com/auth/authorize?${params}`;
    }
    case 'microsoft': {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      if (!clientId) throw new Error('MICROSOFT_CLIENT_ID not configured');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
      });
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Check if a provider is configured (has the required env vars).
 */
export function isProviderConfigured(provider: SocialProvider): boolean {
  switch (provider) {
    case 'google':
      return !!(process.env.GOOGLE_CLIENT_ID);
    case 'facebook':
      return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
    case 'apple':
      return !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);
    case 'microsoft':
      return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
    default:
      return false;
  }
}
