/**
 * Composable conversation-message primitives for Ask Lawplain.
 *
 * The shape is inspired by the shadcn `Message` composition — a row that owns
 * avatar + alignment, with a content column holding an optional header, the
 * message surface (`Bubble`), and an optional footer — but it is built on
 * Lawplain's own design tokens (no shadcn/radix dependency).
 *
 *   Message            row: avatar + content, aligned start (assistant) or end (user)
 *   ├── MessageAvatar  avatar slot, top-anchored next to the header
 *   └── MessageContent column: header, bubble(s), footer
 *       ├── MessageHeader
 *       ├── Bubble       (w-fit; hugs the message side)
 *       └── MessageFooter
 */
"use client";

import { createContext, type ReactNode, useContext } from "react";

type Align = "start" | "end";

const AlignContext = createContext<Align>("start");

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** The message row. `align="end"` mirrors the row for the sender's own messages. */
export function Message({
  align = "start",
  className,
  children,
}: {
  align?: Align;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AlignContext.Provider value={align}>
      <div
        data-align={align}
        className={cx(
          "flex items-start gap-2.5",
          align === "end" && "flex-row-reverse",
          className,
        )}
      >
        {children}
      </div>
    </AlignContext.Provider>
  );
}

/** Avatar slot. Top-anchored so it sits beside the header / first line. */
export function MessageAvatar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx("mt-0.5 shrink-0", className)}>{children}</div>;
}

/**
 * Content column — header, surface, footer. Holds a stable 85%-of-row width so
 * full-width children (live status, action rows) read consistently; the
 * `Bubble` shrinks to its content and hugs the correct side.
 */
export function MessageContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex w-full min-w-0 max-w-[85%] flex-col gap-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small label above the surface (e.g. the sender name). */
export function MessageHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const align = useContext(AlignContext);
  return (
    <div
      className={cx(
        "px-1 text-[11px] font-medium text-muted-2",
        align === "end" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Row below the surface for metadata or actions; follows the message side. */
export function MessageFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const align = useContext(AlignContext);
  return (
    <div
      className={cx(
        "flex w-full flex-wrap items-center gap-1",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}

type BubbleVariant = "user" | "assistant" | "plain";

/**
 * The visible message surface. Padding and typography are passed via
 * `className` per use so callers stay free of Tailwind conflicts; the variant
 * owns only the fill. The bubble shrinks to its content and hugs the message
 * side via an auto margin, and the corner "tail" follows that side.
 */
export function Bubble({
  variant = "assistant",
  className,
  children,
}: {
  variant?: BubbleVariant;
  className?: string;
  children: ReactNode;
}) {
  const align = useContext(AlignContext);
  const tail =
    align === "end" ? "rounded-br-md ml-auto" : "rounded-bl-md mr-auto";
  const fill: Record<BubbleVariant, string> = {
    user: "bg-foreground text-primary-fg",
    assistant: "border border-border bg-surface-2/40 text-foreground",
    plain: "",
  };
  return (
    <div
      className={cx(
        "w-fit max-w-full rounded-2xl",
        tail,
        fill[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
