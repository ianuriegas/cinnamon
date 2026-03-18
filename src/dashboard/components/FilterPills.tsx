interface FilterPillOption {
  value: string;
  label: string;
  color?: string;
}

interface FilterPillsProps {
  label?: string;
  options: readonly FilterPillOption[];
  value: string;
  onChange: (value: string) => void;
  showDot?: boolean;
}

export function FilterPills({
  label,
  options,
  value,
  onChange,
  showDot = false,
}: FilterPillsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-xs text-muted-foreground mr-1">{label}</span>}
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(isActive ? "" : opt.value)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
              isActive
                ? "border-transparent"
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
            }`}
            style={
              isActive && opt.color
                ? { backgroundColor: opt.color, color: "var(--gruvbox-bg0)" }
                : undefined
            }
          >
            {showDot && opt.color && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: isActive ? "var(--gruvbox-bg0)" : opt.color,
                }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
