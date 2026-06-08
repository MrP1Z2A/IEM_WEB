import React from 'react';
import { supabase } from '../../supabaseClient';
import { getCurrentTenantContext, withSchoolId } from '../../services/tenantService';
import { Student } from '../../types';
import {
  AttendanceContextType,
  AttendanceStatus,
  AttendanceStudent,
  LightweightSubject,
  ClassRow
} from './useClassAndCoursesManager';

interface AttendanceSectionProps {
  classes: ClassRow[];
  students: Student[];
  allStudents?: Student[];
  subjects: LightweightSubject[];
  contextType: AttendanceContextType;
  setContextType: (type: AttendanceContextType) => void;
  selectedAttendanceContextId: string;
  setSelectedAttendanceContextId: (id: string) => void;
  attendanceDate: string;
  setAttendanceDate: (date: string) => void;
  safeNotify: (msg: string) => void;
  selectedClassId: string | null;
  setSelectedAttendanceContextIdStateOnly: (id: string) => void;
}

const normalizeAttendanceStatus = (value: unknown): AttendanceStatus | null => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'P' || normalized === 'PRESENT') return 'P';
  if (normalized === 'A' || normalized === 'ABSENT') return 'A';
  if (normalized === 'L' || normalized === 'LATE' || normalized === 'LEAVE') return 'L';
  return null;
};

