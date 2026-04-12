import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  FileUp, 
  Sparkles, 
  Download, 
  Printer, 
  FileDown,
  RefreshCw,
  AlertCircle,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MatrixRow } from "@/types";
import { generateExamPaper } from "@/lib/gemini";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table } from "docx";
import { saveAs } from "file-saver";
import { createDocxTable, parseMarkdownToRuns } from "@/lib/docx-utils";

interface ExamGeneratorProps {
  matrixRows: MatrixRow[];
  matrixSubject: "general" | "physics";
  apiKey: string;
  notes: string;
  setNotes: (val: string) => void;
  sourceFile: File | null;
  setSourceFile: (file: File | null) => void;
  matrixFile: File | null;
  setMatrixFile: (file: File | null) => void;
  useManualMatrix: boolean;
  setUseManualMatrix: (val: boolean) => void;
  examContent: string | null;
  setExamContent: (val: string | null) => void;
}

export default function ExamGenerator({ 
  matrixRows, 
  matrixSubject, 
  apiKey,
  notes,
  setNotes,
  sourceFile,
  setSourceFile,
  matrixFile,
  setMatrixFile,
  useManualMatrix,
  setUseManualMatrix,
  examContent,
  setExamContent
}: ExamGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setError("Vui lòng nhập Gemini API Key ở phía trên.");
      return;
    }

    if (useManualMatrix && matrixRows.length === 0) {
      setError("Vui lòng thiết lập ma trận đề trước khi soạn đề hoặc tải lên file ma trận.");
      return;
    }

    if (!useManualMatrix && !matrixFile) {
      setError("Vui lòng tải lên file ma trận.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const matrixString = useManualMatrix ? JSON.stringify(matrixRows, null, 2) : null;
      
      let sourceFileData = undefined;
      if (sourceFile) {
        const base64 = await fileToBase64(sourceFile);
        sourceFileData = { data: base64, mimeType: sourceFile.type };
      }

      let matrixFileData = undefined;
      if (matrixFile && !useManualMatrix) {
        const base64 = await fileToBase64(matrixFile);
        matrixFileData = { data: base64, mimeType: matrixFile.type };
      }

      const result = await generateExamPaper(apiKey, matrixString, notes, sourceFileData, matrixFileData);
      setExamContent(result);
    } catch (err) {
      console.error(err);
      setError("Đã xảy ra lỗi khi tạo đề kiểm tra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportDocx = async () => {
    if (!examContent) return;

    const children: any[] = [];
    const lines = examContent.split("\n");
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed) {
        i++;
        continue;
      }

      // Handle Tables
      if (trimmed.startsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length > 0) {
          children.push(createDocxTable(tableLines));
          children.push(new Paragraph({ text: "" })); // Spacer
        }
        continue;
      }

      if (line.startsWith("# ")) {
        children.push(new Paragraph({ 
          children: parseMarkdownToRuns(line.replace("# ", "")),
          heading: HeadingLevel.HEADING_1, 
          spacing: { before: 400, after: 200 } 
        }));
      } else if (line.startsWith("## ")) {
        children.push(new Paragraph({ 
          children: parseMarkdownToRuns(line.replace("## ", "")),
          heading: HeadingLevel.HEADING_2, 
          spacing: { before: 300, after: 150 } 
        }));
      } else if (line.startsWith("### ")) {
        children.push(new Paragraph({ 
          children: parseMarkdownToRuns(line.replace("### ", "")),
          heading: HeadingLevel.HEADING_3, 
          spacing: { before: 200, after: 100 } 
        }));
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        children.push(new Paragraph({
          children: parseMarkdownToRuns(line.substring(2)),
          bullet: { level: 0 },
          spacing: { after: 120 }
        }));
      } else if (/^\d+\.\s/.test(line)) {
        children.push(new Paragraph({
          children: parseMarkdownToRuns(line),
          spacing: { after: 120 }
        }));
      } else {
        children.push(new Paragraph({
          children: parseMarkdownToRuns(line),
          spacing: { after: 200 }
        }));
      }
      i++;
    }

    const doc = new Document({
      sections: [{
        children: children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "DeKiemTra.docx");
  };

  const handleCopy = () => {
    if (examContent) {
      navigator.clipboard.writeText(examContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Input Section */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileUp className="w-5 h-5 text-blue-600" />
              Nguồn câu hỏi & Lưu ý
            </CardTitle>
            <CardDescription>Tải lên tài liệu và thêm các yêu cầu riêng cho đề thi</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <label className="text-sm font-semibold text-gray-700">Cấu trúc Ma trận</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
                <button 
                  onClick={() => setUseManualMatrix(true)}
                  className={`py-2 text-xs font-medium rounded-md transition-all ${useManualMatrix ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Dùng Ma trận đã nhập
                </button>
                <button 
                  onClick={() => setUseManualMatrix(false)}
                  className={`py-2 text-xs font-medium rounded-md transition-all ${!useManualMatrix ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Tải file Ma trận
                </button>
              </div>

              {!useManualMatrix && (
                <div className="relative group">
                  <input 
                    type="file" 
                    accept=".pdf,.docx,.csv"
                    onChange={(e) => setMatrixFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${matrixFile ? 'border-blue-500 bg-blue-50' : 'border-gray-200 group-hover:border-blue-400'}`}>
                    <FileUp className={`w-6 h-6 mx-auto mb-1 ${matrixFile ? 'text-blue-600' : 'text-gray-400'}`} />
                    <p className="text-[10px] font-medium text-gray-600">
                      {matrixFile ? matrixFile.name : "Chọn file Ma trận"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Tải lên file Nội dung (Nguồn câu hỏi)</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept=".pdf,.docx,.csv"
                  onChange={(e) => setSourceFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${sourceFile ? 'border-blue-500 bg-blue-50' : 'border-gray-200 group-hover:border-blue-400'}`}>
                  <FileUp className={`w-8 h-8 mx-auto mb-2 ${sourceFile ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="text-sm font-medium text-gray-600">
                    {sourceFile ? sourceFile.name : "Kéo thả hoặc chọn file nguồn"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Hỗ trợ PDF, DOCX, CSV</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Lưu ý thêm từ giáo viên</label>
              <Textarea 
                placeholder="Ví dụ: Không ra bài tập cân bằng nhiệt, tập trung vào lý thuyết sự chuyển thể..."
                className="min-h-[120px] rounded-xl border-gray-200 focus:ring-blue-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl text-md font-bold shadow-lg shadow-blue-200"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Đang soạn đề...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Soạn đề theo ma trận
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Thông tin ma trận hiện tại
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-blue-700 space-y-1">
            <p>• Chế độ: {useManualMatrix ? "Dùng ma trận nhập tay" : "Dùng file ma trận tải lên"}</p>
            {useManualMatrix && (
              <>
                <p>• Môn học: {matrixSubject === "physics" ? "Vật Lý" : "Môn khác"}</p>
                <p>• Số chủ đề: {matrixRows.length}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Output Section */}
      <div className="lg:col-span-8">
        {loading ? (
          <Card className="border-none shadow-sm h-full min-h-[600px]">
            <CardContent className="p-12 space-y-6">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="space-y-4 pt-8">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : examContent ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col h-full"
          >
            <div className="bg-white border-b p-4 flex justify-between items-center rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-bold text-gray-700">Đề kiểm tra đã soạn</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Đã sao chép" : "Sao chép"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" />
                  In đề
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportDocx}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Xuất Word
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 bg-white p-8 md:p-12 rounded-b-2xl shadow-sm">
              <div className="markdown-content max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath, remarkGfm]} 
                  rehypePlugins={[rehypeKatex]}
                >
                  {examContent}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </motion.div>
        ) : (
          <div className="h-full min-h-[600px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center p-12 bg-white/50">
            <div className="bg-gray-100 p-6 rounded-full mb-6">
              <Sparkles className="w-12 h-12 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sẵn sàng soạn đề</h3>
            <p className="text-gray-500 max-w-md">
              Thiết lập ma trận, tải lên tài liệu nguồn và nhấn nút "Soạn đề" để AI giúp bạn tạo ra một đề kiểm tra hoàn chỉnh.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
