
export interface AcademicBaseline {
  gpa?: string;
  gradingScale?: string;
  rigorousCourses?: string[];
  subjectInterests?: string[];
}

export interface ActivePortfolio {
  pastECs?: string[];
  competitions?: string[];
  experiences?: string[];
  careerGoals?: string;
}

export interface HolisticIdentity {
  background?: string;
  intellectualDiet?: {
    books?: string[];
    movies?: string[];
    podcasts?: string[];
  };
  personalOutlets?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  age?: string;
  gender?: string;
  academicBaseline?: AcademicBaseline;
  activePortfolio?: ActivePortfolio;
  holisticIdentity?: HolisticIdentity;
  onboardingCompleted: boolean;
  createdAt: string;
  themeColor?: string;
}

export interface Opportunity {
  id: string;
  title: string;
  rationale: string;
  isVerified: boolean;
  format: 'Online' | 'In-person' | 'Hybrid';
  cost: string;
  effortLevel: 'Low' | 'Medium' | 'High';
  deadline: string;
  materials: string[];
  url: string;
  description?: string;
  prestigeRating: number; // 1-5
  subject: string;
  topic: string;
  type: string; // Competition, Workshop, Project based, etc.
  ageGroup: string;
  location?: string;
}

export type PipelineStatus = 'Saved' | 'In Progress' | 'Applied' | 'Completed';
export type UserRanking = 'Best' | 'Medium' | 'Low';

export interface UserOpportunity extends Opportunity {
  status: PipelineStatus;
  ranking: UserRanking;
  savedAt: string;
  hoursLogged: number;
  impactSummary: string;
}

/* ------------------------------------------------------------------ */
/*  Reviews & Ratings (Amazon-style)                                  */
/* ------------------------------------------------------------------ */

export type ReviewMetric =
  | 'overallExperience'
  | 'competitivenessPrestige'
  | 'timeCommitment'
  | 'mentorshipSupport'
  | 'collegeAppImpact';

export const REVIEW_METRICS: ReviewMetric[] = [
  'overallExperience',
  'competitivenessPrestige',
  'timeCommitment',
  'mentorshipSupport',
  'collegeAppImpact',
];

export const REVIEW_METRIC_LABELS: Record<ReviewMetric, string> = {
  overallExperience: 'Overall Experience',
  competitivenessPrestige: 'Competitiveness / Prestige',
  timeCommitment: 'Time Commitment',
  mentorshipSupport: 'Mentorship & Support',
  collegeAppImpact: 'College App Impact',
};

export interface ReviewMetrics {
  overallExperience: number; // 1-5
  competitivenessPrestige: number; // 1-5
  timeCommitment: number; // 1-5
  mentorshipSupport: number; // 1-5
  collegeAppImpact: number; // 1-5
}

export interface Review {
  id?: string; // Firestore doc id (= userId)
  userId: string;
  userName: string;
  userEmail?: string;
  rating: number; // 1-5 overall star rating
  metrics: ReviewMetrics;
  title: string;
  body: string;
  yearParticipated: string;
  createdAt: string;
  updatedAt: string;
}

export interface RatingBreakdown {
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '5': number;
}

export interface ExtracurricularRatingAggregates {
  overallRating: number; // average of overall rating (1-5), rounded to 1 decimal
  reviewCount: number;
  ratingBreakdown: RatingBreakdown; // histogram of overall ratings
  avgOverallExperience: number;
  avgCompetitivenessPrestige: number;
  avgTimeCommitment: number;
  avgMentorshipSupport: number;
  avgCollegeAppImpact: number;
}

export interface Opportunity {
  id: string;
  title: string;
  rationale: string;
  isVerified: boolean;
  format: 'Online' | 'In-person' | 'Hybrid';
  cost: string;
  effortLevel: 'Low' | 'Medium' | 'High';
  deadline: string;
  materials: string[];
  url: string;
  description?: string;
  prestigeRating: number; // 1-5
  subject: string;
  topic: string;
  type: string; // Competition, Workshop, Project based, etc.
  ageGroup: string;
  location?: string;
  source?: string;
  scrapedAt?: string;
  /* Aggregated rating fields maintained by the review system. */
  overallRating?: number;
  reviewCount?: number;
  ratingBreakdown?: RatingBreakdown;
  avgOverallExperience?: number;
  avgCompetitivenessPrestige?: number;
  avgTimeCommitment?: number;
  avgMentorshipSupport?: number;
  avgCollegeAppImpact?: number;
}
