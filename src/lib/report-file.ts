import { existsSync } from "node:fs";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import PptxGenJS from "pptxgenjs";
import type { ReportFormat } from "@/lib/report-formats";
import type { ReportDocument, ReportTemplateProfile } from "@/lib/report-schema";

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
  document?: ReportDocument;
  style?: ReportTemplateProfile["style"];
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

function primaryColor(input: ReportFileInput) {
  return input.style?.primaryColor ?? "0F766E";
}

function accentColor(input: ReportFileInput) {
  return input.style?.accentColor ?? "64748B";
}

function docxTable(columns: string[], rows: string[][], color: string) {
  if (!columns.length) return null;
  const cell = (text: string, header = false) => new TableCell({
    shading: header ? { type: ShadingType.CLEAR, fill: color } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: header, color: header ? "FFFFFF" : "1E293B" })] })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: columns.map((column) => cell(column, true)) }),
      ...rows.map((row) => new TableRow({ children: columns.map((_, index) => cell(row[index] ?? "")) })),
    ],
  });
}

async function createDocx(input: ReportFileInput) {
  const color = primaryColor(input);
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      children: [new TextRun({ text: input.title, bold: true, color, size: 36 })],
      heading: HeadingLevel.TITLE,
      alignment: input.style?.titleAlignment === "CENTER" ? AlignmentType.CENTER : AlignmentType.LEFT,
    }),
    new Paragraph({ children: [new TextRun({ text: input.subtitle, color: accentColor(input), size: 20 })], spacing: { after: 320 } }),
  ];
  if (input.document) {
    for (const block of input.document.blocks) {
      children.push(new Paragraph({ children: [new TextRun({ text: block.heading, bold: true, color, size: 28 })], heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
      children.push(...block.paragraphs.map((text) => new Paragraph({ text, spacing: { after: 140 } })));
      children.push(...block.bullets.map((text) => new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 80 } })));
      const table = docxTable(block.columns, block.rows, color);
      if (table) children.push(table, new Paragraph({ text: "", spacing: { after: 120 } }));
    }
  } else {
  for (const line of contentLines(input.report)) {
    if (line.kind === "heading") {
      children.push(new Paragraph({ text: line.text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
    } else if (line.kind === "bullet") {
      children.push(new Paragraph({ text: line.text, bullet: { level: 0 }, spacing: { after: 80 } }));
    } else {
      children.push(new Paragraph({ text: line.text, spacing: { after: 140 }, style: "Normal" }));
    }
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
  const rows: string[][] = [
    ["구분", "내용"],
    ["제목", input.title],
    ["기준", input.subtitle],
  ];
  if (input.document) {
    for (const block of input.document.blocks) {
      rows.push(["섹션", block.heading]);
      rows.push(...block.paragraphs.map((text) => ["본문", text]));
      rows.push(...block.bullets.map((text) => ["항목", text]));
      if (block.columns.length) {
        rows.push(["표 머리글", ...block.columns]);
        rows.push(...block.rows.map((row) => ["표 데이터", ...row]));
      }
    }
  } else {
    rows.push(...contentLines(input.report).map((line) => [line.kind === "heading" ? "제목" : line.kind === "bullet" ? "항목" : "본문", line.text]));
  }
  return new TextEncoder().encode(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);
}

async function createXlsx(input: ReportFileInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Group Workflow Management";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("AI 보고서", { views: [{ state: "frozen", ySplit: 3 }] });
  const structuredColumnCount = input.document?.blocks.reduce((maximum, block) => Math.max(maximum, block.columns.length), 0) ?? 0;
  const columnCount = Math.max(2, structuredColumnCount);
  sheet.columns = Array.from({ length: columnCount }, (_, index) => ({ key: `column-${index + 1}`, width: index === 0 ? 24 : 30 }));
  sheet.mergeCells(1, 1, 1, columnCount);
  sheet.getCell("A1").value = input.title;
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: `FF${primaryColor(input)}` } };
  sheet.getCell("A1").alignment = { horizontal: input.style?.titleAlignment === "CENTER" ? "center" : "left" };
  sheet.mergeCells(2, 1, 2, columnCount);
  sheet.getCell("A2").value = input.subtitle;
  sheet.getCell("A2").font = { size: 11, color: { argb: `FF${accentColor(input)}` } };
  sheet.addRow([]);
  if (input.document) {
    for (const block of input.document.blocks) {
      const headingRow = sheet.addRow([block.heading]);
      sheet.mergeCells(headingRow.number, 1, headingRow.number, columnCount);
      headingRow.getCell(1).font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      headingRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${primaryColor(input)}` } };
      for (const paragraph of block.paragraphs) {
        const row = sheet.addRow([paragraph]);
        sheet.mergeCells(row.number, 1, row.number, columnCount);
      }
      for (const bullet of block.bullets) {
        const row = sheet.addRow([`• ${bullet}`]);
        sheet.mergeCells(row.number, 1, row.number, columnCount);
      }
      if (block.columns.length) {
        const header = sheet.addRow(block.columns);
        header.font = { bold: true, color: { argb: "FFFFFFFF" } };
        header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${accentColor(input)}` } };
        block.rows.forEach((values) => sheet.addRow(values));
      }
      sheet.addRow([]);
    }
  } else {
  const header = sheet.addRow(["구분", "내용"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  for (const line of contentLines(input.report)) {
    const row = sheet.addRow([line.kind === "heading" ? "제목" : line.kind === "bullet" ? "항목" : "본문", line.text]);
    row.alignment = { vertical: "top", wrapText: true };
    if (line.kind === "heading") row.font = { bold: true };
  }
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
  titleSlide.background = { color: "F8FAFC" };
  titleSlide.addText(input.title, { x: 0.8, y: 2.2, w: 11.7, h: 0.8, fontFace: "NanumGothic", fontSize: 28, bold: true, color: primaryColor(input), align: input.style?.titleAlignment === "LEFT" ? "left" : "center" });
  titleSlide.addText(input.subtitle, { x: 1, y: 3.2, w: 11.3, h: 0.4, fontFace: "NanumGothic", fontSize: 13, color: accentColor(input), align: input.style?.titleAlignment === "LEFT" ? "left" : "center" });

  if (input.document) {
    input.document.blocks.forEach((block) => {
      const slide = pptx.addSlide();
      slide.background = { color: "FFFFFF" };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.16, line: { color: primaryColor(input), transparency: 100 }, fill: { color: primaryColor(input) } });
      slide.addText(block.heading, { x: 0.7, y: 0.45, w: 11.8, h: 0.5, fontFace: "NanumGothic", fontSize: 22, bold: true, color: primaryColor(input) });
      const narrative = [...block.paragraphs, ...block.bullets.map((item) => `• ${item}`)].join("\n\n");
      if (narrative) slide.addText(narrative, { x: 0.8, y: 1.2, w: 11.6, h: block.columns.length ? 2 : 5.7, fontFace: "NanumGothic", fontSize: 14, color: "1E293B", valign: "top", margin: 0.08, fit: "shrink" });
      if (block.columns.length) {
        slide.addTable([block.columns, ...block.rows].map((row) => row.map((text) => ({ text }))), {
          x: 0.8,
          y: narrative ? 3.45 : 1.3,
          w: 11.6,
          h: narrative ? 3.25 : 5.4,
          fontFace: "NanumGothic",
          fontSize: 10,
          color: "1E293B",
          border: { type: "solid", color: "CBD5E1", pt: 1 },
          fill: { color: "FFFFFF" },
          bold: false,
          margin: 0.06,
          rowH: 0.35,
        });
      }
    });
  } else {
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
  }
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
  document.font("Korean").fillColor(`#${primaryColor(input)}`).fontSize(20).text(input.title, { align: input.style?.titleAlignment === "CENTER" ? "center" : "left" });
  document.moveDown(0.4).fillColor(`#${accentColor(input)}`).fontSize(10).text(input.subtitle);
  document.moveDown(1.2);
  if (input.document) {
    for (const block of input.document.blocks) {
      document.moveDown(0.7).fillColor(`#${primaryColor(input)}`).fontSize(14).text(block.heading).moveDown(0.25);
      block.paragraphs.forEach((text) => document.fillColor("#1E293B").fontSize(10.5).text(text, { paragraphGap: 7, lineGap: 2 }));
      block.bullets.forEach((text) => document.fillColor("#1E293B").fontSize(10.5).text(`• ${text}`, { indent: 10, paragraphGap: 5, lineGap: 2 }));
      if (block.columns.length) {
        document.fillColor(`#${accentColor(input)}`).fontSize(9.5).text(block.columns.join("  |  "));
        block.rows.forEach((row) => document.fillColor("#1E293B").fontSize(9).text(row.join("  |  "), { paragraphGap: 3 }));
      }
    }
  } else {
  for (const line of contentLines(input.report)) {
    if (line.kind === "heading") {
      document.moveDown(0.7).fillColor("#0F766E").fontSize(14).text(line.text).moveDown(0.25);
    } else if (line.kind === "bullet") {
      document.fillColor("#1E293B").fontSize(10.5).text(`• ${line.text}`, { indent: 10, paragraphGap: 5, lineGap: 2 });
    } else {
      document.fillColor("#1E293B").fontSize(10.5).text(line.text, { paragraphGap: 7, lineGap: 2 });
    }
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
