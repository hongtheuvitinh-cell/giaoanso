import { GoogleGenAI } from "@google/genai";
import { BGD_DIGITAL_FRAMEWORK } from "@/constants/framework";

export const generateLessonPlan = async (
  apiKey: string,
  topic: string, 
  grade: string, 
  duration: string, 
  referenceContent?: string, 
  customFramework?: string,
  pdfData?: { data: string, mimeType: string }
) => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
Hãy đóng vai một chuyên gia giáo dục và soạn một KẾ HOẠCH BÀI DẠY (Giáo án) chi tiết theo định dạng chuẩn của Bộ Giáo dục (Công văn 5512), bám sát chương trình GDPT 2018 và phong cách trình bày chuyên nghiệp như mẫu sách giáo khoa/sách giáo viên.

THÔNG TIN CHUNG:
- Tên bài học: ${topic}
- Lớp: ${grade}
- Thời lượng: ${duration}
${referenceContent ? `- Nội dung tham khảo: ${referenceContent}` : ""}

DƯỚI ĐÂY LÀ KHUNG NĂNG LỰC SỐ CHUẨN (BGD) MÀ BẠN PHẢI TUÂN THỦ VÀ TÍCH HỢP VÀO GIÁO ÁN:
${BGD_DIGITAL_FRAMEWORK}
${customFramework ? `\nYÊU CẦU BỔ SUNG VỀ KHUNG NĂNG LỰC VÀ YÊU CẦU RIÊNG CỦA GIÁO VIÊN:\n${customFramework}\n(LƯU Ý: Nếu giáo viên cung cấp các Năng lực đặc thù hoặc yêu cầu riêng ở đây, hãy ƯU TIÊN sử dụng và phân tích chi tiết các năng lực này vào mục I.1.a và xuyên suốt tiến trình dạy học).\n` : ""}

YÊU CẦU CẤU TRÚC CHI TIẾT:

I. MỤC TIÊU
1. Kiến thức: (Nêu cụ thể các kiến thức học sinh cần đạt dưới dạng gạch đầu dòng chi tiết).
2. Năng lực:
   a. Năng lực đặc thù môn học:
      - Nhận thức: (Nêu cụ thể các kiến thức, khái niệm học sinh cần đạt).
      - Tìm hiểu thế giới tự nhiên/xã hội: (Các hoạt động quan sát, thí nghiệm, điều tra, suy luận).
      - Vận dụng kiến thức, kĩ năng đã học: (Giải quyết vấn đề thực tiễn liên quan đến môn học).
   b. Năng lực chung: (Tự chủ, Giao tiếp, Hợp tác...).
3. Phẩm chất: (Trách nhiệm, trung thực, chăm chỉ...).
4. Năng lực số (Digital Competence): 
   - Phân tích và lồng ghép CHI TIẾT các mã năng lực số (ví dụ: 1.1NC1a, 2.1NC1b...) vào bài học.
   - Trình bày dưới dạng BẢNG: | Mã NLS | Hoạt động của học sinh để đạt năng lực |

II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU
- Thiết bị dạy học (Ghi rõ từng bộ dụng cụ, máy tính, máy chiếu...).
- Học liệu số (Link tham khảo, phần mềm, video, phiếu học tập số...).

III. TIẾN TRÌNH DẠY HỌC
Thiết kế theo 4 hoạt động: Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng.
Mỗi hoạt động PHẢI có cấu trúc sau:
a) Mục tiêu: (Nêu rõ mục tiêu của hoạt động).
b) Tổ chức thực hiện: TRÌNH BÀY DƯỚI DẠNG BẢNG gồm 2 cột: "Hoạt động của GV và HS" và "Sản phẩm".
Trong cột "Hoạt động của GV và HS", phải thể hiện rõ 4 bước:
- Bước 1: Chuyển giao nhiệm vụ (GV giao nhiệm vụ, nêu luật chơi, phát phiếu...).
- Bước 2: Thực hiện nhiệm vụ học tập (HS làm việc cá nhân/nhóm, GV hỗ trợ).
- Bước 3: Báo cáo kết quả và thảo luận (Đại diện báo cáo, các nhóm khác nhận xét).
- Bước 4: Đánh giá kết quả thực hiện nhiệm vụ (GV nhận xét, chốt kiến thức).

