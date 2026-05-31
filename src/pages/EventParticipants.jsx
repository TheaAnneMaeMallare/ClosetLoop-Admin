import { useEffect, useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import AdminTablePagination from "../components/AdminTablePagination";
import {
  ADMIN_TABLE_CARD_STYLE,
  ADMIN_TABLE_CELL_STRONG_STYLE,
  ADMIN_TABLE_CELL_STYLE,
  ADMIN_TABLE_HEADER_STYLE,
  ADMIN_TABLE_HEAD_CELL_STYLE,
  ADMIN_TABLE_STYLE,
} from "../components/adminTableStyles";

const PRIMARY = "#de638a";

function toJsDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  if (typeof value === "string" || value instanceof Date) return new Date(value);
  return null;
}

function formatEventDate(value) {
  const date = toJsDate(value);
  if (!date || Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJoinedDate(value) {
  const date = toJsDate(value);
  if (!date || Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function EventParticipants() {
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const query = new URLSearchParams(useLocation().search);
  const eventId = query.get("id");
  const navigate = useNavigate();

  useEffect(() => {
    loadAll();
  }, [eventId]);

  const loadAll = async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const eventRef = doc(db, "events", eventId);
    const snap = await getDoc(eventRef);

    if (snap.exists()) {
      setEvent({ id: snap.id, ...snap.data() });
    } else {
      setEvent(null);
      setParticipants([]);
      setLoading(false);
      return;
    }

    const sub = await getDocs(collection(db, "events", eventId, "interestedUsers"));
    const arr = [];

    for (const u of sub.docs) {
      const uid = u.id;
      const joinedAt = u.data()?.joinedAt || null;
      const userSnap = await getDoc(doc(db, "users", uid));

      if (userSnap.exists()) {
        const data = userSnap.data();
        const first = data.firstName || "";
        const last = data.lastName || "";
        const fullName =
          (first && last && `${first} ${last}`) ||
          first ||
          last ||
          data.username ||
          "Unknown";

        const messengerRaw = data.messengerUsername || "";
        const messengerLink = messengerRaw
          ? messengerRaw.startsWith("http")
            ? messengerRaw
            : `https://m.me/${messengerRaw}`
          : null;

        arr.push({
          id: uid,
          fullName,
          username: data.username || "",
          messengerUsername: messengerRaw,
          messengerLink,
          email: data.email || "-",
          joinedAt,
        });
      }
    }

    setParticipants(arr);
    setCurrentPage(1);
    setLoading(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [participants.length, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(participants.length / rowsPerPage));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * rowsPerPage;
  const paginated = participants.slice(start, start + rowsPerPage);

  const th = {
    ...ADMIN_TABLE_HEAD_CELL_STYLE,
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const td = {
    ...ADMIN_TABLE_CELL_STYLE,
    fontSize: 13,
    color: "#444",
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f6fa",
          padding: "20px 24px 32px",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            padding: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>
            Loading event information...
          </h2>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f6fa",
          padding: "20px 24px 32px",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            padding: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>
            Event not found.
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6fa",
        padding: "20px 24px 32px",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "14px 18px 12px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/admin/events")}
            style={{
              background: "transparent",
              border: "none",
              color: PRIMARY,
              fontSize: 13,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              cursor: "pointer",
              padding: 0,
              marginBottom: 10,
            }}
          >
            <FaArrowLeft style={{ marginRight: 6 }} />
            Back to Events
          </button>

          <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
            <span style={{ color: PRIMARY, fontWeight: 600 }}>ClosetLoop</span>{" "}
            Admin Dashboard
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "#fdf2f7",
                  color: PRIMARY,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Participants
              </div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  margin: "7px 0 4px",
                  color: "#111827",
                }}
              >
                Participants for {event.title || "Untitled Event"}
              </h1>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                Review the interested users list for this event.
              </p>
            </div>
          </div>

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

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            padding: "14px 16px",
            display: "grid",
            gridTemplateColumns: "120px minmax(0, 1fr)",
            gap: 14,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              minHeight: 108,
              background: "#f3f4f6",
              border: "1px solid #eef1f4",
            }}
          >
            {event.imageUrl ? (
              <img
                src={event.imageUrl}
                alt={event.title || "event"}
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: 108,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  minHeight: 108,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                  fontWeight: 700,
                  background: "#f3f4f6",
                  fontSize: 11,
                }}
              >
                No image
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  margin: 0,
                  color: "#111827",
                  lineHeight: 1.25,
                }}
              >
                {event.title || "Untitled Event"}
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              <div
                style={{
                  border: "1px solid #eef1f4",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#9ca3af",
                    marginBottom: 6,
                  }}
                >
                  Location
                </div>
                <div style={{ fontSize: 12, color: "#111827", lineHeight: 1.4 }}>
                  {event.location || "-"}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #eef1f4",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#9ca3af",
                    marginBottom: 6,
                  }}
                >
                  Schedule
                </div>
                <div style={{ fontSize: 12, color: "#111827", lineHeight: 1.4 }}>
                  {formatEventDate(event.date)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...ADMIN_TABLE_CARD_STYLE,
          }}
        >
          <div
            style={{
              ...ADMIN_TABLE_HEADER_STYLE,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                  color: "#111827",
                }}
              >
                Participants
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                {participants.length} interested user{participants.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                ...ADMIN_TABLE_STYLE,
                minWidth: 760,
              }}
            >
              <thead>
                <tr style={{ background: "#f9edf5" }}>
                  <th style={th}>Name</th>
                  <th style={th}>Messenger</th>
                  <th style={th}>Email</th>
                  <th style={th}>Joined At</th>
                </tr>
              </thead>

              <tbody>
                {participants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: 18,
                        textAlign: "center",
                        fontSize: 13,
                        color: "#6b7280",
                      }}
                    >
                      No participants yet.
                    </td>
                  </tr>
                ) : (
                  paginated.map((p, i) => (
                    <tr
                      key={p.id}
                      style={{
                        background: i % 2 ? "#ffffff" : "#fafafa",
                      }}
                    >
                      <td style={ADMIN_TABLE_CELL_STRONG_STYLE}>
                        <div style={{ lineHeight: 1.3 }}>
                          <div style={{ color: "#111827", fontWeight: 700 }}>
                            {p.fullName}
                          </div>
                          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
                            {p.username ? `@${p.username}` : "-"}
                          </div>
                        </div>
                      </td>

                      <td style={td}>
                        {p.messengerUsername ? (
                          <a
                            href={p.messengerLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: PRIMARY,
                              fontWeight: 700,
                              textDecoration: "none",
                            }}
                          >
                            {p.messengerUsername}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td style={td}>{p.email}</td>

                      <td style={td}>{formatJoinedDate(p.joinedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <AdminTablePagination
            totalItems={participants.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
            noun="participants"
          />
        </div>
      </div>
    </div>
  );
}
