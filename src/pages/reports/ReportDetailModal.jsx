import React from "react";
import { EMPTY_VALUE, MODAL_PANEL_STYLE } from "./constants";
import { ActionButton, DetailRow } from "./components";
import {
  formatDateTime,
  getCategoryStyle,
  getReportStatus,
  getReportTypeLabel,
  getSeverityStyle,
  getStatusStyle,
} from "./utils";

export function ReportDetailModal({
  isSelectedReportAwaitingEnforcement,
  isSelectedReportClosed,
  isSelectedReportPending,
  onClose,
  onDeleteReport,
  onEnforceAction,
  onOpenBlockingReport,
  onUndoAction,
  processingAction,
  selectedReport,
  selectedReportCanReopen,
  selectedReportCanUndo,
  selectedReportContentBody,
  selectedReportContentBodyLabel,
  selectedReportContentImage,
  selectedReportContentOwner,
  selectedReportContentTitle,
  selectedReportContentTitleLabel,
  selectedReportRecommendation,
  selectedReportTargetId,
  selectedReportTargetType,
  selectedReportUndoConflict,
  selectedReportUndoLabel,
}) {
  if (!selectedReport) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.55)",
        backdropFilter: "blur(2px)",
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
          width: "100%",
          maxWidth: 880,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              ClosetLoop Report Review
            </p>
            <h2
              style={{
                margin: "5px 0 4px",
                fontSize: 24,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Report Details
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                ...getStatusStyle(getReportStatus(selectedReport)),
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: "nowrap",
                textTransform: "capitalize",
              }}
            >
              {getReportStatus(selectedReport)}
            </span>

            <button
              type="button"
              aria-label="Close modal"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                fontSize: 18,
                lineHeight: 1,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                flexShrink: 0,
              }}
            >
              x
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <DetailRow label="Type" value={getReportTypeLabel(selectedReport)} />
          <DetailRow
            label="Reported Name"
            value={selectedReport.reportedName || "Unknown"}
          />
          <DetailRow
            label="Reported By"
            value={selectedReport.reporterName || "Unknown"}
          />
        </div>

        <div
          style={{
            marginBottom: 12,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              ...getCategoryStyle(selectedReport.category || ""),
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              display: "inline-block",
            }}
          >
            {selectedReport.category || "Uncategorized"}
          </span>

          <span
            style={{
              ...getSeverityStyle(selectedReportRecommendation?.severity || "manual"),
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              display: "inline-block",
              textTransform: "capitalize",
            }}
          >
            Severity: {selectedReportRecommendation?.severity || "manual"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            alignItems: "start",
          }}
        >
          <div style={MODAL_PANEL_STYLE}>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Complaint Information
            </h3>

            <div style={{ display: "grid", gap: 8 }}>
              <DetailRow label="Category" value={selectedReport.category || EMPTY_VALUE} />
              <DetailRow label="Details" value={selectedReport.details || EMPTY_VALUE} />
              <DetailRow
                label="Date Submitted"
                value={formatDateTime(selectedReport.createdAt)}
              />
              <DetailRow
                label="Reviewed At"
                value={formatDateTime(selectedReport.reviewedAt)}
              />
            </div>
          </div>

          <div style={MODAL_PANEL_STYLE}>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Report Information
            </h3>

            <div style={{ display: "grid", gap: 8 }}>
              <DetailRow label="Report ID" value={selectedReport.id} />
              <DetailRow
                label="Reporter ID"
                value={selectedReport.reporterId || EMPTY_VALUE}
              />
              <DetailRow label="Target ID" value={selectedReportTargetId || EMPTY_VALUE} />
              <DetailRow label="Target Type" value={getReportTypeLabel(selectedReport)} />
              <DetailRow
                label="Review Status"
                value={getReportStatus(selectedReport)}
              />
              <DetailRow
                label="Admin Action"
                value={selectedReport.adminAction || "No action yet"}
              />
              <DetailRow
                label="Enforcement Action"
                value={selectedReport.enforcementAction || "none"}
              />
              <DetailRow
                label="Content Action"
                value={selectedReport.contentAction || "none"}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            ...MODAL_PANEL_STYLE,
          }}
        >
          <h3
            style={{
              margin: "0 0 10px",
              fontSize: 14,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            Reported Content Preview
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 280px) 1fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div
              style={{
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid #eef1f4",
                background: "#f8fafc",
                minHeight: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selectedReportContentImage ? (
                <img
                  src={selectedReportContentImage}
                  alt="Reported content"
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: 220,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    textAlign: "center",
                    padding: 16,
                  }}
                >
                  No image available for this reported content.
                </span>
              )}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <DetailRow
                label={selectedReportContentTitleLabel}
                value={selectedReportContentTitle}
              />
              <DetailRow
                label={selectedReportContentBodyLabel}
                value={selectedReportContentBody}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <DetailRow label="Owner / Author" value={selectedReportContentOwner} />
                <DetailRow label="Target Type" value={selectedReportTargetType} />
                <DetailRow label="Target ID" value={selectedReportTargetId} />
              </div>
            </div>
          </div>
        </div>

        {(isSelectedReportPending || isSelectedReportAwaitingEnforcement) &&
          selectedReportRecommendation && (
            <div
              style={{
                marginTop: 12,
                background: "#fffafc",
                border: "1px solid #f6d6e1",
                borderRadius: 16,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", marginBottom: 8 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  Recommended Enforcement
                </h3>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <DetailRow
                  label="Moderation Path"
                  value={selectedReportRecommendation.pathLabel}
                />
                <DetailRow
                  label="Recommended Action"
                  value={selectedReportRecommendation.recommendation.adminAction}
                />
                <DetailRow
                  label="Severity"
                  value={selectedReportRecommendation.severity}
                />
                <DetailRow
                  label={selectedReportRecommendation.levelLabel}
                  value={`${selectedReportRecommendation.currentLevel} -> ${selectedReportRecommendation.nextLevel}`}
                />
                <DetailRow
                  label="Duration"
                  value={
                    selectedReportRecommendation.recommendation.durationDays > 0
                      ? `${selectedReportRecommendation.recommendation.durationDays} day(s)`
                      : "No timed restriction"
                  }
                />
                <DetailRow
                  label="Target"
                  value={selectedReportRecommendation.targetUserLabel}
                />
                <DetailRow
                  label="Scope"
                  value={selectedReportRecommendation.scopeLabel}
                />
                {selectedReportRecommendation.contentActionLabel && (
                  <DetailRow
                    label="Content Action"
                    value={selectedReportRecommendation.contentActionLabel}
                  />
                )}
              </div>

              {selectedReportRecommendation.isProtectedDuplicate && (
                <div
                  style={{
                    marginTop: 8,
                    background: "#fff7e8",
                    border: "1px solid #f4dfab",
                    color: "#9a6700",
                    borderRadius: 12,
                    padding: "8px 10px",
                    fontSize: 11.5,
                    lineHeight: 1.45,
                  }}
                >
                  Recent matching enforcement exists. Closing this report will not
                  raise the penalty level again.
                </div>
              )}
            </div>
          )}

        {isSelectedReportClosed && (
          <div
            style={{
              marginTop: 12,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 12,
            }}
          >
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Final Decision
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <DetailRow
                label="Closed Status"
                value={getReportStatus(selectedReport)}
              />
              <DetailRow
                label="Applied Action"
                value={selectedReport.adminAction || "No action recorded"}
              />
              <DetailRow
                label="Enforcement"
                value={selectedReport.enforcementAction || "none"}
              />
              <DetailRow
                label="Content Action"
                value={selectedReport.contentAction || "none"}
              />
              <DetailRow
                label="Moderation Path"
                value={selectedReportRecommendation?.pathLabel || "Manual Review"}
              />
            </div>

            <div
              style={{
                marginTop: 8,
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 8,
              }}
            >
              {isSelectedReportAwaitingEnforcement && (
                <ActionButton
                  label={
                    processingAction ? "Processing..." : "Apply Recommended Action"
                  }
                  bg="rgba(198,226,198,0.28)"
                  color="#2f6b4f"
                  borderColor="rgba(198,226,198,0.9)"
                  disabled={processingAction}
                  onClick={() => onEnforceAction(selectedReport)}
                />
              )}
              {selectedReportUndoConflict && (
                <div
                  style={{
                    background: "#fff7e8",
                    border: "1px solid #f4dfab",
                    borderRadius: 12,
                    padding: "10px 12px",
                    color: "#9a6700",
                    fontSize: 11.5,
                    lineHeight: 1.45,
                  }}
                >
                  {selectedReportUndoConflict.blockingReport &&
                  selectedReportUndoConflict.blockingReport.id !== selectedReport.id
                    ? `A newer moderation already changed this ${selectedReportUndoConflict.scope} on report ${selectedReportUndoConflict.blockingReport.id}. Undo will automatically start from that latest moderation and continue here.`
                    : selectedReportUndoConflict.message}
                </div>
              )}
              {selectedReportCanReopen && (
                <ActionButton
                  label={processingAction ? "Processing..." : selectedReportUndoLabel}
                  bg="#fff7e8"
                  color="#9a6700"
                  borderColor="#f4dfab"
                  disabled={processingAction || !selectedReportCanUndo}
                  onClick={() => onUndoAction(selectedReport)}
                />
              )}
              {selectedReportUndoConflict?.blockingReport &&
                selectedReportUndoConflict.blockingReport.id !== selectedReport.id && (
                  <ActionButton
                    label="Open Latest Moderation"
                    bg="#fff"
                    color="#374151"
                    borderColor="#d1d5db"
                    disabled={processingAction}
                    onClick={() =>
                      onOpenBlockingReport(
                        selectedReportUndoConflict.blockingReport
                      )
                    }
                  />
                )}
              <ActionButton
                label={
                  processingAction ? "Processing..." : "Delete Report Permanently"
                }
                bg="#fff"
                color="#9f274d"
                borderColor="#f7c8d4"
                disabled={processingAction}
                onClick={() => onDeleteReport(selectedReport)}
              />
            </div>
          </div>
        )}

        {isSelectedReportPending && (
          <div
            style={{
              marginTop: 12,
              background: "#fff",
              border: "1px solid #eef1f4",
              borderRadius: 16,
              padding: 12,
            }}
          >
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Moderation Actions
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <ActionButton
                label={processingAction ? "Processing..." : "Verify"}
                bg="rgba(198,226,198,0.28)"
                color="#2f6b4f"
                borderColor="rgba(198,226,198,0.9)"
                disabled={processingAction}
                onClick={() => onEnforceAction(selectedReport, "verify")}
              />

              <ActionButton
                label={processingAction ? "Processing..." : "Dismiss"}
                bg="#fdecef"
                color="#9f274d"
                borderColor="#f7c8d4"
                disabled={processingAction}
                onClick={() => onEnforceAction(selectedReport, "dismiss")}
              />

              <ActionButton
                label={
                  processingAction ? "Processing..." : "Delete Report Permanently"
                }
                bg="#fff"
                color="#9f274d"
                borderColor="#f7c8d4"
                disabled={processingAction}
                onClick={() => onDeleteReport(selectedReport)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