*Lưu ý: Trong các bước thực hiện, hãy ghi chú rõ các mã Năng lực số (NLS) được tích hợp.*

IV. HƯỚNG DẪN VỀ NHÀ

YÊU CẦU TRÌNH BÀY:
- Ngôn ngữ sư phạm chuẩn mực, trình bày Markdown sạch đẹp.
- Các bảng biểu phải rõ ràng.
- Nếu có file đính kèm, hãy trích xuất kiến thức chuyên môn từ đó để làm nội dung bài dạy.
`;

  const contents: any[] = [{ text: prompt }];
  if (pdfData) {
    contents.push({
      inlineData: {
        data: pdfData.data,
        mimeType: pdfData.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
  });

  return response.text;
};

export const integrateDigitalCompetency = async (
  apiKey: string,
  existingPlan: string,
  customRequirements?: string,
  pdfData?: { data: string, mimeType: string }
) => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
Hãy đóng vai một chuyên gia giáo dục và thực hiện việc LỒNG GHÉP NĂNG LỰC SỐ (Digital Competency) vào Kế hoạch bài dạy (KHBD) hiện có.

DƯỚI ĐÂY LÀ KHUNG NĂNG LỰC SỐ CHUẨN (BGD) MÀ BẠN PHẢI TUÂN THỦ VÀ TÍCH HỢP:
${BGD_DIGITAL_FRAMEWORK}

YÊU CẦU THỰC HIỆN:
1. Giữ nguyên cấu trúc và nội dung chuyên môn của KHBD cũ.
2. Tại mục I. MỤC TIÊU, hãy thêm mục "4. Năng lực số" và liệt kê các mã năng lực số phù hợp với bài học này. Trình bày dưới dạng bảng: | Mã NLS | Hoạt động của học sinh để đạt năng lực |.
3. Tại mục III. TIẾN TRÌNH DẠY HỌC:
   - Trong các bảng "Hoạt động của GV và HS" và "Sản phẩm", hãy THÊM MỘT CỘT MỚI mang tên "Năng lực số (NLS)" bên cạnh cột "Sản phẩm" (hoặc lồng ghép khéo léo vào cột Sản phẩm nếu bảng quá rộng).
   - Trong cột NLS này, hãy ghi rõ các mã năng lực số (ví dụ: 1.1NC1a) mà học sinh đạt được thông qua các bước thực hiện tương ứng.
4. Bổ sung thêm các Thiết bị dạy học và Học liệu số cần thiết vào mục II để hỗ trợ việc hình thành năng lực số.
5. ${customRequirements ? `YÊU CẦU RIÊNG CỦA GIÁO VIÊN: ${customRequirements}` : "Không có yêu cầu riêng."}

${existingPlan ? `KHBD CŨ CẦN LỒNG GHÉP:\n${existingPlan}` : "KHBD CŨ CẦN LỒNG GHÉP ĐƯỢC CUNG CẤP TRONG FILE ĐÍNH KÈM."}

YÊU CẦU TRÌNH BÀY:
- Trả về toàn bộ KHBD hoàn chỉnh (bao gồm cả phần cũ và phần đã lồng ghép NLS).
- Sử dụng Markdown chuẩn, bảng biểu rõ ràng.
- Ngôn ngữ sư phạm chuyên nghiệp.
`;

  const contents: any[] = [{ text: prompt }];
  if (pdfData) {
    contents.push({
      inlineData: {
        data: pdfData.data,
        mimeType: pdfData.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
  });

  return response.text;
};

export const generateExamPaper = async (
  apiKey: string,
  matrixData: string | null,
  notes: string,
  sourceFile?: { data: string, mimeType: string },
  matrixFile?: { data: string, mimeType: string }
) => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
Hãy đóng vai một giáo viên chuyên nghiệp và soạn một đề kiểm tra.

THÔNG TIN VỀ MA TRẬN ĐỀ:
${matrixFile ? "- Cấu trúc ma trận được cung cấp trong FILE ĐÍNH KÈM (Matrix File)." : `- Cấu trúc ma trận chi tiết: ${matrixData}`}

YÊU CẦU CẤU TRÚC ĐỀ THI (THEO CHUẨN BGD 2025):
- PHẦN I: 18 câu trắc nghiệm nhiều phương án lựa chọn (MC).
- PHẦN II: 4 câu trắc nghiệm đúng sai (TF). Mỗi câu có 4 ý (a, b, c, d).
- PHẦN III: 6 câu trắc nghiệm trả lời ngắn (SA).

YÊU CẦU CHI TIẾT:
1. Đề kiểm tra phải tuân thủ CHÍNH XÁC số lượng câu hỏi và mức độ (Biết, Hiểu, Vận dụng, Vận dụng cao) cho từng loại hình (Trắc nghiệm, Đúng-Sai, Trả lời ngắn, Tự luận) như trong ma trận được cung cấp.
2. Nội dung câu hỏi phải bám sát các chủ đề/chương, nội dung kiến thức và YÊU CẦU CẦN ĐẠT trong ma trận.
3. ${notes ? `LƯU Ý THÊM TỪ GIÁO VIÊN: ${notes}` : "Không có lưu ý thêm."}
4. NGUỒN CÂU HỎI: 
   ${sourceFile ? "- Sử dụng nội dung trong FILE ĐÍNH KÈM (Source File) làm nguồn câu hỏi chính." : "- Tự soạn câu hỏi dựa trên kiến thức chuẩn nếu không có file nguồn câu hỏi."}

YÊU CẦU ĐỊNH DẠNG ĐẦU RA (QUAN TRỌNG):
Bạn phải trả về dữ liệu dưới dạng JSON thuần túy (không có markdown code blocks) theo cấu trúc sau:
{
  "title": "Tên đề thi",
  "subject": "Môn học",
  "grade": "Lớp",
  "timeLimit": 45,
  "questions": [
    {
      "id": "string_unique_id",
      "type": "MC" | "TF" | "SA" | "ESSAY",
      "level": "know" | "understand" | "apply" | "highApply",
      "content": "Nội dung câu hỏi",
      "options": [ // Chỉ dành cho MC và TF
        { "id": "string", "text": "Nội dung phương án", "isCorrect": boolean }
      ],
      "correctAnswer": "string", // Dành cho SA
      "explanation": "Giải thích chi tiết và các bước giải cụ thể để học sinh hiểu tại sao đáp án đó là đúng",
      "points": number
    }
  ]
}

Lưu ý: 
- MC: Trắc nghiệm 4 lựa chọn. "options" phải có 4 phần tử với "id" lần lượt là "A", "B", "C", "D".
- TF: Trắc nghiệm Đúng/Sai theo định dạng mới. Một câu hỏi lớn có 4 ý (a, b, c, d). "options" phải chứa đúng 4 phần tử tương ứng với 4 ý này. "id" của các ý lần lượt là "a", "b", "c", "d". "text" là nội dung của ý đó và "isCorrect" là true nếu ý đó ĐÚNG, false nếu ý đó SAI.
- SA: Trả lời ngắn.
- ESSAY: Tự luận.
`;

  const contents: any[] = [{ text: prompt }];
  
  if (matrixFile) {
    contents.push({
      inlineData: {
        data: matrixFile.data,
        mimeType: matrixFile.mimeType
      }
    });
  }

  if (sourceFile) {
    contents.push({
      inlineData: {
        data: sourceFile.data,
        mimeType: sourceFile.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
    // @ts-ignore
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  return response.text;
};

export const parseExistingExam = async (
  apiKey: string,
  notes: string,
  sourceFile?: { data: string, mimeType: string }
) => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
Hãy đóng vai một chuyên gia số hóa học liệu cực kỳ cẩn thận. Nhiệm vụ của bạn là chuyển đổi TOÀN BỘ một đề kiểm tra hiện có (từ file đính kèm) thành định dạng JSON để sử dụng trên hệ thống thi trực tuyến.

YÊU CẦU CẤU TRÚC ĐỀ THI (THEO CHUẨN BGD 2025):
- PHẦN I: Câu trắc nghiệm nhiều phương án lựa chọn (MC). Thường có 18 câu. Mỗi câu 0.25 điểm.
- PHẦN II: Câu trắc nghiệm đúng sai (TF). Thường có 4 câu. Mỗi câu có 4 ý (a, b, c, d). Cách tính điểm: Đúng 1 ý được 0.1đ, đúng 2 ý được 0.25đ, đúng 3 ý được 0.5đ, đúng 4 ý được 1.0đ.
- PHẦN III: Câu trắc nghiệm trả lời ngắn (SA). Thường có 6 câu. Mỗi câu 0.25đ.

YÊU CẦU QUAN TRỌNG NHẤT:
- KHÔNG ĐƯỢC BỎ SÓT bất kỳ câu hỏi nào có trong file. 
- Nếu đề thi có nhiều phần (Trắc nghiệm, Tự luận, Đúng/Sai...), bạn phải trích xuất ĐẦY ĐỦ tất cả các phần đó.
- Đảm bảo tính toàn vẹn của nội dung câu hỏi và các phương án lựa chọn.

YÊU CẦU CHI TIẾT:
1. Phân tích file đính kèm để trích xuất TOÀN BỘ danh sách câu hỏi.
2. Xác định loại câu hỏi cho từng câu:
   - MC: Trắc nghiệm 4 lựa chọn (A, B, C, D).
   - TF: Trắc nghiệm Đúng/Sai (thường có 4 ý a, b, c, d).
   - SA: Trả lời ngắn.
   - ESSAY: Tự luận.
3. Xác định mức độ (know, understand, apply, highApply) dựa trên nội dung câu hỏi.
4. ${notes ? `LƯU Ý THÊM TỪ GIÁO VIÊN: ${notes}` : ""}

YÊU CẦU ĐỊNH DẠNG ĐẦU RA (QUAN TRỌNG):
Bạn phải trả về dữ liệu dưới dạng JSON thuần túy (không có markdown code blocks) theo cấu trúc sau:
{
  "title": "Tên đề thi (trích xuất từ file hoặc tự đặt nếu không có)",
  "subject": "Môn học",
  "grade": "Lớp",
  "timeLimit": 45,
  "questions": [
    {
      "id": "string_unique_id",
      "type": "MC" | "TF" | "SA" | "ESSAY",
      "level": "know" | "understand" | "apply" | "highApply",
      "content": "Nội dung câu hỏi",
      "options": [ // Chỉ dành cho MC và TF
        { "id": "string", "text": "Nội dung phương án", "isCorrect": boolean }
      ],
      "correctAnswer": "string", // Dành cho SA
      "explanation": "Giải thích chi tiết và các bước giải cụ thể (BẮT BUỘC PHẢI CÓ để học sinh luyện tập)",
      "points": number
    }
  ]
}

Lưu ý về ID của options:
- MC: id phải là "A", "B", "C", "D".
- TF: id phải là "a", "b", "c", "d".
`;

  const contents: any[] = [{ text: prompt }];
  
  if (sourceFile) {
    contents.push({
      inlineData: {
        data: sourceFile.data,
        mimeType: sourceFile.mimeType
      }
    });
  } else {
    throw new Error("Cần cung cấp file nguồn để chuyển đổi.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
    // @ts-ignore
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  return response.text;
};
