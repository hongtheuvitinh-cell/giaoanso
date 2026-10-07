import { Exam, Question, QuestionLevel, QuestionOption, QuestionType } from "@/types";

/**
 * Normalizes MathJax delimiters (\( ... \) and \[ ... \]) into standard Markdown KaTeX ($ ... $ and $$ ... $$)
 */
function normalizeMathDelimiters(text: string): string {
  if (!text) return "";
  let res = String(text);
  // Convert \( ... \) to $ ... $
  res = res.replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => `$${formula.trim()}$`);
  // Convert \[ ... \] to $$ ... $$
  res = res.replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => `\n$$\n${formula.trim()}\n$$\n`);
  return res;
}

/**
 * Cleans HTML formatting tags and line breaks, converting them to clean Markdown
 */
function cleanHtmlAndFormat(str: any): string {
  if (str === null || str === undefined) return "";
  let text = String(str);
  
  // Replace <br> and <br/> with newline
  text = text.replace(/<br\s*[\/]?>/gi, "\n");
  // Replace </p>, </div> with double newline
  text = text.replace(/<\/(?:p|div)>/gi, "\n\n");
  // Strip opening <p...>, <div...>, <span...>
  text = text.replace(/<(?:p|div|span)[^>]*>/gi, "");
  // Replace <b>, <strong> with **
  text = text.replace(/<\/?(?:b|strong)>/gi, "**");
  // Replace <i>, <em> with *
  text = text.replace(/<\/?(?:i|em)>/gi, "*");
  // Normalize MathJax formulas
  text = normalizeMathDelimiters(text);
  // Remove redundant consecutive empty lines (> 2 newlines)
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/**
 * Retrieves the first non-empty string value among candidate keys in an object
 */
function getFirstString(obj: any, keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return String(obj[k]).trim();
    }
  }
  return "";
}

/**
 * Extracts question stem and distinct "lời dẫn" / context / passage if available
 */
function extractContentAndContext(q: any, groupContext: string = ""): { content: string; context?: string } {
  const mainKeys = [
    "text", "content", "question", "stem", "cau_hoi", "cauhoi", 
    "noi_dung", "noidung", "body", "title", "prompt"
  ];
  const contextKeys = [
    "context", "loi_dan", "loiDan", "loidan", "loi_dan_chung", "dan_y", "dany", 
    "dan_de", "dande", "ngu_lieu", "ngulieu", "passage", "passage_text", 
    "reading_passage", "reading", "stimulus", "scenario", "intro", "introduction", 
    "lead_in", "leadin", "lead", "background", "description", "context_text", 
    "shared_context", "group_context", "header_text", "header", "common_text", 
    "common_content", "doc_hieu", "dochieu", "text_lead", "lead_text", "passage_content"
  ];

  const main = getFirstString(q, mainKeys);
  const directContext = getFirstString(q, contextKeys);

  // Combine parent group context and direct question context
  let combinedContext = "";
  if (groupContext && directContext) {
    if (groupContext.trim() === directContext.trim()) {
      combinedContext = directContext;
    } else if (directContext.includes(groupContext)) {
      combinedContext = directContext;
    } else if (groupContext.includes(directContext)) {
      combinedContext = groupContext;
    } else {
      combinedContext = `${groupContext.trim()}\n\n${directContext.trim()}`;
    }
  } else {
    combinedContext = directContext || groupContext || "";
  }

  const cleanedCtx = cleanHtmlAndFormat(combinedContext);
  const cleanedMain = cleanHtmlAndFormat(main);

  if (cleanedCtx && cleanedMain) {
    if (cleanedCtx === cleanedMain) {
      return { content: cleanedMain };
    }
    if (cleanedMain.includes(cleanedCtx)) {
      return { content: cleanedMain, context: cleanedCtx };
    }
    return {
      content: cleanedMain,
      context: cleanedCtx
    };
  }

  if (cleanedCtx && !cleanedMain) {
    return {
      content: cleanedCtx,
      context: undefined
    };
  }

  return {
    content: cleanedMain || cleanedCtx || "",
    context: undefined
  };
}

