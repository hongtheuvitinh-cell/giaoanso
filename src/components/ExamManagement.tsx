import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Users, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  Filter,
  UserPlus,
  Shield,
  User as UserIcon,
  Clock,
  ExternalLink,
  Trophy,
  Eye,
  Edit2,
  Share2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  School,
  BarChart3,
  RotateCcw
} from "lucide-react";
import { db, collection, onSnapshot, query, where, doc, deleteDoc, updateDoc, auth, getDocs } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Exam, ExamResult } from "@/types";
import { saveAs } from "file-saver";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: "admin" | "teacher" | "pending";
  createdAt: string;
}

interface ExamManagementProps {
  userProfile: UserProfile | null;
  onDuplicate?: (exam: Exam) => void;
  onEdit?: (exam: Exam) => void;
}

export default function ExamManagement({ userProfile, onDuplicate, onEdit }: ExamManagementProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [examSearch, setExamSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [resultSearch, setResultSearch] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<string>("all");
  const [selectedSchool, setSelectedSchool] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [viewResult, setViewResult] = useState<ExamResult | null>(null);
  const [deleteData, setDeleteData] = useState<{ id: string, type: 'exam' | 'result' } | null>(null);

  useEffect(() => {
    if (!userProfile) return;

    // Listen for exams
    let examQuery;
    if (userProfile.role === "admin") {
      examQuery = query(collection(db, "exams"));
    } else {
      examQuery = query(collection(db, "exams"), where("teacherId", "==", userProfile.uid));
    }

    const unsubscribeExams = onSnapshot(examQuery, (snapshot) => {
      const examList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Exam));
      setExams(examList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });

    // Listen for results
    // Note: Since results don't have teacherId, we fetch all for admin, 
    // and for teachers we'll filter client-side based on their exam IDs for simplicity 
    // or we could add teacherId to results. For now, let's fetch all and filter.
    const unsubscribeResults = onSnapshot(collection(db, "results"), (snapshot) => {
      const resultList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ExamResult));
      setResults(resultList.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    });

    // Listen for users (Admin only)
    let unsubscribeUsers = () => {};
    if (userProfile.role === "admin") {
      const userQuery = query(collection(db, "users"));
      unsubscribeUsers = onSnapshot(userQuery, (snapshot) => {
        const userList = snapshot.docs.map(doc => doc.data() as UserProfile);
        setUsers(userList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      });
    }

    return () => {
      unsubscribeExams();
      unsubscribeResults();
      unsubscribeUsers();
    };
  }, [userProfile]);

  const handleDeleteResult = async (resultId: string) => {
    try {
      await deleteDoc(doc(db, "results", resultId));
      toast.success("Đã xóa kết quả thành công.");
      setDeleteData(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa kết quả.");
    }
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      // 1. Delete associated results first
      const resultsQuery = query(collection(db, "results"), where("examId", "==", examId));
      const snapshot = await getDocs(resultsQuery);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "results", d.id)));
      await Promise.all(deletePromises);

      // 2. Delete the exam
      await deleteDoc(doc(db, "exams", examId));
      toast.success("Đã xóa đề thi và các kết quả liên quan thành công.");
      setDeleteData(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa đề thi.");
    }
  };

  const handleUpdateRole = async (uid: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", uid), { role: newRole });
      toast.success(`Đã cập nhật vai trò thành công.`);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi cập nhật vai trò.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Đã sao chép mã đề!");
  };

  const copyShareLink = (examId: string) => {
    const shareUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?code=${examId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLinkId(examId);
    setTimeout(() => setCopiedLinkId(null), 2000);
    toast.success("Đã sao chép link đề thi cho học sinh!");
  };

  const filteredExams = exams.filter(e => 
    e.title.toLowerCase().includes(examSearch.toLowerCase()) || 
    e.id.toLowerCase().includes(examSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.displayName && u.displayName.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const teacherExamIds = new Set(exams.map(e => e.id));

  // Extract distinct schools and classes from results for dropdown filters
  const availableSchools = Array.from(
    new Set(
      results
        .filter(r => userProfile.role === "admin" || teacherExamIds.has(r.examId))
        .map(r => r.schoolName?.trim())
        .filter(Boolean) as string[]
    )
  ).sort();

  const availableClasses = Array.from(
    new Set(
      results
        .filter(r => (userProfile.role === "admin" || teacherExamIds.has(r.examId)) && (selectedSchool === "all" || r.schoolName?.trim() === selectedSchool))
        .map(r => r.studentClass?.trim())
        .filter(Boolean) as string[]
    )
  ).sort();

  const filteredResults = results.filter(r => {
    // Teacher access check
    if (userProfile.role !== "admin" && !teacherExamIds.has(r.examId)) {
      return false;
    }

    // Exam filter
    if (selectedExamId !== "all" && r.examId !== selectedExamId) {
      return false;
    }

    // School filter
    if (selectedSchool !== "all" && (r.schoolName?.trim() || "") !== selectedSchool) {
      return false;
    }

    // Class filter
    if (selectedClass !== "all" && (r.studentClass?.trim() || "") !== selectedClass) {
      return false;
    }

    // Search query
    if (resultSearch.trim()) {
      const q = resultSearch.toLowerCase().trim();
      const matchName = (r.studentName || "").toLowerCase().includes(q);
      const matchClass = (r.studentClass || "").toLowerCase().includes(q);
      const matchSchool = (r.schoolName || "").toLowerCase().includes(q);
      const matchCombined = (r.displayNameCombined || "").toLowerCase().includes(q);
      const matchExam = (r.examTitle || "").toLowerCase().includes(q);
      const matchExamId = (r.examId || "").toLowerCase().includes(q);
      if (!matchName && !matchClass && !matchSchool && !matchCombined && !matchExam && !matchExamId) {
        return false;
      }
    }

    return true;
  });

  const handleExportFilteredResults = () => {
    if (filteredResults.length === 0) {
      toast.error("Không có dữ liệu kết quả để xuất.");
      return;
    }

    const headers = [
      "STT",
      "Họ và tên",
      "Lớp",
      "Trường",
      "Định danh (Tên_Lớp_Trường)",
      "Đề thi",
      "Mã đề thi",
      "Điểm số (/10)",
      "Số câu đúng",
      "Tổng số câu",
      "Tỷ lệ đúng (%)",
      "Thời gian nộp bài"
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredResults.map((r, index) => {
      const sName = r.studentName || "";
      const sClass = r.studentClass || "";
      const sSchool = r.schoolName || "";
      const combined = r.displayNameCombined || [sName, sClass, sSchool].filter(Boolean).join(" _ ");
      const percent = r.totalQuestions > 0 ? ((r.correctAnswers / r.totalQuestions) * 100).toFixed(1) : "0";
      const dateStr = new Date(r.submittedAt).toLocaleString("vi-VN");

      return [
        index + 1,
        escapeCsv(sName),
        escapeCsv(sClass),
        escapeCsv(sSchool),
        escapeCsv(combined),
        escapeCsv(r.examTitle),
        escapeCsv(r.examId),
        r.score.toFixed(1),
        r.correctAnswers,
        r.totalQuestions,
        `${percent}%`,
        escapeCsv(dateStr)
      ].join(",");
    });

    const total = filteredResults.length;
    const avg = (filteredResults.reduce((acc, cur) => acc + cur.score, 0) / total).toFixed(2);
    const max = Math.max(...filteredResults.map(r => r.score)).toFixed(1);
    const min = Math.min(...filteredResults.map(r => r.score)).toFixed(1);
    const passCount = filteredResults.filter(r => r.score >= 5.0).length;
    const passRate = ((passCount / total) * 100).toFixed(1);

    const schoolLabel = selectedSchool && selectedSchool !== "all" ? selectedSchool : "Tất cả trường";
    const classLabel = selectedClass && selectedClass !== "all" ? selectedClass : "Tất cả lớp";
    const examLabel = selectedExamId && selectedExamId !== "all" ? (exams.find(e => e.id === selectedExamId)?.title || selectedExamId) : "Tất cả đề thi";

    const summaryHeader = [
      `# BÁO CÁO THỐNG KÊ KẾT QUẢ THI TRỰC TUYẾN`,
      `# Đề thi: ${examLabel}`,
      `# Trường: ${schoolLabel}`,
      `# Lớp: ${classLabel}`,
      `# Thời gian xuất: ${new Date().toLocaleString("vi-VN")}`,
      `# Tổng số bài thi: ${total} | Điểm trung bình: ${avg} | Điểm cao nhất: ${max} | Điểm thấp nhất: ${min} | Tỷ lệ đạt (>=5.0): ${passRate}%`,
      ""
    ].join("\n");

    const csvContent = "\uFEFF" + summaryHeader + "\n" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const safeSchool = schoolLabel.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, "_");
    const safeClass = classLabel.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, "_");
    const fileName = `KetQua_${safeSchool}_${safeClass}_${new Date().toISOString().slice(0, 10)}.csv`;

    saveAs(blob, fileName);
    toast.success(`Đã xuất file kết quả thống kê (${fileName}) thành công!`);
  };

  const handleResetFilters = () => {
    setSelectedExamId("all");
    setSelectedSchool("all");
    setSelectedClass("all");
    setResultSearch("");
    toast.info("Đã đặt lại tất cả bộ lọc kết quả.");
  };

  if (!userProfile) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quản lý hệ thống</h2>
          <p className="text-gray-500 text-sm">
            {userProfile.role === "admin" ? "Quản trị viên toàn hệ thống" : "Quản lý đề thi của bạn"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="exams" className="w-full">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-lg shadow-sm mb-6">
          <TabsTrigger value="exams" className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <FileText className="w-4 h-4 mr-2" />
            Đề thi ({exams.length})
          </TabsTrigger>
          <TabsTrigger value="results" className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <Trophy className="w-4 h-4 mr-2" />
            Kết quả ({filteredResults.length})
          </TabsTrigger>
          {userProfile.role === "admin" && (
            <TabsTrigger value="users" className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
              <Users className="w-4 h-4 mr-2" />
              Người dùng ({users.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="exams" className="space-y-4">
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <Search className="w-5 h-5 text-gray-400" />
            <Input 
              placeholder="Tìm kiếm theo tên đề hoặc mã đề..." 
              className="border-none focus-visible:ring-0 text-sm"
              value={examSearch}
              onChange={(e) => setExamSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExams.map((exam) => (
              <Card key={exam.id} className="border-none shadow-sm hover:shadow-md transition-all group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none w-fit">
                        {exam.subject}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] w-fit ${exam.status === 'published' ? 'border-green-200 text-green-600 bg-green-50' : 'border-amber-200 text-amber-600 bg-amber-50'}`}
                      >
                        {exam.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                      </Badge>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => setPreviewExam(exam)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50" onClick={() => onEdit?.(exam)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => onDuplicate?.(exam)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteData({ id: exam.id, type: 'exam' })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-2 line-clamp-1">{exam.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(exam.createdAt).toLocaleDateString("vi-VN")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase">Mã đề thi</span>
                      <code className="text-xs font-mono text-gray-600">{exam.id}</code>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 hover:text-blue-600" onClick={() => copyToClipboard(exam.id)}>
                      {copiedId === exam.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  {exam.status === 'published' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-9 gap-1.5 text-xs text-blue-600 hover:text-white hover:bg-blue-600 border-blue-200 transition-all font-semibold"
                      onClick={() => copyShareLink(exam.id)}
                    >
                      {copiedLinkId === exam.id ? (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          Đã sao chép link đề!
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          Sao chép Link học sinh
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredExams.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Chưa có đề thi nào được tạo.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {/* Filter & Export Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              <div className="flex flex-1 flex-wrap sm:flex-nowrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Tìm theo tên học sinh, lớp, trường, mã đề..." 
                    className="pl-9 h-10 rounded-xl text-sm"
                    value={resultSearch}
                    onChange={(e) => setResultSearch(e.target.value)}
                  />
                </div>

                {/* Filter by Exam */}
                <div className="w-full sm:w-[220px]">
                  <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                      <FileText className="w-3.5 h-3.5 mr-1 text-blue-600 shrink-0" />
                      <SelectValue placeholder="Chọn đề thi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả đề thi ({exams.length})</SelectItem>
                      {exams.map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by School */}
                <div className="w-full sm:w-[200px]">
                  <Select value={selectedSchool} onValueChange={(val) => {
                    setSelectedSchool(val);
                    setSelectedClass("all"); // reset class when school changes
                  }}>
                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                      <School className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
                      <SelectValue placeholder="Chọn trường" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trường ({availableSchools.length})</SelectItem>
                      {availableSchools.map((sch) => (
                        <SelectItem key={sch} value={sch}>
                          {sch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Class */}
                <div className="w-full sm:w-[160px]">
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                      <GraduationCap className="w-3.5 h-3.5 mr-1 text-purple-600 shrink-0" />
                      <SelectValue placeholder="Chọn lớp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả lớp ({availableClasses.length})</SelectItem>
                      {availableClasses.map((cls) => (
                        <SelectItem key={cls} value={cls}>
                          Lớp {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(selectedExamId !== "all" || selectedSchool !== "all" || selectedClass !== "all" || resultSearch.trim()) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleResetFilters} 
                    className="h-10 px-3 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl shrink-0"
                    title="Đặt lại bộ lọc"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Đặt lại
                  </Button>
                )}
              </div>

              {/* Export Button */}
              <div className="flex gap-2 shrink-0">
                <Button 
                  onClick={handleExportFilteredResults}
                  disabled={filteredResults.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 rounded-xl shadow-sm text-xs sm:text-sm gap-2 w-full lg:w-auto"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Xuất file thống kê KQ ({filteredResults.length})
                </Button>
              </div>
            </div>

            {/* Statistics Summary Strip */}
            {filteredResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100/70">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">Tổng bài thi</span>
                  <span className="text-xl font-black text-blue-900">{filteredResults.length}</span>
                </div>
                <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100/70">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase block">Điểm trung bình</span>
                  <span className="text-xl font-black text-indigo-900">
                    {(filteredResults.reduce((acc, c) => acc + c.score, 0) / filteredResults.length).toFixed(2)}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100/70">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Điểm cao nhất</span>
                  <span className="text-xl font-black text-emerald-900">
                    {Math.max(...filteredResults.map(r => r.score)).toFixed(1)}
                  </span>
                </div>
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100/70">
                  <span className="text-[10px] font-bold text-amber-600 uppercase block">Điểm thấp nhất</span>
                  <span className="text-xl font-black text-amber-900">
                    {Math.min(...filteredResults.map(r => r.score)).toFixed(1)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-purple-50/70 p-3 rounded-xl border border-purple-100/70">
                  <span className="text-[10px] font-bold text-purple-600 uppercase block">Tỷ lệ đạt (&ge;5.0)</span>
                  <span className="text-xl font-black text-purple-900">
                    {((filteredResults.filter(r => r.score >= 5.0).length / filteredResults.length) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3.5 font-bold">Học sinh / Lớp / Trường</th>
                    <th className="px-5 py-3.5 font-bold">Đề thi</th>
                    <th className="px-5 py-3.5 font-bold text-center">Điểm số</th>
                    <th className="px-5 py-3.5 font-bold">Thời gian nộp</th>
                    <th className="px-5 py-3.5 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredResults.map((res) => {
                    const combined = res.displayNameCombined || [res.studentName, res.studentClass, res.schoolName].filter(Boolean).join(" _ ");
                    return (
                      <tr key={res.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            <div className="font-bold text-gray-900 text-base">{res.studentName}</div>
                            
                            {/* Combined Identifier: Tên _ Lớp _ Trường */}
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-mono font-bold max-w-full truncate">
                              <span>🏷️</span>
                              <span className="truncate">{combined}</span>
                            </div>

                            {/* Badges for Class and School */}
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {res.studentClass && (
                                <Badge variant="outline" className="text-[11px] font-semibold text-blue-700 bg-blue-50 border-blue-200">
                                  <GraduationCap className="w-3 h-3 mr-1" />
                                  Lớp {res.studentClass}
                                </Badge>
                              )}
                              {res.schoolName && (
                                <Badge variant="outline" className="text-[11px] font-medium text-gray-700 bg-gray-50 border-gray-200">
                                  <School className="w-3 h-3 mr-1" />
                                  {res.schoolName}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-gray-900 line-clamp-1">{res.examTitle}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">Mã: {res.examId}</div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <Badge className={`text-sm px-3 py-1 font-bold ${
                              res.score >= 8 ? 'bg-emerald-600 text-white' : 
                              res.score >= 5 ? 'bg-blue-600 text-white' : 
                              'bg-rose-600 text-white'
                            }`}>
                              {res.score.toFixed(1)} / 10
                            </Badge>
                            <span className="text-[11px] text-gray-500 font-medium mt-1">
                              Đúng {res.correctAnswers}/{res.totalQuestions} câu
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 text-xs">
                          {new Date(res.submittedAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                              onClick={() => setViewResult(res)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Chi tiết
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteData({ id: res.id, type: 'result' })}
                              title="Xóa kết quả"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredResults.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-gray-600">Không tìm thấy kết quả nào phù hợp với bộ lọc.</p>
                        <p className="text-xs text-gray-400 mt-1">Hãy thử đổi trường, lớp hoặc từ khóa tìm kiếm.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {userProfile.role === "admin" && (
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <Search className="w-5 h-5 text-gray-400" />
              <Input 
                placeholder="Tìm kiếm theo email hoặc tên..." 
                className="border-none focus-visible:ring-0 text-sm"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Người dùng</th>
                      <th className="px-6 py-4 font-medium">Vai trò</th>
                      <th className="px-6 py-4 font-medium">Ngày tham gia</th>
                      <th className="px-6 py-4 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{user.displayName || "N/A"}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            variant="outline" 
                            className={`
                              ${user.role === "admin" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : ""}
                              ${user.role === "teacher" ? "border-blue-200 text-blue-700 bg-blue-50" : ""}
                              ${user.role === "pending" ? "border-amber-200 text-amber-700 bg-amber-50" : ""}
                            `}
                          >
                            {user.role === "admin" && <Shield className="w-3 h-3 mr-1" />}
                            {user.role === "teacher" && <UserIcon className="w-3 h-3 mr-1" />}
                            {user.role === "pending" && <Clock className="w-3 h-3 mr-1" />}
                            {user.role === "admin" ? "Admin" : user.role === "teacher" ? "Giáo viên" : "Chờ duyệt"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {user.role !== "admin" && (
                              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleUpdateRole(user.uid, "admin")}>
                                Lên Admin
                              </Button>
                            )}
                            {user.role !== "teacher" && (
                              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleUpdateRole(user.uid, "teacher")}>
                                Duyệt GV
                              </Button>
                            )}
                            {user.role !== "pending" && (
                              <Button variant="outline" size="sm" className="h-8 text-xs text-amber-600" onClick={() => handleUpdateRole(user.uid, "pending")}>
                                Hạ cấp
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!previewExam} onOpenChange={(open) => !open && setPreviewExam(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 pb-4 border-b border-gray-100 shrink-0">
            <DialogHeader>
              <DialogTitle>{previewExam?.title}</DialogTitle>
              <DialogDescription>
                {previewExam?.subject} - Lớp {previewExam?.grade} | {previewExam?.timeLimit} phút
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="space-y-8 pb-12">
              {previewExam?.questions.map((q, idx) => (
                <div key={q.id} className="space-y-4">
                  <div className="font-medium flex justify-between items-start gap-2">
                    <div className="flex gap-2">
                      <span className="shrink-0">Câu {idx + 1}:</span>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {q.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 bg-gray-50 text-gray-500 border-gray-100">
                      {q.points || (q.type === "TF" ? 1.0 : 0.25)}đ
                    </Badge>
                  </div>
                  {q.imageUrl && (
                    <div className="ml-4">
                      <img 
                        src={q.imageUrl} 
                        alt="Minh họa" 
                        className="rounded-lg border border-gray-100 max-h-48 object-contain bg-white" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  {q.type === "MC" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-4">
                      {q.options?.map((opt) => (
                        <div key={opt.id} className={`p-2 rounded border flex gap-2 ${opt.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-100'}`}>
                          <span className="font-bold">{opt.id}.</span>
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {opt.text}
                          </ReactMarkdown>
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === "TF" && (
                    <div className="space-y-2 ml-4">
                      {q.options?.map((opt, optIdx) => (
                        <div key={opt.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-100 gap-4">
                          <div className="flex gap-2">
                            <span className="font-bold">{String.fromCharCode(97 + optIdx)}.</span>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {opt.text}
                            </ReactMarkdown>
                          </div>
                          <Badge variant={opt.isCorrect ? "default" : "destructive"}>
                            {opt.isCorrect ? "Đúng" : "Sai"}
                          </Badge>
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
                  {q.explanation && (
                    <div className="ml-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">Lời giải chi tiết:</div>
                      <div className="text-sm prose prose-sm max-w-none text-amber-900">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {q.explanation}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewResult} onOpenChange={(open) => !open && setViewResult(null)}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 pb-4 border-b border-gray-100 shrink-0 bg-white">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                    {viewResult?.studentName}
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                    <span className="font-semibold text-gray-800">{viewResult?.examTitle}</span>
                    <span>•</span>
                    <span>Nộp lúc: {viewResult && new Date(viewResult.submittedAt).toLocaleString("vi-VN")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-right">
                    <div className="text-[10px] uppercase font-bold text-blue-600">Điểm số</div>
                    <div className="text-xl font-black text-blue-700">{viewResult?.score.toFixed(1)} / 10</div>
                  </div>
                </div>
              </div>

              {/* Badges for Identifier, Class, and School */}
              <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-gray-100">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-mono font-bold">
                  <span>🏷️</span>
                  <span>{viewResult?.displayNameCombined || [viewResult?.studentName, viewResult?.studentClass, viewResult?.schoolName].filter(Boolean).join(" _ ")}</span>
                </div>
                {viewResult?.studentClass && (
                  <Badge variant="outline" className="text-xs font-semibold text-blue-700 bg-blue-50 border-blue-200">
                    <GraduationCap className="w-3.5 h-3.5 mr-1" />
                    Lớp {viewResult.studentClass}
                  </Badge>
                )}
                {viewResult?.schoolName && (
                  <Badge variant="outline" className="text-xs font-medium text-gray-700 bg-gray-50 border-gray-200">
                    <School className="w-3.5 h-3.5 mr-1" />
                    {viewResult.schoolName}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  Đúng {viewResult?.correctAnswers}/{viewResult?.totalQuestions} câu
                </Badge>
              </div>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="space-y-6 pb-12">
              {viewResult && exams.find(e => e.id === viewResult.examId)?.questions.map((q, idx) => {
                const studentAnswer = viewResult.answers[q.id];
                return (
                  <div key={q.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3">
                    <div className="font-medium flex gap-2">
                      <span className="shrink-0 text-blue-600">Câu {idx + 1}:</span>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {q.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    <div className="ml-8 space-y-2">
                      {q.type === "MC" && (
                        <div className="grid grid-cols-1 gap-2">
                          {q.options?.map((opt) => {
                            const isSelected = studentAnswer === opt.id;
                            const isCorrect = opt.isCorrect;
                            return (
                              <div 
                                key={opt.id} 
                                className={`p-2 rounded border flex items-center gap-2 text-sm ${
                                  isSelected && isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                  isSelected && !isCorrect ? 'bg-red-50 border-red-200 text-red-700' :
                                  !isSelected && isCorrect ? 'bg-emerald-50/50 border-emerald-100 text-emerald-600' :
                                  'bg-white border-gray-100'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-current' : ''}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="font-bold">{opt.id}.</span>
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {opt.text}
                                </ReactMarkdown>
                                {isSelected && !isCorrect && <span className="ml-auto text-[10px] font-bold uppercase">Sai</span>}
                                {isSelected && isCorrect && <span className="ml-auto text-[10px] font-bold uppercase">Đúng</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === "TF" && (
                        <div className="space-y-2">
                          {q.options?.map((opt, optIdx) => {
                            const studentChoice = studentAnswer?.[`opt_${optIdx}`]; // boolean
                            const isCorrect = (studentChoice === true && opt.isCorrect) || (studentChoice === false && !opt.isCorrect);
                            return (
                              <div key={opt.id} className="flex flex-col gap-1 p-2 bg-white rounded border border-gray-100">
                                <div className="flex justify-between items-center gap-4">
                                  <div className="flex gap-2 text-sm">
                                    <span className="font-bold">{String.fromCharCode(97 + optIdx)}.</span>
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                      {opt.text}
                                    </ReactMarkdown>
                                  </div>
                                  <Badge variant={opt.isCorrect ? "default" : "destructive"} className="text-[10px] h-5">
                                    {opt.isCorrect ? "Đúng" : "Sai"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-gray-500">HS chọn:</span>
                                  <Badge variant="outline" className={`text-[10px] h-5 ${studentChoice !== undefined ? (isCorrect ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-red-200 text-red-700 bg-red-50') : 'border-gray-200 text-gray-400'}`}>
                                    {studentChoice === true ? "Đúng" : studentChoice === false ? "Sai" : "Chưa chọn"}
                                    {studentChoice !== undefined && (isCorrect ? " (Chính xác)" : " (Sai)")}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === "SA" && (
                        <div className="space-y-2">
                          <div className="p-2 bg-white rounded border border-gray-100 text-sm">
                            <span className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">HS trả lời:</span>
                            <div className={studentAnswer === q.correctAnswer ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                              {studentAnswer || "(Trống)"}
                            </div>
                          </div>
                          <div className="p-2 bg-emerald-50 rounded border border-emerald-100 text-sm text-emerald-700">
                            <span className="text-[10px] text-emerald-600 block mb-1 uppercase font-bold">Đáp án đúng:</span>
                            {q.correctAnswer}
                          </div>
                        </div>
                      )}

                      {q.type === "ESSAY" && (
                        <div className="p-2 bg-white rounded border border-gray-100 text-sm">
                          <span className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">HS trả lời:</span>
                          <div className="whitespace-pre-wrap">{studentAnswer || "(Trống)"}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Confirmation Dialog */}
      <Dialog open={!!deleteData} onOpenChange={(open) => !open && setDeleteData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Xác nhận xóa
            </DialogTitle>
            <DialogDescription className="py-4">
              {deleteData?.type === 'exam' 
                ? "Bạn có chắc chắn muốn xóa đề thi này? Hành động này sẽ xóa vĩnh viễn đề thi và tất cả các kết quả làm bài liên quan. Thao tác này không thể hoàn tác."
                : "Bạn có chắc chắn muốn xóa kết quả làm bài này? Thao tác này không thể hoàn tác."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteData(null)}>
              Hủy bỏ
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (deleteData?.type === 'exam') handleDeleteExam(deleteData.id);
                else if (deleteData?.type === 'result') handleDeleteResult(deleteData.id);
              }}
            >
              Xác nhận xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
