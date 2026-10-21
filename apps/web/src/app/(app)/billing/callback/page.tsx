"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyPayment } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const txRef = searchParams.get("tx_ref") || searchParams.get("txRef");
    const statusParam = searchParams.get("status");

    if (!txRef) {
      setStatus("failed");
      setMessage("No transaction reference found in the URL.");
      return;
    }

    if (statusParam === "cancelled") {
      setStatus("failed");
      setMessage("Payment was cancelled.");
      return;
    }

    verifyPayment(txRef)
      .then((result) => {
        if (result.success) {
          setStatus("success");
          setMessage(result.message || "Payment verified successfully!");
        } else {
          setStatus("failed");
          setMessage(result.message || "Payment verification failed.");
        }
      })
      .catch((err) => {
        setStatus("failed");
        setMessage(err.message || "An error occurred during verification.");
      });
  }, [searchParams]);

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Payment {status === "verifying" ? "Verification" : status === "success" ? "Successful" : "Failed"}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === "verifying" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Verifying your payment...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <p className="mb-4">{message}</p>
              <Button onClick={() => router.push("/billing")}>Go to Billing</Button>
            </>
          )}
          {status === "failed" && (
            <>
              <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="mb-4 text-muted-foreground">{message}</p>
              <Button variant="outline" onClick={() => router.push("/billing")}>Back to Billing</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