/**
 * Maps question type from string or heuristics
 */
function mapQuestionType(rawType: any, q?: any): QuestionType {
  const t = String(rawType || "").toLowerCase().trim();
  if (["mcq", "mc", "multiple_choice", "multiple-choice", "part1", "trac_nghiem", "trac-nghiem", "choice"].includes(t)) {
    return "MC";
  }
  if (["group-tf", "group_tf", "tf", "true_false", "true-false", "part2", "dung_sai", "dung-sai", "dung/sai"].includes(t)) {
    return "TF";
  }
  if (["short", "sa", "short_answer", "short-answer", "part3", "tra_loi_ngan", "tra-loi-ngan", "ngan"].includes(t)) {
    return "SA";
  }
  if (["essay", "tu_luan", "tu-luan", "part4", "tự luận"].includes(t)) {
    return "ESSAY";
  }

  // Heuristics based on question structure
  if (q) {
    const subList = q.subQuestions || q.sub_questions || q.subquestions || q.statements || q.cac_y || q.y_con;
    if (Array.isArray(subList) && subList.length > 0) return "TF";
    
    const opts = q.options || q.choices || q.answers || q.phuong_an || q.lua_chon;
    if (Array.isArray(opts) && opts.length > 0) return "MC";
    if (opts && typeof opts === "object" && Object.keys(opts).length > 0) return "MC";
    
    if (q.correctAnswer || q.correct_answer || q.dap_an || q.answer) return "SA";
  }

  return "MC";
}

/**
 * Maps difficulty level to standard enum
 */
function mapQuestionLevel(rawLevel: any): QuestionLevel {
  const l = String(rawLevel || "").toUpperCase().trim();
  if (["B", "NB", "KNOW", "NHẬN BIẾT", "NHAN BIET", "NHAN_BIET", "1", "EASY", "DỄ", "DE"].includes(l)) {
    return "know";
  }
  if (["H", "TH", "UNDERSTAND", "THÔNG HIỂU", "THONG HIEU", "THONG_HIEU", "2", "MEDIUM", "TRUNG BÌNH", "TRUNG_BINH"].includes(l)) {
    return "understand";
  }
  if (["VD", "APPLY", "VẬN DỤNG", "VAN DUNG", "VAN_DUNG", "3", "HARD", "KHÓ", "KHO"].includes(l)) {
    return "apply";
  }
  if (["VDC", "HIGHAPPLY", "HIGH_APPLY", "VẬN DỤNG CAO", "VAN DUNG CAO", "VAN_DUNG_CAO", "4", "VERY_HARD", "RẤT KHÓ"].includes(l)) {
    return "highApply";
  }

  const lower = String(rawLevel || "").toLowerCase().trim();
  if (["know", "understand", "apply", "highapply"].includes(lower)) {
    return lower === "highapply" ? "highApply" : (lower as QuestionLevel);
  }
  return "understand";
}

/**
 * Parses Multiple-Choice options
 */
