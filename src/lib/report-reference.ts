import ExcelJS from "exceljs";
import mammoth from "mammoth";

export type ReportReferenceFile = {
  fileName: string;
  mimeType: string;
  size: number;
  data: Uint8Array;
};

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export function isReferenceImage(file: ReportReferenceFile) {
  return file.mimeType.startsWith("image/");
}

export function isNativeVisualReference(file: ReportReferenceFile) {
  return file.mimeType === "application/pdf" || isReferenceImage(file);
}

async function extractDocx(file: ReportReferenceFile) {
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(file.data) });
  return [
    "[Word 문서 구조를 보존한 HTML]",
    result.value,
    result.messages.length
      ? `[변환 참고: ${result.messages.map((message) => message.message).join(" / ")}]`
      : "",
  ].filter(Boolean).join("\n");
}

async function extractXlsx(file: ReportReferenceFile) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(file.data).buffer);
  const sheets: string[] = [];
  workbook.eachSheet((worksheet) => {
    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      for (let column = 1; column <= Math.max(worksheet.columnCount, row.cellCount); column += 1) {
        cells.push(row.getCell(column).text.replace(/\r?\n/g, " "));
      }
      rows.push(cells.join("\t").trimEnd());
    });
    sheets.push(`[시트: ${worksheet.name}]\n${rows.join("\n")}`);
  });
  return `[Excel 통합 문서의 시트/행/열 구조]\n${sheets.join("\n\n")}`;
}

async function extractOne(file: ReportReferenceFile) {
  if (TEXT_MIME_TYPES.has(file.mimeType)) return Buffer.from(file.data).toString("utf8");
  if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractDocx(file);
  }
  if (file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return extractXlsx(file);
  }
  return "";
}

export async function extractReportReferenceText(files: ReportReferenceFile[], limit = 200_000) {
  let remaining = limit;
  const chunks: string[] = [];
  for (const file of files) {
    if (remaining <= 0) break;
    const extracted = await extractOne(file);
    if (!extracted) continue;
    const included = extracted.slice(0, remaining);
    chunks.push(`[${file.fileName}]\n${included}${included.length < extracted.length ? "\n[파일 내용 일부 생략]" : ""}`);
    remaining -= included.length;
  }
  return chunks.join("\n\n");
}
