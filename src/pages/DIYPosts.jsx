// src/pages/DIYPosts.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { FaArrowLeft, FaSearch } from "react-icons/fa";
import { db } from "../firebase/firebaseConfig";
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

// Reusable Button for simple controls (reset, etc.)
const Button = ({ children, style, ...props }) => (
  <button
    {...props}
    style={{
      padding: "6px 12px",
      fontSize: 12,
      borderRadius: 8,
      border: "1px solid #ddd",
      background: "#fff",
      cursor: "pointer",
      ...style,
    }}
  >
    {children}
  </button>
);

export default function DIYPosts() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const ownerUidFilter = searchParams.get("ownerUid") || "";
  const selectedPostId = searchParams.get("postId") || "";

  const [posts, setPosts] = useState([]);
  const [usersByUid, setUsersByUid] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const imageBox64 = {
    width: 64,
    height: 64,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    flexShrink: 0,
  };
  const imageFill = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const getPreviewImage = (post) => {
    const stepWithImage = post?.steps?.find((s) => s?.image);
    return stepWithImage?.image || null;
  };

  // LOAD DIY POSTS + USERS
  useEffect(() => {
    const load = async () => {
      try {
        // Load users
        const userSnap = await getDocs(collection(db, "users"));
        const userMap = {};
        userSnap.forEach((u) => {
          const data = u.data() || {};
          userMap[u.id] = {
            username: data.username || "unknown",
            email: data.email || "",
          };
        });
        setUsersByUid(userMap);

        // Load DIY posts
        const snap = await getDocs(collection(db, "diyPosts"));

        const data = snap.docs.map((d) => {
          const v = d.data() || {};

          return {
            id: d.id,
            title: v.title || "Untitled",
            materials: Array.isArray(v.materials) ? v.materials : [],
            steps: Array.isArray(v.steps) ? v.steps : [],
            estimatedTime: v.estimatedTime || "-",
            updatedAt: v.updatedAt || null,
            ownerUid: v.userID || v.ownerUid || null,
          };
        });

        setPosts(data);
      } catch (err) {
        console.error("DIY LOAD ERROR:", err);
        alert("Failed to load DIY posts.");
      }

      setLoading(false);
    };

    load();
  }, []);

  // FILTERED LIST
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return posts.filter((p) => {
      const matchOwner = !ownerUidFilter || p.ownerUid === ownerUidFilter;
      const matchSearch = p.title.toLowerCase().includes(q);
      return matchOwner && matchSearch;
    });
  }, [posts, search, ownerUidFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, ownerUidFilter, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(start, start + rowsPerPage);

  const selected = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || null,
    [posts, selectedPostId]
  );

  const openDetails = (postId) => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("postId", postId);
    navigate(`/admin/diy-posts?${nextParams.toString()}`);
  };

  const closeDetails = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("postId");
    const nextQuery = nextParams.toString();
    navigate(nextQuery ? `/admin/diy-posts?${nextQuery}` : "/admin/diy-posts");
  };

  // DELETE
  const handleDelete = async (post) => {
    const ok = confirm(`Delete DIY: "${post.title}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "diyPosts", post.id));
      setPosts((prev) => prev.filter((x) => x.id !== post.id));
      alert("DIY post deleted.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  const hasActiveFilters = Boolean(search.trim() || ownerUidFilter);

  if (selected) {
    return (
      <div
        style={{
          background: "#f5f6fa",
          minHeight: "100vh",
          padding: "20px 24px 32px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1120,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "16px 20px 14px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
              <span style={{ color: "#de638a", fontWeight: 600 }}>ClosetLoop</span>{" "}
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
              DIY Post Details
            </h1>

            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
              Review tutorial steps, materials, and author information.
            </p>
          </div>

          <div
            style={{
              ...ADMIN_TABLE_CARD_STYLE,
              marginTop: 16,
              padding: 0,
              maxWidth: 1120,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                background: "#fff7fb",
                borderBottom: "1px solid #f2dbe5",
                padding: "12px 16px",
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
                  onClick={closeDetails}
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
                  DIY Posts
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
                  {selected.title || "DIY Details"}
                </span>
              </div>

              <button
                onClick={closeDetails}
                style={{
                  background: "#fff",
                border: "1px solid #d1d5db",
                color: "#374151",
                borderRadius: 8,
                  padding: "7px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <FaArrowLeft size={11} /> Back
              </button>
            </div>

            <div style={{ padding: "16px 18px 20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.4fr) minmax(260px, 0.8fr)",
                  gap: 14,
                  alignItems: "start",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    border: "1px solid #eef1f4",
                    borderRadius: 12,
                    padding: "14px 16px",
                    background: "#fff",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 24,
                      fontWeight: 800,
                      color: "#111827",
                      lineHeight: 1.2,
                    }}
                  >
                    {selected.title}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 10,
                      fontSize: 12,
                      color: "#4b5563",
                    }}
                  >
                    <span>
                      <strong style={{ color: "#111827" }}>Author:</strong>{" "}
                      {usersByUid[selected.ownerUid]?.username ? (
                        <span style={{ color: "#de638a", fontWeight: 700 }}>
                          @{usersByUid[selected.ownerUid].username}
                        </span>
                      ) : (
                        "Unknown user"
                      )}
                    </span>
                    <span style={{ color: "#d1d5db" }}>|</span>
                    <span>{selected.steps.length} steps</span>
                    <span style={{ color: "#d1d5db" }}>|</span>
                    <span>{selected.materials.length} materials</span>
                    {selected.estimatedTime && selected.estimatedTime !== "-" ? (
                      <>
                        <span style={{ color: "#d1d5db" }}>|</span>
                        <span>{selected.estimatedTime}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #eef1f4",
                    borderRadius: 12,
                    padding: "12px 14px",
                    background: "#f9fafb",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 10px",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    Materials
                  </h3>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.materials.length ? (
                      selected.materials.map((m, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: "5px 8px",
                            borderRadius: 999,
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            color: "#374151",
                            fontSize: 12,
                            lineHeight: 1.2,
                          }}
                        >
                          {m}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "#9ca3af", fontSize: 12 }}>
                        No materials listed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #eef1f4",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    padding: "11px 14px",
                    borderBottom: "1px solid #eef1f4",
                    background: "#fbfbfc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    Steps
                  </h3>
                  <span style={{ color: "#6b7280", fontSize: 12 }}>
                    {selected.steps.length} total
                  </span>
                </div>

                <div>
                  {selected.steps.length ? (
                    selected.steps.map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: s.image ? "220px minmax(0, 1fr)" : "1fr",
                          gap: 14,
                          alignItems: "start",
                          padding: "14px",
                          borderTop: idx === 0 ? "none" : "1px solid #f1f5f9",
                        }}
                      >
                        {s.image && (
                          <img
                            src={s.image}
                            alt={`Step ${idx + 1}`}
                            style={{
                              width: "100%",
                              height: 150,
                              objectFit: "cover",
                              borderRadius: 10,
                              border: "1px solid #e5e7eb",
                              background: "#f9fafb",
                              display: "block",
                            }}
                          />
                        )}

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 28,
                              height: 22,
                              padding: "0 8px",
                              borderRadius: 999,
                              background: "#fff1f6",
                              color: "#de638a",
                              fontSize: 12,
                              fontWeight: 800,
                              marginBottom: 8,
                            }}
                          >
                            Step {idx + 1}
                          </div>

                          <p
                            style={{
                              margin: 0,
                              fontSize: 13,
                              lineHeight: 1.55,
                              color: "#374151",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {s.text || "No instructions provided."}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: 18,
                        color: "#9ca3af",
                        fontSize: 13,
                        textAlign: "center",
                      }}
                    >
                      No steps listed.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#f5f6fa",
        minHeight: "100vh",
        padding: "20px 24px 32px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "16px 20px 14px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
            <span style={{ color: "#de638a", fontWeight: 600 }}>ClosetLoop</span>{" "}
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
            DIY Posts Management
          </h1>

          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Browse and moderate community-submitted DIY tutorials.
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

      {/* FILTER CARD */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
          overflow: "hidden",
          marginTop: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Filter DIY Posts
            </h3>
            {ownerUidFilter && (
              <span
                style={{
                  fontSize: 11,
                  color: "#de638a",
                  background: "#fff0f6",
                  borderRadius: 999,
                  padding: "2px 10px",
                }}
              >
                Filtering by user UID: {ownerUidFilter}
              </span>
            )}
          </div>

          <Button
            onClick={() => setSearch("")}
            style={{
              background: "#f3f4f6",
              borderColor: "#d1d5db",
              color: "#374151",
            }}
          >
            Reset
          </Button>
        </div>

        {/* Search bar */}
        <div style={{ padding: "12px 16px 16px" }}>
          <div
            style={{
              width: "100%",
              height: 38,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 10px",
              background: "#fff",
              boxSizing: "border-box",
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
              placeholder="Search DIY titles"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
        </div>
      </div>

      {/* TABLE CARD */}
      <div
        style={{
          ...ADMIN_TABLE_CARD_STYLE,
          marginTop: 16,
        }}
      >
        {/* TABLE HEADER */}
        <div
          style={{
            ...ADMIN_TABLE_HEADER_STYLE,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                color: "#111827",
              }}
            >
              DIY Records
            </h2>

            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
              Review tutorial metadata, materials, and moderation actions.
            </p>
          </div>

          <span style={{ fontSize: 12, color: hasActiveFilters ? "#de638a" : "#6b7280" }}>
            Showing {filtered.length} of {posts.length} DIY posts
          </span>
        </div>

        {/* TABLE */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              ...ADMIN_TABLE_STYLE,
              minWidth: 760,
            }}
          >
            <thead>
              <tr style={{ background: "#f9edf5", color: "#374151" }}>
                <th style={{ ...tableHeadStyle, width: "36%" }}>DIY</th>
                <th style={{ ...tableHeadStyle, width: "34%" }}>Materials</th>
                <th style={{ ...tableHeadStyle, width: "12%" }}>Time</th>
                <th style={{ ...tableHeadStyle, width: "18%", textAlign: "center" }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={ADMIN_TABLE_EMPTY_ROW_STYLE}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={ADMIN_TABLE_EMPTY_ROW_STYLE}>
                    No DIY posts found.
                  </td>
                </tr>
              ) : (
                paginated.map((p, i) => {
                  const preview = getPreviewImage(p);
                  return (
                    <tr
                      key={p.id}
                      style={{
                        background: i % 2 ? "#ffffff" : "#fafafa",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      {/* DIY info with image */}
                      <td style={tableCellStrongStyle}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div style={imageBox64}>
                            {preview ? (
                              <img src={preview} alt="thumb" style={imageFill} />
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
                          <div>
                            <p
                              style={{
                                margin: 0,
                                fontWeight: 600,
                                maxWidth: 260,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={p.title}
                            >
                              {p.title}
                            </p>
                            <p
                              style={{
                                margin: "2px 0 0",
                                fontSize: 12,
                                color: "#6b7280",
                              }}
                            >
                              @{usersByUid[p.ownerUid]?.username || "unknown"}
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

                      {/* MATERIALS */}
                      <td style={tableCellStyle}>
                        {p.materials.length ? p.materials.join(", ") : "-"}
                      </td>

                      {/* TIME */}
                      <td style={tableCellStyle}>{p.estimatedTime}</td>

                      {/* ACTIONS */}
                      <td
                        style={{
                          ...tableCellStyle,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openDetails(p.id)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#f9fafb",
                            color: "#374151",
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: "pointer",
                            marginRight: 6,
                          }}
                        >
                          View details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 8,
                            border: "1px solid #de638a",
                            background: "#fff",
                            color: "#de638a",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
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
          noun="DIY posts"
        />
      </div>

      </div>
    </div>
  );
}

const tableHeadStyle = {
  ...ADMIN_TABLE_HEAD_CELL_STYLE,
  fontSize: 12,
  color: "#4b5563",
  fontWeight: 600,
};

const tableCellStyle = {
  ...ADMIN_TABLE_CELL_STYLE,
  fontSize: 13,
  color: "#4b5563",
  verticalAlign: "top",
};

const tableCellStrongStyle = {
  ...ADMIN_TABLE_CELL_STRONG_STYLE,
  fontSize: 13,
  color: "#374151",
  fontWeight: 500,
  verticalAlign: "top",
};
