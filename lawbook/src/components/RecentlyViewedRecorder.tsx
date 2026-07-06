"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import type { RecentDocumentType } from "@/lib/recently-viewed";

export function RecentlyViewedRecorder({
  docType,
  docId,
  title,
  path,
}: {
  docType: RecentDocumentType;
  docId: string;
  title: string;
  path: string;
}) {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!session?.user) return;
    const controller = new AbortController();
    void fetch("/api/recently-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType, docId, title, path }),
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [session?.user, docType, docId, title, path]);

  return null;
}
