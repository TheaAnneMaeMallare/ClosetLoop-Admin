import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { FaCalendarAlt, FaChartBar, FaLeaf, FaTshirt, FaUsers } from "react-icons/fa";
import { db } from "../firebase/firebaseConfig";
import AdminStatCard, {
  ADMIN_STAT_CARD_COLORS,
  AdminStatGrid,
} from "./AdminStatCard";

function normalizeReportStatus(status) {
  return (status || "").toString().trim().toLowerCase();
}

export default function DashboardCards({ setPendingReports }) {
  const [counts, setCounts] = useState({
    users: 0,
    listedItems: 0,
    events: 0,
    upcyclingIdeas: 0,
    reports: 0,
    pendingReports: 0,
    verifiedReports: 0,
    dismissedReports: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [usersSnap, postsSnap, eventsSnap, diySnap, reportsSnap] =
          await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collection(db, "posts")),
            getDocs(collection(db, "events")),
            getDocs(collection(db, "diyPosts")),
            getDocs(collection(db, "reports")),
          ]);

        const reportsData = reportsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const pendingReports = reportsData.filter(
          (r) => normalizeReportStatus(r.status || "pending") === "pending"
        ).length;
        const verifiedReports = reportsData.filter(
          (r) => normalizeReportStatus(r.status) === "verified"
        ).length;
        const dismissedReports = reportsData.filter(
          (r) => normalizeReportStatus(r.status) === "dismissed"
        ).length;

        setCounts({
          users: usersSnap.size,
          listedItems: postsSnap.size,
          events: eventsSnap.size,
          upcyclingIdeas: diySnap.size,
          reports: reportsSnap.size,
          pendingReports,
          verifiedReports,
          dismissedReports,
        });

        if (setPendingReports) {
          setPendingReports({
            reports: pendingReports || 0,
            eventApprovals: 0,
          });
        }
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCounts();
  }, [setPendingReports]);

  return (
    <AdminStatGrid>
      <AdminStatCard
        title="Total Users"
        value={loading ? "..." : counts.users}
        description="Registered ClosetLoop accounts"
        icon={<FaUsers size={18} />}
        accentColor={ADMIN_STAT_CARD_COLORS.primary.accent}
        softBackgroundColor={ADMIN_STAT_CARD_COLORS.primary.soft}
        onClick={() => navigate("/admin/users")}
      />

      <AdminStatCard
        title="Listed Items"
        value={loading ? "..." : counts.listedItems}
        description="Items currently listed in the app"
        icon={<FaTshirt size={18} />}
        accentColor={ADMIN_STAT_CARD_COLORS.info.accent}
        softBackgroundColor={ADMIN_STAT_CARD_COLORS.info.soft}
        onClick={() => navigate("/admin/posts")}
      />

      <AdminStatCard
        title="Events"
        value={loading ? "..." : counts.events}
        description="Community swap and eco events"
        icon={<FaCalendarAlt size={18} />}
        accentColor={ADMIN_STAT_CARD_COLORS.verified.accent}
        softBackgroundColor={ADMIN_STAT_CARD_COLORS.verified.soft}
        onClick={() => navigate("/admin/events")}
      />

      <AdminStatCard
        title="Upcycling Ideas"
        value={loading ? "..." : counts.upcyclingIdeas}
        description="DIY tutorials and ideas"
        icon={<FaLeaf size={18} />}
        accentColor={ADMIN_STAT_CARD_COLORS.leaf.accent}
        softBackgroundColor={ADMIN_STAT_CARD_COLORS.leaf.soft}
        onClick={() => navigate("/admin/diy-posts")}
      />

      <AdminStatCard
        title="Total Reports"
        value={loading ? "..." : counts.reports}
        description={
          loading
            ? "Loading report totals"
            : `${counts.pendingReports} pending • ${counts.verifiedReports} verified • ${counts.dismissedReports} dismissed`
        }
        icon={<FaChartBar size={18} />}
        accentColor={ADMIN_STAT_CARD_COLORS.primary.accent}
        softBackgroundColor={ADMIN_STAT_CARD_COLORS.primary.soft}
        onClick={() => navigate("/admin/reports")}
      />
    </AdminStatGrid>
  );
}
