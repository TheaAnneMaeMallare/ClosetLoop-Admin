const DEFAULT_ACCENT = "#de638a";
const DEFAULT_SOFT = "#fdf2f7";

export const ADMIN_STAT_CARD_COLORS = {
  primary: { accent: "#de638a", soft: "#fdf2f7" },
  pending: { accent: "#d99b1f", soft: "#fff7e8" },
  verified: { accent: "#5ea778", soft: "#eef9f1" },
  dismissed: { accent: "#c65b7c", soft: "#fff1f5" },
  warned: { accent: "#9b6bd3", soft: "#f6f1ff" },
  tradeLimited: { accent: "#9f274d", soft: "#fdecef" },
  reportLimited: { accent: "#c65b7c", soft: "#fff1f5" },
  suspended: { accent: "#6b7280", soft: "#f3f4f6" },
  banned: { accent: "#111827", soft: "#edf1f7" },
  info: { accent: "#3b82f6", soft: "#eff6ff" },
  leaf: { accent: "#5ca36f", soft: "#eef9f1" },
};

export const ADMIN_STAT_GRID_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

export function AdminStatGrid({
  children,
  minColumnWidth = 180,
  gap = 12,
  style,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function AdminStatCard({
  title,
  value,
  description,
  icon,
  accentColor = DEFAULT_ACCENT,
  softBackgroundColor = DEFAULT_SOFT,
  active = false,
  onClick,
  style,
}) {
  const interactive = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "12px 14px",
        boxShadow: active
          ? "0 10px 24px rgba(222,99,138,0.16)"
          : "0 6px 18px rgba(0,0,0,0.05)",
        border: active ? `1px solid ${accentColor}` : "1px solid #eef1f4",
        position: "relative",
        overflow: "hidden",
        minHeight: 84,
        cursor: interactive ? "pointer" : "default",
        transform: active ? "translateY(-1px)" : "none",
        transition: "0.18s ease",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 3,
          background: accentColor,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: accentColor,
            background: softBackgroundColor,
            borderRadius: 999,
            padding: "3px 8px",
          }}
        >
          {title}
        </span>

        {icon && (
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: accentColor,
              background: softBackgroundColor,
              border: `1px solid ${accentColor}22`,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          lineHeight: 1.05,
          fontWeight: 800,
          color: "#111827",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "#6b7280",
          lineHeight: 1.4,
        }}
      >
        {description}
      </div>
    </div>
  );
}
