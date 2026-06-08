import React, { useReducer, useMemo, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getCurrentTenantContext, withSchoolId } from '../../services/tenantService';
import { Student } from '../../types';
import ImageCropper from '../Modals/ImageCropper';
import { ClassForm } from './ClassForm';
import { ClassesGrid } from './ClassesGrid';
import { CoursesSection } from './CoursesSection';
import { AttendanceSection } from './AttendanceSection';

export type AttendanceContextType = 'class' | 'subject';
export type AttendanceStatus = 'P' | 'A' | 'L';

export type AttendanceStudent = {
  id: string;
  name: string;
  email?: string;
};

export type LightweightSubject = {
  id: string;
  name: string;
};

export type ClassRow = {
  id: string;
  name: string;
  student_ids?: string[];
  image_url?: string | null;
  color?: string | null;
  outer_color?: string | null;
  class_code?: string | null;
  student_count?: number;
};

export type CourseRow = {
  id: string;
  name: string;
  class_id: string;
  image_url?: string | null;
};

interface ClassAndCoursesManagerProps {
  students?: Student[];
  allStudents?: Student[];
  subjects?: LightweightSubject[];
  notify?: (message: string) => void;
  onOpenCoursePage?: (course: { id: string; name: string; classId: string; className?: string }) => void;
}

const CLASS_IMAGE_BUCKET = 'class_image';
const COURSE_PROFILE_BUCKET = 'course_profile';

const getTodayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface State {
  classes: ClassRow[];
  classSearchQuery: string;
  selectedClassId: string | null;
  className: string;
  classImage: File | null;
  classOuterColor: string;
  isClassFormOpen: boolean;
  editingClassId: string | null;
  classCourses: CourseRow[];
  isClassCoursesLoading: boolean;
  isCreateCourseModalOpen: boolean;
  isEditCourseModalOpen: boolean;
  isClassCourseCreating: boolean;
  isClassCourseUpdating: boolean;
  deletingCourseId: string | null;
  newCourseName: string;
  newCourseImage: File | null;
  newCourseError: string | null;
  editCourseId: string | null;
  editCourseName: string;
  editCourseCurrentImageUrl: string | null;
  editCourseImage: File | null;
  editCourseError: string | null;
  contextType: AttendanceContextType;
  selectedAttendanceContextId: string;
  attendanceDate: string;
  cropperOpen: boolean;
  cropperImage: string | null;
  cropperType: 'class' | 'course-create' | 'course-edit' | null;
}

const initialState: State = {
  classes: [],
  classSearchQuery: '',
  selectedClassId: null,
  className: '',
  classImage: null,
  classOuterColor: '#f8fafc',
  isClassFormOpen: false,
  editingClassId: null,
  classCourses: [],
  isClassCoursesLoading: false,
  isCreateCourseModalOpen: false,
  isEditCourseModalOpen: false,
  isClassCourseCreating: false,
  isClassCourseUpdating: false,
  deletingCourseId: null,
  newCourseName: '',
  newCourseImage: null,
  newCourseError: null,
  editCourseId: null,
  editCourseName: '',
  editCourseCurrentImageUrl: null,
  editCourseImage: null,
  editCourseError: null,
  contextType: 'class',
  selectedAttendanceContextId: '',
  attendanceDate: getTodayIsoDate(),
  cropperOpen: false,
  cropperImage: null,
  cropperType: null,
};

