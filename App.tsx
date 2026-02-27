import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, AreaChart, Area, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { Status, Student, PageId, StudentPermissions } from './types';
import { supabase } from './supabaseClient';
import { authService } from './services/authService';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudentDirectory from './components/StudentDirectory';
import RegistrationHub from './components/RegistrationHub';
import AttendanceProtocol from './components/AttendanceProtocol';
import EnrollmentModal from './components/Modals/EnrollmentModal';
import EditModal from './components/Modals/EditModal';
import PermissionsModal from './components/Modals/PermissionsModal';

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" fill="%23f8fafc"/><circle cx="12" cy="9" r="4" fill="%23e2e8f0"/><path d="M12 14c-4.4 0-8 2-8 6v1h16v-1c0-4-3.6-6-8-6z" fill="%23cbd5e1"/></svg>`;

const INITIAL_PERMISSIONS: StudentPermissions = {
  neuralSync: true,
  libraryAccess: true,
  examEntry: true,
  apiAccess: false
};

const INITIAL_STUDENTS: Student[] = [];

const INITIAL_SUBJECTS: any[] = [];

const INITIAL_TEACHERS: any[] = [];

const INITIAL_LIBRARY: any[] = [];

const INITIAL_EXAMS: any[] = [];

const INITIAL_HOMEWORK: any[] = [];

const INITIAL_PROGRAMS: any[] = [];

type AttendanceContextType = 'class' | 'subject';

