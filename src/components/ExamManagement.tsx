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
  RotateCcw,
  Folder as FolderIcon,
  FolderPlus,
  Lock,
  Key
} from "lucide-react";
import { db, collection, onSnapshot, query, where, doc, deleteDoc, updateDoc, setDoc, auth, getDocs } from "@/lib/firebase";
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
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Exam, ExamResult, Folder, StudentAccount } from "@/types";
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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [studentAccounts, setStudentAccounts] = useState<StudentAccount[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [examSearch, setExamSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("exams");
  const [userSearch, setUserSearch] = useState("");
  const [resultSearch, setResultSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [selectedExamId, setSelectedExamId] = useState<string>("all");
  const [selectedSchool, setSelectedSchool] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [viewResult, setViewResult] = useState<ExamResult | null>(null);
  const [deleteData, setDeleteData] = useState<{ id: string, type: 'exam' | 'result' | 'folder' | 'student' } | null>(null);

  // Folder creation modal state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderGrade, setNewFolderGrade] = useState("12");

  // Student Account creation modal state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentClass, setNewStudentClass] = useState("");
  const [newStudentSchool, setNewStudentSchool] = useState("");

  // Assign exam to folder modal
  const [assignExamModal, setAssignExamModal] = useState<Exam | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>("none");

  useEffect(() => {
    if (!userProfile) return;

    // Listen for exams
    let examQuery = query(collection(db, "exams"));
    if (userProfile.role !== "admin") {
      examQuery = query(collection(db, "exams"), where("teacherId", "==", userProfile.uid));
    }
    const unsubscribeExams = onSnapshot(examQuery, (snapshot) => {
      const examList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Exam));
      setExams(examList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });

    // Listen for folders
    const folderQuery = query(collection(db, "folders"));
    const unsubscribeFolders = onSnapshot(folderQuery, (snapshot) => {
      const folderList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Folder));
      setFolders(folderList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    // Listen for student accounts
    const studentAccQuery = query(collection(db, "studentAccounts"));
    const unsubscribeStudents = onSnapshot(studentAccQuery, (snapshot) => {
      const accList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudentAccount));
      setStudentAccounts(accList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    // Listen for results
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
      unsubscribeFolders();
      unsubscribeStudents();
      unsubscribeResults();
      unsubscribeUsers();
    };
  }, [userProfile]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Vui lòng nhập tên thư mục.");
      return;
    }
    try {
      const folderId = `folder_${Date.now()}`;
      const newFolder: Folder = {
        id: folderId,
        name: newFolderName.trim(),
        grade: newFolderGrade.trim(),
        teacherId: userProfile?.uid || "",
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "folders", folderId), newFolder);
      toast.success("Đã tạo thư mục thành công!");
      setNewFolderName("");
      setShowFolderModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi tạo thư mục.");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteDoc(doc(db, "folders", folderId));
      toast.success("Đã xóa thư mục thành công.");
      setDeleteData(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa thư mục.");
    }
  };

  const handleCreateStudentAccount = async () => {
    if (!newStudentId.trim() || !newStudentPassword.trim() || !newStudentName.trim() || !newStudentClass.trim()) {
      toast.error("Vui lòng điền đầy đủ Mã HS, Mật khẩu, Họ tên và Lớp.");
      return;
    }
    try {
      const accId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newAcc: StudentAccount = {
        id: accId,
        studentId: newStudentId.trim(),
        password: newStudentPassword.trim(),
        fullName: newStudentName.trim(),
        studentClass: newStudentClass.trim(),
        schoolName: newStudentSchool.trim(),
        teacherId: userProfile?.uid || "",
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "studentAccounts", accId), newAcc);
      toast.success(`Đã cấp tài khoản cho học sinh ${newStudentName} thành công!`);
      setNewStudentId("");
      setNewStudentPassword("");
      setNewStudentName("");
      setNewStudentClass("");
      setNewStudentSchool("");
      setShowStudentModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi tạo tài khoản học sinh.");
    }
  };

  const handleDeleteStudentAccount = async (accId: string) => {
    try {
      await deleteDoc(doc(db, "studentAccounts", accId));
      toast.success("Đã xóa tài khoản học sinh thành công.");
      setDeleteData(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa tài khoản.");
    }
  };

  const handleAssignFolder = async () => {
    if (!assignExamModal) return;
    try {
      await updateDoc(doc(db, "exams", assignExamModal.id), {
        folderId: targetFolderId === "none" ? null : targetFolderId
      });
      toast.success("Đã cập nhật thư mục cho đề thi thành công!");
      setAssignExamModal(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi gán thư mục.");
    }
  };

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
      const resultsQuery = query(collection(db, "results"), where("examId", "==", examId));
      const snapshot = await getDocs(resultsQuery);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "results", d.id)));
      await Promise.all(deletePromises);

      await deleteDoc(doc(db, "exams", examId));
      toast.success("Đã xóa đề thi và các kết quả liên quan thành công.");
      setDeleteData(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa đề thi.");
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

  const filteredExams = exams.filter(e => {
    if (selectedFolderId !== "all" && e.folderId !== selectedFolderId) {
      return false;
    }
    if (examSearch.trim()) {
      const q = examSearch.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredStudents = studentAccounts.filter(s => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.studentClass.toLowerCase().includes(q) || (s.schoolName && s.schoolName.toLowerCase().includes(q));
  });

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.displayName && u.displayName.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const teacherExamIds = new Set(exams.map(e => e.id));

  const availableSchools = Array.from(
    new Set(
      results
        .filter(r => userProfile?.role === "admin" || teacherExamIds.has(r.examId))
        .map(r => r.schoolName?.trim())
        .filter(Boolean) as string[]
    )
  ).sort();

  const availableClasses = Array.from(
    new Set(
      results
        .filter(r => (userProfile?.role === "admin" || teacherExamIds.has(r.examId)) && (selectedSchool === "all" || r.schoolName?.trim() === selectedSchool))
        .map(r => r.studentClass?.trim())
        .filter(Boolean) as string[]
    )
  ).sort();

  const filteredResults = results.filter(r => {
    if (userProfile?.role !== "admin" && !teacherExamIds.has(r.examId)) {
      return false;
    }
    if (selectedExamId !== "all" && r.examId !== selectedExamId) {
      return false;
    }
    if (selectedSchool !== "all" && (r.schoolName?.trim() || "") !== selectedSchool) {
      return false;
    }
    if (selectedClass !== "all" && (r.studentClass?.trim() || "") !== selectedClass) {
      return false;
    }
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
      "STT", "Họ và tên", "Lớp", "Trường", "Định danh (Tên_Lớp_Trường)", "Đề thi", "Mã đề thi", "Điểm số (/10)", "Số câu đúng", "Tổng số câu", "Tỷ lệ đúng (%)", "Thời gian nộp bài"
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

  if (!userProfile) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quản lý hệ thống</h2>
          <p className="text-gray-500 text-sm">
            {userProfile.role === "admin" ? "Quản trị viên toàn hệ thống" : "Quản lý thư mục, đề thi và tài khoản học sinh"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-lg shadow-sm mb-6 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="exams" className="px-5 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <FileText className="w-4 h-4 mr-2" />
            Đề thi ({exams.length})
          </TabsTrigger>
          <TabsTrigger value="folders" className="px-5 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <FolderIcon className="w-4 h-4 mr-2" />
            Thư mục ({folders.length})
          </TabsTrigger>
          <TabsTrigger value="students" className="px-5 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <Users className="w-4 h-4 mr-2" />
            Tài khoản HS ({studentAccounts.length})
          </TabsTrigger>
          <TabsTrigger value="results" className="px-5 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <Trophy className="w-4 h-4 mr-2" />
            Kết quả ({filteredResults.length})
          </TabsTrigger>
          {userProfile.role === "admin" && (
            <TabsTrigger value="users" className="px-5 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
              <Shield className="w-4 h-4 mr-2" />
              Người dùng ({users.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* --- EXAMS TAB --- */}
        <TabsContent value="exams" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Tìm kiếm theo tên đề, môn học hoặc mã đề..." 
                className="pl-9 h-10 border-none bg-gray-50/70 focus-visible:ring-0 text-sm rounded-xl"
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[240px]">
              <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                  <FolderIcon className="w-4 h-4 mr-2 text-blue-600 shrink-0" />
                  <SelectValue placeholder="Lọc theo thư mục" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả thư mục ({exams.length})</SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      📁 {f.name} (Khối {f.grade || "N/A"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExams.map((exam) => {
              const examFolder = folders.find(f => f.id === exam.folderId);
              return (
                <Card key={exam.id} className="border-none shadow-sm hover:shadow-md transition-all group bg-white">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
                          {exam.subject}
                        </Badge>
                        {examFolder && (
                          <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50/60 text-[10px]">
                            📁 {examFolder.name}
                          </Badge>
                        )}
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] ${exam.status === 'published' ? 'border-green-200 text-green-600 bg-green-50' : 'border-amber-200 text-amber-600 bg-amber-50'}`}
                        >
                          {exam.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                        </Badge>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => setPreviewExam(exam)} title="Xem đề">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => { setAssignExamModal(exam); setTargetFolderId(exam.folderId || "none"); }} title="Chuyển vào thư mục">
                          <FolderIcon className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50" onClick={() => onEdit?.(exam)} title="Chỉnh sửa">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => onDuplicate?.(exam)} title="Sao chép">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteData({ id: exam.id, type: 'exam' })} title="Xóa đề">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-lg mt-2 line-clamp-1">{exam.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs">
                      <span>Lớp {exam.grade}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {exam.timeLimit} phút</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-3">
                    <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-semibold uppercase">Mã đề thi</span>
                        <code className="text-xs font-mono text-gray-700 font-bold">{exam.id}</code>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 hover:text-blue-600" onClick={() => copyToClipboard(exam.id)}>
                        {copiedId === exam.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>

                    {exam.status === 'published' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-9 gap-1.5 text-xs text-blue-600 hover:text-white hover:bg-blue-600 border-blue-200 transition-all font-semibold rounded-xl"
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
              );
            })}
            {filteredExams.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Không tìm thấy đề thi nào trong thư mục này.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* --- FOLDERS TAB --- */}
        <TabsContent value="folders" className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <FolderIcon className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-800">Quản lý Thư mục chứa Đề thi</h3>
            </div>
            <Button onClick={() => setShowFolderModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 rounded-xl h-10">
              <FolderPlus className="w-4 h-4" />
              Tạo thư mục mới
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map(folder => {
              const countExams = exams.filter(e => e.folderId === folder.id).length;
              return (
                <Card key={folder.id} className="border-none shadow-sm hover:shadow-md transition-all bg-white">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                        Khối {folder.grade || "Chung"}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteData({ id: folder.id, type: 'folder' })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardTitle className="text-xl mt-2 flex items-center gap-2 text-blue-950">
                      📁 {folder.name}
                    </CardTitle>
                    <CardDescription className="text-xs pt-1">
                      {countExams} đề thi đang lưu trữ trong thư mục này
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-9 rounded-xl text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setActiveTab("exams");
                      }}
                    >
                      Xem đề trong thư mục ({countExams})
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {folders.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <FolderIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Chưa có thư mục nào được tạo.</p>
                <p className="text-xs text-gray-400 mt-1">Tạo thư mục giúp phân loại đề thi theo khối lớp và môn học gọn gàng.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* --- STUDENT ACCOUNTS TAB --- */}
        <TabsContent value="students" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Tìm kiếm học sinh theo tên, mã HS, lớp, trường..." 
                className="pl-9 h-10 border-none bg-gray-50/70 focus-visible:ring-0 text-sm rounded-xl"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => setShowStudentModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 rounded-xl h-10">
              <UserPlus className="w-4 h-4" />
              Cấp tài khoản học sinh
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-bold">Mã HS / Tài khoản</th>
                    <th className="px-6 py-4 font-bold">Họ và tên</th>
                    <th className="px-6 py-4 font-bold">Lớp / Trường</th>
                    <th className="px-6 py-4 font-bold">Mật khẩu</th>
                    <th className="px-6 py-4 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 w-fit">
                          {st.studentId}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 text-base">{st.fullName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-xs font-semibold text-blue-700 bg-blue-50 border-blue-200">
                            Lớp {st.studentClass}
                          </Badge>
                          {st.schoolName && (
                            <Badge variant="outline" className="text-xs font-medium text-gray-700 bg-gray-50 border-gray-200">
                              {st.schoolName}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg w-fit">
                          •••••••• ({st.password})
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteData({ id: st.id, type: 'student' })}
                          title="Xóa tài khoản"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-gray-600">Chưa có tài khoản học sinh nào được cấp.</p>
                        <p className="text-xs text-gray-400 mt-1">Cấp tài khoản giúp học sinh đăng nhập chính xác, ngăn chặn tình trạng điền tên lung tung.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* --- RESULTS TAB --- */}
        <TabsContent value="results" className="space-y-4">
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

                <div className="w-full sm:w-[220px]">
                  <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                      <FileText className="w-3.5 h-3.5 mr-1 text-blue-600 shrink-0" />
                      <SelectValue placeholder="Chọn đề thi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả đề thi ({exams.length})</SelectItem>
                      {exams.map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>{ex.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-[200px]">
                  <Select value={selectedSchool} onValueChange={(val) => { setSelectedSchool(val); setSelectedClass("all"); }}>
                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                      <School className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
                      <SelectValue placeholder="Chọn trường" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trường ({availableSchools.length})</SelectItem>
                      {availableSchools.map((sch) => (
                        <SelectItem key={sch} value={sch}>{sch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-[160px]">
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                      <GraduationCap className="w-3.5 h-3.5 mr-1 text-purple-600 shrink-0" />
                      <SelectValue placeholder="Chọn lớp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả lớp ({availableClasses.length})</SelectItem>
                      {availableClasses.map((cls) => (
                        <SelectItem key={cls} value={cls}>Lớp {cls}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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

            {filteredResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">Tổng bài thi</span>
                  <span className="text-xl font-black text-blue-900">{filteredResults.length}</span>
                </div>
                <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase block">Điểm trung bình</span>
                  <span className="text-xl font-black text-indigo-900">
                    {(filteredResults.reduce((acc, c) => acc + c.score, 0) / filteredResults.length).toFixed(2)}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Điểm cao nhất</span>
                  <span className="text-xl font-black text-emerald-900">
                    {Math.max(...filteredResults.map(r => r.score)).toFixed(1)}
                  </span>
                </div>
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100">
                  <span className="text-[10px] font-bold text-amber-600 uppercase block">Điểm thấp nhất</span>
                  <span className="text-xl font-black text-amber-900">
                    {Math.min(...filteredResults.map(r => r.score)).toFixed(1)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-purple-50/70 p-3 rounded-xl border border-purple-100">
                  <span className="text-[10px] font-bold text-purple-600 uppercase block">Tỷ lệ đạt (&ge;5.0)</span>
                  <span className="text-xl font-black text-purple-900">
                    {((filteredResults.filter(r => r.score >= 5.0).length / filteredResults.length) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>

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
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-mono font-bold max-w-full truncate">
                              <span>🏷️</span>
                              <span className="truncate">{combined}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {res.studentClass && (
                                <Badge variant="outline" className="text-[11px] font-semibold text-blue-700 bg-blue-50 border-blue-200">
                                  Lớp {res.studentClass}
                                </Badge>
                              )}
                              {res.schoolName && (
                                <Badge variant="outline" className="text-[11px] font-medium text-gray-700 bg-gray-50 border-gray-200">
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
                        <p className="font-medium text-gray-600">Không tìm thấy kết quả nào phù hợp.</p>
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
            {/* User management list */}
          </TabsContent>
        )}
      </Tabs>

      {/* --- MODALS --- */}
      {/* Create Folder Modal */}
      <Dialog open={showFolderModal} onOpenChange={setShowFolderModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-blue-600" />
              Tạo Thư mục chứa Đề thi
            </DialogTitle>
            <DialogDescription>
              Tạo thư mục để tổ chức các đề thi theo khối lớp hoặc môn học.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Tên thư mục *</label>
              <Input 
                placeholder="Ví dụ: Kiểm tra 1 tiết Vật lý 12, Đề thi học kỳ 1..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Khối lớp</label>
              <Select value={newFolderGrade} onValueChange={setNewFolderGrade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Khối 10</SelectItem>
                  <SelectItem value="11">Khối 11</SelectItem>
                  <SelectItem value="12">Khối 12</SelectItem>
                  <SelectItem value="chung">Khối chung</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderModal(false)}>Hủy</Button>
            <Button onClick={handleCreateFolder} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Tạo thư mục</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Student Account Modal */}
      <Dialog open={showStudentModal} onOpenChange={setShowStudentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Cấp tài khoản cho học sinh
            </DialogTitle>
            <DialogDescription>
              Tạo Mã HS và Mật khẩu để học sinh đăng nhập trước khi làm bài.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Mã học sinh (Mã HS) *</label>
                <Input 
                  placeholder="Ví dụ: HS1201..."
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Mật khẩu *</label>
                <Input 
                  type="password"
                  placeholder="Mật khẩu..."
                  value={newStudentPassword}
                  onChange={(e) => setNewStudentPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Họ và tên học sinh *</label>
              <Input 
                placeholder="Ví dụ: Nguyễn Văn A..."
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Lớp *</label>
                <Input 
                  placeholder="Ví dụ: 12A1..."
                  value={newStudentClass}
                  onChange={(e) => setNewStudentClass(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Trường học</label>
                <Input 
                  placeholder="Ví dụ: THPT..."
                  value={newStudentSchool}
                  onChange={(e) => setNewStudentSchool(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStudentModal(false)}>Hủy</Button>
            <Button onClick={handleCreateStudentAccount} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Cấp tài khoản</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Exam to Folder Modal */}
      <Dialog open={!!assignExamModal} onOpenChange={(open) => !open && setAssignExamModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chuyển đề thi vào Thư mục</DialogTitle>
            <DialogDescription>
              Chọn thư mục lưu trữ cho đề: <span className="font-bold text-blue-900">{assignExamModal?.title}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={targetFolderId} onValueChange={setTargetFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn thư mục" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Không thuộc thư mục nào --</SelectItem>
                {folders.map(f => (
                  <SelectItem key={f.id} value={f.id}>📁 {f.name} (Khối {f.grade || "N/A"})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignExamModal(null)}>Hủy</Button>
            <Button onClick={handleAssignFolder} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Lưu thay đổi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteData} onOpenChange={(open) => !open && setDeleteData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Xác nhận xóa
            </DialogTitle>
            <DialogDescription className="py-4">
              Bạn có chắc chắn muốn xóa {deleteData?.type === 'exam' ? 'đề thi này (và toàn bộ kết quả liên quan)' : deleteData?.type === 'folder' ? 'thư mục này' : deleteData?.type === 'student' ? 'tài khoản học sinh này' : 'kết quả này'} không? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteData(null)}>Hủy bỏ</Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (!deleteData) return;
                if (deleteData.type === 'exam') handleDeleteExam(deleteData.id);
                else if (deleteData.type === 'folder') handleDeleteFolder(deleteData.id);
                else if (deleteData.type === 'student') handleDeleteStudentAccount(deleteData.id);
                else if (deleteData.type === 'result') handleDeleteResult(deleteData.id);
              }}
            >
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
