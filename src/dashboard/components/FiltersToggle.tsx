import { SlidersHorizontal } from "lucide-react";

interface FiltersToggleProps {
  open: boolean;
  activeCount: number;
  onToggle: () => void;
}

export function FiltersToggle({ open, activeCount, onToggle }: FiltersToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        open || activeCount > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <SlidersHorizontal className="w-3.5 h-3.5" />
      Filters
      {activeCount > 0 && (
        <span
          className="px-1.5 py-0.5 rounded-full text-xs"
          style={{
            backgroundColor: "var(--gruvbox-orange-bright)",
            color: "var(--gruvbox-bg0)",
          }}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}
