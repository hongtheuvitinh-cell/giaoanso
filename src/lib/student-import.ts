import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { StudentAccount } from "@/types";

export interface ParsedStudentRow {
  rowIndex: number;
  studentId: string;
  password: string;
  fullName: string;
  studentClass: string;
  schoolName: string;
}

export interface SkippedStudentRow {
  rowIndex: number;
  rawPreview: string;
  reason: string;
}

export interface StudentImportResult {
  detectedFormat: string;
  validRows: ParsedStudentRow[];
  skippedRows: SkippedStudentRow[];
}

export function isCorruptedText(value?: string | null): boolean {
  if (!value) return false;
  // Replacement char \uFFFD, null byte \u0000, or ASCII control chars (excluding tab/newline/CR)
  if (/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    return true;
  }
  return false;
}

export function isCorruptedStudentAccount(st: StudentAccount): boolean {
  if (
    isCorruptedText(st.studentId) ||
    isCorruptedText(st.fullName) ||
    isCorruptedText(st.password) ||
    isCorruptedText(st.studentClass) ||
    isCorruptedText(st.schoolName)
  ) {
    return true;
  }
  // Binary / ZIP fragments accidentally parsed as studentId often contain special punctuation or are unusually long
  if (!st.studentId || st.studentId.length > 50) return true;
  const weirdChars = (st.studentId.match(/[~`!#$%^&*()+={}[\]|\\:;"'<>?,/]/g) || []).length;
  if (weirdChars >= 2) return true;
  return false;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join("\n");
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  if (tabCount > commaCount && tabCount >= semiCount) return "\t";
  if (semiCount > commaCount) return ";";
  return ",";
}

function decodeTextBuffer(bytes: Uint8Array): { text: string; encoding: string } {
  // Check BOM
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "CSV (UTF-16 LE)" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "CSV (UTF-16 BE)" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "CSV (UTF-8 BOM)" };
  }

  // Try strict UTF-8 first
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text, encoding: "CSV (UTF-8)" };
  } catch {
    // Fallback to Windows-1258 (Vietnamese ANSI) or Windows-1252
    try {
      const text = new TextDecoder("windows-1258").decode(bytes);
      return { text, encoding: "CSV (Windows-1258)" };
    } catch {
      const text = new TextDecoder("windows-1252").decode(bytes);
      return { text, encoding: "CSV (ANSI)" };
    }
  }
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return (
    joined.includes("ma_hs") ||
    joined.includes("mã hs") ||
    joined.includes("mã học sinh") ||
    joined.includes("mat_khau") ||
    joined.includes("mật khẩu") ||
    joined.includes("ho_va_ten") ||
    joined.includes("họ và tên") ||
    joined.includes("họ tên") ||
    joined.includes("studentid")
  );
}

export async function parseStudentFile(file: File): Promise<StudentImportResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length === 0) {
    throw new Error("File rỗng, không có dữ liệu.");
  }

  // Detect Excel binary signature (PK\x03\x04 for .xlsx/.xlsm or OLE2 D0 CF 11 E0 for .xls)
  const isZipExcel = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const isOleExcel = bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  const ext = file.name.toLowerCase().split(".").pop() || "";

  let rawRows: string[][] = [];
  let detectedFormat = "CSV";

  if (isZipExcel || isOleExcel || ext === "xlsx" || ext === "xls") {
    try {
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("File Excel không có trang tính (Sheet) nào.");
      }
      const sheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: "" });
      rawRows = matrix.map((row) => row.map((cell) => String(cell ?? "").trim()));
      detectedFormat = isZipExcel ? "Excel (.xlsx)" : isOleExcel ? "Excel (.xls)" : `Excel (.${ext})`;
    } catch (err) {
      throw new Error("Không thể đọc file Excel. Vui lòng kiểm tra file có bị hỏng hoặc đặt mật khẩu không.");
    }
  } else {
    // Reject obvious non-text binary files
    let nullCount = 0;
    const checkLen = Math.min(bytes.length, 512);
    for (let i = 0; i < checkLen; i++) {
      if (bytes[i] === 0) nullCount++;
    }
    // UTF-16 has regular nulls at even/odd positions and is valid; arbitrary binary has random nulls without UTF-16 BOM
    const hasUtf16Bom = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
    if (nullCount > 10 && !hasUtf16Bom) {
      throw new Error("File tải lên chứa dữ liệu nhị phân không hợp lệ. Vui lòng dùng file Excel (.xlsx) hoặc CSV chuẩn UTF-8.");
    }

    const decoded = decodeTextBuffer(bytes);
    detectedFormat = decoded.encoding;

    const lines = decoded.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      throw new Error("File CSV không có nội dung.");
    }

    const delimiter = detectDelimiter(lines);
    rawRows = lines.map((line) => parseCsvLine(line, delimiter));
  }

  // Filter completely empty rows
  const nonEmptyRows = rawRows
    .map((cells, idx) => ({ cells, rowIndex: idx + 1 }))
    .filter(({ cells }) => cells.some((c) => c.length > 0));

  if (nonEmptyRows.length === 0) {
    throw new Error("Không tìm thấy dữ liệu học sinh trong file.");
  }

  // Check header row & whether there's a leading STT column
  let startIdx = 0;
  let hasSttColumn = false;

  if (isHeaderRow(nonEmptyRows[0].cells)) {
    startIdx = 1;
    const firstHeader = nonEmptyRows[0].cells[0]?.toLowerCase() || "";
    if (firstHeader === "stt" || firstHeader === "tt" || firstHeader === "#") {
      hasSttColumn = true;
    }
  }

  const validRows: ParsedStudentRow[] = [];
  const skippedRows: SkippedStudentRow[] = [];

  for (let i = startIdx; i < nonEmptyRows.length; i++) {
    const { cells, rowIndex } = nonEmptyRows[i];
    const shifted = hasSttColumn ? cells.slice(1) : cells;
    const [rawId = "", rawPass = "", rawName = "", rawClass = "", rawSchool = ""] = shifted;

    const studentId = rawId.trim();
    const password = rawPass.trim();
    const fullName = rawName.trim();
    const studentClass = rawClass.trim();
    const schoolName = rawSchool.trim();
    const previewText = shifted.filter(Boolean).slice(0, 3).join(" | ").slice(0, 60);

    if (
      isCorruptedText(studentId) ||
      isCorruptedText(password) ||
      isCorruptedText(fullName) ||
      isCorruptedText(studentClass) ||
      isCorruptedText(schoolName)
    ) {
      skippedRows.push({
        rowIndex,
        rawPreview: previewText || "(Ký tự lỗi)",
        reason: "Chứa ký tự nhị phân / lỗi bảng mã"
      });
      continue;
    }

    if (!studentId || !password || !fullName || !studentClass) {
      skippedRows.push({
        rowIndex,
        rawPreview: previewText || "(Trống)",
        reason: "Thiếu 1 trong 4 cột bắt buộc (Mã HS, Mật khẩu, Họ tên, Lớp)"
      });
      continue;
    }

    const weirdIdChars = (studentId.match(/[~`!#$%^&*()+={}[\]|\\:;"'<>?,/]/g) || []).length;
    if (studentId.length > 50 || /\s/.test(studentId) || weirdIdChars >= 2) {
      skippedRows.push({
        rowIndex,
        rawPreview: studentId.slice(0, 40),
        reason: "Mã HS không hợp lệ (quá dài, có khoảng trắng hoặc chứa ký tự lạ)"
      });
      continue;
    }

    if (fullName.length > 120 || password.length > 100 || studentClass.length > 50) {
      skippedRows.push({
        rowIndex,
        rawPreview: previewText,
        reason: "Dữ liệu vượt quá độ dài cho phép"
      });
      continue;
    }

    validRows.push({
      rowIndex,
      studentId,
      password,
      fullName,
      studentClass,
      schoolName
    });
  }

  return {
    detectedFormat,
    validRows,
    skippedRows
  };
}

export function downloadStudentExcelTemplate() {
  const rows = [
    {
      ma_hs: "HS1201",
      mat_khau: "123456",
      ho_va_ten: "Nguyễn Văn A",
      lop: "12A1",
      truong: "THPT Chu Văn An"
    },
    {
      ma_hs: "HS1202",
      mat_khau: "123456",
      ho_va_ten: "Trần Thị B",
      lop: "12A2",
      truong: "THPT Chu Văn An"
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 25 },
    { wch: 12 },
    { wch: 25 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachHocSinh");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  saveAs(blob, "Mau_Danh_Sach_Hoc_Sinh.xlsx");
}
