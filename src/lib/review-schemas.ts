import { z } from "zod";
import { ReviewType } from "@prisma/client";

const score = z.number().min(1).max(5);

// COACH + PROGRAM share the athlete-side ratings.
// Final athlete rating categories per spec:
//   recruiting honesty, communication, player treatment, development,
//   trustworthiness, team culture, NIL opportunity,
//   FOOD RATING, FACILITY RATING, overall rating.
const coachOrProgramRatings = z.object({
  recruitingHonesty: score,
  communication: score,
  playerTreatment: score,
  development: score,
  trustworthiness: score,
  teamCulture: score,
  nilOpportunity: score,
  foodRating: score,
  facilityRating: score,
  overallRating: score,
});

const universityOrDormRatings = z.object({
  dormQuality: score,
  campusSafety: score,
  socialLife: score,
  foodQuality: score,
  facilities: score,
  academicSupport: score,
  overallExperience: score,
});

const parentInsightRatings = z.object({
  coachCommunication: score,
  recruitingHonesty: score,
  programEnvironment: score,
  athleteSupport: score,
  overallRating: score,
});

export const RATING_FIELDS = {
  COACH: Object.keys(coachOrProgramRatings.shape) as (keyof typeof coachOrProgramRatings.shape)[],
  PROGRAM: Object.keys(coachOrProgramRatings.shape) as (keyof typeof coachOrProgramRatings.shape)[],
  UNIVERSITY: Object.keys(universityOrDormRatings.shape) as (keyof typeof universityOrDormRatings.shape)[],
  DORM: Object.keys(universityOrDormRatings.shape) as (keyof typeof universityOrDormRatings.shape)[],
  PARENT_INSIGHT: Object.keys(parentInsightRatings.shape) as (keyof typeof parentInsightRatings.shape)[],
} as const;

export const RATING_LABELS: Record<string, string> = {
  recruitingHonesty: "Recruiting Honesty",
  communication: "Communication",
  playerTreatment: "Player Treatment",
  development: "Development",
  trustworthiness: "Trustworthiness",
  teamCulture: "Team Culture",
  nilOpportunity: "NIL Opportunity",
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
};

// Hover-help / sublabel content for the new athlete categories.
export const RATING_DESCRIPTIONS: Record<string, string> = {
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
    ratings: z.record(z.string(), z.number().min(1).max(5)),
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
    }
  });

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
