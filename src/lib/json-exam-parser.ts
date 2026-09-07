import { Exam, Question, QuestionLevel, QuestionOption, QuestionType } from "@/types";

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

  // Case 1: Standard Exam format with top-level questions array
  if (Array.isArray(data.questions) && !data.parts) {
    return parseStandardQuestionsArray(data, defaultFileName);
  }

  // Case 2: New 2026 Examination structure with exam_info & parts (or just parts)
  if (Array.isArray(data.parts)) {
    return parsePartsExamStructure(data, defaultFileName);
  }

  // Case 3: Raw array of questions passed directly as root array
  if (Array.isArray(data)) {
    return parseStandardQuestionsArray({ questions: data }, defaultFileName);
  }

  // Case 4: Object with nested exam property
  if (data.exam && (Array.isArray(data.exam.parts) || Array.isArray(data.exam.questions))) {
    return parseAnyExamJson(data.exam, defaultFileName);
  }

  return null;
}

function cleanHtmlLineBreaks(str: string): string {
  if (!str) return "";
  return String(str).replace(/<br\s*[\/]?>/gi, "\n\n");
}

function mapQuestionType(rawType: any, q?: any): QuestionType {
  const t = String(rawType || "").toLowerCase().trim();
  if (t === "mcq" || t === "mc" || t === "multiple_choice" || t === "part1") return "MC";
  if (t === "group-tf" || t === "group_tf" || t === "tf" || t === "true_false" || t === "true-false" || t === "part2") return "TF";
  if (t === "short" || t === "sa" || t === "short_answer" || t === "short-answer" || t === "part3") return "SA";
  if (t === "essay" || t === "tu_luan" || t === "part4") return "ESSAY";

  // Heuristic based on question fields
  if (q) {
    if (Array.isArray(q.subQuestions) || Array.isArray(q.sub_questions)) return "TF";
    if (Array.isArray(q.options) && q.options.length > 0) return "MC";
    if (q.correctAnswer && !q.options) return "SA";
  }

  return "MC";
}

function mapQuestionLevel(rawLevel: any): QuestionLevel {
  const l = String(rawLevel || "").toUpperCase().trim();
  if (["B", "NB", "KNOW", "NHẬN BIẾT", "NHAN BIET", "1"].includes(l)) return "know";
  if (["H", "TH", "UNDERSTAND", "THÔNG HIỂU", "THONG HIEU", "2"].includes(l)) return "understand";
  if (["VD", "APPLY", "VẬN DỤNG", "VAN DUNG", "3"].includes(l)) return "apply";
  if (["VDC", "HIGHAPPLY", "HIGH_APPLY", "VẬN DỤNG CAO", "VAN DUNG CAO", "4"].includes(l)) return "highApply";

  const lower = String(rawLevel || "").toLowerCase().trim();
  if (["know", "understand", "apply", "highapply"].includes(lower)) {
    return lower === "highapply" ? "highApply" : (lower as QuestionLevel);
  }
  return "understand";
}

function extractContent(q: any): string {
  const main = q.text || q.content || q.question || q.stem || "";
  const context = q.context || "";
  if (context && main && context.trim() !== main.trim()) {
    return cleanHtmlLineBreaks(`${context.trim()}\n\n${main.trim()}`);
  }
  return cleanHtmlLineBreaks(main || context || "");
}

function parseMcOptions(q: any): QuestionOption[] {
  const rawCorrect = String(q.correctAnswer || q.correct_answer || q.answer || "").trim();
  const rawUpper = rawCorrect.toUpperCase();

  const stripPrefix = (str: string) => str.replace(/^[A-Da-d][\.\:\)\s]\s*/, "").trim();

  if (Array.isArray(q.options)) {
    return q.options.map((opt: any, idx: number) => {
      const letter = (typeof opt === "object" && opt.id ? opt.id : String.fromCharCode(65 + idx)).toUpperCase();
      const rawText = typeof opt === "string" ? opt : (opt.text || opt.content || "");
      const text = stripPrefix(rawText);

      let isCorrect = false;
      if (typeof opt === "object" && typeof opt.isCorrect === "boolean") {
        isCorrect = opt.isCorrect;
      } else {
        if (rawUpper === letter) {
          isCorrect = true;
        } else if (rawCorrect && (
          rawCorrect.trim() === rawText.trim() || 
          rawCorrect.trim() === text.trim() || 
          stripPrefix(rawCorrect) === text
        )) {
          isCorrect = true;
        }
      }

      return {
        id: letter,
        text: cleanHtmlLineBreaks(text),
        isCorrect
      };
    });
  } else if (q.options && typeof q.options === "object") {
    return Object.entries(q.options).map(([key, val]) => {
      const letter = key.toUpperCase();
      const rawText = String(val);
      const text = stripPrefix(rawText);
      const isCorrect = (rawUpper === letter) || (rawCorrect === rawText.trim()) || (rawCorrect === text.trim());
      return {
        id: letter,
        text: cleanHtmlLineBreaks(text),
        isCorrect
      };
    });
  }

  return [];
}

