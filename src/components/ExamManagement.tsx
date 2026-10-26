import React, { useState, useEffect, useRef } from "react";
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
  Edit3,
  Share2,
  Download,
  FileUp,
  FileSpreadsheet,
  GraduationCap,
  School,
  BarChart3,
  RotateCcw,
  Folder as FolderIcon,
  FolderPlus,
  Lock,
  Key,
  BookOpen,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { db, collection, onSnapshot, query, where, doc, getDoc, deleteDoc, updateDoc, setDoc, auth, getDocs } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  role: "admin" | "teacher" | "pending" | "disabled";
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
  const [deleteData, setDeleteData] = useState<{ id: string, type: 'exam' | 'result' | 'folder' | 'student' | 'user' } | null>(null);

  // Full Exam Review state for Result Modal
  const [reviewExamData, setReviewExamData] = useState<Exam | null>(null);
  const [loadingReviewExam, setLoadingReviewExam] = useState(false);
  const [showFullReview, setShowFullReview] = useState(false);

  const formatStudentAnswer = (ansVal: any) => {
    if (ansVal === null || ansVal === undefined || ansVal === "") {
      return "(Chưa làm)";
    }
    if (typeof ansVal === "object") {
      const keys = Object.keys(ansVal).sort();
      if (keys.length === 0) return "(Chưa chọn)";
      const parts = keys.map((key) => {
        const match = key.match(/\d+/);
        const idx = match ? parseInt(match[0], 10) : 0;
        const label = String.fromCharCode(97 + idx);
        const val = ansVal[key];
        const valStr = val === true ? "Đúng" : val === false ? "Sai" : "-";
        return `${label}: ${valStr}`;
      });
      return parts.join(" | ");
    }
    return String(ansVal);
  };

  // In-memory exam cache to guarantee 0 extra reads on repeat views
  const examCacheRef = useRef<Record<string, Exam>>({});

  const handleLoadFullExamReview = async () => {
    if (!viewResult) return;
    const targetExamId = viewResult.examId;

    // 1. Check if exam is already loaded in local `exams` list
    const existingInList = exams.find(e => e.id === targetExamId);
    if (existingInList) {
      setReviewExamData(existingInList);
      setShowFullReview(true);
      toast.success("Đã nạp bài làm từ Bộ nhớ đệm (Cache) - 0 lượt đọc máy chủ!");
      return;
    }

    // 2. Check if exam was previously cached in memory
    if (examCacheRef.current[targetExamId]) {
      setReviewExamData(examCacheRef.current[targetExamId]);
      setShowFullReview(true);
      toast.success("Đã nạp bài làm từ Bộ nhớ đệm (Cache) - 0 lượt đọc máy chủ!");
      return;
    }

    // 3. Fallback: Fetch once from Firestore and cache for future uses
    setLoadingReviewExam(true);
    try {
      const docRef = doc(db, "exams", targetExamId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const examObj = docSnap.data() as Exam;
        examCacheRef.current[targetExamId] = examObj; // Cache for next time
        setReviewExamData(examObj);
        setShowFullReview(true);
        toast.success("Đã nạp thành công chi tiết đề thi và công thức!");
      } else {
        toast.error("Không tìm thấy dữ liệu đề thi gốc trong hệ thống.");
      }
    } catch (err) {
      console.error("Lỗi nạp đề thi:", err);
      toast.error("Không thể nạp chi tiết đề thi.");
    } finally {
      setLoadingReviewExam(false);
    }
  };

  // Pagination states (12-15 items per page)
  const [examsPage, setExamsPage] = useState(1);
  const [studentsPage, setStudentsPage] = useState(1);
  const [resultsPage, setResultsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);

  useEffect(() => { setExamsPage(1); }, [examSearch, selectedFolderId]);
  useEffect(() => { setStudentsPage(1); }, [studentSearch]);
  useEffect(() => { setResultsPage(1); }, [resultSearch, selectedExamId, selectedClass]);
  useEffect(() => { setUsersPage(1); }, [userSearch]);

  // Folder creation modal state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderGrade, setNewFolderGrade] = useState("10");
  const [newFolderParentId, setNewFolderParentId] = useState<string>("none");
  const [currentFolderParentId, setCurrentFolderParentId] = useState<string | null>(null);
  const [selectedFolderGrade, setSelectedFolderGrade] = useState<string>("10"); // Default Khối 10

  const getBreadcrumbs = (folderId: string | null) => {
    const crumbs: Folder[] = [];
    let currId = folderId;
    while (currId) {
      const f = folders.find(x => x.id === currId);
      if (f) {
        crumbs.unshift(f);
        currId = f.parentId || null;
      } else {
        break;
      }
    }
    return crumbs;
  };

  const currentLevelFolders = folders.filter(f => {
    if (currentFolderParentId === null) {
      const isRoot = !f.parentId || f.parentId === "none";
      if (!isRoot) return false;
      if (selectedFolderGrade === "all") return true;
      return (f.grade || "chung") === selectedFolderGrade;
    }
    return f.parentId === currentFolderParentId;
  });

  const currentLevelExams = exams.filter(e => {
    if (currentFolderParentId === null) {
      const isRoot = !e.folderId || e.folderId === "none";
      if (!isRoot) return false;
      if (selectedFolderGrade === "all") return true;
      return String(e.grade || "").includes(selectedFolderGrade);
    }
    return e.folderId === currentFolderParentId;
  });

  const renderPagination = (currentPage: number, totalItems: number, pageSize: number, onPageChange: (p: number) => void) => {
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (totalPages <= 1) return null;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 text-xs font-medium text-gray-500">
        <div>
          Hiển thị <strong>{Math.min((currentPage - 1) * pageSize + 1, totalItems)}</strong> - <strong>{Math.min(currentPage * pageSize, totalItems)}</strong> trên tổng số <strong>{totalItems}</strong> mục
        </div>
        <div className="flex items-center gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2.5 text-xs font-bold rounded-lg border-gray-200"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            ← Trang trước
          </Button>
          <span className="px-2 font-bold text-gray-800 text-xs">
            Trang {currentPage} / {totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2.5 text-xs font-bold rounded-lg border-gray-200"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Trang sau →
          </Button>
        </div>
      </div>
    );
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = "\uFEFF" + "ma_hs,mat_khau,ho_va_ten,lop,truong\n" + "HS1201,123456,Nguyễn Văn A,12A1,THPT Chu Văn An\n" + "HS1202,123456,Trần Thị B,12A2,THPT Chu Văn An";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "Mau_Danh_Sach_Hoc_Sinh.csv");
    toast.success("Đã tải xuống file mẫu CSV thành công!");
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length <= 1) {
          toast.error("File CSV không có dữ liệu hoặc sai định dạng.");
          return;
        }

        let successCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const parts = line.split(",").map(p => p.trim().replace(/^["']|["']$/g, ""));
          if (parts.length >= 4) {
            const [studentId, password, fullName, studentClass, schoolName] = parts;
            if (studentId && password && fullName && studentClass) {
              const accId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              const newAcc: StudentAccount = {
                id: accId,
                studentId,
                password,
                fullName,
                studentClass,
                schoolName: schoolName || "",
                teacherId: userProfile?.uid || "",
                createdAt: new Date().toISOString(),
                mustChangePassword: true
              };
              await setDoc(doc(db, "studentAccounts", accId), newAcc);
              successCount++;
            }
          }
        }

        toast.success(`Đã cấp thành công ${successCount} tài khoản học sinh từ file CSV!`);
        if (event.target) event.target.value = "";
      } catch (err) {
        console.error(err);
        toast.error("Lỗi khi đọc file CSV.");
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  // Student Account creation modal state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentClass, setNewStudentClass] = useState("");
  const [newStudentSchool, setNewStudentSchool] = useState("");

  // Student Account reset password state
  const [resetStudentAccount, setResetStudentAccount] = useState<StudentAccount | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("123456");
  const [resetRequireChange, setResetRequireChange] = useState(true);

  // Assign exam to folder modal
  const [assignExamModal, setAssignExamModal] = useState<Exam | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>("none");

  // Quick rename exam modal state
  const [renameExamModal, setRenameExamModal] = useState<{ id: string; title: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const handleSaveExamTitle = async () => {
    if (!renameExamModal || !renameInput.trim()) {
      toast.error("Vui lòng nhập tên đề thi.");
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, "exams", renameExamModal.id), {
        title: renameInput.trim()
      });
      toast.success("Đã đổi tên đề thi thành công!");
      setRenameExamModal(null);
    } catch (err) {
      console.error("Lỗi khi đổi tên đề thi:", err);
      toast.error("Không thể đổi tên đề thi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

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
    let folderQuery = query(collection(db, "folders"));
    if (userProfile.role !== "admin") {
      folderQuery = query(collection(db, "folders"), where("teacherId", "==", userProfile.uid));
    }
    const unsubscribeFolders = onSnapshot(folderQuery, (snapshot) => {
      const folderList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Folder));
      setFolders(folderList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    // Listen for student accounts
    let studentAccQuery = query(collection(db, "studentAccounts"));
    if (userProfile.role !== "admin") {
      studentAccQuery = query(collection(db, "studentAccounts"), where("teacherId", "==", userProfile.uid));
    }
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
        parentId: newFolderParentId === "none" ? null : newFolderParentId,
        teacherId: userProfile?.uid || "",
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "folders", folderId), newFolder);
      toast.success("Đã tạo thư mục thành công!");
      setNewFolderName("");
      setNewFolderParentId("none");
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
        createdAt: new Date().toISOString(),
        mustChangePassword: true
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

  const handleConfirmResetPassword = async () => {
    if (!resetStudentAccount) return;
    if (!resetNewPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu mới.");
      return;
    }
    try {
      await updateDoc(doc(db, "studentAccounts", resetStudentAccount.id), {
        password: resetNewPassword.trim(),
        mustChangePassword: resetRequireChange
      });
      toast.success(`Đã reset mật khẩu cho học sinh ${resetStudentAccount.fullName} (${resetStudentAccount.studentId}) thành công!`);
      setResetStudentAccount(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi reset mật khẩu học sinh.");
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

  const handleUpdateUserRole = async (uid: string, newRole: "admin" | "teacher" | "pending" | "disabled") => {
    try {
      await updateDoc(doc(db, "users", uid), { role: newRole, disabled: newRole === "disabled" });
      toast.success(`Đã cập nhật vai trò người dùng thành ${
        newRole === "admin" ? "Quản trị viên" : 
        newRole === "teacher" ? "Giáo viên (Đã duyệt)" : 
        newRole === "disabled" ? "Đã khóa / Xóa" : 
        "Chờ duyệt"
      }!`);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi cập nhật vai trò.");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await setDoc(doc(db, "users", uid), { role: "disabled", disabled: true, deletedAt: new Date().toISOString() }, { merge: true });
      toast.success("Đã khóa / xóa tài khoản thành công. Tài khoản này không thể tự đăng nhập lại để được duyệt.");
      setDeleteData(null);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa tài khoản người dùng.");
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
        .filter(r => userProfile?.role === "admin" || teacherExamIds.has(r.examId))
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
            {filteredExams.slice((examsPage - 1) * 12, examsPage * 12).map((exam) => {
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:text-purple-800 hover:bg-purple-50" onClick={() => { setRenameExamModal({ id: exam.id, title: exam.title }); setRenameInput(exam.title); }} title="Đổi tên nhanh">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => { setAssignExamModal(exam); setTargetFolderId(exam.folderId || "none"); }} title="Chuyển vào thư mục">
                          <FolderIcon className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50" onClick={() => onEdit?.(exam)} title="Chỉnh sửa toàn bộ">
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
                    <div className="flex items-center justify-between gap-1.5 mt-2">
                      <CardTitle className="text-lg line-clamp-1 flex-1 font-bold text-gray-900">{exam.title}</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-gray-400 hover:text-purple-600 hover:bg-purple-50 shrink-0 rounded-lg" 
                        onClick={() => { setRenameExamModal({ id: exam.id, title: exam.title }); setRenameInput(exam.title); }} 
                        title="Đổi tên nhanh"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
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

          {renderPagination(examsPage, filteredExams.length, 12, setExamsPage)}
        </TabsContent>

        {/* --- FOLDERS TAB --- */}
        <TabsContent value="folders" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <FolderIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-800">Quản lý Thư mục & Đề thi</h3>
              </div>
              {/* Breadcrumbs */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 pt-1">
                <button 
                  onClick={() => setCurrentFolderParentId(null)}
                  className={`hover:text-blue-600 font-semibold flex items-center gap-1 ${currentFolderParentId === null ? 'text-blue-600 font-bold' : ''}`}
                >
                  📁 Tất cả thư mục gốc
                </button>
                {getBreadcrumbs(currentFolderParentId).map((crumb, idx, arr) => (
                  <React.Fragment key={crumb.id}>
                    <span>/</span>
                    <button 
                      onClick={() => setCurrentFolderParentId(crumb.id)}
                      className={`hover:text-blue-600 font-semibold ${idx === arr.length - 1 ? 'text-blue-600 font-bold' : ''}`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Grade Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 mt-2">
                <span className="text-[11px] font-bold text-gray-500 mr-1">Lọc theo khối:</span>
                {[
                  { id: "10", label: "Lớp 10" },
                  { id: "11", label: "Lớp 11" },
                  { id: "12", label: "Lớp 12" },
                  { id: "chung", label: "Khối chung" },
                  { id: "all", label: "Tất cả khối" }
                ].map(g => (
                  <Button
                    key={g.id}
                    variant={selectedFolderGrade === g.id ? "default" : "outline"}
                    size="sm"
                    className={`h-7 px-3 text-xs font-bold rounded-lg transition-all ${
                      selectedFolderGrade === g.id 
                        ? "bg-blue-600 text-white shadow-xs" 
                        : "border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                    onClick={() => {
                      setSelectedFolderGrade(g.id);
                      setCurrentFolderParentId(null);
                    }}
                  >
                    📁 {g.label} {g.id === "10" && "(Mặc định)"}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {currentFolderParentId !== null && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold gap-1.5"
                    onClick={() => setCurrentFolderParentId(null)}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                    Quay về thư mục gốc
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl border-gray-200"
                    onClick={() => {
                      const parentCrumb = folders.find(f => f.id === currentFolderParentId);
                      setCurrentFolderParentId(parentCrumb?.parentId || null);
                    }}
                  >
                    ← Quay lại thư mục cha
                  </Button>
                </>
              )}
              <Button 
                onClick={() => {
                  setNewFolderParentId(currentFolderParentId || "none");
                  setShowFolderModal(true);
                }} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 rounded-xl h-10"
              >
                <FolderPlus className="w-4 h-4" />
                {currentFolderParentId ? "Tạo thư mục con" : "Tạo thư mục mới"}
              </Button>
            </div>
          </div>

          {/* Sub-Folders Section */}
          {currentLevelFolders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-950">
                  <FolderIcon className="w-4.5 h-4.5 text-blue-600" />
                  <span>Thư mục con ({currentLevelFolders.length})</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentLevelFolders.map(folder => {
                  const countExams = exams.filter(e => e.folderId === folder.id).length;
                  const subFoldersCount = folders.filter(f => f.parentId === folder.id).length;
                  return (
                    <Card key={folder.id} className="border border-blue-100 shadow-sm hover:shadow-md transition-all bg-white group hover:border-blue-300">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                              Khối {folder.grade || "Chung"}
                            </Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteData({ id: folder.id, type: 'folder' })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <CardTitle 
                          className="text-lg mt-2 flex items-center gap-2 text-blue-950 font-bold line-clamp-1 cursor-pointer hover:text-blue-600"
                          onClick={() => setCurrentFolderParentId(folder.id)}
                        >
                          📁 {folder.name}
                        </CardTitle>
                        <CardDescription className="text-xs pt-1">
                          {subFoldersCount} thư mục con • {countExams} đề thi
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-1">
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="w-full h-9 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => setCurrentFolderParentId(folder.id)}
                        >
                          📁 Mở thư mục ({subFoldersCount} thư mục con, {countExams} đề)
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files/Exams Section inside active folder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                <FileText className="w-4.5 h-4.5 text-indigo-600" />
                <span>
                  Đề thi trong {currentFolderParentId === null ? "Thư mục gốc" : `thư mục "${folders.find(f => f.id === currentFolderParentId)?.name || ""}"`} ({currentLevelExams.length})
                </span>
              </div>
            </div>

            {currentLevelExams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentLevelExams.map((exam) => {
                  return (
                    <Card key={exam.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-all group bg-white">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
                              {exam.subject}
                            </Badge>
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:text-purple-800 hover:bg-purple-50" onClick={() => { setRenameExamModal({ id: exam.id, title: exam.title }); setRenameInput(exam.title); }} title="Đổi tên nhanh">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => { setAssignExamModal(exam); setTargetFolderId(exam.folderId || "none"); }} title="Chuyển vào thư mục">
                              <FolderIcon className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50" onClick={() => onEdit?.(exam)} title="Chỉnh sửa toàn bộ">
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
                        <div className="flex items-center justify-between gap-1.5 mt-2">
                          <CardTitle className="text-lg line-clamp-1 flex-1 font-bold text-gray-900">{exam.title}</CardTitle>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-gray-400 hover:text-purple-600 hover:bg-purple-50 shrink-0 rounded-lg" 
                            onClick={() => { setRenameExamModal({ id: exam.id, title: exam.title }); setRenameInput(exam.title); }} 
                            title="Đổi tên nhanh"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
              </div>
            ) : (
              <div className="py-8 text-center bg-white rounded-xl border border-dashed border-gray-200 text-gray-500 text-xs">
                Chưa có đề thi nào nằm trực tiếp trong vị trí thư mục này.
              </div>
            )}
          </div>

          {currentLevelFolders.length === 0 && currentLevelExams.length === 0 && (
            <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <FolderIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Thư mục này hiện tại đang trống.</p>
              <p className="text-xs text-gray-400 mt-1">Nhấn "Tạo thư mục con" hoặc gán đề thi vào thư mục này để bắt đầu.</p>
            </div>
          )}
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadCsvTemplate} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold gap-2 rounded-xl h-10">
                <Download className="w-4 h-4" />
                Tải file mẫu CSV
              </Button>
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 rounded-xl h-10 px-4 inline-flex items-center text-sm shadow-sm transition-all">
                <FileUp className="w-4 h-4" />
                Tải lên file CSV danh sách HS
                <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
              </label>
              <Button onClick={() => setShowStudentModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 rounded-xl h-10">
                <UserPlus className="w-4 h-4" />
                Cấp tài khoản cá nhân
              </Button>
            </div>
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
                  {filteredStudents.slice((studentsPage - 1) * 15, studentsPage * 15).map((st) => (
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-mono text-xs text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg w-fit">
                            •••••••• ({st.password})
                          </div>
                          {st.mustChangePassword && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 font-medium">
                              Cần đổi MK
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs text-amber-700 border-amber-200 hover:bg-amber-50 gap-1.5 rounded-lg font-medium"
                            onClick={() => {
                              setResetStudentAccount(st);
                              setResetNewPassword("123456");
                              setResetRequireChange(true);
                            }}
                            title="Reset mật khẩu khi học sinh quên"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-600" />
                            Reset MK
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => setDeleteData({ id: st.id, type: 'student' })}
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
            {renderPagination(studentsPage, filteredStudents.length, 15, setStudentsPage)}
          </div>
        </TabsContent>

        {/* --- RESULTS TAB --- */}
        <TabsContent value="results" className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              <div className="flex flex-1 flex-wrap lg:flex-nowrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Tìm theo tên học sinh, lớp, trường, mã đề..." 
                    className="pl-9 h-10 rounded-xl text-sm"
                    value={resultSearch}
                    onChange={(e) => setResultSearch(e.target.value)}
                  />
                </div>

                {/* Wider Exam / Subject Select */}
                <div className="w-full sm:w-[320px] shrink-0">
                  <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm font-medium">
                      <FileText className="w-4 h-4 mr-1.5 text-blue-600 shrink-0" />
                      <SelectValue placeholder="Chọn đề thi / Môn" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả đề thi ({exams.length})</SelectItem>
                      {exams.map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>{ex.title} ({ex.subject})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Wider Class Select */}
                <div className="w-full sm:w-[220px] shrink-0">
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm font-medium">
                      <GraduationCap className="w-4 h-4 mr-1.5 text-purple-600 shrink-0" />
                      <SelectValue placeholder="Lọc theo Lớp" />
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
                  {filteredResults.slice((resultsPage - 1) * 15, resultsPage * 15).map((res) => {
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
            {renderPagination(resultsPage, filteredResults.length, 15, setResultsPage)}
          </div>
        </TabsContent>

        {userProfile.role === "admin" && (
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <Search className="w-5 h-5 text-gray-400" />
              <Input 
                placeholder="Tìm kiếm giáo viên/người dùng theo email hoặc tên..." 
                className="border-none focus-visible:ring-0 text-sm"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 font-bold">Tên hiển thị / Email</th>
                      <th className="px-6 py-4 font-bold">Email tài khoản</th>
                      <th className="px-6 py-4 font-bold">Vai trò / Quyền</th>
                      <th className="px-6 py-4 font-bold">Ngày tạo</th>
                      <th className="px-6 py-4 font-bold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.slice((usersPage - 1) * 15, usersPage * 15).map((u) => (
                      <tr key={u.uid} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 text-base flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-blue-600" />
                            {u.displayName || u.email.split("@")[0]}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs text-gray-700">{u.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`font-bold text-xs ${
                              u.role === "admin" ? "bg-purple-50 text-purple-700 border-purple-200" :
                              u.role === "teacher" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              u.role === "disabled" ? "bg-red-50 text-red-700 border-red-200" :
                              "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {u.role === "admin" ? "Quản trị viên" : u.role === "teacher" ? "Giáo viên (Đã duyệt)" : u.role === "disabled" ? "Đã khóa / Xóa" : "Chờ duyệt"}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Select value={u.role} onValueChange={(val: any) => handleUpdateUserRole(u.uid, val)}>
                              <SelectTrigger className="h-8 text-xs w-[155px] rounded-lg">
                                <SelectValue placeholder="Phân quyền" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="teacher">Giáo viên (Đã duyệt)</SelectItem>
                                <SelectItem value="pending">Chờ duyệt</SelectItem>
                                <SelectItem value="disabled">Đã khóa / Xóa</SelectItem>
                                <SelectItem value="admin">Quản trị viên</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={() => setDeleteData({ id: u.uid, type: 'user' })}
                              title="Xóa tài khoản"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="font-medium text-gray-600">Không tìm thấy tài khoản người dùng/giáo viên nào.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(usersPage, filteredUsers.length, 15, setUsersPage)}
            </div>
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
              <label className="text-xs font-bold text-gray-700">Thư mục cha (Tùy chọn - Hỗ trợ thư mục con)</label>
              <Select value={newFolderParentId} onValueChange={setNewFolderParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Thư mục gốc (Không có) --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Thư mục gốc (Không có) --</SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>📁 {f.name} (Khối {f.grade || "N/A"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              Bạn có chắc chắn muốn xóa {deleteData?.type === 'exam' ? 'đề thi này (và toàn bộ kết quả liên quan)' : deleteData?.type === 'folder' ? 'thư mục này' : deleteData?.type === 'student' ? 'tài khoản học sinh này' : deleteData?.type === 'user' ? 'tài khoản người dùng này' : 'kết quả này'} không? Hành động này không thể hoàn tác.
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
                else if (deleteData.type === 'user') handleDeleteUser(deleteData.id);
                else if (deleteData.type === 'result') handleDeleteResult(deleteData.id);
              }}
            >
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Result Details Modal */}
      <Dialog open={!!viewResult} onOpenChange={(open) => {
        if (!open) {
          setViewResult(null);
          setShowFullReview(false);
          setReviewExamData(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-xl font-bold text-blue-900 pr-6">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Chi tiết kết quả bài thi</span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Học sinh: <strong className="text-gray-900">{viewResult?.studentName}</strong> (Lớp {viewResult?.studentClass} {viewResult?.schoolName ? `- ${viewResult.schoolName}` : ''})
            </DialogDescription>
          </DialogHeader>

          {viewResult && (
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Môn / Đề thi</span>
                  <span className="text-sm font-bold text-gray-900 line-clamp-1">{viewResult.examTitle}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Điểm số</span>
                  <span className="text-sm font-black text-blue-600">{viewResult.score.toFixed(1)} / 10</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Số câu đúng</span>
                  <span className="text-sm font-bold text-emerald-600">{viewResult.correctAnswers} / {viewResult.totalQuestions} câu</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Thời gian nộp</span>
                  <span className="text-xs font-medium text-gray-700">{new Date(viewResult.submittedAt).toLocaleString("vi-VN")}</span>
                </div>
              </div>

              {/* Toggle Action to Load Full Exam & Math Formulas */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-blue-50/80 p-3 rounded-xl border border-blue-200">
                <div className="text-xs text-blue-900">
                  <span className="font-bold block">💡 Chế độ xem tiết kiệm lượt đọc:</span>
                  <span className="text-blue-700">Bảng tóm tắt bên dưới không tốn thêm lượt đọc. Bạn có thể nạp đầy đủ đề thi và công thức Toán/Lý/Hóa bên dưới khi cần.</span>
                </div>
                <Button 
                  size="sm" 
                  variant={showFullReview ? "outline" : "default"}
                  className={`shrink-0 rounded-xl text-xs font-bold gap-1.5 h-9 ${showFullReview ? 'border-blue-300 text-blue-800' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  onClick={() => {
                    if (showFullReview) {
                      setShowFullReview(false);
                    } else if (reviewExamData) {
                      setShowFullReview(true);
                    } else {
                      handleLoadFullExamReview();
                    }
                  }}
                  disabled={loadingReviewExam}
                >
                  {loadingReviewExam ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Đang nạp đề thi...
                    </>
                  ) : showFullReview ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Thu gọn bài làm
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-3.5 h-3.5" />
                      Xem đầy đủ đề & công thức
                    </>
                  )}
                </Button>
              </div>

              {/* Clean Summary Grid for Student Answers */}
              {viewResult.answers && Object.keys(viewResult.answers).length > 0 && !showFullReview && (
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Bảng đáp án học sinh đã chọn:</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto p-1">
                    {Object.entries(viewResult.answers).map(([qId, ansVal], idx) => {
                      const formattedVal = formatStudentAnswer(ansVal);
                      return (
                        <div key={qId} className="p-2.5 bg-white rounded-xl border border-gray-200 text-xs flex justify-between items-center gap-2 shadow-xs hover:border-blue-200">
                          <span className="font-bold text-gray-600 shrink-0">Câu {idx + 1}:</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 max-w-[180px] truncate text-right font-mono">
                            {formattedVal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full Exam Review Mode with KaTeX Math Formulas */}
              {showFullReview && reviewExamData && (
                <div className="space-y-6 pt-2 border-t border-gray-200">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 text-blue-900">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Chi tiết từng câu hỏi & đáp án (Đã công thức hóa)</span>
                  </h4>

                  {reviewExamData.questions.map((q, idx) => {
                    const studentAns = viewResult.answers?.[q.id];
                    let isCorrect = false;
                    if (q.type === "MC") {
                      isCorrect = studentAns === q.options?.find(o => o.isCorrect)?.id;
                    } else if (q.type === "TF") {
                      isCorrect = q.options?.every((opt, i) => (studentAns?.[`opt_${i}`] ?? null) === opt.isCorrect) ?? false;
                    } else if (q.type === "SA") {
                      isCorrect = studentAns?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
                    }

                    return (
                      <div key={q.id || idx} className={`p-4 rounded-xl border-2 space-y-3 bg-white ${isCorrect ? 'border-emerald-200 shadow-xs' : 'border-rose-200 shadow-xs'}`}>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className={isCorrect ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold" : "bg-rose-50 text-rose-800 border-rose-300 font-bold"}>
                            Câu {idx + 1} ({q.type}) — {isCorrect ? "✓ Đúng" : "✗ Sai"}
                          </Badge>
                          <span className="text-xs font-bold text-gray-500">Mức độ: {q.level || "biết"}</span>
                        </div>

                        {q.context && (
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-950">
                            <strong className="block text-amber-800 mb-1">📖 Ngữ liệu chung:</strong>
                            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                              {q.context}
                            </ReactMarkdown>
                          </div>
                        )}

                        <div className="text-sm font-medium text-gray-900 leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {q.content}
                          </ReactMarkdown>
                        </div>

                        {q.imageUrl && (
                          <img src={q.imageUrl} alt="Minh họa" className="rounded-lg border max-h-40 object-contain" />
                        )}

                        {/* Question options or answer details */}
                        {q.type === "MC" && q.options && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt) => {
                              const isStudentChoice = studentAns === opt.id;
                              const isCorrectOpt = opt.isCorrect;
                              return (
                                <div key={opt.id} className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                                  isCorrectOpt ? 'bg-emerald-50 border-emerald-400 font-semibold text-emerald-950' : isStudentChoice ? 'bg-blue-50 border-blue-400 font-semibold text-blue-950' : 'bg-white border-gray-200 text-gray-700'
                                }`}>
                                  <span className="font-bold shrink-0">{opt.id}.</span>
                                  <div className="flex-1">
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                      {opt.text}
                                    </ReactMarkdown>
                                  </div>
                                  {isCorrectOpt && <span className="text-[10px] text-emerald-700 font-bold shrink-0">✓ Đáp án đúng</span>}
                                  {!isCorrectOpt && isStudentChoice && <span className="text-[10px] text-blue-700 font-bold shrink-0">Lựa chọn của HS</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.type === "TF" && q.options && (
                          <div className="space-y-1.5 pt-1">
                            {q.options.map((opt, oIdx) => {
                              const studentVal = studentAns?.[`opt_${oIdx}`];
                              const isSubCorrect = studentVal === opt.isCorrect;
                              return (
                                <div key={opt.id} className={`p-2 rounded-lg border text-xs flex justify-between items-center ${isSubCorrect ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
                                  <span className="font-medium text-gray-800">{String.fromCharCode(97 + oIdx)}). {opt.text}</span>
                                  <div className="flex gap-2 text-[11px] font-bold shrink-0">
                                    <span className="text-gray-600">HS chọn: <strong className={studentVal === true ? "text-blue-700" : studentVal === false ? "text-red-700" : "text-gray-400"}>{studentVal === true ? "Đúng" : studentVal === false ? "Sai" : "Chưa chọn"}</strong></span>
                                    <span>|</span>
                                    <span className="text-emerald-700">Đáp án: {opt.isCorrect ? "Đúng" : "Sai"}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.type === "SA" && (
                          <div className="text-xs p-2.5 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 space-y-1">
                            <div><strong>HS trả lời:</strong> <code className="font-bold">{studentAns || "(Chưa nhập)"}</code></div>
                            <div><strong>Đáp án đúng:</strong> <code className="font-bold text-emerald-700">{q.correctAnswer}</code></div>
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-xs p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-amber-900">
                            <strong>Lời giải chi tiết:</strong>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {q.explanation}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between items-center sm:justify-between pt-2 border-t">
            <Button 
              variant="destructive" 
              size="sm" 
              className="gap-1.5 font-bold"
              onClick={() => {
                if (viewResult) {
                  setDeleteData({ id: viewResult.id, type: 'result' });
                  setViewResult(null);
                  setShowFullReview(false);
                  setReviewExamData(null);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
              Xóa kết quả này
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setViewResult(null);
              setShowFullReview(false);
              setReviewExamData(null);
            }}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Exam Modal */}
      <Dialog open={!!previewExam} onOpenChange={(open) => !open && setPreviewExam(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-blue-900">
              <FileText className="w-5 h-5 text-blue-600" />
              {previewExam?.title}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">Môn: {previewExam?.subject}</Badge>
              <Badge variant="outline">Khối {previewExam?.grade}</Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {previewExam?.timeLimit} phút
              </Badge>
              <span className="text-xs text-gray-500 font-mono">Mã đề: {previewExam?.id}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {previewExam?.questions && previewExam.questions.length > 0 ? (
              previewExam.questions.map((q, idx) => (
                <div key={q.id || idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 font-bold border-blue-300">
                      Câu {idx + 1} ({q.type}) — {q.points || 0.25} điểm
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      Mức độ: {q.level === 'know' ? 'Biết' : q.level === 'understand' ? 'Hiểu' : q.level === 'apply' ? 'Vận dụng' : 'Vận dụng cao'}
                    </Badge>
                  </div>

                  {q.context && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-950">
                      <strong className="block text-amber-800 mb-1">📖 Lời dẫn / Ngữ liệu:</strong>
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                        {q.context}
                      </ReactMarkdown>
                    </div>
                  )}

                  <div className="text-sm font-medium text-gray-900 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                      {q.content}
                    </ReactMarkdown>
                  </div>

                  {q.imageUrl && (
                    <img src={q.imageUrl} alt="Minh họa" className="rounded-lg border max-h-48 object-contain" />
                  )}

                  {q.options && (q.type === 'MC' || q.type === 'TF') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const label = q.type === 'MC' ? opt.id : String.fromCharCode(97 + oIdx);
                        return (
                          <div 
                            key={opt.id || oIdx} 
                            className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                              opt.isCorrect ? 'bg-emerald-50 border-emerald-400 font-semibold text-emerald-950' : 'bg-white border-gray-200 text-gray-700'
                            }`}
                          >
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${opt.isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
                              {label}.
                            </span>
                            <div className="flex-1">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {opt.text}
                              </ReactMarkdown>
                            </div>
                            {opt.isCorrect && <span className="text-[10px] text-emerald-700 font-bold">✓ Đáp án đúng</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'SA' && (
                    <div className="text-xs p-2.5 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 font-mono">
                      <strong>Đáp án chính xác:</strong> {q.correctAnswer || '(Chưa có)'}
                    </div>
                  )}

                  {q.explanation && (
                    <div className="text-xs p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-amber-950">
                      <strong className="block text-amber-800 mb-1">📖 Lời giải chi tiết:</strong>
                      <div className="prose prose-xs max-w-none text-amber-950">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {q.explanation}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                Đề thi này chưa có danh sách câu hỏi chi tiết.
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <div className="text-xs text-gray-500">
              Tổng số câu hỏi: {previewExam?.questions?.length || 0}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreviewExam(null)}>Đóng</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  if (previewExam) {
                    onEdit?.(previewExam);
                    setPreviewExam(null);
                  }
                }}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Chỉnh sửa đề này
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Student Password Dialog */}
      <Dialog open={!!resetStudentAccount} onOpenChange={(open) => !open && setResetStudentAccount(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800">
              <Key className="w-5 h-5 text-amber-600" />
              Reset Mật khẩu Học sinh
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Học sinh: <strong className="text-gray-900">{resetStudentAccount?.fullName}</strong> ({resetStudentAccount?.studentId} - Lớp {resetStudentAccount?.studentClass})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Mật khẩu mới *</label>
              <Input 
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (mặc định: 123456)..."
                className="font-mono font-bold text-sm h-10"
              />
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox 
                id="resetReq" 
                checked={resetRequireChange}
                onCheckedChange={(val) => setResetRequireChange(!!val)}
              />
              <label htmlFor="resetReq" className="text-xs font-medium text-gray-700 cursor-pointer">
                Bắt buộc học sinh đổi mật khẩu trong lần đăng nhập kế tiếp
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetStudentAccount(null)}>Hủy bỏ</Button>
            <Button onClick={handleConfirmResetPassword} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
              Xác nhận Reset MK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Rename Exam Dialog */}
      <Dialog open={!!renameExamModal} onOpenChange={(open) => !open && setRenameExamModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-900 font-bold">
              <Edit3 className="w-5 h-5 text-purple-600" />
              Đổi tên Đề thi Nhanh
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 pt-1">
              Chỉnh sửa nhanh tiêu đề mà không cần nạp toàn bộ danh sách câu hỏi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Tên đề thi mới *</label>
              <Input 
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Nhập tên đề thi mới..."
                className="h-11 rounded-xl font-medium"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveExamTitle();
                }}
              />
            </div>
            <div className="text-[11px] text-gray-400 italic">
              💡 Mã đề: <code className="font-mono text-gray-600">{renameExamModal?.id}</code>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRenameExamModal(null)}>Hủy bỏ</Button>
            <Button 
              onClick={handleSaveExamTitle} 
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              Lưu tên mới
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
