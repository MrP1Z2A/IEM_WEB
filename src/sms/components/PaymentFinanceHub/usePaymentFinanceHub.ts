import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../../supabaseClient';
import { getCurrentTenantContext, withSchoolId, withSchoolIdRows } from '../../services/tenantService';

type FinanceView = 'payment' | 'payment-assign' | 'payment-history' | 'student-finance-status' | 'cash-records';

type AppStudent = {
  id: string;
  name: string;
  email?: string;
};

type PaymentStatus = 'paid' | 'pending' | 'overdue';

type StudentPayment = {
  id: string;
  student_id: string;
  amount_mmk: number;
  payment_date: string;
  due_date: string | null;
  status: PaymentStatus;
  note: string | null;
  created_at: string;
};

type StudentCourseLink = {
  student_id: string;
  class_id: string;
  class_course_id: string;
};

type AppCourse = {
  id: string;
  name: string;
  class_id: string;
};

type CashOutRecord = {
  id: string;
  amount_mmk: number;
  record_date: string;
  category: string;
  note: string | null;
  created_at: string;
};

type CashLedgerEntry = {
  id: string;
  entry_type: 'in' | 'out';
  amount_mmk: number;
  record_date: string;
  title: string;
  subtitle: string;
  note: string | null;
  created_at: string;
};

type PaymentFinanceHubProps = {
  view: FinanceView;
  schoolId: string | undefined;
};

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const toIsoDate = (value: string | null | undefined) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const isCashRecordsSchemaMissing = (message?: string | null) => {
  const text = String(message || '').toLowerCase();
  return text.includes('cash_records') && (
    /relation|does not exist|column/.test(text)
    || text.includes('could not find the table')
    || text.includes('schema cache')
  );
};

const formatMMK = (value: number) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000_000) {
    const inBillions = amount / 1_000_000_000;
    return `${inBillions.toFixed(2).replace(/\.00$/, '')}B MMK`;
  }
  return `${Math.round(amount).toLocaleString('en-US')} MMK`;
};

const amountToWords = (value: number) => {
  const ones = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelowThousand = (num: number): string => {
    const parts: string[] = [];
    if (num >= 100) {
      parts.push(`${ones[Math.floor(num / 100)]} Hundred`);
      num %= 100;
    }
    if (num >= 20) {
      parts.push(tens[Math.floor(num / 10)]);
      if (num % 10) parts.push(ones[num % 10]);
      return parts.join(' ');
    }
    if (num >= 10) {
      parts.push(teens[num - 10]);
      return parts.join(' ');
    }
    if (num > 0) {
      parts.push(ones[num]);
    }
    return parts.join(' ');
  };

  const amount = Math.max(0, Math.round(Number(value || 0)));
  if (amount === 0) return 'Zero Kyats';

  const groups = [
    { value: 1_000_000_000, label: 'Billion' },
    { value: 1_000_000, label: 'Million' },
    { value: 1_000, label: 'Thousand' },
    { value: 1, label: '' },
  ];

  let remaining = amount;
  const words: string[] = [];

  groups.forEach(group => {
    if (remaining < group.value) return;
    const groupValue = Math.floor(remaining / group.value);
    if (groupValue > 0) {
      const chunk = convertBelowThousand(groupValue);
      words.push(group.label ? `${chunk} ${group.label}` : chunk);
      remaining %= group.value;
    }
  });

  return `${words.join(' ')} Kyats`;
};