function parseMcOptions(q: any): QuestionOption[] {
  const rawCorrect = getFirstString(q, [
    "correctAnswer", "correct_answer", "answer", "dap_an", "dapan", 
    "key", "result", "correct_option", "correctOption", "correct_choice", "correctChoice"
  ]);
  const rawUpper = rawCorrect.toUpperCase().trim();

  const stripPrefix = (str: string) => str.replace(/^[A-Da-d][\.\:\)\s]\s*/, "").trim();

  const rawOptions = q.options || q.choices || q.answers || q.phuong_an || q.phuongan || q.lua_chon;

  if (Array.isArray(rawOptions)) {
    return rawOptions.map((opt: any, idx: number) => {
      const defaultLetter = String.fromCharCode(65 + idx);
      let letter = defaultLetter;
      let rawText = "";
      let isCorrect = false;

      if (typeof opt === "string") {
        rawText = opt;
      } else if (typeof opt === "object" && opt !== null) {
        letter = (opt.id || opt.label || opt.key || opt.option || opt.choice || defaultLetter).toString().toUpperCase();
        rawText = opt.text || opt.content || opt.answer || opt.noi_dung || opt.noidung || opt.value || "";
        if (typeof opt.isCorrect === "boolean") isCorrect = opt.isCorrect;
        else if (typeof opt.is_correct === "boolean") isCorrect = opt.is_correct;
        else if (typeof opt.correct === "boolean") isCorrect = opt.correct;
      }

      const text = stripPrefix(rawText);

      // If correctness not explicitly marked as boolean in object, match against rawCorrect
      if (!isCorrect && rawCorrect) {
        if (rawUpper === letter) {
          isCorrect = true;
        } else if (
          rawCorrect.trim() === rawText.trim() || 
          rawCorrect.trim() === text.trim() || 
          stripPrefix(rawCorrect) === text
        ) {
          isCorrect = true;
        }
      }

      return {
        id: letter,
        text: cleanHtmlAndFormat(text),
        isCorrect
      };
    });
  } else if (rawOptions && typeof rawOptions === "object") {
    return Object.entries(rawOptions).map(([key, val]) => {
      const letter = key.toUpperCase();
      const rawText = String(val);
      const text = stripPrefix(rawText);
      const isCorrect = (rawUpper === letter) || (rawCorrect === rawText.trim()) || (rawCorrect === text.trim());
      return {
        id: letter,
        text: cleanHtmlAndFormat(text),
        isCorrect
      };
    });
  }

  return [];
}

/**
 * Parses True/False sub-questions
 */
function parseTfOptions(q: any): QuestionOption[] {
  const subList = q.subQuestions || q.sub_questions || q.subquestions || 
                  q.items || q.statements || q.cac_y || q.y_con || q.ycon || 
                  q.options || q.choices || [];
                  
  if (Array.isArray(subList)) {
    return subList.map((sq: any, sIdx: number) => {
      const label = (sq.sub_label || sq.label || sq.id || sq.name || sq.key || sq.order || String.fromCharCode(97 + sIdx)).toLowerCase();
      
      let rawAns: any = sq.correctAnswer !== undefined ? sq.correctAnswer : 
                       (sq.correct_answer !== undefined ? sq.correct_answer : 
                       (sq.isCorrect !== undefined ? sq.isCorrect : 
                       (sq.is_correct !== undefined ? sq.is_correct : 
                       (sq.dap_an !== undefined ? sq.dap_an : 
                       (sq.dapan !== undefined ? sq.dapan : 
                       (sq.answer !== undefined ? sq.answer : 
                       (sq.result !== undefined ? sq.result : undefined)))))));
      
      let isCorrect = false;
      if (typeof rawAns === "boolean") {
        isCorrect = rawAns;
      } else if (rawAns !== undefined && rawAns !== null) {
        const strAns = String(rawAns).toLowerCase().trim();
        isCorrect = strAns === "true" || strAns === "t" || strAns === "1" || 
                    strAns.includes("đúng") || strAns === "dung" || strAns === "d" || strAns === "yes";
      }

      const text = getFirstString(sq, ["text", "content", "question", "statement", "y", "cau", "noi_dung", "noidung"]);
      return {
        id: label,
        text: cleanHtmlAndFormat(text),
        isCorrect
      };
    });
  }
  return [];
}

/**
 * Extracts explanation / solution (including aggregating sub-question explanations for TF if parent is empty)
 */
