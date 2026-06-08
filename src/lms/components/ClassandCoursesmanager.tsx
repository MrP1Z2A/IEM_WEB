import React from 'react';
import { supabase } from '../src/supabaseClient';
import { getCurrentTenantContext, withSchoolId } from '../services/tenantService';
import { Student } from '../types';
import { ClassForm } from './ClassandCoursesmanager/ClassForm';
import { ClassesGrid } from './ClassandCoursesmanager/ClassesGrid';
import { CoursesSection } from './ClassandCoursesmanager/CoursesSection';
import { CreateCourseModal } from './ClassandCoursesmanager/CreateCourseModal';
import { EditCourseModal } from './ClassandCoursesmanager/EditCourseModal';

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
  onOpenClassPage?: (classItem: { id: string; name: string }) => void;
  schoolId?: string;
  userRole?: string;
  assignedClassIds?: string[];
  assignedCourseIds?: string[];
}

const CLASS_IMAGE_BUCKET = 'class_image';
const COURSE_PROFILE_BUCKET = 'course_profile';

const normalizeAttendanceStatus = (value: unknown): AttendanceStatus | null => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'P' || normalized === 'PRESENT') return 'P';
  if (normalized === 'A' || normalized === 'ABSENT') return 'A';
  if (normalized === 'L' || normalized === 'LATE' || normalized === 'LEAVE') return 'L';
  return null;
};

const getTodayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EMPTY_ARRAY: any[] = [];

