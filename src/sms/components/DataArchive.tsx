import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCurrentTenantContext } from '../services/tenantService';

interface DataArchiveProps {
  schoolId: string | undefined;
}

type TabId = 'attendance' | 'resources' | 'students' | 'teachers' | 'notices';

export default function DataArchive({ schoolId }: DataArchiveProps) {
  const [activeTab, setActiveTab] = useState<TabId>('attendance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General Dropdown options
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Attendance Tab State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => (new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);

  // Resources Tab State
  const [resClassId, setResClassId] = useState('');
  const [resCourseId, setResCourseId] = useState('');
  const [resourcesList, setResourcesList] = useState<any[]>([]);

  // Directory Tabs State
  const [studentsDirectory, setStudentsDirectory] = useState<any[]>([]);
  const [teachersDirectory, setTeachersDirectory] = useState<any[]>([]);
  const [noticesDirectory, setNoticesDirectory] = useState<any[]>([]);

  // Searches & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [createdDateFilter, setCreatedDateFilter] = useState('');

  const [resolvedSchoolId, setResolvedSchoolId] = useState<string | undefined>(schoolId);

  // Sync resolvedSchoolId with schoolId prop or fallback to dynamic context
  useEffect(() => {
    if (schoolId) {
      setResolvedSchoolId(schoolId);
    } else {
      setLoading(true);
      getCurrentTenantContext()
        .then(context => {
          setResolvedSchoolId(context.schoolId);
        })
        .catch(err => {
          console.error('[DataArchive] Error resolving school context:', err);
          setError('Failed to resolve school context. Please log in again.');
        })
        .finally(() => setLoading(false));
    }
  }, [schoolId]);

  // Load Classes & Courses on mount (fixed: query nested relation instead of non-existent student_ids column)
  useEffect(() => {
    if (!resolvedSchoolId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      supabase.from('classes').select('id, name, class_course_students(student_id)').eq('school_id', resolvedSchoolId).order('name'),
      supabase.from('class_courses').select('id, name, class_id').eq('school_id', resolvedSchoolId).order('name')
    ]).then(([resClasses, resCourses]) => {
      if (resClasses.error) throw resClasses.error;
      if (resCourses.error) throw resCourses.error;

      const mappedClasses = (resClasses.data || []).map((classItem: any) => ({
        id: classItem.id,
        name: classItem.name,
        student_ids: Array.from(new Set((classItem.class_course_students || []).map((relation: any) => String(relation.student_id))))
      }));
      setClasses(mappedClasses);
      setCourses(resCourses.data || []);

      if (mappedClasses.length > 0) {
        setSelectedClassId(mappedClasses[0].id);
        setResClassId(mappedClasses[0].id);
      }
    }).catch(err => {
      console.error(err);
      setError(err.message || 'Failed to load classes and courses.');
    }).finally(() => setLoading(false));
  }, [resolvedSchoolId]);

  // Load Courses for Selected Class in Resources Tab
  const activeCourseOptions = useMemo(() => {
    if (!resClassId) return [];
    return courses.filter(c => String(c.class_id) === String(resClassId));
  }, [courses, resClassId]);

  // Automatically select first course when active options change
  useEffect(() => {
    if (activeCourseOptions.length > 0) {
      setResCourseId(activeCourseOptions[0].id);
    } else {
      setResCourseId('');
    }
  }, [activeCourseOptions]);

  // Fetch Attendance Records
  const fetchMonthlyAttendance = async () => {
    if (!resolvedSchoolId || !selectedClassId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch class student_ids
      const targetClass = classes.find(c => String(c.id) === String(selectedClassId));
      const studentIds = targetClass?.student_ids || [];

      if (studentIds.length === 0) {
        setStudentsList([]);
        setAttendanceRecords([]);
        return;
      }

      // 2. Fetch those students
      const { data: students, error: studentErr } = await supabase
        .from('students')
        .select('id, name, email')
        .in('id', studentIds)
        .order('name');

      if (studentErr) throw studentErr;
      setStudentsList(students || []);

      // 3. Fetch attendance records for this class & month
      const monthStr = String(selectedMonth).padStart(2, '0');
      const startOfMonth = `${selectedYear}-${monthStr}-01`;
      const endOfMonth = `${selectedYear}-${monthStr}-31`;

      const { data: attendance, error: attErr } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', resolvedSchoolId)
        .in('student_id', studentIds)
        .gte('attendance_date', startOfMonth)
        .lte('attendance_date', endOfMonth);

      if (attErr) throw attErr;
      setAttendanceRecords(attendance || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch attendance data.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Resources List
  const fetchResources = async () => {
    if (!resolvedSchoolId || !resClassId || !resCourseId) {
      setResourcesList([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('resources_buckets')
        .select('*')
        .eq('school_id', resolvedSchoolId)
        .eq('class_id', resClassId)
        .eq('class_course_id', resCourseId)
        .order('name');
      if (err) throw err;
      setResourcesList(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch resource buckets.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Directories (Students, Teachers, Notice Board)
  const fetchDirectoryData = async () => {
    if (!resolvedSchoolId) return;
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'students') {
        const { data, error: err } = await supabase
          .from('students')
          .select('*')
          .eq('school_id', resolvedSchoolId)
          .order('name');
        if (err) throw err;
        setStudentsDirectory(data || []);
      } else if (activeTab === 'teachers') {
        const { data, error: err } = await supabase
          .from('teachers')
          .select('*')
          .eq('school_id', resolvedSchoolId)
          .order('name');
        if (err) throw err;
        setTeachersDirectory(data || []);
      } else if (activeTab === 'notices') {
        const { data, error: err } = await supabase
          .from('notice_board')
          .select('*')
          .eq('school_id', resolvedSchoolId)
          .order('notice_date', { ascending: false });
        if (err) throw err;
        setNoticesDirectory(data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load directory data.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Data Loads based on selected Tab
  useEffect(() => {
    if (activeTab === 'attendance') {
      void fetchMonthlyAttendance();
    } else if (activeTab === 'resources') {
      void fetchResources();
    } else {
      void fetchDirectoryData();
    }
  }, [activeTab, selectedClassId, selectedMonth, selectedYear, resClassId, resCourseId, resolvedSchoolId]);

  // Compute student summary statistics for attendance tab
  const computedAttendance = useMemo(() => {
    return studentsList.map(s => {
      const records = attendanceRecords.filter(r => String(r.student_id) === String(s.id));
      const total = records.length;
      const present = records.filter(r => r.status === 'P').length;
      const absent = records.filter(r => r.status === 'A').length;
      const leave = records.filter(r => r.status === 'L').length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        total,
        present,
        absent,
        leave,
        rate
      };
    });
  }, [studentsList, attendanceRecords]);

  // Handle Search Filtering
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  useMemo(() => {
    const filtered = studentsDirectory.filter(s => {
      const queryMatch = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.email?.toLowerCase().includes(searchQuery.toLowerCase());
      let dateMatch = true;
      if (createdDateFilter) {
        const datePart = s.created_at ? s.created_at.split('T')[0] : '';
        dateMatch = datePart === createdDateFilter;
      }
      return queryMatch && dateMatch;
    });
    setFilteredStudents(filtered);
  }, [studentsDirectory, searchQuery, createdDateFilter]);

  const [filteredTeachers, setFilteredTeachers] = useState<any[]>([]);
  useMemo(() => {
    const filtered = teachersDirectory.filter(t => {
      const queryMatch = t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.email?.toLowerCase().includes(searchQuery.toLowerCase());
      let dateMatch = true;
      if (createdDateFilter) {
        const datePart = t.created_at ? t.created_at.split('T')[0] : '';
        dateMatch = datePart === createdDateFilter;
      }
      return queryMatch && dateMatch;
    });
    setFilteredTeachers(filtered);
  }, [teachersDirectory, searchQuery, createdDateFilter]);

  const filteredNotices = useMemo(() => {
    return noticesDirectory.filter(n => {
      return n.title?.toLowerCase().includes(searchQuery.toLowerCase()) || n.message?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [noticesDirectory, searchQuery]);

  // PDF Export for Monthly Attendance Summary
  const exportAttendancePDF = async () => {
    if (computedAttendance.length === 0) return;
    try {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', resolvedSchoolId)
        .single();
      const schoolName = schoolData?.name || 'School Management System';

      const doc = new jsPDF();
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 38, 'F');

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolName.toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(224, 231, 255);
      doc.text('MONTHLY ATTENDANCE ARCHIVE SUMMARY', 14, 28);

      let y = 48;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Archive Parameters', 14, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const className = classes.find(c => String(c.id) === String(selectedClassId))?.name || 'N/A';
      doc.text(`Class: ${className}`, 14, y + 6);
      doc.text(`Period: ${selectedYear} - Month ${selectedMonth}`, 14, y + 12);

      const timestamp = new Date().toLocaleString();
      doc.text(`Generated: ${timestamp}`, 135, y + 6);

      const tableRows = computedAttendance.map((row, idx) => [
        (idx + 1).toString(),
        row.name,
        row.email,
        row.present.toString(),
        row.absent.toString(),
        row.leave.toString(),
        `${row.rate}%`
      ]);

      autoTable(doc, {
        startY: y + 20,
        head: [['No.', 'Student Name', 'Email Address', 'P', 'A', 'L', 'Rate']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9, cellPadding: 4 }
      });

      doc.save(`monthly_attendance_${className.replace(/\s+/g, '_')}_${selectedYear}_${selectedMonth}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // Export CSV for Monthly Attendance
  const exportAttendanceCSV = () => {
    if (computedAttendance.length === 0) return;
    const className = classes.find(c => String(c.id) === String(selectedClassId))?.name || 'class';
    
    let csvContent = 'data:text/csv;charset=utf-8,No.,Student Name,Email,Present,Absent,Leave,Rate\n';
    computedAttendance.forEach((row, idx) => {
      csvContent += `${idx + 1},"${row.name}","${row.email}",${row.present},${row.absent},${row.leave},${row.rate}%\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_summary_${className.replace(/\s+/g, '_')}_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export for Students Directory
  const exportStudentsPDF = async () => {
    if (filteredStudents.length === 0) return;
    try {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', resolvedSchoolId)
        .single();
      const schoolName = schoolData?.name || 'School Management System';

      const doc = new jsPDF();
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 38, 'F');

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolName.toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(224, 231, 255);
      doc.text('STUDENT DIRECTORY ARCHIVE', 14, 28);

      let y = 48;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Archive Details', 14, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Records: ${filteredStudents.length}`, 14, y + 6);
      doc.text(`Filter Applied: Created Date - ${createdDateFilter || 'All'}`, 14, y + 12);
      doc.text(`Search Term: ${searchQuery || 'None'}`, 14, y + 18);

      const timestamp = new Date().toLocaleString();
      doc.text(`Generated: ${timestamp}`, 135, y + 6);

      const tableRows = filteredStudents.map((row, idx) => [
        (idx + 1).toString(),
        row.name || 'N/A',
        row.email || 'N/A',
        row.phone || 'N/A',
        row.gender || 'N/A'
      ]);

      autoTable(doc, {
        startY: y + 24,
        head: [['No.', 'Student Name', 'Email Address', 'Phone Number', 'Gender']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9, cellPadding: 4 }
      });

      doc.save(`student_directory_archive_${selectedYear}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // Export CSV for Students Directory
  const exportStudentsCSV = () => {
    if (filteredStudents.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,No.,Student Name,Email,Phone,Gender\n';
    filteredStudents.forEach((row, idx) => {
      csvContent += `${idx + 1},"${row.name || 'N/A'}","${row.email || 'N/A'}","${row.phone || 'N/A'}","${row.gender || 'N/A'}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `student_directory_archive.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export for Staff Directory
  const exportTeachersPDF = async () => {
    if (filteredTeachers.length === 0) return;
    try {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', resolvedSchoolId)
        .single();
      const schoolName = schoolData?.name || 'School Management System';

      const doc = new jsPDF();
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 38, 'F');

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolName.toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(224, 231, 255);
      doc.text('TEACHER / STAFF DIRECTORY ARCHIVE', 14, 28);

      let y = 48;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Archive Details', 14, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Staff Count: ${filteredTeachers.length}`, 14, y + 6);
      doc.text(`Filter Applied: Created Date - ${createdDateFilter || 'All'}`, 14, y + 12);
      doc.text(`Search Term: ${searchQuery || 'None'}`, 14, y + 18);

      const timestamp = new Date().toLocaleString();
      doc.text(`Generated: ${timestamp}`, 135, y + 6);

      const tableRows = filteredTeachers.map((row, idx) => [
        (idx + 1).toString(),
        row.name || 'N/A',
        row.email || 'N/A',
        row.job_position || 'Lecturer / Teacher',
        row.educational_background || 'N/A'
      ]);

      autoTable(doc, {
        startY: y + 24,
        head: [['No.', 'Staff Name', 'Email Address', 'Role/Position', 'Education background']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9, cellPadding: 4 }
      });

      doc.save(`teacher_staff_directory_archive_${selectedYear}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // Export CSV for Teachers Directory
  const exportTeachersCSV = () => {
    if (filteredTeachers.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,No.,Staff Name,Email,Role,Education\n';
    filteredTeachers.forEach((row, idx) => {
      csvContent += `${idx + 1},"${row.name || 'N/A'}","${row.email || 'N/A'}","${row.job_position || 'Lecturer / Teacher'}","${row.educational_background || 'N/A'}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `teacher_staff_directory_archive.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export for Notices Archive
  const exportNoticesPDF = async () => {
    if (filteredNotices.length === 0) return;
    try {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', resolvedSchoolId)
        .single();
      const schoolName = schoolData?.name || 'School Management System';

      const doc = new jsPDF();
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 38, 'F');

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolName.toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(224, 231, 255);
      doc.text('NOTICE BOARD TIMELINE ARCHIVE', 14, 28);

      let y = 48;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Archive Details', 14, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Announcements: ${filteredNotices.length}`, 14, y + 6);
      doc.text(`Search Term: ${searchQuery || 'None'}`, 14, y + 12);

      const timestamp = new Date().toLocaleString();
      doc.text(`Generated: ${timestamp}`, 135, y + 6);

      const tableRows = filteredNotices.map((row, idx) => [
        (idx + 1).toString(),
        row.notice_date || 'N/A',
        row.priority || 'medium',
        row.title || 'N/A',
        (row.message || '').replace(/\n/g, ' ').slice(0, 80) + ((row.message || '').length > 80 ? '...' : '')
      ]);

      autoTable(doc, {
        startY: y + 18,
        head: [['No.', 'Date', 'Priority', 'Title', 'Message Summary']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8.5, cellPadding: 3.5 }
      });

      doc.save(`notices_archive_${selectedYear}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // Export CSV for Notices Archive
  const exportNoticesCSV = () => {
    if (filteredNotices.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,No.,Date,Priority,Title,Message\n';
    filteredNotices.forEach((row, idx) => {
      csvContent += `${idx + 1},"${row.notice_date || 'N/A'}","${row.priority || 'medium'}","${row.title || 'N/A'}","${(row.message || '').replace(/"/g, '""')}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `notice_board_archive.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export for Class Resources list
  const exportResourcesPDF = async () => {
    if (resourcesList.length === 0) return;
    try {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', resolvedSchoolId)
        .single();
      const schoolName = schoolData?.name || 'School Management System';

      const doc = new jsPDF();
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 38, 'F');

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolName.toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(224, 231, 255);
      doc.text('CLASS RESOURCES DIRECTORY ARCHIVE', 14, 28);

      let y = 48;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Archive Parameters', 14, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const className = classes.find(c => String(c.id) === String(resClassId))?.name || 'N/A';
      const courseName = courses.find(c => String(c.id) === String(resCourseId))?.name || 'N/A';
      doc.text(`Class: ${className}`, 14, y + 6);
      doc.text(`Course: ${courseName}`, 14, y + 12);
      doc.text(`Total Items: ${resourcesList.length}`, 14, y + 18);

      const timestamp = new Date().toLocaleString();
      doc.text(`Generated: ${timestamp}`, 135, y + 6);

      const tableRows = resourcesList.map((row, idx) => {
        const isFolder = (row.metadata?.type || 'file') === 'folder';
        const sizeKB = isFolder ? '—' : `${row.metadata?.size ? Math.max(1, Math.round(row.metadata.size / 1024)) : 0} KB`;
        const itemType = isFolder ? 'Folder' : 'File';
        const parentFolder = row.metadata?.folder || 'Root';
        return [
          (idx + 1).toString(),
          row.name,
          itemType,
          sizeKB,
          parentFolder,
          new Date(row.created_at).toLocaleDateString()
        ];
      });

      autoTable(doc, {
        startY: y + 24,
        head: [['No.', 'Item Name', 'Type', 'Size', 'Folder Location', 'Published Date']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9, cellPadding: 4 }
      });

      doc.save(`class_resources_${className.replace(/\s+/g, '_')}_${courseName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // Export CSV for Class Resources list
  const exportResourcesCSV = () => {
    if (resourcesList.length === 0) return;
    const className = classes.find(c => String(c.id) === String(resClassId))?.name || 'class';
    const courseName = courses.find(c => String(c.id) === String(resCourseId))?.name || 'course';

    let csvContent = 'data:text/csv;charset=utf-8,No.,Item Name,Type,Size,Folder,Published Date\n';
    resourcesList.forEach((row, idx) => {
      const isFolder = (row.metadata?.type || 'file') === 'folder';
      const sizeKB = isFolder ? '—' : `${row.metadata?.size ? Math.max(1, Math.round(row.metadata.size / 1024)) : 0} KB`;
      const itemType = isFolder ? 'Folder' : 'File';
      const parentFolder = row.metadata?.folder || 'Root';
      csvContent += `${idx + 1},"${row.name}","${itemType}","${sizeKB}","${parentFolder}","${new Date(row.created_at).toLocaleDateString()}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `resources_${className.replace(/\s+/g, '_')}_${courseName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download learning file helper (using fetch to blob to force download for cross-origin URLs)
  const downloadFile = async (url: string, filename: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download file directly, opening in new tab:', err);
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-800 to-indigo-700 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-brand-200">Central Repository</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">Data Archive</h2>
        <p className="text-slate-200 mt-3 text-sm sm:text-base">Comprehensive access to student lists, teachers, notices, folders, resources, and attendance metrics.</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap p-1.5 bg-slate-100 dark:bg-slate-800 rounded-3xl gap-1 max-w-fit">
        {[
          { id: 'attendance', label: 'Attendance Records', icon: 'fa-calendar-days' },
          { id: 'resources', label: 'Class Resources', icon: 'fa-box-open' },
          { id: 'students', label: 'Students Directory', icon: 'fa-user-graduate' },
          { id: 'teachers', label: 'Teachers / Staff', icon: 'fa-chalkboard-user' },
          { id: 'notices', label: 'Notices Board', icon: 'fa-bullhorn' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id as TabId); setSearchQuery(''); setCreatedDateFilter(''); setError(null); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${activeTab === tab.id ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <i className={`fas ${tab.icon} text-sm`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="text-sm font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400 rounded-2xl px-4 py-3 border border-rose-200 dark:border-rose-800">
          {error}
        </div>
      )}

      {/* Dynamic Tab Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
        
        {/* TAB 1: Attendance */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none"
                >
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Select Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Select Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027].map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              {computedAttendance.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={exportAttendancePDF}
                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    <i className="fas fa-file-pdf mr-1.5"></i> Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportAttendanceCSV}
                    className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    <i className="fas fa-file-csv mr-1.5"></i> Export CSV
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading attendance summaries...</div>
            ) : computedAttendance.length === 0 ? (
              <div className="text-center py-20 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">No records found for this query.</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 w-16">No.</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Student Name</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Email Address</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center w-20">Present</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center w-20">Absent</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center w-20">Leave</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center w-24">Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {computedAttendance.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-5 py-3 text-xs font-black text-slate-300">{idx + 1}</td>
                        <td className="px-5 py-3 text-xs font-bold text-slate-800 dark:text-white">{row.name}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">{row.email}</td>
                        <td className="px-5 py-3 text-xs text-emerald-600 font-bold text-center">{row.present}</td>
                        <td className="px-5 py-3 text-xs text-rose-600 font-bold text-center">{row.absent}</td>
                        <td className="px-5 py-3 text-xs text-amber-600 font-bold text-center">{row.leave}</td>
                        <td className="px-5 py-3 text-xs text-center font-black text-slate-800 dark:text-white">{row.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Class Resources */}
        {activeTab === 'resources' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Select Class</label>
                <select
                  value={resClassId}
                  onChange={e => setResClassId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none"
                >
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Select Course</label>
                <select
                  value={resCourseId}
                  disabled={!resClassId}
                  onChange={e => setResCourseId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none disabled:opacity-50"
                >
                  <option value="">— Select Course —</option>
                  {activeCourseOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {resourcesList.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={exportResourcesPDF}
                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    <i className="fas fa-file-pdf mr-1.5"></i> Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportResourcesCSV}
                    className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    <i className="fas fa-file-csv mr-1.5"></i> Export CSV
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading resources...</div>
            ) : resourcesList.length === 0 ? (
              <div className="text-center py-20 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">No resource folders or materials published for this selection.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resourcesList.map(res => {
                  const type = res.metadata?.type || 'file';
                  const isFolder = type === 'folder';
                  return (
                    <div
                      key={res.id}
                      className="p-5 rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-3 group hover:border-brand-500/30 transition-all duration-300"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-base ${isFolder ? 'bg-amber-500/10 text-amber-500' : 'bg-brand-500/10 text-brand-500'}`}>
                          <i className={`fas ${isFolder ? 'fa-folder-open' : 'fa-file-shield'}`}></i>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black truncate text-slate-800 dark:text-white" title={res.name}>{res.name}</h4>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                            {isFolder ? 'Resource Folder' : `File · ${res.metadata?.size ? Math.max(1, Math.round(res.metadata.size / 1024)) : 0} KB`}
                          </p>
                        </div>
                      </div>
                      {!isFolder && res.image_url && (
                        <button
                          type="button"
                          onClick={() => downloadFile(res.image_url, res.name)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 hover:bg-brand-500 hover:text-white flex items-center justify-center text-slate-400 shadow-sm transition-all"
                        >
                          <i className="fas fa-download text-[11px]"></i>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Students Directory */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:max-w-2xl items-center">
                <input aria-label="Action"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search students by name or email..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">Created Date:</span>
                  <input
                    type="date"
                    value={createdDateFilter}
                    onChange={e => setCreatedDateFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-4 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                  {createdDateFilter && (
                    <button
                      type="button"
                      onClick={() => setCreatedDateFilter('')}
                      className="py-2.5 px-3 bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-500/20 transition-all"
                      title="Clear Filter"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {filteredStudents.length > 0 && (
                <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={exportStudentsPDF}
                    className="py-2.5 px-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/15"
                    title="Download PDF"
                  >
                    <i className="fas fa-file-pdf"></i> PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportStudentsCSV}
                    className="py-2.5 px-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/15"
                    title="Download CSV"
                  >
                    <i className="fas fa-file-csv"></i> CSV
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading student directory...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-20 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">No students match your query.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="p-5 rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-4 hover:border-brand-500/20 transition-all duration-300"
                  >
                    {student.avatar ? (
                      <img src={student.avatar} alt={student.name} className="w-12 h-12 rounded-2xl object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 font-black text-lg shrink-0">
                        {student.name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black truncate text-slate-800 dark:text-white">{student.name}</h4>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{student.email}</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                        {student.phone ? `Phone: ${student.phone}` : ''} {student.gender ? `· ${student.gender}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Teachers Directory */}
        {activeTab === 'teachers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:max-w-2xl items-center">
                <input aria-label="Action"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search staff & teachers..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">Created Date:</span>
                  <input
                    type="date"
                    value={createdDateFilter}
                    onChange={e => setCreatedDateFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-4 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                  />
                  {createdDateFilter && (
                    <button
                      type="button"
                      onClick={() => setCreatedDateFilter('')}
                      className="py-2.5 px-3 bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-500/20 transition-all"
                      title="Clear Filter"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {filteredTeachers.length > 0 && (
                <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={exportTeachersPDF}
                    className="flex-1 sm:flex-none py-2.5 px-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/15"
                  >
                    <i className="fas fa-file-pdf mr-1"></i> Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportTeachersCSV}
                    className="flex-1 sm:flex-none py-2.5 px-5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/15"
                  >
                    <i className="fas fa-file-csv mr-1"></i> Export CSV
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading staff directory...</div>
            ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-20 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">No staff records match your query.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTeachers.map(teacher => (
                  <div
                    key={teacher.id}
                    className="p-5 rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-4 hover:border-brand-500/20 transition-all duration-300"
                  >
                    {teacher.avatar ? (
                      <img src={teacher.avatar} alt={teacher.name} className="w-12 h-12 rounded-2xl object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 font-black text-lg shrink-0">
                        {teacher.name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black truncate text-slate-800 dark:text-white">{teacher.name}</h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{teacher.email}</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold truncate">
                        {teacher.job_position ? `${teacher.job_position}` : 'Lecturer / Teacher'} {teacher.educational_background ? `· ${teacher.educational_background}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Notice Board */}
        {activeTab === 'notices' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <input aria-label="Action"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search announcements by title..."
                className="w-full sm:max-w-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none"
              />
              {filteredNotices.length > 0 && (
                <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={exportNoticesPDF}
                    className="flex-1 sm:flex-none py-2.5 px-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/15"
                  >
                    <i className="fas fa-file-pdf mr-1"></i> Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportNoticesCSV}
                    className="flex-1 sm:flex-none py-2.5 px-5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/15"
                  >
                    <i className="fas fa-file-csv mr-1"></i> Export CSV
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading announcements archive...</div>
            ) : filteredNotices.length === 0 ? (
              <div className="text-center py-20 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">No announcements match your query.</div>
            ) : (
              <div className="space-y-4">
                {filteredNotices.map(notice => {
                  let badgeColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                  if (notice.priority === 'urgent' || notice.priority === 'high') {
                    badgeColor = 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400';
                  } else if (notice.priority === 'medium') {
                    badgeColor = 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400';
                  }

                  return (
                    <div
                      key={notice.id}
                      className="p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${badgeColor}`}>
                            {notice.priority}
                          </span>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">{notice.title}</h4>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          {notice.notice_date}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{notice.message}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
