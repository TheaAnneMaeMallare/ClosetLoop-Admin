import React from "react";
import { PRIMARY } from "./constants";
import { DetailRow } from "./components";
import {
  formatDate,
  getRelatedUserIdForReport,
  getReportReporterId,
  getReportStatus,
} from "./utils";

export function UserInsightModal({
  insightTab,
  processingAction,
  reports,
  selectedInsightCanApplyReportAbuseAction,
  selectedInsightFalseReportAbuseOffenseCount,
  selectedInsightHasActiveRestriction,
  selectedInsightReporterStats,
  selectedInsightRestrictionDurationDays,
  selectedInsightRestrictionLabel,
  selectedInsightUser,
  onApplyRestriction,
  onClose,
  onOpenReport,
}) {
  if (!selectedInsightUser) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 99999,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 18,
          width: "100%",
          maxWidth: 440,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>
          {selectedInsightUser.name || "Unknown User"}
        </h2>

        <p style={{ margin: "6px 0 12px", fontSize: 12, color: "#6b7280" }}>
          {selectedInsightUser.meta || selectedInsightUser.id}
        </p>

        <DetailRow
          label="Insight Type"
          value={
            insightTab === "reported"
              ? "Most Reported"
              : insightTab === "cancelled"
              ? "Frequent Canceller"
              : "Report Abuser"
          }
        />

        <div style={{ marginTop: 8 }}>
          <DetailRow label="Count" value={selectedInsightUser.count || 0} />
        </div>

        {insightTab === "abusers" && (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <DetailRow
              label="Reviewed Reports"
              value={selectedInsightReporterStats?.reviewedReports || 0}
            />
            <DetailRow
              label="False-Report Actions"
              value={selectedInsightFalseReportAbuseOffenseCount}
            />
            <DetailRow
              label="Next Step"
              value={
                selectedInsightRestrictionDurationDays > 0
                  ? `${selectedInsightRestrictionDurationDays}-Day Report Restriction`
                  : "Reporting Warning"
              }
            />
          </div>
        )}

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <DetailRow label="User ID" value={selectedInsightUser.id} />
          <DetailRow
            label="Risk Level"
            value={
              selectedInsightUser.count >= 5
                ? "High Risk"
                : selectedInsightUser.count >= 2
                ? "Needs Review"
                : "Low Risk"
            }
          />

          {insightTab === "reported" && (
            <DetailRow
              label="Reports Received"
              value={`${selectedInsightUser.count} report(s)`}
            />
          )}

          {insightTab === "cancelled" && (
            <DetailRow
              label="Cancelled Transactions"
              value={`${selectedInsightUser.count} cancel(s)`}
            />
          )}

          {insightTab === "abusers" && (
            <DetailRow
              label="False Reports"
              value={`${selectedInsightUser.count} dismissed report(s)`}
            />
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#111827" }}>
            Context
          </h3>

          {insightTab === "reported" && (
            <div style={{ display: "grid", gap: 8 }}>
              {reports
                .filter(
                  (report) =>
                    getRelatedUserIdForReport(report) === selectedInsightUser.id
                )
                .slice(0, 3)
                .map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => onOpenReport(report)}
                    style={{
                      textAlign: "left",
                      background: "#fafafa",
                      border: "1px solid #eef1f4",
                      borderRadius: 10,
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 9,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {report.category || "Report"}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 11.5,
                        color: "#111827",
                        fontWeight: 700,
                      }}
                    >
                      {getReportStatus(report)} | {formatDate(report.createdAt)}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 10.5, color: PRIMARY }}>
                      Open report
                    </p>
                  </button>
                ))}
            </div>
          )}

          {insightTab === "cancelled" && (
            <DetailRow
              label="Cancellation Summary"
              value={`${
                selectedInsightUser.count || 0
              } cancelled transaction(s) found for this user.`}
            />
          )}

          {insightTab === "abusers" && (
            <div style={{ display: "grid", gap: 8 }}>
              {reports
                .filter(
                  (report) =>
                    getReportReporterId(report) === selectedInsightUser.id &&
                    getReportStatus(report) === "dismissed"
                )
                .slice(0, 3)
                .map((report) => (
                  <DetailRow
                    key={report.id}
                    label={report.category || "Dismissed Report"}
                    value={`${
                      report.reportedName || "Unknown target"
                    } | ${formatDate(report.createdAt)}`}
                  />
                ))}
              {!selectedInsightHasActiveRestriction &&
                !selectedInsightCanApplyReportAbuseAction && (
                  <div
                    style={{
                      background: "#fff7e8",
                      border: "1px solid #f4dfab",
                      borderRadius: 12,
                      padding: "8px 10px",
                      color: "#9a6700",
                      fontSize: 11.5,
                      lineHeight: 1.45,
                    }}
                  >
                    The latest false-report action is already recorded. Another
                    dismissed report is needed before the next reporting restriction
                    step can be applied.
                  </div>
                )}
            </div>
          )}
        </div>

        {(insightTab === "cancelled" || insightTab === "abusers") && (
          <button
            onClick={() => onApplyRestriction(selectedInsightUser)}
            disabled={
              processingAction ||
              (insightTab === "abusers" &&
                !selectedInsightHasActiveRestriction &&
                !selectedInsightCanApplyReportAbuseAction)
            }
            style={{
              marginTop: 14,
              width: "100%",
              padding: "9px 12px",
              borderRadius: 999,
              border: "1px solid #f6c3d4",
              background: "#fff1f5",
              color: PRIMARY,
              fontWeight: 800,
              cursor:
                processingAction ||
                (insightTab === "abusers" &&
                  !selectedInsightHasActiveRestriction &&
                  !selectedInsightCanApplyReportAbuseAction)
                  ? "default"
                  : "pointer",
              opacity:
                processingAction ||
                (insightTab === "abusers" &&
                  !selectedInsightHasActiveRestriction &&
                  !selectedInsightCanApplyReportAbuseAction)
                  ? 0.7
                  : 1,
            }}
          >
            {processingAction
              ? "Processing..."
              : selectedInsightHasActiveRestriction
              ? "Undo Restriction"
              : selectedInsightRestrictionLabel}
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "9px 12px",
            borderRadius: 999,
            border: "none",
            background: PRIMARY,
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
