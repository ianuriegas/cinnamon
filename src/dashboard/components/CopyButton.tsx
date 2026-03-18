import { useCallback, useRef, useState } from "react";

export function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [getText]);

  return (
    <button
      type="button"
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      onClick={copy}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
