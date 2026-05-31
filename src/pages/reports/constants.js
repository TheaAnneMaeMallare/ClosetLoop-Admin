export const PRIMARY = "#de638a";
export const EMPTY_VALUE = "-";
export const OFFENSE_PROTECTION_WINDOW_HOURS = 24;
export const CANCELLATION_LIMIT_THRESHOLD = 2;
export const FALSE_REPORT_ABUSE_MIN_REVIEWED_REPORTS = 3;
export const FALSE_REPORT_ABUSE_MIN_DISMISSED_REPORTS = 2;

export const MODERATION_PATHS = {
  VIOLATION: "violation",
  FALSE_REPORT_ABUSE: "false_report_abuse",
  TRANSACTION_RESTRICTION: "transaction_restriction",
};

export const REPORT_RESTRICTION_STEPS = [0, 1, 3, 7, 14];
export const TRADE_RESTRICTION_STEPS = [0, 1, 3, 7];
export const MAX_UNDO_CHAIN_DEPTH = 12;

export const TRANSACTION_CANCELLATION_KEYWORDS = [
  "cancel",
  "cancellation",
  "constantly cancels",
  "repeated cancellations",
  "repeatedly cancels",
  "unjustified cancellation",
  "unreliable trade",
  "no show",
  "no-show",
];

export const HIGH_SEVERITY_KEYWORDS = [
  "scam",
  "fraud",
  "impersonation",
  "dangerous item",
  "illegal activity",
  "prohibited item",
  "selling prohibited items",
];

export const MEDIUM_SEVERITY_KEYWORDS = [
  "spam",
  "inappropriate",
  "harassment",
  "bullying",
  "misleading",
  "abusive",
];

export const IMMEDIATE_BAN_KEYWORDS = [
  "scam",
  "fraud",
  "impersonation",
  "illegal activity",
  "dangerous item",
  "prohibited item",
  "selling prohibited items",
];

export const IMMEDIATE_SUSPENSION_KEYWORDS = [];

export const REPORT_UNDO_FIELDS = [
  "status",
  "reviewStatus",
  "reviewedAt",
  "reviewedBy",
  "adminAction",
  "enforcementAction",
  "enforcementType",
  "reportReason",
  "reportTargetType",
  "reportTargetId",
];

export const CONTENT_UNDO_FIELDS = [
  "moderationStatus",
  "isHidden",
  "hiddenAt",
  "hiddenReason",
  "takenDownByReportId",
];

export const USER_UNDO_FIELDS = [
  "offenseCount",
  "warningCount",
  "suspensionCount",
  "accountStatus",
  "suspendedAt",
  "suspendedUntil",
  "bannedAt",
  "forceLogoutAt",
  "sessionInvalidatedAt",
  "lastEnforcementType",
  "lastEnforcementReason",
  "lastEnforcementAt",
  "lastModeratedReportId",
  "lastModerationActionId",
  "updatedAt",
  "lastWarningAt",
  "hasActiveWarning",
  "warningAcknowledged",
  "warningAcknowledgedAt",
  "warningMessage",
  "totalReports",
  "validReports",
  "falseReports",
  "falseReportAbuseOffenseCount",
  "reportAbuseActionCount",
  "reportRestrictedAt",
  "reportRestrictedUntil",
  "reportingDisabled",
  "reportRestrictionReason",
  "falseReportWarningCount",
  "lastReportRestrictionAt",
  "lastReportRestrictionReason",
  "tradeRestrictedUntil",
  "tradeLimitedFeatures",
  "tradeRestrictionLevel",
  "lastTradeRestrictionReason",
  "lastTradeRestrictionAt",
  "cancelledTransactions",
  "cancelCount",
  "completedTransactions",
  "totalTransactions",
  "cancelRate",
  "tradeSuspendedUntil",
  "tradingSuspendedUntil",
];

export const TYPE_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "User", value: "user" },
  { label: "Post", value: "post" },
  { label: "DIY Post", value: "diy" },
  { label: "Transaction", value: "transaction" },
];

export const thStyle = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  color: "#374151",
  whiteSpace: "normal",
  lineHeight: 1.35,
  wordBreak: "break-word",
};

export const tdStyle = {
  padding: "14px 14px",
  borderTop: "1px solid #f1f5f9",
  fontSize: 12,
  verticalAlign: "top",
  color: "#374151",
  wordBreak: "break-word",
  whiteSpace: "normal",
  lineHeight: 1.5,
};

export const tdStyleStrong = {
  ...tdStyle,
  color: "#111827",
  fontWeight: 700,
};

export const CARD_STYLE = {
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
  border: "1px solid #eef1f4",
};

export const SECTION_HEADER_STYLE = {
  padding: "12px 16px",
  borderBottom: "1px solid #eee",
};

export const MODAL_PANEL_STYLE = {
  background: "#fff",
  border: "1px solid #eef1f4",
  borderRadius: 16,
  padding: 12,
};
