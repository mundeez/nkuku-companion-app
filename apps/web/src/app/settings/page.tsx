"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { apiFetch } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Monitor, TrendingUp, HeartPulse, Syringe, DollarSign } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [breeds, setBreeds] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      Promise.all([
        apiFetch("/api/v1/breeds"),
        apiFetch("/api/v1/vaccination-events").catch(() => []),
      ]).then(([b]) => {
        setBreeds(b);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [user, isLoading, router]);

  if (isLoading || loading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const primaryBreed = breeds.find((b: any) => b.isPrimary);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Configure your broiler management preferences</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {resolvedTheme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Choose your preferred theme</p>
            <div className="flex gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4 mr-1" /> Light
              </Button>
              <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4 mr-1" /> Dark
              </Button>
              <Button variant={theme === "system" ? "default" : "outline"} size="sm" onClick={() => setTheme("system")}>
                <Monitor className="h-4 w-4 mr-1" /> System
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Breed Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5" />
              Primary Breed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{primaryBreed?.name || "Not set"}</p>
                  <p className="text-sm text-muted-foreground">{primaryBreed?.supplier || ""}</p>
                </div>
                {primaryBreed?.isPrimary && <Badge>Primary</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Performance targets: {primaryBreed?.performanceTargets?.length || 0} days of data</p>
                <p className="mt-1">Official Aviagen 2022 data for Ross 308</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Currency Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5" />
              Currency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">ZMW</p>
                <Badge>Zambian Kwacha</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                All financial records are stored and displayed in ZMW. This is the default currency for the Nkuku app.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Vaccination Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Syringe className="h-5 w-5" />
              Vaccination Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">Standard Broiler Schedule</p>
                <Badge variant="outline">Default</Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-medium">Ross 308 Comprehensive</p>
                <Badge variant="secondary">Recommended</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Dual schedules available. The Ross 308 schedule is recommended for Ross 308 flocks.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Disease Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-5 w-5" />
              Disease Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">10 diseases documented with:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Symptoms & diagnosis</li>
                <li>Prevention strategies</li>
                <li>Standard treatments</li>
                <li>Organic treatment options</li>
              </ul>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => router.push("/diseases")}>
                Browse Diseases
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{user?.name || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Role</span><Badge>{user?.role}</Badge></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
