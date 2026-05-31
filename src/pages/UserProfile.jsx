import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { FaArrowLeft, FaUserCircle, FaBoxOpen, FaTools, FaStar } from "react-icons/fa";
import {
  extractTradeRatingRows,
  fetchRatingDocuments,
  formatRatingValue,
  getRatingSummaryForUser,
} from "../utils/ratings";

const PRIMARY = "#de638a";

function formatDate(value) {
  if (!value) return "—";
  try {
    let d;

    if (value?.toDate) d = value.toDate();
    else if (value?.seconds) d = new Date(value.seconds * 1000);
    else d = new Date(value);

    if (isNaN(d.getTime())) return "—";

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    let d;

    if (value?.toDate) d = value.toDate();
    else if (value?.seconds) d = new Date(value.seconds * 1000);
    else d = new Date(value);

    if (isNaN(d.getTime())) return "—";

    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
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

function firstValue(...values) {
  return values.find((value) => {
    if (value === null || value === undefined) return false;
    return value.toString().trim() !== "";
  });
}

function firstTimestamp(source, keys = []) {
  if (!source) return null;

  for (const key of keys) {
    const value = source?.[key];
    if (toMillis(value) > 0) return value;
  }

  return null;
}

function formatRemainingTime(value) {
  const ms = toMillis(value) - Date.now();

  if (ms <= 0) return "Expired";

  const totalHours = Math.ceil(ms / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0 && hours > 0) {
    return `${days}d ${hours}h left`;
  }

  if (days > 0) {
    return `${days}d left`;
  }

  return `${Math.max(1, hours)}h left`;
}

function prettyTransactionStatus(status) {
  const s = normalizeStatus(status);

  if (s === "pending") return "Pending";
  if (s === "accepted") return "Accepted";
  if (s === "to receive") return "To Receive";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  if (s === "rejected") return "Rejected";

  return status || "Unknown";
}

function inferTimelineEvent(rawEvent, tx) {
  if (!rawEvent || typeof rawEvent !== "object") return null;

  const eventType = (rawEvent.type || "").toString().trim().toLowerCase();
  const at =
    firstTimestamp(rawEvent, [
      "at",
      "timestamp",
      "time",
      "date",
      "createdAt",
      "updatedAt",
      "loggedAt",
      "recordedAt",
    ]) ||
    firstTimestamp(
      tx,
      eventType === "transaction_confirmed"
        ? ["acceptedAt", "approvedAt", "updatedAt"]
        : eventType === "arrangement_saved" ||
            eventType === "proof_uploaded" ||
            eventType === "proposal_agreed" ||
            eventType === "arrangement_rejected" ||
            eventType === "report_submitted"
          ? ["meetUpdatedAt", "lastActionAt", "updatedAt"]
          : eventType === "arrangement_agreed"
            ? ["meetUpdatedAt", "lastActionAt", "updatedAt"]
            : eventType === "receive_confirmed"
              ? ["lastAcknowledgedAt", "lastActionAt", "updatedAt"]
              : eventType === "transaction_completed"
                ? ["completedAt", "lastAcknowledgedAt", "updatedAt"]
                : eventType === "transaction_cancelled"
                  ? ["cancelledAt", "updatedAt"]
                  : eventType === "transaction_rejected"
                    ? ["rejectedAt", "updatedAt"]
                    : ["updatedAt"]
    );

  if (toMillis(at) <= 0) return null;

  const rawState = firstValue(
    rawEvent.key,
    rawEvent.status,
    rawEvent.state,
    rawEvent.type,
    rawEvent.event,
    rawEvent.label,
    rawEvent.title,
    rawEvent.name,
    rawEvent.action
  );
  const state = normalizeStatus(rawState);
  const lowerState = (rawState || "").toString().trim().toLowerCase();

  if (eventType === "transaction_confirmed") {
    return {
      key: "accepted",
      label: rawEvent.title || rawEvent.label || "Transaction confirmed",
      at,
      tone: "info",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "The request was confirmed and moved to the arrangement stage.",
    };
  }

  if (eventType === "arrangement_agreed") {
    return {
      key: "to-receive",
      label: rawEvent.title || rawEvent.label || "Arrangement agreed",
      at,
      tone: "info",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "Both users agreed on the arrangement details and the transaction moved to Receive.",
    };
  }

  if (eventType === "receive_confirmed") {
    return {
      key: "received",
      label: rawEvent.title || rawEvent.label || "Receive step submitted",
      at,
      tone: "success",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "A user confirmed the receive step and submitted proof.",
    };
  }

  if (eventType === "transaction_completed") {
    return {
      key: "completed",
      label: rawEvent.title || rawEvent.label || "Transaction completed",
      at,
      tone: "success",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "Both users finished the transaction successfully.",
    };
  }

  if (eventType === "transaction_cancelled") {
    return {
      key: "cancelled",
      label: rawEvent.title || rawEvent.label || "Transaction cancelled",
      at,
      tone: "danger",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "The transaction was cancelled.",
    };
  }

  if (eventType === "transaction_rejected") {
    return {
      key: "rejected",
      label: rawEvent.title || rawEvent.label || "Request rejected",
      at,
      tone: "danger",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "The request was rejected.",
    };
  }

  if (
    eventType === "arrangement_saved" ||
    eventType === "proof_uploaded" ||
    eventType === "proposal_agreed" ||
    eventType === "arrangement_rejected" ||
    eventType === "report_submitted"
  ) {
    return {
      key: eventType,
      label: rawEvent.title || rawEvent.label || "Arrangement activity",
      at,
      tone: eventType === "arrangement_rejected" ? "danger" : "info",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "Arrangement-related transaction activity was recorded.",
    };
  }

  if (
    state === "pending" ||
    lowerState.includes("created") ||
    lowerState.includes("submitted") ||
    lowerState.includes("requested")
  ) {
    return {
      key: "created",
      label: rawEvent.label || rawEvent.title || "Request created",
      at,
      tone: "neutral",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        `${rawEvent.actorName || rawEvent.userName || "A user"} submitted the transaction request.`,
    };
  }

  if (state === "accepted") {
    return {
      key: "accepted",
      label: rawEvent.label || rawEvent.title || "Request accepted",
      at,
      tone: "info",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "The request was accepted by the other party.",
    };
  }

  if (lowerState.includes("meet")) {
    return {
      key: "to-meet",
      label: rawEvent.label || rawEvent.title || "Ready to meet",
      at,
      tone: "info",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "The transaction moved to the meet-up stage.",
    };
  }

  if (state === "to receive" || lowerState.includes("receive")) {
    return {
      key: "to-receive",
      label:
        rawEvent.label ||
        rawEvent.title ||
        (lowerState.includes("received") ? "Item received" : "Marked ready to receive"),
      at,
      tone: lowerState.includes("received") ? "success" : "info",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        (lowerState.includes("received")
          ? "The item was marked as received."
          : "The transaction moved to the receiving stage."),
    };
  }

  if (state === "completed") {
    return {
      key: "completed",
      label: rawEvent.label || rawEvent.title || "Transaction completed",
      at,
      tone: "success",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "The transaction was completed successfully.",
    };
  }

  if (state === "cancelled") {
    return {
      key: "cancelled",
      label: rawEvent.label || rawEvent.title || "Transaction cancelled",
      at,
      tone: "danger",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "The transaction was cancelled.",
    };
  }

  if (state === "rejected") {
    return {
      key: "rejected",
      label: rawEvent.label || rawEvent.title || "Request rejected",
      at,
      tone: "danger",
      detail:
        rawEvent.detail ||
        rawEvent.description ||
        "The request was rejected.",
    };
  }

  return {
    key: rawState || "activity",
    label: rawEvent.label || rawEvent.title || "Transaction activity",
    at,
    tone: "info",
    detail:
      rawEvent.detail ||
      rawEvent.description ||
      "Recorded transaction activity.",
  };
}

function dedupeTimelineEvents(events) {
  const seen = new Set();

  return events.filter((event) => {
    const signature = `${event.key}:${toMillis(event.at)}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function getTransactionStatusStyle(status) {
  const s = normalizeStatus(status);

  if (s === "completed") {
    return { background: "#dcfce7", color: "#166534" };
  }

  if (s === "pending") {
    return { background: "#fef3c7", color: "#92400e" };
  }

  if (s === "accepted") {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }

  if (s === "to receive") {
    return { background: "#ede9fe", color: "#6d28d9" };
  }

  if (s === "cancelled" || s === "rejected") {
    return { background: "#fee2e2", color: "#b91c1c" };
  }

  return { background: "#f3f4f6", color: "#374151" };
}

function buildTransactionTimeline(tx) {
  if (!tx) return [];

  const status = normalizeStatus(tx.status);
  const derivedEvents = [
    {
      key: "created",
      label: "Request created",
      at: firstTimestamp(tx, [
        "createdAt",
        "dateCreated",
        "transactionDate",
        "requestedAt",
        "submittedAt",
      ]),
      tone: "neutral",
      detail: "The transaction request was submitted.",
    },
    {
      key: "accepted",
      label: "Request accepted",
      at: firstTimestamp(tx, [
        "acceptedAt",
        "approvedAt",
        "confirmedRequestAt",
        "requestAcceptedAt",
        "updatedAt",
      ]),
      tone: "info",
      detail: "The request was accepted by the other party.",
    },
    {
      key: "to-meet",
      label: "Ready to meet",
      at: firstTimestamp(tx, [
        "toMeetAt",
        "meetAt",
        "meetingAt",
        "meetupAt",
        "scheduledMeetAt",
        "readyToMeetAt",
      ]),
      tone: "info",
      detail: "The transaction moved to the meet-up stage.",
    },
    {
      key: "to-receive",
      label: "Marked ready to receive",
      at: firstTimestamp(tx, [
        "toReceiveAt",
        "readyToReceiveAt",
        "claimedAt",
        "receiveStageAt",
        "meetUpdatedAt",
        "lastActionAt",
      ]),
      tone: "info",
      detail: "The transaction moved to the receiving stage.",
    },
    {
      key: "received",
      label: "Item received",
      at: firstTimestamp(tx, [
        "receivedAt",
        "dateReceived",
        "itemReceivedAt",
        "pickupConfirmedAt",
        "lastAcknowledgedAt",
      ]),
      tone: "success",
      detail: "The item was marked as received.",
    },
    {
      key: "completed",
      label: "Transaction completed",
      at: firstTimestamp(tx, [
        "completedAt",
        "confirmedAt",
        "finishedAt",
        "doneAt",
        "lastAcknowledgedAt",
        ...(tx?.ownerConfirmedReceived === true && tx?.requesterConfirmedReceived === true
          ? ["updatedAt"]
          : []),
      ]),
      tone: "success",
      detail: "The transaction was completed successfully.",
    },
    {
      key: "cancelled",
      label: "Transaction cancelled",
      at: firstTimestamp(tx, ["cancelledAt", "canceledAt", "dateCancelled"]),
      tone: "danger",
      detail: "The transaction was cancelled.",
    },
    {
      key: "rejected",
      label: "Request rejected",
      at: firstTimestamp(tx, ["rejectedAt", "declinedAt", "dateRejected"]),
      tone: "danger",
      detail: "The request was rejected.",
    },
  ].filter((event) => toMillis(event.at) > 0);

  const rawHistorySources = [
    tx.historyEntries,
    tx.statusHistory,
    tx.timeline,
    tx.history,
    tx.activityLog,
    tx.events,
  ];
  const recordedEvents = rawHistorySources
    .flatMap((source) => (Array.isArray(source) ? source : []))
    .map((event) => inferTimelineEvent(event, tx))
    .filter(Boolean);

  const events = dedupeTimelineEvents([...recordedEvents, ...derivedEvents]);

  const hasTerminalEvent =
    (status === "completed" && events.some((event) => event.key === "completed")) ||
    (status === "cancelled" && events.some((event) => event.key === "cancelled")) ||
    (status === "rejected" && events.some((event) => event.key === "rejected")) ||
    (status === "accepted" && events.some((event) => event.key === "accepted")) ||
    (status === "to receive" &&
      events.some((event) => event.key === "to-receive" || event.key === "received"));

  const updatedAtMs = toMillis(tx.updatedAt);
  const createdAtMs = toMillis(
    firstTimestamp(tx, [
      "createdAt",
      "dateCreated",
      "transactionDate",
      "requestedAt",
      "submittedAt",
    ])
  );

  if (updatedAtMs > 0 && updatedAtMs !== createdAtMs && !hasTerminalEvent) {
    events.push({
      key: "status-update",
      label: `Status updated to ${prettyTransactionStatus(tx.status)}`,
      at: tx.updatedAt,
      tone:
        status === "completed"
          ? "success"
          : status === "cancelled" || status === "rejected"
            ? "danger"
            : "info",
      detail: "Latest recorded transaction activity.",
    });
  }

  return events.sort((a, b) => toMillis(a.at) - toMillis(b.at));
}

function getAccountStatusMeta(status) {
  const normalized = (status || "").toString().trim().toLowerCase();

  if (normalized === "banned" || normalized === "disabled") {
    return {
      bg: "#fdf2f7",
      color: "#8f2444",
      border: "1px solid #f6c3d4",
      label: "Banned",
    };
  }

  if (normalized === "suspended") {
    return {
      bg: "#f3f4f6",
      color: "#111827",
      border: "1px solid #d1d5db",
      label: "Suspended",
    };
  }

  if (normalized === "warned") {
    return {
      bg: "#fdf0f5",
      color: PRIMARY,
      border: "1px solid #f6c3d4",
      label: "Warned",
    };
  }

  return {
    bg: "rgba(198,226,198,0.28)",
    color: "#2f6b4f",
    border: "1px solid rgba(198,226,198,0.9)",
    label: "Active",
  };
}

function normalizeStatus(status) {
  const s = (status || "").toString().trim().toLowerCase();

  if (s.includes("to confirm")) return "pending";
  if (s === "pending") return "pending";
  if (s.includes("accept")) return "accepted";
  if (s.includes("to receive") || s === "toreceive") return "to receive";
  if (s.includes("complete")) return "completed";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("reject")) return "rejected";

  return s || "unknown";
}

function normalizeReportStatus(status) {
  return (status || "pending").toString().trim().toLowerCase();
}

function getStatusBadgeStyle(status) {
  const s = normalizeReportStatus(status);

  if (s === "verified") {
    return {
      background: "rgba(198,226,198,0.28)",
      color: "#2f6b4f",
      border: "1px solid rgba(198,226,198,0.9)",
    };
  }

  if (s === "dismissed") {
    return {
      background: "#fdecef",
      color: "#9f274d",
      border: "1px solid #f7c8d4",
    };
  }

  if (s === "pending") {
    return {
      background: "#fff7e6",
      color: "#9a6700",
      border: "1px solid #f4dfab",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #e5e7eb",
  };
}

function getActionBadgeStyle(action) {
  const a = (action || "").toString().trim().toLowerCase();

  if (a.includes("suspend")) {
    return {
      background: "#f3f4f6",
      color: "#111827",
      border: "1px solid #d1d5db",
    };
  }

  if (a.includes("warn")) {
    return {
      background: "#fdf0f5",
      color: PRIMARY,
      border: "1px solid #f6c3d4",
    };
  }

  if (a.includes("dismiss")) {
    return {
      background: "#fdecef",
      color: "#9f274d",
      border: "1px solid #f7c8d4",
    };
  }

  if (a.includes("verify")) {
    return {
      background: "rgba(198,226,198,0.28)",
      color: "#2f6b4f",
      border: "1px solid rgba(198,226,198,0.9)",
    };
  }

  return {
    background: "#f9fafb",
    color: "#374151",
    border: "1px solid #e5e7eb",
  };
}

function getReportingAccessStatus(user) {
  const restrictedUntil = user?.reportRestrictedUntil || null;
  const restrictedUntilMs = toMillis(restrictedUntil);
  const isActive =
    restrictedUntilMs > Date.now() || user?.reportingDisabled === true;

  return {
    isActive,
    restrictedUntil,
    reason:
      user?.reportRestrictionReason ||
      user?.lastReportRestrictionReason ||
      "Repeated invalid reports",
    label: isActive ? "Report Restricted" : "Reporting Open",
  };
}

function getTradeAccessStatus(user) {
  const restrictedUntil =
    user?.tradeSuspendedUntil ||
    user?.tradeRestrictedUntil ||
    user?.tradingSuspendedUntil ||
    null;
  const restrictedUntilMs = toMillis(restrictedUntil);
  const isActive =
    restrictedUntilMs > Date.now() || user?.tradeLimitedFeatures === true;

  return {
    isActive,
    restrictedUntil,
    reason:
      user?.tradeRestrictionReason ||
      user?.lastTradeRestrictionReason ||
      "Trading privileges limited",
    label: isActive ? "Trade Restricted" : "Trading Open",
  };
}

function SummaryCard({
  label,
  value,
  accent = PRIMARY,
  softBg = "#fdf2f7",
  onClick,
}) {
  const interactive = typeof onClick === "function";

  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "12px 14px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        border: "1px solid #eef1f4",
        position: "relative",
        overflow: "hidden",
        cursor: interactive ? "pointer" : "default",
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
          fontSize: 22,
          lineHeight: 1.05,
          fontWeight: 800,
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? PRIMARY : "#ddd"}`,
        background: active ? PRIMARY : "#fff",
        color: active ? "#fff" : "#374151",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px dashed #e5e7eb",
        borderRadius: 12,
        padding: "18px 14px",
        color: "#6b7280",
        fontSize: 13,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [diyPosts, setDiyPosts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [allReports, setAllReports] = useState([]);
  const [ratingSummary, setRatingSummary] = useState({
    average: null,
    count: 0,
    source: "user",
  });
  const [loading, setLoading] = useState(true);

  const activeTab = searchParams.get("tab") || "overview";

  useEffect(() => {
    if (selectedTransaction) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [selectedTransaction]);

  useEffect(() => {
    if (!id) return;

    const loadAll = async () => {
      try {
        const ref = doc(db, "users", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          alert("User not found.");
          navigate("/admin/users");
          return;
        }

        const userData = snap.data();
        const uid = userData.uid || id;
        const resolvedUser = { id, uid, ...userData };
        setUser(resolvedUser);

        const [postsSnap, diySnap, txSnap, reportsSnap, ratingRows] = await Promise.all([
          getDocs(collection(db, "posts")),
          getDocs(collection(db, "diyPosts")),
          getDocs(collection(db, "tradeRequests")),
          getDocs(collection(db, "reports")),
          fetchRatingDocuments(db),
        ]);

        const postRows = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const diyRows = diySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const txRows = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const reportRows = reportsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const matchedPosts = postRows.filter((p) =>
          [
            p.ownerUid,
            p.ownerId,
            p.userId,
            p.userID,
            p.uid,
            p.createdBy,
          ]
            .filter(Boolean)
            .includes(uid)
        );

        const matchedDiy = diyRows.filter((p) =>
          [
            p.ownerUid,
            p.ownerId,
            p.userId,
            p.userID,
            p.uid,
            p.createdBy,
          ]
            .filter(Boolean)
            .includes(uid)
        );

        const matchedTransactions = txRows.filter((t) =>
          [
            t.userId,
            t.userID,
            t.uid,
            t.ownerUid,
            t.ownerId,
            t.createdBy,
            t.requesterUid,
            t.requesterId,
            t.receiverUid,
            t.receiverId,
            t.senderUid,
            t.senderId,
            t.traderUid,
            t.traderId,
            t.userAUid,
            t.userBUid,
          ]
            .filter(Boolean)
            .includes(uid)
        );

        setPosts(matchedPosts);
        setDiyPosts(matchedDiy);
        setTransactions(matchedTransactions);
        setAllReports(reportRows);
        setRatingSummary(
          getRatingSummaryForUser(resolvedUser, [
            ...ratingRows,
            ...extractTradeRatingRows(txRows),
          ])
        );
      } catch (err) {
        console.error("PROFILE ERR:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [id, navigate]);

  const userUid = user?.uid || user?.id || id || "";

  const reportsReceived = useMemo(() => {
    if (!userUid) return [];

    return allReports
      .filter((r) =>
        [
          r.reportedUserId,
          r.reportedUid,
          r.targetUserId,
          r.targetUid,
          r.userId,
        ]
          .filter(Boolean)
          .includes(userUid)
      )
      .sort((a, b) => {
        const aMs = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const bMs = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return bMs - aMs;
      });
  }, [allReports, userUid]);

  const reportsSubmitted = useMemo(() => {
    if (!userUid) return [];

    return allReports
      .filter((r) =>
        [r.reporterId, r.reporterUid].filter(Boolean).includes(userUid)
      )
      .sort((a, b) => {
        const aMs = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const bMs = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return bMs - aMs;
      });
  }, [allReports, userUid]);

  const cancelledTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const s = normalizeStatus(t.status);
      return s === "cancelled" || s === "rejected";
    });
  }, [transactions]);

  const selectedTransactionTimeline = useMemo(
    () => buildTransactionTimeline(selectedTransaction),
    [selectedTransaction]
  );

  const pendingCount = useMemo(
    () => transactions.filter((t) => normalizeStatus(t.status) === "pending").length,
    [transactions]
  );

  const acceptedCount = useMemo(
    () => transactions.filter((t) => normalizeStatus(t.status) === "accepted").length,
    [transactions]
  );

  const toReceiveCount = useMemo(
    () =>
      transactions.filter((t) => normalizeStatus(t.status) === "to receive")
        .length,
    [transactions]
  );

  const completedCount = useMemo(
    () =>
      transactions.filter((t) => normalizeStatus(t.status) === "completed").length,
    [transactions]
  );

  const cancelledCount = cancelledTransactions.length;

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  const openTransaction = (transaction) => {
    if (!transaction?.id) return;
    navigate(`/admin/transactions?transactionId=${encodeURIComponent(transaction.id)}`);
  };

  const renderTransactionsSection = () => (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: 18,
        boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
        Transaction History ({transactions.length})
      </h2>

      <div style={{ marginTop: 14 }}>
        {transactions.length === 0 ? (
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            No transaction history yet.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {transactions.map((t) => {
              const itemName =
                t.itemName ||
                t.postTitle ||
                t.itemTitle ||
                t.title ||
                t.productName ||
                t.requestedItemName ||
                "Unnamed item";

              const partner =
                t.partnerName ||
                t.otherUserName ||
                t.traderName ||
                t.receiverName ||
                t.requesterName ||
                t.ownerName ||
                "Unknown user";

              const method =
                t.method ||
                t.meetupMethod ||
                t.deliveryMethod ||
                "â€”";

              const status = normalizeStatus(t.status);
              const displayStatus =
                status === "pending"
                  ? "Pending"
                  : status === "accepted"
                    ? "Accepted"
                    : status === "to receive"
                      ? "To Receive"
                      : status === "completed"
                        ? "Completed"
                        : status === "cancelled"
                          ? "Cancelled"
                          : status === "rejected"
                            ? "Rejected"
                            : t.status || "Unknown";

              const txDate = formatDate(
                t.createdAt || t.updatedAt || t.dateCreated || t.transactionDate
              );

              return (
                <div
                  key={t.id}
                  onClick={() => openTransaction(t)}
                  style={{
                    border: "1px solid #f1f1f1",
                    borderRadius: 10,
                    padding: "12px 14px",
                    background: "#fafafa",
                    cursor: "pointer",
                    transition: "transform 0.18s ease, box-shadow 0.18s ease",
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
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {itemName}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        Transaction ID: {t.id}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        Partner: {partner}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        Method: {method}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        Date: {txDate}
                      </p>
                    </div>

                    <div
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        ...getTransactionStatusStyle(t.status),
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayStatus}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderReportCard = (report, mode = "received") => {
    const reviewStatus = report.reviewStatus || report.status || "pending";
    const adminAction = report.adminAction || "No action yet";
    const counterpartName =
      mode === "received"
        ? report.reporterName || report.reporterId || "Unknown reporter"
        : report.reportedName || report.reportedUserId || "Unknown target";

    const counterpartLabel =
      mode === "received" ? "Reported by" : "Target";

    return (
      <div
        key={report.id}
        style={{
          border: "1px solid #f1f1f1",
          borderRadius: 12,
          padding: "12px 14px",
          background: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: 14,
                color: "#111827",
              }}
            >
              {report.category || "Uncategorized Report"}
            </p>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Report ID: {report.id}
            </p>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              {counterpartLabel}: {counterpartName}
            </p>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Type: {report.type || "—"}
            </p>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
                lineHeight: 1.45,
              }}
            >
              Details: {report.details || "—"}
            </p>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Submitted: {formatDateTime(report.createdAt)}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                ...getStatusBadgeStyle(reviewStatus),
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "capitalize",
                whiteSpace: "nowrap",
              }}
            >
              {reviewStatus}
            </span>

            <span
              style={{
                ...getActionBadgeStyle(adminAction),
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {adminAction}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderCancellationCard = (t) => {
    const itemName =
      t.itemName ||
      t.postTitle ||
      t.itemTitle ||
      t.title ||
      t.productName ||
      t.requestedItemName ||
      "Unnamed item";

    const partner =
      t.partnerName ||
      t.otherUserName ||
      t.traderName ||
      t.receiverName ||
      t.requesterName ||
      t.ownerName ||
      "Unknown user";

    const method = t.method || t.meetupMethod || t.deliveryMethod || "—";

    const status = normalizeStatus(t.status);
    const displayStatus =
      status === "cancelled"
        ? "Cancelled"
        : status === "rejected"
        ? "Rejected"
        : t.status || "Unknown";

    const txDate = formatDate(
      t.createdAt || t.updatedAt || t.dateCreated || t.transactionDate
    );

    return (
      <div
        key={t.id}
        onClick={() => openTransaction(t)}
        style={{
          border: "1px solid #f1f1f1",
          borderRadius: 12,
          padding: "12px 14px",
          background: "#fafafa",
          cursor: "pointer",
        }}
      >
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
            <p
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: 14,
                color: "#111827",
              }}
            >
              {itemName}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Transaction ID: {t.id}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Partner: {partner}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Method: {method}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Date: {txDate}
            </p>
          </div>

          <div
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: "#ffe8f0",
              color: PRIMARY,
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {displayStatus}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>Loading profile…</div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>User not found.</div>
    );
  }

  const name = user.displayName || user.fullName || user.username || "Unnamed";
  const username = user.username || null;
  const email = user.email || "—";
  const joined = formatDate(user.createdAt);

  const photo = user.photoURL || null;
  const barangay = user.location?.barangay || "—";
  const municipality = user.location?.municipality || "—";
  const region = user.location?.region || "—";

  const warningCount = Number(user.warningCount || 0);
  const accountStatus = user.accountStatus || (user.disabled ? "disabled" : "active");
  const accountStatusMeta = getAccountStatusMeta(accountStatus);
  const suspensionTimeLeft =
    accountStatus === "suspended" ? formatRemainingTime(user.suspendedUntil) : null;
  const lastEnforcementReason = user.lastEnforcementReason || "—";
  const lastEnforcementAt = formatDateTime(user.lastEnforcementAt);
  const bannedAt = formatDateTime(user.bannedAt);
  const forceLogoutAt = formatDateTime(user.forceLogoutAt);
  const sessionInvalidatedAt = formatDateTime(user.sessionInvalidatedAt);
  const ratingDisplay = formatRatingValue(ratingSummary.average);
  const ratingCount = ratingSummary.count || 0;
  const reportingAccessStatus = getReportingAccessStatus(user);
  const tradeAccessStatus = getTradeAccessStatus(user);
  const statusHeadline =
    accountStatus === "suspended"
      ? "Account temporarily suspended"
      : accountStatus === "banned" || accountStatus === "disabled"
      ? "Account permanently banned"
      : accountStatus === "warned"
      ? "Account has an active warning"
      : "Account in good standing";
  const statusMessage =
    accountStatus === "suspended"
      ? `Suspended until ${formatDateTime(user.suspendedUntil)}.`
      : accountStatus === "banned" || accountStatus === "disabled"
      ? `Banned on ${bannedAt}. Access should remain blocked unless an admin reverses the action.`
      : accountStatus === "warned"
      ? "This user currently has an active warning on record."
      : "No active account restriction is currently applied.";

  return (
    <div
      style={{
        background: "#f5f6fa",
        minHeight: "100vh",
        padding: "20px 24px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
  style={{
    width: "100%",
    maxWidth: 1160,
    display: "grid",
    gap: 16,
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
      fontSize: 14,
      fontWeight: 800,
    }}
  >
    <button
      onClick={() => navigate("/admin/users")}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        color: "#6b7280",
        fontSize: 14,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      Users
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
      {name}
    </span>
  </div>

  <button
    onClick={() => navigate("/admin/users")}
    style={{
      background: "#fff",
      border: "1px solid #d1d5db",
      color: "#374151",
      borderRadius: 10,
      padding: "9px 14px",
      fontSize: 13,
      fontWeight: 800,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}
  >
    <FaArrowLeft size={12} /> Back to Users
  </button>
</div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "22px 24px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: "50%",
                overflow: "hidden",
                background: "#fff0f6",
                border: `3px solid ${PRIMARY}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <FaUserCircle size={60} color={PRIMARY} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#111",
                }}
              >
                {name}
              </h1>

              {username && (
                <p
                  style={{
                    margin: "2px 0 4px",
                    fontSize: 14,
                    color: "#6b7280",
                  }}
                >
                  @{username}
                </p>
              )}

              <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>
                {email}
              </p>

              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                Joined: {joined}
              </p>

              <div
                style={{
                  marginTop: 9,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#fff7e8",
                  color: "#9a6700",
                  border: "1px solid #f4dfab",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <FaStar size={12} />
                {ratingDisplay}
                <span style={{ color: "#6b7280", fontWeight: 600 }}>
                  ({ratingCount} {ratingCount === 1 ? "rating" : "ratings"})
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <SummaryCard label="Posts" value={posts.length} />
          <SummaryCard
            label="DIY"
            value={diyPosts.length}
            accent="#7c74d8"
            softBg="#f5f3ff"
          />
          <SummaryCard
            label="Transactions"
            value={transactions.length}
            accent="#5ea778"
            softBg="#eef9f1"
            onClick={() => setTab("transactions")}
          />
          <SummaryCard
            label="Reports Received"
            value={reportsReceived.length}
            accent="#c65b7c"
            softBg="#fff1f5"
          />
          <SummaryCard
            label="Reports Submitted"
            value={reportsSubmitted.length}
            accent="#d99b1f"
            softBg="#fff7e8"
          />
          <SummaryCard
            label="Cancelled"
            value={cancelledCount}
            accent="#6b7280"
            softBg="#f3f4f6"
          />
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "12px 16px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            marginBottom: 16,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setTab("overview")}
          >
            Overview
          </TabButton>
          <TabButton
            active={activeTab === "reports-received"}
            onClick={() => setTab("reports-received")}
          >
            Reports Received
          </TabButton>
          <TabButton
            active={activeTab === "reports-submitted"}
            onClick={() => setTab("reports-submitted")}
          >
            Reports Submitted
          </TabButton>
          <TabButton
            active={activeTab === "cancellations"}
            onClick={() => setTab("cancellations")}
          >
            Cancellations
          </TabButton>
          <TabButton
            active={activeTab === "transactions"}
            onClick={() => setTab("transactions")}
          >
            Transactions
          </TabButton>
        </div>

        {activeTab === "overview" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "340px 1fr",
              gap: 18,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#fff",
                  padding: 16,
                  borderRadius: 14,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                  fontSize: 14,
                }}
              >
                <h3
                  style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}
                >
                  Location
                </h3>

                <p>
                  <strong>Barangay:</strong> {barangay}
                </p>
                <p>
                  <strong>Municipality / City:</strong> {municipality}
                </p>
                <p>
                  <strong>Region:</strong> {region}
                </p>
              </div>

              <div
                style={{
                  background: "#fff",
                  padding: 16,
                  borderRadius: 14,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                }}
              >
                <h3
                  style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}
                >
                  Account Details
                </h3>

                <div
                  style={{
                    borderRadius: 14,
                    padding: "14px 14px 12px",
                    background: accountStatusMeta.bg,
                    border: accountStatusMeta.border,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: accountStatusMeta.color,
                          marginBottom: 6,
                        }}
                      >
                        Account Status
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: accountStatusMeta.color,
                        }}
                      >
                        {accountStatusMeta.label}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#374151",
                        }}
                      >
                        {statusHeadline}
                      </div>
                    </div>

                    {(accountStatus === "suspended" ||
                      accountStatus === "banned" ||
                      accountStatus === "disabled") && (
                      <div
                        style={{
                          padding: "5px 10px",
                          borderRadius: 999,
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          fontSize: 11,
                          fontWeight: 700,
                          color: accountStatusMeta.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {accountStatus === "suspended"
                          ? suspensionTimeLeft
                          : "Logged out"}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: "#4b5563",
                      lineHeight: 1.55,
                    }}
                  >
                    {statusMessage}
                  </div>

                  {(accountStatus === "suspended" ||
                    accountStatus === "banned" ||
                    accountStatus === "disabled") && (
                    <div
                      style={{
                        marginTop: 12,
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #eef1f4",
                          borderRadius: 12,
                          padding: "10px 12px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "#6b7280",
                            marginBottom: 5,
                          }}
                        >
                          {accountStatus === "suspended" ? "Time Left" : "Forced Logout"}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#111827",
                            lineHeight: 1.45,
                          }}
                        >
                          {accountStatus === "suspended"
                            ? suspensionTimeLeft
                            : forceLogoutAt !== "—"
                            ? forceLogoutAt
                            : "Pending in client session"}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #eef1f4",
                          borderRadius: 12,
                          padding: "10px 12px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "#6b7280",
                            marginBottom: 5,
                          }}
                        >
                          {accountStatus === "suspended" ? "Ends At" : "Ban Recorded"}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#111827",
                            lineHeight: 1.45,
                          }}
                        >
                          {accountStatus === "suspended"
                            ? formatDateTime(user.suspendedUntil)
                            : bannedAt}
                        </div>
                      </div>
                    </div>
                  )}

                  {(accountStatus === "banned" || accountStatus === "disabled") && (
                    <div
                      style={{
                        marginTop: 10,
                        background: "#fff",
                        border: "1px solid #eef1f4",
                        borderRadius: 12,
                        padding: "10px 12px",
                        fontSize: 12,
                        color: "#374151",
                        lineHeight: 1.6,
                      }}
                    >
                      <div>
                        <strong>Session Invalidated:</strong> {sessionInvalidatedAt}
                      </div>
                      <div>
                        <strong>User Details:</strong> {name} • {email} • {user.uid || user.id}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #eef1f4",
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#6b7280",
                        marginBottom: 5,
                      }}
                    >
                      Reporting Access
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        lineHeight: 1.45,
                      }}
                    >
                      {reportingAccessStatus.label}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11.5,
                        color: "#4b5563",
                        lineHeight: 1.45,
                      }}
                    >
                      {reportingAccessStatus.isActive
                        ? `Until ${formatDateTime(
                            reportingAccessStatus.restrictedUntil
                          )}`
                        : "User can continue submitting reports."}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #eef1f4",
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#6b7280",
                        marginBottom: 5,
                      }}
                    >
                      Trade Access
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        lineHeight: 1.45,
                      }}
                    >
                      {tradeAccessStatus.label}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11.5,
                        color: "#4b5563",
                        lineHeight: 1.45,
                      }}
                    >
                      {tradeAccessStatus.isActive
                        ? `Until ${formatDateTime(tradeAccessStatus.restrictedUntil)}`
                        : "User can continue normal trading activity."}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                  <p>
                    <strong>User ID:</strong> {user.uid || user.id}
                  </p>
                  <p>
                    <strong>Warnings:</strong> {warningCount}
                  </p>
                  <p>
                    <strong>Last Enforcement Reason:</strong> {lastEnforcementReason}
                  </p>
                  <p>
                    <strong>Last Enforcement At:</strong> {lastEnforcementAt}
                  </p>
                  <p>
                    <strong>Reporting Access:</strong> {reportingAccessStatus.label}
                  </p>
                  {reportingAccessStatus.isActive && (
                    <p>
                      <strong>Report Restricted Until:</strong>{" "}
                      {formatDateTime(reportingAccessStatus.restrictedUntil)}
                    </p>
                  )}
                  <p>
                    <strong>Trade Access:</strong> {tradeAccessStatus.label}
                  </p>
                  {tradeAccessStatus.isActive && (
                    <p>
                      <strong>Trade Restricted Until:</strong>{" "}
                      {formatDateTime(tradeAccessStatus.restrictedUntil)}
                    </p>
                  )}
                  {(accountStatus === "suspended" || accountStatus === "banned") && (
                    <p>
                      <strong>
                        {accountStatus === "suspended" ? "Suspended Until" : "Banned At"}:
                      </strong>{" "}
                      {accountStatus === "suspended"
                        ? formatDateTime(user.suspendedUntil)
                        : bannedAt}
                    </p>
                  )}
                  {(accountStatus === "banned" || accountStatus === "disabled") && (
                    <p>
                      <strong>Force Logout At:</strong> {forceLogoutAt}
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  padding: 16,
                  borderRadius: 14,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                  fontSize: 14,
                }}
              >
                <h3
                  style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}
                >
                  Trade Summary
                </h3>

                <p>
                  <strong>Total Transactions:</strong> {transactions.length}
                </p>
                <p>
                  <strong>Pending:</strong> {pendingCount}
                </p>
                <p>
                  <strong>Accepted:</strong> {acceptedCount}
                </p>
                <p>
                  <strong>To Receive:</strong> {toReceiveCount}
                </p>
                <p>
                  <strong>Completed:</strong> {completedCount}
                </p>
                <p>
                  <strong>Cancelled / Rejected:</strong> {cancelledCount}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#111827",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <FaBoxOpen color={PRIMARY} /> Item Posts ({posts.length})
                </h2>

                <div style={{ marginTop: 14 }}>
                  {posts.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#6b7280" }}>
                      No item posts yet.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      {posts.map((p) => {
                        const postTitle =
                          p.title ||
                          p.description ||
                          p.itemName ||
                          p.name ||
                          "Untitled item";

                        const thumb =
                          (Array.isArray(p.images) && p.images[0]) ||
                          p.imageUrl ||
                          null;

                        const status = (p.status || "Available").toString();

                        return (
                          <a
                            key={p.id}
                            href={`/posts?ownerUid=${encodeURIComponent(userUid)}`}
                            style={{
                              border: "1px solid #f0f0f0",
                              borderRadius: 10,
                              overflow: "hidden",
                              background: "#fafafa",
                              boxShadow: "0 3px 8px rgba(0,0,0,0.04)",
                              display: "block",
                              color: "inherit",
                              textDecoration: "none",
                            }}
                            title="View this user's items in the Items list"
                          >
                            <div
                              style={{
                                position: "relative",
                                width: "100%",
                                paddingBottom: "100%",
                                background: "#f3f4f6",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt="item"
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <span
                                  style={{ fontSize: 12, color: "#9ca3af" }}
                                >
                                  No image
                                </span>
                              )}
                            </div>
                            <div style={{ padding: "8px 10px" }}>
                              <p
                                style={{
                                  margin: "0 0 4px",
                                  fontWeight: 600,
                                  fontSize: 12,
                                  color: "#111",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {postTitle}
                              </p>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 11,
                                  color: "#6b7280",
                                }}
                              >
                                Size: {p.size || "-"}
                              </p>
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontSize: 11,
                                  color: "#6b7280",
                                }}
                              >
                                {status}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#111",
                  }}
                >
                  <FaTools color={PRIMARY} /> DIY Tutorials ({diyPosts.length})
                </h2>

                <div style={{ marginTop: 14 }}>
                  {diyPosts.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#6b7280" }}>
                      No DIY posts yet.
                    </p>
                  ) : (
                    diyPosts.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 600 }}>
                          <a
                            href={`/diy-posts?ownerUid=${encodeURIComponent(
                              userUid
                            )}`}
                            style={{ color: "#111", textDecoration: "underline" }}
                            title="Open this user's DIY tutorials"
                          >
                            {p.title || "Untitled DIY"}
                          </a>
                        </p>
                        <p
                          style={{
                            marginTop: 3,
                            fontSize: 13,
                            color: "#6b7280",
                          }}
                        >
                          Steps: {p.steps?.length || 0}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Transaction History ({transactions.length})
                </h2>

                <div style={{ marginTop: 14 }}>
                  {transactions.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#6b7280" }}>
                      No transaction history yet.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {transactions.map((t) => {
                        const itemName =
                          t.itemName ||
                          t.postTitle ||
                          t.itemTitle ||
                          t.title ||
                          t.productName ||
                          t.requestedItemName ||
                          "Unnamed item";

                        const partner =
                          t.partnerName ||
                          t.otherUserName ||
                          t.traderName ||
                          t.receiverName ||
                          t.requesterName ||
                          t.ownerName ||
                          "Unknown user";

                        const method =
                          t.method ||
                          t.meetupMethod ||
                          t.deliveryMethod ||
                          "—";

                        const status = normalizeStatus(t.status);
                        const displayStatus =
                          status === "pending"
                            ? "Pending"
                            : status === "accepted"
                            ? "Accepted"
                            : status === "to receive"
                            ? "To Receive"
                            : status === "completed"
                            ? "Completed"
                            : status === "cancelled"
                            ? "Cancelled"
                            : status === "rejected"
                            ? "Rejected"
                            : t.status || "Unknown";

                        const txDate = formatDate(
                          t.createdAt ||
                            t.updatedAt ||
                            t.dateCreated ||
                            t.transactionDate
                        );

                        return (
                          <div
                            key={t.id}
                            onClick={() => openTransaction(t)}
                            style={{
                              border: "1px solid #f1f1f1",
                              borderRadius: 10,
                              padding: "12px 14px",
                              background: "#fafafa",
                              cursor: "pointer",
                              transition: "transform 0.18s ease, box-shadow 0.18s ease",
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
                              <div>
                                <p
                                  style={{
                                    margin: 0,
                                    fontWeight: 700,
                                    fontSize: 14,
                                  }}
                                >
                                  {itemName}
                                </p>
                                <p
                                  style={{
                                    margin: "4px 0 0",
                                    fontSize: 12,
                                    color: "#6b7280",
                                  }}
                                >
                                  Transaction ID: {t.id}
                                </p>
                                <p
                                  style={{
                                    margin: "4px 0 0",
                                    fontSize: 12,
                                    color: "#6b7280",
                                  }}
                                >
                                  Partner: {partner}
                                </p>
                                <p
                                  style={{
                                    margin: "4px 0 0",
                                    fontSize: 12,
                                    color: "#6b7280",
                                  }}
                                >
                                  Method: {method}
                                </p>
                                <p
                                  style={{
                                    margin: "4px 0 0",
                                    fontSize: 12,
                                    color: "#6b7280",
                                  }}
                                >
                                  Date: {txDate}
                                </p>
                              </div>

                              <div
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 999,
                                  ...getTransactionStatusStyle(t.status),
                                  fontSize: 12,
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {displayStatus}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports-received" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Reports Received ({reportsReceived.length})
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Reports filed against this user or this user’s account.
            </p>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {reportsReceived.length === 0 ? (
                <EmptyState text="No reports received yet." />
              ) : (
                reportsReceived.map((report) => renderReportCard(report, "received"))
              )}
            </div>
          </div>
        )}

        {activeTab === "reports-submitted" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Reports Submitted ({reportsSubmitted.length})
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Reports this user has filed against other users or items.
            </p>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {reportsSubmitted.length === 0 ? (
                <EmptyState text="No submitted reports yet." />
              ) : (
                reportsSubmitted.map((report) =>
                  renderReportCard(report, "submitted")
                )
              )}
            </div>
          </div>
        )}

        {activeTab === "cancellations" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Cancellation History ({cancelledTransactions.length})
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Cancelled or rejected transactions associated with this user.
            </p>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {cancelledTransactions.length === 0 ? (
                <EmptyState text="No cancelled or rejected transactions yet." />
              ) : (
                cancelledTransactions.map((t) => renderCancellationCard(t))
              )}
            </div>
          </div>
        )}

        {activeTab === "transactions" && renderTransactionsSection()}
      </div>

      {selectedTransaction && (
        <div
          onClick={() => setSelectedTransaction(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "88vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
              padding: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#111827",
                  }}
                >
                  Transaction Details
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  Transaction ID: {selectedTransaction.id}
                </p>
              </div>

              <button
                onClick={() => setSelectedTransaction(null)}
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  color: "#374151",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #eef1f4",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>
                  Transaction Info
                </h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <DetailRow label="Status" value={prettyTransactionStatus(selectedTransaction.status)} />
                  <DetailRow
                    label="Created At"
                    value={formatDateTime(
                      firstTimestamp(selectedTransaction, [
                        "createdAt",
                        "dateCreated",
                        "transactionDate",
                        "requestedAt",
                        "submittedAt",
                      ])
                    )}
                  />
                  <DetailRow label="Updated At" value={formatDateTime(selectedTransaction.updatedAt)} />
                  <DetailRow label="Method" value={selectedTransaction.method || selectedTransaction.meetupMethod || selectedTransaction.deliveryMethod || "—"} />
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #eef1f4",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>
                  Participants
                </h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <DetailRow label="Partner" value={selectedTransaction.partnerName || selectedTransaction.otherUserName || selectedTransaction.traderName || selectedTransaction.receiverName || selectedTransaction.requesterName || selectedTransaction.ownerName || "Unknown user"} />
                  <DetailRow label="Requester ID" value={selectedTransaction.requesterId || selectedTransaction.requesterUid || "—"} />
                  <DetailRow label="Owner ID" value={selectedTransaction.ownerId || selectedTransaction.ownerUid || "—"} />
                  <DetailRow label="Item" value={selectedTransaction.itemName || selectedTransaction.postTitle || selectedTransaction.itemTitle || selectedTransaction.title || selectedTransaction.productName || selectedTransaction.requestedItemName || "Unnamed item"} />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                background: "#fff",
                border: "1px solid #eef1f4",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>
                Transaction Timeline
              </h3>

              {selectedTransactionTimeline.length ? (
                <div style={{ display: "grid", gap: 0 }}>
                  {selectedTransactionTimeline.map((event, index) => {
                    const isLast = index === selectedTransactionTimeline.length - 1;
                    const toneColor =
                      event.tone === "success"
                        ? "#16a34a"
                        : event.tone === "danger"
                          ? "#dc2626"
                          : event.tone === "info"
                            ? "#2563eb"
                            : PRIMARY;
                    const toneBackground =
                      event.tone === "success"
                        ? "#dcfce7"
                        : event.tone === "danger"
                          ? "#fee2e2"
                          : event.tone === "info"
                            ? "#dbeafe"
                            : "#fce7f3";

                    return (
                      <div
                        key={event.key}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "24px 1fr",
                          gap: 12,
                          alignItems: "start",
                          paddingBottom: isLast ? 0 : 14,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            minHeight: isLast ? 24 : 72,
                          }}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: toneColor,
                              border: "3px solid #fff",
                              boxShadow: `0 0 0 3px ${toneBackground}`,
                              marginTop: 2,
                              flexShrink: 0,
                            }}
                          />
                          {!isLast && (
                            <span
                              style={{
                                width: 2,
                                flex: 1,
                                marginTop: 6,
                                background: "#e5e7eb",
                                borderRadius: 999,
                              }}
                            />
                          )}
                        </div>

                        <div
                          style={{
                            background: "#fafafa",
                            border: "1px solid #f1f5f9",
                            borderRadius: 12,
                            padding: "12px 14px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              alignItems: "baseline",
                              flexWrap: "wrap",
                            }}
                          >
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
                              {event.label}
                            </p>
                            <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                              {formatDateTime(event.at)}
                            </span>
                          </div>
                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: 13,
                              color: "#4b5563",
                              lineHeight: 1.5,
                            }}
                          >
                            {event.detail}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                  No detailed timeline has been recorded for this transaction yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
