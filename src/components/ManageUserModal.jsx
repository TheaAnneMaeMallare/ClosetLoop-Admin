// src/components/ManageUserModal.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

const PRIMARY = "#de638a";

function formatDate(value) {
  if (!value) return "—";
  try {
    let d;
    if (typeof value === "object" && value.seconds) {
      d = new Date(value.seconds * 1000);
    } else if (typeof value === "number") {
      d = new Date(value);
    } else {
      d = new Date(value);
    }
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function ManageUserModal({ user, onClose }) {
  const navigate = useNavigate();

  const fullName =
    user.displayName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    "Unnamed user";

  const username = user.username || user.handle || null;
  const email = user.email || "—";
  const joined = formatDate(user.createdAt);
  const birthday = user.birthday ? formatDate(user.birthday) : "—";

  const location = user.location || {};
  const barangay = location.barangay || location.brgy || null;
  const municipality = location.municipality || location.city || null;
  const region = location.region || location.province || null;

  const statusLabel = user.disabled ? "Disabled" : "Active";
  const statusColorBg = user.disabled ? "#fee2e2" : "#dcfce7";
  const statusColorText = user.disabled ? "#b91c1c" : "#166534";

  const itemsCount = user.itemsCount || 0;
  const ownerUid = user.uid || user.id || null;

  const extraFields = useMemo(() => {
    const labelMap = {
      phone: "Phone number",
      contactNumber: "Contact number",
      school: "School",
      course: "Course",
      yearLevel: "Year level",
      interests: "Interests",
    };

    const shownKeys = new Set([
      "displayName",
      "firstName",
      "lastName",
      "username",
      "email",
      "birthday",
      "location",
      "createdAt",
      "disabled",
    ]);

    const entries = [];

    Object.keys(labelMap).forEach((key) => {
      if (user[key] == null || shownKeys.has(key)) return;

      let value = user[key];
      if (Array.isArray(value)) value = value.join(", ");

      entries.push({
        label: labelMap[key],
        value,
      });
    });

    return entries;
  }, [user]);

  const handleViewItems = () => {
    if (!ownerUid) return;
    navigate(`/posts?ownerUid=${ownerUid}`);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: "20px 22px 18px",
          width: 460,
          maxWidth: "100%",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            User Profile
          </h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 18,
              cursor: "pointer",
              color: "#9ca3af",
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            margin: 0,
            marginBottom: 12,
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          Read-only view of this user’s account information and signup details.
        </p>

        {/* top profile row */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              overflow: "hidden",
              border: `2px solid ${PRIMARY}`,
              flexShrink: 0,
              background: "#fff0f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              color: PRIMARY,
              fontWeight: 600,
            }}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              (fullName || "?").charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {fullName}
              </span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  background: statusColorBg,
                  color: statusColorText,
                  fontWeight: 600,
                }}
              >
                {statusLabel}
              </span>
            </div>

            {username && (
              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 2,
                }}
              >
                @{username}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#4b5563" }}>{email}</div>
          </div>
        </div>

        {/* small stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {/* Joined */}
          <div
            style={{
              padding: 8,
              borderRadius: 10,
              background: "#f9fafb",
              fontSize: 11,
              color: "#4b5563",
            }}
          >
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Joined</div>
            <div style={{ fontWeight: 600 }}>{joined}</div>
          </div>

          {/* Listed items - clickable to Posts */}
          <div
            onClick={handleViewItems}
            style={{
              padding: 8,
              borderRadius: 10,
              background: "#f9fafb",
              fontSize: 11,
              color: "#4b5563",
              cursor: ownerUid ? "pointer" : "default",
              border: ownerUid ? "1px solid #e5e7eb" : "1px solid transparent",
            }}
            title={ownerUid ? "View this user's posts" : ""}
          >
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              Listed items
            </div>
            <div style={{ fontWeight: 600 }}>{itemsCount}</div>
            {ownerUid && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 10,
                  color: "#de638a",
                }}
              >
                View posts →
              </div>
            )}
          </div>

          {/* Reports (placeholder / future) */}
          <div
            style={{
              padding: 8,
              borderRadius: 10,
              background: "#f9fafb",
              fontSize: 11,
              color: "#4b5563",
            }}
          >
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Reports</div>
            <div style={{ fontWeight: 600 }}>{user.reportsCount || 0}</div>
          </div>
        </div>

        {/* sections */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
            gap: 10,
            marginBottom: 10,
          }}
        >
          {/* left col: identity */}
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: "#f9fafb",
              fontSize: 12,
              color: "#4b5563",
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#9ca3af",
                marginBottom: 4,
              }}
            >
              Identity
            </div>
            <div style={{ marginBottom: 3 }}>
              <strong>First name:</strong> {user.firstName || "—"}
            </div>
            <div style={{ marginBottom: 3 }}>
              <strong>Last name:</strong> {user.lastName || "—"}
            </div>
            <div style={{ marginBottom: 3 }}>
              <strong>Birthday:</strong> {birthday}
            </div>
            <div style={{ marginBottom: 3 }}>
              <strong>UID:</strong> {user.uid || user.id}
            </div>
          </div>

          {/* right col: location */}
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: "#f9fafb",
              fontSize: 12,
              color: "#4b5563",
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#9ca3af",
                marginBottom: 4,
              }}
            >
              Location
            </div>
            <div style={{ marginBottom: 3 }}>
              <strong>Barangay:</strong> {barangay || "—"}
            </div>
            <div style={{ marginBottom: 3 }}>
              <strong>Municipality / City:</strong>{" "}
              {municipality || "—"}
            </div>
            <div style={{ marginBottom: 3 }}>
              <strong>Region / Area:</strong> {region || "—"}
            </div>
          </div>
        </div>

        {/* extra fields */}
        {extraFields.length > 0 && (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: "#f9fafb",
              fontSize: 12,
              color: "#4b5563",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#9ca3af",
                marginBottom: 4,
              }}
            >
              Additional info
            </div>
            {extraFields.map((field) => (
              <div key={field.label} style={{ marginBottom: 2 }}>
                <strong>{field.label}:</strong>{" "}
                {field.value || "—"}
              </div>
            ))}
          </div>
        )}

        {/* footer button */}
        <div
          style={{
            marginTop: 6,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 18px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 12,
              cursor: "pointer",
              color: "#374151",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