function parseTfOptions(q: any): QuestionOption[] {
  const subList = q.subQuestions || q.sub_questions || q.options || [];
  if (Array.isArray(subList)) {
    return subList.map((sq: any, sIdx: number) => {
      const label = (sq.sub_label || sq.label || sq.id || String.fromCharCode(97 + sIdx)).toLowerCase();
      const rawAns = sq.correctAnswer !== undefined ? sq.correctAnswer : 
                    (sq.correct_answer !== undefined ? sq.correct_answer : sq.isCorrect);
      
      let isCorrect = false;
      if (typeof rawAns === "boolean") {
        isCorrect = rawAns;
      } else {
        const strAns = String(rawAns || "").toLowerCase().trim();
        isCorrect = strAns === "true" || strAns === "t" || strAns === "1" || 
                    strAns.includes("đúng") || strAns === "dung" || strAns === "d";
      }

      const text = cleanHtmlLineBreaks(sq.text || sq.content || sq.question || "");
      return {
        id: label,
        text,
        isCorrect
      };
    });
  }
  return [];
}

/**
 * Parses new format with `exam_info` and `parts` array
 */
function parsePartsExamStructure(data: any, defaultFileName?: string): Exam {
  const info = data.exam_info || {};
  
  // Parse time limit
  let timeLimit = 45;
  if (info.duration) {
    const match = String(info.duration).match(/\d+/);
    if (match) timeLimit = parseInt(match[0], 10);
  } else if (data.durationMinutes) {
    timeLimit = Number(data.durationMinutes) || 45;
  } else if (data.timeLimit) {
    timeLimit = Number(data.timeLimit) || 45;
  }

  const title = info.title 
    ? (info.code ? `${info.title} - Mã đề: ${info.code}` : info.title)
    : (data.title || defaultFileName?.replace(/\.json$/i, "") || "Đề thi Tốt nghiệp THPT");

  const subject = info.subject || data.subject || "Vật Lý";
  const grade = info.grade || data.grade || "12";

  const allQuestions: Question[] = [];

  data.parts.forEach((part: any, partIdx: number) => {
    const partQuestions = part.questions || [];
    const partName = (part.part_name || "").toLowerCase();
    const partId = part.part_id || (partIdx + 1);

    partQuestions.forEach((q: any, qIdx: number) => {
      const qnum = q.qnum || (qIdx + 1);
      const qtypeRaw = String(q.qtype || q.type || "").toLowerCase();

      // Determine question type: MC (part 1), TF (part 2), SA (part 3), ESSAY (part 4)
      let type: QuestionType = "MC";
      if (qtypeRaw === "part1" || qtypeRaw === "mc" || qtypeRaw === "mcq" || partId === 1 || partName.includes("nhiều lựa chọn") || partName.includes("phần i") || partName.includes("trắc nghiệm")) {
        type = "MC";
      }
      if (qtypeRaw === "part2" || qtypeRaw === "tf" || qtypeRaw === "group-tf" || partId === 2 || partName.includes("đúng/sai") || partName.includes("đúng sai") || partName.includes("phần ii") || q.sub_questions || q.subQuestions) {
        type = "TF";
      }
      if (qtypeRaw === "part3" || qtypeRaw === "sa" || qtypeRaw === "short" || partId === 3 || partName.includes("ngắn") || partName.includes("trả lời ngắn") || partName.includes("phần iii")) {
        type = "SA";
      }
      if (qtypeRaw === "essay" || partName.includes("tự luận")) {
        type = "ESSAY";
      }

      // Determine level
      let level = mapQuestionLevel(q.level);
      if (!q.level) {
        if (type === "MC") {
          if (qIdx < 6) level = "know";
          else if (qIdx < 14) level = "understand";
          else level = "apply";
        } else if (type === "TF") {
          if (qIdx < 2) level = "understand";
          else if (qIdx === 2) level = "apply";
          else level = "highApply";
        } else if (type === "SA") {
          if (qIdx < 2) level = "apply";
          else level = "highApply";
        }
      }

      // Format question content
      let content = extractContent(q);
      if (type === "SA" && q.unit && !content.includes(q.unit)) {
        content += ` *(Đơn vị: ${q.unit})*`;
      }

      // Format options
      let options: QuestionOption[] | undefined = undefined;
      if (type === "MC") {
        options = parseMcOptions(q);
      } else if (type === "TF") {
        options = parseTfOptions(q);
      }

      // Correct answer for SA
      let correctAnswer: string | undefined = undefined;
      if (type === "SA") {
        correctAnswer = String(q.correct_answer || q.correctAnswer || q.answer || "").trim();
      }

      // Explanation
      const explanation = cleanHtmlLineBreaks(q.explanation || q.solution || q.guide || "");

      // Points
      let points = q.points !== undefined && !isNaN(Number(q.points)) 
        ? Number(q.points) 
        : (type === "MC" ? 0.25 : type === "TF" ? 1.0 : type === "SA" ? 0.25 : 1.0);

      allQuestions.push({
        id: q.id || `q-p${partId}-${qnum}-${Math.random().toString(36).substr(2, 5)}`,
        type,
        level,
        content: content.trim(),
        imageUrl: q.imageUrl || q.image_url || q.image || "",
        options,
        correctAnswer,
        explanation,
        points
      });
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
 * Parses array of questions or standard question format
 */
function parseStandardQuestionsArray(data: any, defaultFileName?: string): Exam {
  const rawQuestions = Array.isArray(data.questions) ? data.questions : (Array.isArray(data) ? data : []);
  
  const formattedQuestions: Question[] = rawQuestions.map((q: any, idx: number) => {
    const type = mapQuestionType(q.type || q.qtype, q);
    const level = mapQuestionLevel(q.level);
    const content = extractContent(q);

    let options: QuestionOption[] | undefined = undefined;
    if (type === "MC") {
      options = parseMcOptions(q);
    } else if (type === "TF") {
      options = parseTfOptions(q);
    }

    let correctAnswer: string | undefined = undefined;
    if (type === "SA") {
      correctAnswer = String(q.correctAnswer || q.correct_answer || q.answer || "").trim();
    } else if (type === "MC") {
      const correctOpt = options?.find(o => o.isCorrect);
      correctAnswer = correctOpt ? correctOpt.id : String(q.correctAnswer || q.correct_answer || "").trim();
    }

    const explanation = cleanHtmlLineBreaks(q.solution || q.explanation || q.guide || "");
    const imageUrl = q.imageUrl || q.image_url || q.image || "";
    const points = q.points !== undefined && !isNaN(Number(q.points)) 
      ? Number(q.points) 
      : (type === "MC" ? 0.25 : type === "TF" ? 1.0 : type === "SA" ? 0.25 : 1.0);

    return {
      id: q.id || `q-${idx + 1}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      level,
      content,
      imageUrl,
      options,
      correctAnswer,
      explanation,
      points
    };
  });

  // Calculate duration / time limit
  let timeLimit = 45;
  if (data.durationMinutes) {
    timeLimit = Number(data.durationMinutes) || 45;
  } else if (data.timeLimit) {
    timeLimit = Number(data.timeLimit) || 45;
  } else if (data.duration) {
    const match = String(data.duration).match(/\d+/);
    if (match) timeLimit = parseInt(match[0], 10);
  }

  // Infer subject if missing
  let subject = data.subject || "";
  if (!subject) {
    const sampleText = `${data.title || ""} ${rawQuestions[0]?.chapterName || ""} ${rawQuestions[0]?.text || rawQuestions[0]?.content || ""}`.toLowerCase();
    if (sampleText.includes("chuyển động") || sampleText.includes("vận tốc") || sampleText.includes("gia tốc") || sampleText.includes("vật lý") || sampleText.includes("vật lí") || sampleText.includes("lực")) {
      subject = "Vật Lý";
    } else if (sampleText.includes("hóa học") || sampleText.includes("phản ứng") || sampleText.includes("axit") || sampleText.includes("nguyên tố")) {
      subject = "Hóa Học";
    } else if (sampleText.includes("toán") || sampleText.includes("đạo hàm") || sampleText.includes("tích phân") || sampleText.includes("hình học")) {
      subject = "Toán Học";
    } else if (sampleText.includes("sinh học") || sampleText.includes("tế bào") || sampleText.includes("di truyền")) {
      subject = "Sinh Học";
    } else {
      subject = "Vật Lý";
    }
  }

  return {
    id: data.id || `exam-${Math.random().toString(36).substr(2, 9)}`,
    title: data.title || defaultFileName?.replace(/\.json$/i, "") || "Đề thi",
    subject,
    grade: String(data.grade || "12"),
    timeLimit,
    questions: formattedQuestions,
    createdAt: data.createdAt || new Date().toISOString(),
    teacherId: data.teacherId || "guest",
    status: data.status || "draft"
  };
}