type Action =
  | { type: 'SET_CLASSES'; payload: ClassRow[] }
  | { type: 'SET_CLASS_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_CLASS_ID'; payload: string | null }
  | { type: 'SET_CLASS_NAME'; payload: string }
  | { type: 'SET_CLASS_IMAGE'; payload: File | null }
  | { type: 'SET_CLASS_OUTER_COLOR'; payload: string }
  | { type: 'SET_CLASS_FORM_OPEN'; payload: boolean }
  | { type: 'SET_EDITING_CLASS_ID'; payload: string | null }
  | { type: 'SET_CLASS_COURSES'; payload: CourseRow[] }
  | { type: 'SET_CLASS_COURSES_LOADING'; payload: boolean }
  | { type: 'SET_CREATE_COURSE_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_EDIT_COURSE_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_CLASS_COURSE_CREATING'; payload: boolean }
  | { type: 'SET_CLASS_COURSE_UPDATING'; payload: boolean }
  | { type: 'SET_DELETING_COURSE_ID'; payload: string | null }
  | { type: 'SET_NEW_COURSE_NAME'; payload: string }
  | { type: 'SET_NEW_COURSE_IMAGE'; payload: File | null }
  | { type: 'SET_NEW_COURSE_ERROR'; payload: string | null }
  | { type: 'SET_EDIT_COURSE_ID'; payload: string | null }
  | { type: 'SET_EDIT_COURSE_NAME'; payload: string }
  | { type: 'SET_EDIT_COURSE_CURRENT_IMAGE_URL'; payload: string | null }
  | { type: 'SET_EDIT_COURSE_IMAGE'; payload: File | null }
  | { type: 'SET_EDIT_COURSE_ERROR'; payload: string | null }
  | { type: 'SET_CONTEXT_TYPE'; payload: AttendanceContextType }
  | { type: 'SET_SELECTED_ATTENDANCE_CONTEXT_ID'; payload: string }
  | { type: 'SET_ATTENDANCE_DATE'; payload: string }
  | { type: 'SET_CROPPER_OPEN'; payload: boolean }
  | { type: 'SET_CROPPER_IMAGE'; payload: string | null }
  | { type: 'SET_CROPPER_TYPE'; payload: 'class' | 'course-create' | 'course-edit' | null }
  | { type: 'RESET_CLASS_FORM' }
  | { type: 'RESET_NEW_COURSE_FORM' }
  | { type: 'RESET_EDIT_COURSE_FORM' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CLASSES':
      return { ...state, classes: action.payload };
    case 'SET_CLASS_SEARCH_QUERY':
      return { ...state, classSearchQuery: action.payload };
    case 'SET_SELECTED_CLASS_ID':
      return { ...state, selectedClassId: action.payload };
    case 'SET_CLASS_NAME':
      return { ...state, className: action.payload };
    case 'SET_CLASS_IMAGE':
      return { ...state, classImage: action.payload };
    case 'SET_CLASS_OUTER_COLOR':
      return { ...state, classOuterColor: action.payload };
    case 'SET_CLASS_FORM_OPEN':
      return { ...state, isClassFormOpen: action.payload };
    case 'SET_EDITING_CLASS_ID':
      return { ...state, editingClassId: action.payload };
    case 'SET_CLASS_COURSES':
      return { ...state, classCourses: action.payload };
    case 'SET_CLASS_COURSES_LOADING':
      return { ...state, isClassCoursesLoading: action.payload };
    case 'SET_CREATE_COURSE_MODAL_OPEN':
      return { ...state, isCreateCourseModalOpen: action.payload };
    case 'SET_EDIT_COURSE_MODAL_OPEN':
      return { ...state, isEditCourseModalOpen: action.payload };
    case 'SET_CLASS_COURSE_CREATING':
      return { ...state, isClassCourseCreating: action.payload };
    case 'SET_CLASS_COURSE_UPDATING':
      return { ...state, isClassCourseUpdating: action.payload };
    case 'SET_DELETING_COURSE_ID':
      return { ...state, deletingCourseId: action.payload };
    case 'SET_NEW_COURSE_NAME':
      return { ...state, newCourseName: action.payload };
    case 'SET_NEW_COURSE_IMAGE':
      return { ...state, newCourseImage: action.payload };
    case 'SET_NEW_COURSE_ERROR':
      return { ...state, newCourseError: action.payload };
    case 'SET_EDIT_COURSE_ID':
      return { ...state, editCourseId: action.payload };
    case 'SET_EDIT_COURSE_NAME':
      return { ...state, editCourseName: action.payload };
    case 'SET_EDIT_COURSE_CURRENT_IMAGE_URL':
      return { ...state, editCourseCurrentImageUrl: action.payload };
    case 'SET_EDIT_COURSE_IMAGE':
      return { ...state, editCourseImage: action.payload };
    case 'SET_EDIT_COURSE_ERROR':
      return { ...state, editCourseError: action.payload };
    case 'SET_CONTEXT_TYPE':
      return { ...state, contextType: action.payload };
    case 'SET_SELECTED_ATTENDANCE_CONTEXT_ID':
      return { ...state, selectedAttendanceContextId: action.payload };
    case 'SET_ATTENDANCE_DATE':
      return { ...state, attendanceDate: action.payload };
    case 'SET_CROPPER_OPEN':
      return { ...state, cropperOpen: action.payload };
    case 'SET_CROPPER_IMAGE':
      return { ...state, cropperImage: action.payload };
    case 'SET_CROPPER_TYPE':
      return { ...state, cropperType: action.payload };
    case 'RESET_CLASS_FORM':
      return {
        ...state,
        className: '',
        classImage: null,
        classOuterColor: '#f8fafc',
        editingClassId: null,
      };
    case 'RESET_NEW_COURSE_FORM':
      return {
        ...state,
        newCourseName: '',
        newCourseImage: null,
        newCourseError: null,
      };
    case 'RESET_EDIT_COURSE_FORM':
      return {
        ...state,
        editCourseId: null,
        editCourseName: '',
        editCourseCurrentImageUrl: null,
        editCourseImage: null,
        editCourseError: null,
      };
    default:
      return state;
  }
}

