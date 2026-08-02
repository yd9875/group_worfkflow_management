import { existsSync } from "node:fs";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import PptxGenJS from "pptxgenjs";
import type { ReportFormat } from "@/lib/report-formats";

const formatInfo: Record<ReportFormat, { mimeType: string; label: string }> = {
  txt: { mimeType: "text/plain; charset=utf-8", label: "TXT" },
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "DOCX" },
  csv: { mimeType: "text/csv; charset=utf-8", label: "CSV" },
  xlsx: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "XLSX" },
  pptx: { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PPTX" },
  pdf: { mimeType: "application/pdf", label: "PDF" },
};

type ReportFileInput = {
  format: ReportFormat;
  title: string;
  subtitle: string;
  report: string;
};

type ContentLine = {
  kind: "heading" | "bullet" | "paragraph";
  text: string;
};

function contentLines(report: string): ContentLine[] {
  return report
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^#{1,6}\s+/.test(line)) return { kind: "heading" as const, text: line.replace(/^#{1,6}\s+/, "") };
      if (/^[-*•]\s+/.test(line)) return { kind: "bullet" as const, text: line.replace(/^[-*•]\s+/, "") };
      return { kind: "paragraph" as const, text: line.replace(/^\*\*(.+)\*\*$/, "$1") };
    });
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function plainText(input: ReportFileInput) {
  return `${input.title}\n${input.subtitle}\n\n${input.report.trim()}\n`;
}

async function createDocx(input: ReportFileInput) {
  const children: Paragraph[] = [
    new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: input.subtitle, color: "64748B", size: 20 })], spacing: { after: 320 } }),
  ];
  for (const line of contentLines(input.report)) {
    if (line.kind === "heading") {
      children.push(new Paragraph({ text: line.text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
    } else if (line.kind === "bullet") {
      children.push(new Paragraph({ text: line.text, bullet: { level: 0 }, spacing: { after: 80 } }));
    } else {
      children.push(new Paragraph({ text: line.text, spacing: { after: 140 }, style: "Normal" }));
    }
  }
  const document = new Document({
    styles: {
      default: { document: { run: { font: "NanumGothic", size: 22 } } },
    },
    sections: [{ properties: {}, children }],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}

function createCsv(input: ReportFileInput) {
  const rows = [
    ["구분", "내용"],
    ["제목", input.title],
    ["기준", input.subtitle],
    ...contentLines(input.report).map((line) => [line.kind === "heading" ? "제목" : line.kind === "bullet" ? "항목" : "본문", line.text]),
  ];
  return new TextEncoder().encode(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);
}

async function createXlsx(input: ReportFileInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Group Workflow Management";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("AI 보고서", { views: [{ state: "frozen", ySplit: 4 }] });
  sheet.columns = [{ key: "kind", width: 18 }, { key: "content", width: 100 }];
  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = input.title;
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF0F766E" } };
  sheet.mergeCells("A2:B2");
  sheet.getCell("A2").value = input.subtitle;
  sheet.getCell("A2").font = { size: 11, color: { argb: "FF64748B" } };
  sheet.addRow([]);
  const header = sheet.addRow(["구분", "내용"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  for (const line of contentLines(input.report)) {
    const row = sheet.addRow([line.kind === "heading" ? "제목" : line.kind === "bullet" ? "항목" : "본문", line.text]);
    row.alignment = { vertical: "top", wrapText: true };
    if (line.kind === "heading") row.font = { bold: true };
  }
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { name: "NanumGothic", ...cell.font };
      cell.alignment = { vertical: "top", wrapText: true, ...cell.alignment };
    });
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function slideChunks(lines: ContentLine[]) {
  const chunks: ContentLine[][] = [];
  let current: ContentLine[] = [];
  let characters = 0;
  for (const line of lines) {
    if (current.length >= 8 || characters + line.text.length > 850) {
      chunks.push(current);
      current = [];
      characters = 0;
    }
    current.push(line);
    characters += line.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function createPptx(input: ReportFileInput) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Group Workflow Management";
  pptx.subject = input.subtitle;
  pptx.title = input.title;
  pptx.theme = {
    headFontFace: "NanumGothic",
    bodyFontFace: "NanumGothic",
  };

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "F0FDFA" };
  titleSlide.addText(input.title, { x: 0.8, y: 2.2, w: 11.7, h: 0.8, fontFace: "NanumGothic", fontSize: 28, bold: true, color: "0F766E", align: "center" });
  titleSlide.addText(input.subtitle, { x: 1, y: 3.2, w: 11.3, h: 0.4, fontFace: "NanumGothic", fontSize: 13, color: "64748B", align: "center" });

  const chunks = slideChunks(contentLines(input.report));
  chunks.forEach((chunk, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    const heading = chunk.find((line) => line.kind === "heading")?.text ?? `보고서 ${index + 1}`;
    slide.addText(heading, { x: 0.7, y: 0.45, w: 11.8, h: 0.5, fontFace: "NanumGothic", fontSize: 22, bold: true, color: "0F766E" });
    slide.addText(chunk.map((line) => `${line.kind === "bullet" ? "• " : ""}${line.text}`).join("\n\n"), {
      x: 0.85,
      y: 1.2,
      w: 11.5,
      h: 5.7,
      fontFace: "NanumGothic",
      fontSize: 15,
      color: "1E293B",
      breakLine: false,
      valign: "top",
      margin: 0.08,
      fit: "shrink",
    });
  });
  const output = await pptx.write({ outputType: "arraybuffer" });
  return new Uint8Array(output as ArrayBuffer);
}

function koreanPdfFont() {
  const candidates = [
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "C:/Windows/Fonts/malgun.ttf",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function createPdf(input: ReportFileInput) {
  const font = koreanPdfFont();
  if (!font) throw new Error("PDF 생성을 위한 한글 글꼴을 찾지 못했습니다.");
  const document = new PDFDocument({ size: "A4", margin: 54, info: { Title: input.title, Subject: input.subtitle } });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Uint8Array>((resolve, reject) => {
    document.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    document.on("error", reject);
  });
  document.registerFont("Korean", font);
  document.font("Korean").fillColor("#0F766E").fontSize(20).text(input.title);
  document.moveDown(0.4).fillColor("#64748B").fontSize(10).text(input.subtitle);
  document.moveDown(1.2);
  for (const line of contentLines(input.report)) {
    if (line.kind === "heading") {
      document.moveDown(0.7).fillColor("#0F766E").fontSize(14).text(line.text).moveDown(0.25);
    } else if (line.kind === "bullet") {
      document.fillColor("#1E293B").fontSize(10.5).text(`• ${line.text}`, { indent: 10, paragraphGap: 5, lineGap: 2 });
    } else {
      document.fillColor("#1E293B").fontSize(10.5).text(line.text, { paragraphGap: 7, lineGap: 2 });
    }
  }
  document.end();
  return completed;
}

export async function createReportFile(input: ReportFileInput) {
  let body: Uint8Array;
  if (input.format === "docx") body = await createDocx(input);
  else if (input.format === "csv") body = createCsv(input);
  else if (input.format === "xlsx") body = await createXlsx(input);
  else if (input.format === "pptx") body = await createPptx(input);
  else if (input.format === "pdf") body = await createPdf(input);
  else body = new TextEncoder().encode(`\uFEFF${plainText(input)}`);
  return { body, mimeType: formatInfo[input.format].mimeType, extension: input.format, label: formatInfo[input.format].label };
}

export function safeReportFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "AI 보고서";
}
