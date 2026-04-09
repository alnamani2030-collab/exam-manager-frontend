import React, { useEffect, useMemo, useRef, useState } from "react";
import GoldDropdown from "../components/GoldDropdown";
import { type Teacher } from "../services/teachers.service";
import { useTeachersData } from "../hooks/useTeachersData";
import { useI18n } from "../i18n/I18nProvider";

const SUBCOLLECTION = "teachers";

// ✅ قائمة المواد
const SUBJECT_OPTIONS_RAW = [
  "",
  "التربية الإسلامية 5","التربية الإسلامية 6","التربية الإسلامية 7","التربية الإسلامية 8","التربية الإسلامية 9","التربية الإسلامية 10","التربية الإسلامية 11","التربية الإسلامية 12",
  "اللغة العربية 6","اللغة العربية 7","اللغة العربية 8","اللغة العربية 9","اللغة العربية 10","اللغة العربية 11","اللغة العربية 12",
  "اللغة الإنجليزية 6","اللغة الإنجليزية 7","اللغة الإنجليزية 8","اللغة الإنجليزية 9","اللغة الإنجليزية 10","اللغة الإنجليزية 11","اللغة الإنجليزية 12",
  "الرياضيات 5","الرياضيات 6","الرياضيات 7","الرياضيات 8","الرياضيات 9","الرياضيات 10","الرياضيات 11","الرياضيات 12",
  "الرياضيات الأساسية 11","الرياضيات المتقدمة 11",
  "الرياضيات الأساسية 12","الرياضيات المتقدمة 12",
  "الدراسات الاجتماعية 5","الدراسات الاجتماعية 6","الدراسات الاجتماعية 7","الدراسات الاجتماعية 8","الدراسات الاجتماعية 9","الدراسات الاجتماعية 10",
  "التاريخ والحضارة الإسلامية 11","الجغرافيا البشرية 11","هذا وطني 11",
  "التاريخ والحضارة الإسلامية 12","الجغرافيا البشرية 12","هذا وطني 12",
  "العلوم 5","العلوم 6","العلوم 7","العلوم 8",
  "الفيزياء 9","الفيزياء 10","الفيزياء 11","الفيزياء 12",
  "الكيمياء 9","الكيمياء 10","الكيمياء 11","الكيمياء 12",
  "الأحياء 9","الأحياء 10","الأحياء 11","الأحياء 12",
  "الرياضة المدرسية 11","الفنون التشكيلية 11","المهارات الموسيقية 11",
  "الرياضة المدرسية 12","الفنون التشكيلية 12","المهارات الموسيقية 12",
  "مواد التخصصات الهندسية والصناعية 12",
  "مهارات اللغة الإنجليزية 11","مهارات اللغة الإنجليزية 12",
  "تقنية المعلومات 11","تقنية المعلومات 12",
  "السفر و السياحة و إدارة الأعمال و تقنية المعلومات 12",
  "اللغة الفرنسية 10","اللغة الألمانية 10","اللغة الصينية 10",
  "اللغة الفرنسية 11","اللغة الألمانية 11","اللغة الصينية 11",
  "اللغة الفرنسية 12","اللغة الألمانية 12","اللغة الصينية 12",
  "العلوم البيئية 11","العلوم البيئية 12",
];

