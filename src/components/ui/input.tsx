import * as React from "react";

import { cn } from "@/lib/utils";

/** Autofill is off on every field in the sample app; pass autoComplete only for the email code. */
function Input({ className, type, autoComplete = "off", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      autoComplete={autoComplete}
      data-slot="input"
      className={cn(
        "min-h-tap-big w-full min-w-0 rounded-control border-2 border-input bg-surface px-4 py-2 text-body text-foreground",
        "aria-[invalid=true]:border-heading aria-[invalid=true]:bg-destructive",
        "disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
