// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardCards from "../components/DashboardCards";
import { auth, db } from "../firebase/firebaseConfig";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  getDocs,
} from "firebase/firestore";
import {
  FaCalendarCheck,
  FaList,
  FaFlag,
  FaUserPlus,
  FaBoxOpen,
  FaExchangeAlt,
  FaArrowRight,
  FaSyncAlt,
  FaStar,
  FaTrophy,
  FaCrown,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  buildRatingSummaries,
  extractTradeRatingRows,
  fetchRatingDocuments,
  formatRatingValue,
} from "../utils/ratings";

// --- Styling ---
const PRIMARY_COLOR = "#de638a";
const CARD_STYLE = {
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
};
const INSIGHT_CARD_HEIGHT = 320;
const RANKING_FILTERS = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "overall", label: "Overall" },
];

function formatShortDate(value) {
  if (!value) return "N/A";
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

function formatDateTime(value) {
  if (!value) return "Unknown time";
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (isNaN(d.getTime())) return "Unknown time";
    return d.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Unknown time";
  }
}

function toMillis(value) {
  if (!value) return 0;
  try {
    if (value?.toDate) return value.toDate().getTime();
    if (value?.seconds) return value.seconds * 1000;
    const d = new Date(value);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

function normalizeReportStatus(status) {
  return (status || "pending").toString().trim().toLowerCase();
}

function getStartOfMonthMillis(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function getStartOfWeekMillis(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start.getTime();
}

function getUserDisplayName(data = {}, fallback = "User") {
  return (
    data.username ||
    data.displayName ||
    data.fullName ||
    data.name ||
    [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ||
    fallback
  );
}

function SectionHeader({ icon, title, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 15,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "#fff1f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
            color: PRIMARY_COLOR,
          }}
        >
          {icon}
        </div>
        <h4 style={{ margin: 0, fontSize: 18, color: "#222", fontWeight: 700 }}>
          {title}
        </h4>
      </div>

      {right}
    </div>
  );
}

// ----------------------------------------------------------------------
// UPCOMING EVENTS CARD
// ----------------------------------------------------------------------
const EventSummarySection = () => {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pendingEventsCount, setPendingEventsCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const now = new Date();

    const upcomingQuery = query(
      collection(db, "events"),
      where("date", ">=", now),
      orderBy("date", "asc"),
      limit(3)
    );

    const unsubUpcoming = onSnapshot(upcomingQuery, (snap) => {
      const approvedOrVisible = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((ev) => {
          const status = (ev.status || "").toString().trim().toLowerCase();
          return status !== "pending";
        });

      setUpcomingEvents(approvedOrVisible);
    });

    const pendingQuery = query(
      collection(db, "events"),
      where("status", "==", "pending")
    );

    const unsubPending = onSnapshot(pendingQuery, (snap) => {
      setPendingEventsCount(snap.size);
    });

    return () => {
      unsubUpcoming();
      unsubPending();
    };
  }, []);

  return (
    <div
      style={{
        ...CARD_STYLE,
        padding: 22,
        height: INSIGHT_CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SectionHeader
        icon={<FaCalendarCheck size={18} />}
        title="Upcoming Events"
        right={
          <button
            onClick={() => navigate("/admin/events")}
            style={{
              border: "none",
              background: "#fff1f6",
              color: PRIMARY_COLOR,
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Manage
          </button>
        }
      />

      <div
        style={{
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            background: "#fef3c7",
            color: "#92400e",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
          }}
        >
          {pendingEventsCount} pending approval
        </span>
      </div>

      <div
        style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}
      >
        {upcomingEvents.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {upcomingEvents.map((ev) => (
              <div
                key={ev.id}
                style={{
                  padding: "10px 12px",
                  borderLeft: `3px solid ${PRIMARY_COLOR}`,
                  background: "#fff9fb",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/admin/EventParticipants?id=${ev.id}`)}
              >
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#111827",
                  }}
                >
                  {ev.title || "Untitled event"}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  {formatShortDate(ev.date)} • {ev.location || "Online"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              border: "1px dashed #f3c0d1",
              background: "#fffafd",
              borderRadius: 12,
              padding: "18px 16px",
              color: "#6b7280",
              fontSize: 14,
            }}
          >
            No upcoming approved events.
          </div>
        )}
      </div>
    </div>
  );
};
// ----------------------------------------------------------------------
// RECENT ACTIVITY CARD
// ----------------------------------------------------------------------
const RecentActivity = () => {
  const [activities, setActivities] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const [usersSnap, postsSnap, reportsSnap, txSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(4))),
          getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(4))),
          getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(4))),
          getDocs(query(collection(db, "tradeRequests"), orderBy("createdAt", "desc"), limit(4))),
        ]);

        const userItems = usersSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            kind: "user",
            title: `@${getUserDisplayName(data, "user")} registered`,
            timestamp: data.createdAt,
            badge: "new user",
            icon: <FaUserPlus size={12} />,
            route: "/admin/users",
          };
        });

        const postItems = postsSnap.docs.map((d) => {
          const data = d.data();
          const owner =
            data.username ||
            data.ownerName ||
            data.displayName ||
            data.fullName ||
            "A user";

          return {
            id: d.id,
            kind: "post",
            title: `${owner} listed an item`,
            timestamp: data.createdAt,
            badge: "new post",
            icon: <FaBoxOpen size={12} />,
            route: "/admin/posts",
          };
        });

        const reportItems = reportsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            kind: "report",
            title: `${data.reporterName || "A user"} submitted a report`,
            timestamp: data.createdAt,
            badge: "report",
            icon: <FaFlag size={12} />,
            route: `/admin/reports/${d.id}`,
          };
        });

        const txItems = txSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            kind: "transaction",
            title: `Trade request ${d.id.slice(0, 6)} created`,
            timestamp: data.createdAt || data.updatedAt,
            badge: "transaction",
            icon: <FaExchangeAlt size={12} />,
            route: "/admin/transactions",
          };
        });

        const merged = [...userItems, ...postItems, ...reportItems, ...txItems]
          .sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp))
          .slice(0, 8);

        setActivities(merged);
      } catch (err) {
        console.error("RECENT ACTIVITY LOAD ERROR:", err);
      }
    };

    loadActivity();
  }, []);

  const getBadgeStyle = (kind) => {
    if (kind === "report") {
      return {
        background: "#fff1f2",
        color: "#be123c",
      };
    }

    if (kind === "user") {
      return {
        background: "#ecfeff",
        color: "#0f766e",
      };
    }

    if (kind === "transaction") {
      return {
        background: "#eff6ff",
        color: "#1d4ed8",
      };
    }

    return {
      background: "#ffe6f0",
      color: PRIMARY_COLOR,
    };
  };

  return (
    <div
      style={{
        ...CARD_STYLE,
        padding: 22,
        height: INSIGHT_CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SectionHeader
        icon={<FaList size={18} />}
        title="Recent Activity"
        right={
          <button
            onClick={() => navigate("/admin/reports")}
            style={{
              border: "none",
              background: "#fff1f6",
              color: PRIMARY_COLOR,
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Review
          </button>
        }
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
        {activities.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {activities.map((item) => {
              const badgeStyle = getBadgeStyle(item.kind);

              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  onClick={() => navigate(item.route)}
                  style={{
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "#fafafa",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#111827",
                          lineHeight: 1.4,
                        }}
                      >
                        {item.title}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        {formatDateTime(item.timestamp)}
                      </p>
                    </div>

                    <span
                      style={{
                        ...badgeStyle,
                        padding: "5px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.icon}
                      {item.badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              border: "1px dashed #f3c0d1",
              background: "#fffafd",
              borderRadius: 12,
              padding: "18px 16px",
              color: "#6b7280",
              fontSize: 14,
            }}
          >
            No recent activity.
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// ENGAGEMENT SNAPSHOT
// ----------------------------------------------------------------------
const EngagementSnapshot = ({ stats, loading, lastUpdated }) => {
  const items = [
    { label: "Total items", value: stats.posts },
    { label: "New today", value: stats.newToday },
    { label: "DIY tutorials", value: stats.diy },
    { label: "Events", value: stats.events },
    { label: "Pending reports", value: stats.pendingReports },
  ];

  return (
    <div
      style={{
        ...CARD_STYLE,
        padding: 22,
        height: INSIGHT_CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SectionHeader
        icon={<FaList size={18} />}
        title="Engagement Snapshot"
        right={
          <span
            style={{
              fontSize: 11,
              color: "#9ca3af",
              fontWeight: 600,
            }}
          >
            {lastUpdated ? `Updated ${lastUpdated}` : ""}
          </span>
        }
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <ul style={{ margin: 0, paddingLeft: 18, color: "#333", lineHeight: 1.8 }}>
          {items.map((it) => (
            <li key={it.label} style={{ marginBottom: 4, fontSize: 14 }}>
              <strong>{it.label}:</strong> {loading ? "…" : it.value}
            </li>
          ))}
        </ul>

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid #f1f5f9",
            fontSize: 12,
            color: "#6b7280",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <FaSyncAlt size={11} />
          Snapshot refreshes when the dashboard reloads.
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// PENDING REPORTS PANEL
// ----------------------------------------------------------------------
const PendingReportsPanel = ({ reports }) => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        ...CARD_STYLE,
        padding: "16px 18px 18px",
      }}
    >
      <SectionHeader
        icon={<FaFlag size={18} />}
        title="Pending Reports Overview"
        right={
          <button
            onClick={() => navigate("/admin/reports")}
            style={{
              border: "none",
              background: "#fff1f6",
              color: PRIMARY_COLOR,
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Open Reports
          </button>
        }
      />

      {reports.length === 0 ? (
        <div
          style={{
            border: "1px dashed #f3c0d1",
            background: "#fffafd",
            borderRadius: 12,
            padding: "18px 16px",
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          No pending reports right now.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() =>
                navigate(`/admin/reports/${report.reportDocId || report.id}`)
              }
              style={{
                border: "1px solid #f4d7e3",
                background: "#fffafb",
                borderRadius: 14,
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#111827",
                      }}
                    >
                      {report.category || "Uncategorized"} report
                    </p>
                  </div>
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    {(report.reporterName || "Unknown") + " -> " + (report.reportedName || "Unknown")}
                  </p>
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 12,
                      color: "#9ca3af",
                    }}
                  >
                    {formatDateTime(report.createdAt)}
                  </p>
                </div>

                <span
                  style={{
                    background: "#fff1f6",
                    color: PRIMARY_COLOR,
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  Pending
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// USER RATING RANKINGS
// ----------------------------------------------------------------------
const UserRatingRankings = ({ rankingsByFilter }) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("overall");
  const users = rankingsByFilter?.[activeFilter] || [];

  return (
    <div
      style={{
        ...CARD_STYLE,
        padding: "16px 18px 18px",
      }}
    >
      <SectionHeader
        icon={<FaTrophy size={18} />}
        title="User Rating Rankings"
        right={
          <button
            onClick={() => navigate("/admin/users")}
            style={{
              border: "none",
              background: "#fff1f6",
              color: PRIMARY_COLOR,
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            View Users
          </button>
        }
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        {RANKING_FILTERS.map((filter) => {
          const isActive = filter.key === activeFilter;

          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              style={{
                border: isActive ? `1px solid ${PRIMARY_COLOR}` : "1px solid #f3d5e2",
                background: isActive ? "#fff1f6" : "#fff",
                color: isActive ? PRIMARY_COLOR : "#6b7280",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                padding: "7px 12px",
                cursor: "pointer",
              }}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {users.length === 0 ? (
        <div
          style={{
            border: "1px dashed #f3c0d1",
            background: "#fffafd",
            borderRadius: 12,
            padding: "18px 16px",
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          {activeFilter === "overall"
            ? "No user ratings found yet."
            : "No user ratings found for this period yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {users.map((rankedUser, index) => (
            <div
              key={rankedUser.id}
              onClick={() => navigate(`/admin/users/${rankedUser.id}`)}
              style={{
                border: index === 0 ? "1px solid #f5d48a" : "1px solid #f4d7e3",
                background: index === 0 ? "#fff7e8" : "#fffafb",
                borderRadius: 14,
                padding: "12px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: index === 0 ? "#fde7b0" : "#fff1f6",
                    color: index === 0 ? "#9a6700" : PRIMARY_COLOR,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {index === 0 ? <FaCrown size={14} /> : `#${index + 1}`}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      #{index + 1} {rankedUser.displayName}
                    </p>
                    {index === 0 ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#9a6700",
                          background: "#fef3c7",
                          borderRadius: 999,
                          padding: "4px 8px",
                        }}
                      >
                        Top Rated
                      </span>
                    ) : null}
                  </div>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    {rankedUser.username ? `@${rankedUser.username}` : rankedUser.email}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 4,
                  justifyItems: "end",
                  minWidth: 110,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: "#fff7e8",
                    color: "#9a6700",
                    border: "1px solid #f4dfab",
                    fontSize: 12,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  <FaStar size={12} />
                  {formatRatingValue(rankedUser.ratingAverage)}
                </div>
                <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>
                  {rankedUser.ratingCount} {rankedUser.ratingCount === 1 ? "review" : "reviews"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// MAIN DASHBOARD
// ----------------------------------------------------------------------
export default function Dashboard() {
  const user = auth.currentUser;
  const userName = user?.displayName || "Admin";
  const location = useLocation();
  const [reportPosts, setReportPosts] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [ratedUsersByFilter, setRatedUsersByFilter] = useState({
    overall: [],
    month: [],
    week: [],
  });
  const [lastUpdated, setLastUpdated] = useState("");
  const [engagementStats, setEngagementStats] = useState({
    posts: 0,
    diy: 0,
    events: 0,
    newToday: 0,
    pendingReports: 0,
  });
  const [engagementLoading, setEngagementLoading] = useState(true);

  useEffect(() => {
    if (location.state?.justLoggedIn) {
      toast.success(`Welcome back, ${userName}!`, {
        position: "top-right",
        autoClose: 2500,
        theme: "colored",
      });
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, [location.state, userName]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [
          postsSnap,
          diySnap,
          eventsSnap,
          reportsSnap,
          usersSnap,
          txSnap,
          ratingRows,
        ] = await Promise.all([
          getDocs(collection(db, "posts")),
          getDocs(collection(db, "diyPosts")),
          getDocs(collection(db, "events")),
          getDocs(collection(db, "reports")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "tradeRequests")),
          fetchRatingDocuments(db),
        ]);

        const posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const usersData = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const txData = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setReportPosts(posts);

        const reportsData = reportsSnap.docs.map((d) => {
          const data = d.data();
          const embeddedId =
            typeof data?.id === "string" && data.id.trim() ? data.id.trim() : null;

          return {
            ...data,
            id: d.id,
            reportDocId: d.id,
            embeddedReportId:
              embeddedId && embeddedId !== d.id ? embeddedId : null,
          };
        });

        const pendingOnly = reportsData
          .filter((r) => normalizeReportStatus(r.status) === "pending")
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          .slice(0, 5);

        setPendingReports(pendingOnly);

        const now = Date.now();
        const dayAgo = now - 24 * 60 * 60 * 1000;

        const newToday = posts.reduce((acc, p) => {
          const ts = p?.createdAt?.seconds
            ? p.createdAt.seconds * 1000
            : p?.createdAt?.toMillis
            ? p.createdAt.toMillis()
            : null;

          if (ts && ts >= dayAgo) return acc + 1;
          return acc;
        }, 0);

        setEngagementStats({
          posts: postsSnap.size,
          diy: diySnap.size,
          events: eventsSnap.size,
          newToday,
          pendingReports: pendingOnly.length,
        });

        const allRatingRows = [...ratingRows, ...extractTradeRatingRows(txData)];
        const buildRankings = (summaries) =>
          usersData
            .map((data) => {
              const summary =
                summaries.get(String(data.id)) ||
                summaries.get(String(data.uid || ""));

              return {
                id: data.id,
                uid: data.uid || data.id,
                displayName: getUserDisplayName(data, "Unnamed"),
                username: data.username || "",
                email: data.email || "No email",
                ratingAverage: summary?.average ?? null,
                ratingCount: summary?.count || 0,
              };
            })
            .filter((data) => data.ratingAverage !== null)
            .sort((a, b) => {
              if (b.ratingAverage !== a.ratingAverage) {
                return b.ratingAverage - a.ratingAverage;
              }
              if (b.ratingCount !== a.ratingCount) {
                return b.ratingCount - a.ratingCount;
              }
              return a.displayName.localeCompare(b.displayName);
            })
            .slice(0, 8);

        const nowDate = new Date();

        setRatedUsersByFilter({
          overall: buildRankings(buildRatingSummaries(usersData, allRatingRows)),
          month: buildRankings(
            buildRatingSummaries(usersData, allRatingRows, {
              fromMillis: getStartOfMonthMillis(nowDate),
              includeUserFallback: false,
            })
          ),
          week: buildRankings(
            buildRatingSummaries(usersData, allRatingRows, {
              fromMillis: getStartOfWeekMillis(nowDate),
              includeUserFallback: false,
            })
          ),
        });

        setLastUpdated(
          new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        );
      } catch (err) {
        console.error("DASHBOARD ANALYTICS LOAD ERROR:", err);
      } finally {
        setEngagementLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const postsByType = useMemo(() => {
    const map = new Map();

    reportPosts.forEach((p) => {
      const key = p.clothingType || "Uncategorized";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    );
  }, [reportPosts]);

  const postsByDay = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const k = d.toLocaleDateString();

      days.push({
        key: k,
        name: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        value: 0,
      });
    }

    const indexOf = (k) => days.findIndex((x) => x.key === k);

    reportPosts.forEach((p) => {
      const d = p?.createdAt?.seconds
        ? new Date(p.createdAt.seconds * 1000)
        : p?.createdAt?.toDate
        ? p.createdAt.toDate()
        : null;

      if (!d) return;

      const k = d.toLocaleDateString();
      const idx = indexOf(k);

      if (idx >= 0) days[idx].value += 1;
    });

    return days.map(({ name, value }) => ({ name, value }));
  }, [reportPosts]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6fa",
        padding: "20px 24px 32px",
        display: "flex",
        justifyContent: "center",
        overflowY: "auto",
        boxSizing: "border-box",
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <div>
            <h2
              style={{
                color: PRIMARY_COLOR,
                fontWeight: 700,
                fontSize: 22,
                margin: 0,
              }}
            >
              Welcome, {userName}
            </h2>
            <p style={{ color: "#555", fontSize: 14, margin: "6px 0 0" }}>
              Overview of key metrics and system health for ClosetLoop.
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #f1f5f9",
              borderRadius: 12,
              padding: "10px 12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              fontSize: 12,
              color: "#6b7280",
              minWidth: 170,
            }}
          >
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>
              Dashboard Status
            </div>
            <div>Last updated: {lastUpdated || "—"}</div>
          </div>
        </div>

        {/* PLATFORM TOTALS */}
        <h3 style={{ color: "#333", fontWeight: 600, fontSize: 18, marginTop: 24 }}>
          Platform Totals
        </h3>

        <div>
          <DashboardCards />
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "24px 0" }} />

        {/* INSIGHTS */}
        <h3 style={{ color: "#333", fontWeight: 600, fontSize: 18 }}>
          System Insights & Reports
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 20,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <EventSummarySection />
          </div>

          <div style={{ minWidth: 0 }}>
            <RecentActivity />
          </div>

          <div style={{ minWidth: 0 }}>
            <EngagementSnapshot
              stats={engagementStats}
              loading={engagementLoading}
              lastUpdated={lastUpdated}
            />
          </div>
        </div>

        {/* PENDING REPORTS OVERVIEW */}
        <h3 style={{ color: "#333", fontWeight: 600, fontSize: 18, marginTop: 28 }}>
          Reports Overview
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <UserRatingRankings rankingsByFilter={ratedUsersByFilter} />
          </div>
          <div style={{ minWidth: 0 }}>
            <PendingReportsPanel reports={pendingReports} />
          </div>
        </div>

        {/* ANALYTICS */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "14px 18px 18px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 16,
            }}
          >
            {/* Bar Chart */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                position: "relative",
                zIndex: 10,
                isolation: "isolate",
              }}
            >
              <div
                onClick={() => navigate("/admin/posts")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  alignItems: "flex-start",
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 20,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
                    Post Type Distribution
                  </h3>
                  <p style={{ margin: "2px 0 4px", fontSize: 12, color: "#6b7280" }}>
                    Top categories by volume
                  </p>
                </div>

                <span
                  style={{
                    border: "none",
                    background: "#fff1f6",
                    color: PRIMARY_COLOR,
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: "8px 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  View Items <FaArrowRight size={10} />
                </span>
              </div>

              <div
                style={{
                  height: 260,
                  position: "relative",
                  zIndex: 1,
                  pointerEvents: "none",
                  overflow: "hidden",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={postsByType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-15}
                      textAnchor="end"
                      height={50}
                      style={{ fontSize: 10 }}
                    />
                    <YAxis allowDecimals={false} />
                    <ReTooltip />
                    <Bar dataKey="value" fill="#de638a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Line Chart */}
            <div style={{ position: "relative", zIndex: 1 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
                Daily Posts Trend
              </h3>
              <p style={{ margin: "2px 0 4px", fontSize: 12, color: "#6b7280" }}>
                Activity over the last 14 days
              </p>

              <div
                style={{
                  height: 260,
                  position: "relative",
                  zIndex: 1,
                  pointerEvents: "none",
                  overflow: "hidden",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={postsByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" style={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <ReTooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#c6e2c6"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        stroke: "#de638a",
                        strokeWidth: 2,
                        fill: "#fff",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
