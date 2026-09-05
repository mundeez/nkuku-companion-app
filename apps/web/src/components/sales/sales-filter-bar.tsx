"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SalesFilter, PaymentStatus, BroilerFlock } from "@/lib/types";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";

interface SalesFilterBarProps {
  filter: SalesFilter;
  onChange: (filter: SalesFilter) => void;
  flocks?: BroilerFlock[];
  showFlockFilter?: boolean;
}

export function SalesFilterBar({ filter, onChange, flocks = [], showFlockFilter = true }: SalesFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [customerInput, setCustomerInput] = useState(filter.customer ?? "");

  // Debounce customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerInput !== (filter.customer ?? "")) {
        onChange({ ...filter, customer: customerInput || undefined, offset: 0 });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerInput]);

  const activeCount = [
    filter.fromDate,
    filter.toDate,
    filter.paymentStatus,
    showFlockFilter ? filter.flockId : null,
    filter.customer,
  ].filter(Boolean).length;

  const update = useCallback((patch: Partial<SalesFilter>) => {
    onChange({ ...filter, ...patch, offset: 0 });
  }, [filter, onChange]);

  const clear = () => {
    setCustomerInput("");
    onChange({ limit: filter.limit, offset: 0 });
  };

  return (
    <div className="mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="mb-2"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
        {activeCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-primary text-primary-foreground">
            {activeCount}
          </span>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
      </Button>

      {expanded && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {/* Date Range */}
              <div>
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={filter.fromDate ?? ""}
                  onChange={(e) => update({ fromDate: e.target.value || undefined })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={filter.toDate ?? ""}
                  onChange={(e) => update({ toDate: e.target.value || undefined })}
                  className="mt-1"
                />
              </div>

              {/* Payment Status */}
              <div>
                <Label className="text-xs">Payment Status</Label>
                <select
                  className="flex h-9 w-full mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  value={filter.paymentStatus ?? ""}
                  onChange={(e) => update({ paymentStatus: (e.target.value || undefined) as PaymentStatus | undefined })}
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {/* Flock Filter (optional) */}
              {showFlockFilter && flocks.length > 0 && (
                <div>
                  <Label className="text-xs">Flock</Label>
                  <select
                    className="flex h-9 w-full mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                    value={filter.flockId ?? ""}
                    onChange={(e) => update({ flockId: e.target.value || undefined })}
                  >
                    <option value="">All Flocks</option>
                    {flocks.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer Search */}
              <div className="md:col-span-2 lg:col-span-2">
                <Label className="text-xs">Customer Search</Label>
                <Input
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="mt-1"
                />
              </div>
            </div>

            {activeCount > 0 && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clear}>
                  <X className="h-4 w-4 mr-1" /> Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
