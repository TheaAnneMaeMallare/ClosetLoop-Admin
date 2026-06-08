// src/pages/Posts.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useLocation } from "react-router-dom";
import { FaArrowLeft, FaSearch } from "react-icons/fa";
import AdminTablePagination from "../components/AdminTablePagination";
import {
  ADMIN_TABLE_CARD_STYLE,
  ADMIN_TABLE_CELL_STYLE,
  ADMIN_TABLE_EMPTY_ROW_STYLE,
  ADMIN_TABLE_HEADER_STYLE,
  ADMIN_TABLE_HEAD_CELL_STYLE,
  ADMIN_TABLE_STYLE,
} from "../components/adminTableStyles";

// ---------- Small UI helpers ----------
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
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      ...style,
    }}
  >
    {children}
  </button>
);

const SkeletonRow = () => (
  <tr>
    {[...Array(7)].map((_, i) => (
      <td key={i} style={{ padding: "8px 10px", borderTop: "1px solid #eee" }}>
        <div
          style={{
            height: 12,
            background: "#e5e7eb",
            borderRadius: 999,
            width: i === 0 ? 140 : 80,
          }}
        />
      </td>
    ))}
  </tr>
);

// --- shared styles ---
const selectStyle = {
  width: "100%",
  height: 38,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  fontSize: 12,
  lineHeight: "38px",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 0,
};

const tdStyle = {
  ...ADMIN_TABLE_CELL_STYLE,
  verticalAlign: "top",
};

const STATUS_STYLES = {
  available: { bg: "#ecfdf3", color: "#166534", label: "Available" },
  pending: { bg: "#fff7ed", color: "#c2410c", label: "Pending" },
  reserved: { bg: "#eff6ff", color: "#1d4ed8", label: "Reserved" },
  completed: { bg: "#f0f9ff", color: "#075985", label: "Completed" },
  cancelled: { bg: "#fef2f2", color: "#991b1b", label: "Cancelled" },
  reported: { bg: "#fff1f2", color: "#be123c", label: "Reported" },
  hidden_until_corrected: {
    bg: "#fff7e8",
    color: "#9a6700",
    label: "Hidden Until Corrected",
  },
  permanent_takedown: { bg: "#111827", color: "#fff", label: "Taken Down" },
  taken_down: { bg: "#111827", color: "#fff", label: "Taken Down" },
};

const getStatusStyle = (statusRaw) => {
  const key = (statusRaw || "available").toLowerCase();
  return STATUS_STYLES[key] || STATUS_STYLES.available;
};

const getDisplayStatus = (post) => {
  if (
    post?.moderationStatus === "taken_down" ||
    post?.moderationStatus === "hidden_until_corrected" ||
    post?.moderationStatus === "permanent_takedown" ||
    post?.isHidden === true
  ) {
    return post?.moderationStatus || "taken_down";
  }

  return post?.status || "available";
};

const formatDate = (v) =>
  v?.seconds ? new Date(v.seconds * 1000).toLocaleDateString() : "-";

const CLOTHING_TYPE_OPTIONS = [
  "Dress",
  "T-Shirt",
  "Jeans",
  "Pants/Jeans",
  "Jacket/Coat",
  "Skirt",
];

