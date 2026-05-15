import { z } from "zod";
import { ReviewType } from "@prisma/client";

// ---------------------------------------------------------------------------
// N/A semantics
// ---------------------------------------------------------------------------
//
// A category can be:
//   - 1..5      → counted normally toward weighted averages
//   - null      → "Not applicable" (e.g. JUCO with no NIL program). Stored as
//                 null in the ratings JSON; explicitly EXCLUDED from
//                 averages by src/lib/review-weighting.ts.
//   - missing   → legacy reviews that pre-date the N/A flag. Treated the
//                 same as null on read.
//
// Headline categories (`overallRating` / `overallExperience`) are NEVER
// nullable — every review must produce a meaningful overall score so the
// `Review.overall` column has something to drive sorting + grading. The
// `nullable()` chain below is applied to every other category.

const score = z.number().min(1).max(5);
const scoreOrNA = z.union([score, z.null()]);

// COACH + PROGRAM share the athlete-side ratings.
// Final athlete rating categories per spec:
//   recruiting honesty, communication, player treatment, development,
//   trustworthiness, team culture, NIL opportunity,
//   FOOD RATING, FACILITY RATING, overall rating.
const coachOrProgramRatings = z.object({
  recruitingHonesty: scoreOrNA,
  communication: scoreOrNA,
  playerTreatment: scoreOrNA,
  development: scoreOrNA,
  trustworthiness: scoreOrNA,
  teamCulture: scoreOrNA,
  nilOpportunity: scoreOrNA,
  playingTimeTransparency: scoreOrNA,
  foodRating: scoreOrNA,
  facilityRating: scoreOrNA,
  // Headline — must be a real number so Review.overall is meaningful.
  overallRating: score,
});

const universityOrDormRatings = z.object({
  dormQuality: scoreOrNA,
  campusSafety: scoreOrNA,
  socialLife: scoreOrNA,
  foodQuality: scoreOrNA,
  facilities: scoreOrNA,
  academicSupport: scoreOrNA,
  overallExperience: score,
});

const parentInsightRatings = z.object({
  coachCommunication: scoreOrNA,
  recruitingHonesty: scoreOrNA,
  programEnvironment: scoreOrNA,
  athleteSupport: scoreOrNA,
  overallRating: score,
});

// Recruiting reviews rate the *recruiting process / program*, not an
// individual coach. The form may name a specific recruiter in the body, but
// the structured ratings live here so admins can compare programs apples to
// apples.
const recruitingRatings = z.object({
  recruitingHonesty: scoreOrNA,
  communication: scoreOrNA,
  offerClarity: scoreOrNA,
  followThrough: scoreOrNA,
  programInterestLevel: scoreOrNA,
  overallRating: score,
});

// Admissions / campus-visit reviews rate the *admissions process and visit
// experience*, not professors or programs. Student-side parallel of the
// recruiting ratings.
const admissionsRatings = z.object({
  admissionsCommunication: scoreOrNA,
  transparencyOfProcess: scoreOrNA,
  financialAidClarity: scoreOrNA,
  campusVisitExperience: scoreOrNA,
  decisionTimeline: scoreOrNA,
  overallExperience: score,
});

export const RATING_FIELDS = {
  COACH: Object.keys(coachOrProgramRatings.shape) as (keyof typeof coachOrProgramRatings.shape)[],
  PROGRAM: Object.keys(coachOrProgramRatings.shape) as (keyof typeof coachOrProgramRatings.shape)[],
  UNIVERSITY: Object.keys(universityOrDormRatings.shape) as (keyof typeof universityOrDormRatings.shape)[],
  DORM: Object.keys(universityOrDormRatings.shape) as (keyof typeof universityOrDormRatings.shape)[],
  PARENT_INSIGHT: Object.keys(parentInsightRatings.shape) as (keyof typeof parentInsightRatings.shape)[],
  RECRUITING: Object.keys(recruitingRatings.shape) as (keyof typeof recruitingRatings.shape)[],
  ADMISSIONS: Object.keys(admissionsRatings.shape) as (keyof typeof admissionsRatings.shape)[],
} as const;

// Headline categories per review type — these MUST receive a number, never N/A.
// The form uses this to disable the N/A toggle on the corresponding row.
export const REQUIRED_RATING_FIELDS: Record<ReviewType, string> = {
  COACH: "overallRating",
  PROGRAM: "overallRating",
  UNIVERSITY: "overallExperience",
  DORM: "overallExperience",
  PARENT_INSIGHT: "overallRating",
  RECRUITING: "overallRating",
  ADMISSIONS: "overallExperience",
};

/** True when the category accepts N/A for the given review type. */
export function categoryAllowsNA(reviewType: ReviewType, category: string): boolean {
  return REQUIRED_RATING_FIELDS[reviewType] !== category;
}

