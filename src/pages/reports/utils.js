import { deleteField } from "firebase/firestore";
import {
  EMPTY_VALUE,
  FALSE_REPORT_ABUSE_MIN_DISMISSED_REPORTS,
  FALSE_REPORT_ABUSE_MIN_REVIEWED_REPORTS,
  HIGH_SEVERITY_KEYWORDS,
  IMMEDIATE_BAN_KEYWORDS,
  IMMEDIATE_SUSPENSION_KEYWORDS,
  MEDIUM_SEVERITY_KEYWORDS,
  MODERATION_PATHS,
  OFFENSE_PROTECTION_WINDOW_HOURS,
  PRIMARY,
  REPORT_RESTRICTION_STEPS,
  TRANSACTION_CANCELLATION_KEYWORDS,
} from "./constants";

export function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

export function getReportStatus(report) {
  return normalizeText(report?.reviewStatus || report?.status || "pending");
}

export function formatDate(value) {
  if (!value) return EMPTY_VALUE;

  try {
    let dateValue;

    if (value?.toDate) dateValue = value.toDate();
    else if (value?.seconds) dateValue = new Date(value.seconds * 1000);
    else dateValue = new Date(value);

    if (Number.isNaN(dateValue.getTime())) return EMPTY_VALUE;

    return dateValue.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return EMPTY_VALUE;
  }
}

export function formatDateTime(value) {
  if (!value) return EMPTY_VALUE;

  try {
    let dateValue;

    if (value?.toDate) dateValue = value.toDate();
    else if (value?.seconds) dateValue = new Date(value.seconds * 1000);
    else dateValue = new Date(value);

    if (Number.isNaN(dateValue.getTime())) return EMPTY_VALUE;

    return dateValue.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return EMPTY_VALUE;
  }
}

export function toMillis(value) {
  if (!value) return 0;

  try {
    if (value?.toDate) return value.toDate().getTime();
    if (value?.seconds) return value.seconds * 1000;

    const dateValue = new Date(value);
    return Number.isNaN(dateValue.getTime()) ? 0 : dateValue.getTime();
  } catch {
    return 0;
  }
}