function extractExplanation(q: any): string {
  const parentExp = getFirstString(q, [
    "solution", "explanation", "guide", "huong_dan", "huongdan", 
    "loi_giai", "loigiai", "giai_thich", "giaithich", "detail", 
    "huong_dan_giai", "huongdangiai", "giai_chi_tiet"
  ]);

  if (parentExp) {
    return cleanHtmlAndFormat(parentExp);
  }

  // Check if sub-questions have individual explanations
  const subList = q.subQuestions || q.sub_questions || q.subquestions || 
                  q.items || q.statements || q.cac_y || q.y_con || q.options;

  if (Array.isArray(subList) && subList.length > 0) {
    const subExps = subList
      .map((sq: any, i: number) => {
        const lbl = (sq.sub_label || sq.label || sq.id || String.fromCharCode(97 + i)).toLowerCase();
        const exp = getFirstString(sq, ["explanation", "solution", "guide", "huong_dan", "loi_giai", "giai_thich"]);
        return exp ? `**${lbl})** ${cleanHtmlAndFormat(exp)}` : "";
      })
      .filter(Boolean);

    if (subExps.length > 0) {
      return subExps.join("\n\n");
    }
  }

  return "";
}

/**
 * Normalizes question object into standard app Question
 */
function normalizeSingleQuestion(q: any, idx: number, partId: number = 1, partName: string = "", groupContext: string = ""): Question {
  const qnum = q.qnum || q.order || q.stt || (idx + 1);
  const qtypeRaw = String(q.qtype || q.type || "").toLowerCase();

  // Determine question type: MC (part 1), TF (part 2), SA (part 3), ESSAY (part 4)
  let type: QuestionType = "MC";
  if (
    qtypeRaw === "part1" || qtypeRaw === "mc" || qtypeRaw === "mcq" || 
    partId === 1 || partName.includes("nhiều lựa chọn") || 
    partName.includes("phần i") || partName.includes("trắc nghiệm")
  ) {
    type = "MC";
  }
  if (
    qtypeRaw === "part2" || qtypeRaw === "tf" || qtypeRaw === "group-tf" || 
    partId === 2 || partName.includes("đúng/sai") || partName.includes("đúng sai") || 
    partName.includes("phần ii") || q.sub_questions || q.subQuestions || q.statements
  ) {
    type = "TF";
  }
  if (
    qtypeRaw === "part3" || qtypeRaw === "sa" || qtypeRaw === "short" || 
    partId === 3 || partName.includes("ngắn") || partName.includes("trả lời ngắn") || 
    partName.includes("phần iii")
  ) {
    type = "SA";
  }
  if (qtypeRaw === "essay" || qtypeRaw === "tu_luan" || partName.includes("tự luận") || partId === 4) {
    type = "ESSAY";
  }

  // Determine level
  const rawLevel = q.level || q.muc_do || q.mucdo || q.difficulty || q.bloom_level || q.cap_do;
  let level = mapQuestionLevel(rawLevel);
  if (!rawLevel) {
    if (type === "MC") {
      if (idx < 6) level = "know";
      else if (idx < 14) level = "understand";
      else level = "apply";
    } else if (type === "TF") {
      if (idx < 2) level = "understand";
      else if (idx === 2) level = "apply";
      else level = "highApply";
    } else if (type === "SA") {
      if (idx < 2) level = "apply";
      else level = "highApply";
    }
  }

  // Extract content and context
  const { content: rawContent, context: extractedContext } = extractContentAndContext(q, groupContext);
  let content = rawContent;
  const unit = q.unit || q.don_vi || q.donvi;
  if (type === "SA" && unit && !content.includes(unit)) {
    content += ` *(Đơn vị: ${unit})*`;
  }

  // Options
  let options: QuestionOption[] | undefined = undefined;
  if (type === "MC") {
    options = parseMcOptions(q);
  } else if (type === "TF") {
    options = parseTfOptions(q);
  }

  // Correct answer for SA / MC
  let correctAnswer: string | undefined = undefined;
  if (type === "SA") {
    correctAnswer = getFirstString(q, [
      "correctAnswer", "correct_answer", "answer", "dap_an", "dapan", 
      "key", "result", "value", "gia_tri", "short_answer"
    ]);
  } else if (type === "MC") {
    const correctOpt = options?.find(o => o.isCorrect);
    correctAnswer = correctOpt ? correctOpt.id : getFirstString(q, ["correctAnswer", "correct_answer", "dap_an", "answer"]);
  }

  // Explanation
  const explanation = extractExplanation(q);

  // Image URL
  const imageUrl = getFirstString(q, ["imageUrl", "image_url", "image", "img", "hinh_anh", "hinhanh", "diagram", "figure", "picture", "photo", "anh"]);

  // Points
  const rawPoints = q.points !== undefined ? q.points : (q.point !== undefined ? q.point : (q.diem !== undefined ? q.diem : q.score));
  let points = rawPoints !== undefined && !isNaN(Number(rawPoints)) 
    ? Number(rawPoints) 
    : (type === "MC" ? 0.25 : type === "TF" ? 1.0 : type === "SA" ? 0.25 : 1.0);

  return {
    id: q.id || `q-p${partId}-${qnum}-${Math.random().toString(36).substr(2, 5)}`,
    type,
    level,
    content: content.trim(),
    context: extractedContext?.trim() || undefined,
    imageUrl,
    options,
    correctAnswer,
    explanation,
    points
  };
}

