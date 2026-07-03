// AiTags — tiny, self-contained chip row for ATAK AI tags. Renders an array of
// { label, kind } as minimal rounded pills (10-11px, 600 weight, leading dot),
// colored by intent. Reused by ProfilePage (player insights) and
// MatchDetailPage (per-match tags) so chip styling lives in exactly one place.
//
// While loading it shows a couple of skeleton chips; when there's nothing to say
// (unavailable / empty) it renders nothing (or a muted em-dash).
import React from "react";
import { Sparkles } from "lucide-react";
import type { AiKind, AiTag } from "@/hooks/queries/ai";

const BRAND_RED = "#e1242e";

// Color per intent. gold uses the ATAK prestige gold.
const KIND_COLOR: Record<AiKind, string> = {
  pos: "#4ade80",
  warn: "#ff5a64",
  gold: "#c8aa6e",
  dim: "#9ca3af",
};

// hex (#rgb / #rrggbb) → "r, g, b" so we can build rgba() with alpha.
function rgb(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const chipStyle = (kind: AiKind): React.CSSProperties => {
  const color = KIND_COLOR[kind] ?? KIND_COLOR.dim;
  const c = rgb(color);
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    lineHeight: 1,
    fontWeight: 600,
    letterSpacing: "0.01em",
    padding: "5px 10px",
    borderRadius: 999,
    color,
    background: `rgba(${c}, 0.08)`,
    border: `1px solid rgba(${c}, 0.35)`,
    whiteSpace: "nowrap",
  };
};

const Dot = ({ kind }: { kind: AiKind }) => (
  <span
    style={{
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: KIND_COLOR[kind] ?? KIND_COLOR.dim,
      flexShrink: 0,
    }}
  />
);

interface AiTagsProps {
  tags?: AiTag[] | null;
  loading?: boolean;
  unavailable?: boolean;
  /** Optional overline (e.g. "ATAK AI") shown with a red sparkle icon. */
  label?: string;
  /** How many skeleton chips to show while loading. */
  skeletonCount?: number;
  /** Render a muted em-dash instead of nothing when there are no tags. */
  showEmptyDash?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function AiTags({
  tags,
  loading = false,
  unavailable = false,
  label,
  skeletonCount = 3,
  showEmptyDash = false,
  className,
  style,
}: AiTagsProps) {
  const list = tags ?? [];
  const hasTags = list.length > 0;

  // Nothing to say and not loading → stay out of the way.
  if (!loading && (unavailable || !hasTags)) {
    if (!showEmptyDash) return null;
    return (
      <div className={className} style={style}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>—</span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <style>{`@keyframes atak-ai-pulse{0%,100%{opacity:.45}50%{opacity:.85}}`}</style>

      {label && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <Sparkles size={12} style={{ color: BRAND_RED }} />
          {label}
        </span>
      )}

      {loading
        ? Array.from({ length: Math.max(1, skeletonCount) }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 62 + (i % 3) * 16,
                height: 24,
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                animation: "atak-ai-pulse 1.3s ease-in-out infinite",
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))
        : list.map((t, i) => (
            <span key={`${t.label}-${i}`} style={chipStyle(t.kind)}>
              <Dot kind={t.kind} />
              {t.label}
            </span>
          ))}
    </div>
  );
}
