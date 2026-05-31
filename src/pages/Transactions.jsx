// src/pages/Transactions.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import AdminStatCard, {
  ADMIN_STAT_CARD_COLORS,
  AdminStatGrid,
} from "../components/AdminStatCard";
import AdminTablePagination from "../components/AdminTablePagination";
import {
  ADMIN_TABLE_CARD_STYLE,
  ADMIN_TABLE_CELL_STRONG_STYLE,
  ADMIN_TABLE_CELL_STYLE,
  ADMIN_TABLE_EMPTY_ROW_STYLE,
  ADMIN_TABLE_HEAD_CELL_STYLE,
  ADMIN_TABLE_STYLE,
} from "../components/adminTableStyles";
import {
  FaExchangeAlt,
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaBoxOpen,
  FaSearch,
  FaUserCircle,
} from "react-icons/fa";

const PRIMARY = "#de638a";
const CANCELLATION_REVIEW_THRESHOLD = 2;

const CARD_STYLE = {
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
};

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

function prettyStatus(status) {
  const s = normalizeStatus(status);

  if (s === "pending") return "Pending";
  if (s === "accepted") return "Accepted";
  if (s === "to receive") return "To Receive";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  if (s === "rejected") return "Rejected";

  return status || "Unknown";
}

function formatDate(value) {
  if (!value) return "â€”";
  try {
    let d;

    if (value?.toDate) d = value.toDate();
    else if (value?.seconds) d = new Date(value.seconds * 1000);
    else d = new Date(value);

    if (isNaN(d.getTime())) return "â€”";

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "â€”";
  }
}