/**
 * Infer subject from text keywords if not explicitly provided
 */
function inferSubject(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("vật lý") || t.includes("vật lí") || t.includes("chuyển động") || t.includes("vận tốc") || t.includes("gia tốc") || t.includes("lực") || t.includes("điện trường") || t.includes("dao động") || t.includes("quang học") || t.includes("nhiệt học")) {
    return "Vật Lý";
  }
  if (t.includes("hóa học") || t.includes("phản ứng") || t.includes("axit") || t.includes("ancol") || t.includes("este") || t.includes("nguyên tố") || t.includes("mol") || t.includes("dung dịch")) {
    return "Hóa Học";
  }
  if (t.includes("toán") || t.includes("đạo hàm") || t.includes("tích phân") || t.includes("hình học") || t.includes("vectơ") || t.includes("nghiệm") || t.includes("hàm số")) {
    return "Toán Học";
  }
  if (t.includes("sinh học") || t.includes("tế bào") || t.includes("di truyền") || t.includes("nhiễm sắc thể") || t.includes("đột biến") || t.includes("quần thể")) {
    return "Sinh Học";
  }
  if (t.includes("lịch sử") || t.includes("cách mạng") || t.includes("kháng chiến") || t.includes("hiệp định")) {
    return "Lịch Sử";
  }
  if (t.includes("địa lý") || t.includes("địa lí") || t.includes("khí hậu") || t.includes("địa hình") || t.includes("sông ngòi")) {
    return "Địa Lý";
  }
  if (t.includes("tiếng anh") || t.includes("english") || t.includes("grammar") || t.includes("pronunciation")) {
    return "Tiếng Anh";
  }
  return "Vật Lý";
}

/**
 * Extracts grade from string (e.g. "K12" -> "12", "Lớp 11" -> "11")
 */
function extractGrade(val: any, fallbackText: string = ""): string {
  if (val) {
    const match = String(val).match(/10|11|12/);
    if (match) return match[0];
  }
  const match = fallbackText.match(/(?:k|khối|lớp|grade)\s*(10|11|12)/i);
  if (match) return match[1];
  return "12";
}

/**
 * Parses any JSON structure (THPT 2026 format with exam_info & parts, standard app format, or raw question arrays)
 * into a fully-compatible Exam object.
 */
