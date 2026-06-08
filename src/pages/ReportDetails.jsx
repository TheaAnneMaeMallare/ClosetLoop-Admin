import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import {
  FaArrowLeft,
  FaBan,
  FaExclamationTriangle,
  FaFileAlt,
  FaFlag,
  FaImage,
  FaShieldAlt,
  FaUser,
} from "react-icons/fa";
import { auth, db } from "../firebase/firebaseConfig";
import {
  CARD_STYLE,
  CONTENT_UNDO_FIELDS,
  EMPTY_VALUE,
  IMMEDIATE_BAN_KEYWORDS,
  MODERATION_PATHS,
  PRIMARY,
  REPORT_RESTRICTION_STEPS,
  REPORT_UNDO_FIELDS,
  USER_UNDO_FIELDS,
} from "./reports/constants";
import { DetailRow } from "./reports/components";
import {
  createFieldSnapshot,
  createModerationActionId,
  getContentActionLabel,
  getContentModerationTarget,
  getFalseReportAbuseDurationForOffense,
  getFalseReportAbuseOffenseCount,
  getImageFromSourceRecord,
  getNormalizedReportType,
  getOffenseCountForUser,
  getRecommendedEnforcement,
  getRelatedUserIdForReport,
  getReportedContentBody,
  getReportedContentBodyLabel,
  getReportedContentImage,
  getReportedContentOwner,
  getReportedContentTitle,
  getReportedContentTitleLabel,
  getReportContextText,
  getReportReporterId,
  getReportStatus,
  getReportTypeLabel,
  getSeverity,
  getSourceTargetsForReport,
  getTargetDisplayName,
  getTargetIdForReport,
  hasKeyword,
  isFalseReportAbuseEligible,
  normalizeText,
  toMillis,
  formatDateTime,
} from "./reports/utils";

const ACTION_OPTIONS = [
  { value: "auto", label: "Auto Apply (Recommended)" },
  { value: "warning", label: "Warning only" },
  { value: "content_removal", label: "Content removal only" },
  { value: "suspension_1_day", label: "1-day suspension" },
  { value: "suspension_3_days", label: "3-day suspension" },
  { value: "suspension_7_days", label: "7-day suspension" },
  { value: "ban", label: "Ban" },
];

const ACTION_HELPERS = {
  auto: "Uses the current report rules to choose the correct warning, restriction, suspension, or ban.",
  warning: "Records a warning for the reported user without applying a timed suspension.",
  content_removal: "Takes down the reported post, item, or DIY content only. The user account is not penalized.",
  suspension_1_day: "Suspends the reported user for 1 day. Reported content is also removed when available.",
  suspension_3_days: "Suspends the reported user for 3 days. Reported content is also removed when available.",
  suspension_7_days: "Suspends the reported user for 7 days. Reported content is also removed when available.",
  ban: "Permanently bans the reported user and invalidates the session. Reported content is also removed when available.",
};

function getUserName(user) {
  if (!user) return "Unknown user";
  return (
    user.displayName ||
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.email ||
    user.id ||
    "Unknown user"
  );
}

function getUserEmail(user) {
  return user?.email || EMPTY_VALUE;
}