function formatDateTime(value) {
  if (!value) return "â€”";
  try {
    let d;

    if (value?.toDate) d = value.toDate();
    else if (value?.seconds) d = new Date(value.seconds * 1000);
    else d = new Date(value);

    if (isNaN(d.getTime())) return "â€”";

    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "â€”";
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

function getTradeRestrictionStatus(user) {
  const suspendedUntil =
    user?.tradeSuspendedUntil ||
    user?.tradeRestrictedUntil ||
    user?.tradingSuspendedUntil ||
    null;
  const suspendedUntilMs = toMillis(suspendedUntil);
  const cancelCount = Math.max(
    Number(user?.cancelCount || 0),
    Number(user?.cancelledTransactions || 0)
  );
  const isActive = suspendedUntilMs > Date.now();
  const isLimited =
    isActive ||
    user?.tradeLimitedFeatures === true;

  return {
    cancelCount,
    suspendedUntil,
    suspendedUntilMs,
    isActive,
    isLimited,
  };
}

function getStatusStyle(status) {
  const s = normalizeStatus(status);

  if (s === "completed") {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (s === "pending") {
    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  if (s === "accepted") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  if (s === "to receive") {
    return {
      background: "#ede9fe",
      color: "#6d28d9",
    };
  }

  if (s === "cancelled" || s === "rejected") {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
  };
}

function getTypeStyle(type) {
  const t = (type || "").toString().trim().toLowerCase();

  if (t.includes("giveaway")) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (t.includes("trade")) {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #e5e7eb",
  };
}

function hasLinkedUser(data, lookup) {
  const userIds = [
    data?.ownerId,
    data?.ownerUid,
    data?.requesterId,
    data?.requesterUid,
  ].filter(Boolean);

  if (!userIds.length) return false;

  return userIds.every((id) => Boolean(lookup[id]));
}

function hasLinkedPost(data, lookup) {
  const postIds = [
    data?.requestedPostId,
    data?.postId,
    data?.itemId,
    data?.targetPostId,
    data?.offeredPostId,
    data?.offerPostId,
    data?.offeredItemId,
    data?.tradePostId,
    data?.exchangePostId,
    data?.requesterPostId,
  ].filter(Boolean);

  if (!postIds.length) return false;

  return postIds.some((id) => Boolean(lookup[id]));
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
        "Both sides completed the transaction.",
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
    key: rawState || eventType || "activity",
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

function resolveTransactionItem(data, postsLookup, role) {
  const isOffered = role === "offered";
  const postId = isOffered
    ? firstValue(
        data.offeredPostId,
        data.offerPostId,
        data.offeredItemId,
        data.tradePostId,
        data.exchangePostId,
        data.requesterPostId
      )
    : firstValue(data.requestedPostId, data.postId, data.itemId, data.targetPostId);
  const postInfo = postId ? postsLookup[postId] : null;
  const title = isOffered
    ? firstValue(
        data.offeredItemTitle,
        data.offeredItemName,
        data.offerItemTitle,
        data.offerItemName,
        data.proposedItemTitle,
        data.proposedItemName,
        data.requesterItemTitle,
        data.requesterItemName,
        postInfo?.title
      )
    : firstValue(
        data.requestedItemTitle,
        data.requestedItemName,
        data.itemTitle,
        data.itemName,
        data.postTitle,
        data.productName,
        data.title,
        postInfo?.title
      );
  const description = isOffered
    ? firstValue(
        data.offeredItemDescription,
        data.offerItemDescription,
        data.proposedItemDescription,
        data.requesterItemDescription,
        postInfo?.description
      )
    : firstValue(
        data.requestedItemDescription,
        data.itemDescription,
        data.postDescription,
        data.description,
        postInfo?.description
      );
  const image = isOffered
    ? firstValue(
        data.offeredItemImage,
        data.offerItemImage,
        data.proposedItemImage,
        data.requesterItemImage,
        postInfo?.image
      )
    : firstValue(data.itemImage, data.postImage, data.imageUrl, postInfo?.image);

  if (!postId && !title && !description && !image) return null;

  return {
    id: postId || null,
    role,
    label: isOffered ? "Offered Item" : "Requested Item",
    title: title || "Unnamed item",
    description: description || "No item description available.",
    image: image || null,
  };
}

function getTransactionItems(tx) {
  return [tx?.requestedItem, tx?.offeredItem].filter(Boolean);
}

function DetailRow({ label, value }) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #f1f5f9",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 14,
          color: "#374151",
          fontWeight: 500,
          wordBreak: "break-word",
          lineHeight: 1.45,
        }}
      >
        {value}
      </p>
    </div>
  );
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
      detail: `${tx.requesterResolvedName || "Requester"} submitted the transaction request.`,
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
      detail: `${tx.ownerResolvedName || "Owner"} accepted the request.`,
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
      detail: "Both sides completed the transaction.",
    },
    {
      key: "cancelled",
      label: "Transaction cancelled",
      at: firstTimestamp(tx, ["cancelledAt", "canceledAt", "dateCancelled"]),
      tone: "danger",
      detail: tx.cancelledBy
        ? `Cancelled by ${tx.cancelledBy === tx.requesterId ? tx.requesterResolvedName || "requester" : tx.cancelledBy === tx.ownerId ? tx.ownerResolvedName || "owner" : "a user"}.`
        : "The transaction was cancelled.",
    },
    {
      key: "rejected",
      label: "Request rejected",
      at: firstTimestamp(tx, ["rejectedAt", "declinedAt", "dateRejected"]),
      tone: "danger",
      detail: `${tx.ownerResolvedName || "Owner"} rejected the request.`,
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
      label: `Status updated to ${prettyStatus(tx.status)}`,
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

function UserLink({ label, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        color: "#374151",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "opacity 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.75";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    >
      {label}
    </span>
  );
}

function UserProfileModal({ user, onClose }) {
  if (!user) return null;

  const name =
    user.displayName ||
    user.fullName ||
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    "Unnamed";

  const photo = user.photoURL || null;
  const username = user.username ? `@${user.username}` : "â€”";
  const email = user.email || "â€”";
  const role = user.role || (user.isAdmin ? "admin" : "user");
  const joined = formatDate(user.createdAt || user.joinedAt);
  const barangay = user.location?.barangay || "â€”";
  const municipality = user.location?.municipality || "â€”";
  const region = user.location?.region || "â€”";
  const tradeRestriction = getTradeRestrictionStatus(user);
  const tradeStatus = tradeRestriction.isActive
    ? "Trade Restricted"
    : tradeRestriction.isLimited
    ? "Trade Limited"
    : "Trading Open";

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
        zIndex: 100001,
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
          borderRadius: 20,
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              ClosetLoop User Profile
            </p>
            <h2
              style={{
                margin: "6px 0 6px",
                fontSize: 28,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              User Details
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              View the selected user information related to this transaction.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "22px 24px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
            marginBottom: 18,
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
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {name}
              </h1>

              <p
                style={{
                  margin: "2px 0 4px",
                  fontSize: 14,
                  color: "#6b7280",
                }}
              >
                {username}
              </p>

              <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>
                {email}
              </p>

              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                Joined: {joined}
              </p>
            </div>
          </div>
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
              border: "1px solid #f1f5f9",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 17,
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Account Information
            </h3>

            <div style={{ display: "grid", gap: 12 }}>
              <DetailRow label="Display Name" value={name} />
              <DetailRow label="Username" value={username} />
              <DetailRow label="Email" value={email} />
              <DetailRow label="Role" value={role} />
              <DetailRow label="User ID" value={user.uid || user.id || "â€”"} />
              <DetailRow label="Trade Access" value={tradeStatus} />
              <DetailRow label="Cancel Count" value={tradeRestriction.cancelCount} />
              <DetailRow
                label="Trade Restricted Until"
                value={formatDate(tradeRestriction.suspendedUntil)}
              />
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #f1f5f9",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 17,
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Location
            </h3>

            <div style={{ display: "grid", gap: 12 }}>
              <DetailRow label="Barangay" value={barangay} />
              <DetailRow label="Municipality / City" value={municipality} />
              <DetailRow label="Region" value={region} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Transactions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [usersDataMap, setUsersDataMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const transactionIdFilter = searchParams.get("transactionId") || "";

  const openTransactionDetails = (transactionId) => {
    if (!transactionId) return;
    navigate(`/admin/transactions?transactionId=${encodeURIComponent(transactionId)}`);
  };

  const closeTransactionDetails = () => {
    navigate("/admin/transactions");
  };

  const syncCancelledTransactionCounts = async (txData, usersMap) => {
    // Count how many times each user has cancelled transactions
    const cancelCountByUser = {};
    
    txData.forEach((tx) => {
      const status = normalizeStatus(tx.status);
      if (status === "cancelled" && tx.cancelledBy) {
        if (!cancelCountByUser[tx.cancelledBy]) {
          cancelCountByUser[tx.cancelledBy] = 0;
        }
        cancelCountByUser[tx.cancelledBy]++;
      }
    });

    if (Object.keys(cancelCountByUser).length === 0) return usersMap;

    const batch = writeBatch(db);
    const nextUsersMap = { ...usersMap };

    // Update each user's cancellation count in database
    Object.entries(cancelCountByUser).forEach(([userId, count]) => {
      batch.set(
        doc(db, "users", userId),
        {
          cancelCount: count,
          cancelledTransactions: count,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Update local map
      nextUsersMap[userId] = {
        ...nextUsersMap[userId],
        cancelCount: count,
        cancelledTransactions: count,
      };
    });

    await batch.commit();
    return nextUsersMap;
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [txSnap, usersSnap, postsSnap] = await Promise.all([
          getDocs(collection(db, "tradeRequests")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "posts")),
        ]);

        const usersLookup = {};
        const usersFullLookup = {};

        usersSnap.docs.forEach((d) => {
          const data = d.data();
          const resolvedName =
            data.displayName ||
            data.fullName ||
            data.name ||
            [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ||
            data.username ||
            "Unknown user";

          usersLookup[d.id] = resolvedName;
          usersFullLookup[d.id] = { id: d.id, ...data };

          if (data.uid) {
            usersLookup[data.uid] = resolvedName;
            usersFullLookup[data.uid] = { id: d.id, ...data };
          }
        });

        const postsLookup = {};
        postsSnap.docs.forEach((d) => {
          const data = d.data();
          postsLookup[d.id] = {
            title:
              data.title ||
              data.itemTitle ||
              data.itemName ||
              data.productName ||
              data.name ||
              "Unnamed item",
            description:
              data.description ||
              data.itemDescription ||
              data.postDescription ||
              data.caption ||
              "",
            image:
              (Array.isArray(data.images) && data.images[0]) ||
              data.imageUrl ||
              null,
          };
        });

        const txData = txSnap.docs
          .map((d) => {
            const data = d.data();

            const ownerId = data.ownerId || data.ownerUid || "ï¿½";
            const requesterId = data.requesterId || data.requesterUid || "ï¿½";
            const ownerName = usersLookup[ownerId] || "Unknown owner";
            const requesterName =
              usersLookup[requesterId] || "Unknown requester";
            const requestedItem = resolveTransactionItem(data, postsLookup, "requested");
            const offeredItem = resolveTransactionItem(data, postsLookup, "offered");
            const primaryItem = requestedItem || offeredItem;
            const orphaned =
              !hasLinkedUser(data, usersLookup) || !hasLinkedPost(data, postsLookup);

            return {
              id: d.id,
              ...data,
              orphaned,
              ownerResolvedName: ownerName,
              requesterResolvedName: requesterName,
              requestedItem,
              offeredItem,
              postResolvedTitle: primaryItem?.title || "Unnamed item",
              postResolvedImage: primaryItem?.image || null,
            };
          });

        setTransactions(txData);

        try {
          const syncedUsersMap = await syncCancelledTransactionCounts(
            txData,
            usersFullLookup
          );
          setUsersDataMap(syncedUsersMap);
        } catch (syncErr) {
          console.error("TRANSACTION COUNT SYNC ERROR:", syncErr);
          setUsersDataMap(usersFullLookup);
        }
      } catch (err) {
        console.error("TRANSACTIONS LOAD ERROR:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [selectedUser]);

  useEffect(() => {
    if (transactionIdFilter) {
      setStatusFilter("all");
      setTypeFilter("all");
      setSortBy("newest");
      setCurrentPage(1);
      return;
    }

    setSearch("");
  }, [transactionIdFilter]);

  useEffect(() => {
    if (!transactionIdFilter) {
      setSelectedTransaction(null);
      return;
    }

    if (!transactions.length) return;

    const matchedTransaction = transactions.find((tx) => tx.id === transactionIdFilter);
    if (matchedTransaction) {
      setSelectedTransaction(matchedTransaction);
    } else {
      setSelectedTransaction(null);
    }
  }, [transactionIdFilter, transactions]);

  const stats = useMemo(() => {
    const pending = transactions.filter(
      (t) => normalizeStatus(t.status) === "pending"
    ).length;

    const completed = transactions.filter(
      (t) => normalizeStatus(t.status) === "completed"
    ).length;

    const cancelled = transactions.filter((t) => {
      const s = normalizeStatus(t.status);
      return s === "cancelled" || s === "rejected";
    }).length;

    return {
      total: transactions.length,
      pending,
      completed,
      cancelled,
    };
  }, [transactions]);

  const selectedTransactionTimeline = useMemo(
    () => buildTransactionTimeline(selectedTransaction),
    [selectedTransaction]
  );

  const selectedTransactionItems = useMemo(
    () => getTransactionItems(selectedTransaction),
    [selectedTransaction]
  );

  const cancellationReviewUsers = useMemo(() => {
    return Object.values(usersDataMap)
      .filter(
        (user, index, arr) =>
          user?.id && arr.findIndex((candidate) => candidate?.id === user.id) === index
      )
      .map((user) => ({
        id: user.id,
        name:
          user.displayName ||
          user.fullName ||
          user.name ||
          user.username ||
          user.email ||
          "Unknown user",
        email: user.email || user.id,
        ...getTradeRestrictionStatus(user),
      }))
      .filter((user) => user.cancelCount >= CANCELLATION_REVIEW_THRESHOLD)
      .sort((a, b) => b.cancelCount - a.cancelCount || a.name.localeCompare(b.name));
  }, [usersDataMap]);

  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const fields = [
          t.id,
          t.type,
          t.status,
          t.ownerId,
          t.requesterId,
          t.requestedPostId,
          t.postId,
          t.ownerResolvedName,
          t.requesterResolvedName,
          t.postResolvedTitle,
          t.requestedItem?.title,
          t.offeredItem?.title,
          t.requestedItem?.description,
          t.offeredItem?.description,
        ];

        return fields
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      });
    }

    list = list.filter((t) => {
      const s = normalizeStatus(t.status);
      const type = (t.type || "").toString().trim().toLowerCase();

      const statusMatch = statusFilter === "all" ? true : s === statusFilter;
      const typeMatch = typeFilter === "all" ? true : type === typeFilter;

      return statusMatch && typeMatch;
    });

    if (sortBy === "newest") {
      list.sort(
        (a, b) =>
          toMillis(b.createdAt || b.updatedAt) -
          toMillis(a.createdAt || a.updatedAt)
      );
    } else if (sortBy === "oldest") {
      list.sort(
        (a, b) =>
          toMillis(a.createdAt || a.updatedAt) -
          toMillis(b.createdAt || b.updatedAt)
      );
    } else if (sortBy === "status_asc") {
      list.sort((a, b) =>
        prettyStatus(a.status).localeCompare(prettyStatus(b.status))
      );
    } else if (sortBy === "type_asc") {
      list.sort((a, b) =>
        String(a.type || "").localeCompare(String(b.type || ""))
      );
    }

    return list;
  }, [transactions, search, statusFilter, typeFilter, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter, sortBy, rowsPerPage]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / rowsPerPage)
  );
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * rowsPerPage;
  const paginatedTransactions = filteredTransactions.slice(
    start,
    start + rowsPerPage
  );

  if (selectedTransaction) {
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
              background: "#fff",
              borderRadius: 16,
              padding: "16px 20px 14px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
              <span style={{ color: PRIMARY, fontWeight: 600 }}>ClosetLoop</span>{" "}
              Admin Dashboard
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    margin: "0 0 4px",
                    color: "#111827",
                  }}
                >
                  Transaction Details
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  Review trade request details and transaction progress.
                </p>
              </div>

              <button
                onClick={closeTransactionDetails}
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
                <FaArrowLeft size={11} /> Back to Transactions
              </button>
            </div>
          </div>

          <div
            style={{
              ...CARD_STYLE,
              padding: 24,
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
                marginBottom: 18,
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
                  onClick={closeTransactionDetails}
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
                  Transactions
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
                  Transaction #{selectedTransaction.id}
                </span>
              </div>

              <span
                style={{
                  ...getStatusStyle(selectedTransaction.status),
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {prettyStatus(selectedTransaction.status)}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 18,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  ClosetLoop Transaction Review
                </p>
                <h2
                  style={{
                    margin: "6px 0 6px",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  Transaction Details
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  Review trade request details and transaction progress.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 1fr",
                gap: 12,
                marginBottom: 18,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 120,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selectedTransaction.postResolvedImage ? (
                  <img
                    src={selectedTransaction.postResolvedImage}
                    alt="item"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <FaBoxOpen size={30} color={PRIMARY} />
                )}
              </div>

              <DetailRow
                label="Requester"
                value={
                  selectedTransaction.requesterResolvedName ||
                  "Unknown requester"
                }
              />

              <DetailRow
                label="Owner"
                value={selectedTransaction.ownerResolvedName || "Unknown owner"}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <span
                style={{
                  ...getTypeStyle(selectedTransaction.type),
                  padding: "7px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-block",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedTransaction.type || "Unknown Type"}
              </span>
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
                  border: "1px solid #f1f5f9",
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Transaction Information
                </h3>

                <div style={{ display: "grid", gap: 12 }}>
                  <DetailRow label="Transaction ID" value={selectedTransaction.id} />
                  <DetailRow
                    label="Status"
                    value={prettyStatus(selectedTransaction.status)}
                  />
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
                  <DetailRow
                    label="Updated At"
                    value={formatDateTime(selectedTransaction.updatedAt)}
                  />
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #f1f5f9",
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Trade Information
                </h3>

                <div style={{ display: "grid", gap: 12 }}>
                  {selectedTransactionItems.length ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          selectedTransactionItems.length > 1 ? "1fr 1fr" : "1fr",
                        gap: 12,
                      }}
                    >
                      {selectedTransactionItems.map((item) => (
                        <div
                          key={`${selectedTransaction.id}-detail-${item.role}`}
                          style={{
                            background: "#fafafa",
                            border: "1px solid #f1f5f9",
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "56px minmax(0, 1fr)",
                              gap: 12,
                              alignItems: "start",
                            }}
                          >
                            <div
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                overflow: "hidden",
                                background: "#f3f4f6",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt=""
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <FaBoxOpen color={PRIMARY} />
                              )}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 11,
                                  color: "#6b7280",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  fontWeight: 800,
                                }}
                              >
                                {item.label}
                              </p>
                              <p
                                style={{
                                  margin: "5px 0 0",
                                  fontSize: 14,
                                  color: "#111827",
                                  fontWeight: 800,
                                  lineHeight: 1.35,
                                  wordBreak: "break-word",
                                }}
                              >
                                {item.title}
                              </p>
                            </div>
                          </div>

                          <p
                            style={{
                              margin: "12px 0 0",
                              fontSize: 13,
                              color: "#4b5563",
                              lineHeight: 1.55,
                              wordBreak: "break-word",
                            }}
                          >
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DetailRow
                      label="Item"
                      value={selectedTransaction.postResolvedTitle || "Unnamed item"}
                    />
                  )}
                  <DetailRow
                    label="Requested Post ID"
                    value={
                      selectedTransaction.requestedPostId ||
                      selectedTransaction.postId ||
                      "—"
                    }
                  />
                  <DetailRow
                    label="Offered Post ID"
                    value={
                      selectedTransaction.offeredPostId ||
                      selectedTransaction.offerPostId ||
                      selectedTransaction.offeredItemId ||
                      selectedTransaction.tradePostId ||
                      selectedTransaction.exchangePostId ||
                      selectedTransaction.requesterPostId ||
                      "—"
                    }
                  />
                  <DetailRow
                    label="Owner ID"
                    value={selectedTransaction.ownerId || "—"}
                  />
                  <DetailRow
                    label="Requester ID"
                    value={selectedTransaction.requesterId || "—"}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                background: "#fff",
                border: "1px solid #f1f5f9",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <h3
                style={{
                  margin: "0 0 14px",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
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
                            <p
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#111827",
                              }}
                            >
                              {event.label}
                            </p>
                            <span
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                whiteSpace: "nowrap",
                              }}
                            >
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
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  No detailed history has been recorded for this transaction yet.
                </p>
              )}
            </div>

            <div
              style={{
                marginTop: 18,
                background: "#fff",
                border: "1px solid #f1f5f9",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Quick User Access
              </h3>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() =>
                    setSelectedUser(
                      usersDataMap[selectedTransaction.requesterId] || null
                    )
                  }
                  style={{
                    background: "#f9fafb",
                    color: "#374151",
                    border: "1px solid #e5e7eb",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  View Requester Profile
                </button>

                <button
                  onClick={() =>
                    setSelectedUser(
                      usersDataMap[selectedTransaction.ownerId] || null
                    )
                  }
                  style={{
                    background: "#f9fafb",
                    color: "#374151",
                    border: "1px solid #e5e7eb",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  View Owner Profile
                </button>
              </div>
            </div>
          </div>

          {selectedUser && (
            <UserProfileModal
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
            />
          )}
        </div>
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
            background: "#fff",
            borderRadius: 16,
            padding: "16px 20px 14px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
            <span style={{ color: PRIMARY, fontWeight: 600 }}>ClosetLoop</span>{" "}
            Admin Dashboard
          </p>

          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: "4px 0 4px",
              color: "#111827",
            }}
          >
            Transaction Management
          </h1>

          <p
            style={{
              fontSize: 12,
              color: "#6b7280",
              margin: 0,
            }}
          >
            Monitor trade requests, review progress, and track transaction
            statuses.
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

        <AdminStatGrid minColumnWidth={210} gap={16}>
          <AdminStatCard
            title="Total Transactions"
            value={loading ? "..." : stats.total}
            description="All recorded trade requests"
            icon={<FaExchangeAlt size={14} />}
            accentColor={ADMIN_STAT_CARD_COLORS.primary.accent}
            softBackgroundColor={ADMIN_STAT_CARD_COLORS.primary.soft}
            active
          />
          <AdminStatCard
            title="Pending"
            value={loading ? "..." : stats.pending}
            description="Waiting for confirmation"
            icon={<FaClock size={14} />}
            accentColor={ADMIN_STAT_CARD_COLORS.pending.accent}
            softBackgroundColor={ADMIN_STAT_CARD_COLORS.pending.soft}
          />
          <AdminStatCard
            title="Completed"
            value={loading ? "..." : stats.completed}
            description="Successfully completed"
            icon={<FaCheckCircle size={14} />}
            accentColor={ADMIN_STAT_CARD_COLORS.verified.accent}
            softBackgroundColor={ADMIN_STAT_CARD_COLORS.verified.soft}
          />
          <AdminStatCard
            title="Cancelled"
            value={loading ? "..." : stats.cancelled}
            description="Cancelled or rejected"
            icon={<FaTimesCircle size={14} />}
            accentColor={ADMIN_STAT_CARD_COLORS.dismissed.accent}
            softBackgroundColor={ADMIN_STAT_CARD_COLORS.dismissed.soft}
            active
          />
          <AdminStatCard
            title="Needs Review"
            value={loading ? "..." : cancellationReviewUsers.length}
            description={`Users at ${CANCELLATION_REVIEW_THRESHOLD}+ cancellations`}
            icon={<FaBoxOpen size={14} />}
            accentColor={ADMIN_STAT_CARD_COLORS.tradeLimited.accent}
            softBackgroundColor={ADMIN_STAT_CARD_COLORS.tradeLimited.soft}
            active
          />
        </AdminStatGrid>

        <div
          style={{
            ...CARD_STYLE,
            padding: "16px 18px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Transaction Records
              </h3>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                View all transaction details and trade request updates.
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  color: "#9ca3af",
                }}
              >
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(220px,1.4fr) repeat(3,minmax(140px,0.8fr))",
                gap: 10,
                width: "100%",
                maxWidth: 760,
              }}
            >
              <div style={{ position: "relative" }}>
                <FaSearch
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#de638a",
                    fontSize: 12,
                  }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, user, item..."
                  style={{
                    width: "100%",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "10px 12px 10px 30px",
                    fontSize: 13,
                    color: "#374151",
                    outline: "none",
                  }}
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#374151",
                  outline: "none",
                  background: "#fff",
                }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="status_asc">Status A-Z</option>
                <option value="type_asc">Type A-Z</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#374151",
                  outline: "none",
                  background: "#fff",
                }}
              >
                <option value="all">All Types</option>
                <option value="trade">Trade</option>
                <option value="giveaway">Giveaway</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#374151",
                  outline: "none",
                  background: "#fff",
                }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="to receive">To Receive</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                ...ADMIN_TABLE_STYLE,
                minWidth: 1200,
              }}
            >
              <thead>
                <tr style={{ background: "#f9edf5" }}>
                  <th style={{ ...tableHeadStyle, width: "14%" }}>Transaction ID</th>
                  <th style={{ ...tableHeadStyle, width: "11%" }}>Status</th>
                  <th style={{ ...tableHeadStyle, width: "10%" }}>Type</th>
                  <th style={{ ...tableHeadStyle, width: "30%" }}>Item</th>
                  <th style={{ ...tableHeadStyle, width: "14%" }}>Requester</th>
                  <th style={{ ...tableHeadStyle, width: "14%" }}>Owner</th>
                  <th style={{ ...tableHeadStyle, width: "10%" }}>Date</th>
                  <th style={{ ...tableHeadStyle, width: "11%", textAlign: "center" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={emptyRowStyle}>
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={emptyRowStyle}>
                      No transactions found for the current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx, index) => {
                    const isSelected = selectedTransaction?.id === tx.id;
                    const statusStyle = getStatusStyle(tx.status);
                    const typeStyle = getTypeStyle(tx.type);
                    const transactionItems = getTransactionItems(tx);

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => openTransactionDetails(tx.id)}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          background: isSelected
                            ? "#fff8fb"
                            : index % 2 === 0
                            ? "#fff"
                            : "#fcfcfd",
                          boxShadow: isSelected
                            ? "inset 3px 0 0 #de638a"
                            : "none",
                          cursor: "pointer",
                        }}
                      >
                        <td style={tableCellStrongStyle}>
                          <span
                            style={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              wordBreak: "break-word",
                            }}
                            title={tx.id}
                          >
                            {tx.id}
                          </span>
                        </td>

                        <td style={tableCellStyle}>
                          <span
                            style={{
                              ...statusStyle,
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              display: "inline-block",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {prettyStatus(tx.status)}
                          </span>
                        </td>

                        <td style={tableCellStyle}>
                          <span
                            style={{
                              ...typeStyle,
                              padding: "6px 12px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              display: "inline-block",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {tx.type || "ï¿½"}
                          </span>
                        </td>

                        <td style={tableCellStyle}>
                          <div
                            style={{
                              display: "grid",
                              gap: 8,
                              gridTemplateColumns:
                                transactionItems.length > 1
                                  ? "repeat(2, minmax(0, 1fr))"
                                  : "minmax(0, 1fr)",
                              alignItems: "start",
                            }}
                          >
                            {transactionItems.length ? (
                              transactionItems.map((item) => (
                                <div
                                  key={`${tx.id}-${item.role}`}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "42px minmax(0, 1fr)",
                                    gap: 10,
                                    alignItems: "center",
                                    minWidth: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 42,
                                      height: 42,
                                      borderRadius: 10,
                                      overflow: "hidden",
                                      background: "#f3f4f6",
                                      flexShrink: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt=""
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                    ) : (
                                      <FaBoxOpen color={PRIMARY} />
                                    )}
                                  </div>

                                  <div style={{ minWidth: 0 }}>
                                    <span
                                      style={{
                                        display: "block",
                                        color: "#9ca3af",
                                        fontSize: 10,
                                        fontWeight: 800,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {item.role === "offered" ? "Offered" : "Requested"}
                                    </span>
                                    <span
                                      style={{
                                        color: "#374151",
                                        fontWeight: 600,
                                        lineHeight: 1.35,
                                        display: "block",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                      title={item.title}
                                    >
                                      {item.title}
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <span
                                style={{
                                  color: "#374151",
                                  fontWeight: 600,
                                  lineHeight: 1.35,
                                }}
                              >
                                {tx.postResolvedTitle || "Unnamed item"}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={tableCellStyle}>
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={tx.requesterResolvedName}
                          >
                            <UserLink
                              label={tx.requesterResolvedName}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(
                                  usersDataMap[tx.requesterId] || null
                                );
                              }}
                            />
                          </div>
                        </td>

                        <td style={tableCellStyle}>
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={tx.ownerResolvedName}
                          >
                            <UserLink
                              label={tx.ownerResolvedName}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(usersDataMap[tx.ownerId] || null);
                              }}
                            />
                          </div>
                        </td>

                        <td style={tableCellStyle}>
                          {formatDate(tx.createdAt || tx.updatedAt)}
                        </td>

                        <td style={{ ...tableCellStyle, textAlign: "center" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openTransactionDetails(tx.id);
                            }}
                            style={{
                              background: "#f9fafb",
                              color: "#374151",
                              border: "1px solid #e5e7eb",
                              padding: "8px 12px",
                              borderRadius: 10,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 500,
                              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                              minWidth: 104,
                            }}
                          >
                            View details
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
            totalItems={filteredTransactions.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
            noun="transactions"
          />
        </div>
      </div>

      {selectedTransaction && (
        <div
          onClick={() => setSelectedTransaction(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 920,
              maxHeight: "88vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 20,
              boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
              padding: 24,
              position: "relative",
              zIndex: 100000,
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
                marginBottom: 18,
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
                  onClick={() => setSelectedTransaction(null)}
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
                  Transactions
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
                  Transaction #{selectedTransaction.id}
                </span>
              </div>

              <button
                onClick={() => setSelectedTransaction(null)}
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
                <FaArrowLeft size={11} /> Back to Transactions
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 18,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  ClosetLoop Transaction Review
                </p>
                <h2
                  style={{
                    margin: "6px 0 6px",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  Transaction Details
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  Review trade request details and transaction progress.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    ...getStatusStyle(selectedTransaction.status),
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {prettyStatus(selectedTransaction.status)}
                </span>

              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 1fr",
                gap: 12,
                marginBottom: 18,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 120,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selectedTransaction.postResolvedImage ? (
                  <img
                    src={selectedTransaction.postResolvedImage}
                    alt="item"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <FaBoxOpen size={30} color={PRIMARY} />
                )}
              </div>

              <DetailRow
                label="Requester"
                value={
                  selectedTransaction.requesterResolvedName ||
                  "Unknown requester"
                }
              />

              <DetailRow
                label="Owner"
                value={selectedTransaction.ownerResolvedName || "Unknown owner"}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <span
                style={{
                  ...getTypeStyle(selectedTransaction.type),
                  padding: "7px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-block",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedTransaction.type || "Unknown Type"}
              </span>
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
                  border: "1px solid #f1f5f9",
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Transaction Information
                </h3>

                <div style={{ display: "grid", gap: 12 }}>
                  <DetailRow
                    label="Transaction ID"
                    value={selectedTransaction.id}
                  />
                  <DetailRow
                    label="Status"
                    value={prettyStatus(selectedTransaction.status)}
                  />
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
                  <DetailRow
                    label="Updated At"
                    value={formatDateTime(selectedTransaction.updatedAt)}
                  />
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #f1f5f9",
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Trade Information
                </h3>

                <div style={{ display: "grid", gap: 12 }}>
                  {selectedTransactionItems.length ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          selectedTransactionItems.length > 1 ? "1fr 1fr" : "1fr",
                        gap: 12,
                      }}
                    >
                      {selectedTransactionItems.map((item) => (
                        <div
                          key={`${selectedTransaction.id}-detail-${item.role}`}
                          style={{
                            background: "#fafafa",
                            border: "1px solid #f1f5f9",
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "56px minmax(0, 1fr)",
                              gap: 12,
                              alignItems: "start",
                            }}
                          >
                            <div
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                overflow: "hidden",
                                background: "#f3f4f6",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt=""
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <FaBoxOpen color={PRIMARY} />
                              )}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 11,
                                  color: "#6b7280",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  fontWeight: 800,
                                }}
                              >
                                {item.label}
                              </p>
                              <p
                                style={{
                                  margin: "5px 0 0",
                                  fontSize: 14,
                                  color: "#111827",
                                  fontWeight: 800,
                                  lineHeight: 1.35,
                                  wordBreak: "break-word",
                                }}
                              >
                                {item.title}
                              </p>
                            </div>
                          </div>

                          <p
                            style={{
                              margin: "12px 0 0",
                              fontSize: 13,
                              color: "#4b5563",
                              lineHeight: 1.55,
                              wordBreak: "break-word",
                            }}
                          >
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DetailRow
                      label="Item"
                      value={selectedTransaction.postResolvedTitle || "Unnamed item"}
                    />
                  )}
                  <DetailRow
                    label="Requested Post ID"
                    value={
                      selectedTransaction.requestedPostId ||
                      selectedTransaction.postId ||
                      "â€”"
                    }
                  />
                  <DetailRow
                    label="Offered Post ID"
                    value={
                      selectedTransaction.offeredPostId ||
                      selectedTransaction.offerPostId ||
                      selectedTransaction.offeredItemId ||
                      selectedTransaction.tradePostId ||
                      selectedTransaction.exchangePostId ||
                      selectedTransaction.requesterPostId ||
                      "â€”"
                    }
                  />
                  <DetailRow
                    label="Owner ID"
                    value={selectedTransaction.ownerId || "â€”"}
                  />
                  <DetailRow
                    label="Requester ID"
                    value={selectedTransaction.requesterId || "â€”"}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                background: "#fff",
                border: "1px solid #f1f5f9",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <h3
                style={{
                  margin: "0 0 14px",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
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
                            <p
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#111827",
                              }}
                            >
                              {event.label}
                            </p>
                            <span
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                whiteSpace: "nowrap",
                              }}
                            >
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
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  No detailed history has been recorded for this transaction yet.
                </p>
              )}
            </div>

            <div
              style={{
                marginTop: 18,
                background: "#fff",
                border: "1px solid #f1f5f9",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Quick User Access
              </h3>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() =>
                    setSelectedUser(
                      usersDataMap[selectedTransaction.requesterId] || null
                    )
                  }
                  style={{
                    background: "#f9fafb",
                    color: "#374151",
                    border: "1px solid #e5e7eb",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  View Requester Profile
                </button>

                <button
                  onClick={() =>
                    setSelectedUser(
                      usersDataMap[selectedTransaction.ownerId] || null
                    )
                  }
                  style={{
                    background: "#f9fafb",
                    color: "#374151",
                    border: "1px solid #e5e7eb",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  View Owner Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

const tableHeadStyle = {
  ...ADMIN_TABLE_HEAD_CELL_STYLE,
  fontSize: 12,
  color: "#4b5563",
  fontWeight: 600,
};

const tableCellStyle = {
  ...ADMIN_TABLE_CELL_STYLE,
  fontSize: 13,
  color: "#4b5563",
  verticalAlign: "top",
};

const tableCellStrongStyle = {
  ...ADMIN_TABLE_CELL_STRONG_STYLE,
  fontSize: 13,
  color: "#374151",
  fontWeight: 500,
  verticalAlign: "top",
};

const emptyRowStyle = {
  ...ADMIN_TABLE_EMPTY_ROW_STYLE,
  fontSize: 14,
};