export function parseAnyExamJson(rawData: any, defaultFileName?: string): Exam | null {
  if (!rawData) return null;

  let data: any = rawData;
  if (typeof rawData === "string") {
    try {
      // Remove possible markdown code fences (```json ... ```)
      const cleaned = rawData.replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
      data = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse raw JSON string", e);
      return null;
    }
  }

  if (typeof data !== "object" || data === null) {
    return null;
  }

  // Case: Object with nested exam property (data.exam, data.data.exam, data.result, etc.)
  if (data.exam && typeof data.exam === "object") {
    return parseAnyExamJson(data.exam, defaultFileName);
  }
  if (data.data && typeof data.data === "object") {
    return parseAnyExamJson(data.data, defaultFileName);
  }
  if (data.result && typeof data.result === "object") {
    return parseAnyExamJson(data.result, defaultFileName);
  }

  // Case 1: 2026 Examination structure with exam_info & parts (or just parts)
  if (Array.isArray(data.parts)) {
    return parsePartsExamStructure(data, defaultFileName);
  }

  // Case 2: Root array of groups / passages / sections
  if (Array.isArray(data.groups) || Array.isArray(data.passages) || Array.isArray(data.sections) || Array.isArray(data.clusters)) {
    return parseGroupsExamStructure(data, defaultFileName);
  }

  // Case 3: Standard Exam format with top-level questions array
  if (Array.isArray(data.questions)) {
    return parseStandardQuestionsArray(data, defaultFileName);
  }

  // Case 4: Raw array of questions passed directly as root array
  if (Array.isArray(data)) {
    return parseStandardQuestionsArray({ questions: data }, defaultFileName);
  }

  return null;
}

/**
 * Parses format with `exam_info` and `parts` array
 */
function parsePartsExamStructure(data: any, defaultFileName?: string): Exam {
  const info = data.exam_info || data.info || data.header || {};
  
  // Parse time limit
  let timeLimit = 45;
  const rawDuration = info.duration || info.thoi_gian || info.time || data.durationMinutes || data.timeLimit || data.duration;
  if (rawDuration) {
    const match = String(rawDuration).match(/\d+/);
    if (match) timeLimit = parseInt(match[0], 10);
  }

  const rawTitle = info.title || info.name || info.ten_de || data.title || defaultFileName?.replace(/\.json$/i, "") || "Đề thi Tốt nghiệp THPT";
  const title = info.code ? `${rawTitle} - Mã đề: ${info.code}` : rawTitle;

  const subject = info.subject || info.mon_hoc || data.subject || inferSubject(`${title} ${JSON.stringify(data.parts?.[0] || {})}`);
  const grade = extractGrade(info.grade || info.khoi || data.grade, `${title} ${defaultFileName || ""}`);

  const allQuestions: Question[] = [];

  data.parts.forEach((part: any, partIdx: number) => {
    const partName = (part.part_name || part.name || part.title || "").toLowerCase();
    const partId = part.part_id || (partIdx + 1);
    const partContext = getFirstString(part, ["context", "loi_dan", "passage", "stimulus", "intro", "description", "ngu_lieu"]);

    // If part contains groups/passages
    if (Array.isArray(part.groups) || Array.isArray(part.passages) || Array.isArray(part.clusters) || Array.isArray(part.sections)) {
      const groups = part.groups || part.passages || part.clusters || part.sections || [];
      groups.forEach((grp: any) => {
        const grpContext = getFirstString(grp, ["context", "loi_dan", "passage", "stimulus", "intro", "description", "ngu_lieu", "text", "content"]) || partContext;
        const grpQuestions = grp.questions || grp.items || grp.cau_hoi || [];
        grpQuestions.forEach((q: any, qIdx: number) => {
          allQuestions.push(normalizeSingleQuestion(q, qIdx, partId, partName, grpContext));
        });
      });
      return;
    }

    const partQuestions = part.questions || part.items || part.cau_hoi || [];

    partQuestions.forEach((q: any, qIdx: number) => {
      // Check if question itself is a nested group containing child questions
      if (Array.isArray(q.questions) && q.questions.length > 0) {
        const parentContext = getFirstString(q, ["context", "loi_dan", "passage", "stimulus", "intro", "description", "ngu_lieu", "text", "content"]) || partContext;
        q.questions.forEach((subQ: any, subIdx: number) => {
          allQuestions.push(normalizeSingleQuestion(subQ, subIdx, partId, partName, parentContext));
        });
      } else {
        allQuestions.push(normalizeSingleQuestion(q, qIdx, partId, partName, partContext));
      }
    });
  });

  return {
    id: data.id || (info.code ? `exam-${info.code}` : `exam-${Math.random().toString(36).substr(2, 9)}`),
    title,
    subject,
    grade,
    timeLimit,
    questions: allQuestions,
    createdAt: data.createdAt || new Date().toISOString(),
    teacherId: data.teacherId || "guest",
    status: data.status || "draft"
  };
}

