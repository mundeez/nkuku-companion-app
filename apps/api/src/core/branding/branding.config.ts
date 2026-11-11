/**
 * White-label branding configuration.
 *
 * Reads from environment variables to allow enterprise/self-hosted deployments
 * to customize the application's branding without code changes.
 *
 * All values have sensible defaults that match the standard Nkuku branding.
 */
export interface BrandingConfig {
  /** Company / product name shown in headers, emails, and documents. */
  appName: string;
  /** Short tagline shown on login screen. */
  tagline: string;
  /** Primary brand color (hex) for UI accents. */
  primaryColor: string;
  /** Logo URL (publicly accessible). If empty, falls back to text logo. */
  logoUrl: string;
  /** Favicon URL. If empty, uses default. */
  faviconUrl: string;
  /** Support email shown in footer and help pages. */
  supportEmail: string;
  /** Support phone number (optional). */
  supportPhone: string;
  /** Company website URL. */
  websiteUrl: string;
  /** Whether this is a white-labeled deployment (hides Nkuku references). */
  isWhiteLabel: boolean;
  /** License key (for self-hosted enterprise deployments). */
  licenseKey: string;
  /** Licensed organization name. */
  licensedTo: string;
  /** License expiry date (ISO string). Empty for perpetual licenses. */
  licenseExpiry: string;
}

function env(key: string, fallback = ""): string {
  const val = process.env[key];
  return val !== undefined && val !== "" ? val : fallback;
}

let cachedConfig: BrandingConfig | null = null;

/**
 * Returns the current branding configuration.
 * Cached after first read since env vars don't change at runtime.
 */
export function getBrandingConfig(): BrandingConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    appName: env("BRAND_APP_NAME", "Nkuku Companion"),
    tagline: env("BRAND_TAGLINE", "Poultry Farm Management"),
    primaryColor: env("BRAND_PRIMARY_COLOR", "#16a34a"),
    logoUrl: env("BRAND_LOGO_URL", ""),
    faviconUrl: env("BRAND_FAVICON_URL", ""),
    supportEmail: env("BRAND_SUPPORT_EMAIL", "support@nkuku.app"),
    supportPhone: env("BRAND_SUPPORT_PHONE", ""),
    websiteUrl: env("BRAND_WEBSITE_URL", "https://nkuku.deeztechnology.solutions"),
    isWhiteLabel: env("BRAND_WHITE_LABEL", "false").toLowerCase() === "true",
    licenseKey: env("LICENSE_KEY", ""),
    licensedTo: env("LICENSED_TO", ""),
    licenseExpiry: env("LICENSE_EXPIRY", ""),
  };

  return cachedConfig;
}

/**
 * Validates the license key for self-hosted deployments.
 * Returns true if the license is valid or if no license is required
 * (e.g. SaaS deployment where billing handles entitlement).
 */
export function validateLicense(): { valid: boolean; reason?: string } {
  const config = getBrandingConfig();

  // SaaS deployments don't need a license key — billing handles entitlement.
  if (!config.licenseKey) {
    return { valid: true };
  }

  // Check license expiry.
  if (config.licenseExpiry) {
    const expiry = new Date(config.licenseExpiry);
    if (expiry < new Date()) {
      return { valid: false, reason: "License expired" };
    }
  }

  // Basic format validation: license keys are UUID-like.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(config.licenseKey)) {
    return { valid: false, reason: "Invalid license key format" };
  }

  return { valid: true };
}

/**
 * Reset the cached config (for testing).
 */
export function resetBrandingConfig(): void {
  cachedConfig = null;
}

/**
 * Validates the license key against the database (if a Prisma client is
 * provided). Falls back to env-var-only validation if no client is given.
 *
 * This allows the admin-ops module to check whether a license key is
 * registered in the `licenses` table and whether it's active.
 */
export async function validateLicenseDb(prisma?: any): Promise<{ valid: boolean; reason?: string }> {
  // First do the env-based validation
  const envResult = validateLicense();
  if (!envResult.valid) return envResult;

  // If no prisma client or no license key, env validation is sufficient
  if (!prisma) return envResult;
  const config = getBrandingConfig();
  if (!config.licenseKey) return envResult;

  try {
    const license = await prisma.license.findUnique({
      where: { licenseKey: config.licenseKey },
    });

    if (!license) {
      return { valid: false, reason: "License key not found in database" };
    }

    if (license.status === 'revoked') {
      return { valid: false, reason: "License has been revoked" };
    }

    if (license.status === 'suspended') {
      return { valid: false, reason: "License is suspended" };
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      return { valid: false, reason: "License has expired" };
    }

    return { valid: true };
  } catch {
    // If the licenses table doesn't exist yet, fall back to env validation
    return envResult;
  }
}