const normalizeClassCodeBase = (name: string) => {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sanitized || 'class';
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);

  // Stateful Data
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [attendanceStudents, setAttendanceStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [subjects, setSubjects] = useState(INITIAL_SUBJECTS);
  const [teachers, setTeachers] = useState(INITIAL_TEACHERS);
  const [libraryItems, setLibraryItems] = useState(INITIAL_LIBRARY);
  const [exams, setExams] = useState(INITIAL_EXAMS);
  const [homeworks, setHomeworks] = useState(INITIAL_HOMEWORK);
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
  const [policies, setPolicies] = useState({
    mfaRequired: true,
    ipWhitelist: false,
    sessionTimeout: true,
    bruteForceProtection: true,
    dataEncryption: true
  });
  
  // Filters
  const [selectedDate, setSelectedDate] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [className, setClassName] = useState('');
  const [classImage, setClassImage] = useState<File | null>(null);
  const [classOuterColor, setClassOuterColor] = useState('#f8fafc');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [isClassCodeSupported, setIsClassCodeSupported] = useState(true);

  // Attendance State (Subject-specific)
  const [selectedAttendanceSubject, setSelectedAttendanceSubject] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  // Mapping: subjectId -> date -> studentId -> status
  const [subjectAttendanceStore, setSubjectAttendanceStore] = useState<Record<string, Record<string, Record<string, 'P' | 'A' | 'L'>>>>({});
  const [isAttendanceContextNameSupported, setIsAttendanceContextNameSupported] = useState(true);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollData, setEnrollData] = useState({
    name: '',
    email: '',
    type: 'New' as 'New' | 'Old',
    selectedStudentId: '',
    grade: '10th Grade',
    dateOfBirth: '',
    parentName: '',
    parentNumber: '',
    parentEmail: '',
    secondaryParentName: '',
    secondaryParentNumber: '',
    secondaryParentEmail: '',
  });
  const [studentProfileImage, setStudentProfileImage] = useState<File | null>(null);
  const enrollAbortCounterRef = useRef(0);
  const [editTarget, setEditTarget] = useState<{ type: string, data: any } | null>(null);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<Student | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void | Promise<void> } | null>(null);
  const [studentDeleteDialog, setStudentDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [studentDeleteNameInput, setStudentDeleteNameInput] = useState('');
  const [adminDeletePassword, setAdminDeletePassword] = useState('');
  const [studentDeleteError, setStudentDeleteError] = useState<string | null>(null);
  const [isStudentDeleteSubmitting, setIsStudentDeleteSubmitting] = useState(false);
  const [studentEditAuthDialog, setStudentEditAuthDialog] = useState<Student | null>(null);
  const [studentEditAuthPassword, setStudentEditAuthPassword] = useState('');
  const [studentEditAuthError, setStudentEditAuthError] = useState<string | null>(null);
  const [isStudentEditAuthSubmitting, setIsStudentEditAuthSubmitting] = useState(false);
  const [classDeleteDialog, setClassDeleteDialog] = useState<{ id: string; name: string; onDeleted?: () => void } | null>(null);
  const [classDeleteNameInput, setClassDeleteNameInput] = useState('');
  const [classAdminDeletePassword, setClassAdminDeletePassword] = useState('');
  const [classDeleteError, setClassDeleteError] = useState<string | null>(null);
  const [isClassDeleteSubmitting, setIsClassDeleteSubmitting] = useState(false);
  const [newStudentCredentials, setNewStudentCredentials] = useState<{ name: string; email: string; password: string } | null>(null);

  const stats = useMemo(() => {
    const total = students.length;
    const avgAttendance = students.reduce((acc, s) => acc + s.attendanceRate, 0) / (total || 1);
    const atRisk = students.filter(s => s.attendanceRate < 90).length;
    return { total, avgAttendance: avgAttendance.toFixed(1), atRisk, activeSubjects: subjects.length };
  }, [students, subjects]);

  const notify = useCallback((message: string) => {
    setNotification({ message, type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const mapStudentFromDB = (student: any): Student => ({
    ...(student as Student),
  });

  const fetchStudentsByDate = async (date: string) => {
    if (!date) return;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      setStudents(data.map(mapStudentFromDB));
    }
  };

  const fetchAllStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*');

    if (!error && data) {
      setAllStudents(data);
    }
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, class_students(student_id)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mappedClasses = data.map((classItem: any) => ({
        ...classItem,
        class_code: classItem.class_code || null,
        outer_color: classItem.color || classItem.outer_color || '#f8fafc',
        student_ids: (classItem.class_students || []).map((relation: any) => String(relation.student_id)),
        student_count: (classItem.class_students || []).length,
      }));
      setClasses(mappedClasses);
    }
  };

  const buildNextClassCode = useCallback((name: string, excludeClassId?: string) => {
    const base = normalizeClassCodeBase(name);
    const prefixRegex = new RegExp(`^${base}(\\d+)$`);

    const nextNumber = classes
      .filter(classItem => (excludeClassId ? String(classItem.id) !== excludeClassId : true))
      .reduce((max, classItem) => {
        const existingCode = String(classItem.class_code || '');
        const matched = existingCode.match(prefixRegex);
        if (!matched) return max;
        const parsed = Number(matched[1]);
        if (!Number.isFinite(parsed)) return max;
        return Math.max(max, parsed);
      }, 0) + 1;

    return `${base}${nextNumber}`;
  }, [classes]);

  const uploadClassImage = async (file: File) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `class-${Date.now()}-${sanitizedName}`;

    const { error } = await supabase.storage
      .from('class_image')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage
      .from('class_image')
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error('Failed to retrieve uploaded image URL.');
    }

    return data.publicUrl;
  };

  const uploadStudentProfileImage = async (file: File) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `profiles/student-${Date.now()}-${sanitizedName}`;

    const { error } = await supabase.storage
      .from('student_profile')
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('student_profile')
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error('Failed to retrieve uploaded student profile URL.');
    }

    return data.publicUrl;
  };

  const createClassWithStudents = async () => {
    try {
      if (!className.trim()) {
        notify('Please enter a class name.');
        return;
      }

      let imageUrl = '';

      if (classImage) {
        imageUrl = await uploadClassImage(classImage);
      }

      const nextClassCode = buildNextClassCode(className);

      const insertPayload = isClassCodeSupported
        ? { name: className, image_url: imageUrl, color: classOuterColor, class_code: nextClassCode }
        : { name: className, image_url: imageUrl, color: classOuterColor };

      let classData: any = null;
      let classError: any = null;

      {
        const result = await supabase
          .from('classes')
          .insert([insertPayload])
          .select()
          .single();
        classData = result.data;
        classError = result.error;
      }

      if (classError && /class_code/i.test(classError.message || '')) {
        setIsClassCodeSupported(false);
        const fallbackResult = await supabase
          .from('classes')
          .insert([{ name: className, image_url: imageUrl, color: classOuterColor }])
          .select()
          .single();
        classData = fallbackResult.data;
        classError = fallbackResult.error;
      }

      if (classError) throw classError;

      const payload = selectedStudents.map(studentId => ({
        class_id: classData.id,
        student_id: studentId
      }));

      if (payload.length > 0) {
        const { error: relationError } = await supabase
          .from('class_students')
          .insert(payload);

        if (relationError) throw relationError;
      }

      setClasses(prev => [{ ...classData, class_code: classData.class_code || (isClassCodeSupported ? nextClassCode : null), color: classOuterColor, outer_color: classOuterColor, student_ids: selectedStudents, student_count: payload.length }, ...prev]);
      notify('Class created successfully!');
      setClassName('');
      setSelectedStudents([]);
      setClassImage(null);
      setClassOuterColor('#f8fafc');
    } catch (err: any) {
      console.error(err);
      notify(`Error creating class: ${err?.message || 'Please try again.'}`);
    }
  };

  const startEditClass = (classItem: any) => {
    setEditingClassId(String(classItem.id));
    setClassName(classItem.name || '');
    setClassOuterColor(classItem.color || classItem.outer_color || '#f8fafc');
    setSelectedStudents((classItem.student_ids || []).map((id: any) => String(id)));
    setClassImage(null);
  };

  const cancelEditClass = () => {
    setEditingClassId(null);
    setClassName('');
    setSelectedStudents([]);
    setClassImage(null);
    setClassOuterColor('#f8fafc');
  };

  const saveClassEdits = async () => {
    if (!editingClassId) return;
    if (!className.trim()) {
      notify('Please enter a class name.');
      return;
    }

    try {
      const targetClass = classes.find(classItem => String(classItem.id) === editingClassId);
      let imageUrl = targetClass?.image_url || '';
      const currentStudentIds = (targetClass?.student_ids || []).map((id: any) => String(id));
      const nextStudentIds = selectedStudents.map(id => String(id));

      const studentsToAdd = nextStudentIds.filter(id => !currentStudentIds.includes(id));
      const studentsToRemove = currentStudentIds.filter(id => !nextStudentIds.includes(id));
      const classCode = buildNextClassCode(className, editingClassId);

      if (classImage) {
        imageUrl = await uploadClassImage(classImage);
      }

      const updatePayload = isClassCodeSupported
        ? { name: className, image_url: imageUrl, color: classOuterColor, class_code: classCode }
        : { name: className, image_url: imageUrl, color: classOuterColor };

      let error: any = null;

      {
        const result = await supabase
          .from('classes')
          .update(updatePayload)
          .eq('id', editingClassId);
        error = result.error;
      }

      if (error && /class_code/i.test(error.message || '')) {
        setIsClassCodeSupported(false);
        const fallbackResult = await supabase
          .from('classes')
          .update({ name: className, image_url: imageUrl, color: classOuterColor })
          .eq('id', editingClassId);
        error = fallbackResult.error;
      }

      if (error) throw error;

      if (studentsToRemove.length > 0) {
        const { error: removeRelationsError } = await supabase
          .from('class_students')
          .delete()
          .eq('class_id', editingClassId)
          .in('student_id', studentsToRemove);

        if (removeRelationsError) throw removeRelationsError;
      }

      if (studentsToAdd.length > 0) {
        const addPayload = studentsToAdd.map(studentId => ({
          class_id: editingClassId,
          student_id: studentId,
        }));

        const { error: addRelationsError } = await supabase
          .from('class_students')
          .insert(addPayload);

        if (addRelationsError) throw addRelationsError;
      }

      setClasses(prev => prev.map(classItem => {
        if (String(classItem.id) !== editingClassId) return classItem;
        return {
          ...classItem,
          name: className,
          class_code: isClassCodeSupported ? classCode : (classItem.class_code || null),
          image_url: imageUrl,
          color: classOuterColor,
          outer_color: classOuterColor,
          student_ids: nextStudentIds,
          student_count: nextStudentIds.length,
        };
      }));

      notify('Class updated successfully.');
      cancelEditClass();
    } catch (error: any) {
      console.error('Edit class error:', error);
      notify(`Failed to update class: ${error?.message || 'Unknown error'}`);
    }
  };

  const exportMonthlyAttendancePdf = useCallback(async (
    contextType: AttendanceContextType,
    contextId: string,
    month: string,
    studentList: Array<{ id: string; name: string }>,
    contextLabel?: string
  ) => {
    if (!month) {
      notify('Please choose a month to export.');
      return;
    }

    if (!contextId) {
      notify('Please choose a class or subject first.');
      return;
    }

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthNumber = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      notify('Invalid month selected.');
      return;
    }

    const monthStart = `${month}-01`;
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, status, attendance_date')
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .gte('attendance_date', monthStart)
      .lte('attendance_date', monthEnd)
      .order('attendance_date', { ascending: true });

    if (error) {
      console.error('Attendance export query failed:', error);
      notify(`Failed to export attendance: ${error.message}`);
      return;
    }

    const countsByStudent: Record<string, { present: number; absent: number; late: number; total: number }> = {};
    (data || []).forEach((row: any) => {
      const studentId = String(row.student_id);
      if (!countsByStudent[studentId]) {
        countsByStudent[studentId] = { present: 0, absent: 0, late: 0, total: 0 };
      }
      if (row.status === 'P') countsByStudent[studentId].present += 1;
      if (row.status === 'A') countsByStudent[studentId].absent += 1;
      if (row.status === 'L') countsByStudent[studentId].late += 1;
      countsByStudent[studentId].total += 1;
    });

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const monthLabel = new Date(year, monthNumber - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const headerTitle = `Attendance Report - ${monthLabel}`;
    const subTitle = `${contextType.toUpperCase()}: ${contextLabel || contextId}`;

    doc.setFontSize(18);
    doc.text(headerTitle, 40, 40);
    doc.setFontSize(11);
    doc.text(subTitle, 40, 60);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 78);

    let y = 110;
    const lineHeight = 20;
    const columns = [
      { label: 'Student Name', x: 40 },
      { label: 'Student ID', x: 260 },
      { label: 'Present', x: 430 },
      { label: 'Absent', x: 510 },
      { label: 'Late', x: 580 },
      { label: 'Marked Days', x: 650 },
      { label: 'Rate %', x: 760 },
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    columns.forEach(col => doc.text(col.label, col.x, y));
    y += 10;
    doc.line(40, y, 820, y);
    y += 16;
    doc.setFont('helvetica', 'normal');

    const rows = studentList.map(student => {
      const stats = countsByStudent[String(student.id)] || { present: 0, absent: 0, late: 0, total: 0 };
      const rate = stats.total === 0 ? 0 : Math.round((stats.present / stats.total) * 100);
      return {
        name: student.name,
        id: String(student.id),
        ...stats,
        rate,
      };
    });

    rows.forEach(row => {
      if (y > 560) {
        doc.addPage();
        y = 50;
        doc.setFont('helvetica', 'bold');
        columns.forEach(col => doc.text(col.label, col.x, y));
        y += 10;
        doc.line(40, y, 820, y);
        y += 16;
        doc.setFont('helvetica', 'normal');
      }

      doc.text(row.name.slice(0, 32), 40, y);
      doc.text(row.id.slice(0, 18), 260, y);
      doc.text(String(row.present), 430, y);
      doc.text(String(row.absent), 510, y);
      doc.text(String(row.late), 580, y);
      doc.text(String(row.total), 650, y);
      doc.text(String(row.rate), 760, y);
      y += lineHeight;
    });

    const safeContext = (contextLabel || contextId).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    doc.save(`attendance-${safeContext}-${month}.pdf`);
    notify(`Attendance PDF exported for ${monthLabel}.`);
  }, [notify]);

  const deleteClass = (classId: string, onDeleted?: () => void) => {
    const targetClass = classes.find(classItem => String(classItem.id) === classId);
    if (!targetClass) {
      notify('Class not found.');
      return;
    }

    setClassDeleteDialog({
      id: classId,
      name: targetClass.name || 'Unnamed Class',
      onDeleted
    });
    setClassDeleteNameInput('');
    setClassAdminDeletePassword('');
    setClassDeleteError(null);
  };

  const removeStudentFromClass = async (classId: string, studentId: string) => {
    setConfirmDialog({
      message: 'are you sure to remove this student?',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('class_students')
            .delete()
            .eq('class_id', classId)
            .eq('student_id', studentId);

          if (error) throw error;

          setClasses(prev => prev.map(classItem => {
            if (String(classItem.id) !== classId) return classItem;

            const nextStudentIds = (classItem.student_ids || []).filter((id: string) => String(id) !== studentId);
            return {
              ...classItem,
              student_ids: nextStudentIds,
              student_count: nextStudentIds.length,
            };
          }));

          notify('Student removed from class.');
        } catch (error) {
          console.error('Remove student from class error:', error);
          notify('Failed to remove student from class.');
        }
      }
    });
  };

  const fetchAttendanceStudentsByDate = async (date: string) => {
    if (!date) return;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAttendanceStudents(data.map(mapStudentFromDB));
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchStudentsByDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setStudents(data.map(mapStudentFromDB));
      }
    };
    fetchStudents();
    fetchAllStudents();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (currentPage === 'student-attendance' && attendanceDate) {
      fetchAttendanceStudentsByDate(attendanceDate);
    }
  }, [attendanceDate, currentPage]);

  useEffect(() => {
    if (currentPage !== 'student-attendance') {
      setAttendanceStudents(students);
    }
  }, [students, currentPage]);

  const generateStudentPassword = () => {
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const specials = '@#$%&*!';
    const allChars = `${lower}${upper}${digits}${specials}`;

    const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

    const passwordChars = [pick(lower), pick(upper), pick(digits), pick(specials)];
    for (let i = passwordChars.length; i < 12; i += 1) {
      passwordChars.push(pick(allChars));
    }

    for (let i = passwordChars.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }

    return passwordChars.join('');
  };

  const generateStudentNodeId = () => {
    const randomSeed = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;

    return `NODE-${randomSeed.slice(0, 10).toUpperCase()}`;
  };

  const openEditModal = (type: string, data: any) => {
    if (type === 'student') {
      setEditTarget({
        type,
        data: {
          ...data,
          date_of_birth: data?.date_of_birth ?? '',
          parent_name: data?.parent_name ?? '',
          parent_number: data?.parent_number ?? '',
          parent_email: data?.parent_email ?? '',
          secondary_parent_name: data?.secondary_parent_name ?? '',
          secondary_parent_number: data?.secondary_parent_number ?? '',
          secondary_parent_email: data?.secondary_parent_email ?? '',
        },
      });
      setIsEditModalOpen(true);
      return;
    }

    setEditTarget({ type, data: { ...data } });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    const { type, data } = editTarget;
    
    // Sync with Supabase if it's a student
    if (type === 'student') {
      const existingStudent = students.find(student => student.id === data.id);
      const studentPayload = {
        ...data,
        status: data.status ?? existingStudent?.status ?? Status.PENDING,
        attendanceRate: data.attendanceRate ?? existingStudent?.attendanceRate ?? 100,
      };

      const { error } = await supabase.from('students').upsert(studentPayload);
      if (error) {
        console.error('Supabase Update Error:', error);
        notify(`Student sync failed: ${error.message}`);
        return;
      }

      if (studentPayload !== data) {
        setEditTarget({ ...editTarget, data: studentPayload });
      }
    }

    switch (type) {
      case 'student': setStudents(prev => prev.map(s => s.id === data.id ? data : s)); break;
      case 'teacher': setTeachers(prev => prev.map(t => t.id === data.id ? data : t)); break;
      case 'subject': setSubjects(prev => prev.map(s => s.id === data.id ? data : s)); break;
      case 'library': setLibraryItems(prev => prev.map(i => i.id === data.id ? data : i)); break;
      case 'exam': setExams(prev => prev.map(e => e.id === data.id ? data : e)); break;
      case 'homework': setHomeworks(prev => prev.map(h => h.id === data.id ? data : h)); break;
      case 'program': setPrograms(prev => prev.map(p => p.id === data.id ? data : p)); break;
    }
    notify(`${type.charAt(0).toUpperCase() + type.slice(1)} synchronized.`);
    setIsEditModalOpen(false);
    setEditTarget(null);
  };

  const updateStudentProfilePhoto = async (studentId: string, file: File): Promise<Student> => {
    const profileImageUrl = await uploadStudentProfileImage(file);

    const { error } = await supabase
      .from('students')
      .update({ avatar: profileImageUrl })
      .eq('id', studentId);

    if (error) {
      throw error;
    }

    let updatedStudent: Student | null = null;

    setStudents(prev => prev.map(student => {
      if (String(student.id) !== String(studentId)) return student;
      const next = { ...student, avatar: profileImageUrl };
      updatedStudent = next;
      return next;
    }));

    setAllStudents(prev => prev.map((student: any) => {
      if (String(student.id) !== String(studentId)) return student;
      return { ...student, avatar: profileImageUrl };
    }));

    notify('Profile photo updated successfully.');

    if (updatedStudent) {
      return updatedStudent;
    }

    throw new Error('Student not found after photo update.');
  };

  const deleteEntity = async (id: string, type: string) => {
    if (type === 'student') {
      const targetStudent = students.find(student => student.id === id);
      if (!targetStudent) {
        notify('Student not found.');
        return;
      }
      setStudentDeleteDialog({ id: targetStudent.id, name: targetStudent.name });
      setStudentDeleteNameInput('');
      setAdminDeletePassword('');
      setStudentDeleteError(null);
      return;
    }

    setConfirmDialog({
      message: `Are you sure you want to terminate this ${type} node? This action is irreversible.`,
      onConfirm: async () => {
        switch (type) {
          case 'teacher': setTeachers(prev => prev.filter(t => t.id !== id)); break;
          case 'subject': setSubjects(prev => prev.filter(s => s.id !== id)); break;
          case 'library': setLibraryItems(prev => prev.filter(i => i.id !== id)); break;
          case 'exam': setExams(prev => prev.filter(e => e.id !== id)); break;
          case 'homework': setHomeworks(prev => prev.filter(h => h.id !== id)); break;
          case 'program': setPrograms(prev => prev.filter(p => p.id !== id)); break;
        }
        notify(`${type.charAt(0).toUpperCase() + type.slice(1)} node deleted.`);
      }
    });
  };

  const handleConfirmDialog = async () => {
    if (!confirmDialog) return;
    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    await action();
  };

  const handleSecureStudentDelete = async () => {
    if (!studentDeleteDialog) return;

    const expectedName = studentDeleteDialog.name.trim();
    const typedName = studentDeleteNameInput.trim();
    if (typedName !== expectedName) {
      setStudentDeleteError('Student name does not match.');
      return;
    }

    if (!adminDeletePassword.trim()) {
      setStudentDeleteError('Admin password is required.');
      return;
    }

    setIsStudentDeleteSubmitting(true);
    setStudentDeleteError(null);

    try {
      const { data, error } = await supabase.rpc('verify_admin_delete_password', { input_password: adminDeletePassword });
      if (error) {
        console.error('Password verification error:', error);
        setStudentDeleteError('Failed to verify admin password.');
        return;
      }

      if (!data) {
        setStudentDeleteError('Invalid admin password.');
        return;
      }

      const { error: classRelationDeleteError } = await supabase
        .from('class_students')
        .delete()
        .eq('student_id', studentDeleteDialog.id);

      if (classRelationDeleteError) {
        console.error('Class relation delete error:', classRelationDeleteError);
        setStudentDeleteError('Failed to delete student class relations.');
        return;
      }

      const { error: attendanceDeleteError } = await supabase
        .from('attendance_records')
        .delete()
        .eq('student_id', studentDeleteDialog.id);

      if (attendanceDeleteError) {
        console.error('Attendance delete error:', attendanceDeleteError);
        setStudentDeleteError('Failed to delete student attendance records.');
        return;
      }

      const { error: deleteError } = await supabase.from('students').delete().eq('id', studentDeleteDialog.id);
      if (deleteError) {
        console.error('Supabase Delete Error:', deleteError);
        setStudentDeleteError('Failed to delete student.');
        return;
      }

      setStudents(prev => prev.filter(student => student.id !== studentDeleteDialog.id));
      setAllStudents(prev => prev.filter(student => String(student.id) !== studentDeleteDialog.id));
      setAttendanceStudents(prev => prev.filter(student => student.id !== studentDeleteDialog.id));
      setClasses(prev => prev.map(classItem => {
        const nextStudentIds = (classItem.student_ids || []).filter((id: string) => String(id) !== studentDeleteDialog.id);
        if (nextStudentIds.length === (classItem.student_ids || []).length) {
          return classItem;
        }

        return {
          ...classItem,
          student_ids: nextStudentIds,
          student_count: nextStudentIds.length,
        };
      }));
      notify('Student node deleted.');
      setStudentDeleteDialog(null);
      setStudentDeleteNameInput('');
      setAdminDeletePassword('');
      setStudentDeleteError(null);
    } finally {
      setIsStudentDeleteSubmitting(false);
    }
  };

  const handleSecureClassDelete = async () => {
    if (!classDeleteDialog) return;

    const expectedName = classDeleteDialog.name.trim();
    const typedName = classDeleteNameInput.trim();
    if (typedName !== expectedName) {
      setClassDeleteError('Class name does not match.');
      return;
    }

    if (!classAdminDeletePassword.trim()) {
      setClassDeleteError('Admin password is required.');
      return;
    }

    setIsClassDeleteSubmitting(true);
    setClassDeleteError(null);

    try {
      const { data, error } = await supabase.rpc('verify_admin_delete_password', { input_password: classAdminDeletePassword });
      if (error) {
        console.error('Password verification error:', error);
        setClassDeleteError('Failed to verify admin password.');
        return;
      }

      if (!data) {
        setClassDeleteError('Invalid admin password.');
        return;
      }

      const { error: relationDeleteError } = await supabase
        .from('class_students')
        .delete()
        .eq('class_id', classDeleteDialog.id);
      if (relationDeleteError) {
        console.error('Delete class relations error:', relationDeleteError);
        setClassDeleteError('Failed to delete class students relations.');
        return;
      }

      const { error: classDeleteErrorResult } = await supabase
        .from('classes')
        .delete()
        .eq('id', classDeleteDialog.id);
      if (classDeleteErrorResult) {
        console.error('Delete class error:', classDeleteErrorResult);
        setClassDeleteError('Failed to delete class.');
        return;
      }

      setClasses(prev => prev.filter(classItem => String(classItem.id) !== classDeleteDialog.id));
      classDeleteDialog.onDeleted?.();
      notify('Class deleted successfully.');
      setClassDeleteDialog(null);
      setClassDeleteNameInput('');
      setClassAdminDeletePassword('');
      setClassDeleteError(null);
    } finally {
      setIsClassDeleteSubmitting(false);
    }
  };

  const enrollStudentAction = (type: 'New' | 'Old') => {
    setEnrollData({
      name: '',
      email: '',
      type,
      selectedStudentId: '',
      grade: '10th Grade',
      dateOfBirth: '',
      parentName: '',
      parentNumber: '',
      parentEmail: '',
      secondaryParentName: '',
      secondaryParentNumber: '',
      secondaryParentEmail: '',
    });
    setStudentProfileImage(null);
    setIsEnrollModalOpen(true);
  };

  const abortEnrollFlow = () => {
    enrollAbortCounterRef.current += 1;
    setIsEnrollModalOpen(false);
    setEnrollData({
      name: '',
      email: '',
      type: 'New',
      selectedStudentId: '',
      grade: '10th Grade',
      dateOfBirth: '',
      parentName: '',
      parentNumber: '',
      parentEmail: '',
      secondaryParentName: '',
      secondaryParentNumber: '',
      secondaryParentEmail: '',
    });
    setStudentProfileImage(null);
  };

  const handleEnrollSubmit = async () => {
    const enrollToken = enrollAbortCounterRef.current;
    const isEnrollmentAborted = () => enrollToken !== enrollAbortCounterRef.current;

    try {
      if (enrollData.type === 'Old') {
        if (!enrollData.selectedStudentId) {
          notify('Please select a student for re-entry.');
          return;
        }

        const target = students.find(student => String(student.id) === String(enrollData.selectedStudentId));
        if (!target) {
          notify('Selected student not found.');
          return;
        }

        const updatedStudent: Student = {
          ...target,
          grade: enrollData.grade,
          type: 'Old',
          status: Status.ACTIVE,
        };

        const { error: dbError } = await supabase
          .from('students')
          .update({ grade: updatedStudent.grade, type: 'Old', status: Status.ACTIVE })
          .eq('id', updatedStudent.id);

        if (dbError) throw dbError;

        setStudents(prev => prev.map(student => String(student.id) === String(updatedStudent.id) ? updatedStudent : student));
        setAllStudents(prev => prev.map(student => String(student.id) === String(updatedStudent.id) ? updatedStudent : student));
        notify('Old student re-entry completed.');
        abortEnrollFlow();
        return;
      }

      if (!enrollData.name || !enrollData.email) {
        notify('Please provide both name and email.');
        return;
      }

      if (!enrollData.dateOfBirth || !enrollData.parentName || !enrollData.parentNumber || !enrollData.parentEmail) {
        notify('Please provide DOB and primary parent details.');
        return;
      }

      const generatedPassword = generateStudentPassword();

      let profileImageUrl: string | undefined;
      if (studentProfileImage) {
        try {
          profileImageUrl = await uploadStudentProfileImage(studentProfileImage);
        } catch (uploadError: any) {
          console.error('Student profile upload failed:', uploadError);
          notify(`Profile upload failed: ${uploadError?.message || 'Upload blocked. Student will be created without image.'}`);
          profileImageUrl = undefined;
        }
      }

      if (isEnrollmentAborted()) {
        return;
      }

      let authUserId: string | null = null;
      try {
        const authData = await authService.signUp(enrollData.email, generatedPassword, enrollData.name, 'student');
        authUserId = authData?.user?.id || null;
      } catch (authError: any) {
        console.error('Auth sign-up failed, continuing with student profile only:', authError);
      }

      if (isEnrollmentAborted()) {
        return;
      }

      const newStudent: Student = {
        id: generateStudentNodeId(),
        name: enrollData.name,
        grade: enrollData.grade,
        gender: 'Male',
        status: Status.PENDING,
        email: enrollData.email,
        avatar: profileImageUrl,
        attendanceRate: 100,
        courseAttendance: [],
        securityStatus: { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
        permissions: { ...INITIAL_PERMISSIONS },
        type: 'New'
      };

      const insertPayload = {
        ...newStudent,
        auth_user_id: authUserId,
        temp_password: generatedPassword,
        date_of_birth: enrollData.dateOfBirth,
        parent_name: enrollData.parentName,
        parent_number: enrollData.parentNumber,
        parent_email: enrollData.parentEmail,
        secondary_parent_name: enrollData.secondaryParentName || null,
        secondary_parent_number: enrollData.secondaryParentNumber || null,
        secondary_parent_email: enrollData.secondaryParentEmail || null,
      };

      let createdStudentRecord: any = null;
      let dbError: any = null;

      {
        const result = await supabase.from('students').insert([insertPayload]).select().single();
        createdStudentRecord = result.data;
        dbError = result.error;
      }

      if (dbError && /invalid input syntax|type uuid|type integer|bigint|smallint/i.test(dbError.message || '')) {
        const { id, ...payloadWithoutId } = insertPayload;
        const retryResult = await supabase.from('students').insert([payloadWithoutId]).select().single();
        createdStudentRecord = retryResult.data;
        dbError = retryResult.error;
      }

      if (dbError) throw dbError;

      if (isEnrollmentAborted()) {
        if (createdStudentRecord?.id) {
          await supabase.from('students').delete().eq('id', createdStudentRecord.id);
        }
        return;
      }

      const createdStudent = mapStudentFromDB(createdStudentRecord || newStudent);

      notify(`New Student Node Created & Synced.`);
      setNewStudentCredentials({ name: createdStudent.name, email: createdStudent.email, password: generatedPassword });

      setStudents(prev => [createdStudent, ...prev]);
      setAllStudents(prev => [createdStudent, ...prev]);
      abortEnrollFlow();
      openEditModal('student', createdStudent);
    } catch (error: any) {
      console.error('Enrollment Error:', error);
      notify(`Sync Failed: ${error.message}`);
    }
  };

  const openPermissions = (student: Student) => {
    setPermTarget(student);
    setIsPermissionsModalOpen(true);
  };

  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('verify_admin_delete_password', { input_password: password });
    if (error) {
      console.error('Admin password verification error:', error);
      return false;
    }
    return Boolean(data);
  };

  const requestStudentEditWithPassword = (student: Student) => {
    setStudentEditAuthDialog(student);
    setStudentEditAuthPassword('');
    setStudentEditAuthError(null);
  };

  const handleStudentEditAuthConfirm = async () => {
    if (!studentEditAuthDialog) return;
    if (!studentEditAuthPassword.trim()) {
      setStudentEditAuthError('Admin password is required.');
      return;
    }

    setIsStudentEditAuthSubmitting(true);
    setStudentEditAuthError(null);

    try {
      const { data, error } = await supabase.rpc('verify_admin_delete_password', { input_password: studentEditAuthPassword });
      if (error) {
        setStudentEditAuthError('Failed to verify admin password.');
        return;
      }

      if (!data) {
        setStudentEditAuthError('Invalid admin password.');
        return;
      }

      openEditModal('student', studentEditAuthDialog);
      setStudentEditAuthDialog(null);
      setStudentEditAuthPassword('');
      setStudentEditAuthError(null);
    } finally {
      setIsStudentEditAuthSubmitting(false);
    }
  };

  const togglePermission = (key: keyof StudentPermissions) => {
    if (!permTarget) return;
    const updated = {
      ...permTarget,
      permissions: { ...permTarget.permissions!, [key]: !permTarget.permissions![key] }
    };
    setStudents(prev => prev.map(s => s.id === permTarget.id ? updated : s));
    setPermTarget(updated);
  };

  const getAttendanceStoreKey = useCallback((contextType: AttendanceContextType, contextId: string) => `${contextType}:${contextId}`, []);

  const setAttendanceForDate = useCallback((
    storeKey: string,
    date: string,
    studentStatuses: Record<string, 'P' | 'A' | 'L'>
  ) => {
    setSubjectAttendanceStore(prev => {
      const contextData = prev[storeKey] || {};
      return {
        ...prev,
        [storeKey]: {
          ...contextData,
          [date]: studentStatuses,
        },
      };
    });
  }, []);

  const loadAttendanceForContext = useCallback(async (contextType: AttendanceContextType, contextId: string, date: string) => {
    if (!contextId || !date) return;

    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .eq('attendance_date', date);

    if (error) {
      console.error('Failed to load attendance:', error);
      notify(`Failed to load attendance: ${error.message}`);
      return;
    }

    const nextDateData: Record<string, 'P' | 'A' | 'L'> = {};
    (data || []).forEach((item: any) => {
      nextDateData[String(item.student_id)] = item.status;
    });

    setAttendanceForDate(getAttendanceStoreKey(contextType, contextId), date, nextDateData);
  }, [getAttendanceStoreKey, notify, setAttendanceForDate]);

  const updateSubjectAttendance = useCallback(async (
    contextType: AttendanceContextType,
    contextId: string,
    date: string,
    studentId: string,
    status: 'P' | 'A' | 'L',
    contextName?: string
  ) => {
    const basePayload = {
      context_type: contextType,
      context_id: contextId,
      attendance_date: date,
      student_id: studentId,
      status,
    };

    let error: any = null;

    if (isAttendanceContextNameSupported && contextName) {
      const result = await supabase
        .from('attendance_records')
        .upsert([
          {
            ...basePayload,
            context_name: contextName,
          },
        ], { onConflict: 'context_type,context_id,attendance_date,student_id' });
      error = result.error;

      if (error && /context_name/i.test(error.message || '')) {
        setIsAttendanceContextNameSupported(false);
        const fallbackResult = await supabase
          .from('attendance_records')
          .upsert([basePayload], { onConflict: 'context_type,context_id,attendance_date,student_id' });
        error = fallbackResult.error;
      }
    } else {
      const result = await supabase
        .from('attendance_records')
        .upsert([basePayload], { onConflict: 'context_type,context_id,attendance_date,student_id' });
      error = result.error;
    }

    if (error) {
      console.error('Failed to save attendance:', error);
      notify(`Failed to save attendance: ${error.message}`);
      return;
    }

    const storeKey = getAttendanceStoreKey(contextType, contextId);
    setSubjectAttendanceStore(prev => {
      const contextData = prev[storeKey] || {};
      const dateData = contextData[date] || {};
      return {
        ...prev,
        [storeKey]: {
          ...contextData,
          [date]: {
            ...dateData,
            [studentId]: status,
          },
        },
      };
    });
  }, [getAttendanceStoreKey, notify]);

  const bulkMarkSubjectPresent = useCallback(async (
    contextType: AttendanceContextType,
    contextId: string,
    date: string,
    studentIds: string[],
    contextName?: string
  ) => {
    if (studentIds.length === 0) {
      notify('No students found to mark attendance.');
      return;
    }

    const basePayload = studentIds.map(studentId => ({
      context_type: contextType,
      context_id: contextId,
      attendance_date: date,
      student_id: studentId,
      status: 'P' as const,
    }));

    let error: any = null;

    if (isAttendanceContextNameSupported && contextName) {
      const payloadWithName = basePayload.map(item => ({
        ...item,
        context_name: contextName,
      }));

      const result = await supabase
        .from('attendance_records')
        .upsert(payloadWithName, { onConflict: 'context_type,context_id,attendance_date,student_id' });
      error = result.error;

      if (error && /context_name/i.test(error.message || '')) {
        setIsAttendanceContextNameSupported(false);
        const fallbackResult = await supabase
          .from('attendance_records')
          .upsert(basePayload, { onConflict: 'context_type,context_id,attendance_date,student_id' });
        error = fallbackResult.error;
      }
    } else {
      const result = await supabase
        .from('attendance_records')
        .upsert(basePayload, { onConflict: 'context_type,context_id,attendance_date,student_id' });
      error = result.error;
    }

    if (error) {
      console.error('Failed to bulk save attendance:', error);
      notify(`Failed to save attendance: ${error.message}`);
      return;
    }

    const nextDateData: Record<string, 'P'> = {};
    studentIds.forEach(studentId => {
      nextDateData[studentId] = 'P';
    });

    setAttendanceForDate(getAttendanceStoreKey(contextType, contextId), date, nextDateData);
    notify(`All students marked Present for ${contextName || 'selected attendance context'}.`);
  }, [getAttendanceStoreKey, notify, setAttendanceForDate]);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-500 relative">

      {notification && (
        <div className="fixed top-4 right-4 z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-premium rounded-2xl px-4 py-3 min-w-[220px] max-w-[90vw]">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{notification.message}</p>
        </div>
      )}

      {newStudentCredentials && (
        <div className="fixed inset-0 z-[140] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Student Login Credentials</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Share these once with the student.</p>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              <p className="text-sm"><span className="font-black">Name:</span> {newStudentCredentials.name}</p>
              <p className="text-sm"><span className="font-black">Email:</span> {newStudentCredentials.email}</p>
              <p className="text-sm"><span className="font-black">Password:</span> {newStudentCredentials.password}</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(`Email: ${newStudentCredentials.email}\nPassword: ${newStudentCredentials.password}`);
                  notify('Credentials copied.');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Copy
              </button>
              <button
                onClick={() => setNewStudentCredentials(null)}
                className="px-4 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-xs uppercase tracking-widest"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[120] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Confirm Deletion</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDialog}
                className="px-4 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs uppercase tracking-widest"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {studentDeleteDialog && (
        <div className="fixed inset-0 z-[130] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Secure Student Deletion</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Retype <span className="font-black">{studentDeleteDialog.name}</span> and enter admin password to continue.
            </p>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retype Student Name</label>
              <input
                type="text"
                value={studentDeleteNameInput}
                onChange={(e) => setStudentDeleteNameInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter exact student name"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Password</label>
              <input
                type="password"
                value={adminDeletePassword}
                onChange={(e) => setAdminDeletePassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter admin password"
              />
            </div>

            {studentDeleteError && (
              <p className="text-xs font-bold text-rose-500">{studentDeleteError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isStudentDeleteSubmitting) return;
                  setStudentDeleteDialog(null);
                  setStudentDeleteNameInput('');
                  setAdminDeletePassword('');
                  setStudentDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleSecureStudentDelete}
                disabled={isStudentDeleteSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isStudentDeleteSubmitting ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-500'}`}
              >
                {isStudentDeleteSubmitting ? 'Verifying...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {studentEditAuthDialog && (
        <div className="fixed inset-0 z-[240] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Admin Verification Required</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Enter admin password to edit student: <span className="font-black">{studentEditAuthDialog.name}</span></p>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Password</label>
              <input
                type="password"
                value={studentEditAuthPassword}
                onChange={(e) => setStudentEditAuthPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter admin password"
              />
            </div>

            {studentEditAuthError && (
              <p className="text-xs font-bold text-rose-500">{studentEditAuthError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isStudentEditAuthSubmitting) return;
                  setStudentEditAuthDialog(null);
                  setStudentEditAuthPassword('');
                  setStudentEditAuthError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleStudentEditAuthConfirm}
                disabled={isStudentEditAuthSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isStudentEditAuthSubmitting ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
              >
                {isStudentEditAuthSubmitting ? 'Verifying...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {classDeleteDialog && (
        <div className="fixed inset-0 z-[130] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Secure Class Deletion</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Retype <span className="font-black">{classDeleteDialog.name}</span> and enter admin password to continue.
            </p>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retype Class Name</label>
              <input
                type="text"
                value={classDeleteNameInput}
                onChange={(e) => setClassDeleteNameInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter exact class name"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Password</label>
              <input
                type="password"
                value={classAdminDeletePassword}
                onChange={(e) => setClassAdminDeletePassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter admin password"
              />
            </div>

            {classDeleteError && (
              <p className="text-xs font-bold text-rose-500">{classDeleteError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isClassDeleteSubmitting) return;
                  setClassDeleteDialog(null);
                  setClassDeleteNameInput('');
                  setClassAdminDeletePassword('');
                  setClassDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleSecureClassDelete}
                disabled={isClassDeleteSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isClassDeleteSubmitting ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-500'}`}
              >
                {isClassDeleteSubmitting ? 'Verifying...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ENROLLMENT MODAL */}
      <EnrollmentModal 
        isOpen={isEnrollModalOpen}
        onClose={abortEnrollFlow}
        enrollData={enrollData}
        setEnrollData={setEnrollData}
        studentProfileImage={studentProfileImage}
        setStudentProfileImage={setStudentProfileImage}
        students={students}
        onSubmit={handleEnrollSubmit}
      />

      {/* GLOBAL EDIT MODAL */}
      <EditModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editTarget={editTarget}
        setEditTarget={setEditTarget}
        onUpdate={handleUpdate}
      />

      {/* PERMISSIONS MODAL */}
      <PermissionsModal 
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        permTarget={permTarget}
        togglePermission={togglePermission}
      />

      {/* Sidebar Navigation */}
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />

      <main className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-20 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 sm:gap-8">
            <button className="lg:hidden p-3 text-slate-500 hover:text-brand-500 transition-all" onClick={() => setIsMobileMenuOpen(true)}><i className="fas fa-bars-staggered"></i></button>
            <div className="hidden sm:flex flex-col"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System Pulse</span><span className="text-xs font-bold text-emerald-500">Live Calibration</span></div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-500 rounded-xl active:scale-75 transition-all"><i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i></button>
            <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border-2 border-slate-200 dark:border-slate-800"><img src={DEFAULT_AVATAR} className="w-full h-full object-cover" /></div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-10 xl:p-12 space-y-8 sm:space-y-10 lg:space-y-12 max-w-[1800px] w-full mx-auto overflow-hidden">
          
          {/* DASHBOARD */}
          {currentPage === 'dashboard' && <Dashboard stats={stats} />}

          {/* STUDENTS PAGE (DIRECTORY) - FULL CRUD CONTROLS */}
          {currentPage === 'students' && (
            <StudentDirectory 
              students={students}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              openPermissions={openPermissions}
              openEditModal={openEditModal}
              requestStudentEditWithPassword={requestStudentEditWithPassword}
              verifyAdminPassword={verifyAdminPassword}
              updateStudentProfilePhoto={updateStudentProfilePhoto}
              deleteEntity={deleteEntity}
            />
          )}

          {/* REGISTRATION HUB - ENROLLMENT & DELETION */}
          {currentPage === 'student-register' && (
            <RegistrationHub 
              students={students}
              enrollStudentAction={enrollStudentAction}
              deleteEntity={deleteEntity}
            />
          )}

          {/* DAILY ATTENDANCE - SUBJECT SPECIFIC */}
          {currentPage === 'student-attendance' && (
            <AttendanceProtocol 
              students={attendanceStudents}
              subjects={subjects}
              attendanceDate={attendanceDate}
              setAttendanceDate={setAttendanceDate}
              classes={classes}
              allStudents={allStudents}
              selectedStudents={selectedStudents}
              setSelectedStudents={setSelectedStudents}
              className={className}
              setClassName={setClassName}
              classImage={classImage}
              setClassImage={setClassImage}
              classOuterColor={classOuterColor}
              setClassOuterColor={setClassOuterColor}
              createClassWithStudents={createClassWithStudents}
              editingClassId={editingClassId}
              startEditClass={startEditClass}
              cancelEditClass={cancelEditClass}
              saveClassEdits={saveClassEdits}
              deleteClass={deleteClass}
              removeStudentFromClass={removeStudentFromClass}
              selectedAttendanceSubject={selectedAttendanceSubject}
              setSelectedAttendanceSubject={setSelectedAttendanceSubject}
              subjectAttendanceStore={subjectAttendanceStore}
              updateSubjectAttendance={updateSubjectAttendance}
              bulkMarkSubjectPresent={bulkMarkSubjectPresent}
              loadAttendanceForContext={loadAttendanceForContext}
              exportMonthlyAttendancePdf={exportMonthlyAttendancePdf}
              notify={notify}
            />
          )}

          {/* EXAM PAGE - WITH CRUD */}
          {currentPage === 'exam' && (
            <div className="space-y-12 animate-in fade-in duration-700 pb-20">
               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Evaluation Hub</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {exams.map((exam) => (
                    <div key={exam.id} className="bg-white dark:bg-slate-900 rounded-[64px] p-12 shadow-premium border border-slate-100 dark:border-slate-800 hover:-translate-y-3 transition-all relative group overflow-hidden">
                       <div className="flex justify-between items-start mb-10">
                          <div className={`w-20 h-20 ${exam.bg} ${exam.color} rounded-[32px] flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform`}><i className="fas fa-calendar-check"></i></div>
                          <span className="px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-400">{exam.date}</span>
                       </div>
                       <h4 className="text-2xl font-black mb-10 tracking-tight leading-tight group-hover:text-brand-500 transition-colors">{exam.subject}</h4>
                       <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-8 mt-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{exam.priority} Priority</span>
                          <div className="flex gap-4">
                             <button onClick={() => openEditModal('exam', exam)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 transition-all"><i className="fas fa-edit"></i></button>
                             <button onClick={() => deleteEntity(exam.id, 'exam')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"><i className="fas fa-trash"></i></button>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* SUBJECT PAGE - WITH CRUD */}
          {currentPage === 'subject' && (
            <div className="space-y-12 animate-in fade-in duration-700 pb-20">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Neural Curricula</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {subjects.map(sub => (
                  <div key={sub.id} className="bg-white dark:bg-slate-900 p-10 rounded-[56px] shadow-premium border border-slate-100 dark:border-slate-800 group hover:-translate-y-4 transition-all duration-500 relative">
                    <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => openEditModal('subject', sub)} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 shadow-sm"><i className="fas fa-edit text-sm"></i></button>
                       <button onClick={() => deleteEntity(sub.id, 'subject')} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm"><i className="fas fa-trash text-sm"></i></button>
                    </div>
                    <div className="flex justify-between items-start mb-12">
                      <div className={`w-20 h-20 ${sub.bg} ${sub.color} rounded-[32px] flex items-center justify-center text-4xl shadow-inner group-hover:rotate-6 transition-transform`}><i className={`fas ${sub.icon}`}></i></div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{sub.code}</p>
                    </div>
                    <h4 className="text-2xl font-black mb-2 group-hover:text-brand-500 transition-colors">{sub.name}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">{sub.teacher}</p>
                    <div className="space-y-4">
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest"><span className="text-slate-400">Syllabus Sync</span><span className="text-brand-500">{sub.progress}%</span></div>
                       <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-brand-500 transition-all duration-1000 shadow-glow" style={{ width: `${sub.progress}%` }}></div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HOMEWORK PAGE - WITH CRUD */}
          {currentPage === 'homework' && (
            <div className="space-y-12 animate-in fade-in duration-700 pb-20">
               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Assignment Matrix</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                 {homeworks.map((task) => (
                    <div key={task.id} className="bg-white dark:bg-slate-900 p-12 rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 hover:-translate-y-3 transition-all relative group">
                       <div className="absolute top-10 right-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => openEditModal('homework', task)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-brand-500 transition-colors"><i className="fas fa-pen-to-square"></i></button>
                          <button onClick={() => deleteEntity(task.id, 'homework')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-can"></i></button>
                       </div>
                       <div className="flex justify-between items-start mb-10">
                          <div className={`w-16 h-16 ${task.bg} ${task.color} rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:rotate-12 transition-transform`}><i className="fas fa-file-pen"></i></div>
                          <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-400">{task.deadline}</span>
                       </div>
                       <h4 className="text-xl font-black mb-10 leading-snug tracking-tight">{task.title}</h4>
                       <div className="space-y-4">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest"><span className="text-slate-400">Node Load</span><span className="text-brand-500">{task.load}%</span></div>
                          <div className="h-2 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-brand-500 shadow-glow transition-all" style={{ width: `${task.load}%` }}></div></div>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {/* PROGRAMS PAGE - WITH CRUD */}
          {currentPage === 'programs' && (
            <div className="space-y-12 animate-in fade-in duration-700 pb-20">
               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Academic Pathways</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 {programs.map((prog) => (
                    <div key={prog.id} className="bg-white dark:bg-slate-900 rounded-[80px] p-16 shadow-premium border border-slate-100 dark:border-slate-800 group hover:shadow-2xl transition-all duration-500 flex flex-col md:flex-row gap-12 relative overflow-hidden">
                       <div className="absolute top-12 right-12 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => openEditModal('program', prog)} className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 shadow-sm"><i className="fas fa-gear"></i></button>
                          <button onClick={() => deleteEntity(prog.id, 'program')} className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm"><i className="fas fa-trash-can"></i></button>
                       </div>
                       <div className={`w-32 h-32 md:w-48 md:h-48 rounded-[64px] bg-gradient-to-tr ${prog.color} flex items-center justify-center text-white text-5xl md:text-7xl shadow-xl group-hover:scale-110 group-hover:-rotate-3 transition-transform flex-shrink-0`}><i className={`fas ${prog.icon}`}></i></div>
                       <div className="flex-1 flex flex-col justify-center">
                          <p className="text-xs font-black text-brand-500 uppercase tracking-[0.4em] mb-4">{prog.code}</p>
                          <h4 className="text-4xl font-black mb-8 leading-tight tracking-tighter">{prog.name}</h4>
                          <div className="flex gap-12">
                             <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Nodes</p><p className="text-2xl font-black">{prog.students}</p></div>
                             <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Duration</p><p className="text-2xl font-black">{prog.duration}</p></div>
                          </div>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {/* TEACHERS PAGE - WITH CRUD */}
          {currentPage === 'teachers' && (
            <div className="space-y-12 animate-in fade-in duration-600 pb-20">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Academic Hub</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {teachers.map(t => (
                  <div key={t.id} className="group bg-white dark:bg-slate-900 p-12 rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 hover:-translate-y-3 transition-all relative overflow-hidden">
                    <div className="absolute top-10 right-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => openEditModal('teacher', t)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-brand-500 transition-colors"><i className="fas fa-edit"></i></button>
                       <button onClick={() => deleteEntity(t.id, 'teacher')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-can"></i></button>
                    </div>
                    <div className="flex justify-between items-start mb-10">
                      <div className="w-20 h-20 rounded-[32px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform"><i className={`fas ${t.icon} text-brand-500`}></i></div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${t.status === 'Online' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{t.status}</span>
                    </div>
                    <h4 className="text-2xl font-black group-hover:text-brand-500 transition-colors">{t.name}</h4>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">{t.dept}</p>
                    <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest"><span className="text-slate-400">Faculty Load</span><span className="text-brand-500">{t.load}%</span></div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-brand-500 shadow-glow" style={{ width: `${t.load}%` }}></div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FALLBACK HUB */}
          {![ 'dashboard', 'students', 'student-attendance', 'student-register', 'teachers', 'library', 'homework', 'programs', 'exam', 'security', 'subject' ].includes(currentPage) && (
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-10 md:p-16 lg:p-24 rounded-[40px] sm:rounded-[72px] lg:rounded-[120px] text-center shadow-premium animate-in zoom-in-95 duration-500 border border-slate-100 dark:border-slate-800">
              <div className="w-24 h-24 sm:w-36 sm:h-36 lg:w-48 lg:h-48 bg-brand-500/10 text-brand-500 rounded-[32px] sm:rounded-[56px] lg:rounded-[80px] flex items-center justify-center mx-auto mb-8 sm:mb-12 lg:mb-16 text-4xl sm:text-6xl lg:text-8xl shadow-inner group-hover:rotate-12 transition-all"><i className="fas fa-microchip"></i></div>
              <h3 className="text-2xl sm:text-4xl lg:text-6xl font-black tracking-tighter capitalize">{currentPage.replace('-', ' ')} Hub</h3>
              <button onClick={() => setCurrentPage('dashboard')} className="mt-8 sm:mt-12 lg:mt-16 px-8 sm:px-14 lg:px-24 py-4 sm:py-6 lg:py-8 bg-brand-500 text-white font-black rounded-[24px] sm:rounded-[40px] lg:rounded-[64px] text-[10px] sm:text-xs lg:text-sm uppercase tracking-[0.2em] sm:tracking-[0.35em] lg:tracking-[0.5em] shadow-2xl active:scale-95 transition-all">Initialize Core</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;