export function createModerationActionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `mod_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createFieldSnapshot(record, keys) {
  return keys.reduce((snapshot, key) => {
    snapshot[key] = {
      exists: Object.prototype.hasOwnProperty.call(record || {}, key),
      value:
        record && Object.prototype.hasOwnProperty.call(record, key)
          ? record[key]
          : null,
    };
    return snapshot;
  }, {});
}

export function restoreFieldSnapshot(snapshot) {
  return Object.entries(snapshot || {}).reduce((restored, [key, entry]) => {
    restored[key] = entry?.exists ? entry.value : deleteField();
    return restored;
  }, {});
}

export function materializeFieldSnapshot(snapshot, keys) {
  return keys.reduce((restored, key) => {
    const entry = snapshot?.[key];
    restored[key] = entry?.exists ? entry.value : null;
    return restored;
  }, {});
}

export function getStatusStyle(status) {
  const normalized = normalizeText(status);

  if (normalized === "verified") {
    return {
      background: "rgba(198,226,198,0.28)",
      color: "#2f6b4f",
      border: "1px solid rgba(198,226,198,0.9)",
    };
  }

  if (normalized === "dismissed") {
    return {
      background: "#fdecef",
      color: "#9f274d",
      border: "1px solid #f7c8d4",
    };
  }

  if (normalized === "pending") {
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

export function getActionStyle(action) {
  const normalized = normalizeText(action);

  if (normalized.includes("banned")) {
    return {
      background: "#111827",
      color: "#fff",
      border: "1px solid #111827",
    };
  }

  if (
    normalized.includes("7-day") ||
    normalized.includes("3-day") ||
    normalized.includes("1-day")
  ) {
    return {
      background: "#f3f4f6",
      color: "#111827",
      border: "1px solid #d1d5db",
    };
  }

  if (normalized.includes("warning") || normalized.includes("warn")) {
    return {
      background: "#fdf0f5",
      color: PRIMARY,
      border: "1px solid #f6c3d4",
    };
  }

  if (normalized.includes("dismiss")) {
    return {
      background: "#fdecef",
      color: "#9f274d",
      border: "1px solid #f7c8d4",
    };
  }

  if (normalized.includes("verify")) {
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

export function getCategoryStyle(category) {
  const normalized = normalizeText(category);

  if (normalized.includes("spam")) {
    return {
      background: "#fff9db",
      color: "#5f4b00",
      border: "1px solid #f3e6a2",
    };
  }

  if (
    normalized.includes("fake") ||
    normalized.includes("fraud") ||
    normalized.includes("impersonation")
  ) {
    return {
      background: "#fdecef",
      color: "#9f274d",
      border: "1px solid #f7c8d4",
    };
  }

  if (
    normalized.includes("inappropriate") ||
    normalized.includes("harmful") ||
    normalized.includes("misleading") ||
    normalized.includes("harassment") ||
    normalized.includes("bullying")
  ) {
    return {
      background: "#fff0f4",
      color: "#8f2444",
      border: "1px solid #f8ccda",
    };
  }

  if (normalized.includes("suspicious") || normalized.includes("cancel")) {
    return {
      background: "#f5f3ff",
      color: "#5b41b3",
      border: "1px solid #ddd6fe",
    };
  }

  return {
    background: "#f9fafb",
    color: "#374151",
    border: "1px solid #e5e7eb",
  };
}

export function getSeverity(
  report,
  moderationPath = MODERATION_PATHS.VIOLATION
) {
  const text = getReportContextText(report);
  const type = getNormalizedReportType(report);

  if (moderationPath === MODERATION_PATHS.FALSE_REPORT_ABUSE) {
    return "medium";
  }

  if (moderationPath === MODERATION_PATHS.TRANSACTION_RESTRICTION) {
    return hasKeyword(text, ["scam", "fraud", "harassment"]) ? "high" : "low";
  }

  if (hasKeyword(text, HIGH_SEVERITY_KEYWORDS)) {
    return "high";
  }

  if (hasKeyword(text, MEDIUM_SEVERITY_KEYWORDS)) {
    return "medium";
  }

  if (
    type === "transaction" &&
    hasKeyword(text, TRANSACTION_CANCELLATION_KEYWORDS)
  ) {
    return "low";
  }

  return "manual";
}

export function getSeverityStyle(severity) {
  const normalized = normalizeText(severity);

  if (normalized === "high") {
    return {
      background: "#fdecef",
      color: "#9f274d",
      border: "1px solid #f7c8d4",
    };
  }

  if (normalized === "medium") {
    return {
      background: "#fff7e6",
      color: "#9a6700",
      border: "1px solid #f4dfab",
    };
  }

  if (normalized === "low") {
    return {
      background: "#f5f3ff",
      color: "#5b41b3",
      border: "1px solid #ddd6fe",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #e5e7eb",
  };
}

export function hasKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function getRestrictionDurationForLevel(steps, currentLevel) {
  const safeIndex = Math.min(
    Math.max(Number(currentLevel) || 0, 0),
    Math.max(steps.length - 1, 0)
  );

  return steps[safeIndex] ?? 0;
}

export function getTimedRestrictionDuration(steps, currentLevel) {
  const safeIndex = Math.min(
    Math.max(Number(currentLevel) || 0, 1),
    Math.max(steps.length - 1, 1)
  );

  return steps[safeIndex] ?? 0;
}

export function getPathLabel(path) {
  if (path === MODERATION_PATHS.FALSE_REPORT_ABUSE) {
    return "False Report Abuse";
  }

  if (path === MODERATION_PATHS.TRANSACTION_RESTRICTION) {
    return "Transaction Restriction";
  }

  return "Normal Violation";
}

export function getModerationScopeLabel(path) {
  if (path === MODERATION_PATHS.FALSE_REPORT_ABUSE) {
    return "Reporting privileges only";
  }

  if (path === MODERATION_PATHS.TRANSACTION_RESTRICTION) {
    return "Trading and transaction features only";
  }

  return "Full account moderation ladder";
}

export function getReportReporterId(report) {
  return report?.reporterId || report?.reporterUid || report?.createdBy || null;
}

export function getReportContextText(report) {
  return [
    report?.type,
    report?.category,
    report?.details,
    report?.description,
    report?.reportedName,
    report?.reporterName,
    report?.transactionStatus,
    report?.statusLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getOffenseCountForUser(user) {
  return Number(user?.offenseCount || 0);
}

export function getRecommendedEnforcement(nextOffenseCount) {
  if (nextOffenseCount <= 1) {
    return {
      offenseCount: 1,
      accountStatus: "warned",
      enforcementType: "warning",
      enforcementAction: "warning",
      adminAction: "Warning Issued",
      durationDays: 0,
      alertType: "warning",
      banner: "User warning recorded and alert created.",
      message:
        "Your account has received a warning due to a validated report. Please review our community guidelines.",
    };
  }

  if (nextOffenseCount === 2) {
    return {
      offenseCount: 2,
      accountStatus: "suspended",
      enforcementType: "suspension",
      enforcementAction: "suspension_1_day",
      adminAction: "1-Day Suspension",
      durationDays: 1,
      alertType: "suspension",
      banner: "User suspended for 1 day and alert created.",
      message:
        "Your account has been suspended for 1 day due to a validated report.",
    };
  }

  if (nextOffenseCount === 3) {
    return {
      offenseCount: 3,
      accountStatus: "suspended",
      enforcementType: "suspension",
      enforcementAction: "suspension_3_days",
      adminAction: "3-Day Suspension",
      durationDays: 3,
      alertType: "suspension",
      banner: "User suspended for 3 days and alert created.",
      message:
        "Your account has been suspended for 3 days due to a validated report.",
    };
  }

  if (nextOffenseCount === 4) {
    return {
      offenseCount: 4,
      accountStatus: "suspended",
      enforcementType: "suspension",
      enforcementAction: "suspension_7_days",
      adminAction: "7-Day Suspension",
      durationDays: 7,
      alertType: "suspension",
      banner: "User suspended for 7 days and alert created.",
      message:
        "Your account has been suspended for 7 days due to a validated report.",
    };
  }

  return {
    offenseCount: nextOffenseCount,
    accountStatus: "banned",
    enforcementType: "ban",
    enforcementAction: "ban",
    adminAction: "Banned Account",
    durationDays: 0,
    alertType: "ban",
    banner: "User account has been banned and alert created.",
    message:
      "Your account has been permanently banned due to repeated verified violations.",
  };
}

export function isProtectedDuplicateCase(userRecord, report) {
  const lastReason = normalizeText(userRecord?.lastEnforcementReason);
  const currentReason = normalizeText(report?.category);
  const lastEnforcementAtMs = toMillis(userRecord?.lastEnforcementAt);
  const protectionWindowMs =
    OFFENSE_PROTECTION_WINDOW_HOURS * 60 * 60 * 1000;
  const sameReason =
    Boolean(lastReason) && Boolean(currentReason) && lastReason === currentReason;
  const withinWindow =
    lastEnforcementAtMs > 0 &&
    Date.now() - lastEnforcementAtMs <= protectionWindowMs;

  return sameReason && withinWindow;
}

export function getExistingEnforcementSummary(userRecord) {
  const status = normalizeText(userRecord?.accountStatus);
  const suspendedUntilMs = toMillis(userRecord?.suspendedUntil);

  if (status === "banned") {
    return {
      accountStatus: "banned",
      enforcementType: "ban",
      enforcementAction: "ban",
      adminAction: "Banned Account",
      durationDays: 0,
      alertType: "ban",
      banner: "Similar reports detected. Existing banned state was reused.",
      message:
        "Your account remains permanently banned due to repeated verified violations.",
    };
  }

  if (status === "suspended" && suspendedUntilMs > Date.now()) {
    const diffMs = suspendedUntilMs - Date.now();
    const durationDays = Math.max(
      1,
      Math.ceil(diffMs / (24 * 60 * 60 * 1000))
    );

    let adminAction = "1-Day Suspension";
    let enforcementAction = "suspension_1_day";

    if (durationDays >= 7) {
      adminAction = "7-Day Suspension";
      enforcementAction = "suspension_7_days";
    } else if (durationDays >= 3) {
      adminAction = "3-Day Suspension";
      enforcementAction = "suspension_3_days";
    }

    return {
      accountStatus: "suspended",
      enforcementType: "suspension",
      enforcementAction,
      adminAction,
      durationDays,
      alertType: "suspension",
      banner: "Similar reports detected. Existing suspension state was reused.",
      message:
        "Your account remains suspended due to a previously applied verified enforcement.",
    };
  }

  if (status === "warned") {
    return {
      accountStatus: "warned",
      enforcementType: "warning",
      enforcementAction: "warning",
      adminAction: "Warning Issued",
      durationDays: 0,
      alertType: "warning",
      banner: "Similar reports detected. Existing warning state was reused.",
      message:
        "Your account remains under warning due to a previously applied verified enforcement.",
    };
  }

  return null;
}

export function getNormalizedReportType(report) {
  const type = normalizeText(
    report?.reportType ||
      report?.type ||
      report?.category ||
      report?.reportTargetType ||
      report?.targetType ||
      report?.targetCollection ||
      report?.collectionName
  );

  if (type.includes("diy")) return "diy";
  if (type.includes("transaction")) return "transaction";
  if (type.includes("trade")) return "transaction";
  if (type.includes("item")) return "item";
  if (type.includes("post")) return "post";
  if (type.includes("user")) return "user";

  if (
    normalizeText(report?.reportType).includes("transaction") ||
    report?.transactionId ||
    report?.tradeRequestId ||
    report?.tradeId ||
    report?.requestId ||
    report?.targetTransactionId
  ) {
    return "transaction";
  }

  return type || "unknown";
}

export function getRelatedUserIdForReport(report) {
  const type = getNormalizedReportType(report);

  if (type === "transaction") {
    return (
      report?.reportedUserId ||
      report?.targetUserId ||
      report?.reportedId ||
      report?.ownerId ||
      report?.ownerUid ||
      report?.requesterId ||
      report?.requesterUid ||
      report?.userId ||
      null
    );
  }

  return report?.reportedUserId || report?.targetUserId || report?.reportedId || null;
}

export function getTradeRestrictionStatus(userRecord) {
  const suspendedUntil =
    userRecord?.tradeSuspendedUntil ||
    userRecord?.tradeRestrictedUntil ||
    userRecord?.tradingSuspendedUntil ||
    null;
  const suspendedUntilMs = toMillis(suspendedUntil);
  const cancelledTransactions = Number(
    userRecord?.cancelledTransactions ?? userRecord?.cancelCount ?? 0
  );
  const isActive = suspendedUntilMs > Date.now();
  const isLimited =
    isActive ||
    (suspendedUntilMs <= 0 && userRecord?.tradeLimitedFeatures === true);
  const restrictionLevel = Number(userRecord?.tradeRestrictionLevel ?? 0);

  return {
    cancelledTransactions,
    suspendedUntil,
    suspendedUntilMs,
    isActive,
    isLimited,
    restrictionLevel,
  };
}

export function getInsightTradeRestrictionStatus(userRecord) {
  const restrictedUntilRaw =
    userRecord?.tradeRestrictedUntil ||
    userRecord?.tradeSuspendedUntil ||
    userRecord?.tradingSuspendedUntil ||
    null;
  const restrictedUntil = toMillis(restrictedUntilRaw);
  const isActive =
    restrictedUntil > Date.now() ||
    (restrictedUntil <= 0 && userRecord?.tradeLimitedFeatures === true);

  return {
    restrictedUntil: restrictedUntilRaw,
    restrictedUntilMs: restrictedUntil,
    isActive,
  };
}

export function getSeverityOverrideRecommendation(report) {
  const text = getReportContextText(report);

  if (hasKeyword(text, IMMEDIATE_BAN_KEYWORDS)) {
    return {
      offenseCount: 5,
      accountStatus: "banned",
      enforcementType: "ban",
      enforcementAction: "ban",
      adminAction: "Immediate Ban",
      durationDays: 0,
      alertType: "ban",
      banner:
        "High-severity verified violation triggered an immediate permanent ban.",
      message:
        "Your account has been permanently banned due to a severe verified violation.",
      severityOverride: true,
    };
  }

  if (hasKeyword(text, IMMEDIATE_SUSPENSION_KEYWORDS)) {
    return {
      offenseCount: 4,
      accountStatus: "suspended",
      enforcementType: "suspension",
      enforcementAction: "suspension_7_days",
      adminAction: "Immediate 7-Day Suspension",
      durationDays: 7,
      alertType: "suspension",
      banner:
        "High-severity verified violation triggered an immediate 7-day suspension.",
      message:
        "Your account has been suspended for 7 days due to a severe verified violation.",
      severityOverride: true,
    };
  }

  return null;
}

export function getReportingRestrictionStatus(userRecord) {
  const restrictedUntil = toMillis(userRecord?.reportRestrictedUntil);
  const isActive =
    restrictedUntil > Date.now() ||
    (restrictedUntil <= 0 && userRecord?.reportingDisabled === true);

  return {
    restrictedUntil: userRecord?.reportRestrictedUntil || null,
    restrictedUntilMs: restrictedUntil,
    isActive,
  };
}

export function isFalseReportAbuseEligible(reporterStats) {
  return (
    Number(reporterStats?.reviewedReports || 0) >=
      FALSE_REPORT_ABUSE_MIN_REVIEWED_REPORTS &&
    Number(reporterStats?.dismissedReports || 0) >=
      FALSE_REPORT_ABUSE_MIN_DISMISSED_REPORTS
  );
}

export function getLegacyFalseReportAbuseOffenseCount(userRecord) {
  const warningCount = Math.max(
    Number(userRecord?.falseReportWarningCount || 0),
    0
  );

  if (warningCount > 0) {
    return warningCount;
  }

  const reason = normalizeText(
    userRecord?.reportRestrictionReason || userRecord?.lastReportRestrictionReason
  );
  const hasRestrictionHistory =
    userRecord?.reportingDisabled === true ||
    toMillis(userRecord?.reportRestrictedUntil) > 0 ||
    toMillis(
      userRecord?.reportRestrictedAt || userRecord?.lastReportRestrictionAt
    ) > 0;
  const looksLikeFalseReportRestriction =
    !reason ||
    reason.includes("invalid report") ||
    reason.includes("false report") ||
    reason.includes("abusive report") ||
    reason.includes("baseless report");

  if (!hasRestrictionHistory || !looksLikeFalseReportRestriction) {
    return 0;
  }

  const restrictedAtMs = toMillis(
    userRecord?.reportRestrictedAt || userRecord?.lastReportRestrictionAt
  );
  const restrictedUntilMs = toMillis(userRecord?.reportRestrictedUntil);
  const durationMs =
    restrictedUntilMs > restrictedAtMs ? restrictedUntilMs - restrictedAtMs : 0;
  const durationDays =
    durationMs > 0
      ? Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)))
      : 0;

  if (durationDays >= 14) return 5;
  if (durationDays >= 7) return 4;
  if (durationDays >= 3) return 3;
  if (durationDays >= 1) return 2;

  return 2;
}

export function getFalseReportAbuseOffenseCount(userRecord) {
  const explicitCount = Math.max(
    Number(
      userRecord?.falseReportAbuseOffenseCount ??
        userRecord?.reportAbuseActionCount ??
        0
    ) || 0,
    0
  );

  if (explicitCount > 0) {
    return explicitCount;
  }

  return getLegacyFalseReportAbuseOffenseCount(userRecord);
}

export function getFalseReportAbuseDurationForOffense(offenseCount) {
  const safeIndex = Math.min(
    Math.max((Number(offenseCount) || 1) - 1, 0),
    Math.max(REPORT_RESTRICTION_STEPS.length - 1, 0)
  );

  return REPORT_RESTRICTION_STEPS[safeIndex] ?? 0;
}

export function canApplyFalseReportAbuseAction(
  reporterStats,
  currentOffenseCount
) {
  return (
    isFalseReportAbuseEligible(reporterStats) &&
    Number(reporterStats?.dismissedReports || 0) >=
      Number(currentOffenseCount || 0) + FALSE_REPORT_ABUSE_MIN_DISMISSED_REPORTS
  );
}

export function getReportTypeLabel(report) {
  const type = getNormalizedReportType(report);

  if (type === "diy") return "DIY Post";
  if (type === "transaction") return "Transaction";
  if (type === "item") return "Item";
  if (type === "post") return "Post";
  if (type === "user") return "User";

  return report?.type || "Unknown";
}

export function getTargetIdForReport(report) {
  const type = getNormalizedReportType(report);

  if (type === "user") {
    return getRelatedUserIdForReport(report);
  }

  if (type === "transaction") {
    return (
      report?.transactionId ||
      report?.tradeRequestId ||
      report?.tradeId ||
      report?.requestId ||
      report?.targetTransactionId ||
      report?.postId ||
      null
    );
  }

  return report?.postId || report?.itemId || report?.targetPostId || null;
}

export function getTargetDisplayName(report) {
  const type = getNormalizedReportType(report);

  if (type === "user") {
    return report?.reportedName || "View user profile";
  }

  if (type === "transaction") {
    return (
      report?.transactionTitle ||
      report?.tradeTitle ||
      report?.itemTitle ||
      report?.postTitle ||
      report?.reportedName ||
      getTargetIdForReport(report) ||
      "View transaction record"
    );
  }

  return (
    report?.postTitle ||
    report?.itemTitle ||
    report?.reportedName ||
    report?.postId ||
    "View reported content"
  );
}

export function getReportedContentTitle(report) {
  const type = getNormalizedReportType(report);

  if (type === "user") {
    return (
      report?.reportedName ||
      report?.displayName ||
      report?.username ||
      report?.fullName ||
      "Unnamed user"
    );
  }

  if (type === "transaction") {
    return (
      report?.transactionTitle ||
      report?.tradeTitle ||
      report?.itemTitle ||
      report?.postTitle ||
      report?.requestedItemTitle ||
      report?.reportedName ||
      `Transaction ${getTargetIdForReport(report) || ""}`.trim()
    );
  }

  return (
    report?.postTitle ||
    report?.title ||
    report?.itemTitle ||
    report?.itemName ||
    report?.name ||
    report?.reportedName ||
    "Untitled content"
  );
}

export function getReportedContentBody(report) {
  const type = getNormalizedReportType(report);

  if (type === "user") {
    return (
      report?.bio ||
      report?.about ||
      report?.profileDescription ||
      report?.details ||
      "No profile details available."
    );
  }

  if (type === "diy") {
    return (
      report?.caption ||
      report?.description ||
      report?.postDescription ||
      report?.content ||
      report?.details ||
      "No DIY caption or tutorial details available."
    );
  }

  if (type === "transaction") {
    return (
      report?.transactionSummary ||
      report?.transactionDetails ||
      report?.tradeSummary ||
      report?.tradeDetails ||
      report?.cancelReason ||
      report?.reason ||
      report?.details ||
      report?.description ||
      [
        report?.transactionType || report?.typeLabel || report?.type,
        report?.transactionStatus || report?.statusLabel || report?.tradeStatus,
      ]
        .filter(Boolean)
        .join(" | ") ||
      "No transaction details available."
    );
  }

  return (
    report?.caption ||
    report?.postCaption ||
    report?.postDescription ||
    report?.description ||
    report?.content ||
    report?.itemDescription ||
    report?.targetDetails ||
    report?.details ||
    "No caption or content details available."
  );
}

export function getReportedContentOwner(report) {
  const type = getNormalizedReportType(report);

  if (type === "user") {
    return (
      report?.reportedName ||
      report?.displayName ||
      report?.username ||
      report?.reportedUserId ||
      report?.targetUserId ||
      report?.reportedId ||
      "Unknown user"
    );
  }

  if (type === "transaction") {
    return (
      report?.reportedName ||
      report?.ownerName ||
      report?.requesterName ||
      report?.targetOwnerName ||
      report?.ownerId ||
      report?.requesterId ||
      "Unknown trader"
    );
  }

  return (
    report?.ownerName ||
    report?.authorName ||
    report?.postOwnerName ||
    report?.targetOwnerName ||
    report?.reportedName ||
    report?.ownerId ||
    report?.authorId ||
    report?.reportedUserId ||
    report?.targetUserId ||
    report?.reportedId ||
    "Unknown owner"
  );
}

export function getReportedContentImage(report) {
  const type = getNormalizedReportType(report);

  if (type === "user") {
    return (
      report?.photoURL ||
      report?.profileImage ||
      report?.profileImageUrl ||
      report?.avatar ||
      report?.avatarUrl ||
      report?.reportedPhotoURL ||
      report?.reportedImageUrl ||
      null
    );
  }

  if (type === "diy") {
    if (Array.isArray(report?.steps)) {
      const stepWithImage = report.steps.find((step) => step?.image);
      if (stepWithImage?.image) return stepWithImage.image;
    }

    if (Array.isArray(report?.images) && report.images[0]) return report.images[0];
    if (Array.isArray(report?.postImages) && report.postImages[0]) {
      return report.postImages[0];
    }
    if (Array.isArray(report?.mediaUrls) && report.mediaUrls[0]) {
      return report.mediaUrls[0];
    }

    return (
      report?.imageUrl ||
      report?.postImageUrl ||
      report?.reportedImageUrl ||
      report?.targetImageUrl ||
      null
    );
  }

  if (type === "transaction") {
    if (Array.isArray(report?.images) && report.images[0]) return report.images[0];
    if (Array.isArray(report?.postImages) && report.postImages[0]) {
      return report.postImages[0];
    }

    return (
      report?.itemImageUrl ||
      report?.postImageUrl ||
      report?.imageUrl ||
      report?.reportedImageUrl ||
      report?.targetImageUrl ||
      null
    );
  }

  if (Array.isArray(report?.images) && report.images[0]) return report.images[0];
  if (Array.isArray(report?.postImages) && report.postImages[0]) {
    return report.postImages[0];
  }
  if (Array.isArray(report?.mediaUrls) && report.mediaUrls[0]) {
    return report.mediaUrls[0];
  }

  return (
    report?.imageUrl ||
    report?.postImageUrl ||
    report?.reportedImageUrl ||
    report?.targetImageUrl ||
    null
  );
}

export function getImageFromSourceRecord(record) {
  if (!record) return null;

  if (Array.isArray(record?.images) && record.images[0]) return record.images[0];
  if (Array.isArray(record?.postImages) && record.postImages[0]) {
    return record.postImages[0];
  }
  if (Array.isArray(record?.mediaUrls) && record.mediaUrls[0]) {
    return record.mediaUrls[0];
  }

  if (Array.isArray(record?.steps)) {
    const stepWithImage = record.steps.find((step) => step?.image);
    if (stepWithImage?.image) return stepWithImage.image;
  }

  return (
    record?.imageUrl ||
    record?.postImageUrl ||
    record?.itemImageUrl ||
    record?.photoURL ||
    record?.reportedImageUrl ||
    record?.targetImageUrl ||
    null
  );
}

export function getSourceTargetsForReport(report) {
  const type = getNormalizedReportType(report);
  const directTargetId = getTargetIdForReport(report);

  if (type === "diy") {
    return directTargetId
      ? [{ collectionName: "diyPosts", docId: directTargetId }]
      : [];
  }

  if (type === "transaction") {
    const candidates = [
      {
        collectionName: "tradeRequests",
        docId:
          report?.tradeRequestId ||
          report?.transactionId ||
          report?.tradeId ||
          report?.requestId ||
          directTargetId,
      },
      {
        collectionName: "posts",
        docId:
          report?.requestedPostId ||
          report?.postId ||
          report?.itemId ||
          report?.targetPostId ||
          null,
      },
    ];

    return candidates.filter((candidate) => candidate.docId);
  }

  if (type === "post" || type === "item") {
    return directTargetId
      ? [{ collectionName: "posts", docId: directTargetId }]
      : [];
  }

  return [];
}

export function getContentModerationTarget(report) {
  const type = getNormalizedReportType(report);

  if (type !== "post" && type !== "item" && type !== "diy") {
    return null;
  }

  return getSourceTargetsForReport(report)[0] || null;
}

export function getContentActionLabel(report) {
  const type = getNormalizedReportType(report);

  if (type === "diy") return "DIY Post Taken Down";
  if (type === "post" || type === "item") return "Item Post Taken Down";

  return "Content Taken Down";
}

export function getReportedContentTitleLabel(report) {
  const type = getNormalizedReportType(report);

  if (type === "user") return "Profile Name";
  if (type === "diy") return "DIY Title";
  if (type === "transaction") return "Transaction Title";

  return "Post Title";
}

export function getReportedContentBodyLabel(report) {
  const type = getNormalizedReportType(report);

  if (type === "user") return "Profile Details";
  if (type === "diy") return "DIY Caption / Details";
  if (type === "transaction") return "Transaction Details";

  return "Caption / Details";
}
