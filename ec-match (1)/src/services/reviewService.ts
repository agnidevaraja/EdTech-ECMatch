import {
  doc,
  runTransaction,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Review,
  ReviewMetrics,
  ExtracurricularRatingAggregates,
  REVIEW_METRICS,
  RatingBreakdown,
} from '../types';

const EC_COLLECTION = 'extracurriculars';
const REVIEWS_SUBCOLLECTION = 'reviews';

export function ecRef(ecId: string) {
  return doc(db, EC_COLLECTION, ecId);
}

export function reviewRef(ecId: string, userId: string) {
  return doc(db, EC_COLLECTION, ecId, REVIEWS_SUBCOLLECTION, userId);
}

export interface ReviewInput {
  rating: number; // 1-5
  metrics: ReviewMetrics;
  title: string;
  body: string;
  yearParticipated: string;
}

function nowIso() {
  return new Date().toISOString();
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/**
 * Recompute aggregated rating fields incrementally.
 *
 * `current` = existing aggregates on the parent ec doc (or null if none).
 * `oldReview` = the review being replaced/removed (null on create).
 * `newReview` = the review being added/updated (null on delete).
 *
 * All math uses only the stored averages + counts, so it can run inside a
 * Firestore transaction using only document reads/writes (transactions cannot
 * run queries).
 */
export function computeAggregates(
  current: Partial<ExtracurricularRatingAggregates> | null,
  oldReview: Review | null,
  newReview: Review | null
): ExtracurricularRatingAggregates {
  const breakdown: RatingBreakdown = {
    ...(current?.ratingBreakdown ?? { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }),
  };
  let count = current?.reviewCount ?? 0;

  const baseAvg = (m: (typeof REVIEW_METRICS)[number]) => {
    const key = `avg${capitalize(m)}` as keyof ExtracurricularRatingAggregates;
    return (current?.[key] as number | undefined) ?? 0;
  };

  // Remove the old review (update or delete).
  if (oldReview) {
    breakdown[String(oldReview.rating) as keyof RatingBreakdown] -= 1;
    count -= 1;
  }

  // Add the new review (create or update).
  if (newReview) {
    breakdown[String(newReview.rating) as keyof RatingBreakdown] += 1;
    count += 1;
  }

  for (const star of Object.keys(breakdown) as (keyof RatingBreakdown)[]) {
    if (breakdown[star] < 0) breakdown[star] = 0;
  }
  if (count < 0) count = 0;

  const overallRating =
    count > 0
      ? Math.round(
          ((1 * breakdown['1'] +
            2 * breakdown['2'] +
            3 * breakdown['3'] +
            4 * breakdown['4'] +
            5 * breakdown['5']) /
            count) *
            10
        ) / 10
      : 0;

  const averages: Record<string, number> = {};
  for (const m of REVIEW_METRICS) {
    const key = `avg${capitalize(m)}`;
    const oldCount = count + (oldReview ? 1 : 0) - (newReview ? 1 : 0);
    let sum = baseAvg(m) * oldCount;
    if (oldReview) sum -= oldReview.metrics[m];
    if (newReview) sum += newReview.metrics[m];
    averages[key] = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
  }

  return {
    overallRating,
    reviewCount: count,
    ratingBreakdown: breakdown,
    avgOverallExperience: averages.avgOverallExperience ?? 0,
    avgCompetitivenessPrestige: averages.avgCompetitivenessPrestige ?? 0,
    avgTimeCommitment: averages.avgTimeCommitment ?? 0,
    avgMentorshipSupport: averages.avgMentorshipSupport ?? 0,
    avgCollegeAppImpact: averages.avgCollegeAppImpact ?? 0,
  };
}

/**
 * Create or update the current user's review for an extracurricular inside a
 * Firestore transaction, then recompute the parent's aggregated ratings.
 * Each authenticated user can have exactly one review (doc id == userId).
 */
export async function submitReview(
  ecId: string,
  user: { uid: string; displayName?: string | null; email?: string | null },
  input: ReviewInput
): Promise<void> {
  if (!user.uid) throw new Error('Authenticated user required.');

  const parentRef = ecRef(ecId);
  const reviewDocRef = reviewRef(ecId, user.uid);

  await runTransaction(db, async (tx) => {
    const parentSnap = await tx.get(parentRef);
    const current: Partial<ExtracurricularRatingAggregates> | null = parentSnap.exists()
      ? (parentSnap.data() as Partial<ExtracurricularRatingAggregates>)
      : null;

    const oldSnap = await tx.get(reviewDocRef);
    const oldReview: Review | null = oldSnap.exists() ? (oldSnap.data() as Review) : null;

    const now = nowIso();
    const newReview: Review = {
      id: user.uid,
      userId: user.uid,
      userName: user.displayName || user.email || 'Student',
      userEmail: user.email ?? undefined,
      rating: Math.min(5, Math.max(1, Math.round(input.rating))),
      metrics: input.metrics,
      title: input.title.trim(),
      body: input.body.trim(),
      yearParticipated: input.yearParticipated.trim(),
      createdAt: oldReview?.createdAt ?? now,
      updatedAt: now,
    };

    const aggregates = computeAggregates(current, oldReview, newReview);

    tx.set(reviewDocRef, newReview);
    tx.update(parentRef, { ...aggregates, updatedAt: now });
  });
}

/**
 * Delete the current user's review for an extracurricular inside a transaction
 * and recompute the parent's aggregated ratings.
 */
export async function deleteReview(ecId: string, userId: string): Promise<void> {
  if (!userId) throw new Error('Authenticated user required.');

  const parentRef = ecRef(ecId);
  const reviewDocRef = reviewRef(ecId, userId);

  await runTransaction(db, async (tx) => {
    const parentSnap = await tx.get(parentRef);
    const current: Partial<ExtracurricularRatingAggregates> | null = parentSnap.exists()
      ? (parentSnap.data() as Partial<ExtracurricularRatingAggregates>)
      : null;

    const oldSnap = await tx.get(reviewDocRef);
    const oldReview: Review | null = oldSnap.exists() ? (oldSnap.data() as Review) : null;
    if (!oldReview) throw new Error('No review to delete.');

    const now = nowIso();
    const aggregates = computeAggregates(current, oldReview, null);

    tx.delete(reviewDocRef);
    tx.update(parentRef, { ...aggregates, updatedAt: now });
  });
}

/** Fetch all reviews for an extracurricular (public read). */
export async function getReviews(ecId: string): Promise<Review[]> {
  const q = query(
    collection(db, EC_COLLECTION, ecId, REVIEWS_SUBCOLLECTION),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Review) }) as Review);
}

/** Subscribe to real-time reviews for an extracurricular. */
export function subscribeReviews(ecId: string, callback: (reviews: Review[]) => void) {
  const q = query(
    collection(db, EC_COLLECTION, ecId, REVIEWS_SUBCOLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Review) }) as Review));
  });
}

/** Get the current user's existing review for an extracurricular, if any. */
export async function getMyReview(ecId: string, userId: string): Promise<Review | null> {
  const snap = await getDocs(
    query(collection(db, EC_COLLECTION, ecId, REVIEWS_SUBCOLLECTION), where('userId', '==', userId))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Review) } as Review;
}

