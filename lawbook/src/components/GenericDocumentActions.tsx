"use client";

import { useState } from "react";
import { CopyIcon, LinkIcon } from "@/components/icons";

export function GenericDocumentActions({
  title,
  path,
  excerpt,
}: {
  title: string;
  path: string;
  excerpt?: string;
}) {
  const [copied, setCopied] = useState<
    "title" | "link" | "excerpt" | "failed" | null
  >(null);

  const copy = async (kind: "title" | "link" | "excerpt", value: string) => {
    try {
      await writePlainClipboard(value);
      setCopied(kind);
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied(null), 1600);
  };

  const buttonClass =
    "inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-foreground";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => copy("title", title)}
        className={buttonClass}
      >
        <CopyIcon className="h-4 w-4" />
        {copied === "title"
          ? "Copied"
          : copied === "failed"
            ? "Copy failed"
            : "Copy title"}
      </button>
      <button
        type="button"
        onClick={() => copy("link", absoluteUrl(path))}
        className={buttonClass}
      >
        <LinkIcon className="h-4 w-4" />
        {copied === "link"
          ? "Copied"
          : copied === "failed"
            ? "Copy failed"
            : "Copy link"}
      </button>
      {excerpt && (
        <button
          type="button"
          onClick={() => copy("excerpt", `${title}\n\n${excerpt}`)}
          className={buttonClass}
        >
          <CopyIcon className="h-4 w-4" />
          {copied === "excerpt"
            ? "Copied"
            : copied === "failed"
              ? "Copy failed"
              : "Copy text"}
        </button>
      )}
    </span>
  );
}

async function writePlainClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("Copy command failed");
}

function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}
