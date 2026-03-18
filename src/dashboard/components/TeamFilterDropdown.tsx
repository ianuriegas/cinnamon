import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TeamFilterDropdownProps {
  teams: string[];
  selected: string | null;
  onSelect: (team: string) => void;
}

export function TeamFilterDropdown({ teams, selected, onSelect }: TeamFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setTeamSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = teams.filter((t) => t.toLowerCase().includes(teamSearch.toLowerCase()));

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Team</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`px-2.5 py-1 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
            selected
              ? "border-transparent"
              : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
          }`}
          style={
            selected
              ? { backgroundColor: "var(--gruvbox-purple)", color: "var(--gruvbox-bg0)" }
              : undefined
          }
        >
          {selected ?? "Select..."}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search teams..."
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No teams found</p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                      setTeamSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-accent transition-colors ${
                      selected === t ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t}
                    {selected === t && (
                      <Check
                        className="w-3.5 h-3.5"
                        style={{ color: "var(--gruvbox-green-bright)" }}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
