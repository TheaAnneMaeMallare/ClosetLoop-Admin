import { collection, collectionGroup, getDocs } from "firebase/firestore";

const RATING_COLLECTIONS = ["ratings", "reviews", "userRatings", "userReviews"];

const RATING_FIELDS = [
  "rating",
  "rate",
  "stars",
  "score",
  "value",
  "overall",
  "averageRating",
  "ratingAverage",
  "ratingsAverage",
  "avgRating",
  "userRating",
  "rating.average",
  "ratings.average",
  "review.average",
  "reviews.average",
  "ratingStats.average",
  "ratingSummary.average",
  "ratingsSummary.average",
];

const RATING_COUNT_FIELDS = [
  "ratingCount",
  "ratingsCount",
  "reviewCount",
  "reviewsCount",
  "totalRatings",
  "totalReviews",
  "numberOfRatings",
  "rating.count",
  "ratings.count",
  "review.count",
  "reviews.count",
  "ratingStats.count",
  "ratingSummary.count",
  "ratingsSummary.count",
];

const RATING_SUM_FIELDS = [
  "ratingSum",
  "ratingsSum",
  "totalRating",
  "totalRatingsScore",
  "ratingTotal",
  "rating.sum",
  "ratings.sum",
  "review.sum",
  "reviews.sum",
  "ratingStats.sum",
  "ratingSummary.sum",
  "ratingsSummary.sum",
];

const RATING_TIMESTAMP_FIELDS = [
  "createdAt",
  "updatedAt",
  "timestamp",
  "reviewedAt",
  "reviewedOn",
  "submittedAt",
  "submittedOn",
  "ratedAt",
  "ratedOn",
  "date",
  "review.date",
  "rating.date",
  "metadata.createdAt",
];

const RATED_USER_FIELDS = [
  "ratedUserId",
  "ratedUid",
  "ratedUserUid",
  "targetUserId",
  "targetUid",
  "toUserId",
  "toUid",
  "receiverId",
  "receiverUid",
  "reviewedUserId",
  "reviewedUid",
  "sellerId",
  "sellerUid",
  "ownerId",
  "ownerUid",
  "ratedUser.id",
  "ratedUser.uid",
  "targetUser.id",
  "targetUser.uid",
  "reviewedUser.id",
  "reviewedUser.uid",
  "toUser.id",
  "toUser.uid",
];

const FALLBACK_RATED_USER_FIELDS = [
  "userId",
  "uid",
];

const TRADE_RATING_TARGETS = [
  {
    idFields: ["ownerUid", "ownerId", "sellerUid", "sellerId"],
    ratingFields: [
      "ownerRating",
      "ownerStars",
      "sellerRating",
      "sellerStars",
      "ratingForOwner",
      "ratingForSeller",
      "ownerReview.rating",
      "sellerReview.rating",
    ],
  },
  {
    idFields: ["requesterUid", "requesterId", "buyerUid", "buyerId"],
    ratingFields: [
      "requesterRating",
      "requesterStars",
      "buyerRating",
      "buyerStars",
      "ratingForRequester",
      "ratingForBuyer",
      "requesterReview.rating",
      "buyerReview.rating",
    ],
  },
  {
    idFields: ["receiverUid", "receiverId", "toUid", "toUserId"],
    ratingFields: [
      "receiverRating",
      "receiverStars",
      "toUserRating",
      "ratingForReceiver",
      "receiverReview.rating",
    ],
  },
  {
    idFields: ["senderUid", "senderId", "fromUid", "fromUserId"],
    ratingFields: [
      "senderRating",
      "senderStars",
      "fromUserRating",
      "ratingForSender",
      "senderReview.rating",
    ],
  },
];

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getByPath(data, path) {
  return path.split(".").reduce((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return current[key];
  }, data);
}

function getFirstNumber(data, fields) {
  for (const field of fields) {
    const value = toFiniteNumber(getByPath(data, field));
    if (value !== null) return value;
  }
  return null;
}

