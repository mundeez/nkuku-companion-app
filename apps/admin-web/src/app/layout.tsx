import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { ReauthProvider } from "@/components/reauth-modal";

export const metadata: Metadata = {
  title: "Nkuku Platform Console",
  description: "Staff-only platform operations console for Nkuku Companion",
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          <ReauthProvider>{children}</ReauthProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
