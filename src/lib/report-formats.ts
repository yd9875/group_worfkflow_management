export const REPORT_FORMATS = ["txt", "docx", "csv", "xlsx", "pptx"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];
