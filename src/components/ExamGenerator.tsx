import React, { useState, useEffect, useRef } from "react";
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
  Check,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Eye,
  CloudUpload,
  Image as ImageIcon,
  ImageOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { MatrixRow, Question, QuestionType, QuestionLevel, Exam } from "@/types";
import { generateExamPaper, parseExistingExam } from "@/lib/gemini";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { createDocxTable, parseMarkdownToRuns } from "@/lib/docx-utils";
import { db, doc, setDoc, auth, handleFirestoreError, OperationType } from "@/lib/firebase";
import { toast } from "sonner";

// --- Sub-components for performance ---

const QuestionItem = React.memo(({ 
  q, 
  idx, 
  editingId, 
  setEditingId, 
  updateQuestion, 
  deleteQuestion,
  previewMode 
}: { 
  q: Question, 
  idx: number, 
  editingId: string | null, 
  setEditingId: (id: string | null) => void,
  updateQuestion: (id: string, updates: Partial<Question>) => void,
  deleteQuestion: (id: string) => void,
  previewMode: boolean
}) => {
  const [localContent, setLocalContent] = useState(q.content);
  const [debouncedContent, setDebouncedContent] = useState(q.content);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalContent(q.content);
    setDebouncedContent(q.content);
  }, [q.id]); // Only reset when switching questions, not on every content update from parent

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContent(localContent);
      if (localContent !== q.content) {
        updateQuestion(q.id, { content: localContent });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localContent]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 800KB). Vui lòng nén ảnh trước khi tải lên.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      updateQuestion(q.id, { imageUrl: base64 });
      toast.success("Đã tải ảnh lên thành công!");
    };
    reader.readAsDataURL(file);
  };

  if (previewMode) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
              Câu {idx + 1}
            </Badge>
          </div>
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                {q.content}
              </ReactMarkdown>
            </div>
            {q.imageUrl && (
              <img src={q.imageUrl} alt="Minh họa" className="rounded-lg border border-gray-100 max-h-64 object-contain" referrerPolicy="no-referrer" />
            )}
            {(q.type === "MC" || q.type === "TF") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                {q.options?.map((opt, oIdx) => (
                  <div key={opt.id} className={`p-3 rounded-xl border flex gap-3 ${opt.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-100'}`}>
                    <span className="font-bold">{q.type === "TF" ? String.fromCharCode(97 + oIdx) : opt.id}.</span>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {opt.text}
                    </ReactMarkdown>
                  </div>
                ))}
              </div>
            )}
            {q.type === "SA" && (
              <div className="ml-4 p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 flex gap-2">
                <span className="font-bold">Đáp án:</span>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {q.correctAnswer || ""}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-none shadow-sm transition-all ${editingId === q.id ? 'ring-2 ring-blue-500' : ''}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
              Câu {idx + 1}
            </Badge>
            <Badge variant="secondary" className="text-[10px] uppercase">
              {q.type}
            </Badge>
            <Badge variant="secondary" className="text-[10px] uppercase bg-orange-50 text-orange-700 border-orange-100">
              {q.level}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => setEditingId(editingId === q.id ? null : q.id)}>
              {editingId === q.id ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => deleteQuestion(q.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {editingId === q.id ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Loại câu hỏi</label>
                <Select value={q.type} onValueChange={(val: QuestionType) => updateQuestion(q.id, { type: val })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MC">Trắc nghiệm</SelectItem>
                    <SelectItem value="TF">Đúng / Sai</SelectItem>
                    <SelectItem value="SA">Trả lời ngắn</SelectItem>
                    <SelectItem value="ESSAY">Tự luận</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Mức độ</label>
                <Select value={q.level} onValueChange={(val: QuestionLevel) => updateQuestion(q.id, { level: val })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="know">Biết</SelectItem>
                    <SelectItem value="understand">Hiểu</SelectItem>
                    <SelectItem value="apply">Vận dụng</SelectItem>
                    <SelectItem value="highApply">Vận dụng cao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nội dung câu hỏi (Hỗ trợ Latex $...$)</label>
                <div className="flex gap-1">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] text-blue-600"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="w-3 h-3 mr-1" /> {q.imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] text-gray-500"
                    onClick={() => {
                      const url = window.prompt("Nhập URL hình ảnh minh họa:");
                      if (url !== null) updateQuestion(q.id, { imageUrl: url });
                    }}
                  >
                    <ImageIcon className="w-3 h-3 mr-1" /> Link ảnh
                  </Button>
                </div>
              </div>
              <Textarea 
                value={localContent} 
                onChange={(e) => setLocalContent(e.target.value)}
                className="min-h-[80px] text-sm font-mono"
                placeholder="Nhập nội dung câu hỏi. Ví dụ: Tính giá trị của $x$ trong phương trình $x^2 + 2x + 1 = 0$"
              />
              {q.imageUrl && (
                <div className="relative mt-2 group w-full max-w-xs">
                  <img src={q.imageUrl} alt="Minh họa" className="rounded-lg border border-gray-200 max-h-40 object-contain bg-white" referrerPolicy="no-referrer" />
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => updateQuestion(q.id, { imageUrl: "" })}
                  >
                    <ImageOff className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Xem trước nội dung:</div>
                <div className="text-sm prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                    {debouncedContent || "*Chưa có nội dung*"}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {(q.type === "MC" || q.type === "TF") && q.options && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    {q.type === "MC" ? "Các phương án (A, B, C, D)" : "Các ý Đúng/Sai (a, b, c, d)"}
                  </label>
                  {q.type === "TF" && q.options.length < 4 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10px]"
                      onClick={() => {
                        const nextId = String.fromCharCode(97 + q.options!.length);
                        updateQuestion(q.id, { 
                          options: [...q.options!, { id: nextId, text: `Ý ${nextId}...`, isCorrect: false }] 
                        });
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Thêm ý
                    </Button>
                  )}
                </div>
                {q.options.map((opt, optIdx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <Checkbox 
                        checked={opt.isCorrect} 
                        onCheckedChange={(val) => {
                          const newOpts = q.options!.map((o, i) => 
                            q.type === "MC" 
                              ? { ...o, isCorrect: i === optIdx ? !!val : false }
                              : i === optIdx ? { ...o, isCorrect: !!val } : o
                          );
                          updateQuestion(q.id, { options: newOpts });
                        }}
                      />
                      <span className="text-[8px] text-gray-400 mt-0.5">{q.type === "TF" ? (opt.isCorrect ? "Đúng" : "Sai") : "Đúng"}</span>
                    </div>
                    <span className="text-xs font-bold w-4">{q.type === "TF" ? String.fromCharCode(97 + optIdx) : opt.id}</span>
                    <Input 
                      value={opt.text} 
                      onChange={(e) => {
                        const newOpts = q.options!.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o);
                        updateQuestion(q.id, { options: newOpts });
                      }}
                      className="h-8 text-xs font-mono"
                      placeholder="Nhập phương án..."
                    />
                    <div className="text-[10px] bg-white px-2 py-1 rounded border border-gray-100 min-w-[100px]">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {opt.text || "..."}
                      </ReactMarkdown>
                    </div>
                    {q.type === "TF" && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-gray-300 hover:text-red-500"
                        onClick={() => {
                          const newOpts = q.options!.filter(o => o.id !== opt.id)
                            .map((o, i) => ({ ...o, id: String.fromCharCode(97 + i) }));
                          updateQuestion(q.id, { options: newOpts });
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {q.type === "SA" && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Đáp án đúng</label>
                <Input 
                  value={q.correctAnswer} 
                  onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="Nhập đáp án chính xác..."
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                {q.content || "*Chưa có nội dung*"}
              </ReactMarkdown>
            </div>
            {q.imageUrl && (
              <img src={q.imageUrl} alt="Minh họa" className="rounded-lg border border-gray-100 max-h-40 object-contain" referrerPolicy="no-referrer" />
            )}
            {(q.type === "MC" || q.type === "TF") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-4">
                {q.options?.map((opt, oIdx) => (
                  <div key={opt.id} className={`p-2 rounded border flex gap-2 ${opt.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-100'}`}>
                    <span className="font-bold">{q.type === "TF" ? String.fromCharCode(97 + oIdx) : opt.id}.</span>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {opt.text}
                    </ReactMarkdown>
                  </div>
                ))}
              </div>
            )}
            {q.type === "SA" && (
              <div className="ml-4 p-2 bg-blue-50 rounded border border-blue-100 text-blue-700 flex gap-2">
                <span className="font-bold">Đáp án:</span>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {q.correctAnswer || ""}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// --- Main component ---

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
  examData: Exam | null;
  setExamData: (val: Exam | null) => void;
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
  examData,
  setExamData
}: ExamGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [generatorMode, setGeneratorMode] = useState<"matrix" | "import">("matrix");

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

    if (generatorMode === "matrix" && useManualMatrix && matrixRows.length === 0) {
      setError("Vui lòng thiết lập ma trận đề trước khi soạn đề hoặc tải lên file ma trận.");
      return;
    }

    if (generatorMode === "import" && !sourceFile) {
      setError("Vui lòng tải lên file đề thi hiện có để chuyển đổi.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let sourceFileData = undefined;
      if (sourceFile) {
        const base64 = await fileToBase64(sourceFile);
        sourceFileData = { data: base64, mimeType: sourceFile.type };
      }

      let result;
      if (generatorMode === "matrix") {
        const matrixString = useManualMatrix ? JSON.stringify(matrixRows, null, 2) : null;
        let matrixFileData = undefined;
        if (matrixFile && !useManualMatrix) {
          const base64 = await fileToBase64(matrixFile);
          matrixFileData = { data: base64, mimeType: matrixFile.type };
        }
        result = await generateExamPaper(apiKey, matrixString, notes, sourceFileData, matrixFileData);
      } else {
        result = await parseExistingExam(apiKey, notes, sourceFileData);
      }

      const parsedExam: Exam = JSON.parse(result);
      setExamData(parsedExam);
      setPreviewMode(false);
    } catch (err) {
      console.error(err);
      setError("Đã xảy ra lỗi khi tạo đề kiểm tra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substr(2, 9),
      type: "MC",
      level: "know",
      content: "Câu hỏi mới...",
      options: [
        { id: "A", text: "Phương án A", isCorrect: true },
        { id: "B", text: "Phương án B", isCorrect: false },
        { id: "C", text: "Phương án C", isCorrect: false },
        { id: "D", text: "Phương án D", isCorrect: false },
      ],
      points: 0.25
    };

    if (examData) {
      setExamData({
        ...examData,
        questions: [...examData.questions, newQuestion]
      });
      setEditingId(newQuestion.id);
    } else {
      setExamData({
        id: "new-exam",
        title: "Đề thi mới",
        subject: matrixSubject === "physics" ? "Vật Lý" : "Môn học khác",
        grade: "10",
        timeLimit: 45,
        questions: [newQuestion],
        createdAt: new Date().toISOString(),
        teacherId: "current-user"
      });
      setEditingId(newQuestion.id);
    }
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    if (!examData) return;
    setExamData({
      ...examData,
      questions: examData.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    });
  };

  const deleteQuestion = (id: string) => {
    if (!examData) return;
    setExamData({
      ...examData,
      questions: examData.questions.filter(q => q.id !== id)
    });
  };

  const handleExportDocx = async () => {
    if (!examData) return;

    try {
      const children: any[] = [
        new Paragraph({ text: examData.title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `Môn: ${examData.subject} - Thời gian: ${examData.timeLimit} phút`, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "" }),
      ];

      examData.questions.forEach((q, idx) => {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `Câu ${idx + 1}: `, bold: true }),
            ...parseMarkdownToRuns(q.content)
          ],
          spacing: { before: 200, after: 100 }
        }));

        if (q.type === "MC" && q.options) {
          q.options.forEach(opt => {
            children.push(new Paragraph({
              children: [
                new TextRun({ text: `${opt.id}. `, bold: true }),
                new TextRun(opt.text)
              ],
              indent: { left: 720 },
              spacing: { after: 60 }
            }));
          });
        }

        if (q.type === "TF" && q.options) {
          q.options.forEach((opt, optIdx) => {
            const label = String.fromCharCode(97 + optIdx); // a, b, c, d
            children.push(new Paragraph({
              children: [
                new TextRun({ text: `${label}) `, bold: true }),
                new TextRun({ text: opt.text }),
                new TextRun({ text: "\t\t(Đúng / Sai)", italics: true, color: "666666" })
              ],
              indent: { left: 720 },
              spacing: { after: 60 }
            }));
          });
        }
      });

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${examData.title}.docx`);
      toast.success("Đã xuất file Word thành công!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Lỗi khi xuất file Word. Vui lòng kiểm tra lại nội dung đề.");
    }
  };

  const handleCopy = () => {
    if (examData) {
      const text = examData.questions.map((q, i) => `Câu ${i+1}: ${q.content}`).join("\n\n");
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!examData) return;
    
    if (!auth.currentUser) {
      toast.error("Vui lòng đăng nhập để xuất bản đề thi.", {
        description: "Nhấn nút 'Đăng nhập GV' ở góc trên bên phải."
      });
      return;
    }

    setPublishing(true);
    const examId = examData.id || `exam_${Date.now()}`;
    try {
      const finalExam = {
        ...examData,
        id: examId,
        createdAt: new Date().toISOString(),
        teacherId: auth.currentUser.uid
      };
      await setDoc(doc(db, "exams", examId), finalExam);
      toast.success("Đã xuất bản đề thi thành công!", {
        description: `Mã đề của bạn là: ${examId}. Hãy gửi mã này cho học sinh.`,
        duration: 10000,
      });
      setExamData(finalExam);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, `exams/${examId}`);
      } catch (wrappedErr) {
        console.error(wrappedErr);
        toast.error("Lỗi khi xuất bản đề thi. Vui lòng kiểm tra quyền truy cập.");
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Input Section */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-lg flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-blue-600" />
                Chế độ soạn đề
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg w-full">
                <button 
                  onClick={() => setGeneratorMode("matrix")}
                  className={`py-2 text-xs font-medium rounded-md transition-all ${generatorMode === "matrix" ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Soạn từ Ma trận
                </button>
                <button 
                  onClick={() => setGeneratorMode("import")}
                  className={`py-2 text-xs font-medium rounded-md transition-all ${generatorMode === "import" ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Nhập đề có sẵn
                </button>
              </div>
            </CardTitle>
            <CardDescription>
              {generatorMode === "matrix" 
                ? "Tạo đề thi mới dựa trên cấu trúc ma trận và tài liệu nguồn" 
                : "Chuyển đổi file đề thi hiện có (PDF/Word) thành đề thi trực tuyến"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {generatorMode === "matrix" && (
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
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {generatorMode === "matrix" ? "Tải lên file Nội dung (Nguồn câu hỏi)" : "Tải lên file Đề thi hiện có"}
              </label>
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
                    {sourceFile ? sourceFile.name : "Kéo thả hoặc chọn file đề/nguồn"}
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
                  {generatorMode === "matrix" ? "Đang soạn đề..." : "Đang chuyển đổi..."}
                </>
              ) : (
                <>
                  {generatorMode === "matrix" ? <Sparkles className="w-5 h-5 mr-2" /> : <CloudUpload className="w-5 h-5 mr-2" />}
                  {generatorMode === "matrix" ? "Soạn đề theo ma trận" : "Chuyển đổi đề có sẵn"}
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
      <div className="lg:col-span-8 h-[calc(100vh-220px)] min-h-[600px]">
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
        ) : examData ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col h-full"
          >
            <div className="bg-white border-b p-4 flex justify-between items-center rounded-t-2xl sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <Input 
                  value={examData.title} 
                  onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                  className="font-bold text-gray-700 border-none focus-visible:ring-0 w-64"
                />
              </div>
              <div className="flex gap-2">
                <Button variant={previewMode ? "default" : "outline"} size="sm" onClick={() => setPreviewMode(!previewMode)}>
                  {previewMode ? <Edit2 className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {previewMode ? "Chế độ sửa" : "Xem trước"}
                </Button>
                <Button variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm câu
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportDocx}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Xuất Word
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white" 
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
                  {publishing ? "Đang lưu..." : "Lưu & Xuất bản"}
                </Button>
              </div>
            </div>
            
            <div className="flex-1 bg-gray-50 p-4 rounded-b-2xl shadow-sm overflow-y-auto custom-scrollbar">
              <div className="space-y-4 max-w-4xl mx-auto pb-20">
                {examData.questions.map((q, idx) => {
                  const prevQ = idx > 0 ? examData.questions[idx - 1] : null;
                  const showHeader = !prevQ || prevQ.type !== q.type;
                  
                  let partHeader = null;
                  if (showHeader) {
                    if (q.type === "MC") {
                      partHeader = {
                        title: "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn",
                        desc: "Thí sinh trả lời từ câu 1 đến câu 18. Mỗi câu hỏi thí sinh chỉ chọn một phương án."
                      };
                    } else if (q.type === "TF") {
                      partHeader = {
                        title: "PHẦN II. Câu trắc nghiệm đúng sai",
                        desc: "Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai."
                      };
                    } else if (q.type === "SA") {
                      partHeader = {
                        title: "PHẦN III. Câu trắc nghiệm trả lời ngắn",
                        desc: "Thí sinh trả lời từ câu 1 đến câu 6."
                      };
                    }
                  }

                  return (
                    <React.Fragment key={q.id}>
                      {partHeader && (
                        <div className="mt-8 mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <h3 className="font-bold text-blue-900">{partHeader.title}</h3>
                          <p className="text-xs text-blue-700 mt-1">{partHeader.desc}</p>
                        </div>
                      )}
                      <QuestionItem 
                        q={q}
                        idx={idx}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        updateQuestion={updateQuestion}
                        deleteQuestion={deleteQuestion}
                        previewMode={previewMode}
                      />
                    </React.Fragment>
                  );
                })}
                {examData.questions.length === 0 && (
                  <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center p-12 bg-white/50">
                    <div className="bg-gray-100 p-6 rounded-full mb-6">
                      <Sparkles className="w-12 h-12 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Chưa có câu hỏi nào</h3>
                    <p className="text-gray-500 max-w-md">
                      Nhấn nút "Thêm câu" hoặc sử dụng AI để tạo câu hỏi cho đề thi của bạn.
                    </p>
                  </div>
                )}
              </div>
            </div>
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
