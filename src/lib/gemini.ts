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
Hãy đóng vai một chuyên gia khảo thí. Nhiệm vụ của bạn là soạn một đề kiểm tra hoàn chỉnh bám sát cấu trúc của Bộ Giáo dục (chuẩn 2025).

THÔNG TIN MA TRẬN ĐỀ (JSON):
${matrixFile ? "Cấu trúc ma trận được cung cấp trong FILE ĐÍNH KÈM." : matrixData}

YÊU CẦU QUAN TRỌNG VỀ ĐỌC MA TRẬN:
1. Bạn phải soạn đề bám sát HOÀN TOÀN vào ma trận dữ liệu JSON ở trên. 
2. Cách tính số lượng câu hỏi:
   - mc (Trắc nghiệm Lựa chọn): Mỗi đơn vị là 1 câu hỏi (Phần I).
   - tf (Trắc nghiệm Đúng - Sai): Mỗi đơn vị là 1 Ý (mệnh đề). CỨ 4 Ý SẼ GỘP THÀNH 1 CÂU HỎI LỚN (Phần II). Các ý trong cùng một câu hỏi lớn có thể có cấp độ (B, H, V, VC) khác nhau tùy theo ma trận.
     - Ví dụ: Nếu ma trận yêu cầu 2 ý B, 1 ý H, 1 ý V cho TF -> AI tạo 1 câu hỏi TF có 4 ý a,b,c,d (với a,b mức Biết; c mức Hiểu; d mức Vận dụng).
   - sa (Trả lời ngắn): Mỗi đơn vị là 1 câu hỏi (Phần III).
3. Nội dung phải tương ứng với 'chapter' và 'requirements' trong ma trận.
4. ${notes ? `Lưu ý đặc biệt: ${notes}` : ""}
5. Nguồn nội dung: ${sourceFile ? "Sử dụng file đính kèm làm nguồn câu hỏi chính." : "Tự soạn câu hỏi chuẩn kiến thức."}

YÊU CẦU LaTeX (BẮT BUỘC):
- TẤT CẢ công thức, kí hiệu (x, y, ρ, Δt, ...), biểu thức số học PHẢI viết bằng LaTeX và bao quanh bởi dấu $ (ví dụ: $x^2$, $\Delta t$, $\rho_1$).
- Kí hiệu tích phải dùng \cdot (không dùng *). Phân số dùng \frac (không dùng /).
- Mọi biến số đơn lẻ (x, y, n, m) đều phải nằm trong $.

YÊU CẦU ĐỊNH DẠNG ĐẦU RA (JSON THUẦN TÚY):
{
  "title": "Tên đề thi",
  "subject": "Môn học",
  "grade": "Lớp",
  "timeLimit": 45,
  "questions": [
    {
      "id": "q1",
      "type": "MC",
      "level": "know",
      "content": "Câu hỏi trắc nghiệm...",
      "options": [
        { "id": "A", "text": "...", "isCorrect": true },
        { "id": "B", "text": "...", "isCorrect": false },
        { "id": "C", "text": "...", "isCorrect": false },
        { "id": "D", "text": "...", "isCorrect": false }
      ],
      "explanation": "Giải thích chi tiết",
      "points": 0.25
    },
    {
      "id": "q2",
      "type": "TF",
      "level": "understand",
      "content": "Câu hỏi đúng sai: Cho... Phát biểu sau đúng hay sai?",
      "options": [
        { "id": "a", "text": "Ý thứ nhất...", "isCorrect": true },
        { "id": "b", "text": "Ý thứ hai...", "isCorrect": false },
        { "id": "c", "text": "Ý thứ ba...", "isCorrect": true },
        { "id": "d", "text": "Ý thứ tư...", "isCorrect": false }
      ],
      "explanation": "Giải thích cho từng ý a, b, c, d...",
      "points": 1.0
    },
    {
      "id": "q3",
      "type": "SA",
      "level": "apply",
      "content": "Câu hỏi trả lời ngắn: Tính...",
      "correctAnswer": "12,5",
      "explanation": "Các bước giải chi tiết...",
      "points": 0.25
    }
  ]
}
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
    config: {
      responseMimeType: "application/json"
    }
  });

  return response.text;
};

export const parseExistingExam = async (
  apiKey: string,
  notes: string,
  sourceFile?: { data: string, mimeType: string },
  sourceText?: string
) => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
Hãy đóng vai một chuyên gia số hóa học liệu. Nhiệm vụ của bạn là chuyển đổi TOÀN BỘ đề thi (từ file/văn bản) thành định dạng JSON chuẩn.

${sourceText ? `VĂN BẢN ĐỀ THI CẦN CHUYỂN ĐỔI:\n${sourceText}\n` : ""}

YÊU CẦU QUAN TRỌNG:
1. TRÍCH XUẤT ĐỦ số lượng thực tế có trong tài liệu. Không tự ý thêm bớt.
2. LATEX TUYỆT ĐỐI cho công thức: Dùng $...$. Ví dụ: $\rho$, $3 \cdot 10^8$, $\frac{p_2 T_1}{p_1 T_2}$. Mọi biến số x, y, n, m đều phải nằm trong $.
3. JSON PHẢI CHUẨN: Không có văn bản thừa, không markdown blocks. Trả về JSON theo cấu trúc dưới đây.

CẤU TRÚC JSON:
{
  "title": "Tên đề thi (trích xuất hoặc tự đặt)",
  "subject": "Môn học",
  "grade": "Lớp",
  "timeLimit": 45,
  "questions": [
    {
      "id": "string",
      "type": "MC" | "TF" | "SA" | "ESSAY",
      "level": "know" | "understand" | "apply" | "highApply",
      "content": "Nội dung câu hỏi (chứa LaTeX nếu có)",
      "options": [ 
        { "id": "A/B/C/D hoặc a/b/c/d", "text": "...", "isCorrect": boolean } 
      ],
      "correctAnswer": "...",
      "explanation": "Giải thích chi tiết giải thuật - BẮT BUỘC",
      "points": 0.25
    }
  ]
}

LƯU Ý: 
- Với MC: id options là A, B, C, D.
- Với TF: id options là a, b, c, d. Mỗi câu TF PHẢI có đủ 4 ý (a, b, c, d).
- ${notes ? `Ghi chú từ GV: ${notes}` : ""}
`;

  const contents: any[] = [{ text: prompt }];
  
  if (sourceFile) {
    contents.push({
      inlineData: {
        data: sourceFile.data,
        mimeType: sourceFile.mimeType
      }
    });
  } else if (!sourceText) {
    throw new Error("Cần cung cấp file nguồn hoặc văn bản đề thi để chuyển đổi.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json"
    }
  });

  return response.text;
};
