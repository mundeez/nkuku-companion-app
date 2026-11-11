"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API_URL } from "@/lib/api/client";

export interface BrandingConfig {
  appName: string;
  tagline: string;
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  supportEmail: string;
  supportPhone: string;
  websiteUrl: string;
  isWhiteLabel: boolean;
}

const defaultBranding: BrandingConfig = {
  appName: "Nkuku Companion",
  tagline: "Poultry Farm Management",
  primaryColor: "#16a34a",
  logoUrl: "",
  faviconUrl: "",
  supportEmail: "support@nkuku.app",
  supportPhone: "",
  websiteUrl: "https://nkuku.deeztechnology.solutions",
  isWhiteLabel: false,
};

const BrandingContext = createContext<BrandingConfig>(defaultBranding);

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/v1/admin/branding`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setBranding(data as BrandingConfig);
          // Apply primary color as a CSS variable
          if (data.primaryColor) {
            document.documentElement.style.setProperty(
              "--brand-primary",
              data.primaryColor,
            );
          }
          // Update document title if white-labeled
          if (data.appName) {
            document.title = data.appName;
          }
        }
      })
      .catch(() => {
        // Silently fall back to defaults — branding is non-critical
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
