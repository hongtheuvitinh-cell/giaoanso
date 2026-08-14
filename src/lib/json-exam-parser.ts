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
      if (qtypeRaw === "part1" || qtypeRaw === "mc" || partId === 1 || partName.includes("nhiều lựa chọn") || partName.includes("phần i") || partName.includes("trắc nghiệm")) {
        type = "MC";
      }
      if (qtypeRaw === "part2" || qtypeRaw === "tf" || partId === 2 || partName.includes("đúng/sai") || partName.includes("đúng sai") || partName.includes("phần ii") || q.sub_questions) {
        type = "TF";
      }
      if (qtypeRaw === "part3" || qtypeRaw === "sa" || partId === 3 || partName.includes("ngắn") || partName.includes("trả lời ngắn") || partName.includes("phần iii")) {
        type = "SA";
      }
      if (qtypeRaw === "essay" || partName.includes("tự luận")) {
        type = "ESSAY";
      }

      // Determine level
      let level: QuestionLevel = "understand";
      if (q.level && ["know", "understand", "apply", "highApply"].includes(q.level)) {
        level = q.level as QuestionLevel;
      } else {
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
      let content = "";
      if (type === "MC") {
        content = q.question || q.content || q.stem || "";
      } else if (type === "TF") {
        content = q.context || q.question || q.content || q.stem || "";
      } else if (type === "SA") {
        if (q.context && q.question && q.context.trim() !== q.question.trim()) {
          content = `${q.context.trim()}\n\n**Câu hỏi:** ${q.question.trim()}`;
        } else {
          content = q.question || q.context || q.content || "";
        }
        if (q.unit && !content.includes(q.unit)) {
          content += ` *(Đơn vị: ${q.unit})*`;
        }
      } else {
        content = q.question || q.content || "";
      }

      // Format options
      let options: QuestionOption[] | undefined = undefined;

      if (type === "MC") {
        const correctAns = String(q.correct_answer || q.correctAnswer || q.answer || "").trim().toUpperCase();
        if (q.options && typeof q.options === "object" && !Array.isArray(q.options)) {
          // Object format: { "A": "...", "B": "..." }
          options = Object.entries(q.options).map(([key, val]) => ({
            id: key.toUpperCase(),
            text: String(val),
            isCorrect: correctAns === key.toUpperCase()
          }));
        } else if (Array.isArray(q.options)) {
          options = q.options.map((opt: any, optIdx: number) => {
            const letter = (opt.id || String.fromCharCode(65 + optIdx)).toUpperCase();
            const text = typeof opt === "string" ? opt : (opt.text || opt.content || "");
            const isCorrect = typeof opt === "object" && typeof opt.isCorrect === "boolean" 
              ? opt.isCorrect 
              : (correctAns === letter);
            return { id: letter, text, isCorrect };
          });
        }
      } else if (type === "TF") {
        const subList = q.sub_questions || q.subQuestions || q.options || [];
        if (Array.isArray(subList)) {
          options = subList.map((sq: any, sIdx: number) => {
            const label = (sq.sub_label || sq.label || sq.id || String.fromCharCode(97 + sIdx)).toLowerCase();
            const rawAns = sq.correct_answer !== undefined ? sq.correct_answer : (sq.correctAnswer !== undefined ? sq.correctAnswer : sq.isCorrect);
            let isCorrect = false;
            if (typeof rawAns === "boolean") {
              isCorrect = rawAns;
            } else {
              const strAns = String(rawAns || "").toLowerCase().trim();
              isCorrect = strAns.includes("đúng") || strAns === "true" || strAns === "t" || strAns === "d" || strAns === "1";
            }
            return {
              id: label,
              text: sq.text || sq.content || sq.question || "",
              isCorrect
            };
          });
        }
      }

      // Correct answer for SA
      let correctAnswer: string | undefined = undefined;
      if (type === "SA") {
        correctAnswer = String(q.correct_answer || q.correctAnswer || q.answer || "").trim();
      }

      // Explanation
      const explanation = q.explanation || q.solution || q.guide || "";

      // Points
      let points = q.points !== undefined ? Number(q.points) : (type === "MC" ? 0.25 : type === "TF" ? 1.0 : type === "SA" ? 0.25 : 1.0);

      allQuestions.push({
        id: q.id || `q-p${partId}-${qnum}-${Math.random().toString(36).substr(2, 5)}`,
        type,
        level,
        content: content.trim(),
        imageUrl: q.imageUrl || q.image_url || "",
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
    let type: QuestionType = (q.type || "MC").toUpperCase() as QuestionType;
    if (q.qtype === "part1") type = "MC";
    if (q.qtype === "part2" || q.sub_questions) type = "TF";
    if (q.qtype === "part3") type = "SA";

    let level: QuestionLevel = "understand";
    if (q.level && ["know", "understand", "apply", "highApply"].includes(q.level)) {
      level = q.level as QuestionLevel;
    }

    let content = q.content || q.question || q.stem || "";
    if (q.context && q.question && q.context !== q.question) {
      content = `${q.context}\n\n${q.question}`;
    }

    let options = q.options;
    if (type === "MC" && q.options && typeof q.options === "object" && !Array.isArray(q.options)) {
      const correctAns = String(q.correct_answer || q.correctAnswer || "").trim().toUpperCase();
      options = Object.entries(q.options).map(([key, val]) => ({
        id: key.toUpperCase(),
        text: String(val),
        isCorrect: correctAns === key.toUpperCase()
      }));
    } else if (type === "TF" && q.sub_questions && Array.isArray(q.sub_questions)) {
      options = q.sub_questions.map((sq: any, sIdx: number) => {
        const label = (sq.sub_label || sq.id || String.fromCharCode(97 + sIdx)).toLowerCase();
        const rawAns = sq.correct_answer !== undefined ? sq.correct_answer : sq.isCorrect;
        const isCorrect = typeof rawAns === "boolean" ? rawAns : String(rawAns || "").toLowerCase().includes("đúng");
        return {
          id: label,
          text: sq.text || sq.content || "",
          isCorrect
        };
      });
    }

    return {
      id: q.id || `q-${idx + 1}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      level,
      content,
      imageUrl: q.imageUrl || q.image_url || "",
      options,
      correctAnswer: q.correctAnswer || q.correct_answer || q.answer,
      explanation: q.explanation || q.solution || "",
      points: q.points !== undefined ? Number(q.points) : (type === "MC" ? 0.25 : type === "TF" ? 1.0 : 0.25)
    };
  });

  return {
    id: data.id || `exam-${Math.random().toString(36).substr(2, 9)}`,
    title: data.title || defaultFileName?.replace(/\.json$/i, "") || "Đề thi",
    subject: data.subject || "Vật Lý",
    grade: data.grade || "12",
    timeLimit: Number(data.timeLimit) || 45,
    questions: formattedQuestions,
    createdAt: data.createdAt || new Date().toISOString(),
    teacherId: data.teacherId || "guest",
    status: data.status || "draft"
  };
}
