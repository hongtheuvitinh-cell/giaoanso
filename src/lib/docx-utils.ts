import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ParagraphChild } from "docx";
import { latexToWordMath } from "latex-to-docx";

export const parseMarkdownToRuns = (text: string, isTable: boolean = false): ParagraphChild[] => {
  if (!text) return [];
  const runs: ParagraphChild[] = [];
  
  // Clean up common markdown/HTML artifacts
  let cleanText = text.replace(/<br\s*\/?>/gi, " ");
  
  if (!isTable) {
    cleanText = cleanText.replace(/\|[-: ]+\|/g, "").replace(/\|/g, " ");
  }

  // Split by bold (**), italic (*), display math ($$...$$ or \[...\]), and inline math ($...$ or \(...\))
  const parts = cleanText.split(/(\*\*.*?\*\*|\*.*?\*|\$\$[\s\S]*?\$\$|\$[^\$]+?\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g);
  
  parts.forEach(part => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith("*") && part.endsWith("*")) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else if (
      (part.startsWith("$$") && part.endsWith("$$")) ||
      (part.startsWith("$") && part.endsWith("$")) ||
      (part.startsWith("\\[") && part.endsWith("\\]")) ||
      (part.startsWith("\\(") && part.endsWith("\\)"))
    ) {
      let mathRaw = part;
      if (mathRaw.startsWith("$$") && mathRaw.endsWith("$$")) {
        mathRaw = mathRaw.slice(2, -2);
      } else if (mathRaw.startsWith("$") && mathRaw.endsWith("$")) {
        mathRaw = mathRaw.slice(1, -1);
      } else if (mathRaw.startsWith("\\[") && mathRaw.endsWith("\\]")) {
        mathRaw = mathRaw.slice(2, -2);
      } else if (mathRaw.startsWith("\\(") && mathRaw.endsWith("\\)")) {
        mathRaw = mathRaw.slice(2, -2);
      }
      mathRaw = mathRaw.trim();

      if (!mathRaw) return;

      try {
        const mathElements = latexToWordMath(mathRaw);
        if (mathElements && mathElements.length > 0) {
          runs.push(...mathElements);
        } else {
          runs.push(new TextRun({ text: mathRaw, italics: true, font: "Cambria Math" }));
        }
      } catch (err) {
        console.warn("Could not convert LaTeX equation to Word math:", mathRaw, err);
        runs.push(new TextRun({ text: mathRaw, italics: true, font: "Cambria Math" }));
      }
    } else {
      runs.push(new TextRun(part));
    }
  });
  
  return runs;
};

export const createDocxTable = (markdownLines: string[]): Table => {
  const rows = markdownLines
    .filter(line => line.trim().startsWith("|") && !line.includes("|---"))
    .map(line => {
      const cells = line.split("|").filter((_, i, arr) => i > 0 && i < arr.length - 1);
      return new TableRow({
        children: cells.map(cell => new TableCell({
          children: [new Paragraph({ children: parseMarkdownToRuns(cell.trim(), true) })],
          width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }))
      });
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    }
  });
};