const ClassAndCoursesManager: React.FC<ClassAndCoursesManagerProps> = ({ 
  students: initialStudents = EMPTY_ARRAY, 
  allStudents: initialAllStudents, 
  subjects: initialSubjects = EMPTY_ARRAY, 
  notify, 
  onOpenCoursePage,
  onOpenClassPage,
  schoolId: propSchoolId,
  userRole,
  assignedClassIds: propAssignedClassIds = EMPTY_ARRAY,
  assignedCourseIds: propAssignedCourseIds = EMPTY_ARRAY
}) => {
  const isTeacher = React.useMemo(() => userRole?.toLowerCase() === 'teacher', [userRole]);
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [filteredClasses, setFilteredClasses] = React.useState<ClassRow[]>([]);
  const [classSearchQuery, setClassSearchQuery] = React.useState('');
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);

  const [className, setClassName] = React.useState('');
  const [classImage, setClassImage] = React.useState<File | null>(null);
  const [classOuterColor, setClassOuterColor] = React.useState('#4ea59d');
  const [isClassFormOpen, setIsClassFormOpen] = React.useState(false);
  const [editingClassId, setEditingClassId] = React.useState<string | null>(null);
  const classImageInputRef = React.useRef<HTMLInputElement | null>(null);

  const [classCourses, setClassCourses] = React.useState<CourseRow[]>([]);
  const [isClassCoursesLoading, setIsClassCoursesLoading] = React.useState(false);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = React.useState(false);
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = React.useState(false);
  const [isClassCourseCreating, setIsClassCourseCreating] = React.useState(false);
  const [isClassCourseUpdating, setIsClassCourseUpdating] = React.useState(false);
  const [deletingCourseId, setDeletingCourseId] = React.useState<string | null>(null);

  const [newCourseName, setNewCourseName] = React.useState('');
  const [newCourseImage, setNewCourseImage] = React.useState<File | null>(null);
  const [newCourseError, setNewCourseError] = React.useState<string | null>(null);
  const newCourseImageInputRef = React.useRef<HTMLInputElement | null>(null);

  const [editCourseId, setEditCourseId] = React.useState<string | null>(null);
  const [editCourseName, setEditCourseName] = React.useState('');
  const [editCourseCurrentImageUrl, setEditCourseCurrentImageUrl] = React.useState<string | null>(null);
  const [editCourseImage, setEditCourseImage] = React.useState<File | null>(null);
  const [editCourseError, setEditCourseError] = React.useState<string | null>(null);
  const editCourseImageInputRef = React.useRef<HTMLInputElement | null>(null);

  // Self-Fetching Logic for Students and Subjects (Courses)
  const [internalStudents, setInternalStudents] = React.useState<Student[]>(initialStudents);
  const [internalSubjects, setInternalSubjects] = React.useState<LightweightSubject[]>(initialSubjects);

  const safeNotify = React.useCallback((message: string) => {
    if (notify) notify(message);
  }, [notify]);

  const loadBaseData = React.useCallback(async () => {
    if (!supabase || !propSchoolId) return;
    try {
      const schoolId = propSchoolId;
      
      // Load Students if not provided
      if (initialStudents.length === 0) {
        const { data: sData } = await supabase.schema('public').from('students').select('*').eq('school_id', schoolId);
        if (sData) setInternalStudents(sData as Student[]);
      }

      // Load Subjects (Catalog Courses) if not provided
      if (initialSubjects.length === 0) {
        const { data: cData } = await supabase.schema('public').from('class_courses').select('id, name').eq('school_id', schoolId).limit(50);
        if (cData) setInternalSubjects(cData as LightweightSubject[]);
      }
    } catch (e) {
      console.error('Failed to load base data', e);
    }
  }, [initialStudents, initialSubjects, propSchoolId]);

  React.useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  const uploadImage = React.useCallback(async (bucket: string, file: File, prefix: string) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${prefix}-${Date.now()}-${sanitizedName}`;

    if (!supabase) throw new Error('Supabase client not initialized.');
    
    const uploadResult = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadResult.error) throw uploadResult.error;

    const publicResult = supabase.storage.from(bucket).getPublicUrl(path);
    if (!publicResult?.data?.publicUrl) {
      throw new Error('Failed to resolve uploaded image URL.');
    }

    return publicResult.data.publicUrl;
  }, []);

  const loadClasses = React.useCallback(async () => {
    if (!supabase || !propSchoolId) return;
    
    if (isTeacher) {
      if (!propAssignedClassIds || propAssignedClassIds.length === 0) {
        setClasses([]);
        return;
      }
    }

    let query = supabase
      .schema('public')
      .from('classes')
      .select('*, class_course_students(student_id)')
      .eq('school_id', propSchoolId);

    if (isTeacher && propAssignedClassIds && propAssignedClassIds.length > 0) {
      query = query.in('id', propAssignedClassIds);
    } else if (propAssignedClassIds && propAssignedClassIds.length > 0) {
      query = query.in('id', propAssignedClassIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      safeNotify(`Failed to load classes: ${error.message}`);
      return;
    }

    const next = (data || []).map((row: any) => ({
      ...row,
      student_count: Array.from(new Set((row.class_course_students || []).map((relation: any) => String(relation.student_id)))).length,
      student_ids: Array.from(new Set((row.class_course_students || []).map((relation: any) => String(relation.student_id)))),
      outer_color: row.outer_color || row.color || '#134e4a',
    }));

    setClasses(next);
  }, [safeNotify, propSchoolId, propAssignedClassIds, isTeacher]);

  React.useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  React.useEffect(() => {
    const q = classSearchQuery.trim().toLowerCase();
    if (!q) {
      setFilteredClasses(classes);
      return;
    }

    setFilteredClasses(
      classes.filter(c => {
        const name = String(c.name || '').toLowerCase();
        const code = String(c.class_code || '').toLowerCase();
        return name.includes(q) || code.includes(q);
      })
    );
  }, [classes, classSearchQuery]);

  const selectedClass = React.useMemo(
    () => classes.find(c => String(c.id) === String(selectedClassId)) || null,
    [classes, selectedClassId]
  );

  const resetClassForm = () => {
    setClassName('');
    setClassImage(null);
    setClassOuterColor('#4ea59d');
    setEditingClassId(null);
    if (classImageInputRef.current) classImageInputRef.current.value = '';
  };

  const createOrUpdateClass = async () => {
    if (!className.trim()) {
      safeNotify('Please enter class name.');
      return;
    }

    try {
      const { schoolId } = await getCurrentTenantContext();
      let imageUrl: string | null = null;
      if (classImage) {
        imageUrl = await uploadImage(CLASS_IMAGE_BUCKET, classImage, 'class');
      }

      const payload: any = withSchoolId({
        name: className.trim(),
        outer_color: classOuterColor,
        color: classOuterColor,
      }, schoolId);
      if (imageUrl) payload.image_url = imageUrl;

      if (editingClassId) {
        if (!supabase) throw new Error('Supabase client not initialized.');
        const { error } = await supabase.from('classes').update(payload).eq('id', editingClassId);
        if (error) throw error;
        safeNotify('Class updated.');
      } else {
        if (!supabase) throw new Error('Supabase client not initialized.');
        const { error } = await supabase.from('classes').insert([payload]);
        if (error) throw error;
        safeNotify('Class created.');
      }

      resetClassForm();
      setIsClassFormOpen(false);
      await loadClasses();
    } catch (error: any) {
      safeNotify(`Class save failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const startEditClass = (classItem: ClassRow) => {
    setEditingClassId(String(classItem.id));
    setClassName(String(classItem.name || ''));
    setClassOuterColor(String(classItem.outer_color || classItem.color || '#134e4a'));
    setClassImage(null);
    if (classImageInputRef.current) classImageInputRef.current.value = '';
    setIsClassFormOpen(true);
  };

  const deleteClass = async (classId: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) {
      safeNotify(`Delete failed: ${error.message}`);
      return;
    }

    safeNotify('Class deleted.');
    if (selectedClassId === classId) {
      setSelectedClassId(null);
      setClassCourses([]);
    }
    await loadClasses();
  };

  const loadClassCourses = React.useCallback(async (classId: string) => {
    if (!classId) {
      setClassCourses([]);
      return;
    }

    setIsClassCoursesLoading(true);
    if (!supabase) {
      setIsClassCoursesLoading(false);
      return;
    }

    const { schoolId } = await getCurrentTenantContext();
    let query = supabase
      .schema('public')
      .from('class_courses')
      .select('*')
      .eq('class_id', classId)
      .eq('school_id', schoolId);

    if (isTeacher) {
      if (!propAssignedCourseIds || propAssignedCourseIds.length === 0) {
        setClassCourses([]);
        setIsClassCoursesLoading(false);
        return;
      }
      query = query.in('id', propAssignedCourseIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    setIsClassCoursesLoading(false);

    if (error) {
      safeNotify(`Failed to load courses: ${error.message}`);
      setClassCourses([]);
      return;
    }

    setClassCourses((data || []).map((row: any) => ({
      id: String(row.id),
      name: String(row.name || ''),
      class_id: String(row.class_id),
      image_url: row.image_url || null,
    })));
  }, [safeNotify, isTeacher, propAssignedCourseIds]);

  React.useEffect(() => {
    if (!selectedClassId) {
      setClassCourses([]);
      return;
    }
    void loadClassCourses(selectedClassId);
  }, [selectedClassId, loadClassCourses]);

  const createClassCourse = async () => {
    if (!selectedClassId) {
      setNewCourseError('Select class first.');
      return;
    }

    if (!newCourseName.trim()) {
      setNewCourseError('Course name is required.');
      return;
    }

    setIsClassCourseCreating(true);
    try {
      const { schoolId } = await getCurrentTenantContext();
      let imageUrl: string | null = null;
      if (newCourseImage) {
        imageUrl = await uploadImage(COURSE_PROFILE_BUCKET, newCourseImage, 'course');
      }

      const payload: any = withSchoolId({
        class_id: selectedClassId,
        name: newCourseName.trim(),
      }, schoolId);
      if (imageUrl) payload.image_url = imageUrl;

      if (!supabase) throw new Error('Supabase client not initialized.');
      const { error } = await supabase.from('class_courses').insert([payload]);
      if (error) throw error;

      setIsCreateCourseModalOpen(false);
      setNewCourseName('');
      setNewCourseImage(null);
      setNewCourseError(null);
      if (newCourseImageInputRef.current) newCourseImageInputRef.current.value = '';
      safeNotify('Course created.');
      await loadClassCourses(selectedClassId);
    } catch (error: any) {
      setNewCourseError(error?.message || 'Course create failed.');
    } finally {
      setIsClassCourseCreating(false);
    }
  };

  const openEditCourseModal = (course: CourseRow) => {
    setEditCourseId(course.id);
    setEditCourseName(course.name);
    setEditCourseCurrentImageUrl(course.image_url || null);
    setEditCourseImage(null);
    setEditCourseError(null);
    if (editCourseImageInputRef.current) editCourseImageInputRef.current.value = '';
    setIsEditCourseModalOpen(true);
  };

  const closeEditCourseModal = () => {
    setEditCourseId(null);
    setEditCourseName('');
    setEditCourseCurrentImageUrl(null);
    setEditCourseImage(null);
    setEditCourseError(null);
    if (editCourseImageInputRef.current) editCourseImageInputRef.current.value = '';
    setIsEditCourseModalOpen(false);
  };

  const saveCourseEdits = async () => {
    if (!editCourseId) return;
    if (!editCourseName.trim()) {
      setEditCourseError('Course name is required.');
      return;
    }

    setIsClassCourseUpdating(true);
    try {
      let imageUrl = editCourseCurrentImageUrl;
      if (editCourseImage) {
        imageUrl = await uploadImage(COURSE_PROFILE_BUCKET, editCourseImage, 'course');
      }

      if (!supabase) throw new Error('Supabase client not initialized.');
      const { error } = await supabase
        .from('class_courses')
        .update({ name: editCourseName.trim(), image_url: imageUrl })
        .eq('id', editCourseId);

      if (error) throw error;

      safeNotify('Course updated.');
      closeEditCourseModal();
      if (selectedClassId) await loadClassCourses(selectedClassId);
    } catch (error: any) {
      setEditCourseError(error?.message || 'Course update failed.');
    } finally {
      setIsClassCourseUpdating(false);
    }
  };

  const deleteClassCourse = async (course: CourseRow) => {
    if (!supabase) return;
    setDeletingCourseId(course.id);
    const { error } = await supabase.from('class_courses').delete().eq('id', course.id);
    setDeletingCourseId(null);

    if (error) {
      safeNotify(`Delete failed: ${error.message}`);
      return;
    }

    safeNotify('Course deleted.');
    if (selectedClassId) await loadClassCourses(selectedClassId);
  };

  return (
    <div className="space-y-12 animate-fadeIn text-slate-800">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-4 flex-1">
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tight leading-none">Campus Formations</h2>
          <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Integrated Class & Curriculum Control</p>
        </div>
        {isTeacher && (
          <button
            type="button" onClick={() => { setEditingClassId(null); setClassName(''); setIsClassFormOpen(true); }}
            aria-label="Open Form Hub"
            className="group relative px-10 py-5 rounded-[24px] bg-[#4ea59d] text-slate-900 font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-[#4ea59d]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
          >
            <i className="fa-solid fa-plus-circle text-slate-600 group-hover:text-slate-900 transition-colors"></i> 
            Form Hub
          </button>
        )}
      </header>

      <ClassForm
        className={className}
        setClassName={setClassName}
        classOuterColor={classOuterColor}
        setClassOuterColor={setClassOuterColor}
        isClassFormOpen={isClassFormOpen}
        setIsClassFormOpen={setIsClassFormOpen}
        editingClassId={editingClassId}
        resetClassForm={resetClassForm}
        createOrUpdateClass={createOrUpdateClass}
        classImageInputRef={classImageInputRef}
        classImage={classImage}
        setClassImage={setClassImage}
      />

      <ClassesGrid
        classes={classes}
        filteredClasses={filteredClasses}
        classSearchQuery={classSearchQuery}
        setClassSearchQuery={setClassSearchQuery}
        selectedClassId={selectedClassId}
        setSelectedClassId={setSelectedClassId}
        onOpenClassPage={onOpenClassPage}
        isTeacher={isTeacher}
        startEditClass={startEditClass}
        deleteClass={deleteClass}
      />

      <CoursesSection
        selectedClass={selectedClass}
        classCourses={classCourses}
        isClassCoursesLoading={isClassCoursesLoading}
        deletingCourseId={deletingCourseId}
        onOpenCoursePage={onOpenCoursePage}
        isTeacher={isTeacher}
        safeNotify={safeNotify}
        setIsCreateCourseModalOpen={setIsCreateCourseModalOpen}
        openEditCourseModal={openEditCourseModal}
      />

      <CreateCourseModal
        isOpen={isCreateCourseModalOpen}
        onClose={() => setIsCreateCourseModalOpen(false)}
        newCourseName={newCourseName}
        setNewCourseName={setNewCourseName}
        newCourseImage={newCourseImage}
        setNewCourseImage={setNewCourseImage}
        newCourseError={newCourseError}
        setNewCourseError={setNewCourseError}
        newCourseImageInputRef={newCourseImageInputRef}
        createClassCourse={createClassCourse}
        isCreating={isClassCourseCreating}
      />

      <EditCourseModal
        isOpen={isEditCourseModalOpen}
        onClose={closeEditCourseModal}
        editCourseName={editCourseName}
        setEditCourseName={setEditCourseName}
        editCourseCurrentImageUrl={editCourseCurrentImageUrl}
        setEditCourseCurrentImageUrl={setEditCourseCurrentImageUrl}
        editCourseImage={editCourseImage}
        setEditCourseImage={setEditCourseImage}
        editCourseError={editCourseError}
        setEditCourseError={setEditCourseError}
        editCourseImageInputRef={editCourseImageInputRef}
        saveCourseEdits={saveCourseEdits}
        isUpdating={isClassCourseUpdating}
      />
    </div>
  );
};

export default ClassAndCoursesManager;
