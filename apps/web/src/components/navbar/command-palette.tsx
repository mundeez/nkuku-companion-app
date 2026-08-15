"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  Search,
  X,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CommandItem = {
  href: string;
  label: string;
  group: string;
};

interface CommandPaletteProps {
  items: CommandItem[];
}

export function CommandPalette({ items }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [open]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex].href);
    }
  };

  const grouped = React.useMemo(() => {
    const map: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    }
    return Object.entries(map);
  }, [filtered]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-9 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline">Search...</span>
        <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search pages..."
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close command palette"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            ) : (
              grouped.map(([group, groupItems], groupIndex) => {
                let flatIndex = 0;
                for (let i = 0; i < groupIndex; i++) {
                  flatIndex += grouped[i][1].length;
                }
                return (
                  <div key={group} className="px-2 py-1">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group}
                    </div>
                    {groupItems.map((item, i) => {
                      const index = flatIndex + i;
                      const selected = index === selectedIndex;
                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => handleSelect(item.href)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Command className="h-4 w-4 opacity-70" />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ArrowRight
                            className={cn(
                              "h-3.5 w-3.5",
                              selected ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
          <div className="hidden sm:flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 font-mono">↑</kbd>
                <kbd className="rounded border bg-muted px-1 font-mono">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono">esc</kbd>
              to close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
