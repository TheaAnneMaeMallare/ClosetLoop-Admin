// src/pages/Events.jsx
import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase/firebaseConfig";
import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  FaArrowLeft,
  FaSave,
  FaPlus,
  FaSearch,
  FaFilter,
  FaCalendarAlt,
  FaSeedling,
  FaHistory,
  FaTimes,
  FaImage,
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
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

// --- Cloudinary config ---
const CLOUDINARY_UPLOAD_PRESET = "Events";
const CLOUDINARY_CLOUD_NAME = "ds63bguzo";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// ---------- Shared UI ----------
const Button = ({ children, style, ...props }) => (
  <button
    {...props}
    style={{
      padding: "6px 12px",
      fontSize: 12,
      borderRadius: 8,
      border: "1px solid #ddd",
      background: "#fff",
      cursor: props.disabled ? "default" : "pointer",
      opacity: props.disabled ? 0.6 : 1,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      fontWeight: 600,
      ...style,
    }}
  >
    {children}
  </button>
);

const CompactStatCard = ({
  label,
  value,
  subtext,
  accent = PRIMARY,
  softBg = "#fdf2f7",
}) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 14,
      padding: "12px 14px",
      boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
      border: "1px solid #eef1f4",
      position: "relative",
      overflow: "hidden",
      minHeight: 84,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: 3,
        background: accent,
      }}
    />
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: accent,
        background: softBg,
        borderRadius: 999,
        padding: "3px 8px",
      }}
    >
      {label}
    </span>

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
      }}
    >
      {subtext}
    </div>
  </div>
);

const StatusBadge = ({ upcoming }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "5px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      border: upcoming
        ? "1px solid rgba(198,226,198,0.9)"
        : "1px solid #e5e7eb",
      background: upcoming ? "rgba(198,226,198,0.28)" : "#f3f4f6",
      color: upcoming ? "#2f6b4f" : "#374151",
      whiteSpace: "nowrap",
    }}
  >
    {upcoming ? "Upcoming" : "Past"}
  </span>
);

const EmptyState = ({ onClear }) => (
  <div
    style={{
      padding: "36px 20px",
      textAlign: "center",
      color: "#6b7280",
    }}
  >
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "#fdf2f7",
        color: PRIMARY,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        margin: "0 auto 12px",
      }}
    >
      <FaCalendarAlt />
    </div>
    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>
      No events found
    </p>
    <p style={{ margin: "4px 0 12px", fontSize: 12 }}>
      Try changing the search or filter settings.
    </p>
    <Button
      type="button"
      onClick={onClear}
      style={{
        background: "#fff",
        color: PRIMARY,
        borderColor: "#f3c8d6",
      }}
    >
      <FaTimes />
      Clear filters
    </Button>
  </div>
);

const ActionPillButton = ({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  style,
  ...props
}) => {
  const variants = {
    primary: {
      background: PRIMARY,
      color: "#fff",
      border: `1px solid ${PRIMARY}`,
      boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
    },
    secondary: {
      background: "#fff",
      color: PRIMARY,
      border: "1px solid #f3c8d6",
      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    },
    warm: {
      background: "#fff7e8",
      color: "#d99b1f",
      border: "1px solid #f4dfab",
      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    },
    danger: {
      background: "#fdecef",
      color: "#c65b7c",
      border: "1px solid #f7c8d4",
      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    },
    neutral: {
      background: "#fff",
      color: "#374151",
      border: "1px solid #d1d5db",
      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        cursor: disabled ? "default" : "pointer",
        fontSize: 11,
        fontWeight: 700,
        minWidth: 72,
        opacity: disabled ? 0.6 : 1,
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};

const DetailField = ({ label, value, tone = "#111827" }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 14,
      border: "1px solid #eef1f4",
      padding: "12px 14px",
      minHeight: 72,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "#9ca3af",
        marginBottom: 8,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.5,
        color: tone,
        wordBreak: "break-word",
      }}
    >
      {value}
    </div>
  </div>
);

