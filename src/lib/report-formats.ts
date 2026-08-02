export const REPORT_FORMATS = ["txt", "docx", "csv", "xlsx", "pptx", "pdf"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];