export function usePaymentFinanceHub(schoolId: string | undefined, view: any) {
  const [students, setStudents] = useState<AppStudent[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [cashOutRecords, setCashOutRecords] = useState<CashOutRecord[]>([]);
  const [studentCourseLinks, setStudentCourseLinks] = useState<StudentCourseLink[]>([]);
  const [courseRows, setCourseRows] = useState<AppCourse[]>([]);
  const [classesMap, setClassesMap] = useState<Map<string, string>>(new Map());
  const [coursesMap, setCoursesMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCashRecordsSchemaReady, setIsCashRecordsSchemaReady] = useState(true);
  const [collectingStudentId, setCollectingStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [cashSearchQuery, setCashSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignAmountMmk, setAssignAmountMmk] = useState('');
  const [assignDueDate, setAssignDueDate] = useState(() => getTodayIso());
  const [assignNote, setAssignNote] = useState('');
  const [assignClassFilter, setAssignClassFilter] = useState('');
  const [assignCourseFilter, setAssignCourseFilter] = useState('');
  const [financeStatusTab, setFinanceStatusTab] = useState<'all' | 'pending'>('all');

  const [formData, setFormData] = useState({
    student_id: '',
    amount_mmk: '',
    payment_date: getTodayIso(),
    status: 'paid' as PaymentStatus,
    note: '',
  });
  const [cashOutFormData, setCashOutFormData] = useState({
    amount_mmk: '',
    record_date: getTodayIso(),
    category: '',
    note: '',
  });

  const studentMap = useMemo(() => {
    const map = new Map<string, AppStudent>();
    students.forEach(student => map.set(student.id, student));
    return map;
  }, [students]);

  const studentAcademicMap = useMemo(() => {
    const map = new Map<string, { className: string; courseName: string }>();

    studentCourseLinks.forEach(link => {
      if (!link.student_id || map.has(link.student_id)) return;
      map.set(link.student_id, {
        className: classesMap.get(link.class_id) || 'Unassigned Class',
        courseName: coursesMap.get(link.class_course_id) || 'Unassigned Course',
      });
    });

    return map;
  }, [studentCourseLinks, classesMap, coursesMap]);

  const studentAcademicIdMap = useMemo(() => {
    const map = new Map<string, { classIds: Set<string>; courseIds: Set<string> }>();

    studentCourseLinks.forEach(link => {
      if (!link.student_id) return;
      const current = map.get(link.student_id) || { classIds: new Set<string>(), courseIds: new Set<string>() };
      if (link.class_id) current.classIds.add(link.class_id);
      if (link.class_course_id) current.courseIds.add(link.class_course_id);
      map.set(link.student_id, current);
    });

    return map;
  }, [studentCourseLinks]);

  const getStudentAcademic = (studentId: string) => {
    const data = studentAcademicMap.get(studentId);
    if (!data) {
      return {
        className: 'Unassigned Class',
        courseName: 'Unassigned Course',
      };
    }

    return data;
  };

  const getStudentAcademicIds = (studentId: string) => {
    const data = studentAcademicIdMap.get(studentId);
    if (!data) {
      return {
        classIds: new Set<string>(),
        courseIds: new Set<string>(),
      };
    }

    return data;
  };

  const matchesStudentSearch = (studentId: string) => {
    const q = studentSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const student = studentMap.get(studentId);
    const name = String(student?.name || studentId).toLowerCase();
    const email = String(student?.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  };

  const filteredStudents = useMemo(
    () => students.filter(student => matchesStudentSearch(student.id)),
    [students, studentSearchQuery, studentMap]
  );

  const assignClassOptions = useMemo(() => {
    const uniqueIds = new Set<string>();
    studentCourseLinks.forEach(link => {
      if (link.class_id) uniqueIds.add(link.class_id);
    });

    return Array.from(uniqueIds)
      .map(id => ({ id, name: classesMap.get(id) || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [studentCourseLinks, classesMap]);

  const assignCourseOptions = useMemo(() => {
    if (!assignClassFilter) return [];

    return courseRows
      .filter(course => course.class_id === assignClassFilter)
      .map(course => ({ id: course.id, name: course.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [courseRows, assignClassFilter]);

  const filteredStudentsForAssign = useMemo(
    () => filteredStudents.filter(student => {
      const academicIds = getStudentAcademicIds(student.id);
      if (assignClassFilter && !academicIds.classIds.has(assignClassFilter)) return false;
      if (assignCourseFilter && !academicIds.courseIds.has(assignCourseFilter)) return false;
      return true;
    }),
    [filteredStudents, assignClassFilter, assignCourseFilter, studentAcademicIdMap]
  );

  const areAllFilteredStudentsSelected = filteredStudentsForAssign.length > 0
    && filteredStudentsForAssign.every(student => selectedStudentIds.includes(student.id));

  useEffect(() => {
    setAssignCourseFilter('');
  }, [assignClassFilter]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [studentsResult, paymentsResult, classesResult, coursesResult, linksResult] = await Promise.all([
        supabase
          .from('students')
          .select('id, name, email')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
        supabase
          .from('student_payments')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', schoolId),
        supabase
          .from('class_courses')
          .select('id, name, class_id')
          .eq('school_id', schoolId),
        supabase
          .from('class_course_students')
          .select('student_id, class_id, class_course_id, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: true }),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (classesResult.error) throw classesResult.error;
      if (coursesResult.error) throw coursesResult.error;
      if (linksResult.error) throw linksResult.error;

      const studentRows = (studentsResult.data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || row.full_name || row.id),
        email: row.email ? String(row.email) : '',
      }));

      const paymentRows = (paymentsResult.data || []).map((row: any) => ({
        id: String(row.id),
        student_id: String(row.student_id || ''),
        amount_mmk: Number(row.amount_mmk || 0),
        payment_date: String(row.payment_date || row.created_at || getTodayIso()),
        due_date: row.due_date ? String(row.due_date) : null,
        status: (String(row.status || 'paid').toLowerCase() as PaymentStatus),
        note: row.note ? String(row.note) : null,
        created_at: String(row.created_at || new Date().toISOString()),
      }));

      const nextClassesMap = new Map<string, string>();
      (classesResult.data || []).forEach((row: any) => {
        nextClassesMap.set(String(row.id), String(row.name || row.id));
      });

      const nextCoursesMap = new Map<string, string>();
      const nextCourseRows: AppCourse[] = [];
      (coursesResult.data || []).forEach((row: any) => {
        nextCoursesMap.set(String(row.id), String(row.name || row.id));
        nextCourseRows.push({
          id: String(row.id),
          name: String(row.name || row.id),
          class_id: String(row.class_id || ''),
        });
      });

      const linkRows = (linksResult.data || []).map((row: any) => ({
        student_id: String(row.student_id || ''),
        class_id: String(row.class_id || ''),
        class_course_id: String(row.class_course_id || ''),
      })).filter((row: StudentCourseLink) => row.student_id);

      const cashRecordsResult = await supabase
        .from('cash_records')
        .select('id, amount_mmk, record_date, category, note, created_at')
        .eq('school_id', schoolId)
        .order('record_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (cashRecordsResult.error) {
        if (isCashRecordsSchemaMissing(cashRecordsResult.error.message)) {
          setIsCashRecordsSchemaReady(false);
          setCashOutRecords([]);
        } else {
          throw cashRecordsResult.error;
        }
      } else {
        const cashRows = (cashRecordsResult.data || []).map((row: any) => ({
          id: String(row.id),
          amount_mmk: Number(row.amount_mmk || 0),
          record_date: String(row.record_date || row.created_at || getTodayIso()),
          category: String(row.category || 'General'),
          note: row.note ? String(row.note) : null,
          created_at: String(row.created_at || new Date().toISOString()),
        }));

        setIsCashRecordsSchemaReady(true);
        setCashOutRecords(cashRows);
      }

      setStudents(studentRows);
      setPayments(paymentRows);
      setClassesMap(nextClassesMap);
      setCoursesMap(nextCoursesMap);
      setCourseRows(nextCourseRows);
      setStudentCourseLinks(linkRows);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load payment records.');
      setStudents([]);
      setPayments([]);
      setCashOutRecords([]);
      setClassesMap(new Map());
      setCoursesMap(new Map());
      setCourseRows([]);
      setStudentCourseLinks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [schoolId]);

  const isLate = (payment: StudentPayment) => {
    if (!payment.due_date) return false;
    if (payment.status === 'paid') return false;
    const due = toIsoDate(payment.due_date);
    if (!due) return false;
    return due < getTodayIso();
  };

  const filteredPayments = useMemo(
    () => payments.filter(payment => matchesStudentSearch(payment.student_id)),
    [payments, studentSearchQuery, studentMap]
  );

  const filteredPaidPayments = useMemo(
    () => filteredPayments.filter(payment => payment.status === 'paid'),
    [filteredPayments]
  );

  const totalCashIn = useMemo(
    () => payments
      .filter(payment => payment.status === 'paid')
      .reduce((sum, payment) => sum + payment.amount_mmk, 0),
    [payments]
  );

  const totalCashOut = useMemo(
    () => cashOutRecords.reduce((sum, record) => sum + record.amount_mmk, 0),
    [cashOutRecords]
  );

  const cashBalance = totalCashIn - totalCashOut;

  const cashLedgerEntries = useMemo(() => {
    const incomingEntries: CashLedgerEntry[] = payments
      .filter(payment => payment.status === 'paid')
      .map(payment => {
        const student = studentMap.get(payment.student_id);
        const academic = studentAcademicMap.get(payment.student_id);

        return {
          id: `payment-${payment.id}`,
          entry_type: 'in',
          amount_mmk: payment.amount_mmk,
          record_date: toIsoDate(payment.payment_date) || getTodayIso(),
          title: student?.name || payment.student_id,
          subtitle: academic
            ? `${academic.className} / ${academic.courseName}`
            : 'Student payment collection',
          note: payment.note,
          created_at: payment.created_at,
        };
      });

    const outgoingEntries: CashLedgerEntry[] = cashOutRecords.map(record => ({
      id: `cash-out-${record.id}`,
      entry_type: 'out',
      amount_mmk: record.amount_mmk,
      record_date: toIsoDate(record.record_date) || getTodayIso(),
      title: record.category,
      subtitle: 'Manual money out record',
      note: record.note,
      created_at: record.created_at,
    }));

    const query = cashSearchQuery.trim().toLowerCase();

    return [...incomingEntries, ...outgoingEntries]
      .filter(entry => {
        if (!query) return true;
        return [
          entry.title,
          entry.subtitle,
          entry.note || '',
          entry.record_date,
        ].some(value => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const dateCompare = b.record_date.localeCompare(a.record_date);
        if (dateCompare !== 0) return dateCompare;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [payments, cashOutRecords, studentMap, studentAcademicMap, cashSearchQuery]);

  const studentFinanceRows = useMemo(() => {
    const map = new Map<string, {
      student: AppStudent;
      totalPaid: number;
      rawPending: number;
      rawOverdue: number;
      status: 'pending' | 'overdue' | 'clear';
    }>();

    students.forEach(student => {
      map.set(student.id, {
        student,
        totalPaid: 0,
        rawPending: 0,
        rawOverdue: 0,
        status: 'clear',
      });
    });

    payments.forEach(payment => {
      const student = studentMap.get(payment.student_id) || { id: payment.student_id, name: payment.student_id, email: '' };
      const current = map.get(payment.student_id) || {
        student,
        totalPaid: 0,
        rawPending: 0,
        rawOverdue: 0,
        status: 'clear' as const,
      };

      if (payment.status === 'paid') {
        current.totalPaid += payment.amount_mmk;
      } else if (payment.status === 'pending') {
        if (isLate(payment)) {
          current.rawOverdue += payment.amount_mmk;
        } else {
          current.rawPending += payment.amount_mmk;
        }
      } else {
        current.rawOverdue += payment.amount_mmk;
      }

      map.set(payment.student_id, current);
    });

    const rows = Array.from(map.values()).map(item => {
      // Apply paid amounts to overdue dues only. Keep active assigned dues visible in pending.
      const totalOverdue = Math.max(item.rawOverdue - item.totalPaid, 0);
      const totalPending = item.rawPending;

      const statusValue: 'pending' | 'overdue' | 'clear' = totalPending > 0
        ? 'pending'
        : totalOverdue > 0
          ? 'overdue'
          : 'clear';

      return {
        student: item.student,
        totalPaid: item.totalPaid,
        totalPending,
        totalOverdue,
        status: statusValue,
      };
    });

    return rows.sort((a, b) => {
      const order = { pending: 0, overdue: 1, clear: 2 } as const;
      return order[a.status] - order[b.status];
    });
  }, [payments, studentMap, students]);

  const filteredStudentFinanceRows = useMemo(
    () => studentFinanceRows.filter(row => matchesStudentSearch(row.student.id)),
    [studentFinanceRows, studentSearchQuery, studentMap]
  );

  const pendingStudentFinanceRows = useMemo(
    () => filteredStudentFinanceRows.filter(row => (row.totalPending + row.totalOverdue) > 0),
    [filteredStudentFinanceRows]
  );

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => (
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    ));
  };

  const toggleSelectAllFilteredStudents = () => {
    if (areAllFilteredStudentsSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !filteredStudentsForAssign.some(student => student.id === id)));
      return;
    }

    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      filteredStudentsForAssign.forEach(student => next.add(student.id));
      return Array.from(next);
    });
  };

  const assignPaymentsToSelectedStudents = async () => {
    setError(null);
    setStatus(null);

    if (selectedStudentIds.length === 0) {
      setError('Select at least one student.');
      return;
    }

    const amount = Number(assignAmountMmk);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid amount in MMK.');
      return;
    }

    if (!assignDueDate) {
      setError('Please set a deadline date.');
      return;
    }

    setIsSaving(true);
    try {
      const { schoolId } = await getCurrentTenantContext();
      const rows = withSchoolIdRows(selectedStudentIds.map(studentId => ({
        student_id: studentId,
        amount_mmk: Math.round(amount),
        payment_date: getTodayIso(),
        due_date: assignDueDate,
        status: 'pending' as PaymentStatus,
        note: assignNote.trim() || null,
      })), schoolId);

      const insertResult = await supabase.from('student_payments').insert(rows);
      if (insertResult.error) throw insertResult.error;

      setStatus(`Assigned pending dues to ${selectedStudentIds.length} student(s).`);
      setSelectedStudentIds([]);
      setAssignAmountMmk('');
      setAssignNote('');
      setAssignDueDate(getTodayIso());
      await loadData();
    } catch (assignError: any) {
      setError(assignError?.message || 'Failed to assign payments.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!formData.student_id) {
      setError('Please select a student.');
      return;
    }

    const amount = Number(formData.amount_mmk);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid amount in MMK.');
      return;
    }

    setIsSaving(true);
    try {
      const { schoolId } = await getCurrentTenantContext();
      const payload = withSchoolId({
        student_id: formData.student_id,
        amount_mmk: Math.round(amount),
        payment_date: formData.payment_date || getTodayIso(),
        due_date: null,
        status: formData.status,
        note: formData.note.trim() || null,
      }, schoolId);

      const insertResult = await supabase.from('student_payments').insert([{ ...payload, school_id: schoolId }]);
      if (insertResult.error) throw insertResult.error;

      setStatus('Payment saved.');
      setFormData({
        student_id: '',
        amount_mmk: '',
        payment_date: getTodayIso(),
        status: 'paid',
        note: '',
      });

      await loadData();
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitCashOutRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!isCashRecordsSchemaReady) {
      setError('Cash Records setup is missing. Run the cash records SQL setup before saving money out.');
      return;
    }

    const amount = Number(cashOutFormData.amount_mmk);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid money out amount in MMK.');
      return;
    }

    if (!cashOutFormData.category.trim()) {
      setError('Please add a category or reason for this money out record.');
      return;
    }

    setIsSaving(true);
    try {
      const tenantContext = await getCurrentTenantContext();
      const payload = withSchoolId({
        amount_mmk: Math.round(amount),
        record_date: cashOutFormData.record_date || getTodayIso(),
        category: cashOutFormData.category.trim(),
        note: cashOutFormData.note.trim() || null,
        created_by: tenantContext.userId,
      }, tenantContext.schoolId);

      const insertResult = await supabase.from('cash_records').insert([payload]);
      if (insertResult.error) {
        if (isCashRecordsSchemaMissing(insertResult.error.message)) {
          setIsCashRecordsSchemaReady(false);
          throw new Error('Cash Records setup is missing. Run the cash records SQL setup before saving money out.');
        }
        throw insertResult.error;
      }

      setStatus('Money out record saved.');
      setCashOutFormData({
        amount_mmk: '',
        record_date: getTodayIso(),
        category: '',
        note: '',
      });
      await loadData();
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save money out record.');
    } finally {
      setIsSaving(false);
    }
  };

  const collectOutstandingPaymentsForStudent = async (studentId: string) => {
    setError(null);
    setStatus(null);

    const student = studentMap.get(studentId);
    if (!studentId) {
      setError('Student is missing.');
      return;
    }

    setCollectingStudentId(studentId);
    try {
      const tenantContext = await getCurrentTenantContext();
      const resolvedSchoolId = schoolId || tenantContext.schoolId;

      if (!resolvedSchoolId) {
        throw new Error('School context is missing.');
      }

      const updateResult = await supabase
        .from('student_payments')
        .update({
          status: 'paid' as PaymentStatus,
          payment_date: getTodayIso(),
        })
        .eq('school_id', resolvedSchoolId)
        .eq('student_id', studentId)
        .in('status', ['pending', 'overdue'])
        .select('id');

      if (updateResult.error) throw updateResult.error;

      const updatedCount = (updateResult.data || []).length;
      if (updatedCount === 0) {
        setError('No pending payments found for this student.');
        return;
      }

      setStatus(`Collected ${updatedCount} payment record(s) for ${student?.name || studentId}.`);
      await loadData();
    } catch (collectError: any) {
      setError(collectError?.message || 'Failed to collect payment.');
    } finally {
      setCollectingStudentId(null);
    }
  };

  const downloadPaymentStatementPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let y = 44;
    const lineHeight = 16;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Payment Statement', marginX, y);

    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y);

    y += 20;
    doc.setFontSize(10);
    doc.text(`Paid Records: ${filteredPaidPayments.length}`, marginX, y);

    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Student | Class/Course | Collected Date | Amount', marginX, y);

    y += 12;
    doc.setDrawColor(220);
    doc.line(marginX, y, 555, y);
    y += 12;

    doc.setFont('helvetica', 'normal');

    filteredPaidPayments.forEach((payment) => {
      const studentName = studentMap.get(payment.student_id)?.name || payment.student_id;
      const academic = getStudentAcademic(payment.student_id);
      const collected = toIsoDate(payment.payment_date) || '-';
      const amount = formatMMK(payment.amount_mmk);
      const rowText = `${studentName} | ${academic.className} / ${academic.courseName} | ${collected} | ${amount}`;
      const wrapped = doc.splitTextToSize(rowText, 515);

      if (y + (wrapped.length * lineHeight) > pageHeight - 36) {
        doc.addPage();
        y = 44;
      }

      doc.text(wrapped, marginX, y);
      y += wrapped.length * lineHeight + 6;
    });

    if (filteredPaidPayments.length === 0) {
      doc.text('No paid records found for current filters.', marginX, y);
    }

    doc.save(`payment-statement-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const downloadPaymentInvoicePdf = (payment: StudentPayment) => {
    const student = studentMap.get(payment.student_id);
    const academic = getStudentAcademic(payment.student_id);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const invoiceNo = `INV-${String(payment.id).slice(0, 8).toUpperCase()}`;
    const collectedDate = toIsoDate(payment.payment_date) || '-';
    const dueDate = toIsoDate(payment.due_date) || '-';
    const description = payment.note?.trim() || `Student fee payment for ${academic.className} / ${academic.courseName}`;
    const amountInWords = amountToWords(payment.amount_mmk);
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 42;
    const right = pageWidth - 42;
    const amountColumnX = 415;
    const amountColumnRight = right;
    const amountColumnMid = 510;
    const tableTop = 126;
    const rowHeight = 25;
    const rowCount = 6;
    const tableBottom = tableTop + (rowHeight * (rowCount + 1));

    const drawCheckbox = (x: number, y: number, label: string, checked: boolean) => {
      doc.rect(x, y - 8, 10, 10);
      if (checked) {
        doc.setFont('helvetica', 'bold');
        doc.text('X', x + 2, y);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(label, x + 16, y);
    };

    doc.setTextColor(20, 20, 20);
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('STUDENT PAYMENT VOUCHER', pageWidth / 2, 34, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Student Invoice Copy', pageWidth / 2, 48, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    drawCheckbox(90, 78, 'Payment Voucher', true);
    drawCheckbox(250, 78, 'Cash Voucher', false);
    drawCheckbox(90, 98, 'Petty Cash Voucher', false);
    drawCheckbox(250, 98, 'Cheque Voucher', false);

    doc.text('Voucher No:', 418, 78);
    doc.line(482, 82, right, 82);
    doc.text(invoiceNo, 486, 78);
    doc.text('Date:', 418, 98);
    doc.line(452, 102, right, 102);
    doc.text(collectedDate, 456, 98);

    doc.setFont('helvetica', 'bold');
    doc.text('PAY TO', 110, 126);
    doc.line(155, 129, right, 129);
    doc.setFont('helvetica', 'normal');
    doc.text(student?.name || payment.student_id, 160, 126);

    doc.line(left, tableTop, right, tableTop);
    doc.line(left, tableTop + rowHeight, right, tableTop + rowHeight);
    doc.line(amountColumnX, tableTop, amountColumnX, tableBottom);
    doc.line(amountColumnMid, tableTop, amountColumnMid, tableBottom);
    doc.line(right, tableTop, right, tableBottom);
    doc.line(left, tableBottom, right, tableBottom);

    for (let index = 1; index <= rowCount; index += 1) {
      const y = tableTop + (rowHeight * index);
      doc.line(left, y, right, y);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', 250, tableTop + 17, { align: 'center' });
    doc.text('AMOUNT', 462, tableTop + 17, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);

    const rows = [
      { label: description, amount: formatMMK(payment.amount_mmk) },
      { label: `Student ID: ${payment.student_id}`, amount: '' },
      { label: `Class: ${academic.className}`, amount: '' },
      { label: `Course: ${academic.courseName}`, amount: '' },
      { label: `Status: ${String(payment.status).toUpperCase()}`, amount: '' },
      { label: `Due Date: ${dueDate}`, amount: '' },
    ];

    rows.forEach((row, index) => {
      const y = tableTop + rowHeight + 17 + (index * rowHeight);
      const wrapped = doc.splitTextToSize(row.label, 300);
      doc.text(wrapped[0] || '', 52, y);
      if (row.amount) {
        doc.text(row.amount, amountColumnRight - 10, y, { align: 'right' });
      }
    });

    const accountRowTop = tableBottom + 16;
    const accountRowBottom = accountRowTop + 24;

    doc.line(left, accountRowTop, right, accountRowTop);
    doc.line(left, accountRowBottom, right, accountRowBottom);
    doc.line(290, accountRowTop, 290, accountRowBottom);
    doc.line(430, accountRowTop, 430, accountRowBottom);
    doc.line(510, accountRowTop, 510, accountRowBottom);
    doc.line(right, accountRowTop, right, accountRowBottom);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('A/c', 52, accountRowTop + 15);
    doc.text('Cash/Cheque', 300, accountRowTop + 15);
    doc.text('MMK', 440, accountRowTop + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(formatMMK(payment.amount_mmk), amountColumnRight - 10, accountRowTop + 15, { align: 'right' });

    const sumLabelY = accountRowBottom + 26;
    doc.setFont('helvetica', 'bold');
    doc.text('The Sum of Kyats', 52, sumLabelY);
    doc.setFont('helvetica', 'normal');
    doc.line(148, sumLabelY + 2, right, sumLabelY + 2);
    const amountWordsLines = doc.splitTextToSize(amountInWords, right - 156);
    doc.text(amountWordsLines, 154, sumLabelY - 3);

    const metaY = sumLabelY + 34;
    doc.text(`Collected Date: ${collectedDate}`, 52, metaY);
    doc.text(`Email: ${student?.email || '-'}`, 260, metaY);

    const footerY = 770;
    doc.text('Payment Approved by:', 52, footerY);
    doc.line(148, footerY + 2, 280, footerY + 2);
    doc.text('Received by:', 392, footerY);
    doc.line(456, footerY + 2, right, footerY + 2);

    doc.save(`${invoiceNo}-${collectedDate}.pdf`);
  };

  const pageMeta = {
    payment: {
      title: 'Payment Collection Desk',
      subtitle: 'Record payments collected from students in MMK.',
    },
    'payment-assign': {
      title: 'Assign Student Dues',
      subtitle: 'Assign pending amount students must pay by deadline.',
    },
    'payment-history': {
      title: 'Payment History',
      subtitle: 'Track all recorded student payments.',
    },
    'student-finance-status': {
      title: 'Student Finance Status',
      subtitle: 'Pending and overdue visibility by student.',
    },
    'cash-records': {
      title: 'Cash Records',
      subtitle: 'See money in from student payments and log manual money out.',
    },
  } as const;

  return {
    students,
    setStudents,
    payments,
    setPayments,
    cashOutRecords,
    setCashOutRecords,
    studentCourseLinks,
    setStudentCourseLinks,
    courseRows,
    setCourseRows,
    classesMap,
    setClassesMap,
    coursesMap,
    setCoursesMap,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    isCashRecordsSchemaReady,
    setIsCashRecordsSchemaReady,
    collectingStudentId,
    setCollectingStudentId,
    error,
    setError,
    status,
    setStatus,
    studentSearchQuery,
    setStudentSearchQuery,
    cashSearchQuery,
    setCashSearchQuery,
    selectedStudentIds,
    setSelectedStudentIds,
    assignAmountMmk,
    setAssignAmountMmk,
    assignDueDate,
    setAssignDueDate,
    assignNote,
    setAssignNote,
    assignClassFilter,
    setAssignClassFilter,
    assignCourseFilter,
    setAssignCourseFilter,
    financeStatusTab,
    setFinanceStatusTab,
    formData,
    setFormData,
    cashOutFormData,
    setCashOutFormData,
    studentMap,
    studentAcademicMap,
    studentAcademicIdMap,
    getStudentAcademic,
    getStudentAcademicIds,
    matchesStudentSearch,
    filteredStudents,
    assignClassOptions,
    assignCourseOptions,
    filteredStudentsForAssign,
    areAllFilteredStudentsSelected,
    loadData,
    isLate,
    filteredPayments,
    filteredPaidPayments,
    totalCashIn,
    totalCashOut,
    cashBalance,
    cashLedgerEntries,
    studentFinanceRows,
    filteredStudentFinanceRows,
    pendingStudentFinanceRows,
    toggleStudentSelection,
    toggleSelectAllFilteredStudents,
    assignPaymentsToSelectedStudents,
    submitPayment,
    submitCashOutRecord,
    collectOutstandingPaymentsForStudent,
    downloadPaymentStatementPdf,
    downloadPaymentInvoicePdf,
    pageMeta
  };
}