const SUBJECT_TRANSLATIONS: Record<string, string> = {
  "التربية الإسلامية 5": "Islamic Education 5",
  "التربية الإسلامية 6": "Islamic Education 6",
  "التربية الإسلامية 7": "Islamic Education 7",
  "التربية الإسلامية 8": "Islamic Education 8",
  "التربية الإسلامية 9": "Islamic Education 9",
  "التربية الإسلامية 10": "Islamic Education 10",
  "التربية الإسلامية 11": "Islamic Education 11",
  "التربية الإسلامية 12": "Islamic Education 12",
  "اللغة العربية 6": "Arabic Language 6",
  "اللغة العربية 7": "Arabic Language 7",
  "اللغة العربية 8": "Arabic Language 8",
  "اللغة العربية 9": "Arabic Language 9",
  "اللغة العربية 10": "Arabic Language 10",
  "اللغة العربية 11": "Arabic Language 11",
  "اللغة العربية 12": "Arabic Language 12",
  "اللغة الإنجليزية 6": "English Language 6",
  "اللغة الإنجليزية 7": "English Language 7",
  "اللغة الإنجليزية 8": "English Language 8",
  "اللغة الإنجليزية 9": "English Language 9",
  "اللغة الإنجليزية 10": "English Language 10",
  "اللغة الإنجليزية 11": "English Language 11",
  "اللغة الإنجليزية 12": "English Language 12",
  "الرياضيات 5": "Mathematics 5",
  "الرياضيات 6": "Mathematics 6",
  "الرياضيات 7": "Mathematics 7",
  "الرياضيات 8": "Mathematics 8",
  "الرياضيات 9": "Mathematics 9",
  "الرياضيات 10": "Mathematics 10",
  "الرياضيات 11": "Mathematics 11",
  "الرياضيات 12": "Mathematics 12",
  "الرياضيات الأساسية 11": "Basic Mathematics 11",
  "الرياضيات المتقدمة 11": "Advanced Mathematics 11",
  "الرياضيات الأساسية 12": "Basic Mathematics 12",
  "الرياضيات المتقدمة 12": "Advanced Mathematics 12",
  "الدراسات الاجتماعية 5": "Social Studies 5",
  "الدراسات الاجتماعية 6": "Social Studies 6",
  "الدراسات الاجتماعية 7": "Social Studies 7",
  "الدراسات الاجتماعية 8": "Social Studies 8",
  "الدراسات الاجتماعية 9": "Social Studies 9",
  "الدراسات الاجتماعية 10": "Social Studies 10",
  "التاريخ والحضارة الإسلامية 11": "Islamic History and Civilization 11",
  "الجغرافيا البشرية 11": "Human Geography 11",
  "هذا وطني 11": "This Is My Nation 11",
  "التاريخ والحضارة الإسلامية 12": "Islamic History and Civilization 12",
  "الجغرافيا البشرية 12": "Human Geography 12",
  "هذا وطني 12": "This Is My Nation 12",
  "العلوم 5": "Science 5",
  "العلوم 6": "Science 6",
  "العلوم 7": "Science 7",
  "العلوم 8": "Science 8",
  "الفيزياء 9": "Physics 9",
  "الفيزياء 10": "Physics 10",
  "الفيزياء 11": "Physics 11",
  "الفيزياء 12": "Physics 12",
  "الكيمياء 9": "Chemistry 9",
  "الكيمياء 10": "Chemistry 10",
  "الكيمياء 11": "Chemistry 11",
  "الكيمياء 12": "Chemistry 12",
  "الأحياء 9": "Biology 9",
  "الأحياء 10": "Biology 10",
  "الأحياء 11": "Biology 11",
  "الأحياء 12": "Biology 12",
  "الرياضة المدرسية 11": "School Sports 11",
  "الفنون التشكيلية 11": "Visual Arts 11",
  "المهارات الموسيقية 11": "Music Skills 11",
  "الرياضة المدرسية 12": "School Sports 12",
  "الفنون التشكيلية 12": "Visual Arts 12",
  "المهارات الموسيقية 12": "Music Skills 12",
  "مواد التخصصات الهندسية والصناعية 12": "Engineering and Industrial Specializations 12",
  "مهارات اللغة الإنجليزية 11": "English Skills 11",
  "مهارات اللغة الإنجليزية 12": "English Skills 12",
  "تقنية المعلومات 11": "Information Technology 11",
  "تقنية المعلومات 12": "Information Technology 12",
  "السفر و السياحة و إدارة الأعمال و تقنية المعلومات 12": "Travel, Tourism, Business Administration and IT 12",
  "اللغة الفرنسية 10": "French Language 10",
  "اللغة الألمانية 10": "German Language 10",
  "اللغة الصينية 10": "Chinese Language 10",
  "اللغة الفرنسية 11": "French Language 11",
  "اللغة الألمانية 11": "German Language 11",
  "اللغة الصينية 11": "Chinese Language 11",
  "اللغة الفرنسية 12": "French Language 12",
  "اللغة الألمانية 12": "German Language 12",
  "اللغة الصينية 12": "Chinese Language 12",
  "العلوم البيئية 11": "Environmental Science 11",
  "العلوم البيئية 12": "Environmental Science 12",
};

const emptyTeacher: Teacher = {
  id: "",
  employeeNo: "",
  fullName: "",
  subject1: "",
  subject2: "",
  subject3: "",
  subject4: "",
  grades: "",
  phone: "",
  notes: "",
};

function genId() {
  // ✅ متوافق مع المتصفحات الحديثة + fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis as any;
  if (c?.crypto?.randomUUID) return c.crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParseTeachers(v: string | null): Teacher[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        id: String(x.id ?? "").trim() || genId(),
        employeeNo: String(x.employeeNo ?? "").trim(),
        fullName: String(x.fullName ?? "").trim(),
        subject1: String(x.subject1 ?? "").trim(),
        subject2: String(x.subject2 ?? "").trim(),
        subject3: String(x.subject3 ?? "").trim(),
        subject4: String(x.subject4 ?? "").trim(),
        grades: String(x.grades ?? "").trim(),
        phone: String(x.phone ?? "").trim(),
        notes: String(x.notes ?? "").trim(),
      }))
      .filter((t) => t.employeeNo || t.fullName);
  } catch {
    return [];
  }
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeHeader(h: string) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9]/g, "");
}

function getCell(row: any, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  const map: Record<string, any> = {};
  Object.keys(row || {}).forEach((kk) => (map[normalizeHeader(kk)] = row[kk]));
  for (const nk of keys.map(normalizeHeader)) {
    if (map[nk] != null && String(map[nk]).trim() !== "") return String(map[nk]).trim();
  }
  return "";
}

async function tryReadExcel(file: File): Promise<any[] | null> {
  try {
    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
    return json as any[];
  } catch {
    return null;
  }
}