// ---------- Main Component ----------
export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [usersByUid, setUsersByUid] = useState({});
  const [loading, setLoading] = useState(true);

  const [openFilters, setOpenFilters] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [preview, setPreview] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);

  // sort state: field = 'product' | 'date' | 'location' | null
  const [sortState, setSortState] = useState({
    field: null,
    direction: null, // 'asc' | 'desc' | null
  });

  // ownerUid galing sa URL (e.g. /posts?ownerUid=abc123)
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const ownerUidFilter = searchParams.get("ownerUid") || "";
  const clothingTypeFilter = searchParams.get("clothingType") || "";
  const hasListedType =
    filterType === "all" || CLOTHING_TYPE_OPTIONS.includes(filterType);

  useEffect(() => {
    if (!clothingTypeFilter) return;

    setFilterType(clothingTypeFilter);
    setCurrentPage(1);
  }, [clothingTypeFilter]);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersSnap, postsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "posts")),
        ]);

        // posts with originalIndex for stable default ordering
        setPosts(
          postsSnap.docs.map((d, index) => ({
            id: d.id,
            originalIndex: index,
            ...d.data(),
          }))
        );

        // build users map for owner info
        const usersMap = {};
        usersSnap.docs.forEach((d) => {
          const data = d.data();
          const uid = data.uid || d.id;
          usersMap[uid] = {
            displayName:
              data.displayName ||
              data.fullName ||
              data.name ||
              data.username ||
              "Unknown user",
            username: data.username || "",
            email: data.email || "",
          };
        });
        setUsersByUid(usersMap);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const resetFilters = () => {
    setFilterType("all");
    setFilterCondition("all");
    setSearchTerm("");
    setCurrentPage(1);
    setSortState({ field: null, direction: null });
    // ownerUidFilter is URL-based, so di natin nire-reset dito
  };

  // 1) Filter
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return posts.filter((p) => {
      const postOwnerUid =
        p.ownerUid ||
        p.ownerId ||
        p.userId ||
        p.uid ||
        p.createdBy ||
        "";

      const matchOwner = !ownerUidFilter || postOwnerUid === ownerUidFilter;

      const matchType =
        filterType === "all" ||
        (p.clothingType || "").toLowerCase() === filterType.toLowerCase();

      const matchCondition =
        filterCondition === "all" ||
        (p.condition || "").toLowerCase() ===
          filterCondition.toLowerCase();

      const matchSearch =
        !q ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.location || "").toLowerCase().includes(q) ||
        (p.size || "").toLowerCase().includes(q);

      return matchOwner && matchType && matchCondition && matchSearch;
    });
  }, [posts, filterType, filterCondition, searchTerm, ownerUidFilter]);

  // 2) Sort (Product, Date, Location)
  const sorted = useMemo(() => {
    if (!sortState.field || !sortState.direction) return filtered;

    const arr = [...filtered];

    arr.sort((a, b) => {
      let av;
      let bv;

      if (sortState.field === "product") {
        av = (a.description || "").toLowerCase();
        bv = (b.description || "").toLowerCase();
      } else if (sortState.field === "date") {
        const at = a.createdAt?.seconds
          ? a.createdAt.seconds
          : 0;
        const bt = b.createdAt?.seconds
          ? b.createdAt.seconds
          : 0;
        av = at;
        bv = bt;
      } else if (sortState.field === "location") {
        av = (a.location || "").toLowerCase();
        bv = (b.location || "").toLowerCase();
      } else {
        av = 0;
        bv = 0;
      }

      let cmp = 0;
      if (av < bv) cmp = -1;
      else if (av > bv) cmp = 1;
      else {
        // tie-breaker: originalIndex
        cmp =
          (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
      }

      return sortState.direction === "asc" ? cmp : -cmp;
    });

    return arr;
  }, [filtered, sortState]);

  // pagination (clamp page para hindi lumampas)
  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * rowsPerPage;
  const paginated = sorted.slice(start, start + rowsPerPage);

  // handle sort cycle: asc → desc → none(default)
  const handleSort = (field) => {
    setSortState((prev) => {
      if (prev.field !== field) {
        return { field, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { field, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { field: null, direction: null };
      }
      return { field, direction: "asc" };
    });
  };

  const sortArrow = (field) => {
    if (sortState.field !== field || !sortState.direction) return "";
    return sortState.direction === "asc" ? "▲" : "▼";
  };

  // Delete post handler (admin)
  const handleDeletePost = async (post) => {
    const ok = window.confirm(
      "Delete this post record from the database? This cannot be undone."
    );
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "posts", post.id));
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      alert("Post deleted successfully.");
    } catch (err) {
      console.error(err);
      alert("Error deleting post.");
    }
  };

  const imageBox64 = {
    width: 64,
    height: 64,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    flexShrink: 0,
    cursor: "pointer",
  };
  const imageFill = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const selectedOwnerUid =
    selectedPost &&
    (selectedPost.ownerUid ||
      selectedPost.ownerId ||
      selectedPost.userId ||
      selectedPost.uid ||
      selectedPost.createdBy ||
      "");
  const selectedOwner = selectedOwnerUid
    ? usersByUid[selectedOwnerUid]
    : null;

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
      {/* MAIN COLUMN */}
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
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
            <span
              style={{
                color: "#de638a",
                fontWeight: 600,
              }}
            >
              ClosetLoop
            </span>{" "}
            Admin Dashboard
          </p>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              margin: "4px 0 4px",
              color: "#111827",
            }}
          >
            Item Management
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "#6b7280",
              margin: 0,
            }}
          >
            Browse, filter, and moderate item listings created by users.
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

        {/* FILTERS CARD */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #eee",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Filter Items
              </h3>
              <span
                style={{
                  fontSize: 13,
                  color: "#de638a",
                  fontWeight: 600,
                }}
              >
                ({filtered.length} match)
              </span>
              {ownerUidFilter && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#de638a",
                    background: "#fff0f6",
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  Filtering by user UID: {ownerUidFilter}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                onClick={resetFilters}
                style={{
                  background: "#f3f4f6",
                  borderColor: "#e5e7eb",
                  color: "#374151",
                }}
              >
                Reset
              </Button>
              <Button
                onClick={() => setOpenFilters((s) => !s)}
                style={{
                  background: "#de638a",
                  borderColor: "#de638a",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {openFilters ? "Hide Filters" : "Show Filters"}
              </Button>
            </div>
          </div>

          {openFilters && (
            <div
              style={{
                padding: "12px 16px 14px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setCurrentPage(1);
                }}
                style={selectStyle}
              >
                <option value="all">All Clothing Types</option>
                {!hasListedType && (
                  <option value={filterType}>{filterType}</option>
                )}
                {CLOTHING_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                value={filterCondition}
                onChange={(e) => {
                  setFilterCondition(e.target.value);
                  setCurrentPage(1);
                }}
                style={selectStyle}
              >
                <option value="all">All Conditions</option>
                <option value="New with tags">New with tags</option>
                <option value="Like new">Like new</option>
                <option value="Gently used">Gently used</option>
                <option value="Used">Used</option>
                <option value="Well-worn">Well-worn</option>
              </select>

              <div
                style={{
                  ...selectStyle,
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
                  type="text"
                  placeholder="Search description, location, size…"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
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
                    lineHeight: "normal",
                    color: "#111827",
                    boxShadow: "none",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* TABLE CARD */}
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
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
              >
                Items List
              </h2>
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              Showing {paginated.length} of {sorted.length} results
            </span>
          </div>

          <div style={{ overflowX: "hidden" }}>
            <table
              style={{
                ...ADMIN_TABLE_STYLE,
                minWidth: 0,
              }}
            >
              <thead>
                <tr style={{ background: "#f9edf5", color: "#374151" }}>
                  {/* Product (sortable) */}
                  <th
                    style={{
                      ...ADMIN_TABLE_HEAD_CELL_STYLE,
                      cursor: "pointer",
                      userSelect: "none",
                      width: "26%",
                    }}
                    onClick={() => handleSort("product")}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      Product
                      <span style={{ fontSize: 10 }}>
                        {sortArrow("product")}
                      </span>
                    </span>
                  </th>

                  {/* Not sortable */}
                  <th
                    style={{
                      ...ADMIN_TABLE_HEAD_CELL_STYLE,
                      width: "13%",
                    }}
                  >
                    Condition
                  </th>
                  <th
                    style={{
                      ...ADMIN_TABLE_HEAD_CELL_STYLE,
                      width: "14%",
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      ...ADMIN_TABLE_HEAD_CELL_STYLE,
                      width: "8%",
                    }}
                  >
                    Size
                  </th>
                  <th
                    style={{
                      ...ADMIN_TABLE_HEAD_CELL_STYLE,
                      cursor: "pointer",
                      userSelect: "none",
                      width: "15%",
                    }}
                    onClick={() => handleSort("location")}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      Location
                      <span style={{ fontSize: 10 }}>
                        {sortArrow("location")}
                      </span>
                    </span>
                  </th>

                  {/* Date (sortable) */}
                  <th
                    style={{
                      ...ADMIN_TABLE_HEAD_CELL_STYLE,
                      cursor: "pointer",
                      userSelect: "none",
                      width: "12%",
                    }}
                    onClick={() => handleSort("date")}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      Date
                      <span style={{ fontSize: 10 }}>
                        {sortArrow("date")}
                      </span>
                    </span>
                  </th>

                  <th
                    style={{
                      ...ADMIN_TABLE_HEAD_CELL_STYLE,
                      width: "12%",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                  : paginated.length === 0
                  ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          ...ADMIN_TABLE_EMPTY_ROW_STYLE,
                          borderTop: "1px solid #f1f5f9",
                        }}
                      >
                        No items match the current filters. Try changing search
                        or condition.
                      </td>
                    </tr>
                    )
                  : paginated.map((p, i) => (
                      <tr
                        key={p.id}
                        style={{
                          background: i % 2 ? "#ffffff" : "#f9fafb",
                          borderTop: "1px solid #eee",
                        }}
                      >
                        <td style={tdStyle}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div
                              style={imageBox64}
                              onClick={() =>
                                p.images?.[0] && setPreview(p.images[0])
                              }
                              title="Click to preview"
                            >
                              {p.images?.[0] ? (
                                <img
                                  src={p.images[0]}
                                  alt="thumb"
                                  style={imageFill}
                                />
                              ) : (
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "#9ca3af",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "100%",
                                    height: "100%",
                                  }}
                                >
                                  No Img
                                </div>
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontWeight: 500,
                                  maxWidth: 220,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={p.description || ""}
                              >
                                {p.description || "-"}
                              </p>
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontSize: 12,
                                  color: "#6b7280",
                                }}
                              >
                                {p.clothingType || "-"}
                              </p>
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontSize: 11,
                                  color: "#9ca3af",
                                }}
                              >
                                ID: {p.id.slice(0, 10)}…
                              </p>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>{p.condition || "-"}</td>
                        <td style={tdStyle}>{p.clothingType || "-"}</td>
                        <td style={tdStyle}>{p.size || "-"}</td>
                        <td style={tdStyle}>
                          <span
                            title={p.location || ""}
                            style={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.location || "-"}
                          </span>
                        </td>
                        <td style={tdStyle}>{formatDate(p.createdAt)}</td>
                        <td style={tdStyle}>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "nowrap",
                              alignItems: "center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedPost(p)}
                              style={{
                                padding: "5px 8px",
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                background: "#f9fafb",
                                color: "#374151",
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePost(p)}
                              style={{
                                padding: "5px 8px",
                                borderRadius: 8,
                                border: "1px solid #de638a",
                                background: "#fff",
                                color: "#de638a",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

        <AdminTablePagination
          totalItems={sorted.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          noun="items"
        />
        </div>

        {/* ITEM DETAILS MODAL */}
        {selectedPost && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1500,
              padding: 16,
            }}
            onClick={() => setSelectedPost(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "18px 20px 16px",
                width: 520,
                maxWidth: "100%",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
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
                  marginBottom: 14,
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
                    onClick={() => setSelectedPost(null)}
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
                    Item Management
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
                    {selectedPost.description || "Item Details"}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedPost(null)}
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
                  <FaArrowLeft size={11} /> Back to Items
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
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
                  Item Details
                </h3>
                <button
                  onClick={() => setSelectedPost(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 20,
                    cursor: "pointer",
                    color: "#9ca3af",
                  }}
                >
                  ×
                </button>
              </div>

              {/* Image + main info */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginBottom: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "#f3f4f6",
                    flexShrink: 0,
                  }}
                >
                  {selectedPost.images?.[0] ? (
                    <img
                      src={selectedPost.images[0]}
                      alt="item"
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
                        fontSize: 12,
                        color: "#9ca3af",
                      }}
                    >
                      No image
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#111827",
                      marginBottom: 4,
                    }}
                  >
                    {selectedPost.description || "Untitled item"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      marginBottom: 6,
                    }}
                  >
                    {selectedPost.clothingType || "Uncategorized"} ·{" "}
                    {selectedPost.size || "No size"} ·{" "}
                    {selectedPost.condition || "No condition"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                    }}
                  >
                    Post ID: {selectedPost.id}
                  </div>
                </div>
              </div>

              {/* Owner info */}
              <div
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: "#f9fafb",
                  fontSize: 12,
                  color: "#4b5563",
                  marginBottom: 10,
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
                  Owner
                </div>
                <div style={{ marginBottom: 3 }}>
                  <strong>Name:</strong>{" "}
                  {selectedOwner
                    ? selectedOwner.displayName
                    : "Unknown user"}
                </div>
                <div style={{ marginBottom: 3 }}>
                  <strong>Username:</strong>{" "}
                  {selectedOwner?.username
                    ? `@${selectedOwner.username}`
                    : "—"}
                </div>
                <div style={{ marginBottom: 3 }}>
                  <strong>Email:</strong>{" "}
                  {selectedOwner?.email || "—"}
                </div>
                <div style={{ marginBottom: 3 }}>
                  <strong>Owner UID:</strong>{" "}
                  {selectedOwnerUid || "—"}
                </div>
              </div>

              {/* Post meta */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0,1fr) minmax(0,1fr)",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
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
                    Item details
                  </div>
                  <div style={{ marginBottom: 3 }}>
                    <strong>Type:</strong>{" "}
                    {selectedPost.clothingType || "—"}
                  </div>
                  <div style={{ marginBottom: 3 }}>
                    <strong>Condition:</strong>{" "}
                    {selectedPost.condition || "—"}
                  </div>
                  <div style={{ marginBottom: 3 }}>
                    <strong>Size:</strong>{" "}
                    {selectedPost.size || "-"}
                  </div>
                  <div style={{ marginBottom: 3 }}>
                    <strong>Status:</strong>{" "}
                    {(() => {
                      const status = getDisplayStatus(selectedPost);
                      const { bg, color, label } = getStatusStyle(status);
                      return (
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: 999,
                            background: bg,
                            color,
                            fontWeight: 700,
                            fontSize: 11,
                            textTransform: "capitalize",
                          }}
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                  {selectedPost.isHidden && selectedPost.hiddenReason && (
                    <div style={{ marginBottom: 3 }}>
                      <strong>Moderation Reason:</strong>{" "}
                      {selectedPost.hiddenReason}
                    </div>
                  )}
                </div>

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
                    Location and date
                  </div>
                  <div style={{ marginBottom: 3 }}>
                    <strong>Location:</strong>{" "}
                    {selectedPost.location || "—"}
                  </div>
                  <div style={{ marginBottom: 3 }}>
                    <strong>Created:</strong>{" "}
                    {formatDate(selectedPost.createdAt)}
                  </div>
                </div>
              </div>

              {/* Full description */}
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
                  Full description
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {selectedPost.description ||
                    "No description provided."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE MODAL */}
        {preview && (
          <div
            onClick={() => setPreview(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 999,
            }}
          >
            <img
              src={preview}
              alt="Preview"
              style={{
                maxWidth: "85%",
                maxHeight: "85%",
                borderRadius: 12,
                boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                objectFit: "contain",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
