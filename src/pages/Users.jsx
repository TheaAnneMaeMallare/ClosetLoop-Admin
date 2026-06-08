// src/pages/Users.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import {
  FaSearch,
  FaUsers,
  FaUserCheck,
  FaFilter,
  FaSortAmountDown,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import AdminStatCard, {
  ADMIN_STAT_CARD_COLORS,
  AdminStatGrid,
} from "../components/AdminStatCard";
import AdminTablePagination from "../components/AdminTablePagination";
import {
  ADMIN_TABLE_CARD_STYLE,
  ADMIN_TABLE_CELL_STRONG_STYLE,
  ADMIN_TABLE_CELL_STYLE,
  ADMIN_TABLE_EMPTY_ROW_STYLE,
  ADMIN_TABLE_HEADER_STYLE,
  ADMIN_TABLE_HEAD_CELL_STYLE,
  ADMIN_TABLE_STYLE,
} from "../components/adminTableStyles";

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
      gap: 4,
      ...style,
    }}
  >
    {children}
  </button>
);

// ----------------------------------------------------------------

export default function Users() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [postsByUser, setPostsByUser] = useState({});
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("created_desc");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const filterRef = useRef();
  const sortRef = useRef();

  // close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterMenu(false);
      if (sortRef.current && !sortRef.current.contains(e.target)) setShowSortMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // realtime users
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();

        const normalizedUid = data.uid || d.id;
        const firstLast = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
        const resolvedDisplayName =
          data.displayName ||
          data.fullName ||
          data.name ||
          firstLast ||
          data.username ||
          "Unnamed";

        return {
          id: d.id,
          ...data,

          uid: normalizedUid,
          displayName: resolvedDisplayName,
          username: data.username || "",
          messengerUsername: data.messengerUsername || "",
          email: data.email || "—",
          role: data.role || (data.isAdmin ? "admin" : "user"),
          createdAt: data.createdAt || data.joinedAt || null,
          disabled: data.disabled || false,
        };
      });

      setUsers(list);
      setLoading(false);
    });

    // listen to posts for user item counts
    const unsubPosts = onSnapshot(collection(db, "posts"), (snap) => {
      const counts = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const ownerUid =
          data.ownerUid ||
          data.ownerId ||
          data.userId ||
          data.uid ||
          data.createdBy ||
          "";

        if (!ownerUid) return;
        counts[ownerUid] = (counts[ownerUid] || 0) + 1;
      });
      setPostsByUser(counts);
    });

    return () => {
      unsubUsers();
      unsubPosts();
    };
  }, []);

  // filter + search + sort
  const filtered = useMemo(() => {
    let list = users;

    if (filter === "active") list = list.filter((u) => !u.disabled);
    else if (filter === "disabled") list = list.filter((u) => u.disabled);

    if (q.trim()) {
      const term = q.toLowerCase();

      list = list.filter((u) => {
        const fieldsToSearch = [
          u.displayName,
          u.username,
          u.messengerUsername,
          u.email,
          u.id,
          u.uid,
        ];

        return fieldsToSearch
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
    }

    const toMs = (v) =>
      v && v.seconds
        ? v.seconds * 1000
        : typeof v === "number"
        ? v
        : Date.parse(v || 0) || 0;

    switch (sortBy) {
      case "name_asc":
        return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
      case "created_asc":
        return [...list].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
      default:
        return [...list].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    }
  }, [users, q, sortBy, filter]);

  // clamp pagination to available pages
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(start, start + rowsPerPage);

  // reset to first page when filters/search/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [q, filter, sortBy, rowsPerPage]);

  const total = users.length;
  const active = users.filter((u) => !u.disabled).length;
  // delete user
  const handleDeleteUser = async (user) => {
    const confirmDelete = window.confirm(
      `Delete this user?\n\nName: ${user.displayName}\nEmail: ${user.email}`
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "users", user.id));
      alert("User deleted.");
    } catch (err) {
      alert("Failed to delete user.");
      console.error(err);
    }
  };

  // shared styles
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

  const inputBase = {
    width: "100%",
    height: 38,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  const tdStyle = ADMIN_TABLE_CELL_STYLE;

  return (
    <div
      style={{
        ...pageBg,
        minHeight: "100vh",
        overflowY: "auto",
      }}
    >
      <div style={mainCol}>
        {/* HEADER CARD */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "16px 20px 14px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
            <span style={{ color: "#de638a", fontWeight: 600 }}>ClosetLoop</span> Admin Dashboard
          </p>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              margin: "4px 0 4px",
              color: "#111827",
            }}
          >
            Users
          </h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Manage users and activity in the ClosetLoop community.
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

        {/* KPI STRIP */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "14px 18px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
          }}
        >
          <AdminStatGrid minColumnWidth={160}>
            <AdminStatCard
              title="Users"
              value={total}
              description="Registered ClosetLoop accounts"
              icon={<FaUsers size={14} />}
              accentColor={ADMIN_STAT_CARD_COLORS.primary.accent}
              softBackgroundColor={ADMIN_STAT_CARD_COLORS.primary.soft}
            />
            <AdminStatCard
              title="Active"
              value={active}
              description="Accounts currently enabled"
              icon={<FaUserCheck size={14} />}
              accentColor={ADMIN_STAT_CARD_COLORS.verified.accent}
              softBackgroundColor={ADMIN_STAT_CARD_COLORS.verified.soft}
            />
          </AdminStatGrid>
        </div>

        {/* USERS LIST CARD */}
        <div
          style={{
            ...ADMIN_TABLE_CARD_STYLE,
          }}
        >
          {/* Header */}
          <div
            style={{
              ...ADMIN_TABLE_HEADER_STYLE,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Users List</h2>
              <span
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Showing {filtered.length} of {users.length} users
              </span>
            </div>

            {/* Search bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 1fr) 150px 140px",
                gap: 10,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  ...inputBase,
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
                    color: "#de638a",
                    display: "block",
                    flexShrink: 0,
                  }}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, username, messenger, email…"
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

              {/* Sort */}
              <div style={{ position: "relative", minWidth: 0 }} ref={sortRef}>
                <Button
                  onClick={() => setShowSortMenu((p) => !p)}
                  style={{
                    width: "100%",
                    height: 38,
                    justifyContent: "space-between",
                    background: "#f9fafb",
                    borderColor: "#e5e7eb",
                    color: "#374151",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ fontSize: 12 }}>
                    Sort:{" "}
                    {
                      {
                        created_desc: "Newest",
                        created_asc: "Oldest",
                        name_asc: "Name A–Z",
                      }[sortBy]
                    }
                  </span>
                  <FaSortAmountDown style={{ color: "#de638a" }} />
                </Button>

                {showSortMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: 40,
                      right: 0,
                      background: "#fff",
                      borderRadius: 10,
                      boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                      border: "1px solid rgba(0,0,0,0.05)",
                      overflow: "hidden",
                      zIndex: 50,
                      minWidth: 150,
                    }}
                  >
                    {[
                      { label: "Newest", value: "created_desc" },
                      { label: "Oldest", value: "created_asc" },
                      { label: "Name A–Z", value: "name_asc" },
                    ].map((opt) => (
                      <div
                        key={opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setShowSortMenu(false);
                        }}
                        style={{
                          padding: "9px 12px",
                          cursor: "pointer",
                          background:
                            sortBy === opt.value ? "rgba(222,99,138,0.08)" : "transparent",
                          color: sortBy === opt.value ? "#de638a" : "#1f2937",
                          fontSize: 13,
                          fontWeight: sortBy === opt.value ? 700 : 500,
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter */}
              <div style={{ position: "relative", minWidth: 0 }} ref={filterRef}>
                <Button
                  onClick={() => setShowFilterMenu((p) => !p)}
                  style={{
                    width: "100%",
                    height: 38,
                    justifyContent: "space-between",
                    background: "#f9fafb",
                    borderColor: "#e5e7eb",
                    color: "#374151",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ fontSize: 12 }}>
                    Filter: {filter === "all" ? "All" : filter === "active" ? "Active" : "Disabled"}
                  </span>
                  <FaFilter style={{ color: "#de638a", fontSize: 12 }} />
                </Button>

                {showFilterMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: 40,
                      right: 0,
                      background: "#fff",
                      borderRadius: 10,
                      boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                      border: "1px solid rgba(0,0,0,0.05)",
                      overflow: "hidden",
                      zIndex: 50,
                      minWidth: 130,
                    }}
                  >
                    {["all", "active", "disabled"].map((f) => (
                      <div
                        key={f}
                        onClick={() => {
                          setFilter(f);
                          setShowFilterMenu(false);
                        }}
                        style={{
                          padding: "9px 12px",
                          cursor: "pointer",
                          background:
                            filter === f ? "rgba(222,99,138,0.08)" : "transparent",
                          color: filter === f ? "#de638a" : "#1f2937",
                          fontSize: 13,
                        }}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* TABLE */}
          <div style={{ overflowX: "hidden" }}>
            <table
              style={{
                ...ADMIN_TABLE_STYLE,
                minWidth: 0,
              }}
            >
              <thead>
                <tr style={{ background: "#f9edf5" }}>
                  <th style={{ ...ADMIN_TABLE_HEAD_CELL_STYLE, width: "23%" }}>Name</th>
                  <th style={{ ...ADMIN_TABLE_HEAD_CELL_STYLE, width: "13%" }}>Username</th>
                  <th style={{ ...ADMIN_TABLE_HEAD_CELL_STYLE, width: "15%" }}>Messenger</th>
                  <th style={{ ...ADMIN_TABLE_HEAD_CELL_STYLE, width: "23%" }}>Email</th>
                  <th style={{ ...ADMIN_TABLE_HEAD_CELL_STYLE, width: "11%" }}>Item Posts</th>
                  <th
                    style={{
                      ...ADMIN_TABLE_HEAD_CELL_STYLE,
                      width: "15%",
                      textAlign: "center",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={ADMIN_TABLE_EMPTY_ROW_STYLE}>
                      Loading users…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={ADMIN_TABLE_EMPTY_ROW_STYLE}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((u, index) => {
                    const keyForPosts = u.uid || u.id;
                    const postCount = postsByUser[keyForPosts] || 0;

                    return (
                      <tr
                        key={u.id}
                        style={{ background: index % 2 ? "#fff" : "#f9fafb" }}
                      >
                        <td
                          style={{
                            ...ADMIN_TABLE_CELL_STRONG_STYLE,
                            fontWeight: 600,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <span>{u.displayName}</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>ID: {u.id}</span>
                        </td>

                        <td style={tdStyle}>{u.username ? "@" + u.username : "—"}</td>

                        <td style={ADMIN_TABLE_CELL_STYLE}>
                          {u.messengerUsername?.trim() ? u.messengerUsername : "—"}
                        </td>

                        <td style={tdStyle}>{u.email}</td>

                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{postCount}</td>

                        <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              gap: 6,
                              alignItems: "center",
                              flexWrap: "nowrap",
                            }}
                          >
                            
                            {/* 🔥 VIEW PROFILE — NOW NAVIGATES TO DEDICATED PAGE */}
                            <button
                              onClick={() => navigate(`/admin/users/${u.id}`)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "#de638a",
                                border: "none",
                                color: "#fff",
                                cursor: "pointer",
                                fontSize: 12,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              View
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid #de638a",
                                background: "#fff",
                                color: "#de638a",
                                cursor: "pointer",
                                fontSize: 12,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Delete
                            </button>
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
            totalItems={filtered.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
            noun="users"
          />
        </div>
      </div>
    </div>
  );
}
