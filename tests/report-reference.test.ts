import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow } from "docx";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { extractReportReferenceText, isReferenceImage } from "@/lib/report-reference";

describe("AI 보고서 레퍼런스 추출", () => {
  it("Word 제목과 표 구조를 HTML로 추출한다", async () => {
    const document = new Document({
      sections: [{
        children: [
          new Paragraph({ text: "주간 업무 보고", heading: HeadingLevel.HEADING_1 }),
          new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph("항목")] }), new TableCell({ children: [new Paragraph("결과")] })] })] }),
        ],
      }],
    });
    const data = new Uint8Array(await Packer.toBuffer(document));
    const text = await extractReportReferenceText([{
      fileName: "양식.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: data.byteLength,
      data,
    }]);

    expect(text).toContain("주간 업무 보고");
    expect(text).toContain("<h1>");
    expect(text).toContain("<table>");
    expect(text).toContain("항목");
  });

  it("Excel 시트와 행·열 구조를 추출한다", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("주간보고");
    sheet.addRow(["담당자", "완료 업무"]);
    sheet.addRow(["김하늘", "기획안 검토"]);
    const buffer = await workbook.xlsx.writeBuffer();
    const data = new Uint8Array(buffer);
    const text = await extractReportReferenceText([{
      fileName: "양식.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: data.byteLength,
      data,
    }]);

    expect(text).toContain("[시트: 주간보고]");
    expect(text).toContain("담당자\t완료 업무");
    expect(text).toContain("김하늘\t기획안 검토");
  });

  it("이미지 MIME 유형을 시각 레퍼런스로 식별한다", () => {
    expect(isReferenceImage({ fileName: "layout.png", mimeType: "image/png", size: 1, data: new Uint8Array([1]) })).toBe(true);
  });
});
