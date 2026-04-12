import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Download, 
  Printer, 
  FileDown,
  Calculator,
  Table as TableIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, VerticalAlign, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

import { MatrixRow, PHYSICS_COMPETENCIES, EMPTY_LEVELS } from "@/types";

interface MatrixGeneratorProps {
  rows: MatrixRow[];
  setRows: React.Dispatch<React.SetStateAction<MatrixRow[]>>;
  subject: "general" | "physics";
  setSubject: (subject: "general" | "physics") => void;
}

export default function MatrixGenerator({ rows, setRows, subject, setSubject }: MatrixGeneratorProps) {

  const addRow = () => {
    const newRow: MatrixRow = {
      id: Math.random().toString(36).substr(2, 9),
      chapter: "",
      content: "",
      requirements: "",
      mc: { ...EMPTY_LEVELS },
      tf: { ...EMPTY_LEVELS },
      sa: { ...EMPTY_LEVELS },
      essay: { ...EMPTY_LEVELS },
      physicsCompetency: subject === "physics" ? PHYSICS_COMPETENCIES[0] : undefined
    };
    setRows([...rows, newRow]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id));
    }
  };

  const updateRow = (id: string, field: string, value: any) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          return { ...r, [parent]: { ...r[parent as keyof MatrixRow] as any, [child]: parseInt(value) || 0 } };
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const totals = useMemo(() => {
    const res = {
      mc: { know: 0, understand: 0, apply: 0, highApply: 0 },
      tf: { know: 0, understand: 0, apply: 0, highApply: 0 },
      sa: { know: 0, understand: 0, apply: 0, highApply: 0 },
      essay: { know: 0, understand: 0, apply: 0, highApply: 0 },
      overall: { know: 0, understand: 0, apply: 0, highApply: 0 },
      totalQuestions: 0,
      totalPoints: 10
    };

    rows.forEach(r => {
      res.mc.know += r.mc.know; res.mc.understand += r.mc.understand; res.mc.apply += r.mc.apply; res.mc.highApply += r.mc.highApply;
      res.tf.know += r.tf.know; res.tf.understand += r.tf.understand; res.tf.apply += r.tf.apply; res.tf.highApply += r.tf.highApply;
      res.sa.know += r.sa.know; res.sa.understand += r.sa.understand; res.sa.apply += r.sa.apply; res.sa.highApply += r.sa.highApply;
      res.essay.know += r.essay.know; res.essay.understand += r.essay.understand; res.essay.apply += r.essay.apply; res.essay.highApply += r.essay.highApply;
      
      res.overall.know += (r.mc.know + r.tf.know + r.sa.know + r.essay.know);
      res.overall.understand += (r.mc.understand + r.tf.understand + r.sa.understand + r.essay.understand);
      res.overall.apply += (r.mc.apply + r.tf.apply + r.sa.apply + r.essay.apply);
      res.overall.highApply += (r.mc.highApply + r.tf.highApply + r.sa.highApply + r.essay.highApply);
    });

    res.totalQuestions = res.overall.know + res.overall.understand + res.overall.apply + res.overall.highApply;
    
    return res;
  }, [rows]);

  const exportCSV = () => {
    const headers = [
      "TT", "Chu de/Chuong", "Noi dung", "Yeu cau can dat",
      ...(subject === "physics" ? ["Nang luc Vat ly"] : []),
      "MC_B", "MC_H", "MC_V", "MC_VC",
      "TF_B", "TF_H", "TF_V", "TF_VC",
      "SA_B", "SA_H", "SA_V", "SA_VC",
      "TL_B", "TL_H", "TL_V", "TL_VC"
    ];
    
    const csvRows = rows.map((r, idx) => [
      idx + 1, r.chapter, r.content, r.requirements,
      ...(subject === "physics" ? [r.physicsCompetency || ""] : []),
      r.mc.know, r.mc.understand, r.mc.apply, r.mc.highApply,
      r.tf.know, r.tf.understand, r.tf.apply, r.tf.highApply,
      r.sa.know, r.sa.understand, r.sa.apply, r.sa.highApply,
      r.essay.know, r.essay.understand, r.essay.apply, r.essay.highApply
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "MaTranDeKiemTra.csv");
  };

  const exportWord = async () => {
    const headerRow1 = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("TT")], rowSpan: 3, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("Chủ đề/Chương")], rowSpan: 3, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("Nội dung")], rowSpan: 3, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("Yêu cầu cần đạt")], rowSpan: 3, verticalAlign: VerticalAlign.CENTER }),
        ...(subject === "physics" ? [new TableCell({ children: [new Paragraph("Năng lực Vật lý")], rowSpan: 3, verticalAlign: VerticalAlign.CENTER })] : []),
        new TableCell({ children: [new Paragraph("Mức độ đánh giá")], columnSpan: 16, verticalAlign: VerticalAlign.CENTER }),
      ],
    });

    const headerRow2 = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("TNKQ")], columnSpan: 12, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("Tự luận")], columnSpan: 4, verticalAlign: VerticalAlign.CENTER }),
      ],
    });

    const headerRow3 = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("MC (B-H-V-VC)")], columnSpan: 4, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("TF (B-H-V-VC)")], columnSpan: 4, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("SA (B-H-V-VC)")], columnSpan: 4, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("Biết")], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("Hiểu")], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("Vận dụng")], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph("Vận dụng cao")], verticalAlign: VerticalAlign.CENTER }),
      ],
    });

    const dataRows = rows.map((r, idx) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph((idx + 1).toString())] }),
        new TableCell({ children: [new Paragraph(r.chapter)] }),
        new TableCell({ children: [new Paragraph(r.content)] }),
        new TableCell({ children: [new Paragraph(r.requirements)] }),
        ...(subject === "physics" ? [new TableCell({ children: [new Paragraph(r.physicsCompetency || "")] })] : []),
        new TableCell({ children: [new Paragraph(r.mc.know.toString())] }),
        new TableCell({ children: [new Paragraph(r.mc.understand.toString())] }),
        new TableCell({ children: [new Paragraph(r.mc.apply.toString())] }),
        new TableCell({ children: [new Paragraph(r.mc.highApply.toString())] }),
        new TableCell({ children: [new Paragraph(r.tf.know.toString())] }),
        new TableCell({ children: [new Paragraph(r.tf.understand.toString())] }),
        new TableCell({ children: [new Paragraph(r.tf.apply.toString())] }),
        new TableCell({ children: [new Paragraph(r.tf.highApply.toString())] }),
        new TableCell({ children: [new Paragraph(r.sa.know.toString())] }),
        new TableCell({ children: [new Paragraph(r.sa.understand.toString())] }),
        new TableCell({ children: [new Paragraph(r.sa.apply.toString())] }),
        new TableCell({ children: [new Paragraph(r.sa.highApply.toString())] }),
        new TableCell({ children: [new Paragraph(r.essay.know.toString())] }),
        new TableCell({ children: [new Paragraph(r.essay.understand.toString())] }),
        new TableCell({ children: [new Paragraph(r.essay.apply.toString())] }),
        new TableCell({ children: [new Paragraph(r.essay.highApply.toString())] }),
      ],
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: "MA TRẬN ĐỀ KIỂM TRA", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow1, headerRow2, headerRow3, ...dataRows],
          }),
        ]
      }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "MaTranDeKiemTra.docx");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-gray-900">Thiết lập Ma trận đề</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="radio" 
                name="subject" 
                checked={subject === "general"} 
                onChange={() => setSubject("general")}
                className="w-4 h-4 text-blue-600"
              />
              <span className={`text-sm ${subject === "general" ? "text-blue-600 font-bold" : "text-gray-500"}`}>Môn học khác</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="radio" 
                name="subject" 
                checked={subject === "physics"} 
                onChange={() => setSubject("physics")}
                className="w-4 h-4 text-blue-600"
              />
              <span className={`text-sm ${subject === "physics" ? "text-blue-600 font-bold" : "text-gray-500"}`}>Môn Vật Lý</span>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportWord}>
            <FileDown className="w-4 h-4 mr-2" /> Xuất Word
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" /> Xuất CSV
          </Button>
          <Button onClick={addRow} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Thêm dòng
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              Nhập liệu Ma trận
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full overflow-auto">
              <table className="w-full text-sm border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th rowSpan={3} className="p-2 border-r w-12 text-center">TT</th>
                    <th rowSpan={3} className="p-2 border-r w-48">Chủ đề/Chương</th>
                    <th rowSpan={3} className="p-2 border-r w-64">Nội dung/đơn vị kiến thức</th>
                    <th rowSpan={3} className="p-2 border-r w-64">Yêu cầu cần đạt</th>
                    {subject === "physics" && <th rowSpan={3} className="p-2 border-r w-48">Năng lực Vật lý</th>}
                    <th colSpan={16} className="p-2 border-r text-center">Mức độ đánh giá</th>
                    <th rowSpan={3} className="p-2 w-12 text-center">Xóa</th>
                  </tr>
                  <tr className="bg-gray-50 border-b">
                    <th colSpan={12} className="p-2 border-r text-center">TNKQ</th>
                    <th colSpan={4} className="p-2 border-r text-center">Tự luận</th>
                  </tr>
                  <tr className="bg-gray-50 border-b text-[10px] uppercase tracking-wider">
                    <th colSpan={4} className="p-1 border-r text-center">Nhiều lựa chọn</th>
                    <th colSpan={4} className="p-1 border-r text-center">Đúng - Sai</th>
                    <th colSpan={4} className="p-1 border-r text-center">Trả lời ngắn</th>
                    <th className="p-1 border-r text-center">Biết</th>
                    <th className="p-1 border-r text-center">Hiểu</th>
                    <th className="p-1 border-r text-center">Vận dụng</th>
                    <th className="p-1 border-r text-center">VD Cao</th>
                  </tr>
                  <tr className="bg-white border-b text-[9px] text-gray-400">
                    <th colSpan={subject === "physics" ? 5 : 4} className="p-0 border-r"></th>
                    <th className="p-1 border-r text-center">B</th><th className="p-1 border-r text-center">H</th><th className="p-1 border-r text-center">V</th><th className="p-1 border-r text-center">VC</th>
                    <th className="p-1 border-r text-center">B</th><th className="p-1 border-r text-center">H</th><th className="p-1 border-r text-center">V</th><th className="p-1 border-r text-center">VC</th>
                    <th className="p-1 border-r text-center">B</th><th className="p-1 border-r text-center">H</th><th className="p-1 border-r text-center">V</th><th className="p-1 border-r text-center">VC</th>
                    <th className="p-1 border-r text-center">B</th><th className="p-1 border-r text-center">H</th><th className="p-1 border-r text-center">V</th><th className="p-1 border-r text-center">VC</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-2 border-r text-center font-medium text-gray-500">{idx + 1}</td>
                      <td className="p-2 border-r">
                        <Input 
                          value={row.chapter} 
                          onChange={(e) => updateRow(row.id, "chapter", e.target.value)}
                          className="h-8 text-xs border-none focus-visible:ring-1"
                          placeholder="Tên chương..."
                        />
                      </td>
                      <td className="p-2 border-r">
                        <Input 
                          value={row.content} 
                          onChange={(e) => updateRow(row.id, "content", e.target.value)}
                          className="h-8 text-xs border-none focus-visible:ring-1"
                          placeholder="Nội dung kiến thức..."
                        />
                      </td>
                      <td className="p-2 border-r">
                        <Input 
                          value={row.requirements} 
                          onChange={(e) => updateRow(row.id, "requirements", e.target.value)}
                          className="h-8 text-xs border-none focus-visible:ring-1"
                          placeholder="Yêu cầu cần đạt..."
                        />
                      </td>
                      {subject === "physics" && (
                        <td className="p-2 border-r">
                          <select 
                            value={row.physicsCompetency} 
                            onChange={(e) => updateRow(row.id, "physicsCompetency", e.target.value)}
                            className="w-full h-8 text-[10px] bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          >
                            {PHYSICS_COMPETENCIES.map(cp => (
                              <option key={cp} value={cp}>{cp}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      {/* MC */}
                      <td className="p-1 border-r"><Input type="number" value={row.mc.know} onChange={(e) => updateRow(row.id, "mc.know", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.mc.understand} onChange={(e) => updateRow(row.id, "mc.understand", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.mc.apply} onChange={(e) => updateRow(row.id, "mc.apply", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.mc.highApply} onChange={(e) => updateRow(row.id, "mc.highApply", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      {/* TF */}
                      <td className="p-1 border-r"><Input type="number" value={row.tf.know} onChange={(e) => updateRow(row.id, "tf.know", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.tf.understand} onChange={(e) => updateRow(row.id, "tf.understand", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.tf.apply} onChange={(e) => updateRow(row.id, "tf.apply", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.tf.highApply} onChange={(e) => updateRow(row.id, "tf.highApply", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      {/* SA */}
                      <td className="p-1 border-r"><Input type="number" value={row.sa.know} onChange={(e) => updateRow(row.id, "sa.know", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.sa.understand} onChange={(e) => updateRow(row.id, "sa.understand", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.sa.apply} onChange={(e) => updateRow(row.id, "sa.apply", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.sa.highApply} onChange={(e) => updateRow(row.id, "sa.highApply", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      {/* Essay */}
                      <td className="p-1 border-r"><Input type="number" value={row.essay.know} onChange={(e) => updateRow(row.id, "essay.know", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.essay.understand} onChange={(e) => updateRow(row.id, "essay.understand", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.essay.apply} onChange={(e) => updateRow(row.id, "essay.apply", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      <td className="p-1 border-r"><Input type="number" value={row.essay.highApply} onChange={(e) => updateRow(row.id, "essay.highApply", e.target.value)} className="h-7 w-10 text-center p-0 text-xs border-gray-200" /></td>
                      
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="sm" onClick={() => removeRow(row.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                    <td colSpan={subject === "physics" ? 5 : 4} className="p-3 text-right uppercase text-blue-900">Tổng số câu</td>
                    <td className="p-1 text-center border-r">{totals.mc.know}</td>
                    <td className="p-1 text-center border-r">{totals.mc.understand}</td>
                    <td className="p-1 text-center border-r">{totals.mc.apply}</td>
                    <td className="p-1 text-center border-r">{totals.mc.highApply}</td>
                    <td className="p-1 text-center border-r">{totals.tf.know}</td>
                    <td className="p-1 text-center border-r">{totals.tf.understand}</td>
                    <td className="p-1 text-center border-r">{totals.tf.apply}</td>
                    <td className="p-1 text-center border-r">{totals.tf.highApply}</td>
                    <td className="p-1 text-center border-r">{totals.sa.know}</td>
                    <td className="p-1 text-center border-r">{totals.sa.understand}</td>
                    <td className="p-1 text-center border-r">{totals.sa.apply}</td>
                    <td className="p-1 text-center border-r">{totals.sa.highApply}</td>
                    <td className="p-1 text-center border-r">{totals.essay.know}</td>
                    <td className="p-1 text-center border-r">{totals.essay.understand}</td>
                    <td className="p-1 text-center border-r">{totals.essay.apply}</td>
                    <td className="p-1 text-center border-r">{totals.essay.highApply}</td>
                    <td className="bg-white"></td>
                  </tr>
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan={subject === "physics" ? 5 : 4} className="p-3 text-right uppercase text-blue-900">Tỉ lệ % điểm</td>
                    <td colSpan={4} className="p-1 text-center border-r text-blue-700">
                      {((totals.mc.know + totals.mc.understand + totals.mc.apply + totals.mc.highApply) / (totals.totalQuestions || 1) * 100).toFixed(0)}%
                    </td>
                    <td colSpan={4} className="p-1 text-center border-r text-blue-700">
                      {((totals.tf.know + totals.tf.understand + totals.tf.apply + totals.tf.highApply) / (totals.totalQuestions || 1) * 100).toFixed(0)}%
                    </td>
                    <td colSpan={4} className="p-1 text-center border-r text-blue-700">
                      {((totals.sa.know + totals.sa.understand + totals.sa.apply + totals.sa.highApply) / (totals.totalQuestions || 1) * 100).toFixed(0)}%
                    </td>
                    <td colSpan={4} className="p-1 text-center border-r text-blue-700">
                      {((totals.essay.know + totals.essay.understand + totals.essay.apply + totals.essay.highApply) / (totals.totalQuestions || 1) * 100).toFixed(0)}%
                    </td>
                    <td className="bg-white"></td>
                  </tr>
                </tfoot>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-green-600 p-3 rounded-xl">
              <TableIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-green-900">Kết luận Ma trận</h3>
              <p className="text-sm text-green-700">Tổng số câu: <span className="font-bold">{totals.totalQuestions}</span> | Tỉ lệ B-H-V-VC: <span className="font-bold">{((totals.overall.know/totals.totalQuestions)*100 || 0).toFixed(0)}% - {((totals.overall.understand/totals.totalQuestions)*100 || 0).toFixed(0)}% - {((totals.overall.apply/totals.totalQuestions)*100 || 0).toFixed(0)}% - {((totals.overall.highApply/totals.totalQuestions)*100 || 0).toFixed(0)}%</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-green-600 font-bold">
            <Check className="w-5 h-5" />
            ĐẠT CHUẨN ĐÁNH GIÁ
          </div>
        </div>
      </div>
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// No custom HeadingLevel needed
