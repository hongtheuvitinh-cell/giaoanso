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
  GraduationCap
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
import { db, doc, getDoc, addDoc, collection, handleFirestoreError, OperationType } from "@/lib/firebase";
import { Exam, Question } from "@/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default function StudentExam() {
  const [examCode, setExamCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [result, setResult] = useState<any>(null);

  const fetchExam = async () => {
    if (!examCode.trim()) {
      toast.error("Vui lòng nhập mã đề thi.");
      return;
    }
    setLoading(true);
    try {
      const docRef = doc(db, "exams", examCode.trim());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Exam;
        setExam(data);
        setTimeLeft(data.timeLimit * 60);
      } else {
        toast.error("Không tìm thấy đề thi với mã này.");
      }
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.GET, `exams/${examCode.trim()}`);
      } catch (wrappedErr) {
        console.error(wrappedErr);
        toast.error("Lỗi khi tải đề thi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const startExam = () => {
    if (!studentName.trim()) {
      toast.error("Vui lòng nhập họ tên của bạn.");
      return;
    }
    setStarted(true);
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
      let correctCount = 0;
      exam.questions.forEach(q => {
        const studentAnswer = answers[q.id];
        if (q.type === "MC") {
          const correctOpt = q.options?.find(o => o.isCorrect);
          if (correctOpt && studentAnswer === correctOpt.id) correctCount++;
        } else if (q.type === "TF") {
          // Simplified TF check
          const allCorrect = q.options?.every(opt => {
            const studentVal = studentAnswer?.[opt.id] || false;
            return studentVal === opt.isCorrect;
          });
          if (allCorrect) correctCount++;
        } else if (q.type === "SA") {
          if (studentAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()) correctCount++;
        }
      });

      const score = (correctCount / exam.questions.length) * 10;
      const resultData = {
        studentName,
        examId: exam.id,
        examTitle: exam.title,
        score,
        totalQuestions: exam.questions.length,
        correctAnswers: correctCount,
        submittedAt: new Date().toISOString(),
        answers
      };

      await addDoc(collection(db, "results"), resultData);
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
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Học sinh:</span>
                  <span className="font-bold">{result.studentName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Thời gian nộp:</span>
                  <span>{new Date(result.submittedAt).toLocaleString()}</span>
                </div>
              </div>
              <Button className="w-full bg-gray-900 text-white h-12 rounded-xl" onClick={() => window.location.reload()}>
                Thoát
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (started && exam) {
    const currentQuestion = exam.questions[currentQuestionIdx];
    return (
      <div className="max-w-4xl mx-auto pb-20">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm p-4 border-b flex justify-between items-center mb-6 rounded-b-xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">{exam.title}</h2>
              <p className="text-xs text-gray-500">Học sinh: {studentName}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold ${timeLeft < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        </div>

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
                      <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-100">
                        Câu {currentQuestionIdx + 1} / {exam.questions.length}
                      </Badge>
                      <span className="text-xs text-gray-400">{currentQuestion.type}</span>
                    </div>
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
                        {currentQuestion.options?.map(opt => (
                          <div key={opt.id} className={`flex items-center space-x-3 p-4 rounded-xl border transition-all cursor-pointer ${answers[currentQuestion.id] === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                            <RadioGroupItem value={opt.id} id={opt.id} />
                            <Label htmlFor={opt.id} className="flex-1 cursor-pointer font-medium flex gap-2">
                              <span className="font-bold">{opt.id}.</span>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {opt.text}
                              </ReactMarkdown>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {currentQuestion.type === "TF" && (
                      <div className="space-y-4">
                        {currentQuestion.options?.map((opt, optIdx) => (
                          <div key={opt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 gap-4">
                            <span className="text-sm font-medium flex-1 flex gap-2">
                              <span className="font-bold">{String.fromCharCode(97 + optIdx)})</span>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {opt.text}
                              </ReactMarkdown>
                            </span>
                            <div className="flex gap-2">
                              <Button 
                                variant={answers[currentQuestion.id]?.[opt.id] === true ? "default" : "outline"}
                                size="sm"
                                className={`flex-1 sm:flex-none h-8 text-xs ${answers[currentQuestion.id]?.[opt.id] === true ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                onClick={() => handleAnswerChange(currentQuestion.id, { ...answers[currentQuestion.id], [opt.id]: true })}
                              >
                                Đúng
                              </Button>
                              <Button 
                                variant={answers[currentQuestion.id]?.[opt.id] === false ? "default" : "outline"}
                                size="sm"
                                className={`flex-1 sm:flex-none h-8 text-xs ${answers[currentQuestion.id]?.[opt.id] === false ? 'bg-red-600 hover:bg-red-700' : ''}`}
                                onClick={() => handleAnswerChange(currentQuestion.id, { ...answers[currentQuestion.id], [opt.id]: false })}
                              >
                                Sai
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {currentQuestion.type === "SA" && (
                      <Input 
                        placeholder="Nhập câu trả lời của bạn..."
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        className="h-12"
                      />
                    )}

                    {currentQuestion.type === "ESSAY" && (
                      <Textarea 
                        placeholder="Viết bài làm của bạn tại đây..."
                        className="min-h-[200px]"
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
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Câu trước
                    </Button>
                    {currentQuestionIdx === exam.questions.length - 1 ? (
                      <Button className="bg-green-600 hover:bg-green-700 text-white px-8" onClick={submitExam} disabled={loading}>
                        {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Nộp bài
                      </Button>
                    ) : (
                      <Button onClick={() => setCurrentQuestionIdx(prev => Math.min(exam.questions.length - 1, prev + 1))}>
                        Câu tiếp theo
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-400">Danh sách câu hỏi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {exam.questions.map((q, idx) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIdx(idx)}
                      className={`h-10 w-10 rounded-lg text-xs font-bold transition-all ${
                        currentQuestionIdx === idx 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : answers[q.id] 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full text-red-600 border-red-100 hover:bg-red-50" onClick={submitExam}>
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
            <p className="text-blue-100 text-sm mt-2">Nhập mã đề thi để bắt đầu làm bài</p>
          </div>
          <CardContent className="p-8 space-y-6">
            {!exam ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Mã đề thi</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="Ví dụ: exam_17129..." 
                      className="pl-10 h-12 rounded-xl"
                      value={examCode}
                      onChange={(e) => setExamCode(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl font-bold" onClick={fetchExam} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : "Tìm kiếm đề thi"}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-blue-900">{exam.title}</h3>
                  <div className="flex gap-4 mt-2 text-xs text-blue-700">
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {exam.subject}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {exam.timeLimit} phút</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Họ và tên của bạn</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="Nhập họ tên đầy đủ..." 
                      className="pl-10 h-12 rounded-xl"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setExam(null)}>Quay lại</Button>
                  <Button className="flex-[2] bg-green-600 hover:bg-green-700 h-12 rounded-xl font-bold" onClick={startExam}>Bắt đầu làm bài</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
