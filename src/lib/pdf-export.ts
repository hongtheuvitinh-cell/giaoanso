import { Exam, Question } from "@/types";

export function exportExamToPrintablePdf(exam: Exam, studentName?: string, studentClass?: string) {
  // Format questions into HTML with clean typography, KaTeX and math rendering
  const questionsHtml = exam.questions.map((q, idx) => {
    let partLabel = "";
    if (idx === 0 || exam.questions[idx - 1]?.type !== q.type) {
      if (q.type === "MC") {
        partLabel = `<div class="part-header">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh chọn 1 phương án duy nhất)</div>`;
      } else if (q.type === "TF") {
        partLabel = `<div class="part-header">PHẦN II. Câu trắc nghiệm đúng sai (Trong mỗi ý a, b, c, d, chọn Đúng hoặc Sai)</div>`;
      } else if (q.type === "SA") {
        partLabel = `<div class="part-header">PHẦN III. Câu trắc nghiệm trả lời ngắn</div>`;
      } else if (q.type === "ESSAY") {
        partLabel = `<div class="part-header">PHẦN TỰ LUẬN</div>`;
      }
    }

    let contextHtml = "";
    if (q.context && (idx === 0 || exam.questions[idx - 1]?.context !== q.context)) {
      contextHtml = `
        <div class="context-box">
          <strong>📖 Lời dẫn / Ngữ liệu chung:</strong>
          <div>${escapeHtml(q.context)}</div>
        </div>
      `;
    }

    let optionsHtml = "";
    if (q.type === "MC" && q.options) {
      optionsHtml = `
        <div class="options-grid">
          ${q.options.map(opt => `
            <div class="option-item">
              <strong>${opt.id}.</strong> ${escapeHtml(opt.text)}
            </div>
          `).join("")}
        </div>
      `;
    } else if (q.type === "TF" && q.options) {
      optionsHtml = `
        <div class="tf-options">
          ${q.options.map((opt, oIdx) => `
            <div class="tf-row">
              <span class="tf-label"><strong>${String.fromCharCode(97 + oIdx)})</strong> ${escapeHtml(opt.text)}</span>
              <span class="tf-choice">[ &nbsp; ] Đúng &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] Sai</span>
            </div>
          `).join("")}
        </div>
      `;
    } else if (q.type === "SA") {
      optionsHtml = `
        <div class="sa-box">
          <em>Đáp án của thí sinh:</em> __________________________________________________
        </div>
      `;
    } else if (q.type === "ESSAY") {
      optionsHtml = `
        <div class="essay-box">
          <div class="essay-lines"></div>
        </div>
      `;
    }

    return `
      ${partLabel}
      ${contextHtml}
      <div class="question-item">
        <div class="question-header">
          <strong>Câu ${idx + 1}:</strong> ${escapeHtml(q.content)}
          <span class="question-points">(${q.points || (q.type === "TF" ? 1.0 : 0.25)} đ)</span>
        </div>
        ${q.imageUrl ? `<div class="question-img"><img src="${q.imageUrl}" alt="Minh họa" /></div>` : ""}
        ${optionsHtml}
      </div>
    `;
  }).join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(exam.title)}</title>
      <style>
        @page {
          size: A4;
          margin: 18mm 15mm 18mm 15mm;
        }
        body {
          font-family: "Times New Roman", Times, serif, "Segoe UI", Arial, sans-serif;
          font-size: 13pt;
          line-height: 1.45;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 20px;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .header-table td {
          vertical-align: top;
          padding: 2px 4px;
        }
        .school-name {
          font-size: 12pt;
          font-weight: bold;
          text-align: center;
          text-transform: uppercase;
        }
        .exam-meta {
          font-size: 11pt;
          text-align: center;
          font-style: italic;
        }
        .exam-title {
          font-size: 15pt;
          font-weight: bold;
          text-align: center;
          text-transform: uppercase;
          margin-top: 5px;
          color: #000;
        }
        .student-info-box {
          border: 1px dashed #444;
          padding: 8px 12px;
          margin-bottom: 18px;
          font-size: 11.5pt;
          display: flex;
          justify-content: space-between;
          background: #fafafa;
        }
        .part-header {
          font-weight: bold;
          font-size: 12.5pt;
          margin-top: 18px;
          margin-bottom: 8px;
          padding: 4px 6px;
          background: #f0f0f0;
          border-left: 4px solid #333;
          page-break-after: avoid;
        }
        .context-box {
          background: #fffdf5;
          border: 1px solid #d4a373;
          padding: 8px 12px;
          margin: 8px 0 12px 0;
          border-radius: 4px;
          font-style: normal;
          page-break-inside: avoid;
        }
        .question-item {
          margin-bottom: 14px;
          page-break-inside: avoid;
        }
        .question-header {
          font-size: 13pt;
          margin-bottom: 6px;
        }
        .question-points {
          font-size: 11pt;
          font-style: italic;
          color: #444;
          margin-left: 4px;
        }
        .question-img {
          text-align: center;
          margin: 8px 0;
        }
        .question-img img {
          max-height: 180px;
          max-width: 90%;
        }
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 16px;
          padding-left: 12px;
          margin-top: 4px;
        }
        .option-item {
          font-size: 12.5pt;
        }
        .tf-options {
          padding-left: 12px;
          margin-top: 4px;
        }
        .tf-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dotted #ccc;
        }
        .tf-choice {
          font-family: monospace;
          font-weight: bold;
          font-size: 11pt;
          white-space: nowrap;
          margin-left: 10px;
        }
        .sa-box {
          padding-left: 12px;
          margin-top: 6px;
          font-size: 12pt;
        }
        .essay-box {
          height: 120px;
          border-bottom: 1px dotted #999;
          margin-top: 8px;
        }
        .footer-note {
          text-align: center;
          font-style: italic;
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #ccc;
          font-size: 11pt;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="width: 45%;">
            <div class="school-name">SỞ GD&ĐT / TRƯỜNG THPT</div>
            <div class="exam-meta">Năm học: 2025 - 2026</div>
            <div class="exam-meta">Mã đề: <strong>${escapeHtml(exam.id)}</strong></div>
          </td>
          <td style="width: 55%;">
            <div class="exam-title">${escapeHtml(exam.title)}</div>
            <div class="exam-meta">Môn: <strong>${escapeHtml(exam.subject)}</strong> - Khối: <strong>${escapeHtml(exam.grade)}</strong></div>
            <div class="exam-meta">Thời gian làm bài: <strong>${exam.timeLimit} phút</strong> (không kể phát đề)</div>
          </td>
        </tr>
      </table>

      <div class="student-info-box">
        <div>Họ và tên thí sinh: <strong>${escapeHtml(studentName || "........................................................................")}</strong></div>
        <div>Lớp: <strong>${escapeHtml(studentClass || "...................")}</strong></div>
        <div>Số báo danh: <strong>...................</strong></div>
      </div>

      <div class="exam-body">
        ${questionsHtml}
      </div>

      <div class="footer-note">
        --- HẾT ---<br />
        <em>(Cán bộ coi thi không giải thích gì thêm)</em>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  // Open in a new printable window or iframe
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    // Fallback: create an iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  }
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