export function useClassAndCoursesManager({
  students = [],
  allStudents = [],
  subjects = [],
  notify,
  onOpenCoursePage
}: any) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const classImageInputRef = useRef<HTMLInputElement | null>(null);
  const newCourseImageInputRef = useRef<HTMLInputElement | null>(null);
  const editCourseImageInputRef = useRef<HTMLInputElement | null>(null);

  const safeNotify = useCallback((message: string) => {
    if (notify) notify(message);
  }, [notify]);

  const uploadImage = useCallback(async (bucket: string, file: File, prefix: string) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${prefix}-${Date.now()}-${sanitizedName}`;

    const uploadResult = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadResult.error) throw uploadResult.error;

    const publicResult = supabase.storage.from(bucket).getPublicUrl(path);
    if (!publicResult?.data?.publicUrl) {
      throw new Error('Failed to resolve uploaded image URL.');
    }

    return publicResult.data.publicUrl;
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'class' | 'course-create' | 'course-edit') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        dispatch({ type: 'SET_CROPPER_IMAGE', payload: reader.result as string });
        dispatch({ type: 'SET_CROPPER_TYPE', payload: type });
        dispatch({ type: 'SET_CROPPER_OPEN', payload: true });
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const onCropComplete = useCallback((croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], 'cropped_image.jpg', { type: 'image/jpeg' });
    if (state.cropperType === 'class') {
      dispatch({ type: 'SET_CLASS_IMAGE', payload: croppedFile });
    } else if (state.cropperType === 'course-create') {
      dispatch({ type: 'SET_NEW_COURSE_IMAGE', payload: croppedFile });
    } else if (state.cropperType === 'course-edit') {
      dispatch({ type: 'SET_EDIT_COURSE_IMAGE', payload: croppedFile });
    }
    dispatch({ type: 'SET_CROPPER_OPEN', payload: false });
    dispatch({ type: 'SET_CROPPER_IMAGE', payload: null });
    dispatch({ type: 'SET_CROPPER_TYPE', payload: null });
  }, [state.cropperType]);

  const loadClasses = useCallback(async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, class_course_students(student_id)')
      .order('created_at', { ascending: false });

    if (error) {
      safeNotify(`Failed to load classes: ${error.message}`);
      return;
    }

    const next = (data || []).map((row: any) => ({
      ...row,
      student_count: Array.from(new Set((row.class_course_students || []).map((relation: any) => String(relation.student_id)))).length,
      student_ids: Array.from(new Set((row.class_course_students || []).map((relation: any) => String(relation.student_id)))),
      outer_color: row.outer_color || row.color || '#f8fafc',
    }));

    dispatch({ type: 'SET_CLASSES', payload: next });
  }, [safeNotify]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const filteredClasses = useMemo(() => {
    const q = state.classSearchQuery.trim().toLowerCase();
    if (!q) {
      return state.classes;
    }

    return state.classes.filter(c => {
      const name = String(c.name || '').toLowerCase();
      const code = String(c.class_code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [state.classes, state.classSearchQuery]);

  const selectedClass = useMemo(
    () => state.classes.find(c => String(c.id) === String(state.selectedClassId)) || null,
    [state.classes, state.selectedClassId]
  );

  const resetClassForm = useCallback(() => {
    dispatch({ type: 'RESET_CLASS_FORM' });
    if (classImageInputRef.current) classImageInputRef.current.value = '';
  }, []);

  const createOrUpdateClass = useCallback(async () => {
    if (!state.className.trim()) {
      safeNotify('Please enter class name.');
      return;
    }

    try {
      const { schoolId } = await getCurrentTenantContext();
      let imageUrl: string | null = null;
      if (state.classImage) {
        imageUrl = await uploadImage(CLASS_IMAGE_BUCKET, state.classImage, 'class');
      }

      if (state.editingClassId) {
        const payload: any = withSchoolId({
          name: state.className.trim(),
          outer_color: state.classOuterColor,
          color: state.classOuterColor,
        }, schoolId);
        if (imageUrl) payload.image_url = imageUrl;

        const { error } = await supabase.from('classes').update(payload).eq('id', state.editingClassId);
        if (error) throw error;

        safeNotify('Class updated.');
      } else {
        const payload: any = withSchoolId({
          name: state.className.trim(),
          outer_color: state.classOuterColor,
          color: state.classOuterColor,
        }, schoolId);
        if (imageUrl) payload.image_url = imageUrl;

        const { error } = await supabase.from('classes').insert([payload]);
        if (error) throw error;

        safeNotify('Class created.');
      }

      resetClassForm();
      dispatch({ type: 'SET_CLASS_FORM_OPEN', payload: false });
      await loadClasses();
    } catch (error: any) {
      safeNotify(`Class save failed: ${error?.message || 'Unknown error'}`);
    }
  }, [state.className, state.classImage, state.editingClassId, state.classOuterColor, uploadImage, resetClassForm, loadClasses, safeNotify]);

  const startEditClass = useCallback((classItem: ClassRow) => {
    dispatch({ type: 'SET_EDITING_CLASS_ID', payload: String(classItem.id) });
    dispatch({ type: 'SET_CLASS_NAME', payload: String(classItem.name || '') });
    dispatch({ type: 'SET_CLASS_OUTER_COLOR', payload: String(classItem.outer_color || classItem.color || '#f8fafc') });
    dispatch({ type: 'SET_CLASS_IMAGE', payload: null });
    if (classImageInputRef.current) classImageInputRef.current.value = '';
    dispatch({ type: 'SET_CLASS_FORM_OPEN', payload: true });
  }, []);

  const deleteClass = useCallback(async (classId: string) => {
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) {
      safeNotify(`Delete failed: ${error.message}`);
      return;
    }

    safeNotify('Class deleted.');
    if (state.selectedClassId === classId) {
      dispatch({ type: 'SET_SELECTED_CLASS_ID', payload: null });
      dispatch({ type: 'SET_CLASS_COURSES', payload: [] });
    }
    await loadClasses();
  }, [state.selectedClassId, loadClasses, safeNotify]);

  const loadClassCourses = useCallback(async (classId: string) => {
    if (!classId) {
      dispatch({ type: 'SET_CLASS_COURSES', payload: [] });
      return;
    }

    dispatch({ type: 'SET_CLASS_COURSES_LOADING', payload: true });
    const { data, error } = await supabase
      .from('class_courses')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    dispatch({ type: 'SET_CLASS_COURSES_LOADING', payload: false });

    if (error) {
      safeNotify(`Failed to load courses: ${error.message}`);
      dispatch({ type: 'SET_CLASS_COURSES', payload: [] });
      return;
    }

    dispatch({
      type: 'SET_CLASS_COURSES',
      payload: (data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || ''),
        class_id: String(row.class_id),
        image_url: row.image_url || null,
      })),
    });
  }, [safeNotify]);

  useEffect(() => {
    if (!state.selectedClassId) {
      dispatch({ type: 'SET_CLASS_COURSES', payload: [] });
      return;
    }
    void loadClassCourses(state.selectedClassId);
  }, [state.selectedClassId, loadClassCourses]);

  const createClassCourse = useCallback(async () => {
    if (!state.selectedClassId) {
      dispatch({ type: 'SET_NEW_COURSE_ERROR', payload: 'Select class first.' });
      return;
    }

    if (!state.newCourseName.trim()) {
      dispatch({ type: 'SET_NEW_COURSE_ERROR', payload: 'Course name is required.' });
      return;
    }

    dispatch({ type: 'SET_CLASS_COURSE_CREATING', payload: true });
    try {
      const { schoolId } = await getCurrentTenantContext();
      let imageUrl: string | null = null;
      if (state.newCourseImage) {
        imageUrl = await uploadImage(COURSE_PROFILE_BUCKET, state.newCourseImage, 'course');
      }

      const payload: any = withSchoolId({
        class_id: state.selectedClassId,
        name: state.newCourseName.trim(),
      }, schoolId);
      if (imageUrl) payload.image_url = imageUrl;

      const { error } = await supabase.from('class_courses').insert([payload]);
      if (error) throw error;

      dispatch({ type: 'SET_CREATE_COURSE_MODAL_OPEN', payload: false });
      dispatch({ type: 'RESET_NEW_COURSE_FORM' });
      if (newCourseImageInputRef.current) newCourseImageInputRef.current.value = '';
      safeNotify('Course created.');
      await loadClassCourses(state.selectedClassId);
    } catch (error: any) {
      dispatch({ type: 'SET_NEW_COURSE_ERROR', payload: error?.message || 'Course create failed.' });
    } finally {
      dispatch({ type: 'SET_CLASS_COURSE_CREATING', payload: false });
    }
  }, [state.selectedClassId, state.newCourseName, state.newCourseImage, uploadImage, loadClassCourses, safeNotify]);

  const openEditCourseModal = useCallback((course: CourseRow) => {
    dispatch({ type: 'SET_EDIT_COURSE_ID', payload: course.id });
    dispatch({ type: 'SET_EDIT_COURSE_NAME', payload: course.name });
    dispatch({ type: 'SET_EDIT_COURSE_CURRENT_IMAGE_URL', payload: course.image_url || null });
    dispatch({ type: 'SET_EDIT_COURSE_IMAGE', payload: null });
    dispatch({ type: 'SET_EDIT_COURSE_ERROR', payload: null });
    if (editCourseImageInputRef.current) editCourseImageInputRef.current.value = '';
    dispatch({ type: 'SET_EDIT_COURSE_MODAL_OPEN', payload: true });
  }, []);

  const closeEditCourseModal = useCallback(() => {
    dispatch({ type: 'RESET_EDIT_COURSE_FORM' });
    if (editCourseImageInputRef.current) editCourseImageInputRef.current.value = '';
    dispatch({ type: 'SET_EDIT_COURSE_MODAL_OPEN', payload: false });
  }, []);

  const saveCourseEdits = useCallback(async () => {
    if (!state.editCourseId) return;
    if (!state.editCourseName.trim()) {
      dispatch({ type: 'SET_EDIT_COURSE_ERROR', payload: 'Course name is required.' });
      return;
    }

    dispatch({ type: 'SET_CLASS_COURSE_UPDATING', payload: true });
    try {
      let imageUrl = state.editCourseCurrentImageUrl;
      if (state.editCourseImage) {
        imageUrl = await uploadImage(COURSE_PROFILE_BUCKET, state.editCourseImage, 'course');
      }

      const { error } = await supabase
        .from('class_courses')
        .update({ name: state.editCourseName.trim(), image_url: imageUrl })
        .eq('id', state.editCourseId);

      if (error) throw error;

      safeNotify('Course updated.');
      closeEditCourseModal();
      if (state.selectedClassId) await loadClassCourses(state.selectedClassId);
    } catch (error: any) {
      dispatch({ type: 'SET_EDIT_COURSE_ERROR', payload: error?.message || 'Course update failed.' });
    } finally {
      dispatch({ type: 'SET_CLASS_COURSE_UPDATING', payload: false });
    }
  }, [state.editCourseId, state.editCourseName, state.editCourseCurrentImageUrl, state.editCourseImage, state.selectedClassId, uploadImage, closeEditCourseModal, loadClassCourses, safeNotify]);

  const deleteClassCourse = useCallback(async (course: CourseRow) => {
    dispatch({ type: 'SET_DELETING_COURSE_ID', payload: course.id });
    const { error } = await supabase.from('class_courses').delete().eq('id', course.id);
    dispatch({ type: 'SET_DELETING_COURSE_ID', payload: null });

    if (error) {
      safeNotify(`Delete failed: ${error.message}`);
      return;
    }

    safeNotify('Course deleted.');
    if (state.selectedClassId) await loadClassCourses(state.selectedClassId);
  }, [state.selectedClassId, loadClassCourses, safeNotify]);

  const setClassName = useCallback((payload: string) => dispatch({ type: 'SET_CLASS_NAME', payload }), []);
  const setClassOuterColor = useCallback((payload: string) => dispatch({ type: 'SET_CLASS_OUTER_COLOR', payload }), []);
  const setClassFormOpen = useCallback((payload: boolean) => dispatch({ type: 'SET_CLASS_FORM_OPEN', payload }), []);
  const setClassSearchQuery = useCallback((payload: string) => dispatch({ type: 'SET_CLASS_SEARCH_QUERY', payload }), []);
  const setSelectedClassId = useCallback((payload: string | null) => dispatch({ type: 'SET_SELECTED_CLASS_ID', payload }), []);
  const setCreateCourseModalOpen = useCallback((payload: boolean) => dispatch({ type: 'SET_CREATE_COURSE_MODAL_OPEN', payload }), []);
  const setEditCourseModalOpen = useCallback((payload: boolean) => dispatch({ type: 'SET_EDIT_COURSE_MODAL_OPEN', payload }), []);
  const setNewCourseName = useCallback((payload: string) => dispatch({ type: 'SET_NEW_COURSE_NAME', payload }), []);
  const setNewCourseImage = useCallback((payload: File | null) => dispatch({ type: 'SET_NEW_COURSE_IMAGE', payload }), []);
  const setNewCourseError = useCallback((payload: string | null) => dispatch({ type: 'SET_NEW_COURSE_ERROR', payload }), []);
  const setEditCourseName = useCallback((payload: string) => dispatch({ type: 'SET_EDIT_COURSE_NAME', payload }), []);
  const setEditCourseCurrentImageUrl = useCallback((payload: string | null) => dispatch({ type: 'SET_EDIT_COURSE_CURRENT_IMAGE_URL', payload }), []);
  const setEditCourseImage = useCallback((payload: File | null) => dispatch({ type: 'SET_EDIT_COURSE_IMAGE', payload }), []);
  const setEditCourseError = useCallback((payload: string | null) => dispatch({ type: 'SET_EDIT_COURSE_ERROR', payload }), []);
  const setContextType = useCallback((payload: AttendanceContextType) => dispatch({ type: 'SET_CONTEXT_TYPE', payload }), []);
  const setSelectedAttendanceContextId = useCallback((payload: string) => dispatch({ type: 'SET_SELECTED_ATTENDANCE_CONTEXT_ID', payload }), []);
  const setAttendanceDate = useCallback((payload: string) => dispatch({ type: 'SET_ATTENDANCE_DATE', payload }), []);

  useEffect(() => {
    if (state.contextType === 'class' && state.selectedClassId) {
      dispatch({ type: 'SET_SELECTED_ATTENDANCE_CONTEXT_ID', payload: String(state.selectedClassId) });
    }
  }, [state.contextType, state.selectedClassId]);

  return {
    state,
    dispatch,
    classImageInputRef,
    newCourseImageInputRef,
    editCourseImageInputRef,
    safeNotify,
    uploadImage,
    handleFileChange,
    onCropComplete,
    loadClasses,
    filteredClasses,
    selectedClass,
    resetClassForm,
    createOrUpdateClass,
    startEditClass,
    deleteClass,
    loadClassCourses,
    createClassCourse,
    openEditCourseModal,
    closeEditCourseModal,
    saveCourseEdits,
    deleteClassCourse,
    setClassName,
    setClassOuterColor,
    setClassFormOpen,
    setClassSearchQuery,
    setSelectedClassId,
    setCreateCourseModalOpen,
    setEditCourseModalOpen,
    setNewCourseName,
    setNewCourseImage,
    setNewCourseError,
    setEditCourseName,
    setEditCourseCurrentImageUrl,
    setEditCourseImage,
    setEditCourseError,
    setContextType,
    setSelectedAttendanceContextId,
    setAttendanceDate
  };
}
