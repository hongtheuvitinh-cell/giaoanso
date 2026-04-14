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
  Eye
} from "lucide-react";
import { db, collection, onSnapshot, query, where, doc, deleteDoc, updateDoc, auth, getDocs } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Exam } from "@/types";
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
}

interface ExamResult {
  id: string;
  studentName: string;
  examId: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  submittedAt: string;
}

export default function ExamManagement({ userProfile, onDuplicate }: ExamManagementProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [examSearch, setExamSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [resultSearch, setResultSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);

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
    if (!window.confirm("Bạn có chắc chắn muốn xóa kết quả này?")) return;
    try {
      await deleteDoc(doc(db, "results", resultId));
      toast.success("Đã xóa kết quả thành công.");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa kết quả.");
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đề thi này? Hành động này không thể hoàn tác.")) return;
    try {
      // 1. Delete associated results first
      const resultsQuery = query(collection(db, "results"), where("examId", "==", examId));
      const snapshot = await getDocs(resultsQuery);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "results", d.id)));
      await Promise.all(deletePromises);

      // 2. Delete the exam
      await deleteDoc(doc(db, "exams", examId));
      toast.success("Đã xóa đề thi và các kết quả liên quan thành công.");
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

  const filteredExams = exams.filter(e => 
    e.title.toLowerCase().includes(examSearch.toLowerCase()) || 
    e.id.toLowerCase().includes(examSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.displayName && u.displayName.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const teacherExamIds = new Set(exams.map(e => e.id));
  const filteredResults = results.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(resultSearch.toLowerCase()) || 
                         r.examTitle.toLowerCase().includes(resultSearch.toLowerCase()) ||
                         r.examId.toLowerCase().includes(resultSearch.toLowerCase());
    
    if (userProfile.role === "admin") return matchesSearch;
    return matchesSearch && teacherExamIds.has(r.examId);
  });

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
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
                      {exam.subject}
                    </Badge>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => setPreviewExam(exam)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => onDuplicate?.(exam)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteExam(exam.id)}>
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
                <CardContent className="pb-4">
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <code className="text-xs font-mono text-gray-600">{exam.id}</code>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyToClipboard(exam.id)}>
                      {copiedId === exam.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
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
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <Search className="w-5 h-5 text-gray-400" />
            <Input 
              placeholder="Tìm kiếm theo tên HS, tên đề hoặc mã đề..." 
              className="border-none focus-visible:ring-0 text-sm"
              value={resultSearch}
              onChange={(e) => setResultSearch(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-medium">Học sinh</th>
                    <th className="px-6 py-4 font-medium">Đề thi</th>
                    <th className="px-6 py-4 font-medium">Điểm số</th>
                    <th className="px-6 py-4 font-medium">Ngày nộp</th>
                    <th className="px-6 py-4 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredResults.map((res) => (
                    <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{res.studentName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{res.examTitle}</div>
                        <div className="text-xs text-gray-500 font-mono">{res.examId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`${res.score >= 8 ? 'bg-emerald-500' : res.score >= 5 ? 'bg-blue-500' : 'bg-red-500'}`}>
                          {res.score.toFixed(1)} / 10
                        </Badge>
                        <div className="text-[10px] text-gray-400 mt-1">
                          Đúng {res.correctAnswers}/{res.totalQuestions} câu
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(res.submittedAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => handleDeleteResult(res.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredResults.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        Chưa có kết quả nào.
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewExam?.title}</DialogTitle>
            <DialogDescription>
              {previewExam?.subject} - Lớp {previewExam?.grade} | {previewExam?.timeLimit} phút
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-4 pr-4">
            <div className="space-y-8 pb-8">
              {previewExam?.questions.map((q, idx) => (
                <div key={q.id} className="space-y-4">
                  <div className="font-medium flex gap-2">
                    <span className="shrink-0">Câu {idx + 1}:</span>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                        {q.content}
                      </ReactMarkdown>
                    </div>
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
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