const ModalShell = ({ children, onClose }) => (
  <div
    role="dialog"
    aria-modal="true"
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(17,24,39,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      zIndex: 1000,
    }}
    onClick={onClose}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 860,
        maxHeight: "90vh",
        overflowY: "auto",
        background: "#f9fafb",
        borderRadius: 20,
        boxShadow: "0 24px 48px rgba(17,24,39,0.2)",
        border: "1px solid rgba(255,255,255,0.7)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

// ------------------------------------------------------------------

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [image, setImage] = useState(null);
  const [currentImage, setCurrentImage] = useState("");
  const [editId, setEditId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalMode, setModalMode] = useState(null);

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "events"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEvents(data);
    });

    return () => unsub();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setDateTime("");
    setImage(null);
    setCurrentImage("");
    setEditId(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setLocationFilter("all");
    setSortOrder("newest");
    setCurrentPage(1);
  };

  const isModalOpen = modalMode !== null;

  const toJsDate = (raw) => {
    if (!raw) return null;
    if (raw?.toDate) return raw.toDate();
    if (raw?.seconds) return new Date(raw.seconds * 1000);
    if (typeof raw === "string" || raw instanceof Date) return new Date(raw);
    return null;
  };

  const formatDateTime = (raw) => {
    const d = toJsDate(raw);
    if (!d || Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isUpcoming = (raw) => {
    const d = toJsDate(raw);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compare = new Date(d);
    compare.setHours(0, 0, 0, 0);
    return compare >= today;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !description || !location || !dateTime) {
      toast.error("Please fill in all fields.", { autoClose: 2500 });
      return;
    }

    setLoading(true);

    try {
      let imageUrl = currentImage;

      if (image) {
        const formData = new FormData();
        formData.append("file", image);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(CLOUDINARY_URL, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Failed to upload image to Cloudinary");
        }

        const data = await res.json();
        imageUrl = data.secure_url;
      }

      const eventPayload = {
        title,
        description,
        location,
        date: new Date(dateTime),
        imageUrl: imageUrl || "",
        createdBy: auth.currentUser?.uid || "admin_user",
      };

      if (editId) {
        await updateDoc(doc(db, "events", editId), {
          ...eventPayload,
          updatedAt: serverTimestamp(),
        });
        toast.success("Event updated!");
      } else {
        await addDoc(collection(db, "events"), {
          ...eventPayload,
          createdAt: serverTimestamp(),
        });
        toast.success("Event created!");
      }

      resetForm();
      setSelectedEvent(null);
      setModalMode(null);
    } catch (err) {
      console.error(err);
      toast.error("Error saving event");
    }

    setLoading(false);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedEvent(null);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setSelectedEvent(null);
    setModalMode("create");
  };

  const openViewModal = (event) => {
    setSelectedEvent(event);
    setModalMode("view");
  };

  const handleEdit = (event) => {
    setEditId(event.id);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setLocation(event.location || "");
    const d = toJsDate(event.date);
    setDateTime(
      d
        ? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : ""
    );
    setImage(null);
    setCurrentImage(event.imageUrl || "");
    setSelectedEvent(event);
    setModalMode("edit");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) {
      return false;
    }
    try {
      await deleteDoc(doc(db, "events", id));
      toast.success("Event deleted!");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete event");
      return false;
    }
  };

  const totalEvents = events.length;
  const upcomingCount = events.filter((e) => isUpcoming(e.date)).length;
  const pastCount = totalEvents - upcomingCount;

  const locations = Array.from(
    new Set(events.map((e) => e.location).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = [...events];

    if (statusFilter !== "all") {
      list = list.filter((e) =>
        statusFilter === "upcoming" ? isUpcoming(e.date) : !isUpcoming(e.date)
      );
    }

    if (locationFilter !== "all") {
      list = list.filter(
        (e) => (e.location || "").toLowerCase() === locationFilter.toLowerCase()
      );
    }

    if (q) {
      list = list.filter(
        (e) =>
          (e.title || "").toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q) ||
          (e.location || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const da = toJsDate(a.date)?.getTime() || 0;
      const db = toJsDate(b.date)?.getTime() || 0;
      return sortOrder === "newest" ? db - da : da - db;
    });

    return list;
  }, [events, searchTerm, statusFilter, locationFilter, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, locationFilter, sortOrder, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / rowsPerPage));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * rowsPerPage;
  const paginatedEvents = filteredEvents.slice(start, start + rowsPerPage);

  const inputBase = {
    width: "100%",
    minHeight: 52,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    fontSize: 13,
    outline: "none",
    background: "#fff",
    boxSizing: "border-box",
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
    color: "#111827",
  };

  const compactFilterControlStyle = {
    width: "100%",
    minHeight: 42,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    fontSize: 13,
    outline: "none",
    background: "#fff",
    boxSizing: "border-box",
    color: "#374151",
    boxShadow: "none",
  };

  const thStyle = {
    ...ADMIN_TABLE_HEAD_CELL_STYLE,
    padding: "14px 16px",
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const tdStyle = {
    ...ADMIN_TABLE_CELL_STYLE,
    padding: "14px 16px",
    lineHeight: 1.4,
  };

  const tdStyleStrong = {
    ...ADMIN_TABLE_CELL_STRONG_STYLE,
    padding: "14px 16px",
    lineHeight: 1.4,
  };

  const imageBox = {
    width: 76,
    height: 76,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
    fontWeight: 700,
    border: "1px solid #eef1f4",
  };

  const imageFill = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const modalTitle =
    modalMode === "create"
      ? "Create Event"
      : modalMode === "edit"
      ? "Edit Event"
      : "Event Details";

  const modalSubtitle =
    modalMode === "create"
      ? "Add a new community event with full schedule and banner details."
      : modalMode === "edit"
      ? "Update event details without leaving the dashboard."
      : "Review the full event summary and manage next actions.";

  const renderEventForm = () => (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
        gap: 14,
      }}
    >
      <div>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputBase}
          placeholder="EcoSwap Community Fair"
        />
      </div>

      <div>
        <label style={labelStyle}>Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={inputBase}
          placeholder="UP Diliman, Quezon City"
        />
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>Date & Time</label>
        <input
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          style={inputBase}
        />
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          style={{ ...inputBase, resize: "vertical", minHeight: 120 }}
          placeholder="Add the full event overview, what attendees should expect, and key reminders."
        />
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>Banner Image</label>
        <div
          style={{
            border: "1px dashed #d1d5db",
            borderRadius: 14,
            padding: 14,
            background: "#fff",
          }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            style={{ marginBottom: 10, fontSize: 12 }}
          />

          {image ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: "#fff7fb",
                  border: "1px solid #f3c8d6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: PRIMARY,
                }}
              >
                <FaImage />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{image.name}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  New image selected
                </div>
              </div>
            </div>
          ) : currentImage ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src={currentImage}
                alt="event"
                style={{
                  width: 140,
                  height: 84,
                  objectFit: "cover",
                  borderRadius: 12,
                  border: "1px solid #eee",
                }}
              />
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                Current banner image. Upload a file to replace it.
              </span>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
              No image selected yet.
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 4,
          flexWrap: "wrap",
        }}
      >
        <ActionPillButton variant="neutral" onClick={closeModal}>
          Cancel
        </ActionPillButton>
        <ActionPillButton
          type="submit"
          variant="primary"
          disabled={loading}
          style={{ minWidth: 116 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FaSave />
            {loading ? "Saving..." : editId ? "Update Event" : "Create Event"}
          </span>
        </ActionPillButton>
      </div>
    </form>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6fa",
        padding: "20px 24px 32px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <ToastContainer />
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  margin: "4px 0 4px",
                  color: "#111827",
                }}
              >
                Event Management
              </h1>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                Create, edit, and review community swap events for ClosetLoop.
              </p>
            </div>

            <Button
              type="button"
              onClick={openCreateModal}
              style={{
                background: PRIMARY,
                borderColor: PRIMARY,
                color: "#fff",
                padding: "8px 14px",
                borderRadius: 10,
              }}
            >
              <FaPlus />
              New Event
            </Button>
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

        {/* STATS */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            padding: "16px 18px 18px",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Event Overview
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Current event counts and schedule status.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <CompactStatCard
              label="Events"
              value={totalEvents}
              subtext="Total recorded events"
              accent={PRIMARY}
              softBg="#fdf2f7"
            />
            <CompactStatCard
              label="Upcoming"
              value={upcomingCount}
              subtext="Scheduled community events"
              accent="#5ea778"
              softBg="#eef9f1"
            />
            <CompactStatCard
              label="Past"
              value={pastCount}
              subtext="Finished event schedules"
              accent="#6b7280"
              softBg="#f3f4f6"
            />
          </div>
        </div>

        {/* LIST */}
        <div
          style={{
            ...ADMIN_TABLE_CARD_STYLE,
            padding: "16px 18px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                Event Records
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Review schedules, locations, and event status from one table.
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  color:
                    searchTerm || statusFilter !== "all" || locationFilter !== "all" || sortOrder !== "newest"
                      ? PRIMARY
                      : "#9ca3af",
                }}
              >
                Showing {filteredEvents.length} of {events.length} events
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(220px,1.4fr) repeat(4,minmax(140px,0.8fr))",
                alignItems: "stretch",
                gap: 10,
                width: "100%",
                maxWidth: 980,
              }}
            >
              <div
                style={{
                  ...compactFilterControlStyle,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 10px",
                  background: "#fff",
                  minWidth: 0,
                }}
              >
                <FaSearch
                  size={11}
                  style={{
                    color: PRIMARY,
                    display: "block",
                    flexShrink: 0,
                  }}
                />
                <input
                  type="text"
                  placeholder="Search title, location, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                    outline: "none",
                    padding: 0,
                    marginBottom: 0,
                    background: "transparent",
                    backdropFilter: "none",
                    fontSize: 12,
                    color: "#111827",
                    boxShadow: "none",
                  }}
                />
              </div>

              <div style={{ position: "relative" }}>
                <FaFilter
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 12,
                    color: "#9ca3af",
                  }}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    ...compactFilterControlStyle,
                    padding: "10px 12px 10px 30px",
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
              </div>

              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                style={compactFilterControlStyle}
              >
                <option value="all">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={compactFilterControlStyle}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>

              <Button
                type="button"
                onClick={clearFilters}
                style={{
                  width: "100%",
                  background: "#fff",
                  color:
                    searchTerm || statusFilter !== "all" || locationFilter !== "all" || sortOrder !== "newest"
                      ? PRIMARY
                      : "#374151",
                  borderColor: "#e5e7eb",
                  borderRadius: 10,
                  minHeight: 42,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  boxShadow: "none",
                }}
              >
                <FaTimes />
                Reset Filters
              </Button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                ...ADMIN_TABLE_STYLE,
                fontSize: 12,
                minWidth: 860,
              }}
            >
              <thead>
                <tr style={{ background: "#f9edf5" }}>
                  <th style={{ ...thStyle, minWidth: 260 }}>Event</th>
                  <th style={{ ...thStyle, minWidth: 170 }}>Location</th>
                  <th style={{ ...thStyle, minWidth: 170 }}>Schedule</th>
                  <th style={{ ...thStyle, width: 96 }}>Status</th>
                  <th style={{ ...thStyle, width: 112, textAlign: "left" }}>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <EmptyState onClear={clearFilters} />
                    </td>
                  </tr>
                ) : (
                  paginatedEvents.map((event, index) => {
                    const upcoming = isUpcoming(event.date);

                    return (
                      <tr
                        key={event.id}
                        style={{
                          background: index % 2 ? "#fff" : "#f9fafb",
                        }}
                      >
                        <td style={tdStyleStrong}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              minWidth: 0,
                            }}
                          >
                            <div style={imageBox}>
                              {event.imageUrl ? (
                                <img src={event.imageUrl} alt="event" style={imageFill} />
                              ) : (
                                "No Img"
                              )}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontWeight: 700,
                                  color: "#111827",
                                  fontSize: 13,
                                  lineHeight: 1.35,
                                }}
                              >
                                {event.title || "Untitled Event"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td style={tdStyle}>{event.location || "-"}</td>

                        <td style={tdStyle}>{formatDateTime(event.date)}</td>

                        <td style={tdStyle}>
                          <StatusBadge upcoming={upcoming} />
                        </td>

                        <td style={{ ...tdStyle, textAlign: "left" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                            }}
                          >
                            <ActionPillButton
                              variant="primary"
                              onClick={() => openViewModal(event)}
                            >
                              View
                            </ActionPillButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <AdminTablePagination
            totalItems={filteredEvents.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
            noun="events"
          />
        </div>
      </div>

      {isModalOpen && (
        <ModalShell onClose={closeModal}>
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px 16px",
                borderBottom: "1px solid #eef1f4",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
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
                  {modalMode === "view"
                    ? "Overview"
                    : modalMode === "edit"
                    ? "Edit Mode"
                    : "New Entry"}
                </div>
                <h2
                  style={{
                    margin: "8px 0 4px",
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#111827",
                  }}
                >
                  {modalTitle}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                  {modalSubtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                <FaTimes />
              </button>
            </div>

            {(modalMode === "create" || modalMode === "edit") && (
              <div
                style={{
                  padding: 20,
                  background: "#f9fafb",
                }}
              >
                {renderEventForm()}
              </div>
            )}

            {modalMode === "view" && selectedEvent && (
              <div
                style={{
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  background: "#f9fafb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    background: "#fff",
                    border: "1px solid #eef1f4",
                    borderRadius: 12,
                    padding: "10px 14px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    <button
                      type="button"
                      onClick={closeModal}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        color: "#6b7280",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Events
                    </button>
                    <span style={{ color: "#9ca3af" }}>&gt;</span>
                    <span
                      style={{
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {selectedEvent.title || "Event Details"}
                    </span>
                  </div>

                  <button
                    onClick={closeModal}
                    style={{
                      background: "#fff",
                      border: "1px solid #d1d5db",
                      color: "#374151",
                      borderRadius: 8,
                      padding: "7px 11px",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      cursor: "pointer",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    }}
                  >
                    <FaArrowLeft size={11} /> Back to Events
                  </button>
                </div>

                <div
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    border: "1px solid #eef1f4",
                    overflow: "hidden",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      height: 248,
                      background: "#f3f4f6",
                    }}
                  >
                    {selectedEvent.imageUrl ? (
                      <img
                        src={selectedEvent.imageUrl}
                        alt={selectedEvent.title || "event"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#9ca3af",
                          fontWeight: 700,
                        }}
                      >
                        No banner image
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "18px 20px 16px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 22,
                            fontWeight: 800,
                            color: "#111827",
                          }}
                        >
                          {selectedEvent.title || "Untitled Event"}
                        </h3>
                        <p
                          style={{
                            margin: "8px 0 0",
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          {formatDateTime(selectedEvent.date)}
                        </p>
                      </div>

                      <StatusBadge upcoming={isUpcoming(selectedEvent.date)} />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                    gap: 14,
                  }}
                >
                  <DetailField
                    label="Location"
                    value={selectedEvent.location || "-"}
                  />
                  <DetailField
                    label="Schedule"
                    value={formatDateTime(selectedEvent.date)}
                  />
                </div>

                <div
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    border: "1px solid #eef1f4",
                    padding: "18px 20px",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#9ca3af",
                      marginBottom: 10,
                    }}
                  >
                    Description
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.72,
                      color: "#374151",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {selectedEvent.description || "No description provided."}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    background: "#fff",
                    borderRadius: 16,
                    border: "1px solid #eef1f4",
                    padding: "16px 18px",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        marginBottom: 4,
                      }}
                    >
                      Event actions
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Open participants, update the event, or remove it from the
                      schedule.
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <ActionPillButton
                      variant="primary"
                      onClick={() => {
                        navigate(`/admin/EventParticipants?id=${selectedEvent.id}`);
                      }}
                      style={{ minWidth: 132 }}
                    >
                      View Participants
                    </ActionPillButton>
                    <ActionPillButton
                      variant="secondary"
                      onClick={() => handleEdit(selectedEvent)}
                      style={{ minWidth: 108 }}
                    >
                      Edit Event
                    </ActionPillButton>
                    <ActionPillButton
                      variant="danger"
                      onClick={async () => {
                        const deleted = await handleDelete(selectedEvent.id);
                        if (deleted) closeModal();
                      }}
                      style={{ minWidth: 108 }}
                    >
                      Delete Event
                    </ActionPillButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: "#374151",
};
