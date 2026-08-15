"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Moon, Sun, Settings, CreditCard, Bell } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavSection {
  title: string;
  items: { href: string; label: string }[];
}

interface MobileNavProps {
  sections: NavSection[];
}

export function MobileNav({ sections }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  if (!user) return null;

  const name = user.name || user.email;
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px] sm:w-80 p-0 flex flex-col">
        <div className="border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar src={user.image || null} alt={name} fallback={name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sections.map((section) => (
            <div key={section.title} className="px-3 py-2">
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

          <div className="px-3 py-2">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </p>
            <nav className="space-y-1">
              <Link
                href="/alerts"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Bell className="h-4 w-4" />
                Alerts
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <Link
                href="/billing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                Billing
              </Link>
            </nav>
          </div>
        </div>

        <div className="border-t p-4 space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setTheme(nextTheme)}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button
            variant="default"
            className="w-full justify-start"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