function parseTeachersFromObjects(rows: any[]): Teacher[] {
  return rows
    .map((r) => {
      const fullName = getCell(r, ["الاسم الكامل", "الاسم", "الاسماء", "fullname", "name"]);
      const employeeNo = getCell(r, ["الرقم الوظيفي", "رقم وظيفي", "employeeNo", "employeeno", "id"]);
      const subject1 = getCell(r, ["المادة 1", "المادة1", "المادة الأولى", "المادة الاولى", "subject1"]);
      const subject2 = getCell(r, ["المادة 2", "المادة2", "المادة الثانية", "المادة الثانيه", "subject2"]);
      const subject3 = getCell(r, ["المادة 3", "المادة3", "المادة الثالثة", "المادة الثالثه", "subject3"]);
      const subject4 = getCell(r, ["المادة 4", "المادة4", "المادة الرابعة", "المادة الرابعه", "subject4"]);
      const grades = getCell(r, ["الصفوف", "الصف", "grades", "grade"]);
      const phone = getCell(r, ["رقم الهاتف", "الهاتف", "الجوال", "رقم الجوال", "phone", "mobile"]);
      const notes = getCell(r, ["ملاحظات", "notes", "note"]);

      return {
        id: genId(),
        employeeNo: employeeNo.trim(),
        fullName: fullName.trim(),
        subject1: subject1.trim(),
        subject2: subject2.trim(),
        subject3: subject3.trim(),
        subject4: subject4.trim(),
        grades: grades.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      } as Teacher;
    })
    .filter((t) => t.employeeNo || t.fullName);
}

function parseCSV(text: string): any[] {
  const lines: string[] = [];
  const s = text.replace(/\r/g, "");
  let cur = "";
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      if (inQ && s[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === "\n" && !inQ) {
      lines.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== "") lines.push(cur);

  if (!lines.length) return [];

  const split = (line: string) => {
    const out: string[] = [];
    let c = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          c += '"';
          i++;
        } else q = !q;
        continue;
      }
      if (ch === "," && !q) {
        out.push(c);
        c = "";
        continue;
      }
      c += ch;
    }
    out.push(c);
    return out.map((x) => x.trim());
  };

  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);

  return rows.map((cells) => {
    const obj: any = {};
    headers.forEach((h, idx) => (obj[h] = cells[idx] ?? ""));
    return obj;
  });
}

type DupModalState = {
  open: boolean;
  employeeNo: string;
  candidates: Teacher[];
  pending: Teacher;
  context: "add" | "edit";
};

