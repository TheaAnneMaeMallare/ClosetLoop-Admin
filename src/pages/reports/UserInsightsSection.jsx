import React from "react";
import { CARD_STYLE, EMPTY_VALUE, PRIMARY, SECTION_HEADER_STYLE } from "./constants";
import { Button } from "./components";

function getInsightRiskBadge(insightTab, item) {
  if (insightTab === "reported") {
    if (item.count >= 5) return { label: "High Risk", color: "#fff", bg: "#e02424" };
    if (item.count >= 2) return { label: "Needs Review", color: "#fff", bg: "#f59e42" };
    if (item.count === 1) return { label: "Low Risk", color: "#374151", bg: "#f3f4f6" };
  }

  if (insightTab === "cancelled") {
    if (item.count >= 3) return { label: "High Risk", color: "#fff", bg: "#e02424" };
    if (item.count === 2) return { label: "Needs Review", color: "#fff", bg: "#f59e42" };
    if (item.count === 1) return { label: "Low Risk", color: "#374151", bg: "#f3f4f6" };
  }

  if (insightTab === "abusers") {
    if (item.count >= 3 || (item.reviewedReports >= 3 && item.dismissRate >= 0.6)) {
      return { label: "High Risk", color: "#fff", bg: "#e02424" };
    }
    if (item.count === 2) return { label: "Needs Review", color: "#fff", bg: "#f59e42" };
    if (item.count === 1) return { label: "Low Risk", color: "#374151", bg: "#f3f4f6" };
  }

  return null;
}

export function UserInsightsSection({
  insightItems,
  insightTab,
  onInsightTabChange,
  onSelectInsightUser,
}) {
  return (
    <div
      style={{
        overflow: "hidden",
        ...CARD_STYLE,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          ...SECTION_HEADER_STYLE,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            User Insights
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            Click a row to open the relevant user moderation context.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            onClick={() => onInsightTabChange("reported")}
            style={{
              background: insightTab === "reported" ? PRIMARY : "#fff",
              color: insightTab === "reported" ? "#fff" : "#374151",
              borderColor: insightTab === "reported" ? PRIMARY : "#ddd",
            }}
          >
            Most Reported
          </Button>
          <Button
            onClick={() => onInsightTabChange("cancelled")}
            style={{
              background: insightTab === "cancelled" ? PRIMARY : "#fff",
              color: insightTab === "cancelled" ? "#fff" : "#374151",
              borderColor: insightTab === "cancelled" ? PRIMARY : "#ddd",
            }}
          >
            Frequent Cancellers
          </Button>
          <Button
            onClick={() => onInsightTabChange("abusers")}
            style={{
              background: insightTab === "abusers" ? PRIMARY : "#fff",
              color: insightTab === "abusers" ? "#fff" : "#374151",
              borderColor: insightTab === "abusers" ? PRIMARY : "#ddd",
            }}
          >
            Report Abusers
          </Button>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {insightItems.length === 0 ? (
          <div
            style={{
              border: "1px dashed #e5e7eb",
              borderRadius: 12,
              padding: "16px 12px",
              color: "#6b7280",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            {insightTab === "reported"
              ? "No reported users yet."
              : insightTab === "cancelled"
              ? "No cancellation data found yet."
              : "No report abusers found yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {insightItems.map((item, index) => {
              const risk = getInsightRiskBadge(insightTab, item);

              return (
                <div
                  key={`${item.id}-${index}`}
                  style={{
                    border: "1px solid #edf0f3",
                    borderRadius: 12,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: index === 0 ? "#fdf7fa" : "#fff",
                    cursor: "pointer",
                    transition: "0.15s ease",
                  }}
                  onClick={() => onSelectInsightUser(item)}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = "#fff5f8";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background =
                      index === 0 ? "#fdf7fa" : "#fff";
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 10,
                        color: "#9ca3af",
                        fontWeight: 700,
                      }}
                    >
                      #{index + 1}
                    </p>
                    <p
                      style={{
                        margin: "3px 0 2px",
                        fontSize: 12,
                        color: "#111827",
                        fontWeight: 700,
                        wordBreak: "break-word",
                      }}
                    >
                      {item.name || "Unknown"}
                    </p>
                    {insightTab === "cancelled" && item.isLimited && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          marginBottom: 4,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#fdecef",
                          color: "#9f274d",
                          border: "1px solid #f7c8d4",
                        }}
                      >
                        Trade limited
                      </span>
                    )}
                    {insightTab === "abusers" && item.isRestricted && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          marginBottom: 4,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#fdecef",
                          color: "#9f274d",
                          border: "1px solid #f7c8d4",
                        }}
                      >
                        Report restricted
                      </span>
                    )}
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        color: "#6b7280",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.meta || EMPTY_VALUE}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {risk && (
                      <span
                        style={{
                          background: risk.bg,
                          color: risk.color,
                          borderRadius: 999,
                          padding: "2px 10px",
                          fontWeight: 700,
                          fontSize: 10,
                          marginRight: 2,
                        }}
                      >
                        {risk.label}
                      </span>
                    )}

                    <span
                      style={{
                        background: insightTab === "reported" ? "#fdeef4" : "#f3f4f6",
                        color: insightTab === "reported" ? PRIMARY : "#111827",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontWeight: 700,
                        fontSize: 11,
                        whiteSpace: "nowrap",
                        border:
                          insightTab === "reported"
                            ? "1px solid #f7d2e0"
                            : "1px solid #e5e7eb",
                      }}
                    >
                      {item.count}{" "}
                      {insightTab === "reported"
                        ? `report${item.count !== 1 ? "s" : ""}`
                        : insightTab === "cancelled"
                        ? `cancel${item.count !== 1 ? "s" : ""}`
                        : "dismissed"}
                    </span>

                    <button
                      type="button"
                      style={{
                        marginLeft: 4,
                        padding: "5px 12px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        color: PRIMARY,
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: "pointer",
                        transition: "0.15s",
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectInsightUser(item);
                      }}
                      tabIndex={-1}
                      aria-label="View user details"
                    >
                      View
                    </button>
                    <span style={{ color: "#bbb", fontSize: 18, marginLeft: 2 }}>
                      &#8250;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
