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

THÔNG TIN MA TRẬN ĐỀ (JSON):
${matrixFile ? "Cấu trúc ma trận được cung cấp trong FILE ĐÍNH KÈM." : matrixData}

YÊU CẦU QUAN TRỌNG VỀ CƠ CHẾ ĐỌC MA TRẬN (DỮ LIỆU JSON):
1. Bạn phải soạn đề thi bám sát HOÀN TOÀN vào ma trận dữ liệu JSON ở trên. 
2. Cách tính số lượng câu hỏi:
   - Đối với trắc nghiệm Lựa chọn (đối tượng 'mc' trong JSON): Mỗi đơn vị là 1 câu hỏi (Part I).
   - Đối với trắc nghiệm Đúng - Sai (đối tượng 'tf' trong JSON): Mỗi đơn vị là 1 Ý (mệnh đề), không phải 1 câu. Cứ mỗi 4 ý sẽ được gộp thành một CÂU HỎI LỚN trong Phần II (Phần II - 4 câu, tổng 16 ý).
     - Ví dụ: Nếu tổng thuộc tính 'tf' của tất cả các dòng trong ma trận là 16 ý -> Bạn phải tạo ra đúng 4 câu hỏi lớn cho Phần II, mỗi câu có 4 ý a, b, c, d với độ khó tương ứng.
   - Đối với Trả lời ngắn (đối tượng 'sa' trong JSON): Mỗi đơn vị là 1 câu hỏi (Part III).
3. Nội dung câu hỏi phải tương ứng với 'chapter' và 'requirements' của các dòng trong ma trận.
4. ${notes ? `Lưu ý thêm: ${notes}` : ""}
5. Nguồn nội dung: ${sourceFile ? "Sử dụng file đính kèm làm nguồn câu hỏi chính." : "Tự soạn câu hỏi dựa trên kiến thức chuẩn."}

YÊU CẦU CẤU TRÚC ĐỀ (BGD 2025 - THAM KHẢO):
- Cấu trúc chuẩn thường gồm: PHẦN I (18 câu MC), PHẦN II (4 câu TF - 16 ý), PHẦN III (6 câu SA).
- TUYÊN BỐ QUAN TRỌNG: Bạn PHẢI ưu tiên số lượng câu hỏi từ ma trận đã cung cấp. Nếu ma trận yêu cầu ít hơn hoặc nhiều hơn số lượng chuẩn (ví dụ chỉ có 12 câu MC), bạn phải soạn ĐÚNG số lượng đó, không được tự ý thêm cho đủ 18.
- Thứ tự câu hỏi trong đề: Xếp theo Part I (MC) -> Part II (TF) -> Part III (SA) -> Part IV (ESSAY nếu có). Đánh số câu liên tục từ 1 đến hết đề.

YÊU CẦU ĐỊNH DẠNG ĐẦU RA:
Trả về JSON thuần túy (không có giải thích, không có markdown code blocks) theo cấu trúc:
{
  "title": "Tên đề thi",
  "subject": "Môn học",
  "grade": "Lớp",
  "timeLimit": 45,
  "questions": [
    {
      "id": "string",
      "type": "MC" | "TF" | "SA" | "ESSAY",
      "level": "know" | "understand" | "apply" | "highApply",
      "content": "Nội dung câu hỏi",
      "options": [ // Chỉ cho MC và TF. MC: 4 lựa chọn A, B, C, D. TF: 4 ý a, b, c, d.
        { "id": "string", "text": "Nội dung", "isCorrect": boolean }
      ],
      "correctAnswer": "string", // Chỉ cho SA
      "explanation": "Giải thích chi tiết",
      "points": number
    }
  ]
}

YÊU CẦU LaTeX:
Mọi công thức, kí hiệu toán học/vật lý phải để trong $...$ (ví dụ: $x^2$, $\Delta t$). Không dùng kí hiệu văn bản hay kí hiệu lập trình (*, /, ^).
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
Hãy đóng vai một chuyên gia số hóa học liệu cực kỳ cẩn thận. Nhiệm vụ của bạn là chuyển đổi TOÀN BỘ một đề kiểm tra hiện có (từ file đính kèm hoặc văn bản được cung cấp) thành định dạng JSON để sử dụng trên hệ thống thi trực tuyến.

${sourceText ? `VĂN BẢN ĐỀ THI CẦN CHUYỂN ĐỔI:\n${sourceText}\n` : ""}

YÊU CẦU CẤU TRÚC ĐỀ THI (THEO CHUẨN BGD 2025):
- Cấu trúc chuẩn thường gồm: PHẦN I (18 câu MC), PHẦN II (4 câu TF), PHẦN III (6 câu SA).
- TUYÊN BỐ QUAN TRỌNG: Bạn PHẢI trích xuất ĐÚNG và ĐỦ số lượng câu hỏi thực tế có trong tài liệu/văn bản nguồn. Không được tự ý thêm câu hỏi để cho đủ 18 câu nếu nguồn chỉ có ít hơn.
- Thứ tự câu hỏi: Giữ nguyên thứ tự và phân loại như đề gốc. Đánh số câu liên tục từ 1 đến hết.

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
Bạn phải trả về dữ liệu dưới dạng JSON thuần túy (tuyệt đối không có bất kỳ văn bản giải thích nào khác ở đầu hoặc cuối, không có markdown code blocks) theo cấu trúc sau:
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

YÊU CẦU VỀ CÔNG THỨC TOÁN HỌC (CỰC KỲ QUAN TRỌNG):
- TẤT CẢ công thức, kí hiệu (x, y, m_U, \Delta...), biểu thức số học PHẢI viết bằng LaTeX và bao quanh bởi dấu $ (ví dụ: $x^2$, $\frac{a}{b}$).
- TUYỆT ĐỐI KHÔNG dùng chữ mô tả (ví dụ: KHÔNG viết "can(x)", "V" thay cho $\sqrt{x}$).
- TUYỆT ĐỐI KHÔNG dùng kí hiệu máy tính: KHÔNG dùng * (dùng \cdot), KHÔNG dùng / trong công thức phức (dùng \frac), KHÔNG dùng _ hay ^ ngoài dấu $.
- Mọi biến số đơn lẻ đều phải nằm trong $.

VÍ DỤ:
- SAI: m_U/m_X = (N_U * 238) / (N_X * A_X) -> ĐÚNG: $\frac{m_U}{m_X} = \frac{N_U \cdot 238}{N_X \cdot A_X}$
- SAI: y.T -> ĐÚNG: $y \cdot T$
- SAI: 2^-n -> ĐÚNG: $2^{-n}$
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
