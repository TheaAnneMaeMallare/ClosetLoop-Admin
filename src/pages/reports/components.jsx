import React from "react";

export function Button({ children, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "7px 12px",
        fontSize: 11.5,
        borderRadius: 999,
        border: "1px solid #d1d5db",
        background: "#fff",
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        fontWeight: 700,
        minHeight: 32,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function DetailRow({ label, value }) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #eef1f4",
        borderRadius: 10,
        padding: "8px 10px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 9,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 11.5,
          color: "#111827",
          fontWeight: 600,
          wordBreak: "break-word",
          lineHeight: 1.35,
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function ActionButton({
  label,
  bg,
  color,
  borderColor,
  onClick,
  disabled,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "7px 11px",
        borderRadius: 999,
        border: `1px solid ${borderColor || "transparent"}`,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
        minHeight: 32,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {label}
    </button>
  );
}
