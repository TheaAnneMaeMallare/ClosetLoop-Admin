// src/pages/Settings.jsx
import { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
  FaInfoCircle,
  FaSignOutAlt,
  FaUserShield,
  FaServer,
  FaDatabase,
  FaCheckCircle,
} from "react-icons/fa";
import { signOut } from "firebase/auth";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { clearAdminSession } from "../utils/adminSession";

const PRIMARY = "#de638a";

const Button = ({ children, style, ...props }) => (
  <button
    {...props}
    style={{
      padding: "8px 14px",
      fontSize: 12,
      borderRadius: 10,
      border: "1px solid #ddd",
      background: "#fff",
      cursor: props.disabled ? "default" : "pointer",
      opacity: props.disabled ? 0.65 : 1,
      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      transition: "all 0.2s ease",
      ...style,
    }}
  >
    {children}
  </button>
);

function InfoRow({ label, value, subtle = false }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: subtle ? "#fafafa" : "#fcfcfd",
        border: "1px solid #f1f5f9",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "#6b7280",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "5px 0 0",
          fontSize: 13,
          color: "#374151",
          fontWeight: 500,
          wordBreak: "break-word",
          lineHeight: 1.45,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function StatusPill({ icon, label, value }) {
  return (
    <div
      style={{
        border: "1px solid #f1f5f9",
        background: "#fcfcfd",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "#fff0f6",
          color: PRIMARY,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "#374151",
            fontWeight: 500,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export default function Settings() {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [lastUpdatedText, setLastUpdatedText] = useState("Not available");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const ref = doc(db, "config", "global");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();

          if (data.updatedAt) {
            let parsedDate = null;

            if (typeof data.updatedAt?.toDate === "function") {
              parsedDate = data.updatedAt.toDate();
            } else {
              parsedDate = new Date(data.updatedAt);
            }

            if (parsedDate && !isNaN(parsedDate.getTime())) {
              setLastUpdatedText(
                parsedDate.toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              );
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load system information");
      } finally {
        setLoadingConfig(false);
      }
    };

    loadConfig();
  }, []);

  const handleConfirmLogout = async () => {
    try {
      clearAdminSession();
      await signOut(auth);
      toast.info("You have been logged out.", { autoClose: 1200 });
      setShowLogoutModal(false);

      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (err) {
      console.error(err);
      toast.error("Failed to log out. Please try again.");
    }
  };

  const currentUser = auth.currentUser;

  const pageBg = {
    minHeight: "100vh",
    background: "#f5f6fa",
    padding: "20px 24px 32px",
    display: "flex",
    justifyContent: "center",
  };

  const mainCol = {
    width: "100%",
    maxWidth: 1120,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const card = {
    background: "#fff",
    borderRadius: 16,
    padding: "16px 18px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
  };

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  };

  const modalStyle = {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: "20px 22px",
    width: "100%",
    maxWidth: 360,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  };

  return (
    <div style={pageBg}>
      <ToastContainer />
      <div style={mainCol}>
        {/* HEADER */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "16px 20px 14px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
            <span style={{ color: PRIMARY, fontWeight: 600 }}>ClosetLoop</span>{" "}
            Admin Dashboard
          </p>

          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: "4px 0 4px",
              color: "#111827",
            }}
          >
            Settings
          </h1>

          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Review administrator information, system status, and platform
            details.
          </p>

          <div
            style={{
              marginTop: 10,
              height: 2,
              borderRadius: 999,
              background:
                "linear-gradient(90deg,rgba(222,99,138,0.6),rgba(198,226,198,0.7),transparent)",
            }}
          />
        </div>

        {/* ADMIN PROFILE + SYSTEM STATUS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {/* ADMIN PROFILE */}
          <div style={card}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <FaUserShield style={{ color: PRIMARY, fontSize: 14 }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Admin Profile
              </h2>
            </div>

            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 0 }}>
              Basic information about the currently signed-in administrator.
            </p>

            <div
              style={{
                display: "grid",
                gap: 10,
                marginTop: 12,
              }}
            >
              <InfoRow
                label="Name"
                value={currentUser?.displayName || "Admin User"}
              />
              <InfoRow
                label="Email"
                value={currentUser?.email || "admin@example.com"}
                subtle
              />
              <InfoRow label="Role" value="Admin Dashboard" />
              {currentUser?.uid && (
                <InfoRow label="UID" value={currentUser.uid} subtle />
              )}
            </div>

            <p
              style={{
                marginTop: 12,
                fontSize: 11,
                color: "#9ca3af",
                lineHeight: 1.5,
              }}
            >
              Authentication and password management are handled through Firebase
              Authentication.
            </p>
          </div>

          {/* SYSTEM STATUS */}
          <div style={card}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <FaServer style={{ color: PRIMARY, fontSize: 14 }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                System Status
              </h2>
            </div>

            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 0 }}>
              Read-only overview of the current admin session and platform
              status.
            </p>

            <div
              style={{
                display: "grid",
                gap: 12,
                marginTop: 12,
              }}
            >
              <StatusPill
                icon={<FaCheckCircle size={14} />}
                label="Session Status"
                value={currentUser ? "Active" : "No active session"}
              />

              <StatusPill
                icon={<FaDatabase size={14} />}
                label="Database"
                value="Cloud Firestore Connected"
              />

              <StatusPill
                icon={<FaServer size={14} />}
                label="Configuration Source"
                value="config/global"
              />
            </div>

            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#fafafa",
                border: "1px solid #f1f5f9",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Last Configuration Update
              </p>
              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: 13,
                  color: "#374151",
                  fontWeight: 500,
                }}
              >
                {loadingConfig ? "Loading..." : lastUpdatedText}
              </p>
            </div>
          </div>
        </div>

        {/* ABOUT SYSTEM */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <FaInfoCircle style={{ color: PRIMARY }} />
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: "#111827",
              }}
            >
              About This System
            </h2>
          </div>

          <p
            style={{
              fontSize: 13,
              color: "#4b5563",
              marginTop: 0,
              marginBottom: 12,
              lineHeight: 1.6,
            }}
          >
            <strong>ClosetLoop</strong> is a platform for clothing upcycling,
            swapping, and community exchange. This page allows administrators to
            review account details, current system status, and platform
            information in one place.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <InfoRow label="Capstone Version" value="v1.0.0 (Demo build)" />
            <InfoRow label="Firebase Project" value="closetloopapp" subtle />
            <InfoRow label="Configuration Source" value="config/global" />
          </div>

          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background:
                "linear-gradient(135deg,rgba(222,99,138,0.05),rgba(198,226,198,0.12))",
              border: "1px solid #f5e4eb",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#4b5563",
                lineHeight: 1.6,
              }}
            >
              <strong>Developers:</strong> Mallare, Thea Anne Mae E., Manalo,
              Nasha R., and Villanueva, Kaye Adriele S.
            </p>
          </div>
        </div>

        {/* LOGOUT */}
        <div
          style={{
            marginTop: 4,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Button
            onClick={() => setShowLogoutModal(true)}
            style={{
              background: "#fff0f6",
              borderColor: PRIMARY,
              color: PRIMARY,
              fontWeight: 600,
              padding: "9px 18px",
            }}
          >
            <FaSignOutAlt /> Logout
          </Button>
        </div>
      </div>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3
              style={{
                margin: 0,
                marginBottom: 8,
                color: PRIMARY,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              Confirm Logout
            </h3>

            <p
              style={{
                fontSize: 13,
                color: "#4b5563",
                marginBottom: 4,
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to logout?
            </p>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <Button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  background: "#f3f4f6",
                  borderColor: "#d1d5db",
                  color: "#374151",
                }}
              >
                No
              </Button>

              <Button
                onClick={handleConfirmLogout}
                style={{
                  background: PRIMARY,
                  borderColor: PRIMARY,
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

