
import { supabase } from '../../sms/supabaseClient';

export interface SubjectResult {
  name: string;
  grade: string;
  score: number;
  comment: string;
}

export interface ReportCard {
  term: string;
  gpa: string;
  rank: string;
  attendance: string;
  subjects: SubjectResult[];
}

export interface PaymentRecord {
  id: string;
  description: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  date: string;
}

export interface ExamResult {
  subject: string;
  score: number;
  grade: string;
  examTitle: string;
  date: string;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: string;
}

export interface HomeworkItem {
  id: string;
  title: string;
  status: string;
  dueDate: string;
}

export interface ParentPortalData {
  examResults: ExamResult[];
  attendance: AttendanceStats;
  homework: HomeworkItem[];
  payments: PaymentRecord[];
  reportCard: ReportCard | null;
  notices: string[];
  lastSync: string;
}

/**
 * Fetches all live data from Supabase for the given student IDs.
 * Falls back gracefully with zeros/empty arrays if data is missing.
 */
export const fetchParentPortalData = async (
  studentIds: string[],
  schoolId?: string
): Promise<ParentPortalData> => {
  if (!studentIds || studentIds.length === 0) {
    return getEmptyPortalData();
  }

  const primaryStudentId = studentIds[0];

  const [
    examGradesRes,
    attendanceRes,
    homeworkRes,
    paymentsRes,
    reportCardRes,
    noticesRes,
  ] = await Promise.allSettled([
    // 1. Exam grades joined with exam title
    supabase
      .from('exam_grades')
      .select('score, note, student_id, exam_id, exams(title, subject, date)')
      .eq('student_id', primaryStudentId)
      .order('created_at', { ascending: false })
      .limit(20),

    // 2. Attendance
    supabase
      .from('attendance_records')
      .select('status, date')
      .eq('student_id', primaryStudentId),

    // 3. Homework assignments
    supabase
      .from('homework_assignments')
      .select('id, title, due_date, status')
      .order('due_date', { ascending: true })
      .limit(10),

    // 4. Student payments
    supabase
      .from('student_payments')
      .select('id, description, amount, status, created_at')
      .eq('student_id', primaryStudentId)
      .order('created_at', { ascending: false })
      .limit(15),

    // 5. Latest report card
    supabase
      .from('report_cards')
      .select('*')
      .eq('student_id', primaryStudentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 6. Notice board
    supabase
      .from('notice_board')
      .select('title, content, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // --- Exam Results ---
  const examResults: ExamResult[] = [];
  if (examGradesRes.status === 'fulfilled' && examGradesRes.value.data) {
    for (const row of examGradesRes.value.data) {
      const exam = (row as any).exams;
      const score = Number(row.score) || 0;
      examResults.push({
        subject: exam?.subject || exam?.title || 'Subject',
        score,
        grade: scoreToGrade(score),
        examTitle: exam?.title || 'Assessment',
        date: exam?.date || '',
      });
    }
  }

  // --- Attendance ---
  const attendance: AttendanceStats = { total: 0, present: 0, absent: 0, late: 0, rate: '0%' };
  if (attendanceRes.status === 'fulfilled' && attendanceRes.value.data) {
    const records = attendanceRes.value.data;
    attendance.total = records.length;
    attendance.present = records.filter((r: any) => r.status === 'P' || r.status === 'present').length;
    attendance.absent = records.filter((r: any) => r.status === 'A' || r.status === 'absent').length;
    attendance.late = records.filter((r: any) => r.status === 'L' || r.status === 'late').length;
    attendance.rate = attendance.total > 0
      ? `${Math.round((attendance.present / attendance.total) * 100)}%`
      : '0%';
  }

  // --- Homework ---
  const homework: HomeworkItem[] = [];
  if (homeworkRes.status === 'fulfilled' && homeworkRes.value.data) {
    for (const row of homeworkRes.value.data) {
      homework.push({
        id: String(row.id),
        title: row.title || 'Assignment',
        status: row.status || 'Pending',
        dueDate: row.due_date || '',
      });
    }
  }

  // --- Payments ---
  const payments: PaymentRecord[] = [];
  if (paymentsRes.status === 'fulfilled' && paymentsRes.value.data) {
    for (const row of paymentsRes.value.data) {
      payments.push({
        id: String(row.id),
        description: row.description || 'Fee',
        amount: Number(row.amount) || 0,
        status: (row.status as PaymentRecord['status']) || 'Pending',
        date: row.created_at ? new Date(row.created_at).toLocaleDateString() : '',
      });
    }
  }

  // --- Report Card ---
  let reportCard: ReportCard | null = null;
  if (reportCardRes.status === 'fulfilled' && reportCardRes.value.data) {
    const rc = reportCardRes.value.data as any;
    // Parse subjects either from JSON or build from exam results
    let subjects: SubjectResult[] = [];
    if (Array.isArray(rc.subjects)) {
      subjects = rc.subjects;
    } else if (examResults.length > 0) {
      // Build per-subject averages from exam grades
      const subjectMap: Record<string, number[]> = {};
      examResults.forEach(e => {
        if (!subjectMap[e.subject]) subjectMap[e.subject] = [];
        subjectMap[e.subject].push(e.score);
      });
      subjects = Object.entries(subjectMap).map(([name, scores]) => {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        return { name, score: avg, grade: scoreToGrade(avg), comment: '' };
      });
    }

    const avgScore = subjects.length > 0
      ? subjects.reduce((s, sub) => s + sub.score, 0) / subjects.length
      : 0;

    reportCard = {
      term: rc.term || rc.semester || 'Current Term',
      gpa: rc.gpa ? String(rc.gpa) : avgScore > 0 ? (avgScore / 25).toFixed(2) : '0.00',
      rank: rc.rank || '—',
      attendance: attendance.rate,
      subjects,
    };
  } else if (examResults.length > 0) {
    // Build from exam_grades if no report_card row
    const subjectMap: Record<string, number[]> = {};
    examResults.forEach(e => {
      if (!subjectMap[e.subject]) subjectMap[e.subject] = [];
      subjectMap[e.subject].push(e.score);
    });
    const subjects: SubjectResult[] = Object.entries(subjectMap).map(([name, scores]) => {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return { name, score: avg, grade: scoreToGrade(avg), comment: '' };
    });
    const avgScore = subjects.reduce((s, sub) => s + sub.score, 0) / (subjects.length || 1);
    reportCard = {
      term: 'Current Term',
      gpa: (avgScore / 25).toFixed(2),
      rank: '—',
      attendance: attendance.rate,
      subjects,
    };
  }

  // --- Notices ---
  const notices: string[] = [];
  if (noticesRes.status === 'fulfilled' && noticesRes.value.data) {
    for (const row of noticesRes.value.data) {
      notices.push(row.title || row.content || 'Notice');
    }
  }

  return {
    examResults,
    attendance,
    homework,
    payments,
    reportCard,
    notices,
    lastSync: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
};

// ---------- helpers ----------

function scoreToGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

function getEmptyPortalData(): ParentPortalData {
  return {
    examResults: [],
    attendance: { total: 0, present: 0, absent: 0, late: 0, rate: '0%' },
    homework: [],
    payments: [],
    reportCard: null,
    notices: [],
    lastSync: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

// Legacy export kept for backward compat
export const syncSmsData = fetchParentPortalData;
