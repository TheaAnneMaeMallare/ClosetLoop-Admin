// src/components/Sidebar.jsx
import { Link, useLocation } from "react-router-dom";
import {
  FaHome,
  FaUsers,
  FaTshirt,
  FaCog,
  FaCalendarAlt,
  FaLightbulb,
  FaExchangeAlt,
  FaChartBar,
} from "react-icons/fa";

export default function Sidebar() {
  const location = useLocation();

  const isActive = (path) => {
    const { pathname } = location;

    if (path === "/admin/reports") {
      return pathname === "/admin/reports" || pathname.startsWith("/admin/reports/");
    }

    if (path === "/admin/users") {
      return pathname === "/admin/users" || pathname.startsWith("/admin/users/");
    }

    if (path === "/admin/events") {
      return (
        pathname === "/admin/events" ||
        pathname.startsWith("/admin/EventParticipants")
      );
    }

    return pathname === path;
  };

  const linkBase = {
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: "500",
    padding: "10px 15px",
    borderRadius: "8px",
    marginBottom: "10px",
    transition: "0.25s ease",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  };

  const links = [
    { path: "/admin/dashboard", label: "Dashboard", icon: <FaHome size={18} /> },
    { path: "/admin/users", label: "Users", icon: <FaUsers size={18} /> },
    { path: "/admin/posts", label: "Items", icon: <FaTshirt size={18} /> },
    { path: "/admin/transactions", label: "Transactions", icon: <FaExchangeAlt size={18} /> },
    { path: "/admin/diy-posts", label: "DIY Posts", icon: <FaLightbulb size={18} /> },
    { path: "/admin/events", label: "Events", icon: <FaCalendarAlt size={18} /> },
    { path: "/admin/reports", label: "Reports", icon: <FaChartBar size={18} /> },
    { path: "/admin/settings", label: "Settings", icon: <FaCog size={18} /> },
  ];

  return (
    <div
      style={{
        width: "220px",
        height: "100vh",
        background: "linear-gradient(180deg, #e8f5e9 0%, #fff0f6 100%)",
        borderRight: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "2px 0 10px rgba(0,0,0,0.05)",
        color: "#333",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          height: "65px",
          display: "flex",
          alignItems: "center",
          paddingLeft: "25px",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <h2
          style={{
            color: "#de638a",
            fontWeight: "700",
            letterSpacing: "0.5px",
            fontSize: "18px",
            margin: 0,
          }}
        >
          ClosetLoop
        </h2>
      </div>

      <div style={{ padding: "25px" }}>
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            style={{
              ...linkBase,
              background: isActive(link.path)
                ? "rgba(222, 99, 138, 0.18)"
                : "transparent",
              color: isActive(link.path) ? "#de638a" : "#333",
              borderLeft: isActive(link.path)
                ? "4px solid #de638a"
                : "4px solid transparent",
            }}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}