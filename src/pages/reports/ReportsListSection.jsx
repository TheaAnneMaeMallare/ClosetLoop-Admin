import React, { useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaSearch,
  FaTimesCircle,
} from "react-icons/fa";
import {
  CARD_STYLE,
  EMPTY_VALUE,
  PRIMARY,
  tdStyle,
  tdStyleStrong,
  thStyle,
  TYPE_FILTER_OPTIONS,
} from "./constants";
import AdminTablePagination from "../../components/AdminTablePagination";
import {
  formatDate,
  getCategoryStyle,
  getReportStatus,
  getReportTypeLabel,
  getStatusStyle,
  getTargetDisplayName,
} from "./utils";

export function ReportsListSection({
  filteredReports,
  loading,
  reports,
  search,
  selectedReport,
  sortBy,
  statusFilter,
  typeFilter,
  onSearchChange,
  onSelectReport,
  onSortByChange,
  onStatusFilterChange,
  onTypeFilterChange,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const compactTextStyle = {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const statusIcon = (status) => {
    if (status === "verified") return <FaCheckCircle size={10} />;
    if (status === "dismissed") return <FaTimesCircle size={10} />;
    return <FaClock size={10} />;
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredReports.length / rowsPerPage)
  );

  const page = Math.min(currentPage, totalPages);

  const paginatedReports = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredReports.slice(start, start + rowsPerPage);
  }, [filteredReports, page, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, statusFilter, typeFilter, filteredReports.length, rowsPerPage]);

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
          flexDirection: "column",
          gap: 10,
          padding: "14px 16px 12px",
          borderBottom: "1px solid #eee",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
            Reports List
          </h2>
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            Showing {filteredReports.length} of {reports.length}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TYPE_FILTER_OPTIONS.map((chip) => {
            const isActive = typeFilter === chip.value;

            return (
              <button
                key={chip.value}
                onClick={() => onTypeFilterChange(chip.value)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${isActive ? PRIMARY : "#ddd"}`,
                  background: isActive ? PRIMARY : "#fff",
                  color: isActive ? "#fff" : "#374151",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "0.2s ease",
                  boxShadow: isActive
                    ? "0 6px 16px rgba(222,99,138,0.22)"
                    : "0 2px 8px rgba(15,23,42,0.06)",
                }}
                onMouseEnter={(event) => {
                  if (!isActive) event.currentTarget.style.background = "#f9fafb";
                }}
                onMouseLeave={(event) => {
                  if (!isActive) event.currentTarget.style.background = "#fff";
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(280px, 1fr) minmax(150px, 180px) minmax(150px, 180px)",
            gap: 8,
            alignItems: "start",
          }}
        >
          <div style={{ position: "relative" }}>
            <FaSearch
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                color: "#6b7280",
              }}
            />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by report ID, name, reason, or keyword..."
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: 12,
                border: "1px solid #d8dde6",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>

          <select
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid #d8dde6",
              fontSize: 12,
              outline: "none",
              background: "#fff",
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name_asc">Name A-Z</option>
            <option value="status_asc">Status A-Z</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid #d8dde6",
              fontSize: 12,
              outline: "none",
              background: "#fff",
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: "hidden" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 11,
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ background: "#f9edf5" }}>
              <th style={{ ...thStyle, width: "9.5%" }}>Report ID</th>
              <th style={{ ...thStyle, width: "6.5%" }}>Type</th>
              <th style={{ ...thStyle, width: "15.5%" }}>Category</th>
              <th style={{ ...thStyle, width: "16%" }}>Details</th>
              <th style={{ ...thStyle, width: "9.5%" }}>Reported By</th>
              <th style={{ ...thStyle, width: "11.5%" }}>Target</th>
              <th style={{ ...thStyle, width: "10%" }}>Date</th>
              <th
                style={{
                  ...thStyle,
                  width: "8.5%",
                  paddingLeft: 8,
                  paddingRight: 8,
                  whiteSpace: "nowrap",
                }}
              >
                Status
              </th>
              <th
                style={{
                  ...thStyle,
                  width: "7.5%",
                  textAlign: "right",
                  paddingRight: 22,
                  whiteSpace: "nowrap",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ padding: 20, textAlign: "center", fontSize: 12 }}
                >
                  Loading reports...
                </td>
              </tr>
            ) : filteredReports.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ padding: 20, textAlign: "center", fontSize: 12 }}
                >
                  No reports found.
                </td>
              </tr>
            ) : (
              paginatedReports.map((report, index) => {
                const reason = report.category || EMPTY_VALUE;
                const details = report.details || EMPTY_VALUE;
                const reportedBy = report.reporterName || "Unknown";
                const target = getTargetDisplayName(report);
                const type = getReportTypeLabel(report);
                const status = getReportStatus(report);
                const isSelected = selectedReport?.id === report.id;

                return (
                  <tr
                    key={report.id}
                    onClick={() => onSelectReport(report)}
                    style={{
                      background: isSelected
                        ? "#fff5f8"
                        : index % 2
                        ? "#fff"
                        : "#f9fafb",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ ...tdStyleStrong, padding: "10px 12px" }}>
                      <span title={report.id} style={compactTextStyle}>
                        {report.id}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, padding: "10px 12px" }}>
                      <span title={type} style={compactTextStyle}>
                        {type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, padding: "10px 12px" }}>
                      <span
                        style={{
                          ...getCategoryStyle(reason),
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 9.5,
                          fontWeight: 700,
                          display: "inline-block",
                          maxWidth: "100%",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          lineHeight: 1.3,
                        }}
                        title={reason}
                        >
                          {reason}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, padding: "10px 12px" }}>
                      <div
                        style={{
                          color: "#6b7280",
                          lineHeight: 1.35,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          wordBreak: "break-word",
                        }}
                        title={details}
                        >
                          {details}
                        </div>
                    </td>
                    <td style={{ ...tdStyle, padding: "10px 12px" }}>
                      <span title={reportedBy} style={compactTextStyle}>
                        {reportedBy}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, padding: "10px 12px" }}>
                      <span title={target} style={compactTextStyle}>
                        {target}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "block",
                          whiteSpace: "nowrap",
                          fontSize: 10.5,
                        }}
                        >
                          {formatDate(report.createdAt)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, padding: "10px 8px 10px 8px" }}>
                      <span
                        style={{
                          ...getStatusStyle(status),
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 9.5,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          textTransform: "capitalize",
                          whiteSpace: "nowrap",
                        }}
                        >
                          {statusIcon(status)}
                          {status}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        padding: "10px 22px 10px 8px",
                      }}
                    >
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectReport(report);
                        }}
                        style={{
                          padding: "6px 0",
                          borderRadius: 999,
                          background: PRIMARY,
                          border: "none",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: 10,
                          fontWeight: 700,
                          width: 64,
                          minWidth: 64,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminTablePagination
        totalItems={filteredReports.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        noun="reports"
      />
    </div>
  );
}
