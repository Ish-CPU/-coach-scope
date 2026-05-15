import { redirect } from "next/navigation";

// Convenience alias — routes /admin/reviews/flagged → /admin/reviews?tab=flagged
// so an external link / bookmark always works.
export default function FlaggedReviewsAlias() {
  redirect("/admin/reviews?tab=flagged");
}
