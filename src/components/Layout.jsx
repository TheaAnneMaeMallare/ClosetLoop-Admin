import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children }) {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#f5f6fa",
      }}
    >
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* MAIN COLUMN */}
      <div
        style={{
          flex: 1,
          marginLeft: 220,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* FIXED TOPBAR */}
        <div
          style={{
            height: 65,
            position: "fixed",
            top: 0,
            left: 220,
            right: 0,
            zIndex: 1000,
            background: "#ffffff",
          }}
        >
          <Topbar />
        </div>

        {/* SCROLLABLE CONTENT */}
        <div
          style={{
            marginTop: 65,
            height: "calc(100vh - 65px)",
            overflowY: "auto",
            padding: "24px 24px 32px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Inner content wrapper */}
          <div
            style={{
              width: "100%",
              maxWidth: 1240,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              alignSelf: "center",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