export function useAttendanceSection({
  classes,
  students,
  allStudents,
  subjects,
  contextType,
  setContextType,
  selectedAttendanceContextId,
  setSelectedAttendanceContextId,
  attendanceDate,
  setAttendanceDate,
  safeNotify,
  selectedClassId,
  setSelectedAttendanceContextIdStateOnly
}: any) {
  const [attendanceMap, setAttendanceMap] = React.useState<Record<string, AttendanceStatus>>({});
  const [isAttendanceLoading, setIsAttendanceLoading] = React.useState(false);
  const [isAttendanceSaving, setIsAttendanceSaving] = React.useState(false);
  const [deletingAttendanceStudentId, setDeletingAttendanceStudentId] = React.useState<string | null>(null);
  const [linkedAttendanceStudents, setLinkedAttendanceStudents] = React.useState<AttendanceStudent[]>([]);
  const [isLinkedAttendanceStudentsLoading, setIsLinkedAttendanceStudentsLoading] = React.useState(false);

  const activeContextList = React.useMemo(
    () => (contextType === 'class'
      ? classes.map((classItem: ClassRow) => ({ id: String(classItem.id), name: String(classItem.name || '') }))
      : subjects),
    [contextType, classes, subjects]
  );

  const effectiveAttendanceContextId = React.useMemo(() => {
    if (!activeContextList.length) return '';
    const exists = activeContextList.some((item: { id: string }) => String(item.id) === String(selectedAttendanceContextId));
    return exists ? selectedAttendanceContextId : String(activeContextList[0].id);
  }, [activeContextList, selectedAttendanceContextId]);

  const loadLinkedAttendanceStudents = React.useCallback(async () => {
    if (!effectiveAttendanceContextId) {
      setLinkedAttendanceStudents([]);
      return;
    }

    const filterColumn = contextType === 'class' ? 'class_id' : 'class_course_id';
    setIsLinkedAttendanceStudentsLoading(true);

    const { data, error } = await supabase
      .from('class_course_students')
      .select('student_id, student_name, created_at')
      .eq(filterColumn, effectiveAttendanceContextId)
      .order('created_at', { ascending: true });

    setIsLinkedAttendanceStudentsLoading(false);

    if (error) {
      console.error('Failed to load linked attendance students:', error);
      setLinkedAttendanceStudents([]);
      return;
    }

    const seen = new Set<string>();
    const mapped: AttendanceStudent[] = [];

    (data || []).forEach((row: any) => {
      const id = String(row?.student_id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      mapped.push({
        id,
        name: String(row?.student_name || '').trim() || id,
      });
    });

    setLinkedAttendanceStudents(mapped);
  }, [contextType, effectiveAttendanceContextId]);

  React.useEffect(() => {
    void loadLinkedAttendanceStudents();
  }, [loadLinkedAttendanceStudents]);

  const fallbackAttendanceStudents = React.useMemo(() => {
    if (!effectiveAttendanceContextId) return [] as Student[];

    if (contextType === 'class') {
      const selectedClassForAttendance = classes.find((classItem: ClassRow) => String(classItem.id) === String(effectiveAttendanceContextId));
      const classStudentIds = (selectedClassForAttendance?.student_ids || []).map((id: string) => String(id));
      const sourceStudents = allStudents && allStudents.length > 0 ? allStudents : students;
      return sourceStudents.filter((student: Student) => classStudentIds.includes(String(student.id)));
    }

    return students;
  }, [effectiveAttendanceContextId, contextType, classes, allStudents, students]);

  const activeAttendanceStudents = React.useMemo(() => {
    if (linkedAttendanceStudents.length > 0) {
      return linkedAttendanceStudents;
    }

    return fallbackAttendanceStudents.map((student: Student) => ({
      id: String(student.id),
      name: String(student.name || ''),
      email: String(student.email || ''),
    }));
  }, [linkedAttendanceStudents, fallbackAttendanceStudents]);

  const loadAttendance = React.useCallback(async () => {
    if (!effectiveAttendanceContextId || !attendanceDate) return;

    setIsAttendanceLoading(true);

    const contextTypeCandidates = contextType === 'class'
      ? ['class', 'batch']
      : ['subject', 'course', 'class_course'];

    const primaryResult = await supabase
      .from('attendance_records')
      .select('student_id, status, context_type')
      .in('context_type', contextTypeCandidates)
      .eq('context_id', effectiveAttendanceContextId)
      .eq('attendance_date', attendanceDate);

    let data: any[] | null = (primaryResult.data as any[] | null);
    let error = primaryResult.error;

    if (!error && (!data || data.length === 0)) {
      const fallbackResult = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('context_id', effectiveAttendanceContextId)
        .eq('attendance_date', attendanceDate);

      data = (fallbackResult.data as any[] | null);
      error = fallbackResult.error;
    }

    setIsAttendanceLoading(false);

    if (error) {
      safeNotify(`Failed to load attendance: ${error.message}`);
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    (data || []).forEach((row: any) => {
      const normalizedStatus = normalizeAttendanceStatus(row.status);
      if (!normalizedStatus) return;
      nextMap[String(row.student_id)] = normalizedStatus;
    });

    setAttendanceMap(nextMap);
  }, [effectiveAttendanceContextId, attendanceDate, contextType, safeNotify]);

  React.useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const saveSingleAttendance = async (studentId: string, status: AttendanceStatus) => {
    if (!effectiveAttendanceContextId || !attendanceDate) return;

    setIsAttendanceSaving(true);

    const { schoolId } = await getCurrentTenantContext();

    const payload = withSchoolId({
      context_type: contextType,
      context_id: effectiveAttendanceContextId,
      attendance_date: attendanceDate,
      student_id: String(studentId),
      status,
    }, schoolId);

    const upsertResult = await supabase
      .from('attendance_records')
      .upsert([payload], { onConflict: 'context_type,context_id,attendance_date,student_id' });

    setIsAttendanceSaving(false);

    if (upsertResult.error) {
      safeNotify(`Failed to save attendance: ${upsertResult.error.message}`);
      return;
    }

    setAttendanceMap(prev => ({ ...prev, [String(studentId)]: status }));
  };

  const markAllPresent = async () => {
    if (!effectiveAttendanceContextId || !attendanceDate || activeAttendanceStudents.length === 0) {
      safeNotify('No students available to mark.');
      return;
    }

    setIsAttendanceSaving(true);

    const { schoolId } = await getCurrentTenantContext();

    const payload = activeAttendanceStudents.map((student: AttendanceStudent) => withSchoolId({
      context_type: contextType,
      context_id: effectiveAttendanceContextId,
      attendance_date: attendanceDate,
      student_id: String(student.id),
      status: 'P' as const,
    }, schoolId));

    const upsertResult = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'context_type,context_id,attendance_date,student_id' });

    setIsAttendanceSaving(false);

    if (upsertResult.error) {
      safeNotify(`Failed to bulk save attendance: ${upsertResult.error.message}`);
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    activeAttendanceStudents.forEach((student: AttendanceStudent) => {
      nextMap[String(student.id)] = 'P';
    });

    setAttendanceMap(nextMap);
    safeNotify('All students marked Present.');
  };

  const removeAttendanceStudent = async (studentId: string) => {
    if (!effectiveAttendanceContextId) {
      safeNotify('No attendance context selected.');
      return;
    }

    setDeletingAttendanceStudentId(studentId);

    try {
      if (contextType === 'class') {
        const enrollmentDelete = await supabase
          .from('class_course_students')
          .delete()
          .eq('class_id', effectiveAttendanceContextId)
          .eq('student_id', studentId);

        if (enrollmentDelete.error) throw enrollmentDelete.error;
      } else {
        const enrollmentDelete = await supabase
          .from('class_course_students')
          .delete()
          .eq('class_course_id', effectiveAttendanceContextId)
          .eq('student_id', studentId);

        if (enrollmentDelete.error) throw enrollmentDelete.error;
      }

      const contextTypeCandidates = contextType === 'class'
        ? ['class', 'batch']
        : ['subject', 'course', 'class_course'];

      const attendanceDelete = await supabase
        .from('attendance_records')
        .delete()
        .eq('context_id', effectiveAttendanceContextId)
        .eq('student_id', studentId)
        .in('context_type', contextTypeCandidates);

      if (attendanceDelete.error) {
        console.error('Failed to delete attendance records:', attendanceDelete.error);
      }

      setAttendanceMap(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });

      await loadLinkedAttendanceStudents();
      safeNotify('Student removed from Supabase successfully.');
    } catch (error: any) {
      safeNotify(`Delete failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setDeletingAttendanceStudentId(null);
    }
  };

  return {
    attendanceMap,
    setAttendanceMap,
    isAttendanceLoading,
    setIsAttendanceLoading,
    isAttendanceSaving,
    setIsAttendanceSaving,
    deletingAttendanceStudentId,
    setDeletingAttendanceStudentId,
    linkedAttendanceStudents,
    setLinkedAttendanceStudents,
    isLinkedAttendanceStudentsLoading,
    setIsLinkedAttendanceStudentsLoading,
    activeContextList,
    effectiveAttendanceContextId,
    loadLinkedAttendanceStudents,
    fallbackAttendanceStudents,
    activeAttendanceStudents,
    loadAttendance,
    saveSingleAttendance,
    markAllPresent,
    removeAttendanceStudent
  };
}
