"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  /**
   * Controlled search value. When provided and changed externally
   * (e.g. "Clear Filters"), the input text is synced to it.
   */
  value?: string;
  /** Called with the trimmed query after the debounce delay. */
  onSearch: (value: string) => void;
  /** Placeholder text, e.g. "Search flocks…" */
  placeholder?: string;
  /** Debounce delay in milliseconds. Defaults to 300. */
  debounceMs?: number;
  className?: string;
}

/**
 * Reusable search toolbar input with a leading search icon, ~300ms
 * debounce, and a clear (×) button. Emits the trimmed query via
 * `onSearch`; an empty string means "no search".
 */
export function SearchInput({
  value,
  onSearch,
  placeholder = "Search…",
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [text, setText] = useState(value ?? "");
  // Tracks the last value emitted to the parent so that external `value`
  // changes can be distinguished from our own debounced emits.
  const lastEmitted = useRef(value ?? "");
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  // Sync the draft text when the controlled value changes externally
  // (e.g. a parent-level "clear filters" action).
  useEffect(() => {
    if (value !== undefined && value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value);
    }
  }, [value]);

  // Debounced emit of the trimmed query.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = text.trim();
      if (trimmed !== lastEmitted.current) {
        lastEmitted.current = trimmed;
        onSearchRef.current(trimmed);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [text, debounceMs]);

  function handleClear() {
    setText("");
    if (lastEmitted.current !== "") {
      lastEmitted.current = "";
      onSearchRef.current("");
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleClear();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9 pr-9"
      />
      {text && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
