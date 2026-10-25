import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  BookOpen,
  Trophy,
  RefreshCw,
  GraduationCap,
  School,
  Lock,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { db, doc, getDoc, addDoc, collection, query, where, getDocs, handleFirestoreError, OperationType } from "@/lib/firebase";
import { Exam, Question } from "@/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default function StudentExam() {
  const [examCode, setExamCode] = useState("");
  const [loginStudentId, setLoginStudentId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [showReview, setShowReview] = useState(false);

  const fetchExam = async (codeOverride?: string) => {
    const code = (codeOverride || examCode).trim();
    if (!code) {
      toast.error("Vui lòng nhập mã đề thi.");
      return;
    }
    setLoading(true);
    try {
      const docRef = doc(db, "exams", code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Exam;
        if (data.status === 'draft') {
          toast.error("Đề thi này hiện đang là bản nháp và chưa được xuất bản.");
          setLoading(false);
          return;
        }
        setExam(data);
        setTimeLeft(data.timeLimit * 60);
      } else {
        toast.error("Không tìm thấy đề thi với mã này.");
      }
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.GET, `exams/${code}`);
      } catch (wrappedErr) {
        console.error(wrappedErr);
        toast.error("Lỗi khi tải đề thi.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code") || searchParams.get("exam");
    if (code) {
      const trimmedCode = code.trim();
      setExamCode(trimmedCode);
      fetchExam(trimmedCode);
    }
  }, []);

  const verifyStudentAndStart = async () => {
    if (!loginStudentId.trim()) {
      toast.error("Vui lòng nhập Mã học sinh.");
      return;
    }
    if (!loginPassword.trim()) {
      toast.error("Vui lòng nhập Mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, "studentAccounts"), where("studentId", "==", loginStudentId.trim()));
      const snapshot = await getDocs(q);
      let matchedAccount: any = null;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.password === loginPassword.trim()) {
          matchedAccount = data;
        }
      });

      if (matchedAccount) {
        setStudentName(matchedAccount.fullName);
        setStudentClass(matchedAccount.studentClass);
        setSchoolName(matchedAccount.schoolName || "");
        setStarted(true);
        toast.success(`Đăng nhập thành công! Chào em ${matchedAccount.fullName}`);
      } else {
        toast.error("Mã học sinh hoặc Mật khẩu không chính xác!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xác thực tài khoản học sinh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (started && timeLeft > 0 && !result) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && started && !result) {
      submitExam();
    }
    return () => clearInterval(timer);
  }, [started, timeLeft, result]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const submitExam = async () => {
    if (!exam) return;
    setLoading(true);
    try {
      let totalScore = 0;
      let correctCount = 0;
      
      exam.questions.forEach(q => {
        const studentAnswer = answers[q.id];
        if (q.type === "MC") {
          const correctOpt = q.options?.find(o => o.isCorrect);
          if (correctOpt && studentAnswer === correctOpt.id) {
            totalScore += q.points || 0.25;
            correctCount++;
          }
        } else if (q.type === "TF") {
          let subCorrect = 0;
          q.options?.forEach((opt, optIdx) => {
            const studentVal = studentAnswer?.[`opt_${optIdx}`];
            const isCorrect = (studentVal === true && opt.isCorrect) || (studentVal === false && !opt.isCorrect);
            if (isCorrect) subCorrect++;
          });
          
          if (subCorrect === 1) totalScore += 0.1;
          else if (subCorrect === 2) totalScore += 0.25;
          else if (subCorrect === 3) totalScore += 0.5;
          else if (subCorrect === 4) {
            totalScore += 1.0;
            correctCount++;
          }
        } else if (q.type === "SA") {
          if (studentAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()) {
            totalScore += q.points || 0.25;
            correctCount++;
          }
        } else if (q.type === "ESSAY") {
          if (studentAnswer && studentAnswer.length > 10) {
            totalScore += q.points || 1.0;
            correctCount++;
          }
        }
      });

      const finalScore = Math.min(10, Math.max(0, totalScore));

      const name = studentName.trim();
      const sClass = studentClass.trim();
      const sSchool = schoolName.trim();
      const combined = [name, sClass, sSchool].filter(Boolean).join(" _ ");

      const resultData = {
        studentName: name,
        studentClass: sClass,
        schoolName: sSchool,
        displayNameCombined: combined,
        examId: exam.id,
        examTitle: exam.title,
        teacherId: exam.teacherId,
        score: finalScore,
        totalQuestions: exam.questions.length,
        correctAnswers: correctCount,
        submittedAt: new Date().toISOString(),
        answers
      };

      const sanitizedResult = JSON.parse(JSON.stringify(resultData));
      await addDoc(collection(db, "results"), sanitizedResult);
      setResult(resultData);
      toast.success("Đã nộp bài thành công!");
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, "results");
      } catch (wrappedErr) {
        console.error(wrappedErr);
        toast.error("Lỗi khi nộp bài.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="border-none shadow-xl overflow-hidden">
            <div className="bg-green-600 p-8 text-center text-white">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-90" />
              <h2 className="text-3xl font-bold mb-2">Kết quả bài làm</h2>
              <p className="opacity-80">{exam?.title}</p>
            </div>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl text-center">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Điểm số</p>
                  <p className="text-4xl font-black text-blue-600">{result.score.toFixed(1)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl text-center">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Số câu đúng</p>
                  <p className="text-4xl font-black text-green-600">{result.correctAnswers}/{result.totalQuestions}</p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-sm pb-2 border-b border-gray-100">
                  <span className="text-gray-500">Học sinh:</span>
                  <span className="font-bold text-gray-900">{result.studentName}</span>
                </div>
                {result.studentClass && (
                  <div className="flex justify-between items-center text-sm pb-2 border-b border-gray-100">
                    <span className="text-gray-500">Lớp:</span>
                    <span className="font-semibold text-blue-700">{result.studentClass}</span>
                  </div>
                )}
                {result.schoolName && (
                  <div className="flex justify-between items-center text-sm pb-2 border-b border-gray-100">
                    <span className="text-gray-500">Trường:</span>
                    <span className="font-semibold text-gray-800">{result.schoolName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm pb-2 border-b border-gray-100">
                  <span className="text-gray-500">Định danh kết quả:</span>
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {result.displayNameCombined || [result.studentName, result.studentClass, result.schoolName].filter(Boolean).join(" _ ")}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Thời gian nộp:</span>
                  <span className="text-xs text-gray-600">{new Date(result.submittedAt).toLocaleString("vi-VN")}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setShowReview(true)}>
                  Xem lại bài làm
                </Button>
                <Button className="flex-1 bg-gray-900 text-white h-12 rounded-xl" onClick={() => window.location.reload()}>
                  Thoát
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {showReview && (
          <div className="mt-12 space-y-8">
            <h3 className="text-2xl font-bold text-gray-900 text-center">Chi tiết bài làm</h3>
            {exam?.questions.map((q, idx) => {
              const studentAnswer = result.answers[q.id];
              let isCorrect = false;
              
              if (q.type === "MC") {
                isCorrect = studentAnswer === q.options?.find(o => o.isCorrect)?.id;
              } else if (q.type === "TF") {
                isCorrect = q.options?.every((opt, i) => (studentAnswer?.[`opt_${i}`] ?? null) === opt.isCorrect) ?? false;
              } else if (q.type === "SA") {
                isCorrect = studentAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
              }

              const prevContext = idx > 0 ? exam.questions[idx - 1]?.context?.trim() : undefined;
              const currentContext = q.context?.trim();
              const isNewContext = !!currentContext && currentContext !== prevContext;

              return (
                <React.Fragment key={q.id}>
                  {isNewContext && currentContext && (
                    <div className="p-5 bg-gradient-to-r from-amber-50 via-amber-50/70 to-orange-50/60 rounded-2xl border-2 border-amber-300 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-sm uppercase tracking-wide mb-2.5 pb-2 border-b border-amber-200/80">
                        <BookOpen className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                        <span>📖 Lời dẫn / Ngữ liệu chung</span>
                      </div>
                      <div className="text-sm text-amber-950 prose prose-sm max-w-none leading-relaxed font-sans">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {currentContext}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  <Card className={`border-none shadow-sm ${isCorrect ? 'ring-2 ring-emerald-300 bg-white' : 'ring-2 ring-rose-300 bg-white'}`}>
                    <CardHeader>
                      <div className="flex justify-between items-center mb-2">
                        <Badge variant="outline" className={isCorrect ? "text-emerald-800 bg-emerald-100 border-emerald-400 font-bold" : "text-rose-800 bg-rose-100 border-rose-400 font-bold"}>
                          Câu {idx + 1} - {isCorrect ? "✓ Chính xác" : "✗ Chưa chính xác"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase bg-gray-100 text-gray-700 border-gray-200 font-bold">
                          {q.points || (q.type === "TF" ? 1.0 : 0.25)} điểm
                        </Badge>
                      </div>
                      <CardTitle className="text-lg leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {q.content}
                        </ReactMarkdown>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {q.type === "MC" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options?.map((opt) => {
                            const isStudentChoice = studentAnswer === opt.id;
                            const isCorrectOpt = opt.isCorrect;
                            return (
                              <div key={opt.id} className={`p-3.5 rounded-xl border-2 flex items-start gap-3 transition-all ${
                                isCorrectOpt 
                                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-md font-bold' 
                                  : isStudentChoice 
                                  ? 'bg-blue-800 text-white border-blue-900 font-bold shadow-md' 
                                  : 'bg-white text-gray-700 border-gray-200'
                              }`}>
                                <span className={`px-2 py-0.5 rounded text-xs font-black shrink-0 ${
                                  isCorrectOpt ? 'bg-white text-emerald-900 shadow-xs' : isStudentChoice ? 'bg-white text-blue-900' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {opt.id}.
                                </span>
                                <div className="flex-1 text-sm leading-relaxed">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {opt.text}
                                  </ReactMarkdown>
                                </div>
                                {isCorrectOpt && (
                                  <span className="shrink-0 px-2.5 py-0.5 text-[10px] font-black bg-emerald-950 text-white rounded-full shadow-sm">
                                    ✓ ĐÁP ÁN ĐÚNG
                                  </span>
                                )}
                                {!isCorrectOpt && isStudentChoice && (
                                  <span className="shrink-0 px-2.5 py-0.5 text-[10px] font-black bg-blue-950 text-white rounded-full shadow-sm">
                                    LỰA CHỌN CỦA BẠN
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {q.type === "TF" && (
                        <div className="space-y-2">
                          {q.options?.map((opt, i) => {
                            const studentChoice = studentAnswer?.[`opt_${i}`];
                            const isCorrectChoice = studentChoice === opt.isCorrect;
                            return (
                              <div key={opt.id} className={`p-3 rounded-xl border-2 flex justify-between items-center ${
                                isCorrectChoice ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
                              }`}>
                                <div className="flex gap-3 items-start">
                                  <span className="font-bold text-sm">{String.fromCharCode(97 + i)}.</span>
                                  <div className="text-sm">
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                      {opt.text}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                                <div className="flex gap-2 text-xs font-bold shrink-0 ml-4">
                                  <span className={`px-2.5 py-1 rounded shadow-xs ${studentChoice === true ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-400"}`}>Đúng</span>
                                  <span className={`px-2.5 py-1 rounded shadow-xs ${studentChoice === false ? "bg-red-700 text-white" : "bg-gray-100 text-gray-400"}`}>Sai</span>
                                  <span className="mx-1 self-center text-gray-300">|</span>
                                  <span className="px-3 py-1 rounded-full bg-emerald-800 text-white font-black">Đáp án: {opt.isCorrect ? "Đúng" : "Sai"}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === "SA" && (
                        <div className="space-y-2">
                          <div className="p-3 rounded-xl border-2 bg-blue-50 border-blue-300">
                            <p className="text-xs font-bold uppercase text-blue-800 mb-1">Câu trả lời của bạn:</p>
                            <p className="font-mono font-bold text-blue-950 text-base">{studentAnswer || "(Chưa nhập câu trả lời)"}</p>
                          </div>
                          {!isCorrect && (
                            <div className="p-3 rounded-xl border-2 bg-emerald-50 border-emerald-400">
                              <p className="text-xs font-bold uppercase text-emerald-800 mb-1">Đáp án đúng:</p>
                              <p className="font-mono text-emerald-950 font-bold text-base">{q.correctAnswer}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {q.explanation && (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 mt-4">
                          <div className="text-xs font-bold text-amber-800 uppercase mb-1">Giải thích chi tiết:</div>
                          <div className="text-sm prose prose-sm max-w-none text-amber-950">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {q.explanation}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </React.Fragment>
              );
            })}
            <div className="flex justify-center pb-12">
              <Button variant="outline" size="lg" className="rounded-full px-8" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Quay lại đầu trang
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (started && exam) {
    const currentQuestion = exam.questions[currentQuestionIdx];
    
    let partHeader = null;
    if (currentQuestion.type === "MC") {
      partHeader = {
        title: "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn",
        desc: "Thí sinh trả lời từ câu hỏi đầu tiên. Mỗi câu hỏi thí sinh chỉ chọn một phương án."
      };
    } else if (currentQuestion.type === "TF") {
      partHeader = {
        title: "PHẦN II. Câu trắc nghiệm đúng sai",
        desc: "Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai."
      };
    } else if (currentQuestion.type === "SA") {
      partHeader = {
        title: "PHẦN III. Câu trắc nghiệm trả lời ngắn",
        desc: "Thí sinh nhập câu trả lời ngắn vào ô trống."
      };
    }

    return (
      <div className="max-w-6xl mx-auto pb-20">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm p-4 border-b flex justify-between items-center mb-6 rounded-b-xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">{exam.title}</h2>
              <p className="text-xs text-gray-600 font-medium">Học sinh: <span className="text-blue-700 font-bold">{studentName}</span> (Lớp {studentClass})</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-base ${timeLeft < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-800'}`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
        </div>

        {partHeader && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <h3 className="font-bold text-blue-900">{partHeader.title}</h3>
            <p className="text-xs text-blue-700 mt-1">{partHeader.desc}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 font-bold">
                        Câu {currentQuestionIdx + 1} / {exam.questions.length}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase bg-green-50 text-green-700 border-green-100 font-bold">
                        {currentQuestion.points || (currentQuestion.type === "TF" ? 1.0 : 0.25)} điểm
                      </Badge>
                    </div>
                    {currentQuestion.context && (
                      <div className="my-2 p-4 bg-amber-50/90 rounded-2xl border-2 border-amber-200/90 text-amber-950 text-sm leading-relaxed shadow-xs">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wide mb-2 pb-1 border-b border-amber-200/70">
                          <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>📖 Lời dẫn / Ngữ liệu chung</span>
                        </div>
                        <div className="prose prose-sm max-w-none text-amber-950 font-sans">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {currentQuestion.context}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    <CardTitle className="text-lg leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {currentQuestion.content}
                      </ReactMarkdown>
                      {currentQuestion.imageUrl && (
                        <div className="mt-4 flex justify-center">
                          <img 
                            src={currentQuestion.imageUrl} 
                            alt="Minh họa" 
                            className="rounded-xl border border-gray-100 max-h-64 object-contain bg-white shadow-sm" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {currentQuestion.type === "MC" && (
                      <RadioGroup 
                        value={answers[currentQuestion.id]} 
                        onValueChange={(val) => handleAnswerChange(currentQuestion.id, val)}
                        className="space-y-3"
                      >
                        {currentQuestion.options?.map(opt => {
                          const isSelected = answers[currentQuestion.id] === opt.id;
                          return (
                            <div key={opt.id} className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                              isSelected ? 'border-blue-700 bg-blue-800 text-white font-bold shadow-md' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                            }`}>
                              <RadioGroupItem value={opt.id} id={opt.id} className={isSelected ? "border-white text-white" : ""} />
                              <Label htmlFor={opt.id} className="flex-1 cursor-pointer font-medium flex gap-2 items-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-black ${isSelected ? 'bg-white text-blue-950' : 'bg-gray-100 text-gray-700'}`}>{opt.id}.</span>
                                <div className="flex-1">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {opt.text}
                                  </ReactMarkdown>
                                </div>
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    )}

                    {currentQuestion.type === "TF" && (
                      <div className="space-y-4">
                        {currentQuestion.options?.map((opt, optIdx) => {
                          const val = answers[currentQuestion.id]?.[`opt_${optIdx}`];
                          return (
                            <div key={opt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border-2 border-gray-200 bg-white gap-4 shadow-xs">
                              <span className="text-sm font-medium flex-1 flex gap-2 items-center">
                                <span className="font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-700">{String.fromCharCode(97 + optIdx)})</span>
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {opt.text}
                                </ReactMarkdown>
                              </span>
                              <div className="flex gap-2">
                                <Button 
                                  variant={val === true ? "default" : "outline"}
                                  size="sm"
                                  className={`flex-1 sm:flex-none h-9 px-4 text-xs font-bold ${val === true ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md' : 'border-gray-300'}`}
                                  onClick={() => handleAnswerChange(currentQuestion.id, { ...answers[currentQuestion.id], [`opt_${optIdx}`]: true })}
                                >
                                  Đúng
                                </Button>
                                <Button 
                                  variant={val === false ? "default" : "outline"}
                                  size="sm"
                                  className={`flex-1 sm:flex-none h-9 px-4 text-xs font-bold ${val === false ? 'bg-rose-700 hover:bg-rose-800 text-white shadow-md' : 'border-gray-300'}`}
                                  onClick={() => handleAnswerChange(currentQuestion.id, { ...answers[currentQuestion.id], [`opt_${optIdx}`]: false })}
                                >
                                  Sai
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {currentQuestion.type === "SA" && (
                      <Input 
                        placeholder="Nhập câu trả lời của bạn..."
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        className="h-12 font-mono font-bold text-base border-blue-300 focus:border-blue-600"
                      />
                    )}

                    {currentQuestion.type === "ESSAY" && (
                      <Textarea 
                        placeholder="Viết bài làm của bạn tại đây..."
                        className="min-h-[200px] text-base"
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      />
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between border-t p-6">
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                      disabled={currentQuestionIdx === 0}
                      className="h-11 px-6 font-bold"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Câu trước
                    </Button>
                    {currentQuestionIdx === exam.questions.length - 1 ? (
                      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-11 font-bold shadow-lg shadow-emerald-200" onClick={submitExam} disabled={loading}>
                        {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Nộp bài
                      </Button>
                    ) : (
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-11 font-bold shadow-lg shadow-blue-200" onClick={() => setCurrentQuestionIdx(prev => Math.min(exam.questions.length - 1, prev + 1))}>
                        Câu tiếp theo
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Tall Question Navigation Panel */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-sm sticky top-24">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-gray-500 flex justify-between items-center">
                  <span>Danh sách câu hỏi</span>
                  <span className="text-blue-600">{Object.keys(answers).length}/{exam.questions.length} đã làm</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-5 gap-2.5">
                  {exam.questions.map((q, idx) => {
                    const isAnswered = !!answers[q.id];
                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQuestionIdx(idx)}
                        className={`h-11 w-full rounded-xl text-sm font-black transition-all shadow-xs ${
                          currentQuestionIdx === idx 
                            ? 'bg-blue-700 text-white ring-4 ring-blue-200 shadow-md' 
                            : isAnswered 
                              ? 'bg-emerald-700 text-white shadow-sm' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 font-bold h-11" onClick={submitExam}>
                  Nộp bài sớm
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <Card className="border-none shadow-xl overflow-hidden">
          <div className="bg-blue-600 p-8 text-center text-white">
            <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-90" />
            <h2 className="text-2xl font-bold">Khu vực Học sinh</h2>
            <p className="text-blue-100 text-sm mt-2">Nhập mã đề thi & tài khoản để làm bài</p>
          </div>
          <CardContent className="p-8 space-y-6">
            {!exam ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold text-gray-700">Mã đề thi</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="Ví dụ: exam_17129..." 
                      className="pl-10 h-12 rounded-xl font-medium"
                      value={examCode}
                      onChange={(e) => setExamCode(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl font-bold text-base shadow-md shadow-blue-200" onClick={() => fetchExam()} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : "Tìm kiếm đề thi"}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-blue-900 text-base">{exam.title}</h3>
                  <div className="flex gap-4 mt-2 text-xs text-blue-700 font-medium">
                    <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {exam.subject}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {exam.timeLimit} phút</span>
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {exam.questions.length} câu</span>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium">
                    🔒 <span className="font-bold">Đăng nhập tài khoản học sinh:</span> Vui lòng nhập Mã học sinh và Mật khẩu được nhà trường cấp để làm bài.
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Mã học sinh (Mã HS) *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input 
                        placeholder="Ví dụ: HS1201..." 
                        className="pl-10 h-11 rounded-xl font-mono font-bold"
                        value={loginStudentId}
                        onChange={(e) => setLoginStudentId(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700">Mật khẩu *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input 
                        type="password"
                        placeholder="Nhập mật khẩu..." 
                        className="pl-10 h-11 rounded-xl font-medium"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl font-medium" onClick={() => setExam(null)}>Quay lại</Button>
                  <Button className="flex-[2] bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl font-bold shadow-lg shadow-emerald-200" onClick={verifyStudentAndStart} disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : "Xác thực & Bắt đầu"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
