const SINGLE_NUMBER_PATTERN = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;

function cleanBaseText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFC")
    // Normalize Unicode minus/dashes to ASCII hyphen-minus
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .trim();
}

function normalizeNumberCandidate(raw: string): string {
  // Remove spaces immediately following a leading + or - sign (e.g. "- 3,5" -> "-3,5")
  return raw.replace(/^([+-])\s+(?=[\d.,])/, "$1").trim();
}

/**
 * Normalizes short-answer text so that decimal `.` and `,` inside numbers
 * are treated identically (e.g. "3,5" === "3.5", "3,5 m/s" === "3.5 m/s").
 */
export function normalizeShortAnswerText(value: unknown): string {
  const cleaned = cleanBaseText(value).replace(/\s+/g, " ");
  if (!cleaned) return "";

  const candidate = normalizeNumberCandidate(cleaned);
  if (SINGLE_NUMBER_PATTERN.test(candidate)) {
    const parsed = Number(candidate.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return String(Object.is(parsed, -0) ? 0 : parsed);
    }
  }

  // For mixed text/unit answers (e.g., "3,5 m/s" vs "3.5 m/s"),
  // convert decimal comma between digits into a dot without touching "3, 5" lists.
  return cleaned
    .replace(/(\d),(?=\d)/g, "$1.")
    .toLowerCase();
}

/**
 * Compares a student's short answer against the correct answer.
 * Treats decimal `.` and `,` within a number as equivalent:
 * - "3,5" matches "3.5" and vice versa
 * - "-0,25" matches "-0.25"
 * - "3,50" matches "3.5"
 * - "3,5 m/s" matches "3.5 m/s"
 * - "3, 5" (two items) does NOT falsely match "3.5" (single number)
 */
export function isShortAnswerCorrect(
  studentAnswer: unknown,
  correctAnswer: unknown
): boolean {
  const sRaw = cleanBaseText(studentAnswer);
  const cRaw = cleanBaseText(correctAnswer);
  if (!sRaw || !cRaw) return false;

  const sNumStr = normalizeNumberCandidate(sRaw);
  const cNumStr = normalizeNumberCandidate(cRaw);

  if (SINGLE_NUMBER_PATTERN.test(sNumStr) && SINGLE_NUMBER_PATTERN.test(cNumStr)) {
    const sNum = Number(sNumStr.replace(",", "."));
    const cNum = Number(cNumStr.replace(",", "."));
    if (Number.isFinite(sNum) && Number.isFinite(cNum)) {
      return sNum === cNum;
    }
  }

  return normalizeShortAnswerText(sRaw) === normalizeShortAnswerText(cRaw);
}