function panelStyle(extra = {}) {
  return {
    ...CARD_STYLE,
    padding: 18,
    ...extra,
  };
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "#fff1f6",
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
        <h2 style={{ margin: 0, fontSize: 17, color: "#111827", fontWeight: 800 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function statusBadge(status) {
  const normalized = normalizeText(status);
  if (normalized === "verified") return { bg: "#ecfdf3", color: "#2f6b4f", border: "#bde2c7" };
  if (normalized === "dismissed") return { bg: "#fdecef", color: "#9f274d", border: "#f7c8d4" };
  return { bg: "#fff7e8", color: "#9a6700", border: "#f4dfab" };
}

function makeManualRecommendation(action, currentOffenseCount, report) {
  if (action === "warning") {
    return {
      moderationPath: MODERATION_PATHS.VIOLATION,
      targetUserId: getRelatedUserIdForReport(report),
      nextOffenseCount: currentOffenseCount + 1,
      severity: getSeverity(report, MODERATION_PATHS.VIOLATION),
      recommendation: {
        accountStatus: "warned",
        enforcementType: "warning",
        enforcementAction: "warning",
        adminAction: "Warning Issued",
        durationDays: 0,
        alertType: "warning",
        message:
          "Your account has received a warning due to a validated report. Please review our community guidelines.",
      },
    };
  }

  if (action === "content_removal") {
    return {
      moderationPath: MODERATION_PATHS.VIOLATION,
      targetUserId: getRelatedUserIdForReport(report),
      nextOffenseCount: currentOffenseCount,
      severity: getSeverity(report, MODERATION_PATHS.VIOLATION),
      contentOnly: true,
      recommendation: {
        accountStatus: null,
        enforcementType: "content_removal",
        enforcementAction: "content_removal",
        adminAction: "Content Removal Only",
        durationDays: 0,
        alertType: "content_removed",
        message: "Reported content has been removed after admin review.",
      },
    };
  }

  if (action === "ban") {
    return {
      moderationPath: MODERATION_PATHS.VIOLATION,
      targetUserId: getRelatedUserIdForReport(report),
      nextOffenseCount: Math.max(currentOffenseCount + 1, 5),
      severity: getSeverity(report, MODERATION_PATHS.VIOLATION),
      recommendation: {
        accountStatus: "banned",
        enforcementType: "ban",
        enforcementAction: "ban",
        adminAction: "Banned Account",
        durationDays: 0,
        alertType: "ban",
        message:
          "Your account has been permanently banned due to a verified report.",
      },
    };
  }

  const days = action === "suspension_3_days" ? 3 : action === "suspension_7_days" ? 7 : 1;
  return {
    moderationPath: MODERATION_PATHS.VIOLATION,
    targetUserId: getRelatedUserIdForReport(report),
    nextOffenseCount: currentOffenseCount + 1,
    severity: getSeverity(report, MODERATION_PATHS.VIOLATION),
    recommendation: {
      accountStatus: "suspended",
      enforcementType: "suspension",
      enforcementAction: `suspension_${days}_day${days === 1 ? "" : "s"}`,
      adminAction: `${days}-Day Suspension`,
      durationDays: days,
      alertType: "suspension",
      message: `Your account has been suspended for ${days} day${days === 1 ? "" : "s"} due to a verified report.`,
    },
  };
}

export default function ReportDetails() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [resolvedPreviewImage, setResolvedPreviewImage] = useState(null);
  const [selectedAction, setSelectedAction] = useState("auto");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const getResolvedUserName = (user) =>
    user?.displayName ||
    user?.fullName ||
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    user?.email ||
    "Unknown user";

  const firstValue = (...values) =>
    values.find((value) => {
      if (value === null || value === undefined) return false;
      return value.toString().trim() !== "";
    });

  const buildStoredReport = (snapshot) => {
    const data = snapshot.data();
    const embeddedId =
      typeof data?.id === "string" && data.id.trim() ? data.id.trim() : null;

    return {
      ...data,
      id: snapshot.id,
      reportDocId: snapshot.id,
      embeddedReportId:
        embeddedId && embeddedId !== snapshot.id ? embeddedId : null,
    };
  };

  const getEmbeddedTransactionReports = (tx) => {
    if (Array.isArray(tx?.transactionReports) && tx.transactionReports.length) {
      return tx.transactionReports;
    }
    if (Array.isArray(tx?.reports) && tx.reports.length) {
      return tx.reports;
    }

    const embedded =
      tx?.report ||
      tx?.reportData ||
      tx?.reportInfo ||
      tx?.transactionReport ||
      tx?.dispute ||
      tx?.complaint ||
      null;

    return embedded && Object.keys(embedded).length ? [embedded] : [];
  };

  const buildReportFromTradeRequest = (tx, embedded, userLookup, postLookup, syntheticId = null) => {
    const ownerId = tx.ownerId || tx.ownerUid || null;
    const requesterId = tx.requesterId || tx.requesterUid || null;
    const reporterId = firstValue(
      embedded.reporterId,
      embedded.reporterUid,
      embedded.reportedBy,
      embedded.reportedById,
      embedded.submittedBy,
      tx.reporterId,
      tx.reporterUid,
      tx.reportedBy
    );
    const reportedUserId = firstValue(
      embedded.reportedUserId,
      embedded.targetUserId,
      embedded.reportedId,
      tx.reportedUserId,
      tx.targetUserId,
      reporterId && reporterId === ownerId ? requesterId : null,
      reporterId && reporterId === requesterId ? ownerId : null,
      ownerId
    );
    const postId = embedded.postId || tx.requestedPostId || tx.postId || tx.itemId || tx.targetPostId || null;
    const post = postId ? postLookup[postId] : null;
    const reporter = reporterId ? userLookup[reporterId] : null;
    const reportedUser = reportedUserId ? userLookup[reportedUserId] : null;

    return enrichTransactionReport(
      {
        id: embedded.id || tx.reportId || syntheticId || `tradeRequest-${tx.id}`,
        sourceCollection: "tradeRequests",
        sourceDocId: tx.id,
        sourceReportId: embedded.id || null,
        sourceOnly: true,
        type: "transaction",
        reportType: "transaction",
        reportTargetType: "transaction",
        targetType: "transaction",
        transactionId: embedded.tradeRequestId || embedded.transactionId || tx.id,
        tradeRequestId: embedded.tradeRequestId || tx.id,
        category: firstValue(
          embedded.category,
          embedded.reportCategory,
          embedded.reason,
          embedded.reportReason,
          "Transaction Report"
        ),
        details: firstValue(
          embedded.details,
          embedded.description,
          embedded.message,
          embedded.reportDetails,
          embedded.reportDescription,
          embedded.reportMessage,
          embedded.reason,
          "Transaction report submitted from trade request."
        ),
        reporterId: reporterId || null,
        reportedUserId: reportedUserId || null,
        reporterName: firstValue(
          embedded.reporterName,
          getResolvedUserName(reporter),
          "Unknown"
        ),
        reportedName: firstValue(
          embedded.reportedName,
          getResolvedUserName(reportedUser),
          post?.title,
          tx.itemTitle,
          tx.itemName,
          "Transaction user"
        ),
        requestedPostId: embedded.postId || tx.requestedPostId || null,
        postId,
        createdAt:
          embedded.createdAt ||
          embedded.reportedAt ||
          embedded.submittedAt ||
          tx.reportedAt ||
          tx.reportCreatedAt ||
          tx.reportSubmittedAt ||
          tx.createdAt ||
          tx.updatedAt ||
          null,
        updatedAt: embedded.updatedAt || tx.updatedAt || null,
        reviewedAt: embedded.reviewedAt || tx.reportReviewedAt || tx.reviewedAt || null,
        reviewedBy: embedded.reviewedBy || tx.reportReviewedBy || tx.reviewedBy || null,
        status: embedded.status || embedded.reviewStatus || tx.reportStatus || tx.reviewStatus || "pending",
        reviewStatus: embedded.status || embedded.reviewStatus || tx.reportStatus || tx.reviewStatus || "pending",
        adminAction: firstValue(
          embedded.adminAction,
          embedded.reportAdminAction,
          embedded.actionTaken,
          embedded.moderationAction,
          tx.adminAction,
          tx.reportAdminAction,
          tx.actionTaken,
          tx.moderationAction,
          ""
        ),
        enforcementAction: firstValue(
          embedded.enforcementAction,
          embedded.reportEnforcementAction,
          tx.enforcementAction,
          tx.reportEnforcementAction,
          ""
        ),
        enforcementType: firstValue(
          embedded.enforcementType,
          embedded.reportEnforcementType,
          tx.enforcementType,
          tx.reportEnforcementType,
          ""
        ),
      },
      { [tx.id]: tx },
      userLookup,
      postLookup
    );
  };

  const findTradeRequestReport = (id, txRows, userLookup, postLookup) => {
    for (const tx of txRows) {
      const embeddedReports = getEmbeddedTransactionReports(tx);
      for (const [index, embedded] of embeddedReports.entries()) {
        const syntheticId = `tradeRequest-${tx.id}-${index + 1}`;
        if (embedded?.id === id || syntheticId === id) {
          return buildReportFromTradeRequest(tx, embedded, userLookup, postLookup, syntheticId);
        }
      }
    }

    return null;
  };

  const isTransactionRouteId = (id) => {
    const normalizedId = normalizeText(id);

    return (
      normalizedId.startsWith("traderequest-") ||
      normalizedId.startsWith("txn-report-") ||
      normalizedId.startsWith("transaction-report-") ||
      normalizedId.startsWith("trade-report-")
    );
  };

  const enrichTransactionReport = (rawReport, txLookup, userLookup, postLookup) => {
    if (getNormalizedReportType(rawReport) !== "transaction") return rawReport;

    const txId = getTargetIdForReport(rawReport);
    const tx =
      txLookup[rawReport?.tradeRequestId] ||
      txLookup[rawReport?.transactionId] ||
      txLookup[rawReport?.tradeId] ||
      txLookup[rawReport?.requestId] ||
      txLookup[txId] ||
      null;

    if (!tx) return rawReport;

    const ownerId = tx.ownerId || tx.ownerUid || null;
    const requesterId = tx.requesterId || tx.requesterUid || null;
    const owner = ownerId ? userLookup[ownerId] : null;
    const requester = requesterId ? userLookup[requesterId] : null;
    const postId =
      tx.requestedPostId || tx.postId || tx.itemId || tx.targetPostId || null;
    const post = postId ? postLookup[postId] : null;

    return {
      ...rawReport,
      transactionId: rawReport.transactionId || tx.id,
      tradeRequestId: rawReport.tradeRequestId || tx.id,
      transactionStatus: rawReport.transactionStatus || tx.status || null,
      tradeStatus: rawReport.tradeStatus || tx.status || null,
      transactionType: rawReport.transactionType || tx.type || tx.method || null,
      transactionTitle:
        rawReport.transactionTitle ||
        rawReport.tradeTitle ||
        rawReport.itemTitle ||
        rawReport.postTitle ||
        post?.title ||
        tx.itemName ||
        tx.postTitle ||
        tx.itemTitle ||
        tx.title ||
        "Transaction record",
      transactionDetails:
        rawReport.transactionDetails ||
        rawReport.tradeDetails ||
        tx.cancelReason ||
        tx.reason ||
        tx.description ||
        null,
      transactionSummary:
        rawReport.transactionSummary ||
        rawReport.tradeSummary ||
        [tx.type || tx.method, tx.status].filter(Boolean).join(" | ") ||
        null,
      requestedPostId: rawReport.requestedPostId || postId,
      postId: rawReport.postId || postId,
      postTitle: rawReport.postTitle || post?.title || tx.postTitle || null,
      targetImageUrl:
        rawReport.targetImageUrl ||
        rawReport.reportedImageUrl ||
        post?.image ||
        tx.imageUrl ||
        null,
      ownerId: rawReport.ownerId || ownerId,
      requesterId: rawReport.requesterId || requesterId,
      ownerName: rawReport.ownerName || getResolvedUserName(owner),
      requesterName: rawReport.requesterName || getResolvedUserName(requester),
      reportedName:
        rawReport.reportedName ||
        post?.title ||
        tx.itemName ||
        tx.postTitle ||
        getResolvedUserName(owner),
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [reportSnap, reportsSnap, usersSnap, postsSnap] = await Promise.all([
          getDoc(doc(db, "reports", reportId)),
          getDocs(collection(db, "reports")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "posts")),
        ]);

        const userRows = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const userLookup = {};
        userRows.forEach((user) => {
          userLookup[user.id] = user;
          if (user.uid) userLookup[user.uid] = user;
        });

        const postLookup = {};
        postsSnap.docs.forEach((d) => {
          const data = d.data();
          postLookup[d.id] = {
            title:
              data.title ||
              data.itemTitle ||
              data.itemName ||
              data.productName ||
              data.name ||
              "Unnamed item",
            image:
              (Array.isArray(data.images) && data.images[0]) ||
              data.imageUrl ||
              null,
          };
        });

        const rawReports = reportsSnap.docs.map((d) => buildStoredReport(d));
        const matchedStoredReport = rawReports.find(
          (entry) =>
            entry.id === reportId ||
            entry.reportDocId === reportId ||
            entry.embeddedReportId === reportId
        );
        const rawReport = reportSnap.exists()
          ? buildStoredReport(reportSnap)
          : matchedStoredReport || null;
        const shouldFetchTransactions =
          getNormalizedReportType(rawReport) === "transaction" ||
          !rawReport ||
          isTransactionRouteId(reportId);

        let txRows = [];
        let txLookup = {};

        if (shouldFetchTransactions) {
          const txSnap = await getDocs(collection(db, "tradeRequests"));
          txRows = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          txRows.forEach((tx) => {
            txLookup[tx.id] = tx;
          });
        }

        const loadedReport = rawReport
          ? getNormalizedReportType(rawReport) === "transaction"
            ? enrichTransactionReport(rawReport, txLookup, userLookup, postLookup)
            : rawReport
          : shouldFetchTransactions
          ? findTradeRequestReport(reportId, txRows, userLookup, postLookup)
          : null;

        const hydratedReports =
          shouldFetchTransactions && Object.keys(txLookup).length
            ? rawReports.map((entry) =>
                getNormalizedReportType(entry) === "transaction"
                  ? enrichTransactionReport(entry, txLookup, userLookup, postLookup)
                  : entry
              )
            : rawReports;

        if (!loadedReport) {
          setReport(null);
          setReports(hydratedReports);
          setUsers(userRows);
          setTransactions(txRows);
          return;
        }

        setReport(loadedReport);
        setReports([
          ...hydratedReports,
          ...(loadedReport.sourceOnly ? [loadedReport] : []),
        ]);
        setUsers(userRows);
        setTransactions(txRows);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [reportId]);

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      if (!report) {
        setResolvedPreviewImage(null);
        return;
      }

      const existing = getReportedContentImage(report);
      if (existing) {
        setResolvedPreviewImage(existing);
        return;
      }

      const targets = getSourceTargetsForReport(report);
      for (const target of targets) {
        try {
          const snap = await getDoc(doc(db, target.collectionName, target.docId));
          const image = snap.exists() ? getImageFromSourceRecord(snap.data()) : null;
          if (image && active) {
            setResolvedPreviewImage(image);
            return;
          }
        } catch (err) {
          console.error("REPORT DETAIL PREVIEW ERROR:", err);
        }
      }

      if (active) setResolvedPreviewImage(null);
    };

    loadPreview();
    return () => {
      active = false;
    };
  }, [report]);

  const getUserById = (id) => {
    if (!id) return null;
    return users.find((u) => u.id === id || u.uid === id) || null;
  };

  const reporterStats = useMemo(() => {
    const reporterId = getReportReporterId(report);
    return reports.reduce(
      (summary, entry) => {
        if (getReportReporterId(entry) !== reporterId) return summary;
        const status = getReportStatus(entry);
        summary.totalReports += 1;
        if (status === "verified" || status === "dismissed") summary.reviewedReports += 1;
        if (status === "verified") summary.validReports += 1;
        if (status === "dismissed") summary.dismissedReports += 1;
        return summary;
      },
      { totalReports: 0, reviewedReports: 0, validReports: 0, dismissedReports: 0 }
    );
  }, [reports, report]);

  const targetUserId = report ? getRelatedUserIdForReport(report) : null;
  const targetUser = getUserById(targetUserId);
  const reporter = getUserById(getReportReporterId(report));
  const currentOffenseCount = getOffenseCountForUser(targetUser);
  const contentTarget = report ? getContentModerationTarget(report) : null;
  const reportStatus = report ? getReportStatus(report) : "pending";
  const isSourceOnlyReport = report?.sourceOnly === true;

  const getTradeBehavior = (userRecord) => {
    const cancelledTransactions = Math.max(
      Number(userRecord?.cancelledTransactions ?? 0),
      Number(userRecord?.cancelCount ?? 0)
    );
    const completedTransactions = Number(userRecord?.completedTransactions || 0);
    const totalTransactions = Math.max(
      Number(userRecord?.totalTransactions || 0),
      cancelledTransactions + completedTransactions
    );

    return {
      cancelledTransactions,
      completedTransactions,
      totalTransactions,
      cancelRate:
        totalTransactions > 0
          ? cancelledTransactions / totalTransactions
          : Number(userRecord?.cancelRate || 0),
      restrictionLevel: Number(userRecord?.tradeRestrictionLevel || 0),
    };
  };

  const recommendation = useMemo(() => {
    if (!report) return null;

    if (selectedAction !== "auto") {
      return makeManualRecommendation(selectedAction, currentOffenseCount, report);
    }

    const contextText = getReportContextText(report);
    const normalSeverity = getSeverity(report, MODERATION_PATHS.VIOLATION);
    const hasStrongViolationSignals =
      normalSeverity === "high" ||
      hasKeyword(contextText, ["scam", "fraud", "impersonation", "harassment"]);
    const isCancellationReport =
      getNormalizedReportType(report) === "transaction" &&
      hasKeyword(contextText, [
        "cancel",
        "cancellation",
        "repeated cancellations",
        "unjustified cancellation",
        "unreliable trade",
        "no show",
        "no-show",
      ]) &&
      !hasKeyword(contextText, ["scam", "fraud", "harassment", "threat"]);

    if (isFalseReportAbuseEligible(reporterStats) && !hasStrongViolationSignals) {
      const reporterRecord = getUserById(getReportReporterId(report));
      const nextOffenseCount = getFalseReportAbuseOffenseCount(reporterRecord) + 1;
      const durationDays = getFalseReportAbuseDurationForOffense(nextOffenseCount);
      const label =
        durationDays >= 14
          ? "14-Day Reporting Restriction"
          : durationDays === 7
          ? "7-Day Reporting Restriction"
          : durationDays === 3
          ? "3-Day Reporting Restriction"
          : durationDays === 1
          ? "1-Day Reporting Restriction"
          : "Reporting Warning";

      return {
        moderationPath: MODERATION_PATHS.FALSE_REPORT_ABUSE,
        targetUserId: getReportReporterId(report),
        nextOffenseCount,
        severity: "medium",
        recommendation: {
          enforcementType: durationDays > 0 ? "report_restriction" : "report_warning",
          enforcementAction:
            durationDays > 0 ? `report_restriction_${durationDays}_days` : "report_warning",
          adminAction: label,
          durationDays,
          alertType: durationDays > 0 ? "reporting_restriction" : "reporting",
          message:
            durationDays > 0
              ? `Your reporting access has been restricted for ${durationDays} day${durationDays === 1 ? "" : "s"} due to repeated invalid reports.`
              : "You have received a warning for submitting invalid or abusive reports.",
        },
      };
    }

    if (isCancellationReport) {
      const behavior = getTradeBehavior(targetUser);
      const currentLevel = Number(behavior.restrictionLevel || 0);

      return {
        moderationPath: MODERATION_PATHS.TRANSACTION_RESTRICTION,
        targetUserId,
        nextOffenseCount: currentLevel,
        severity: getSeverity(report, MODERATION_PATHS.TRANSACTION_RESTRICTION),
        tradeBehavior: behavior,
        recommendation: {
          enforcementType: "trade_warning",
          enforcementAction: "trade_warning",
          adminAction: "Trade Conduct Warning",
          durationDays: 0,
          alertType: "trade_warning",
          message:
            "You have received a warning for repeated cancellation activity in transactions.",
        },
      };
    }

    const override =
      currentOffenseCount === 0 && hasKeyword(contextText, IMMEDIATE_BAN_KEYWORDS)
        ? {
            offenseCount: 5,
            accountStatus: "banned",
            enforcementType: "ban",
            enforcementAction: "ban",
            adminAction: "Immediate Ban",
            durationDays: 0,
            alertType: "ban",
            message:
              "Your account has been permanently banned due to a severe verified violation.",
          }
        : null;

    return {
      moderationPath: MODERATION_PATHS.VIOLATION,
      targetUserId,
      nextOffenseCount: override ? override.offenseCount : currentOffenseCount + 1,
      severity: normalSeverity,
      recommendation: override || getRecommendedEnforcement(currentOffenseCount + 1),
    };
  }, [report, selectedAction, currentOffenseCount, reporterStats, targetUser]);

  const contentImage = report ? getReportedContentImage(report) || resolvedPreviewImage : null;
  const contentTitle = report ? getReportedContentTitle(report) : EMPTY_VALUE;
  const contentBody = report ? getReportedContentBody(report) : EMPTY_VALUE;
  const contentOwner = report ? getReportedContentOwner(report) : EMPTY_VALUE;
  const targetType = report ? getReportTypeLabel(report) : EMPTY_VALUE;
  const targetId = report ? getTargetIdForReport(report) || EMPTY_VALUE : EMPTY_VALUE;
  const badge = statusBadge(reportStatus);

  const refreshReport = async () => {
    if (report?.sourceOnly && report.sourceDocId) {
      const txSnap = await getDoc(doc(db, "tradeRequests", report.sourceDocId));
      if (!txSnap.exists()) return;

      const tx = { id: txSnap.id, ...txSnap.data() };
      const embedded = getEmbeddedTransactionReports(tx).find(
        (entry, index) =>
          entry?.id === (report.sourceReportId || report.id) ||
          `tradeRequest-${tx.id}-${index + 1}` === report.id
      );
      if (!embedded) return;

      const userLookup = {};
      users.forEach((user) => {
        userLookup[user.id] = user;
        if (user.uid) userLookup[user.uid] = user;
      });

      setReport((prev) => ({
        ...prev,
        ...buildReportFromTradeRequest(tx, embedded, userLookup, {}, report.id),
      }));
      return;
    }

    const snap = await getDoc(doc(db, "reports", reportId));
    if (snap.exists()) {
      setReport((prev) => ({
        ...prev,
        ...buildStoredReport(snap),
      }));
    }
  };

  const updateSourceOnlyReportInBatch = async (batch, fields) => {
    if (!report?.sourceOnly || !report.sourceDocId) return false;

    const txRef = doc(db, "tradeRequests", report.sourceDocId);
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) return false;

    const txData = txSnap.data();
    const reportKey = report.sourceReportId || report.id;
    const reviewedAt = Timestamp.now();
    const reviewedBy = auth.currentUser?.uid || auth.currentUser?.email || "admin";
    const updateEntry = (entry, index) =>
      entry?.id === reportKey || `tradeRequest-${report.sourceDocId}-${index + 1}` === report.id
        ? {
            ...entry,
            ...fields,
            reviewedAt,
            reviewedBy,
            updatedAt: reviewedAt,
          }
        : entry;

    if (Array.isArray(txData.transactionReports)) {
      batch.set(
        txRef,
        {
          transactionReports: txData.transactionReports.map(updateEntry),
          reportStatus: fields.status,
          reviewStatus: fields.reviewStatus || fields.status,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    }

    if (Array.isArray(txData.reports)) {
      batch.set(
        txRef,
        {
          reports: txData.reports.map(updateEntry),
          reportStatus: fields.status,
          reviewStatus: fields.reviewStatus || fields.status,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    }

    return false;
  };

  const applyContentTakedown = async (batch, moderationActionId) => {
    if (!contentTarget) return { contentAction: null, contentUndoState: null };

    const contentRef = doc(db, contentTarget.collectionName, contentTarget.docId);
    const contentSnap = await getDoc(contentRef);
    if (!contentSnap.exists()) return { contentAction: null, contentUndoState: null };

    const hiddenReason = report.category || "Verified content violation";
    const contentAction = getContentActionLabel(report);
    const contentUndoState = createFieldSnapshot(contentSnap.data(), CONTENT_UNDO_FIELDS);

    batch.set(
      contentRef,
      {
        moderationStatus: "taken_down",
        isHidden: true,
        hiddenAt: serverTimestamp(),
        hiddenReason,
        takenDownByReportId: report.id,
      },
      { merge: true }
    );

    return { contentAction, contentUndoState };
  };

  const updateUserForRecommendation = (batch, userId, userRecord, state, moderationActionId) => {
    if (!userId || state.contentOnly) return null;

    const userRef = doc(db, "users", userId);
    const rec = state.recommendation;
    const reason = report.category || "Validated report";

    if (state.moderationPath === MODERATION_PATHS.FALSE_REPORT_ABUSE) {
      const isRestriction = rec.enforcementType === "report_restriction";
      const until =
        isRestriction && rec.durationDays > 0
          ? Timestamp.fromDate(new Date(Date.now() + rec.durationDays * 24 * 60 * 60 * 1000))
          : null;

      batch.set(
        userRef,
        {
          falseReportAbuseOffenseCount: state.nextOffenseCount,
          reportAbuseActionCount: state.nextOffenseCount,
          reportingDisabled: isRestriction,
          reportRestrictedAt: isRestriction ? serverTimestamp() : deleteField(),
          reportRestrictedUntil: isRestriction ? until : deleteField(),
          reportRestrictionReason: isRestriction ? reason : deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return rec.enforcementType;
    }

    if (state.moderationPath === MODERATION_PATHS.TRANSACTION_RESTRICTION) {
      const isRestriction = rec.enforcementType === "trade_restriction";
      const until =
        isRestriction && rec.durationDays > 0
          ? Timestamp.fromDate(new Date(Date.now() + rec.durationDays * 24 * 60 * 60 * 1000))
          : null;
      const behavior = state.tradeBehavior || getTradeBehavior(userRecord);

      batch.set(
        userRef,
        {
          tradeRestrictionLevel: state.nextOffenseCount,
          tradeLimitedFeatures: isRestriction,
          tradeRestrictedAt: isRestriction ? serverTimestamp() : deleteField(),
          tradeRestrictedUntil: isRestriction ? until : deleteField(),
          tradeSuspendedUntil: isRestriction ? until : deleteField(),
          tradingSuspendedUntil: isRestriction ? until : deleteField(),
          tradeRestrictionReason: isRestriction ? reason : deleteField(),
          cancelledTransactions: Number(behavior.cancelledTransactions || 0),
          completedTransactions: Number(behavior.completedTransactions || 0),
          totalTransactions: Number(behavior.totalTransactions || 0),
          cancelRate: Number(behavior.cancelRate || 0),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return rec.enforcementType;
    }

    const base = {
      offenseCount: state.nextOffenseCount,
      accountStatus: rec.accountStatus,
      lastEnforcementType: rec.enforcementType,
      lastEnforcementReason: reason,
      lastEnforcementAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (rec.enforcementType === "warning") {
      batch.set(
        userRef,
        {
          ...base,
          warningCount: increment(1),
          lastWarningAt: serverTimestamp(),
          suspendedAt: deleteField(),
          suspendedUntil: deleteField(),
          hasActiveWarning: true,
          warningAcknowledged: false,
          warningMessage: rec.message,
        },
        { merge: true }
      );
    } else if (rec.enforcementType === "suspension") {
      const until = Timestamp.fromDate(
        new Date(Date.now() + rec.durationDays * 24 * 60 * 60 * 1000)
      );
      batch.set(
        userRef,
        {
          ...base,
          suspensionCount: increment(1),
          suspendedAt: serverTimestamp(),
          suspendedUntil: until,
          hasActiveWarning: false,
          warningAcknowledged: true,
          warningMessage: deleteField(),
        },
        { merge: true }
      );
    } else if (rec.enforcementType === "ban") {
      batch.set(
        userRef,
        {
          ...base,
          bannedAt: serverTimestamp(),
          forceLogoutAt: serverTimestamp(),
          sessionInvalidatedAt: serverTimestamp(),
          suspendedUntil: null,
          hasActiveWarning: false,
          warningAcknowledged: true,
          warningMessage: deleteField(),
        },
        { merge: true }
      );
    }

    return rec.enforcementType;
  };

  const handleDismiss = async () => {
    if (!report || processing || reportStatus !== "pending") return;
    if (!window.confirm("Dismiss this report?")) return;

    try {
      setProcessing(true);
      const moderationActionId = createModerationActionId();
      const previousReportState = createFieldSnapshot(report, REPORT_UNDO_FIELDS);
      const batch = writeBatch(db);
      const reportUpdate = {
        status: "dismissed",
        reviewStatus: "dismissed",
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid || auth.currentUser?.email || "admin",
        adminAction: "Dismissed Report",
        enforcementAction: "none",
        enforcementType: "none",
        reportReason: report.category || report.details || "Dismissed report",
        reportTargetType: getNormalizedReportType(report),
        reportTargetId: getTargetIdForReport(report) || null,
        undoState: isSourceOnlyReport
          ? null
          : {
              actionId: moderationActionId,
              previousReportState,
              appliedAction: "dismiss",
            },
      };

      if (isSourceOnlyReport) {
        const didUpdate = await updateSourceOnlyReportInBatch(batch, {
          ...reportUpdate,
          reviewedAt: Timestamp.now(),
        });
        if (!didUpdate) throw new Error("Source transaction report was not found.");
      } else {
        batch.set(
          doc(db, "reports", report.id),
          reportUpdate,
          { merge: true }
        );
      }

      await batch.commit();
      setMessage("Report dismissed.");
      await refreshReport();
    } finally {
      setProcessing(false);
    }
  };

  const handleVerify = async () => {
    if (!report || processing || reportStatus !== "pending" || !recommendation) return;
    if (!window.confirm("Verify this report and apply the selected action?")) return;

    try {
      setProcessing(true);
      const moderationActionId = createModerationActionId();
      const batch = writeBatch(db);
      const effectiveTargetUserId = recommendation.targetUserId;
      const effectiveUserRecord = getUserById(effectiveTargetUserId);
      const userUndoState = effectiveTargetUserId
        ? createFieldSnapshot(effectiveUserRecord || {}, USER_UNDO_FIELDS)
        : null;
      const previousReportState = createFieldSnapshot(report, REPORT_UNDO_FIELDS);
      const shouldTakeDownContent =
        selectedAction === "content_removal" ||
        (contentTarget &&
          recommendation.moderationPath === MODERATION_PATHS.VIOLATION &&
          recommendation.recommendation.enforcementType !== "warning");
      const { contentAction, contentUndoState } = shouldTakeDownContent
        ? await applyContentTakedown(batch, moderationActionId)
        : { contentAction: null, contentUndoState: null };

      updateUserForRecommendation(
        batch,
        effectiveTargetUserId,
        effectiveUserRecord,
        recommendation,
        moderationActionId
      );

      const adminAction = contentAction
        ? recommendation.recommendation.enforcementType === "content_removal"
          ? contentAction
          : `${recommendation.recommendation.adminAction} + ${contentAction}`
        : recommendation.recommendation.adminAction;

      const reportUpdate = {
        status: "verified",
        reviewStatus: "verified",
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid || auth.currentUser?.email || "admin",
        adminAction,
        enforcementAction: recommendation.recommendation.enforcementAction,
        enforcementType: recommendation.recommendation.enforcementType,
        reportReason: report.category || report.details || "Verified report",
        reportTargetType: getNormalizedReportType(report),
        reportTargetId: getTargetIdForReport(report) || effectiveTargetUserId || null,
        undoState: isSourceOnlyReport
          ? null
          : {
              actionId: moderationActionId,
              userId: effectiveTargetUserId || null,
              contentTarget: contentAction ? contentTarget : null,
              previousReportState,
              previousUserState: userUndoState,
              previousContentState: contentUndoState,
              appliedAction: selectedAction,
            },
      };

      if (isSourceOnlyReport) {
        const didUpdate = await updateSourceOnlyReportInBatch(batch, {
          ...reportUpdate,
          reviewedAt: Timestamp.now(),
        });
        if (!didUpdate) throw new Error("Source transaction report was not found.");
      } else {
        batch.set(doc(db, "reports", report.id), reportUpdate, { merge: true });
      }

      if (effectiveTargetUserId) {
        const restrictionEndsAt =
          (recommendation.recommendation.enforcementType === "trade_restriction" ||
            recommendation.recommendation.enforcementType === "report_restriction") &&
          recommendation.recommendation.durationDays > 0
            ? Timestamp.fromDate(
                new Date(
                  Date.now() +
                    recommendation.recommendation.durationDays * 24 * 60 * 60 * 1000
                )
              )
            : null;

        batch.set(doc(collection(db, "communityAlerts")), {
          userId: effectiveTargetUserId,
          type: recommendation.recommendation.alertType,
          category:
            recommendation.moderationPath === MODERATION_PATHS.TRANSACTION_RESTRICTION
              ? "Trading Privilege Review"
              : recommendation.moderationPath === MODERATION_PATHS.FALSE_REPORT_ABUSE
              ? "Reporting Privilege Review"
              : contentAction
              ? "Content and Account Review"
              : "Account Review",
          message: recommendation.recommendation.message,
          details: report.details || report.category || "Admin reviewed a report.",
          duration: recommendation.recommendation.durationDays || 0,
          restrictionEndsAt,
          reportId: report.id,
          moderationActionId,
          moderationPath: recommendation.moderationPath,
          source: "admin_report_details",
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setMessage(`Success: ${adminAction}`);
      await refreshReport();
    } catch (err) {
      console.error("REPORT DETAIL ACTION ERROR:", err);
      alert("Failed to update report.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 32, textAlign: "center" }}>Loading report...</div>;
  }

  if (!report) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>Report not found.</p>
        <button onClick={() => navigate("/admin/reports")}>Back to Reports</button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6fa",
        padding: "20px 24px 32px",
        display: "flex",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1160, display: "grid", gap: 16 }}>
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
              onClick={() => navigate("/admin/reports")}
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
              Reports
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
              Report {isSourceOnlyReport ? "" : `#${report.id}`}
            </span>
          </div>

          <button
            onClick={() => navigate("/admin/reports")}
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
            <FaArrowLeft size={11} /> Back to Reports
          </button>
        </div>

        <div style={panelStyle({ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" })}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
              ClosetLoop Report Review
            </p>
            <h1 style={{ margin: "5px 0 0", fontSize: 26, color: "#111827" }}>
              {getTargetDisplayName(report)}
            </h1>
            <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 13 }}>
              Report ID: {isSourceOnlyReport ? "" : report.id}
            </p>
          </div>
          <span
            style={{
              alignSelf: "flex-start",
              background: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
              borderRadius: 999,
              padding: "7px 11px",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "capitalize",
            }}
          >
            {reportStatus}
          </span>
        </div>

        {message && (
          <div style={{ ...panelStyle({ padding: "12px 14px" }), color: "#2f6b4f", fontSize: 13 }}>
            {message}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.65fr)", gap: 16 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={panelStyle()}>
              <SectionTitle icon={<FaFileAlt />} title="Report Details" subtitle="Complaint metadata and submitted reason." />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <DetailRow label="Type" value={getReportTypeLabel(report)} />
                <DetailRow label="Category" value={report.category || EMPTY_VALUE} />
                <DetailRow label="Submitted" value={formatDateTime(report.createdAt)} />
                <DetailRow label="Reviewed" value={formatDateTime(report.reviewedAt)} />
              </div>
            </div>

            <div style={panelStyle()}>
              <SectionTitle icon={<FaImage />} title="Reported Content Preview" subtitle="Content or profile data connected to this report." />
              <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 320px) 1fr", gap: 14 }}>
                <div
                  style={{
                    border: "1px solid #eef1f4",
                    borderRadius: 12,
                    background: "#f8fafc",
                    minHeight: 240,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {contentImage ? (
                    <img src={contentImage} alt="Reported content" style={{ width: "100%", height: "100%", minHeight: 240, objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "#9ca3af", fontSize: 12, padding: 16, textAlign: "center" }}>
                      No image available
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <DetailRow label={getReportedContentTitleLabel(report)} value={contentTitle} />
                  <DetailRow label={getReportedContentBodyLabel(report)} value={contentBody} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <DetailRow label="Owner / Author" value={contentOwner} />
                    <DetailRow label="Target Type" value={targetType} />
                    <DetailRow label="Target ID" value={targetId} />
                  </div>
                </div>
              </div>
            </div>

            <div style={panelStyle()}>
              <SectionTitle icon={<FaFlag />} title="Report Description" subtitle="Admin-facing complaint details." />
              <div style={{ background: "#fafafa", border: "1px solid #eef1f4", borderRadius: 12, padding: 14, color: "#374151", fontSize: 14, lineHeight: 1.55 }}>
                {report.details || report.description || EMPTY_VALUE}
              </div>
            </div>

            <div style={panelStyle()}>
              <SectionTitle icon={<FaShieldAlt />} title="Review & Evidence" subtitle="Recommended path and currently selected decision." />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                <DetailRow label="Selected Action" value={ACTION_OPTIONS.find((item) => item.value === selectedAction)?.label} />
                <DetailRow label="Recommended Action" value={recommendation?.recommendation?.adminAction || EMPTY_VALUE} />
                <DetailRow label="Severity" value={recommendation?.severity || "manual"} />
                <DetailRow label="Content Target" value={contentTarget ? `${contentTarget.collectionName}/${contentTarget.docId}` : "None"} />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div style={panelStyle()}>
              <SectionTitle icon={<FaUser />} title="Reported User" subtitle="User affected by account-level actions." />
              <div style={{ display: "grid", gap: 10 }}>
                <DetailRow label="Name" value={targetUser ? getUserName(targetUser) : report.reportedName || EMPTY_VALUE} />
                <DetailRow label="Email" value={targetUser ? getUserEmail(targetUser) : EMPTY_VALUE} />
                <DetailRow label="User ID" value={targetUserId || EMPTY_VALUE} />
                <DetailRow label="Reported By" value={reporter ? getUserName(reporter) : report.reporterName || EMPTY_VALUE} />
              </div>
            </div>

            <div style={panelStyle()}>
              <SectionTitle icon={<FaExclamationTriangle />} title="User Violations" subtitle="Current counts before this decision." />
              <div style={{ display: "grid", gap: 10 }}>
                <DetailRow label="Offense Count" value={currentOffenseCount} />
                <DetailRow label="Warnings" value={Number(targetUser?.warningCount || 0)} />
                <DetailRow label="Suspensions" value={Number(targetUser?.suspensionCount || 0)} />
                <DetailRow label="Account Status" value={targetUser?.accountStatus || "active"} />
                <DetailRow label="Reporter Dismissed Reports" value={reporterStats.dismissedReports} />
              </div>
            </div>
          </div>
        </div>

        <div style={panelStyle({ borderTop: `3px solid ${PRIMARY}` })}>
          <SectionTitle
            icon={<FaBan />}
            title="Admin Action"
            subtitle="Choose one action, then verify or dismiss the report."
          />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 400px) 1fr", gap: 12, alignItems: "start" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6 }}>
                Action
              </label>
              <select
                value={selectedAction}
                onChange={(event) => setSelectedAction(event.target.value)}
                disabled={reportStatus !== "pending" || processing}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  fontSize: 13,
                  outline: "none",
                }}
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                {ACTION_HELPERS[selectedAction]}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", alignSelf: "end" }}>
              <button
                onClick={handleDismiss}
                disabled={processing || reportStatus !== "pending"}
                style={{
                  border: "1px solid #f7c8d4",
                  background: "#fdecef",
                  color: "#9f274d",
                  borderRadius: 999,
                  padding: "10px 16px",
                  fontWeight: 800,
                  cursor: processing || reportStatus !== "pending" ? "default" : "pointer",
                  opacity: processing || reportStatus !== "pending" ? 0.65 : 1,
                }}
              >
                Dismiss Report
              </button>
              <button
                onClick={handleVerify}
                disabled={processing || reportStatus !== "pending"}
                style={{
                  border: "1px solid rgba(198,226,198,0.9)",
                  background: "rgba(198,226,198,0.35)",
                  color: "#2f6b4f",
                  borderRadius: 999,
                  padding: "10px 16px",
                  fontWeight: 800,
                  cursor: processing || reportStatus !== "pending" ? "default" : "pointer",
                  opacity: processing || reportStatus !== "pending" ? 0.65 : 1,
                }}
              >
                {processing ? "Processing..." : "Verify Report"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
