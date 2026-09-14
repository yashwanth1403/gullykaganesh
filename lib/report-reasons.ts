/** What a viewer can say is wrong with a pandal. Keys are stored in reports.reason. */
export const REPORT_REASONS = {
  wrong_place: "Pin is in the wrong place",
  wrong_details: "Details are wrong",
  wrong_height: "Height looks wrong",
  not_pandal: "Not a Ganesh mandapam",
  duplicate: "Already on the map",
  inappropriate: "Photo shouldn't be here",
  false_claim: "Someone else claimed this mandapam",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** The subset that makes sense for one photo rather than the whole pandal. */
export const PHOTO_REPORT_REASONS = {
  inappropriate: REPORT_REASONS.inappropriate,
  not_pandal: REPORT_REASONS.not_pandal,
} as const;
export type PhotoReportReason = keyof typeof PHOTO_REPORT_REASONS;
