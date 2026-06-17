"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";
import { LogOut, Menu, X, Bell } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/broiler-flocks", label: "Broiler Flocks" },
    { href: "/diseases", label: "Diseases" },
    { href: "/alerts", label: "Alerts" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/projections", label: "Projections" },
    { href: "/expansion-plan", label: "Expansion Plan" },
    ...(user?.role === "owner" ? [{ href: "/users", label: "Users" }] : []),
  ];

  if (!user) return null;

  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-primary">
              Nkuku
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
          <div className="flex items-center gap-4">
            <Link href="/alerts" className="hidden sm:block relative">
              <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </Link>
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {user.name || user.email} ({user.role})
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
        </div>
      )}
    </nav>
  );
}
