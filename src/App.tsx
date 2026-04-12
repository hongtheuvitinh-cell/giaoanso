/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, 
  Sparkles, 
  Download, 
  Printer, 
  ChevronRight, 
  Cpu, 
  GraduationCap, 
  Clock,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  FileText,
  FileUp,
  FileDown,
  Table as TableIcon
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { generateLessonPlan } from "@/lib/gemini";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table } from "docx";
import { saveAs } from "file-saver";
import MatrixGenerator from "@/components/MatrixGenerator";
import { MatrixRow, PHYSICS_COMPETENCIES } from "./types";
import ExamGenerator from "@/components/ExamGenerator";
import { createDocxTable, parseMarkdownToRuns } from "@/lib/docx-utils";
import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from "firebase/firestore";

export default function App() {
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("");
  const [duration, setDuration] = useState("45 phút");
  const [referenceContent, setReferenceContent] = useState("");
  const [framework, setFramework] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [loading, setLoading] = useState(false);
  const [lessonPlan, setLessonPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [visitCount, setVisitCount] = useState<number | null>(null);

  // Visit Counter Logic
  useEffect(() => {
    const statsDocRef = doc(db, "stats", "global");

    const trackVisit = async () => {
      try {
        const docSnap = await getDoc(statsDocRef);
        if (docSnap.exists()) {
          await updateDoc(statsDocRef, {
            visitCount: increment(1)
          });
        } else {
          await setDoc(statsDocRef, {
            visitCount: 1
          });
        }
      } catch (err) {
        console.error("Error tracking visit:", err);
      }
    };

    trackVisit();

    // Listen for real-time updates
    const unsubscribe = onSnapshot(statsDocRef, (doc) => {
      if (doc.exists()) {
        setVisitCount(doc.data().visitCount);
      }
    });

    return () => unsubscribe();
  }, []);

  // Matrix State
  const [matrixSubject, setMatrixSubject] = useState<"general" | "physics">("general");
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([
    { 
      id: "1", 
      chapter: "Bài 7-Ứng phó tình huống nguy hiểm", 
      content: "Tình huống nguy hiểm; Cách ứng phó", 
      requirements: "Nêu được cách ứng phó trong các tình huống nguy hiểm thường gặp.",
      mc: { know: 3, understand: 1, apply: 0, highApply: 0 },
      tf: { know: 1, understand: 0, apply: 0, highApply: 0 },
      sa: { know: 0, understand: 0, apply: 0, highApply: 0 },
      essay: { know: 0, understand: 0, apply: 1, highApply: 0 },
      physicsCompetency: PHYSICS_COMPETENCIES[0]
    }
  ]);

  // Exam State
  const [examNotes, setExamNotes] = useState("");
  const [examSourceFile, setExamSourceFile] = useState<File | null>(null);
  const [examMatrixFile, setExamMatrixFile] = useState<File | null>(null);
  const [useManualMatrix, setUseManualMatrix] = useState(true);
  const [examContent, setExamContent] = useState<string | null>(null);

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

  const handleSaveKey = (key: string) => {
    setUserApiKey(key);
    localStorage.setItem("gemini_api_key", key);
  };

  const handleGenerate = async () => {
    if (!topic) return;
    if (!userApiKey) {
      setError("Vui lòng nhập Gemini API Key ở góc trên bên phải để tiếp tục.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let pdfData = undefined;
      if (pdfFile) {
        const base64 = await fileToBase64(pdfFile);
        pdfData = { data: base64, mimeType: pdfFile.type };
      }
      const result = await generateLessonPlan(userApiKey, topic, grade, duration, referenceContent, framework, pdfData);
      if (result) {
        setLessonPlan(result);
      } else {
        setError("Không thể tạo giáo án. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error(err);
      setError("Đã xảy ra lỗi trong quá trình tạo giáo án.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportDocx = async () => {
    if (!lessonPlan) return;

    const children: any[] = [];
    const lines = lessonPlan.split("\n");
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
          children: parseMarkdownToRuns(line.replace(/^\d+\.\s/, "")),
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
        properties: {},
        children: children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `GiaoAn_${topic.substring(0, 20).replace(/\s+/g, '_')}.docx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (lessonPlan) {
      navigator.clipboard.writeText(lessonPlan);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (lessonPlan) {
      const element = document.createElement("a");
      const file = new Blob([lessonPlan], { type: 'text/markdown' });
      element.href = URL.createObjectURL(file);
      element.download = `GiaoAn_${topic.substring(0, 20).replace(/\s+/g, '_')}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="border-bottom border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Giáo Án Số</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <span className="text-xs text-gray-400">API Key:</span>
              <input 
                type="password" 
                placeholder="Nhập Gemini API Key..." 
                className="bg-transparent border-none outline-none text-xs w-32 focus:w-48 transition-all"
                value={userApiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
              />
            </div>
            <span className="hidden sm:inline">Hỗ trợ AI soạn giáo án năng lực số</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <Tabs defaultValue="lesson-plan" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
              <TabsTrigger value="lesson-plan" className="px-8 py-2 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                <BookOpen className="w-4 h-4 mr-2" />
                Soạn giáo án
              </TabsTrigger>
              <TabsTrigger value="matrix" className="px-8 py-2 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                <TableIcon className="w-4 h-4 mr-2" />
                Ma trận đề
              </TabsTrigger>
              <TabsTrigger value="exam" className="px-8 py-2 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                <FileText className="w-4 h-4 mr-2" />
                Soạn đề kiểm tra
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="lesson-plan">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Input Section */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Thông tin bài học
                  </CardTitle>
                  <CardDescription>
                    Nhập thông tin cơ bản để AI phát sinh giáo án tích hợp năng lực số.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Tên bài học / Chủ đề</label>
                    <Textarea 
                      placeholder="Ví dụ: Hệ mặt trời, Các phép tính số học, Lịch sử triều Nguyễn..."
                      className="min-h-[100px] resize-none focus-visible:ring-blue-500"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Khối lớp</label>
                      <Input 
                        placeholder="Ví dụ: Lớp 6"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="focus-visible:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Thời lượng</label>
                      <Input 
                        placeholder="Ví dụ: 45 phút"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="focus-visible:ring-blue-500"
                      />
                    </div>
                  </div>

                  <Tabs defaultValue="text" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="text" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Văn bản
                      </TabsTrigger>
                      <TabsTrigger value="pdf" className="flex items-center gap-2">
                        <FileUp className="w-4 h-4" />
                        File PDF
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="text" className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Nội dung tham khảo (từ PDF/Sách)</label>
                        <Textarea 
                          placeholder="Dán nội dung bài học từ file PDF của bạn vào đây..."
                          className="min-h-[120px] resize-none focus-visible:ring-blue-500 text-sm"
                          value={referenceContent}
                          onChange={(e) => setReferenceContent(e.target.value)}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="pdf" className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Chọn file PDF bài học</label>
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <FileUp className="w-8 h-8 mb-3 text-gray-400" />
                              <p className="mb-2 text-sm text-gray-500">
                                <span className="font-semibold">Click để tải lên</span> hoặc kéo thả
                              </p>
                              <p className="text-xs text-gray-400">PDF (Tối đa 10MB)</p>
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".pdf" 
                              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                        {pdfFile && (
                          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md border border-blue-100">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-xs text-blue-800 truncate max-w-[200px] font-medium">
                              {pdfFile.name}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="ml-auto h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                              onClick={() => setPdfFile(null)}
                            >
                              ×
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Yêu cầu bổ sung (nếu có)</label>
                    <Textarea 
                      placeholder="Nhập thêm các yêu cầu riêng về năng lực số hoặc lưu ý khác..."
                      className="min-h-[80px] resize-none focus-visible:ring-blue-500 text-sm"
                      value={framework}
                      onChange={(e) => setFramework(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all"
                    onClick={handleGenerate}
                    disabled={loading || !topic}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Đang soạn thảo...
                      </>
                    ) : (
                      <>
                        Tạo giáo án ngay
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                <Cpu className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Khung năng lực số BGD</h4>
                  <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                    Đã tích hợp 6 nhóm năng lực số cấp THPT (L10-L12) bao gồm cả nhóm Ứng dụng AI.
                  </p>
                </div>
              </div>
            </div>

          {/* Output Section */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {!lessonPlan && !loading && !error && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border-2 border-dashed border-gray-200"
                >
                  <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <GraduationCap className="w-12 h-12 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Sẵn sàng hỗ trợ bạn</h3>
                  <p className="text-gray-500 max-w-xs mt-2">
                    Nhập thông tin bài học bên trái để bắt đầu tạo giáo án chuyên nghiệp.
                  </p>
                </motion.div>
              )}

              {loading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6 p-8 bg-white rounded-2xl shadow-sm"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 bg-red-50 rounded-2xl border border-red-100 text-center"
                >
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-red-900">Đã có lỗi xảy ra</h3>
                  <p className="text-red-700 mt-2">{error}</p>
                  <Button variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100" onClick={handleGenerate}>
                    Thử lại
                  </Button>
                </motion.div>
              )}

              {lessonPlan && !loading && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col h-full"
                >
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-[5]">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {duration}
                      </div>
                      <div className="flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" />
                        {grade || "N/A"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                        {copied ? "Đã sao chép" : "Sao chép"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" />
                        Xuất PDF (In)
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportDocx}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Xuất Word (.docx)
                      </Button>
                      <Button size="sm" className="bg-gray-900 text-white hover:bg-black" onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-2" />
                        Tải Markdown
                      </Button>
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1 p-8 md:p-12 print:p-0">
                    <div className="markdown-content max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath, remarkGfm]} 
                        rehypePlugins={[rehypeKatex]}
                      >
                        {lessonPlan}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </TabsContent>

        <TabsContent value="matrix">
          <MatrixGenerator 
            rows={matrixRows} 
            setRows={setMatrixRows} 
            subject={matrixSubject} 
            setSubject={setMatrixSubject} 
          />
        </TabsContent>

        <TabsContent value="exam">
          <ExamGenerator 
            matrixRows={matrixRows} 
            matrixSubject={matrixSubject} 
            apiKey={userApiKey}
            notes={examNotes}
            setNotes={setExamNotes}
            sourceFile={examSourceFile}
            setSourceFile={setExamSourceFile}
            matrixFile={examMatrixFile}
            setMatrixFile={setExamMatrixFile}
            useManualMatrix={useManualMatrix}
            setUseManualMatrix={setUseManualMatrix}
            examContent={examContent}
            setExamContent={setExamContent}
          />
        </TabsContent>
      </Tabs>
    </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-gray-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <p className="text-sm text-gray-500">
              © 2026 Giáo Án Số - Công cụ hỗ trợ giáo dục 4.0
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{visitCount !== null ? `${visitCount.toLocaleString()} lượt truy cập` : "Đang tải..."}</span>
            </div>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <Dialog>
              <DialogTrigger>
                <button className="hover:text-blue-600 transition-colors cursor-pointer">Hướng dẫn</button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Hướng dẫn sử dụng</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <section>
                    <h4 className="font-bold text-blue-900 mb-2">1. Lưu ý lấy API Key</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Ứng dụng sử dụng trí tuệ nhân tạo Gemini để soạn thảo. Bạn cần có API Key từ Google AI Studio (miễn phí) để bắt đầu. 
                      Nhấn vào biểu tượng "Cài đặt" (hình bánh răng) ở góc trên bên phải màn hình để nhập Key của bạn.
                    </p>
                  </section>
                  <section>
                    <h4 className="font-bold text-blue-900 mb-2">2. Trình tự thực hiện</h4>
                    <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-2">
                      <li><strong>Thiết lập Ma trận:</strong> Nhập các chủ đề, nội dung và số lượng câu hỏi theo 4 mức độ (B-H-V-VC).</li>
                      <li><strong>Soạn đề thi:</strong> Tải lên file nguồn kiến thức (nếu có) và nhấn "Soạn đề" để AI tạo đề dựa trên ma trận.</li>
                      <li><strong>Soạn giáo án:</strong> Nhập tên bài học, chọn khung năng lực số và nhấn "Soạn giáo án" để tạo KHBD chuẩn 5512.</li>
                      <li><strong>Xuất bản:</strong> Tải về định dạng Word (.docx) hoặc PDF để sử dụng.</li>
                    </ol>
                  </section>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger>
                <button className="hover:text-blue-600 transition-colors cursor-pointer">Chính sách</button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Chính sách & Bản quyền</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800">
                      <strong>Cảnh báo bản quyền:</strong> Mọi nội dung được tạo ra bởi AI chỉ mang tính chất tham khảo. Người dùng chịu trách nhiệm kiểm tra và điều chỉnh nội dung cho phù hợp với thực tế giảng dạy.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Kiến thức và cấu trúc giáo án/đề thi được thiết kế bám sát <strong>Chương trình Giáo dục phổ thông 2018</strong> của Bộ Giáo dục và Đào tạo Việt Nam.
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger>
                <button className="hover:text-blue-600 transition-colors cursor-pointer">Liên hệ</button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Thông tin liên hệ</DialogTitle>
                </DialogHeader>
                <div className="py-8 text-center space-y-4">
                  <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">HVT</h3>
                  <p className="text-blue-600 font-mono text-lg">0909091634</p>
                  <p className="text-sm text-gray-500">Hỗ trợ kỹ thuật và đóng góp ý kiến</p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </footer>

      {/* Print Styles */}
      <style>{`
        @media print {
          header, footer, .lg\\:col-span-4, .sticky, button {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .lg\\:col-span-8 {
            grid-column: span 12 / span 12 !important;
          }
          .rounded-2xl {
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .prose {
            font-size: 12pt !important;
          }
        }
      `}</style>
    </div>
  );
}
