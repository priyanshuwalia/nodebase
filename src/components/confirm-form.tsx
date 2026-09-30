"use client";

import type { ComponentProps, ReactNode } from "react";

export function ConfirmForm({
  message,
  children,
  action,
  className,
}: {
  message: string;
  children: ReactNode;
  action: ComponentProps<"form">["action"];
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