function getFirstValue(data, fields) {
  for (const field of fields) {
    const value = getByPath(data, field);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function clampRating(value) {
  if (value === null) return null;
  return Math.max(0, Math.min(5, value));
}

function toMillis(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isNaN(millis) ? null : millis;
  }

  if (typeof value?.toMillis === "function") {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }

  if (typeof value?.toDate === "function") {
    const millis = value.toDate().getTime();
    return Number.isNaN(millis) ? null : millis;
  }

  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function getFirstTimestamp(data, fields) {
  for (const field of fields) {
    const value = getByPath(data, field);
    const timestamp = toMillis(value);
    if (timestamp !== null) return timestamp;
  }
  return null;
}

function getUserRatingSummary(user = {}) {
  const count = getFirstNumber(user, RATING_COUNT_FIELDS);
  const sum = getFirstNumber(user, RATING_SUM_FIELDS);

  if (sum !== null && count && count > 0) {
    return {
      average: clampRating(sum / count),
      count,
      source: "user",
    };
  }

  const average = getFirstNumber(user, RATING_FIELDS);
  return {
    average: clampRating(average),
    count: count || 0,
    source: "user",
  };
}

function getRatingValue(data = {}) {
  return clampRating(getFirstNumber(data, RATING_FIELDS));
}

function getRatedUserIds(data = {}) {
  const parentUserId =
    data.parentCollectionName === "users" ? data.parentDocId : null;

  if (parentUserId) return [String(parentUserId)];

  const explicitIds = RATED_USER_FIELDS.map((field) => getByPath(data, field))
    .filter(Boolean)
    .map((value) => String(value));

  if (explicitIds.length) return explicitIds;

  return FALLBACK_RATED_USER_FIELDS.map((field) => getByPath(data, field))
    .filter(Boolean)
    .map((value) => String(value));
}

export function formatRatingValue(average) {
  const value = toFiniteNumber(average);
  return value === null ? "No ratings" : value.toFixed(1);
}

export async function fetchRatingDocuments(db) {
  const rows = [];
  const seen = new Set();

  const pushDoc = (d, collectionName) => {
    const key = d.ref.path;
    if (seen.has(key)) return;
    seen.add(key);

    rows.push({
      id: d.id,
      path: d.ref.path,
      collectionName,
      parentDocId: d.ref.parent.parent?.id || null,
      parentCollectionName: d.ref.parent.parent?.parent?.id || null,
      ...d.data(),
    });
  };

  for (const collectionName of RATING_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, collectionName));
      snap.docs.forEach((d) => pushDoc(d, collectionName));
    } catch (err) {
      console.warn(`Unable to load ${collectionName} ratings collection`, err);
    }

    try {
      const snap = await getDocs(collectionGroup(db, collectionName));
      snap.docs.forEach((d) => pushDoc(d, collectionName));
    } catch (err) {
      console.warn(`Unable to load ${collectionName} rating group`, err);
    }
  }

  return rows;
}

export function buildRatingSummaries(users = [], ratingRows = [], options = {}) {
  const { fromMillis = null, toMillis = null, includeUserFallback = true } = options;
  const usersByAnyId = new Map();
  const summaries = new Map();
  const aggregates = new Map();

  users.forEach((user) => {
    const ids = [user.id, user.uid].filter(Boolean).map((value) => String(value));
    const baseSummary = getUserRatingSummary(user);
    const primaryId = ids[0];

    ids.forEach((userId) => {
      usersByAnyId.set(userId, primaryId);
      if (includeUserFallback) {
        summaries.set(userId, baseSummary);
      }
    });
  });

  ratingRows.forEach((row) => {
    const ratingTimestamp = getFirstTimestamp(row, RATING_TIMESTAMP_FIELDS);
    const hasTimeFilter = fromMillis !== null || toMillis !== null;

    if (hasTimeFilter && ratingTimestamp === null) return;
    if (fromMillis !== null && ratingTimestamp < fromMillis) return;
    if (toMillis !== null && ratingTimestamp > toMillis) return;

    const rating = getRatingValue(row);
    if (rating === null) return;

    getRatedUserIds(row).forEach((rawUserId) => {
      const userId = usersByAnyId.get(rawUserId) || rawUserId;
      const current = aggregates.get(userId) || { sum: 0, count: 0 };
      aggregates.set(userId, {
        sum: current.sum + rating,
        count: current.count + 1,
      });
    });
  });

  aggregates.forEach((aggregate, userId) => {
    const summary = {
      average: clampRating(aggregate.sum / aggregate.count),
      count: aggregate.count,
      source: "ratings",
    };

    summaries.set(userId, summary);
  });

  if (includeUserFallback) {
    users.forEach((user) => {
      const primarySummary =
        summaries.get(String(user.id)) || summaries.get(String(user.uid));

      [user.id, user.uid].filter(Boolean).forEach((userId) => {
        summaries.set(String(userId), primarySummary || getUserRatingSummary(user));
      });
    });
  }

  return summaries;
}

export function getRatingSummaryForUser(user, ratingRows = []) {
  const summaries = buildRatingSummaries([user], ratingRows);
  return (
    summaries.get(String(user?.id || "")) ||
    summaries.get(String(user?.uid || "")) ||
    getUserRatingSummary(user)
  );
}

export function extractTradeRatingRows(trades = []) {
  const rows = [];

  trades.forEach((trade) => {
    const tradeTimestamp =
      getFirstTimestamp(trade, [
        "ratingCreatedAt",
        "reviewedAt",
        "completedAt",
        "updatedAt",
        "createdAt",
        "date",
      ]) || null;

    TRADE_RATING_TARGETS.forEach((target) => {
      const targetUserId = getFirstValue(trade, target.idFields);
      const rating = getFirstNumber(trade, target.ratingFields);

      if (!targetUserId || rating === null) return;

      rows.push({
        id: `${trade.id || "trade"}-${targetUserId}-${rows.length}`,
        collectionName: "tradeRequests",
        ratedUserId: targetUserId,
        rating,
        createdAt: tradeTimestamp,
      });
    });

    if (trade.ratings && typeof trade.ratings === "object") {
      Object.entries(trade.ratings).forEach(([userId, value]) => {
        const rating =
          typeof value === "object" ? getRatingValue(value) : clampRating(toFiniteNumber(value));
        const ratingTimestamp =
          (typeof value === "object" &&
            getFirstTimestamp(value, [
              "createdAt",
              "updatedAt",
              "reviewedAt",
              "submittedAt",
              "date",
            ])) ||
          tradeTimestamp;

        if (!userId || rating === null) return;

        rows.push({
          id: `${trade.id || "trade"}-${userId}-${rows.length}`,
          collectionName: "tradeRequests",
          ratedUserId: userId,
          rating,
          createdAt: ratingTimestamp,
        });
      });
    }
  });

  return rows;
}