/**
 * Parses root `groups` or `passages` structure
 */
function parseGroupsExamStructure(data: any, defaultFileName?: string): Exam {
  const groups = data.groups || data.passages || data.sections || data.clusters || [];
  const title = data.title || defaultFileName?.replace(/\.json$/i, "") || "Đề thi";
  
  let timeLimit = 45;
  const rawDuration = data.durationMinutes || data.timeLimit || data.duration;
  if (rawDuration) {
    const match = String(rawDuration).match(/\d+/);
    if (match) timeLimit = parseInt(match[0], 10);
  }

  const allQuestions: Question[] = [];

  groups.forEach((grp: any, grpIdx: number) => {
    const grpContext = getFirstString(grp, ["context", "loi_dan", "passage", "stimulus", "intro", "description", "ngu_lieu", "title", "text"]);
    const questions = grp.questions || grp.items || grp.cau_hoi || [];
    questions.forEach((q: any, qIdx: number) => {
      allQuestions.push(normalizeSingleQuestion(q, qIdx, grpIdx + 1, grp.title || "", grpContext));
    });
  });

  const subject = data.subject || inferSubject(`${title} ${allQuestions[0]?.content || ""}`);
  const grade = extractGrade(data.grade, `${title} ${defaultFileName || ""}`);

  return {
    id: data.id || `exam-${Math.random().toString(36).substr(2, 9)}`,
    title,
    subject,
    grade,
    timeLimit,
    questions: allQuestions,
    createdAt: data.createdAt || new Date().toISOString(),
    teacherId: data.teacherId || "guest",
    status: data.status || "draft"
  };
}

/**
 * Parses array of questions or standard question format
 */
function parseStandardQuestionsArray(data: any, defaultFileName?: string): Exam {
  const rawQuestions = Array.isArray(data.questions) ? data.questions : (Array.isArray(data) ? data : []);
  const title = data.title || defaultFileName?.replace(/\.json$/i, "") || "Đề thi";
  const globalContext = getFirstString(data, ["context", "loi_dan", "passage", "intro", "stimulus", "description"]);

  const formattedQuestions: Question[] = [];

  rawQuestions.forEach((q: any, idx: number) => {
    // If the element is a container group of questions
    if (Array.isArray(q.questions) && q.questions.length > 0) {
      const parentContext = getFirstString(q, ["context", "loi_dan", "passage", "stimulus", "intro", "description", "ngu_lieu", "text", "content"]) || globalContext;
      q.questions.forEach((subQ: any, subIdx: number) => {
        formattedQuestions.push(normalizeSingleQuestion(subQ, subIdx, 1, "", parentContext));
      });
    } else {
      formattedQuestions.push(normalizeSingleQuestion(q, idx, 1, "", globalContext));
    }
  });

  // Calculate duration / time limit
  let timeLimit = 45;
  const rawDuration = data.durationMinutes || data.timeLimit || data.duration || data.thoi_gian;
  if (rawDuration) {
    const match = String(rawDuration).match(/\d+/);
    if (match) timeLimit = parseInt(match[0], 10);
  }

  // Infer subject if missing
  let subject = data.subject || "";
  if (!subject) {
    const sampleText = `${title} ${rawQuestions[0]?.chapterName || ""} ${formattedQuestions[0]?.content || ""}`;
    subject = inferSubject(sampleText);
  }

  const grade = extractGrade(data.grade, `${title} ${defaultFileName || ""}`);

  return {
    id: data.id || `exam-${Math.random().toString(36).substr(2, 9)}`,
    title,
    subject,
    grade,
    timeLimit,
    questions: formattedQuestions,
    createdAt: data.createdAt || new Date().toISOString(),
    teacherId: data.teacherId || "guest",
    status: data.status || "draft"
  };
}
