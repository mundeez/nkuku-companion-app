"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { LogOut, Menu, X, Bell, Sun, Moon, Settings } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/broiler-flocks", label: "Broiler Flocks" },
    { href: "/diseases", label: "Diseases" },
    { href: "/alerts", label: "Alerts" },
    { href: "/vaccine-inventory", label: "Vaccine Inventory" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/projections", label: "Projections" },
    { href: "/expansion-plan", label: "Expansion Plan" },
    { href: "/financials", label: "Financials" },
    ...(user?.role === "owner" ? [{ href: "/users", label: "Users" }] : []),
  ];

  if (!user) return null;

  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Nkuku" className="h-10 w-auto" />
            </Link>
            <div className="hidden md:flex gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex h-9 w-9"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/alerts" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Bell className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/settings" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <span className="hidden md:inline text-sm text-muted-foreground">
              {user.name || user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
            <button
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t px-4 py-2 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/settings" className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
            Settings
          </Link>
        </div>
      )}
    </nav>
  );
}