export const RATING_LABELS: Record<string, string> = {
  recruitingHonesty: "Recruiting Honesty",
  communication: "Communication",
  playerTreatment: "Player Treatment",
  development: "Development",
  trustworthiness: "Trustworthiness",
  teamCulture: "Team Culture",
  nilOpportunity: "NIL Opportunity",
  playingTimeTransparency: "Playing Time Transparency",
  foodRating: "Food Rating",
  facilityRating: "Facility Rating",
  overallRating: "Overall",
  dormQuality: "Dorm Quality",
  campusSafety: "Campus Safety",
  socialLife: "Social Life",
  foodQuality: "Food Quality",
  facilities: "Facilities",
  academicSupport: "Academic Support",
  overallExperience: "Overall",
  coachCommunication: "Coach Communication",
  programEnvironment: "Program Environment",
  athleteSupport: "Athlete Support",
  offerClarity: "Offer Clarity",
  followThrough: "Follow-Through",
  programInterestLevel: "Program Interest Level",
  admissionsCommunication: "Admissions Communication",
  transparencyOfProcess: "Process Transparency",
  financialAidClarity: "Financial Aid Clarity",
  campusVisitExperience: "Campus Visit Experience",
  decisionTimeline: "Decision Timeline",
};

// Hover-help / sublabel content for the new athlete categories.
export const RATING_DESCRIPTIONS: Record<string, string> = {
  playingTimeTransparency:
    "How clearly the coach/program communicates roles, depth chart movement, opportunities, and playing time expectations.",
  offerClarity:
    "How clear and consistent the program was about scholarship offers, opportunity, expectations, and timing.",
  followThrough:
    "Whether commitments made during recruiting (visits, contact cadence, evaluation feedback) were honored.",
  programInterestLevel:
    "How genuinely interested the program seemed in you specifically vs. mass recruiting outreach.",
  admissionsCommunication:
    "How responsive and clear the admissions office was throughout your application or visit.",
  transparencyOfProcess:
    "How clear the admissions office was about requirements, deadlines, and how decisions were made.",
  financialAidClarity:
    "How clearly aid, scholarships, and total cost were explained — including changes after acceptance.",
  campusVisitExperience:
    "How welcoming, organized, and informative the campus visit / tour / preview day felt.",
  decisionTimeline:
    "How predictable and reasonable the timeline from application to decision was.",
  foodRating:
    "Quality of athlete meals, training table, meal-plan support, nutrition support, and overall food access for athletes.",
  facilityRating:
    "Weight room, practice facility, locker room, recovery resources, training/medical support, and overall athletic facility quality.",
};

export const reviewSubmissionSchema = z
  .object({
    reviewType: z.nativeEnum(ReviewType),
    title: z.string().max(140).optional(),
    body: z.string().min(20).max(5000),
    coachId: z.string().cuid().optional(),
    schoolId: z.string().cuid().optional(),
    universityId: z.string().cuid().optional(),
    dormId: z.string().cuid().optional(),
    // Per-category value: 1..5 OR null (= N/A). Validation per review type
    // happens in the superRefine block below using the shape-specific
    // schemas above, which know which categories may be N/A and which
    // (the overalls) require a number.
    ratings: z.record(z.string(), z.union([z.number().min(1).max(5), z.null()])),
    // Per-review anonymity opt-in. Defaults to true so the safer choice
    // wins if the client omits the field.
    isAnonymous: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    switch (data.reviewType) {
      case ReviewType.COACH:
        if (!data.coachId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "coachId required" });
        if (!coachOrProgramRatings.safeParse(data.ratings).success)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid coach ratings" });
        break;
      case ReviewType.PROGRAM:
        if (!data.schoolId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "schoolId required" });
        if (!coachOrProgramRatings.safeParse(data.ratings).success)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid program ratings" });
        break;
      case ReviewType.UNIVERSITY:
        if (!data.universityId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "universityId required" });
        if (!universityOrDormRatings.safeParse(data.ratings).success)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid university ratings" });
        break;
      case ReviewType.DORM:
        if (!data.dormId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dormId required" });
        if (!universityOrDormRatings.safeParse(data.ratings).success)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid dorm ratings" });
        break;
      case ReviewType.PARENT_INSIGHT:
        if (!data.coachId && !data.schoolId)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Parent insight needs coachId or schoolId" });
        if (!parentInsightRatings.safeParse(data.ratings).success)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid parent ratings" });
        break;
      case ReviewType.RECRUITING:
        if (!data.schoolId)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "schoolId required for recruiting review" });
        if (!recruitingRatings.safeParse(data.ratings).success)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid recruiting ratings" });
        break;
      case ReviewType.ADMISSIONS:
        if (!data.universityId)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "universityId required for admissions review" });
        if (!admissionsRatings.safeParse(data.ratings).success)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid admissions ratings" });
        break;
    }
  });

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
