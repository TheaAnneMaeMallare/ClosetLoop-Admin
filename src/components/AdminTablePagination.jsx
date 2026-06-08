import React, { useMemo } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function AdminTablePagination({
  totalItems,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 20, 30],
  noun = "results",
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const startRow = (page - 1) * rowsPerPage + 1;
  const endRow = Math.min(page * rowsPerPage, totalItems);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (page <= 3) {
      return [1, 2, 3, "end-ellipsis", totalPages];
    }

    if (page >= totalPages - 2) {
      return [1, "start-ellipsis", totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, "start-ellipsis", page, "end-ellipsis", totalPages];
  }, [page, totalPages]);

  const goToPage = (nextPage) => {
    onPageChange(Math.max(1, Math.min(totalPages, nextPage)));
  };

  if (!totalItems) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px 14px",
        borderTop: "1px solid #eef1f4",
        flexWrap: "nowrap",
        overflowX: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "nowrap",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
            Rows per page
          </span>
          <select
            value={rowsPerPage}
            onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
            style={{
              height: 36,
              width: 62,
              minWidth: 62,
              padding: "0 28px 0 12px",
              borderRadius: 10,
              border: "1px solid #d8dde6",
              backgroundColor: "#fff",
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27 fill=%27none%27%3E%3Cpath d=%27M3 4.5L6 7.5L9 4.5%27 stroke=%27%23111827%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E")',
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              backgroundSize: "12px 12px",
              fontSize: 12,
              color: "#111827",
              outline: "none",
              boxSizing: "border-box",
              verticalAlign: "middle",
              margin: 0,
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
            }}
          >
            {rowsPerPageOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
          {`Showing ${startRow}-${endRow} of ${totalItems} ${noun} | Page ${page} of ${totalPages}`}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "nowrap",
          flexShrink: 0,
          marginLeft: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => goToPage(page - 1)}
          disabled={page === 1}
          style={{
            padding: "7px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#374151",
            fontSize: 11,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: page === 1 ? "default" : "pointer",
            opacity: page === 1 ? 0.55 : 1,
          }}
        >
          <FaChevronLeft size={10} />
          Previous
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {pageNumbers.map((pageNumber) => {
            if (typeof pageNumber === "string") {
              return (
                <span
                  key={pageNumber}
                  style={{ fontSize: 12, color: "#9ca3af", padding: "0 2px" }}
                >
                  ...
                </span>
              );
            }

            const isActive = pageNumber === page;

            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => goToPage(pageNumber)}
                style={{
                  minWidth: 34,
                  height: 34,
                  padding: "0 8px",
                  borderRadius: 10,
                  border: `1px solid ${isActive ? "#de638a" : "#d1d5db"}`,
                  background: isActive ? "#de638a" : "#fff",
                  color: isActive ? "#fff" : "#374151",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {pageNumber}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => goToPage(page + 1)}
          disabled={page === totalPages}
          style={{
            padding: "7px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#374151",
            fontSize: 11,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: page === totalPages ? "default" : "pointer",
            opacity: page === totalPages ? 0.55 : 1,
          }}
        >
          Next
          <FaChevronRight size={10} />
        </button>
      </div>
    </div>
  );
}
