// src/components/Topbar.jsx
import { useNavigate } from "react-router-dom";

export default function Topbar() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        backgroundColor: "#fff",
        height: "65px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "14px",
        padding: "0 24px",
        position: "fixed",
        top: 0,
        left: "220px",
        right: 0,
        borderBottom: "4px solid #de638a",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => navigate("/admin/dashboard")}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            fontSize: 20,
            fontWeight: 800,
            color: "#c94f77",
            lineHeight: 1,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Admin Dashboard
        </button>
      </div>
    </div>
  );
}
