const DEFAULT_ACCENT = "#de638a";
const DEFAULT_SOFT = "#fff1f6";
const DEFAULT_SURFACE = "#fff8fb";

export const ADMIN_METRIC_COLORS = {
  primary: { accent: "#de638a", soft: "#fff1f6" },
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

export const ADMIN_METRIC_GRID_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
};

export default function AdminMetricCard({
  title,
  value,
  description,
  icon,
  accentColor = DEFAULT_ACCENT,
  softBackgroundColor = DEFAULT_SOFT,
  backgroundColor = DEFAULT_SURFACE,
  borderColor,
  active = false,
  clickable = false,
  emphasized = false,
  onClick,
}) {
  const interactive = clickable || Boolean(onClick);

  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        background: backgroundColor,
        borderRadius: 18,
        minHeight: 138,
        padding: "16px 18px 18px",
        boxShadow: active
          ? "0 14px 30px rgba(222,99,138,0.18)"
          : "0 8px 22px rgba(15,23,42,0.06)",
        border: `1px solid ${
          active
            ? accentColor
            : borderColor || "rgba(226,232,240,0.95)"
        }`,
        cursor: interactive ? "pointer" : "default",
        transition:
          "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transform: active ? "translateY(-2px)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!interactive) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 14px 30px rgba(222,99,138,0.16)";
        e.currentTarget.style.borderColor = accentColor;
      }}
      onMouseLeave={(e) => {
        if (!interactive) return;
        e.currentTarget.style.transform = active ? "translateY(-2px)" : "none";
        e.currentTarget.style.boxShadow = active
          ? "0 14px 30px rgba(222,99,138,0.18)"
          : "0 8px 22px rgba(15,23,42,0.06)";
        e.currentTarget.style.borderColor = active
          ? accentColor
          : borderColor || "rgba(226,232,240,0.95)";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: emphasized || active ? 4 : 3,
          background: accentColor,
          opacity: emphasized || active ? 1 : 0.92,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: accentColor,
            }}
          >
            {title}
          </p>

          <div
            style={{
              marginTop: 10,
              fontSize: 30,
              lineHeight: 1,
              fontWeight: 800,
              color: "#111827",
              wordBreak: "break-word",
            }}
          >
            {value}
          </div>
        </div>

        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: softBackgroundColor,
            border: `1px solid ${accentColor}22`,
            color: accentColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: `inset 0 1px 0 ${accentColor}12`,
          }}
        >
          {icon}
        </div>
      </div>

      <p
        style={{
          margin: "14px 0 0",
          fontSize: 12,
          lineHeight: 1.45,
          color: "#6b7280",
          minHeight: 34,
        }}
      >
        {description}
      </p>
    </div>
  );
}