export default function Teachers() {
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const translateSubject = (s: string) => (lang === "ar" ? s : SUBJECT_TRANSLATIONS[s] || s);

  const SUBJECT_OPTIONS = useMemo(
    () =>
      SUBJECT_OPTIONS_RAW.map((s) => ({
        value: s,
        label: s ? translateSubject(s) : tr("— اختر المادة —", "— Select Subject —"),
      })),
    [lang]
  );

  const { tenantId, teachers, setTeachers } = useTeachersData();

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTeacher, setNewTeacher] = useState<Teacher>({ ...emptyTeacher, id: genId() });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Teacher>({ ...emptyTeacher, id: "" });

  const [dupModal, setDupModal] = useState<DupModalState>({
    open: false,
    employeeNo: "",
    candidates: [],
    pending: { ...emptyTeacher, id: "" },
    context: "add",
  });

  const topRef = useRef<HTMLDivElement>(null);
  const [tableFullScreen, setTableFullScreen] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes teachersShine {
        0%, 88% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
        90% { opacity: 1; }
        100% { transform: translateX(240%) skewX(-12deg); opacity: 0.9; }
      }

      .teachersTable3D { position: relative; }
      .teachersTable3D::before {
        content: "";
        position: absolute;
        top: 0;
        left: -120%;
        width: 60%;
        height: 100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%);
        transform: skewX(-12deg);
        animation: teachersShine 10s infinite;
        pointer-events: none;
        z-index: 1;
      }
      .teachersTable3D table { position: relative; z-index: 2; }

      .teachersTable3D td { transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
      .teachersTable3D td:hover { transform: translateY(-2px); filter: brightness(1.03); }

      .teachersTable3D .col-name { min-width: 260px; font-weight: 900; color: #fff1c4 !important; }

      .teachersTable3D th.col-emp,
      .teachersTable3D td.col-emp {
        min-width: 200px;
        font-weight: 900;
        background: linear-gradient(180deg,#7a5c00,#4a3600) !important;
        color: #fff1c4 !important;
        box-shadow:
          inset 0 2px 0 rgba(255,255,255,0.20),
          0 10px 20px rgba(0,0,0,0.65);
      }
    `;

    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (tableFullScreen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [tableFullScreen]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    return teachers.filter((t) =>
      [
        t.fullName,
        t.employeeNo,
        t.subject1,
        t.subject2,
        t.subject3,
        t.subject4,
        t.grades,
        t.phone,
        t.notes,
      ].some((x) => String(x).includes(q))
    );
  }, [teachers, query]);

  function validateBasics(t: Teacher) {
    if (!t.employeeNo.trim()) return { ok: false, msg: tr("الرقم الوظيفي مطلوب.", "Employee number is required.") };
    if (!t.fullName.trim()) return { ok: false, msg: tr("الاسم الكامل مطلوب.", "Full name is required.") };
    return { ok: true, msg: "" };
  }

  function findDuplicates(employeeNo: string, ignoreId?: string | null) {
    const key = employeeNo.trim();
    if (!key) return [];
    return teachers.filter((t) => t.employeeNo.trim() === key && t.id !== ignoreId);
  }

  function openDupModal(employeeNo: string, ignoreId: string | null, pending: Teacher, context: "add" | "edit") {
    const candidates = findDuplicates(employeeNo, ignoreId);
    setDupModal({
      open: true,
      employeeNo: employeeNo.trim(),
      candidates,
      pending,
      context,
    });
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setNewTeacher({ ...emptyTeacher, id: genId() });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveAdd() {
    const basic = validateBasics(newTeacher);
    if (!basic.ok) return alert(basic.msg);

    const dups = findDuplicates(newTeacher.employeeNo, null);
    if (dups.length) {
      return openDupModal(newTeacher.employeeNo, null, { ...newTeacher }, "add");
    }

    setTeachers((prev) => [{ ...newTeacher, id: newTeacher.id || genId() }, ...prev]);
    setAdding(false);
    setNewTeacher({ ...emptyTeacher, id: genId() });
  }

  function startEdit(t: Teacher) {
    setAdding(false);
    setEditingId(t.id);
    setEdit({ ...t });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveEdit() {
    if (!editingId) return;

    const basic = validateBasics(edit);
    if (!basic.ok) return alert(basic.msg);

    const dups = findDuplicates(edit.employeeNo, editingId);
    if (dups.length) {
      return openDupModal(edit.employeeNo, editingId, { ...edit }, "edit");
    }

    setTeachers((prev) => prev.map((t) => (t.id === editingId ? { ...edit, id: editingId } : t)));
    setEditingId(null);
    setEdit({ ...emptyTeacher, id: "" });
  }

  function removeTeacher(id: string) {
    if (!confirm(tr("هل تريد حذف هذا المعلم؟", "Do you want to delete this teacher?"))) return;
    setTeachers((prev) => prev.filter((t) => t.id !== id));
  }

  function deleteAll() {
    if (!teachers.length) return;
    const ok = confirm(
      tr(
        "⚠️ هل أنت متأكد من حذف جدول الكادر التعليمي كاملًا؟ لا يمكن التراجع.",
        "⚠️ Are you sure you want to delete the entire teaching staff table? This cannot be undone."
      )
    );
    if (!ok) return;
    setTeachers([]);
  }

  function toCSV(rows: Teacher[]) {
    const header =
      lang === "ar"
        ? ["الاسم الكامل", "الرقم الوظيفي", "المادة 1", "المادة 2", "المادة 3", "المادة 4", "الصفوف", "رقم الهاتف", "ملاحظات"]
        : ["Full Name", "Employee Number", "Subject 1", "Subject 2", "Subject 3", "Subject 4", "Grades", "Phone Number", "Notes"];

    const escape = (s: string) => {
      const v = (s ?? "").replace(/\r?\n/g, " ").trim();
      if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };

    const lines = [
      header.join(","),
      ...rows.map((t) =>
        [
          t.fullName,
          t.employeeNo,
          lang === "ar" ? t.subject1 : translateSubject(t.subject1),
          lang === "ar" ? t.subject2 : translateSubject(t.subject2),
          lang === "ar" ? t.subject3 : translateSubject(t.subject3),
          lang === "ar" ? t.subject4 : translateSubject(t.subject4),
          t.grades,
          t.phone,
          t.notes,
        ].map(escape).join(",")
      ),
    ];
    return lines.join("\n");
  }

  function exportCSV() {
    const csv = toCSV(teachers);
    downloadText("teachers.csv", csv);
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const rows = teachers.map((t) =>
        lang === "ar"
          ? {
              "الاسم الكامل": t.fullName,
              "الرقم الوظيفي": t.employeeNo,
              "المادة 1": t.subject1,
              "المادة 2": t.subject2,
              "المادة 3": t.subject3,
              "المادة 4": t.subject4,
              "الصفوف": t.grades,
              "رقم الهاتف": t.phone,
              "ملاحظات": t.notes,
            }
          : {
              "Full Name": t.fullName,
              "Employee Number": t.employeeNo,
              "Subject 1": translateSubject(t.subject1),
              "Subject 2": translateSubject(t.subject2),
              "Subject 3": translateSubject(t.subject3),
              "Subject 4": translateSubject(t.subject4),
              "Grades": t.grades,
              "Phone Number": t.phone,
              "Notes": t.notes,
            }
      );
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Teachers");
      XLSX.writeFile(wb, "teachers.xlsx");
    } catch {
      alert(tr("مكتبة xlsx غير متوفرة. استخدم تصدير CSV أو ثبّت xlsx.", "xlsx library is not available. Use CSV export or install xlsx."));
    }
  }

  async function importExcel(file: File) {
    const json = await tryReadExcel(file);
    if (!json) {
      alert(tr("تعذر قراءة Excel. تأكد من وجود مكتبة xlsx أو استخدم CSV.", "Unable to read Excel. Make sure xlsx is installed or use CSV."));
      return;
    }
    const incoming = parseTeachersFromObjects(json);
    mergeImported(incoming);
  }

  async function importCSV(file: File) {
    const text = await file.text();
    const objs = parseCSV(text);
    const incoming = parseTeachersFromObjects(objs);
    mergeImported(incoming);
  }

  function mergeImported(incoming: Teacher[]) {
    if (!incoming.length) return alert(tr("لا توجد بيانات صالحة للاستيراد.", "No valid data found for import."));

    const existingByNo = new Map(teachers.map((t) => [t.employeeNo.trim(), t]));
    const next = [...teachers];

    for (const t of incoming) {
      const key = t.employeeNo.trim();
      if (!key) continue;

      if (existingByNo.has(key)) {
        const old = existingByNo.get(key)!;
        const ok = confirm(
          tr(
            `⚠️ الرقم الوظيفي (${key}) موجود بالفعل باسم: (${old.fullName}).\nهل تريد استبدال البيانات بالاسم الجديد: (${t.fullName}) ؟`,
            `⚠️ Employee number (${key}) already exists under: (${old.fullName}).\nDo you want to replace it with the new name: (${t.fullName})?`
          )
        );
        if (ok) {
          const idx = next.findIndex((x) => x.id === old.id);
          if (idx >= 0) next[idx] = { ...t, id: old.id };
        }
      } else {
        next.unshift({ ...t, id: t.id || genId() });
      }
    }

    setTeachers(next);
    alert(tr("✅ تم استيراد البيانات.", "✅ Data imported successfully."));
  }

  function resolveDuplicate(action: "change" | "overwrite", selectedId?: string) {
    if (action === "change") {
      setDupModal((s) => ({ ...s, open: false }));
      return;
    }

    if (!selectedId) return;

    const pending = dupModal.pending;

    setTeachers((prev) => prev.map((t) => (t.id === selectedId ? { ...pending, id: selectedId } : t)));

    setDupModal((s) => ({ ...s, open: false }));

    if (dupModal.context === "add") {
      setAdding(false);
      setNewTeacher({ ...emptyTeacher, id: genId() });
    } else {
      setEditingId(null);
      setEdit({ ...emptyTeacher, id: "" });
    }
  }

  const pageStyle: React.CSSProperties = {
    padding: 18,
    color: "#e6c76a",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(212,175,55,0.14), transparent 24%), radial-gradient(circle at 88% 18%, rgba(59,130,246,0.10), transparent 24%), linear-gradient(180deg, #070b12 0%, #0b1220 42%, #060a12 100%)",
    position: "relative",
    overflowX: "hidden",
    direction: isRTL ? "rtl" : "ltr",
  };

  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(11,18,32,0.94), rgba(9,16,29,0.96))",
    border: "1px solid rgba(212,175,55,0.15)",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 22px 60px rgba(0,0,0,0.36)",
    marginBottom: 14,
    backdropFilter: "blur(6px)",
  };

  const btn = (bg: string, fg = "#0b1220"): React.CSSProperties => ({
    background: bg,
    color: fg,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
  });

  const inputStyle: React.CSSProperties = {
    background: "#0b1220",
    color: "#e6c76a",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
  };

  const tableWrap: React.CSSProperties = {
    maxHeight: "55vh",
    overflow: "auto",
    borderRadius: 18,
    border: "1px solid rgba(212,175,55,0.18)",
    background: "linear-gradient(180deg, rgba(11,18,32,0.92), rgba(8,12,22,0.92))",
    boxShadow:
      "0 22px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 18px rgba(0,0,0,0.35)",
  };

  const tableStyle3D: React.CSSProperties = {
    width: "100%",
    minWidth: 1250,
    borderCollapse: "separate",
    borderSpacing: 8,
  };

  const thStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    background: "linear-gradient(180deg, #0f1a2e, #0b1220)",
    color: "#d4af37",
    zIndex: 2,
    padding: 10,
    textAlign: isRTL ? "right" : "left",
    fontWeight: 900,
    borderBottom: "1px solid rgba(212,175,55,0.22)",
    borderLeft: isRTL ? "3px solid rgba(184,134,11,0.95)" : undefined,
    borderRight: !isRTL ? "3px solid rgba(184,134,11,0.95)" : undefined,
    whiteSpace: "nowrap",
    borderRadius: 14,
    boxShadow: "0 10px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
  };

  const tdStyle: React.CSSProperties = {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    borderLeft: isRTL ? "3px solid rgba(184,134,11,0.65)" : undefined,
    borderRight: !isRTL ? "3px solid rgba(184,134,11,0.65)" : undefined,
    whiteSpace: "nowrap",
    color: "#e6c76a",
    background: "linear-gradient(145deg, rgba(20,24,34,0.96), rgba(10,12,18,0.96))",
    borderRadius: 14,
    boxShadow: "0 10px 22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
  };

  const modalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const modalCard: React.CSSProperties = {
    width: "min(720px, 96vw)",
    background: "linear-gradient(180deg, #0b1220, #09101d)",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 22px 80px rgba(0,0,0,0.55)",
    color: "#e6c76a",
    direction: isRTL ? "rtl" : "ltr",
  };

  return (
    <div style={pageStyle} ref={topRef}>
      {dupModal.open && (
        <div style={modalOverlay} onClick={() => resolveDuplicate("change")}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 8, color: "#d4af37" }}>
              {tr("⚠️ الرقم الوظيفي مكرر", "⚠️ Duplicate employee number")}
            </div>
            <div style={{ opacity: 0.95, marginBottom: 12, lineHeight: 1.8 }}>
              {tr(
                `الرقم الوظيفي ${dupModal.employeeNo} مستخدم بالفعل.\nإمّا تغيّر الرقم، أو تختار اسم من الموجودين بنفس الرقم لاستبدال بياناته بالبيانات الحالية.`,
                `Employee number ${dupModal.employeeNo} is already in use.\nEither change the number, or choose an existing name with the same number to replace its data with the current data.`
              )}
            </div>

            <div style={{ border: "1px solid rgba(212,175,55,0.18)", borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, position: "static" }}>{tr("الاسم", "Name")}</th>
                    <th style={{ ...thStyle, position: "static" }}>{tr("الرقم", "Number")}</th>
                    <th style={{ ...thStyle, position: "static" }}>{tr("إجراء", "Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dupModal.candidates.map((c) => (
                    <tr key={c.id}>
                      <td style={tdStyle}>{c.fullName}</td>
                      <td style={tdStyle}>{c.employeeNo}</td>
                      <td style={tdStyle}>
                        <button
                          style={btn("#f59e0b", "#07101f")}
                          onClick={() => resolveDuplicate("overwrite", c.id)}
                        >
                          {tr("استبدال هذا الاسم", "Replace this name")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button style={btn("#1f2937", "#d4af37")} onClick={() => resolveDuplicate("change")}>
                {tr("تغيير الرقم", "Change number")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto 18px auto",
          display: "grid",
          gap: 18,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 18,
            border: "1px solid rgba(212,175,55,0.18)",
            borderRadius: 34,
            padding: 28,
            background:
              "linear-gradient(135deg, rgba(30,22,2,0.95), rgba(8,8,8,0.98), rgba(27,21,3,0.94))",
            boxShadow:
              "0 32px 100px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -120,
              left: "50%",
              transform: "translateX(-50%)",
              width: 560,
              height: 560,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212,175,55,0.16), rgba(212,175,55,0.05) 38%, transparent 72%)",
              filter: "blur(10px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: isRTL ? -100 : undefined,
              left: !isRTL ? -100 : undefined,
              bottom: -120,
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(16,185,129,0.10), transparent 72%)",
              filter: "blur(10px)",
              pointerEvents: "none",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "start", position: "relative", zIndex: 1 }}>
            <div style={{ display: "grid", gap: 14, maxWidth: 900 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.22)",
                  color: "#a7f3d0",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {tr("إدارة ذكية ومباشرة للكادر التعليمي", "Smart and direct teaching staff management")}
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,241,196,0.88)", marginBottom: 10 }}>
                  {tr("نظام إدارة الامتحانات المطوّر", "Advanced Exam Management System")}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(34px, 5vw, 64px)",
                    lineHeight: 1.05,
                    fontWeight: 950,
                    color: "#fff1c4",
                    letterSpacing: "-0.03em",
                    textShadow: "0 8px 28px rgba(212,175,55,0.16)",
                  }}
                >
                  {tr("مركز إدارة الكادر التعليمي", "Teaching Staff Management Center")}
                </h1>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 2,
                  color: "rgba(255,241,196,0.82)",
                  maxWidth: 940,
                }}
              >
                {tr(
                  "تمنح هذه الصفحة الإدارة واجهة فاخرة ومنظمة لإدارة بيانات المعلمين والمواد والصفوف والاتصال، مع تجربة سلسة للإضافة والتعديل والاستيراد والتصدير، وإبراز قوي للجدول التشغيلي في صورة مؤسسية راقية.",
                  "This page gives the administration a premium and organized interface to manage teachers, subjects, grades, and contact data, with a smooth experience for adding, editing, importing, and exporting, and a strong professional presentation of the operational table."
                )}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: tr("إجمالي المعلمين", "Total Teachers"), value: teachers.length },
                  { label: tr("المعروض الآن", "Currently Shown"), value: filtered.length },
                  { label: tr("البحث الحالي", "Current Search"), value: query.trim() || tr("بدون فلترة", "No Filter") },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                      borderRadius: 18,
                      padding: "12px 14px",
                      minWidth: 190,
                      boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800 }}>{item.label}</div>
                    <div style={{ marginTop: 6, fontSize: 16, color: "#fff8dc", fontWeight: 900 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                minWidth: 300,
                maxWidth: 390,
                width: "100%",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 28,
                padding: 22,
                background: "linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.02))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                display: "grid",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: teachers.length ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)",
                  border: teachers.length ? "1px solid rgba(16,185,129,0.24)" : "1px solid rgba(245,158,11,0.24)",
                  color: teachers.length ? "#a7f3d0" : "#fde68a",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {teachers.length ? tr("البيانات جاهزة للإدارة", "Data is ready for management") : tr("لا توجد بيانات بعد", "No data yet")}
              </div>

              <div style={{ fontSize: 28, lineHeight: 1.5, fontWeight: 950, color: "#fff1c4" }}>
                {tr(
                  "يمكنك من هنا إدارة المعلمين والمواد والصفوف وتصدير البيانات أو استيرادها، مع جدول فاخر وتجربة إدخال مريحة ومنظمة من أول لحظة.",
                  "From here you can manage teachers, subjects, and grades, and export or import data, with a premium table and a comfortable, organized entry experience from the first moment."
                )}
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.95, color: "rgba(255,241,196,0.78)" }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn("#1f2937", "#d4af37")} onClick={() => history.back()}>
            {tr("← رجوع", "← Back")}
          </button>
          <button style={btn("#3b82f6", "#07101f")} onClick={startAdd}>
            {tr("+ إضافة معلم جديد", "+ Add New Teacher")}
          </button>
          <button style={btn("#ef4444", "#07101f")} onClick={deleteAll}>
            {tr("🗑 حذف الكل", "🗑 Delete All")}
          </button>

          <div style={{ marginInlineStart: "auto", fontWeight: 1000, color: "#d4af37" }}>
            {tr("إدارة بيانات الكادر التعليمي", "Teaching Staff Data Management")}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inputStyle, maxWidth: 420 }}
            placeholder={tr("بحث بالاسم أو الرقم الوظيفي...", "Search by name or employee number...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button style={btn("#10b981", "#07101f")} onClick={exportExcel}>
            {tr("تصدير Excel", "Export Excel")}
          </button>
          <button style={btn("#22c55e", "#07101f")} onClick={exportCSV}>
            {tr("تصدير CSV", "Export CSV")}
          </button>

          <label style={btn("#60a5fa", "#07101f")}>
            {tr("استيراد CSV ⬆️", "Import CSV ⬆️")}
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCSV(f);
                e.currentTarget.value = "";
              }}
            />
          </label>

          <label style={btn("#93c5fd", "#07101f")}>
            {tr("استيراد Excel ⬆️", "Import Excel ⬆️")}
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importExcel(f);
                e.currentTarget.value = "";
              }}
            />
          </label>

          <div style={{ marginInlineStart: "auto", fontWeight: 900, color: "#d4af37" }}>
            {tr("إجمالي", "Total")}: {teachers.length} — {tr("المعروض", "Shown")}: {filtered.length}
          </div>
        </div>
      </div>

      {(adding || editingId) && (
        <div style={card}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(220px, 1fr))" }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("الاسم الكامل", "Full Name")}</div>
              <input
                style={inputStyle}
                value={adding ? newTeacher.fullName : edit.fullName}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, fullName: e.target.value })
                    : setEdit({ ...edit, fullName: e.target.value })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("الرقم الوظيفي", "Employee Number")}</div>
              <input
                style={inputStyle}
                value={adding ? newTeacher.employeeNo : edit.employeeNo}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, employeeNo: e.target.value })
                    : setEdit({ ...edit, employeeNo: e.target.value })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("المادة 1", "Subject 1")}</div>
              <GoldDropdown
                value={adding ? newTeacher.subject1 : edit.subject1}
                options={SUBJECT_OPTIONS}
                placeholder={tr("— اختر المادة —", "— Select Subject —")}
                onChange={(v) =>
                  adding ? setNewTeacher({ ...newTeacher, subject1: v }) : setEdit({ ...edit, subject1: v })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("المادة 2", "Subject 2")}</div>
              <GoldDropdown
                value={adding ? newTeacher.subject2 : edit.subject2}
                options={SUBJECT_OPTIONS}
                placeholder={tr("— اختر المادة —", "— Select Subject —")}
                onChange={(v) =>
                  adding ? setNewTeacher({ ...newTeacher, subject2: v }) : setEdit({ ...edit, subject2: v })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("المادة 3", "Subject 3")}</div>
              <GoldDropdown
                value={adding ? newTeacher.subject3 : edit.subject3}
                options={SUBJECT_OPTIONS}
                placeholder={tr("— اختر المادة —", "— Select Subject —")}
                onChange={(v) =>
                  adding ? setNewTeacher({ ...newTeacher, subject3: v }) : setEdit({ ...edit, subject3: v })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("المادة 4", "Subject 4")}</div>
              <GoldDropdown
                value={adding ? newTeacher.subject4 : edit.subject4}
                options={SUBJECT_OPTIONS}
                placeholder={tr("— اختر المادة —", "— Select Subject —")}
                onChange={(v) =>
                  adding ? setNewTeacher({ ...newTeacher, subject4: v }) : setEdit({ ...edit, subject4: v })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("الصفوف", "Grades")}</div>
              <input
                style={inputStyle}
                placeholder={tr("مثال: 10-5", "Example: 10-5")}
                value={adding ? newTeacher.grades : edit.grades}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, grades: e.target.value })
                    : setEdit({ ...edit, grades: e.target.value })
                }
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("الهاتف", "Phone")}</div>
              <input
                style={inputStyle}
                value={adding ? newTeacher.phone : edit.phone}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, phone: e.target.value })
                    : setEdit({ ...edit, phone: e.target.value })
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("ملاحظات", "Notes")}</div>
              <textarea
                style={{ ...inputStyle, minHeight: 80 }}
                value={adding ? newTeacher.notes : edit.notes}
                onChange={(e) =>
                  adding
                    ? setNewTeacher({ ...newTeacher, notes: e.target.value })
                    : setEdit({ ...edit, notes: e.target.value })
                }
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {adding ? (
              <>
                <button style={btn("#10b981", "#07101f")} onClick={saveAdd}>
                  {tr("حفظ", "Save")}
                </button>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => setAdding(false)}>
                  {tr("إلغاء", "Cancel")}
                </button>
              </>
            ) : (
              <>
                <button style={btn("#10b981", "#07101f")} onClick={saveEdit}>
                  {tr("حفظ التعديل", "Save Changes")}
                </button>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => setEditingId(null)}>
                  {tr("إلغاء", "Cancel")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div
        style={
          tableFullScreen
            ? {
                ...card,
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 9999,
                marginBottom: 0,
                borderRadius: 0,
                padding: 12,
                background: "rgba(10,10,12,0.96)",
                overflow: "hidden",
                border: "1px solid rgba(212,175,55,0.22)",
                boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
              }
            : card
        }
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, color: "#d4af37" }}>{tr("قائمة الكادر التعليمي", "Teaching Staff List")}</div>

          <button
            style={btn(tableFullScreen ? "#ef4444" : "#1f2937", tableFullScreen ? "#07101f" : "#d4af37")}
            onClick={() => setTableFullScreen((v) => !v)}
            title={tableFullScreen ? tr("عودة للحجم الطبيعي", "Return to normal size") : tr("تكبير الجدول ملء الشاشة", "Fullscreen table")}
          >
            {tableFullScreen ? tr("إغلاق ملء الشاشة", "Exit Fullscreen") : tr("ملء الشاشة", "Fullscreen")}
          </button>
        </div>

        <div
          className="teachersTable3D"
          style={
            tableFullScreen
              ? {
                  height: "calc(100vh - 70px)",
                  overflow: "auto",
                  borderRadius: 16,
                  border: "1px solid rgba(212,175,55,0.12)",
                  position: "relative",
                }
              : {
                  ...tableWrap,
                  position: "relative",
                }
          }
        >
          <table style={tableStyle3D}>
            <thead>
              <tr>
                <th style={thStyle} className="col-name">{tr("الاسم الكامل", "Full Name")}</th>
                <th style={thStyle} className="col-emp">{tr("الرقم الوظيفي", "Employee Number")}</th>
                <th style={thStyle}>{tr("المادة 1", "Subject 1")}</th>
                <th style={thStyle}>{tr("المادة 2", "Subject 2")}</th>
                <th style={thStyle}>{tr("المادة 3", "Subject 3")}</th>
                <th style={thStyle}>{tr("المادة 4", "Subject 4")}</th>
                <th style={thStyle}>{tr("الصفوف", "Grades")}</th>
                <th style={thStyle}>{tr("الهاتف", "Phone")}</th>
                <th style={thStyle}>{tr("ملاحظات", "Notes")}</th>
                <th style={thStyle}>{tr("إجراءات", "Actions")}</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={10}>
                    {tr("لا توجد بيانات.", "No data found.")}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id}>
                    <td style={tdStyle} className="col-name">{t.fullName}</td>
                    <td style={tdStyle} className="col-emp">{t.employeeNo}</td>
                    <td style={tdStyle}>{translateSubject(t.subject1)}</td>
                    <td style={tdStyle}>{translateSubject(t.subject2)}</td>
                    <td style={tdStyle}>{translateSubject(t.subject3)}</td>
                    <td style={tdStyle}>{translateSubject(t.subject4)}</td>
                    <td style={tdStyle}>{t.grades}</td>
                    <td style={tdStyle}>{t.phone}</td>
                    <td style={tdStyle} title={t.notes}>{t.notes}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={btn("#60a5fa", "#07101f")} onClick={() => startEdit(t)}>
                          {tr("✏️ تعديل", "✏️ Edit")}
                        </button>
                        <button style={btn("#ef4444", "#07101f")} onClick={() => removeTeacher(t.id)}>
                          {tr("🗑 حذف", "🗑 Delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
