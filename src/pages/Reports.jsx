import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  deleteField,
  getDoc,
  getDocs,
  doc,
  onSnapshot,
  query,
  writeBatch,
  serverTimestamp,
  increment,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import AdminStatCard, {
  AdminStatGrid,
} from "../components/AdminStatCard";
import {
  CARD_STYLE,
  CONTENT_UNDO_FIELDS,
  FALSE_REPORT_ABUSE_MIN_DISMISSED_REPORTS,
  FALSE_REPORT_ABUSE_MIN_REVIEWED_REPORTS,
  MAX_UNDO_CHAIN_DEPTH,
  MODERATION_PATHS,
  PRIMARY,
  REPORT_RESTRICTION_STEPS,
  REPORT_UNDO_FIELDS,
  TRADE_RESTRICTION_STEPS,
  USER_UNDO_FIELDS,
} from "./reports/constants";
import { ReportsListSection } from "./reports/ReportsListSection";
import { UserInsightModal } from "./reports/UserInsightModal";
import { UserInsightsSection } from "./reports/UserInsightsSection";
import {
  canApplyFalseReportAbuseAction,
  createFieldSnapshot,
  createModerationActionId,
  getContentActionLabel,
  getContentModerationTarget,
  getExistingEnforcementSummary,
  getFalseReportAbuseDurationForOffense,
  getFalseReportAbuseOffenseCount,
  getImageFromSourceRecord,
  getInsightTradeRestrictionStatus,
  getModerationScopeLabel,
  getNormalizedReportType,
  getOffenseCountForUser,
  getPathLabel,
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
  getReportingRestrictionStatus,
  getSeverity,
  getSeverityOverrideRecommendation,
  getSourceTargetsForReport,
  getTargetIdForReport,
  getTradeRestrictionStatus,
  getTimedRestrictionDuration,
  isFalseReportAbuseEligible,
  isProtectedDuplicateCase,
  materializeFieldSnapshot,
  normalizeText,
  restoreFieldSnapshot,
  toMillis,
} from "./reports/utils";

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [processingAction, setProcessingAction] = useState(false);
  const [insightTab, setInsightTab] = useState("reported");
  const [resolvedPreviewImage, setResolvedPreviewImage] = useState(null);
  const [selectedInsightUser, setSelectedInsightUser] = useState(null);

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

  const hasReportPayload = (value) => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") {
      return Object.values(value).some((entry) => {
        if (entry === null || entry === undefined) return false;
        if (typeof entry === "object") return hasReportPayload(entry);
        return entry.toString().trim() !== "";
      });
    }
    return value.toString().trim() !== "";
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

    if (hasReportPayload(embedded)) return [embedded];

    return hasReportPayload({
      reportId: tx?.reportId,
      reportReason: tx?.reportReason,
      reportCategory: tx?.reportCategory,
      reportDetails: tx?.reportDetails,
      reportDescription: tx?.reportDescription,
      reportMessage: tx?.reportMessage,
      reporterId: tx?.reporterId,
      reporterUid: tx?.reporterUid,
      reportedBy: tx?.reportedBy,
      reportedUserId: tx?.reportedUserId,
      targetUserId: tx?.targetUserId,
    })
      ? [
          {
            id: tx?.reportId || null,
            category: tx?.reportCategory || tx?.reportReason || null,
            details:
              tx?.reportDetails ||
              tx?.reportDescription ||
              tx?.reportMessage ||
              tx?.reportReason ||
              null,
            reporterId: tx?.reporterId || tx?.reporterUid || tx?.reportedBy || null,
            reportedUserId: tx?.reportedUserId || tx?.targetUserId || null,
            status: tx?.reportStatus || tx?.reviewStatus || "pending",
            createdAt: tx?.reportedAt || tx?.reportCreatedAt || tx?.reportSubmittedAt || null,
          },
        ]
      : [];
  };

  const hasEmbeddedTransactionReport = (tx) =>
    Boolean(
      tx?.isReported === true ||
        tx?.reported === true ||
        tx?.hasReport === true ||
        tx?.reportSubmitted === true ||
        tx?.reportId ||
        tx?.reportReason ||
        tx?.reportCategory ||
        tx?.reportDetails ||
        tx?.reportDescription ||
        tx?.reportMessage ||
        tx?.reporterId ||
        tx?.reporterUid ||
        tx?.reportedBy ||
        tx?.reportedById ||
        tx?.reportedUserId ||
        tx?.targetUserId ||
        hasReportPayload(tx?.report) ||
        hasReportPayload(tx?.reportData) ||
        hasReportPayload(tx?.reportInfo) ||
        hasReportPayload(tx?.transactionReport) ||
        hasReportPayload(tx?.transactionReports) ||
        hasReportPayload(tx?.reports) ||
        hasReportPayload(tx?.dispute) ||
        hasReportPayload(tx?.complaint)
    );

  const buildReportFromTradeRequest = (tx, userLookup, postLookup, embedded = {}) => {
    const getResolvedUserNameOrNull = (user) => (user ? getResolvedUserName(user) : null);
    const ownerId = tx.ownerId || tx.ownerUid || null;
    const requesterId = tx.requesterId || tx.requesterUid || null;
    const reporterId = firstValue(
      tx.reporterId,
      tx.reporterUid,
      tx.reportedBy,
      tx.reportedById,
      tx.reportSubmittedBy,
      tx.reportSubmittedById,
      embedded.reporterId,
      embedded.reporterUid,
      embedded.reportedBy,
      embedded.reportedById,
      embedded.submittedBy,
      embedded.userId
    );
    const reportedUserId = firstValue(
      tx.reportedUserId,
      tx.targetUserId,
      tx.reportedId,
      embedded.reportedUserId,
      embedded.targetUserId,
      embedded.reportedId,
      reporterId && reporterId === ownerId ? requesterId : null,
      reporterId && reporterId === requesterId ? ownerId : null,
      ownerId
    );
    const postId =
      tx.requestedPostId || tx.postId || tx.itemId || tx.targetPostId || null;
    const post = postId ? postLookup[postId] : null;
    const reporter = reporterId ? userLookup[reporterId] : null;
    const reportedUser = reportedUserId ? userLookup[reportedUserId] : null;
    const category = firstValue(
      tx.reportCategory,
      tx.reportReason,
      tx.reasonForReport,
      embedded.category,
      embedded.reportCategory,
      embedded.reason,
      embedded.reportReason,
      "Transaction Report"
    );
    const details = firstValue(
      tx.reportDetails,
      tx.reportDescription,
      tx.reportMessage,
      tx.reportReason,
      tx.reasonForReport,
      embedded.details,
      embedded.description,
      embedded.message,
      embedded.reportDetails,
      embedded.reportDescription,
      embedded.reportMessage,
      embedded.reason,
      "Transaction report submitted from trade request."
    );

    return enrichTransactionReport(
      {
        id: embedded.id || tx.reportId || `tradeRequest-${tx.id}`,
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
        category,
        details,
        reporterId: reporterId || null,
        reportedUserId: reportedUserId || null,
        reporterName: firstValue(
          embedded.reporterName,
          tx.reporterName,
          getResolvedUserNameOrNull(reporter),
          "Unknown"
        ),
        reportedName: firstValue(
          embedded.reportedName,
          tx.reportedName,
          getResolvedUserNameOrNull(reportedUser),
          post?.title,
          tx.itemTitle,
          tx.itemName,
          "Transaction user"
        ),
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
        status: embedded.status || embedded.reviewStatus || tx.reportStatus || tx.reviewStatus || "pending",
        reviewStatus: embedded.status || embedded.reviewStatus || tx.reportStatus || tx.reviewStatus || "pending",
      },
      { [tx.id]: tx },
      userLookup,
      postLookup
    );
  };

  const enrichTransactionReport = (report, txLookup, userLookup, postLookup) => {
    if (getNormalizedReportType(report) !== "transaction") return report;

    const txId = getTargetIdForReport(report);
    const tx =
      txLookup[report?.tradeRequestId] ||
      txLookup[report?.transactionId] ||
      txLookup[report?.tradeId] ||
      txLookup[report?.requestId] ||
      txLookup[txId] ||
      null;

    if (!tx) return report;

    const ownerId = tx.ownerId || tx.ownerUid || null;
    const requesterId = tx.requesterId || tx.requesterUid || null;
    const owner = ownerId ? userLookup[ownerId] : null;
    const requester = requesterId ? userLookup[requesterId] : null;
    const postId =
      tx.requestedPostId || tx.postId || tx.itemId || tx.targetPostId || null;
    const post = postId ? postLookup[postId] : null;

    return {
      ...report,
      transactionId: report.transactionId || tx.id,
      tradeRequestId: report.tradeRequestId || tx.id,
      transactionStatus: report.transactionStatus || tx.status || null,
      tradeStatus: report.tradeStatus || tx.status || null,
      transactionType: report.transactionType || tx.type || tx.method || null,
      transactionTitle:
        report.transactionTitle ||
        report.tradeTitle ||
        report.itemTitle ||
        report.postTitle ||
        post?.title ||
        tx.itemName ||
        tx.postTitle ||
        tx.itemTitle ||
        tx.title ||
        "Transaction record",
      transactionDetails:
        report.transactionDetails ||
        report.tradeDetails ||
        tx.cancelReason ||
        tx.reason ||
        tx.description ||
        null,
      transactionSummary:
        report.transactionSummary ||
        report.tradeSummary ||
        [tx.type || tx.method, tx.status].filter(Boolean).join(" | ") ||
        null,
      requestedPostId: report.requestedPostId || postId,
      postId: report.postId || postId,
      postTitle: report.postTitle || post?.title || tx.postTitle || null,
      targetImageUrl:
        report.targetImageUrl ||
        report.reportedImageUrl ||
        post?.image ||
        tx.imageUrl ||
        null,
      ownerId: report.ownerId || ownerId,
      requesterId: report.requesterId || requesterId,
      ownerName: report.ownerName || getResolvedUserName(owner),
      requesterName: report.requesterName || getResolvedUserName(requester),
      reportedName:
        report.reportedName ||
        post?.title ||
        tx.itemName ||
        tx.postTitle ||
        getResolvedUserName(owner),
    };
  };

  useEffect(() => {
    let isDisposed = false;
    let reportsDocs = null;
    let usersDocs = null;
    let txDocs = null;
    let postsDocs = null;

    const syncCancelledTransactionCounts = async (txData, userData) => {
      const cancelCountByUser = {};

      txData.forEach((tx) => {
        const status = (tx.status || "").toString().trim().toLowerCase();
        if (!status.includes("cancel") || !tx.cancelledBy) return;
        cancelCountByUser[tx.cancelledBy] =
          (cancelCountByUser[tx.cancelledBy] || 0) + 1;
      });

      const batch = writeBatch(db);
      let hasWrites = false;

      userData.forEach((user) => {
        const nextCount = cancelCountByUser[user.id] || 0;
        const currentCancelCount = Number(user.cancelCount || 0);
        const currentCancelledTransactions = Number(
          user.cancelledTransactions || 0
        );

        if (
          currentCancelCount === nextCount &&
          currentCancelledTransactions === nextCount
        ) {
          return;
        }

        hasWrites = true;
        batch.set(
          doc(db, "users", user.id),
          {
            cancelCount: nextCount,
            cancelledTransactions: nextCount,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      if (hasWrites) {
        await batch.commit();
      }
    };

    const recomputeState = async () => {
      if (!reportsDocs || !usersDocs || !txDocs || !postsDocs) return;

      try {
        const userData = usersDocs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const txData = txDocs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const userLookup = {};
        userData.forEach((user) => {
          userLookup[user.id] = user;
          if (user.uid) userLookup[user.uid] = user;
        });

        const txLookup = {};
        txData.forEach((tx) => {
          txLookup[tx.id] = tx;
        });

        const postLookup = {};
        postsDocs.forEach((d) => {
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

        const reportData = reportsDocs.map((d) =>
          enrichTransactionReport(
            buildStoredReport(d),
            txLookup,
            userLookup,
            postLookup
          )
        );
        const reportedTransactionIds = new Set(
          reportData
            .map((report) =>
              getNormalizedReportType(report) === "transaction"
                ? report.tradeRequestId ||
                  report.transactionId ||
                  report.tradeId ||
                  report.requestId ||
                  getTargetIdForReport(report)
                : null
            )
            .filter(Boolean)
        );
        const reportedTransactionReportIds = new Set(
          reportData
            .map((report) => report.sourceReportId || report.id)
            .filter(Boolean)
        );
        const embeddedTransactionReports = txData
          .filter(
            (tx) =>
              hasEmbeddedTransactionReport(tx) &&
              (getEmbeddedTransactionReports(tx).some(
                (entry) => entry?.id && !reportedTransactionReportIds.has(entry.id)
              ) ||
                !reportedTransactionIds.has(tx.id))
          )
          .flatMap((tx) =>
            getEmbeddedTransactionReports(tx)
              .filter(
                (entry) =>
                  !entry?.id || !reportedTransactionReportIds.has(entry.id)
              )
              .map((entry, index) =>
                buildReportFromTradeRequest(
                  tx,
                  userLookup,
                  postLookup,
                  entry?.id
                    ? entry
                    : { ...entry, id: `tradeRequest-${tx.id}-${index + 1}` }
                )
              )
          );

        if (!isDisposed) {
          setReports([...reportData, ...embeddedTransactionReports]);
          setUsers(userData);
          setLoading(false);
        }

        await syncCancelledTransactionCounts(txData, userData);
      } catch (err) {
        console.error("REPORTS LOAD ERROR:", err);
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    const handleSnapshotError = (err) => {
      console.error("REPORTS SNAPSHOT ERROR:", err);
      if (!isDisposed) {
        setLoading(false);
      }
    };

    const reportsUnsub = onSnapshot(
      collection(db, "reports"),
      (snapshot) => {
        reportsDocs = snapshot.docs;
        void recomputeState();
      },
      handleSnapshotError
    );
    const usersUnsub = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        usersDocs = snapshot.docs;
        void recomputeState();
      },
      handleSnapshotError
    );
    const txUnsub = onSnapshot(
      collection(db, "tradeRequests"),
      (snapshot) => {
        txDocs = snapshot.docs;
        void recomputeState();
      },
      handleSnapshotError
    );
    const postsUnsub = onSnapshot(
      collection(db, "posts"),
      (snapshot) => {
        postsDocs = snapshot.docs;
        void recomputeState();
      },
      handleSnapshotError
    );

    return () => {
      isDisposed = true;
      reportsUnsub();
      usersUnsub();
      txUnsub();
      postsUnsub();
    };
  }, []);

  useEffect(() => {
    if (selectedReport) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [selectedReport]);

  useEffect(() => {
    let isActive = true;

    const loadPreviewImage = async () => {
      if (!selectedReport) {
        setResolvedPreviewImage(null);
        return;
      }

      const existingImage = getReportedContentImage(selectedReport);
      if (existingImage) {
        setResolvedPreviewImage(null);
        return;
      }

      const sourceTargets = getSourceTargetsForReport(selectedReport);
      if (!sourceTargets.length) {
        setResolvedPreviewImage(null);
        return;
      }

      for (const target of sourceTargets) {
        try {
          const sourceSnap = await getDoc(
            doc(db, target.collectionName, target.docId)
          );

          if (!sourceSnap.exists()) continue;

          const image = getImageFromSourceRecord(sourceSnap.data());
          if (image) {
            if (isActive) setResolvedPreviewImage(image);
            return;
          }
        } catch (err) {
          console.error("REPORT PREVIEW IMAGE LOAD ERROR:", err);
        }
      }

      if (isActive) setResolvedPreviewImage(null);
    };

    loadPreviewImage();

    return () => {
      isActive = false;
    };
  }, [selectedReport]);

  const stats = useMemo(() => {
    const pending = reports.filter((r) => getReportStatus(r) === "pending").length;
    const verified = reports.filter((r) => getReportStatus(r) === "verified").length;
    const dismissed = reports.filter((r) => getReportStatus(r) === "dismissed").length;

    const warnedUsers = users.filter(
      (u) => normalizeText(u.accountStatus) === "warned"
    ).length;

    const suspendedUsers = users.filter((u) => {
      const status = normalizeText(u.accountStatus);
      const untilMs = toMillis(u.suspendedUntil);
      return status === "suspended" && untilMs > Date.now();
    }).length;

    const bannedUsers = users.filter(
      (u) => normalizeText(u.accountStatus) === "banned"
    ).length;
    const transactionReports = reports.filter(
      (r) => getNormalizedReportType(r) === "transaction"
    ).length;
    const limitedTradeUsers = users.filter(
      (u) => getInsightTradeRestrictionStatus(u).isActive
    ).length;
    const reportingRestrictedUsers = users.filter(
      (u) => getReportingRestrictionStatus(u).isActive
    ).length;

    return {
      total: reports.length,
      pending,
      verified,
      dismissed,
      transactionReports,
      limitedTradeUsers,
      reportingRestrictedUsers,
      warnedUsers,
      suspendedUsers,
      bannedUsers,
    };
  }, [reports, users]);

  const mostReportedUsers = useMemo(() => {
    const grouped = reports.reduce((acc, report) => {
      const userId = getRelatedUserIdForReport(report);

      if (!userId) return acc;

      if (!acc[userId]) {
        acc[userId] = {
          id: userId,
          name: report.reportedName || "Unknown User",
          meta: report.reportedName ? userId : "No user details",
          count: 0,
        };
      }

      acc[userId].count += 1;

      if (
        (!acc[userId].name || acc[userId].name === "Unknown User") &&
        report.reportedName
      ) {
        acc[userId].name = report.reportedName;
      }

      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [reports]);

  const topCancelledUsers = useMemo(() => {
    return [...users]
      .map((u) => {
        const restriction = getTradeRestrictionStatus(u);
        const insightRestriction = getInsightTradeRestrictionStatus(u);

        return {
          id: u.id,
          name: u.displayName || u.name || u.username || u.email || "Unknown User",
          meta: u.email || u.id,
          count: restriction.cancelledTransactions,
          isLimited: insightRestriction.isActive,
          suspendedUntil: restriction.suspendedUntil,
        };
      })
      .filter((u) => u.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [users]);

  const filteredReports = useMemo(() => {
    let list = [...reports];
    const q = search.trim().toLowerCase();

    if (q) {
      list = list.filter((r) => {
        const fields = [
          r.id,
          r.category,
          r.details,
          r.reporterName,
          r.reportedName,
          r.type,
          r.status,
          r.reviewStatus,
          r.adminAction,
          r.enforcementAction,
          r.reporterId,
          r.reportedUserId,
          r.postId,
          r.transactionId,
          r.tradeRequestId,
          r.sourceDocId,
          r.transactionTitle,
          r.tradeTitle,
        ];

        return fields
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      });
    }

    list = list.filter((r) => {
      const status = getReportStatus(r);
      const type = getNormalizedReportType(r);
      const relatedUserId = getRelatedUserIdForReport(r);
      const relatedUser = relatedUserId
        ? users.find((u) => u.id === relatedUserId) || null
        : null;

      const statusMatch =
        statusFilter === "all" ? true : status === statusFilter;

      let quickFilterMatch = true;
      if (quickFilter === "pending" || quickFilter === "verified" || quickFilter === "dismissed") {
        quickFilterMatch = status === quickFilter;
      } else if (quickFilter === "warned") {
        quickFilterMatch = normalizeText(relatedUser?.accountStatus) === "warned";
      } else if (quickFilter === "suspended") {
        quickFilterMatch =
          normalizeText(relatedUser?.accountStatus) === "suspended" &&
          toMillis(relatedUser?.suspendedUntil) > Date.now();
      } else if (quickFilter === "banned") {
        quickFilterMatch = normalizeText(relatedUser?.accountStatus) === "banned";
      } else if (quickFilter === "limited") {
        quickFilterMatch = getInsightTradeRestrictionStatus(relatedUser).isActive;
      } else if (quickFilter === "report_limited") {
        const reporterUser = getReportReporterId(r)
          ? users.find((u) => u.id === getReportReporterId(r)) || null
          : null;
        quickFilterMatch = getReportingRestrictionStatus(reporterUser).isActive;
      }

      let typeMatch = true;
      if (typeFilter !== "all") {
        if (typeFilter === "diy") {
          typeMatch = type.includes("diy");
        } else {
          typeMatch = type === typeFilter;
        }
      }

      return statusMatch && typeMatch && quickFilterMatch;
    });

    if (sortBy === "newest") {
      list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    } else if (sortBy === "name_asc") {
      list.sort((a, b) =>
        String(a.reportedName || "").localeCompare(String(b.reportedName || ""))
      );
    } else if (sortBy === "status_asc") {
      list.sort((a, b) =>
        String(getReportStatus(a)).localeCompare(String(getReportStatus(b)))
      );
    }

    return list;
  }, [reports, users, statusFilter, typeFilter, quickFilter, sortBy, search]);

  const updateLocalReport = (reportId, changes) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, ...changes } : r))
    );

    setSelectedReport((prev) =>
      prev && prev.id === reportId ? { ...prev, ...changes } : prev
    );
  };

  const upsertLocalUser = (userId, changes) => {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === userId);

      if (!exists) {
        return [...prev, { id: userId, ...changes }];
      }

      return prev.map((u) => (u.id === userId ? { ...u, ...changes } : u));
    });
  };

  const handleStatCardFilter = (filterKey) => {
    if (filterKey === "all") {
      setQuickFilter("all");
      setStatusFilter("all");
      setTypeFilter("all");
      return;
    }

    if (filterKey === "transaction") {
      setQuickFilter("all");
      setStatusFilter("all");
      setTypeFilter("transaction");
      return;
    }

    if (filterKey === "limited") {
      setQuickFilter("limited");
      setStatusFilter("all");
      return;
    }

    if (filterKey === "report_limited") {
      setQuickFilter("report_limited");
      setStatusFilter("all");
      return;
    }

    setQuickFilter(filterKey);

    if (
      filterKey === "pending" ||
      filterKey === "verified" ||
      filterKey === "dismissed"
    ) {
      setStatusFilter(filterKey);
      return;
    }

    setStatusFilter("all");
  };

  const getUserRecordById = (userId, fallback = {}) => {
    if (!userId) return null;

    return users.find((u) => u.id === userId) || {
      id: userId,
      offenseCount: 0,
      warningCount: 0,
      suspensionCount: 0,
      falseReports: 0,
      falseReportWarningCount: 0,
      falseReportAbuseOffenseCount: 0,
      tradeRestrictionLevel: 0,
      ...fallback,
    };
  };

  const findReportByModerationActionId = (actionId) => {
    const normalizedActionId = normalizeText(actionId);

    if (!normalizedActionId) return null;

    return (
      reports.find(
        (entry) => normalizeText(entry?.moderationActionId) === normalizedActionId
      ) || null
    );
  };

  const getUndoConflictDetails = (report, scope, currentRecord) => {
    const undoActionId = normalizeText(report?.undoState?.actionId);
    const currentActionId = normalizeText(currentRecord?.lastModerationActionId);

    if (!undoActionId || !currentActionId || currentActionId === undoActionId) {
      return null;
    }

    const blockingReport =
      (scope === "user" &&
        currentRecord?.lastModeratedReportId &&
        reports.find((entry) => entry.id === currentRecord.lastModeratedReportId)) ||
      findReportByModerationActionId(currentActionId);

    const scopeLabel = scope === "content" ? "content" : "user";

    return {
      scope,
      blockingReport,
      message:
        blockingReport && blockingReport.id !== report?.id
          ? `A newer moderation already changed this ${scopeLabel} on report ${blockingReport.id}. Undo that latest action first.`
          : `A newer moderation already changed this ${scopeLabel}. Undo the latest action first.`,
    };
  };

  const getLocalUndoConflict = (report) => {
    if (!report?.undoState?.actionId) return null;

    const undoState = report.undoState;
    const userId =
      undoState.userId ||
      report.reportedUserId ||
      report.targetUserId ||
      report.reportedId ||
      null;

    if (userId && undoState.previousUserState) {
      const userConflict = getUndoConflictDetails(
        report,
        "user",
        getUserRecordById(userId)
      );

      if (userConflict) return userConflict;
    }

    return null;
  };

  const getLinkedModerationActionIds = (report) => {
    const actionIds = [
      report?.moderationActionId,
      report?.undoState?.actionId,
      report?.lastModerationActionId,
    ]
      .map((value) => normalizeText(value))
      .filter(Boolean);

    return [...new Set(actionIds)];
  };

  const getLinkedCommunityAlerts = async (report) => {
    const alertsById = new Map();

    const reportId = report?.id || null;
    if (reportId) {
      const reportAlertsSnap = await getDocs(
        query(collection(db, "communityAlerts"), where("reportId", "==", reportId))
      );

      reportAlertsSnap.forEach((alertDoc) => {
        alertsById.set(alertDoc.id, alertDoc);
      });
    }

    for (const actionId of getLinkedModerationActionIds(report)) {
      const actionAlertsSnap = await getDocs(
        query(
          collection(db, "communityAlerts"),
          where("moderationActionId", "==", actionId)
        )
      );

      actionAlertsSnap.forEach((alertDoc) => {
        alertsById.set(alertDoc.id, alertDoc);
      });
    }

    return [...alertsById.values()];
  };

  async function resolveUndoPrerequisites(report, revertedIds, activeUndoIds) {
    const undoState = report?.undoState || null;
    const reportRef = doc(db, "reports", report.id);
    const userId =
      undoState?.userId ||
      report.reportedUserId ||
      report.targetUserId ||
      report.reportedId ||
      null;
    const contentTarget = undoState?.contentTarget || null;

    if (!undoState) {
      return {
        undoState,
        reportRef,
        userId,
        contentTarget,
      };
    }

    for (let depth = 0; depth < MAX_UNDO_CHAIN_DEPTH; depth += 1) {
      if (userId && undoState.previousUserState) {
        const userRef = doc(db, "users", userId);
        const currentUserSnap = await getDoc(userRef);

        if (!currentUserSnap.exists()) {
          throw new Error(
            "The moderated user no longer exists. Restore the user record before undoing this action."
          );
        }

        const currentUserData = currentUserSnap.data();
        const currentActionId = normalizeText(
          currentUserData?.lastModerationActionId
        );
        const undoActionId = normalizeText(undoState.actionId);

        if (
          currentActionId &&
          undoActionId &&
          currentActionId !== undoActionId
        ) {
          const conflict = getUndoConflictDetails(
            report,
            "user",
            currentUserData
          );

          if (
            conflict?.blockingReport &&
            conflict.blockingReport.id !== report.id
          ) {
            await runUndoActionInternal(
              conflict.blockingReport,
              revertedIds,
              activeUndoIds
            );
            continue;
          }

          throw new Error(
            conflict?.message ||
              "A newer moderation already changed this user. Undo the latest action first."
          );
        }
      }

      if (
        contentTarget?.collectionName &&
        contentTarget?.docId &&
        undoState?.previousContentState
      ) {
        const contentRef = doc(
          db,
          contentTarget.collectionName,
          contentTarget.docId
        );
        const currentContentSnap = await getDoc(contentRef);

        if (!currentContentSnap.exists()) {
          throw new Error(
            "The moderated content no longer exists. Restore the post record before undoing this action."
          );
        }

        const currentContentData = currentContentSnap.data();
        const currentContentActionId = normalizeText(
          currentContentData?.lastModerationActionId
        );
        const undoActionId = normalizeText(undoState.actionId);

        if (
          currentContentActionId &&
          undoActionId &&
          currentContentActionId !== undoActionId
        ) {
          const conflict = getUndoConflictDetails(
            report,
            "content",
            currentContentData
          );

          if (
            conflict?.blockingReport &&
            conflict.blockingReport.id !== report.id
          ) {
            await runUndoActionInternal(
              conflict.blockingReport,
              revertedIds,
              activeUndoIds
            );
            continue;
          }

          throw new Error(
            conflict?.message ||
              "A newer moderation already changed this content. Undo the latest action first."
          );
        }
      }

      return {
        undoState,
        reportRef,
        userId,
        contentTarget,
      };
    }

    throw new Error(
      "Undo could not resolve the moderation chain automatically. Open the latest moderation and retry from there."
    );
  }

  async function runUndoActionInternal(
    report,
    revertedIds = new Set(),
    activeUndoIds = new Set()
  ) {
    if (activeUndoIds.has(report.id)) {
      throw new Error(
        "A moderation undo loop was detected. Open the latest moderation and undo it directly."
      );
    }

    activeUndoIds.add(report.id);

    try {
      const { undoState, reportRef, userId, contentTarget } =
        await resolveUndoPrerequisites(report, revertedIds, activeUndoIds);
      const batch = writeBatch(db);

      if (!undoState) {
        batch.set(
          reportRef,
          {
            reviewStatus: "pending",
            status: "pending",
            adminAction: deleteField(),
            enforcementAction: deleteField(),
            moderationActionId: deleteField(),
            reviewedAt: deleteField(),
            closedAt: deleteField(),
            undoState: deleteField(),
            undoAppliedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await batch.commit();

        updateLocalReport(report.id, {
          reviewStatus: "pending",
          status: "pending",
          adminAction: null,
          enforcementAction: null,
          moderationActionId: null,
          reviewedAt: null,
          closedAt: null,
          undoState: null,
          undoAppliedAt: { seconds: Math.floor(Date.now() / 1000) },
        });

        revertedIds.add(report.id);
        return;
      }

      if (userId && undoState.previousUserState) {
        const userRef = doc(db, "users", userId);
        batch.set(
          userRef,
          {
            ...restoreFieldSnapshot(undoState.previousUserState),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (
        contentTarget?.collectionName &&
        contentTarget?.docId &&
        undoState?.previousContentState
      ) {
        const contentRef = doc(
          db,
          contentTarget.collectionName,
          contentTarget.docId
        );

        batch.set(
          contentRef,
          {
            ...restoreFieldSnapshot(undoState.previousContentState),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      batch.set(
        reportRef,
        {
          ...restoreFieldSnapshot(undoState.previousReportState),
          undoState: deleteField(),
          undoAppliedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (undoState.actionId) {
        const alertsSnap = await getDocs(
          query(
            collection(db, "communityAlerts"),
            where("reportId", "==", report.id),
            where("moderationActionId", "==", undoState.actionId)
          )
        );

        alertsSnap.forEach((alertDoc) => {
          batch.set(
            doc(db, "communityAlerts", alertDoc.id),
            {
              isReverted: true,
              revertedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });
      }

      await batch.commit();

      updateLocalReport(report.id, {
        ...Object.entries(undoState.previousReportState || {}).reduce(
          (restored, [key, entry]) => {
            restored[key] = entry?.exists ? entry.value : null;
            return restored;
          },
          {}
        ),
        undoState: null,
        undoAppliedAt: { seconds: Math.floor(Date.now() / 1000) },
      });

      if (userId && undoState.previousUserState) {
        const restoredLocalUserState = materializeFieldSnapshot(
          undoState.previousUserState,
          USER_UNDO_FIELDS
        );
        upsertLocalUser(userId, restoredLocalUserState);
      }

      revertedIds.add(report.id);
    } finally {
      activeUndoIds.delete(report.id);
    }
  }

  const getReporterBehavior = (reporterId) => {
    if (!reporterId) {
      return {
        totalReports: 0,
        reviewedReports: 0,
        validReports: 0,
        dismissedReports: 0,
        dismissRate: 0,
      };
    }

    const summary = reports.reduce(
      (summary, entry) => {
        if (getReportReporterId(entry) !== reporterId) return summary;

        summary.totalReports += 1;

        const status = getReportStatus(entry);
        if (status === "verified" || status === "dismissed") {
          summary.reviewedReports += 1;
        }
        if (status === "verified") summary.validReports += 1;
        if (status === "dismissed") summary.dismissedReports += 1;

        return summary;
      },
      {
        totalReports: 0,
        reviewedReports: 0,
        validReports: 0,
        dismissedReports: 0,
        dismissRate: 0,
      }
    );

    summary.dismissRate =
      summary.reviewedReports > 0
        ? summary.dismissedReports / summary.reviewedReports
        : 0;

    return summary;
  };

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
    const cancelRate =
      totalTransactions > 0
        ? cancelledTransactions / totalTransactions
        : Number(userRecord?.cancelRate || 0);
    const restrictionLevel = Number(userRecord?.tradeRestrictionLevel || 0);
    const restrictionStatus = getTradeRestrictionStatus(userRecord);

    return {
      cancelledTransactions,
      completedTransactions,
      totalTransactions,
      cancelRate,
      restrictionLevel: Math.max(restrictionLevel, restrictionStatus.restrictionLevel),
      isTradeLimited: restrictionStatus.isLimited,
    };
  };

  const getModerationPathForReport = (report) => {
    const contextText = getReportContextText(report);
    const reporterRecord = getUserRecordById(getReportReporterId(report));
    const reporterStats = getReporterBehavior(getReportReporterId(report));
    const normalSeverity = getSeverity(report, MODERATION_PATHS.VIOLATION);
    const hasStrongViolationSignals =
      normalSeverity === "high" ||
      hasKeyword(contextText, ["scam", "fraud", "impersonation", "harassment"]);

    if (
      isFalseReportAbuseEligible(reporterStats) &&
      !hasStrongViolationSignals
    ) {
      return MODERATION_PATHS.FALSE_REPORT_ABUSE;
    }

    if (
      getNormalizedReportType(report) === "transaction" &&
      hasKeyword(contextText, TRANSACTION_CANCELLATION_KEYWORDS) &&
      !hasKeyword(contextText, ["scam", "fraud", "harassment", "threat"])
    ) {
      return MODERATION_PATHS.TRANSACTION_RESTRICTION;
    }

    return MODERATION_PATHS.VIOLATION;
  };

  const buildViolationRecommendation = (report, pathMeta = {}) => {
    const targetUserId = getRelatedUserIdForReport(report);
    const userRecord = getUserRecordById(targetUserId);
    const currentOffenseCount = getOffenseCountForUser(userRecord);
    const isProtectedDuplicate = isProtectedDuplicateCase(userRecord, report);
    const severity = getSeverity(report, MODERATION_PATHS.VIOLATION);
    const contentActionLabel = getContentModerationTarget(report)
      ? getContentActionLabel(report)
      : null;
    const severityOverride =
      currentOffenseCount === 0 ? getSeverityOverrideRecommendation(report) : null;

    if (isProtectedDuplicate) {
      const reused =
        getExistingEnforcementSummary(userRecord) ||
        getRecommendedEnforcement(currentOffenseCount || 1);

      return {
        moderationPath: MODERATION_PATHS.VIOLATION,
        originPath: pathMeta.originPath || MODERATION_PATHS.VIOLATION,
        pathLabel: getPathLabel(MODERATION_PATHS.VIOLATION),
        scopeLabel: getModerationScopeLabel(MODERATION_PATHS.VIOLATION),
        targetUserId,
        targetRole: "reported_user",
        targetUserLabel: "Reported user",
        userRecord,
        severity,
        currentLevel: currentOffenseCount,
        nextLevel: currentOffenseCount,
        currentOffenseCount,
        nextOffenseCount: currentOffenseCount,
        levelLabel: "Offense Count",
        isProtectedDuplicate: true,
        contentActionLabel,
        recommendation: reused,
        bannerMessage:
          pathMeta.originPath === MODERATION_PATHS.TRANSACTION_RESTRICTION
            ? "Repeated cancellation abuse has escalated into the normal account penalty ladder."
            : "This case follows the full violation ladder.",
        ladderText:
          "1st warning, 2nd 1-day suspension, 3rd 3-day suspension, 4th 7-day suspension, 5th ban.",
        adminGuidance:
          pathMeta.originPath === MODERATION_PATHS.TRANSACTION_RESTRICTION
            ? "Trade abuse has repeated past the restriction stages, so the next enforcement uses the standard account ladder."
            : "Use the verified violation ladder for real misconduct and serious content violations.",
      };
    }

    if (severityOverride) {
      return {
        moderationPath: MODERATION_PATHS.VIOLATION,
        originPath: pathMeta.originPath || MODERATION_PATHS.VIOLATION,
        pathLabel: getPathLabel(MODERATION_PATHS.VIOLATION),
        scopeLabel: getModerationScopeLabel(MODERATION_PATHS.VIOLATION),
        targetUserId,
        targetRole: "reported_user",
        targetUserLabel: "Reported user",
        userRecord,
        severity,
        currentLevel: currentOffenseCount,
        nextLevel: severityOverride.offenseCount,
        currentOffenseCount,
        nextOffenseCount: severityOverride.offenseCount,
        levelLabel: "Offense Count",
        isProtectedDuplicate: false,
        contentActionLabel,
        recommendation: severityOverride,
        bannerMessage:
          "This verified case is severe enough to bypass the normal first-offense warning.",
        ladderText:
          "Severe verified categories can override the default ladder and apply immediate suspension or ban.",
        adminGuidance:
          "Immediate override applied because the category indicates a severe verified violation.",
      };
    }

    const nextOffenseCount = currentOffenseCount + 1;
    const recommendation = getRecommendedEnforcement(nextOffenseCount);

    return {
      moderationPath: MODERATION_PATHS.VIOLATION,
      originPath: pathMeta.originPath || MODERATION_PATHS.VIOLATION,
      pathLabel: getPathLabel(MODERATION_PATHS.VIOLATION),
      scopeLabel: getModerationScopeLabel(MODERATION_PATHS.VIOLATION),
      targetUserId,
      targetRole: "reported_user",
      targetUserLabel: "Reported user",
      userRecord,
      severity,
      currentLevel: currentOffenseCount,
      nextLevel: nextOffenseCount,
      currentOffenseCount,
      nextOffenseCount,
      levelLabel: "Offense Count",
      isProtectedDuplicate: false,
      contentActionLabel,
      recommendation,
      bannerMessage:
        pathMeta.originPath === MODERATION_PATHS.TRANSACTION_RESTRICTION
          ? "Repeated cancellation abuse has escalated into the normal account penalty ladder."
          : "This case follows the full violation ladder.",
      ladderText:
        "1st warning, 2nd 1-day suspension, 3rd 3-day suspension, 4th 7-day suspension, 5th ban.",
      adminGuidance:
        pathMeta.originPath === MODERATION_PATHS.TRANSACTION_RESTRICTION
          ? "Trade abuse has repeated past the restriction stages, so the next enforcement uses the standard account ladder."
          : "Use the verified violation ladder for real misconduct and serious content violations.",
    };
  };

  const buildFalseReportRecommendation = (report) => {
    const reporterId = getReportReporterId(report);
    const reporterRecord = getUserRecordById(reporterId);
    const reporterStats = getReporterBehavior(reporterId);
    const currentFalseReports = reporterStats.dismissedReports;
    const currentOffenseCount = getFalseReportAbuseOffenseCount(reporterRecord);
    const nextOffenseCount = currentOffenseCount + 1;
    const severity = getSeverity(report, MODERATION_PATHS.FALSE_REPORT_ABUSE);
    const durationDays = getFalseReportAbuseDurationForOffense(nextOffenseCount);

    let recommendation = {
      enforcementType: "report_warning",
      enforcementAction: "report_warning",
      adminAction: "Reporting Warning",
      durationDays: 0,
      alertType: "reporting",
      banner: "Reporter warning recorded for abusive or repeatedly baseless reporting.",
      message:
        "You have received a warning for submitting invalid or abusive reports. Future misuse may temporarily restrict your reporting privileges.",
    };

    if (durationDays === 1) {
      recommendation = {
        enforcementType: "report_restriction",
        enforcementAction: "report_restriction_1_day",
        adminAction: "1-Day Reporting Restriction",
        durationDays: 1,
        alertType: "reporting_restriction",
        banner: "Reporting access restricted for 1 day due to repeated invalid reports.",
        message:
          "Your reporting access has been restricted for 1 day due to repeated invalid reports. You can still use the app, but you cannot submit new reports during this period.",
      };
    } else if (durationDays === 3) {
      recommendation = {
        enforcementType: "report_restriction",
        enforcementAction: "report_restriction_3_days",
        adminAction: "3-Day Reporting Restriction",
        durationDays: 3,
        alertType: "reporting_restriction",
        banner: "Reporting access restricted for 3 days due to repeated invalid reports.",
        message:
          "Your reporting access has been restricted for 3 days due to repeated invalid reports. You can still use the app, but you cannot submit new reports during this period.",
      };
    } else if (durationDays === 7) {
      recommendation = {
        enforcementType: "report_restriction",
        enforcementAction: "report_restriction_7_days",
        adminAction: "7-Day Reporting Restriction",
        durationDays: 7,
        alertType: "reporting_restriction",
        banner: "Reporting access restricted for 7 days due to repeated invalid reports.",
        message:
          "Your reporting access has been restricted for 7 days due to repeated invalid reports. You can still use the app, but you cannot submit new reports during this period.",
      };
    } else if (durationDays >= 14) {
      recommendation = {
        enforcementType: "report_restriction",
        enforcementAction: "report_restriction_14_days",
        adminAction: "14-Day Reporting Restriction",
        durationDays: 14,
        alertType: "reporting_restriction",
        banner: "Reporting access restricted for 14 days due to repeated invalid reports.",
        message:
          "Your reporting access has been restricted for 14 days due to repeated invalid reports. You can still use the app, but you cannot submit new reports during this period.",
      };
    }

    return {
      moderationPath: MODERATION_PATHS.FALSE_REPORT_ABUSE,
      originPath: MODERATION_PATHS.FALSE_REPORT_ABUSE,
      pathLabel: getPathLabel(MODERATION_PATHS.FALSE_REPORT_ABUSE),
      scopeLabel: getModerationScopeLabel(MODERATION_PATHS.FALSE_REPORT_ABUSE),
      targetUserId: reporterId,
      targetRole: "reporter",
      targetUserLabel: "Reporter",
      userRecord: reporterRecord,
      severity,
      currentLevel: currentOffenseCount,
      nextLevel: nextOffenseCount,
      currentOffenseCount,
      nextOffenseCount,
      levelLabel: "False-Report Action Count",
      isProtectedDuplicate: false,
      recommendation,
      reporterStats,
      bannerMessage:
        "This case affects reporting privileges only. The reporter keeps app access while report submission is warned or restricted.",
      ladderText:
        "Warning, then 1-day, 3-day, 7-day, and 14-day reporting restrictions for repeated invalid reports.",
      adminGuidance:
        "This path targets the reporter account, not the reported user. Use it when report abuse or repeated baseless reports are the core problem.",
    };
  };

  const buildTransactionRestrictionRecommendation = (report) => {
    const targetUserId = getRelatedUserIdForReport(report);
    const userRecord = getUserRecordById(targetUserId);
    const tradeBehavior = getTradeBehavior(userRecord);
    const currentLevel = Number(tradeBehavior.restrictionLevel || 0);

    const recommendation = {
      accountStatus: userRecord?.accountStatus || "active",
      enforcementType: "trade_warning",
      enforcementAction: "trade_warning",
      adminAction: "Trade Conduct Warning",
      durationDays: 0,
      alertType: "trade_warning",
      banner: "Trading warning recorded for repeated cancellation abuse.",
      message:
        "You have received a warning for repeated cancellation activity in transactions.",
    };

    return {
      moderationPath: MODERATION_PATHS.TRANSACTION_RESTRICTION,
      originPath: MODERATION_PATHS.TRANSACTION_RESTRICTION,
      pathLabel: getPathLabel(MODERATION_PATHS.TRANSACTION_RESTRICTION),
      scopeLabel: getModerationScopeLabel(MODERATION_PATHS.TRANSACTION_RESTRICTION),
      targetUserId,
      targetRole: "reported_user",
      targetUserLabel: "Reported user",
      userRecord,
      severity: getSeverity(report, MODERATION_PATHS.TRANSACTION_RESTRICTION),
      currentLevel,
      nextLevel: currentLevel,
      currentOffenseCount: currentLevel,
      nextOffenseCount: currentLevel,
      levelLabel: "Restriction Level",
      isProtectedDuplicate: false,
      recommendation,
      tradeBehavior,
      bannerMessage:
        "Cancellation activity is tracked for admin review, but it does not automatically restrict trading access.",
      ladderText:
        "Repeated cancellations record a trade conduct warning only. Timed trade restrictions must be applied manually.",
      adminGuidance:
        "Use this path to warn users about unreliable transaction behavior without automatically limiting trading access.",
    };
  };

  const getRecommendationForReport = (report) => {
    const moderationPath = getModerationPathForReport(report);

    if (moderationPath === MODERATION_PATHS.FALSE_REPORT_ABUSE) {
      return buildFalseReportRecommendation(report);
    }

    if (moderationPath === MODERATION_PATHS.TRANSACTION_RESTRICTION) {
      return buildTransactionRestrictionRecommendation(report);
    }

    return buildViolationRecommendation(report);
  };

  const handleUndoAction = async (report) => {
    if (!report?.id || processingAction) return;

    try {
      setProcessingAction(true);
      setActionMessage(
        "Undoing moderation action. Linked newer moderations will be reverted first when required."
      );
      const visited = new Set();
      await runUndoActionInternal(report, visited);

      const revertedCount = visited.size;
      const successMessage =
        revertedCount > 1
          ? `Undo complete. Reverted ${revertedCount} linked moderation actions, starting from the latest one.`
          : "Undo complete. Reverted the latest moderation action.";
      setActionMessage(successMessage);
      alert(`Success: ${successMessage}`);
    } catch (err) {
      console.error("UNDO REPORT ACTION ERROR:", err);
      setActionMessage(
        err?.message || "Failed to undo moderation action."
      );
      alert(err?.message || "Failed to undo moderation action.");
    } finally {
      setProcessingAction(false);
    }
  };

  const handleDeleteReport = async (report) => {
    if (!report?.id || processingAction) return;

    const confirmed = window.confirm(
      `Permanently delete report ${report.id} from Firestore? This will also remove linked community alerts. This does not automatically restore any user moderation state already created by the report.`
    );

    if (!confirmed) return;

    try {
      setProcessingAction(true);
      setActionMessage(
        `Deleting report ${report.id} from Firestore and removing it from the dashboard.`
      );

      const batch = writeBatch(db);
      const reportRef = doc(db, "reports", report.id);
      const linkedAlerts = await getLinkedCommunityAlerts(report);

      batch.delete(reportRef);

      linkedAlerts.forEach((alertDoc) => {
        batch.delete(doc(db, "communityAlerts", alertDoc.id));
      });

      await batch.commit();

      setReports((prev) => prev.filter((entry) => entry.id !== report.id));
      setSelectedReport((prev) => (prev?.id === report.id ? null : prev));

      const successMessage = `Deleted report ${report.id} and ${linkedAlerts.length} linked community alert${linkedAlerts.length === 1 ? "" : "s"}.`;
      setActionMessage(successMessage);
      alert(`Success: ${successMessage}`);
    } catch (err) {
      console.error("DELETE REPORT ERROR:", err);
      setActionMessage(err?.message || "Failed to delete report.");
      alert(err?.message || "Failed to delete report.");
    } finally {
      setProcessingAction(false);
    }
  };

  const handleAction = async (report, action) => {
    if (!report?.id || processingAction) return;

    const reportStatus = getReportStatus(report);
    const currentEnforcementAction = normalizeText(report?.enforcementAction || "none");

    if (action === "dismiss" && reportStatus !== "pending") return;
    if (action === "verify" && reportStatus !== "pending") return;
    if (
      action === "enforce" &&
      (reportStatus !== "verified" || currentEnforcementAction !== "none")
    ) {
      return;
    }

    const reportRef = doc(db, "reports", report.id);
    let moderationUserId = getRelatedUserIdForReport(report);
    const batch = writeBatch(db);
    const moderationActionId = createModerationActionId();

    let reviewStatus = "pending";
    let adminAction = "";
    let enforcementAction = "none";
    let actionBanner = "";
    let moderationPathValue = null;
    let localUserChanges = null;
    let communityAlertPayload = null;
    let userUndoState = null;
    let contentUndoState = null;
    let contentAction = null;
    let contentTarget = null;
    const previousReportState = createFieldSnapshot(report, REPORT_UNDO_FIELDS);

    if (action === "dismiss") {
      reviewStatus = "dismissed";
      adminAction = "Dismissed Report";
      enforcementAction = "none";
      actionBanner = "Report closed as dismissed.";
    }

    if (action === "verify") {
      reviewStatus = "verified";

      adminAction = "Verified Report";
      enforcementAction = "none";
      actionBanner = "Report verified. No punishment has been applied yet.";
    }

    if (action === "enforce") {
      reviewStatus = "verified";

      const recommendationState = getRecommendationForReport(report);
      const {
        moderationPath,
        targetUserId,
        userRecord,
        nextOffenseCount,
        recommendation,
        severity,
        isProtectedDuplicate,
        nextLevel,
      } = recommendationState;
      moderationPathValue = moderationPath;

      if (targetUserId) {
        moderationUserId = targetUserId;
        const userRef = doc(db, "users", targetUserId);
        const nowSeconds = Math.floor(Date.now() / 1000);
        userUndoState = createFieldSnapshot(userRecord || {}, USER_UNDO_FIELDS);

        adminAction = recommendation.adminAction;
        enforcementAction = recommendation.enforcementAction;
        actionBanner = recommendation.banner;

        if (
          moderationPath === MODERATION_PATHS.VIOLATION &&
          isProtectedDuplicate
        ) {
          const protectedUpdate = {
            accountStatus: recommendation.accountStatus,
            lastModeratedReportId: report.id,
            lastModerationActionId: moderationActionId,
            updatedAt: serverTimestamp(),
          };

          if (recommendation.enforcementType === "warning") {
            protectedUpdate.hasActiveWarning = true;
            protectedUpdate.warningAcknowledged = false;
            protectedUpdate.warningAcknowledgedAt = deleteField();
            protectedUpdate.warningMessage = recommendation.message;
            protectedUpdate.suspendedAt = deleteField();
            protectedUpdate.suspendedUntil = deleteField();
          } else {
            protectedUpdate.hasActiveWarning = false;
            protectedUpdate.warningAcknowledged = true;
            protectedUpdate.warningAcknowledgedAt = serverTimestamp();
            protectedUpdate.warningMessage = deleteField();
          }

          batch.set(userRef, protectedUpdate, { merge: true });

          localUserChanges = {
            accountStatus: recommendation.accountStatus,
            lastModeratedReportId: report.id,
            lastModerationActionId: moderationActionId,
            hasActiveWarning: recommendation.enforcementType === "warning",
            warningAcknowledged:
              recommendation.enforcementType === "warning" ? false : true,
            warningAcknowledgedAt:
              recommendation.enforcementType === "warning"
                ? null
                : { seconds: nowSeconds },
            warningMessage:
              recommendation.enforcementType === "warning"
                ? recommendation.message
                : null,
            ...(recommendation.enforcementType === "warning"
              ? {
                  suspendedAt: null,
                  suspendedUntil: null,
                }
              : {}),
            updatedAt: { seconds: nowSeconds },
          };
        } else if (moderationPath === MODERATION_PATHS.VIOLATION) {
          const baseUserUpdate = {
            offenseCount: nextOffenseCount,
            accountStatus: recommendation.accountStatus,
            lastEnforcementType: recommendation.enforcementType,
            lastEnforcementReason: report.category || "Validated report",
            lastEnforcementAt: serverTimestamp(),
            lastModeratedReportId: report.id,
            lastModerationActionId: moderationActionId,
            updatedAt: serverTimestamp(),
          };

          if (recommendation.enforcementType === "warning") {
            batch.set(
              userRef,
              {
                ...baseUserUpdate,
                warningCount: increment(1),
                lastWarningAt: serverTimestamp(),
                suspendedAt: deleteField(),
                suspendedUntil: deleteField(),
                hasActiveWarning: true,
                warningAcknowledged: false,
                warningAcknowledgedAt: deleteField(),
                warningMessage: recommendation.message,
              },
              { merge: true }
            );

            localUserChanges = {
              offenseCount: nextOffenseCount,
              accountStatus: recommendation.accountStatus,
              warningCount: Number(userRecord?.warningCount || 0) + 1,
              lastWarningAt: { seconds: nowSeconds },
              suspendedAt: null,
              suspendedUntil: null,
              lastEnforcementType: recommendation.enforcementType,
              lastEnforcementReason: report.category || "Validated report",
              lastEnforcementAt: { seconds: nowSeconds },
              lastModeratedReportId: report.id,
              lastModerationActionId: moderationActionId,
              hasActiveWarning: true,
              warningAcknowledged: false,
              warningAcknowledgedAt: null,
              warningMessage: recommendation.message,
              updatedAt: { seconds: nowSeconds },
            };
          } else if (recommendation.enforcementType === "suspension") {
            const suspensionUntilDate = new Date(
              Date.now() + recommendation.durationDays * 24 * 60 * 60 * 1000
            );
            const suspensionUntilTs = Timestamp.fromDate(suspensionUntilDate);

            batch.set(
              userRef,
              {
                ...baseUserUpdate,
                suspensionCount: increment(1),
                suspendedAt: serverTimestamp(),
                suspendedUntil: suspensionUntilTs,
                hasActiveWarning: false,
                warningAcknowledged: true,
                warningAcknowledgedAt: serverTimestamp(),
                warningMessage: deleteField(),
              },
              { merge: true }
            );

            localUserChanges = {
              offenseCount: nextOffenseCount,
              accountStatus: recommendation.accountStatus,
              suspensionCount: Number(userRecord?.suspensionCount || 0) + 1,
              suspendedAt: { seconds: nowSeconds },
              suspendedUntil: {
                seconds: Math.floor(suspensionUntilDate.getTime() / 1000),
              },
              lastEnforcementType: recommendation.enforcementType,
              lastEnforcementReason: report.category || "Validated report",
              lastEnforcementAt: { seconds: nowSeconds },
              lastModeratedReportId: report.id,
              lastModerationActionId: moderationActionId,
              hasActiveWarning: false,
              warningAcknowledged: true,
              warningAcknowledgedAt: { seconds: nowSeconds },
              warningMessage: null,
              updatedAt: { seconds: nowSeconds },
            };
          } else if (recommendation.enforcementType === "ban") {
            batch.set(
              userRef,
              {
                ...baseUserUpdate,
                bannedAt: serverTimestamp(),
                forceLogoutAt: serverTimestamp(),
                sessionInvalidatedAt: serverTimestamp(),
                suspendedUntil: null,
                hasActiveWarning: false,
                warningAcknowledged: true,
                warningAcknowledgedAt: serverTimestamp(),
                warningMessage: deleteField(),
              },
              { merge: true }
            );

            localUserChanges = {
              offenseCount: nextOffenseCount,
              accountStatus: recommendation.accountStatus,
              bannedAt: { seconds: nowSeconds },
              forceLogoutAt: { seconds: nowSeconds },
              sessionInvalidatedAt: { seconds: nowSeconds },
              suspendedUntil: null,
              lastEnforcementType: recommendation.enforcementType,
              lastEnforcementReason: report.category || "Validated report",
              lastEnforcementAt: { seconds: nowSeconds },
              lastModeratedReportId: report.id,
              lastModerationActionId: moderationActionId,
              hasActiveWarning: false,
              warningAcknowledged: true,
              warningAcknowledgedAt: { seconds: nowSeconds },
              warningMessage: null,
              updatedAt: { seconds: nowSeconds },
            };
          }
        } else if (moderationPath === MODERATION_PATHS.FALSE_REPORT_ABUSE) {
          const reportingRestrictionUntilDate =
            recommendation.durationDays > 0
              ? new Date(Date.now() + recommendation.durationDays * 24 * 60 * 60 * 1000)
              : null;
          const reportingRestrictionTs = reportingRestrictionUntilDate
            ? Timestamp.fromDate(reportingRestrictionUntilDate)
            : null;
          const reportRestrictionReason =
            report.category || "Repeated invalid reports";
          const isReportRestriction =
            recommendation.enforcementType === "report_restriction";

          // False-report abuse only changes reporting privileges. It never
          // upgrades the user's full account status into a suspension.
          batch.set(
            userRef,
            {
              falseReportAbuseOffenseCount: nextOffenseCount,
              reportAbuseActionCount: nextOffenseCount,
              reportingDisabled: isReportRestriction,
              reportRestrictedAt: isReportRestriction
                ? serverTimestamp()
                : deleteField(),
              reportRestrictedUntil: isReportRestriction
                ? reportingRestrictionTs
                : deleteField(),
              reportRestrictionReason: isReportRestriction
                ? reportRestrictionReason
                : deleteField(),
              lastReportRestrictionAt: isReportRestriction
                ? serverTimestamp()
                : deleteField(),
              lastReportRestrictionReason: isReportRestriction
                ? reportRestrictionReason
                : deleteField(),
              lastModeratedReportId: report.id,
              lastModerationActionId: moderationActionId,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          localUserChanges = {
            falseReportAbuseOffenseCount: nextOffenseCount,
            reportAbuseActionCount: nextOffenseCount,
            reportingDisabled: isReportRestriction,
            reportRestrictedAt: isReportRestriction
              ? { seconds: nowSeconds }
              : null,
            reportRestrictedUntil:
              isReportRestriction &&
              reportingRestrictionUntilDate
                ? {
                    seconds: Math.floor(
                      reportingRestrictionUntilDate.getTime() / 1000
                    ),
                  }
                : null,
            reportRestrictionReason: isReportRestriction
              ? reportRestrictionReason
              : null,
            lastReportRestrictionAt: isReportRestriction
              ? { seconds: nowSeconds }
              : null,
            lastReportRestrictionReason: isReportRestriction
              ? reportRestrictionReason
              : null,
            lastModeratedReportId: report.id,
            lastModerationActionId: moderationActionId,
            updatedAt: { seconds: nowSeconds },
          };
        } else if (moderationPath === MODERATION_PATHS.TRANSACTION_RESTRICTION) {
          const tradeRestrictionUntilDate =
            recommendation.durationDays > 0
              ? new Date(
                  Date.now() +
                    recommendation.durationDays * 24 * 60 * 60 * 1000
                )
              : null;
          const tradeRestrictionTs = tradeRestrictionUntilDate
            ? Timestamp.fromDate(tradeRestrictionUntilDate)
            : null;
          const tradeBehavior = recommendationState.tradeBehavior || {};
          const nextRestrictionLevel = nextLevel;
          const restrictionReason = report.category || "Repeated cancellations";
          const isTradeRestriction =
            recommendation.enforcementType === "trade_restriction";

          batch.set(
            userRef,
            {
              tradeRestrictionLevel: nextRestrictionLevel,
              tradeLimitedFeatures: isTradeRestriction,
              tradeRestrictedAt: isTradeRestriction
                ? serverTimestamp()
                : deleteField(),
              tradeRestrictedUntil: isTradeRestriction
                ? tradeRestrictionTs
                : deleteField(),
              tradeRestrictionReason: isTradeRestriction
                ? restrictionReason
                : deleteField(),
              lastTradeRestrictionAt: serverTimestamp(),
              lastTradeRestrictionReason: restrictionReason,
              cancelledTransactions: Math.max(
                Number(userRecord?.cancelledTransactions || 0),
                Number(tradeBehavior.cancelledTransactions || 0)
              ),
              completedTransactions: Math.max(
                Number(userRecord?.completedTransactions || 0),
                Number(tradeBehavior.completedTransactions || 0)
              ),
              totalTransactions: Math.max(
                Number(userRecord?.totalTransactions || 0),
                Number(tradeBehavior.totalTransactions || 0)
              ),
              cancelRate: Number(tradeBehavior.cancelRate || 0),
              lastEnforcementType: recommendation.enforcementType,
              lastEnforcementReason: restrictionReason,
              lastEnforcementAt: serverTimestamp(),
              lastModeratedReportId: report.id,
              lastModerationActionId: moderationActionId,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          localUserChanges = {
            tradeRestrictionLevel: nextRestrictionLevel,
            tradeLimitedFeatures: isTradeRestriction,
            tradeRestrictedAt: isTradeRestriction
              ? { seconds: nowSeconds }
              : null,
            tradeRestrictedUntil:
              isTradeRestriction && tradeRestrictionUntilDate
                ? {
                    seconds: Math.floor(
                      tradeRestrictionUntilDate.getTime() / 1000
                    ),
                  }
                : null,
            tradeRestrictionReason: isTradeRestriction ? restrictionReason : null,
            lastTradeRestrictionAt: { seconds: nowSeconds },
            lastTradeRestrictionReason: restrictionReason,
            cancelledTransactions: Math.max(
              Number(userRecord?.cancelledTransactions || 0),
              Number(tradeBehavior.cancelledTransactions || 0)
            ),
            completedTransactions: Math.max(
              Number(userRecord?.completedTransactions || 0),
              Number(tradeBehavior.completedTransactions || 0)
            ),
            totalTransactions: Math.max(
              Number(userRecord?.totalTransactions || 0),
              Number(tradeBehavior.totalTransactions || 0)
            ),
            cancelRate: Number(tradeBehavior.cancelRate || 0),
            lastEnforcementType: recommendation.enforcementType,
            lastEnforcementReason: restrictionReason,
            lastEnforcementAt: { seconds: nowSeconds },
            lastModeratedReportId: report.id,
            lastModerationActionId: moderationActionId,
            updatedAt: { seconds: nowSeconds },
          };
        }

        communityAlertPayload = {
          userId: targetUserId,
          type: recommendation.alertType,
          category:
            moderationPath === MODERATION_PATHS.FALSE_REPORT_ABUSE
              ? "Reporting Privilege Review"
              : moderationPath === MODERATION_PATHS.TRANSACTION_RESTRICTION
              ? "Trading Privilege Review"
              : report.category ||
                (recommendation.enforcementType === "ban"
                  ? "Account Ban"
                  : recommendation.enforcementType === "suspension"
                  ? "Account Suspension"
                  : "Report Warning"),
          severity,
          details:
            report.details ||
            recommendationState.bannerMessage ||
            "This moderation action was recorded after admin review.",
          message: recommendation.message,
          isRead: false,
          createdAt: serverTimestamp(),
          reportId: report.id,
          moderationActionId,
          offenseCount:
            moderationPath === MODERATION_PATHS.VIOLATION
              ? isProtectedDuplicate
                ? getOffenseCountForUser(userRecord)
                : nextOffenseCount
              : nextLevel || 0,
          protectedDuplicate: isProtectedDuplicate,
          duration: recommendation.durationDays || 0,
          moderationPath,
          moderationScope: recommendationState.scopeLabel,
          targetRole: recommendationState.targetRole,
          ...(recommendation.enforcementType === "suspension" &&
          recommendation.accountStatus === "suspended" &&
          !isProtectedDuplicate
            ? {
                suspendedUntil: Timestamp.fromDate(
                  new Date(
                    Date.now() +
                      recommendation.durationDays * 24 * 60 * 60 * 1000
                  )
                ),
              }
            : {}),
        };
      } else {
        adminAction = "Verified Report";
        enforcementAction = "none";
        actionBanner = "Report verified. No target user was found for enforcement.";
      }
    }

    try {
      setProcessingAction(true);

      if (
        action === "enforce" &&
        moderationPathValue === MODERATION_PATHS.VIOLATION
      ) {
        const nextContentTarget = getContentModerationTarget(report);

        if (nextContentTarget) {
          const contentRef = doc(
            db,
            nextContentTarget.collectionName,
            nextContentTarget.docId
          );
          const contentSnap = await getDoc(contentRef);

          if (contentSnap.exists()) {
            const contentReason = report.category || "Verified content violation";
            const contentTitle = getReportedContentTitle(report);
            const contentTypeLabel =
              getNormalizedReportType(report) === "diy" ? "DIY post" : "item post";
            const takedownNotice = `Your ${contentTypeLabel} "${contentTitle}" has been taken down after admin review due to ${contentReason.toLowerCase()}.`;

            contentTarget = nextContentTarget;
            contentAction = getContentActionLabel(report);
            contentUndoState = createFieldSnapshot(
              contentSnap.data(),
              CONTENT_UNDO_FIELDS
            );

            batch.set(
              contentRef,
              {
                moderationStatus: "taken_down",
                isHidden: true,
                hiddenAt: serverTimestamp(),
                hiddenReason: contentReason,
                moderatedByReportId: report.id,
                lastModerationActionId: moderationActionId,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            adminAction =
              adminAction && adminAction !== "Verified Report"
                ? `${adminAction} + ${contentAction}`
                : contentAction;
            actionBanner = communityAlertPayload
              ? `${actionBanner.replace(/\.$/, "")}. Reported content was taken down and the user was notified with the removal reason.`
              : `${actionBanner.replace(/\.$/, "")}. Reported content was taken down.`;

            if (communityAlertPayload) {
              communityAlertPayload.message = `${takedownNotice} ${communityAlertPayload.message}`;
              communityAlertPayload.details = [
                communityAlertPayload.details,
                `Content action: ${contentAction}.`,
                `Source: ${nextContentTarget.collectionName}/${nextContentTarget.docId}.`,
              ]
                .filter(Boolean)
                .join(" ");
              communityAlertPayload.contentAction = contentAction;
              communityAlertPayload.contentTargetId = nextContentTarget.docId;
              communityAlertPayload.contentTargetCollection =
                nextContentTarget.collectionName;
            }
          }
        }
      }

      batch.set(
        reportRef,
        {
          reviewStatus,
          status: reviewStatus,
          adminAction,
          enforcementAction,
          contentAction: contentAction || deleteField(),
          contentTargetId: contentTarget?.docId || deleteField(),
          contentTargetCollection:
            contentTarget?.collectionName || deleteField(),
          moderationPath: moderationPathValue || deleteField(),
          moderationActionId,
          undoState: {
            actionId: moderationActionId,
            userId: moderationUserId,
            contentTarget,
            previousReportState,
            previousUserState: userUndoState,
            previousContentState: contentUndoState,
            appliedAction: action,
            appliedAt: serverTimestamp(),
          },
          reviewedAt: serverTimestamp(),
          closedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (communityAlertPayload) {
        const alertRef = doc(collection(db, "communityAlerts"));
        batch.set(alertRef, communityAlertPayload);
      }

      await batch.commit();

      updateLocalReport(report.id, {
        reviewStatus,
        status: reviewStatus,
        adminAction,
        enforcementAction,
        contentAction,
        contentTargetId: contentTarget?.docId || null,
        contentTargetCollection: contentTarget?.collectionName || null,
        moderationPath: moderationPathValue,
        moderationActionId,
        undoState: {
          actionId: moderationActionId,
          userId: moderationUserId,
          contentTarget,
          previousReportState,
          previousUserState: userUndoState,
          previousContentState: contentUndoState,
          appliedAction: action,
          appliedAt: { seconds: Math.floor(Date.now() / 1000) },
        },
        reviewedAt: { seconds: Math.floor(Date.now() / 1000) },
        closedAt: { seconds: Math.floor(Date.now() / 1000) },
      });

      if (moderationUserId && localUserChanges) {
        upsertLocalUser(moderationUserId, localUserChanges);
      }

      setActionMessage(actionBanner);
      alert(`Success: ${adminAction}`);
    } catch (err) {
      console.error("REPORT ACTION ERROR:", err);
      alert("Failed to update report.");
    } finally {
      setProcessingAction(false);
    }
  };

  // Compute insightItems for each tab
  let insightItems = [];
  if (insightTab === "reported") {
    insightItems = mostReportedUsers;
  } else if (insightTab === "cancelled") {
    insightItems = topCancelledUsers;
  } else if (insightTab === "abusers") {
    // Build Report Abusers from users who submit reports.
    // A user only qualifies after multiple dismissed reports.
    const reporterStats = users
      .map((u) => {
        const stats = getReporterBehavior(u.id);
        const actionCount = getFalseReportAbuseOffenseCount(u);
        return {
          ...u,
          ...stats,
          actionCount,
          canApplyAction: canApplyFalseReportAbuseAction(stats, actionCount),
        };
      })
      .filter((u) => isFalseReportAbuseEligible(u))
      .sort((a, b) =>
        b.dismissedReports - a.dismissedReports || (b.dismissRate || 0) - (a.dismissRate || 0)
      )
      .slice(0, 5)
      .map((u) => ({
        id: u.id,
        name: u.displayName || u.name || u.username || u.email || "Unknown User",
        meta: u.email || u.id,
        count: u.dismissedReports,
        dismissRate: u.dismissRate,
        reviewedReports: u.reviewedReports,
        actionCount: u.actionCount,
        canApplyAction: u.canApplyAction,
        isRestricted: getReportingRestrictionStatus(u).isActive,
      }));
    insightItems = reporterStats;
  }

  const selectedReportRecommendation = selectedReport
    ? getRecommendationForReport(selectedReport)
    : null;

  const selectedReportStatus = selectedReport
    ? getReportStatus(selectedReport)
    : "pending";
  const selectedReportEnforcementAction = normalizeText(
    selectedReport?.enforcementAction || "none"
  );
  const selectedReportSeverity = selectedReportRecommendation?.severity || "manual";
  const selectedReportIsHighSeverity = selectedReportSeverity === "high";
  const selectedReportHasUndo = Boolean(selectedReport);
  const selectedReportHasRestriction =
    selectedReportEnforcementAction !== "none";
  const selectedReportCanReopen = selectedReportStatus !== "pending";
  const selectedReportUndoLabel = selectedReportHasRestriction
    ? "Undo Restriction"
    : "Reopen Report";
  const selectedReportUndoConflict = selectedReport
    ? getLocalUndoConflict(selectedReport)
    : null;
  const selectedReportCanUndo = selectedReportHasUndo;
  const selectedInsightUserRecord = selectedInsightUser
    ? getUserRecordById(selectedInsightUser.id, selectedInsightUser)
    : null;
  const selectedInsightReporterStats =
    insightTab === "abusers" && selectedInsightUser
      ? getReporterBehavior(selectedInsightUser.id)
      : null;
  const selectedInsightFalseReportAbuseOffenseCount =
    insightTab === "abusers"
      ? getFalseReportAbuseOffenseCount(selectedInsightUserRecord)
      : 0;
  const selectedInsightTradeStatus =
    insightTab === "cancelled"
      ? getInsightTradeRestrictionStatus(selectedInsightUserRecord)
      : null;
  const selectedInsightReportStatus =
    insightTab === "abusers"
      ? getReportingRestrictionStatus(selectedInsightUserRecord)
      : null;
  const selectedInsightHasActiveRestriction =
    insightTab === "cancelled"
      ? selectedInsightTradeStatus?.isActive
      : insightTab === "abusers"
      ? selectedInsightReportStatus?.isActive
      : false;
  const selectedInsightCanApplyReportAbuseAction =
    insightTab === "abusers"
      ? canApplyFalseReportAbuseAction(
          selectedInsightReporterStats,
          selectedInsightFalseReportAbuseOffenseCount
        )
      : false;
  const selectedInsightRestrictionDurationDays =
    insightTab === "cancelled"
      ? getTimedRestrictionDuration(
          TRADE_RESTRICTION_STEPS,
          getTradeBehavior(selectedInsightUserRecord).restrictionLevel
        )
      : insightTab === "abusers"
      ? getFalseReportAbuseDurationForOffense(
          selectedInsightFalseReportAbuseOffenseCount + 1
        )
      : 0;
  const selectedInsightRestrictionLabel =
    insightTab === "abusers" &&
    !selectedInsightHasActiveRestriction &&
    !selectedInsightCanApplyReportAbuseAction
      ? "Waiting for Another Dismissed Report"
      : insightTab === "abusers" && selectedInsightRestrictionDurationDays === 0
      ? "Record Reporting Warning"
      : selectedInsightRestrictionDurationDays > 0
      ? insightTab === "cancelled"
        ? `Apply ${selectedInsightRestrictionDurationDays}-Day Trade Restriction`
        : `Apply ${selectedInsightRestrictionDurationDays}-Day Report Restriction`
      : "Apply Restriction";
  const selectedReportContentTitle = selectedReport
    ? getReportedContentTitle(selectedReport)
    : "Untitled content";
  const selectedReportContentTitleLabel = selectedReport
    ? getReportedContentTitleLabel(selectedReport)
    : "Post Title";
  const selectedReportContentBody = selectedReport
    ? getReportedContentBody(selectedReport)
    : "No caption or content details available.";
  const selectedReportContentBodyLabel = selectedReport
    ? getReportedContentBodyLabel(selectedReport)
    : "Caption / Details";
  const selectedReportContentOwner = selectedReport
    ? getReportedContentOwner(selectedReport)
    : "Unknown owner";
  const selectedReportContentImage = selectedReport
    ? getReportedContentImage(selectedReport) || resolvedPreviewImage
    : null;
  const selectedReportTargetId = selectedReport
    ? getTargetIdForReport(selectedReport) || "-"
    : "-";
  const selectedReportTargetType = selectedReport
    ? getReportTypeLabel(selectedReport)
    : "Unknown";
  const isSelectedReportPending = selectedReportStatus === "pending";
  const isSelectedReportClosed = !isSelectedReportPending;
  const isSelectedReportVerified = selectedReportStatus === "verified";
  const isSelectedReportAwaitingEnforcement =
    isSelectedReportVerified && selectedReportEnforcementAction === "none";

const handleInsightRestriction = async (item) => {
  if (!item?.id || processingAction) return;

  const isTrade = insightTab === "cancelled";
  const isReportAbuse = insightTab === "abusers";

  if (!isTrade && !isReportAbuse) return;

  const userRecord = getUserRecordById(item.id, item);
  const reporterStats = isReportAbuse ? getReporterBehavior(item.id) : null;
  const hasActiveRestriction = isTrade
    ? getInsightTradeRestrictionStatus(userRecord).isActive
    : getReportingRestrictionStatus(userRecord).isActive;
  const currentLevel = isTrade
    ? getTradeBehavior(userRecord).restrictionLevel
    : getFalseReportAbuseOffenseCount(userRecord);
  const nextReportAbuseOffenseCount = currentLevel + 1;
  const durationDays = isTrade
    ? getTimedRestrictionDuration(TRADE_RESTRICTION_STEPS, currentLevel)
    : getFalseReportAbuseDurationForOffense(nextReportAbuseOffenseCount);
  const canApplyReportAbuseAction = isReportAbuse
    ? canApplyFalseReportAbuseAction(reporterStats, currentLevel)
    : false;

  if (isReportAbuse && !hasActiveRestriction && !canApplyReportAbuseAction) {
    alert(
      `Report abuse action is only available after at least ${FALSE_REPORT_ABUSE_MIN_DISMISSED_REPORTS} dismissed reports across ${FALSE_REPORT_ABUSE_MIN_REVIEWED_REPORTS} reviewed reports, and each new action requires another dismissed report.`
    );
    return;
  }

  const confirmMessage = hasActiveRestriction
    ? isTrade
      ? "Undo trade restriction for this user?"
      : "Undo report restriction for this user?"
    : isTrade
    ? `Apply ${durationDays}-day trade restriction to this user?`
    : durationDays > 0
    ? `Apply ${durationDays}-day report restriction to this user?`
    : "Record a reporting warning for this user?";
  if (!window.confirm(confirmMessage)) return;

  try {
    setProcessingAction(true);

    const userRef = doc(db, "users", item.id);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const untilDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const untilTs = Timestamp.fromDate(untilDate);
    const batch = writeBatch(db);
    let localUserUpdate;
    const moderationActionId = createModerationActionId();

    if (hasActiveRestriction) {
      const revertedReportAbuseCount = Math.max(currentLevel - 1, 0);
      const userUpdate = isTrade
        ? {
            tradeLimitedFeatures: false,
            tradeRestrictedAt: deleteField(),
            tradeRestrictedUntil: deleteField(),
            tradeSuspendedUntil: deleteField(),
            tradingSuspendedUntil: deleteField(),
            tradeRestrictionReason: deleteField(),
            lastModerationActionId: moderationActionId,
            updatedAt: serverTimestamp(),
          }
        : {
            falseReportAbuseOffenseCount: revertedReportAbuseCount,
            reportAbuseActionCount: revertedReportAbuseCount,
            reportingDisabled: false,
            reportRestrictedAt: deleteField(),
            reportRestrictedUntil: deleteField(),
            reportRestrictionReason: deleteField(),
            lastReportRestrictionAt: deleteField(),
            lastReportRestrictionReason: deleteField(),
            lastModerationActionId: moderationActionId,
            updatedAt: serverTimestamp(),
          };

      localUserUpdate = isTrade
        ? {
            tradeLimitedFeatures: false,
            tradeRestrictedAt: null,
            tradeRestrictedUntil: null,
            tradeSuspendedUntil: null,
            tradingSuspendedUntil: null,
            tradeRestrictionReason: null,
            lastModerationActionId: moderationActionId,
            updatedAt: { seconds: nowSeconds },
          }
        : {
            falseReportAbuseOffenseCount: revertedReportAbuseCount,
            reportAbuseActionCount: revertedReportAbuseCount,
            reportingDisabled: false,
            reportRestrictedAt: null,
            reportRestrictedUntil: null,
            reportRestrictionReason: null,
            lastReportRestrictionAt: null,
            lastReportRestrictionReason: null,
            lastModerationActionId: moderationActionId,
            updatedAt: { seconds: nowSeconds },
          };

      batch.set(userRef, userUpdate, { merge: true });
    } else {
      const alertRef = doc(collection(db, "communityAlerts"));
      const reason = isTrade
        ? "Repeated cancellations"
        : "Repeated invalid reports";
      const nextTradeRestrictionLevel = Math.min(
        Math.max(Number(currentLevel) || 0, 1) + 1,
        TRADE_RESTRICTION_STEPS.length
      );
      const isReportRestriction = durationDays > 0;
      const userUpdate = isTrade
        ? {
            tradeRestrictionLevel: nextTradeRestrictionLevel,
            tradeLimitedFeatures: true,
            tradeRestrictedAt: serverTimestamp(),
            tradeRestrictedUntil: untilTs,
            tradeRestrictionReason: reason,
            lastTradeRestrictionAt: serverTimestamp(),
            lastTradeRestrictionReason: reason,
            lastModerationActionId: moderationActionId,
            updatedAt: serverTimestamp(),
          }
        : {
            falseReportAbuseOffenseCount: nextReportAbuseOffenseCount,
            reportAbuseActionCount: nextReportAbuseOffenseCount,
            reportingDisabled: isReportRestriction,
            reportRestrictedAt: isReportRestriction
              ? serverTimestamp()
              : deleteField(),
            reportRestrictedUntil: isReportRestriction
              ? untilTs
              : deleteField(),
            reportRestrictionReason: isReportRestriction
              ? reason
              : deleteField(),
            lastReportRestrictionAt: isReportRestriction
              ? serverTimestamp()
              : deleteField(),
            lastReportRestrictionReason: isReportRestriction
              ? reason
              : deleteField(),
            lastModerationActionId: moderationActionId,
            updatedAt: serverTimestamp(),
          };

      const alertPayload = {
        userId: item.id,
        type: isTrade
          ? "trade_restriction"
          : isReportRestriction
          ? "reporting_restriction"
          : "reporting",
        category: isTrade
          ? "Trading Privilege Review"
          : "Reporting Privilege Review",
        message: isTrade
          ? `Your trading access has been restricted for ${durationDays} day${
              durationDays === 1 ? "" : "s"
            } due to repeated cancellations.`
          : isReportRestriction
          ? `Your reporting access has been restricted for ${durationDays} day${
              durationDays === 1 ? "" : "s"
            } due to repeated invalid reports.`
          : "You have received a warning for repeated invalid reports. Further misuse may temporarily restrict your reporting privileges.",
        details: reason,
        duration: durationDays,
        restrictionEndsAt: isTrade || isReportRestriction ? untilTs : null,
        isRead: false,
        createdAt: serverTimestamp(),
        source: "admin_user_insights",
      };

      localUserUpdate = isTrade
        ? {
            tradeRestrictionLevel: nextTradeRestrictionLevel,
            tradeLimitedFeatures: true,
            tradeRestrictedAt: { seconds: nowSeconds },
            tradeRestrictedUntil: untilTs,
            tradeRestrictionReason: reason,
            lastTradeRestrictionAt: { seconds: nowSeconds },
            lastTradeRestrictionReason: reason,
            lastModerationActionId: moderationActionId,
            updatedAt: { seconds: nowSeconds },
          }
        : {
            falseReportAbuseOffenseCount: nextReportAbuseOffenseCount,
            reportAbuseActionCount: nextReportAbuseOffenseCount,
            reportingDisabled: isReportRestriction,
            reportRestrictedAt: isReportRestriction
              ? { seconds: nowSeconds }
              : null,
            reportRestrictedUntil: isReportRestriction ? untilTs : null,
            reportRestrictionReason: isReportRestriction ? reason : null,
            lastReportRestrictionAt: isReportRestriction
              ? { seconds: nowSeconds }
              : null,
            lastReportRestrictionReason: isReportRestriction ? reason : null,
            lastModerationActionId: moderationActionId,
            updatedAt: { seconds: nowSeconds },
          };

      batch.set(userRef, userUpdate, { merge: true });
      batch.set(alertRef, alertPayload);
    }

    await batch.commit();

    upsertLocalUser(item.id, localUserUpdate);
    setSelectedInsightUser(null);
    setActionMessage(
      hasActiveRestriction
        ? isTrade
          ? "Trade restriction removed."
          : "Report restriction removed."
        : isTrade
        ? "Trade restriction applied and user notification created."
        : durationDays > 0
        ? "Report restriction applied and user notification created."
        : "Reporting warning recorded for repeated invalid reports."
    );

    alert(
      hasActiveRestriction
        ? "Restriction removed successfully."
        : durationDays > 0 || isTrade
        ? "Restriction applied successfully."
        : "Reporting warning recorded successfully."
    );
  } catch (err) {
    console.error("INSIGHT RESTRICTION ERROR:", err);
    alert(
      hasActiveRestriction
        ? "Failed to remove restriction."
        : "Failed to apply restriction."
    );
  } finally {
    setProcessingAction(false);
  }
};
    
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
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: "16px 20px 14px",
            ...CARD_STYLE,
          }}
        >
          <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
            <span style={{ color: PRIMARY, fontWeight: 600 }}>ClosetLoop</span>{" "}
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
            Reports
          </h1>

          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Review reports, verify valid complaints, and apply the correct moderation path:
            account penalties, reporting restrictions, or transaction restrictions.
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

        {actionMessage && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "10px 14px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
              border: "1px solid #f6d6e1",
              color: "#8a3552",
              fontSize: 12,
            }}
          >
            {actionMessage}
          </div>
        )}

        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              padding: "16px 18px 18px",
              ...CARD_STYLE,
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
                Report Overview
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Core report volume and review outcomes.
              </p>
            </div>

            <AdminStatGrid>
              <AdminStatCard
                title="Reports"
                value={loading ? "..." : stats.total}
                description="Total submitted reports"
                accentColor={PRIMARY}
                softBackgroundColor="#fdf2f7"
                active={quickFilter === "all"}
                onClick={() => handleStatCardFilter("all")}
              />
              <AdminStatCard
                title="Pending"
                value={loading ? "..." : stats.pending}
                description="Waiting for review"
                accentColor="#d99b1f"
                softBackgroundColor="#fff7e8"
                active={quickFilter === "pending"}
                onClick={() => handleStatCardFilter("pending")}
              />
              <AdminStatCard
                title="Verified"
                value={loading ? "..." : stats.verified}
                description="Validated complaints"
                accentColor="#5ea778"
                softBackgroundColor="#eef9f1"
                active={quickFilter === "verified"}
                onClick={() => handleStatCardFilter("verified")}
              />
              <AdminStatCard
                title="Dismissed"
                value={loading ? "..." : stats.dismissed}
                description="Invalid complaints"
                accentColor="#c65b7c"
                softBackgroundColor="#fff1f5"
                active={quickFilter === "dismissed"}
                onClick={() => handleStatCardFilter("dismissed")}
              />
            </AdminStatGrid>
          </div>

          <div
            style={{
              padding: "16px 18px 18px",
              ...CARD_STYLE,
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
                User Enforcement
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Accounts currently affected by warnings or restrictions.
              </p>
            </div>

            <AdminStatGrid>
              <AdminStatCard
                title="Warned"
                value={loading ? "..." : stats.warnedUsers}
                description="Current warned users"
                accentColor="#9b6bd3"
                softBackgroundColor="#f6f1ff"
                active={quickFilter === "warned"}
                onClick={() => handleStatCardFilter("warned")}
              />
              <AdminStatCard
                title="Trade Limited"
                value={loading ? "..." : stats.limitedTradeUsers}
                description="Users with active transaction limits"
                accentColor="#9f274d"
                softBackgroundColor="#fdecef"
                active={quickFilter === "limited"}
                onClick={() => handleStatCardFilter("limited")}
              />
              <AdminStatCard
                title="Report Limited"
                value={loading ? "..." : stats.reportingRestrictedUsers}
                description="Users blocked from filing reports"
                accentColor="#c65b7c"
                softBackgroundColor="#fff1f5"
                active={quickFilter === "report_limited"}
                onClick={() => handleStatCardFilter("report_limited")}
              />
              <AdminStatCard
                title="Suspended"
                value={loading ? "..." : stats.suspendedUsers}
                description="Active suspensions"
                accentColor="#6b7280"
                softBackgroundColor="#f3f4f6"
                active={quickFilter === "suspended"}
                onClick={() => handleStatCardFilter("suspended")}
              />
              <AdminStatCard
                title="Banned"
                value={loading ? "..." : stats.bannedUsers}
                description="Restricted accounts"
                accentColor="#111827"
                softBackgroundColor="#f3f4f6"
                active={quickFilter === "banned"}
                onClick={() => handleStatCardFilter("banned")}
              />
            </AdminStatGrid>
          </div>
        </div>

        <ReportsListSection
          filteredReports={filteredReports}
          loading={loading}
          reports={reports}
          search={search}
          selectedReport={selectedReport}
          sortBy={sortBy}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onSearchChange={setSearch}
          onSelectReport={(report) => navigate(`/admin/reports/${report.id}`)}
          onSortByChange={setSortBy}
          onStatusFilterChange={setStatusFilter}
          onTypeFilterChange={setTypeFilter}
        />

        <UserInsightsSection
          insightItems={insightItems}
          insightTab={insightTab}
          onInsightTabChange={setInsightTab}
          onSelectInsightUser={setSelectedInsightUser}
        />
      </div>


      <UserInsightModal
        insightTab={insightTab}
        processingAction={processingAction}
        reports={reports}
        selectedInsightCanApplyReportAbuseAction={
          selectedInsightCanApplyReportAbuseAction
        }
        selectedInsightFalseReportAbuseOffenseCount={
          selectedInsightFalseReportAbuseOffenseCount
        }
        selectedInsightHasActiveRestriction={selectedInsightHasActiveRestriction}
        selectedInsightReporterStats={selectedInsightReporterStats}
        selectedInsightRestrictionDurationDays={
          selectedInsightRestrictionDurationDays
        }
        selectedInsightRestrictionLabel={selectedInsightRestrictionLabel}
        selectedInsightUser={selectedInsightUser}
        onApplyRestriction={handleInsightRestriction}
        onClose={() => setSelectedInsightUser(null)}
        onOpenReport={(report) => {
          setSelectedInsightUser(null);
          navigate(`/admin/reports/${report.id}`);
        }}
      />
    </div>
  );
}

