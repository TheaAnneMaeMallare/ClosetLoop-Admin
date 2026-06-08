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
        padding: "0 25px",
        position: "fixed",
        top: 0,
        left: "220px",
        right: 0,
        borderBottom: "4px solid #de638a",
        zIndex: 10,
      }}
    >
      <div style={{ height: "65px", display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => navigate("/admin/dashboard")}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.5px",
            color: "#de638a",
            lineHeight: "normal",
            cursor: "pointer",
            whiteSpace: "nowrap",
            textShadow: "none",
            boxShadow: "none",
            outline: "none",
          }}
        >
          Admin Dashboard
        </button>
      </div>
    </div>
  );
}
