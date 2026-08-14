import React from 'react';
import { ClassRow, CourseRow } from './useClassAndCoursesManager';

interface CoursesSectionProps {
  selectedClass: ClassRow | null;
  classCourses: CourseRow[];
  isClassCoursesLoading: boolean;
  deletingCourseId: string | null;
  onOpenCoursePage?: (course: { id: string; name: string; classId: string; className?: string }) => void;
  safeNotify: (msg: string) => void;
  setIsCreateCourseModalOpen: (open: boolean) => void;
  openEditCourseModal: (course: CourseRow) => void;
  deleteClassCourse: (course: CourseRow) => Promise<void>;
}

export const CoursesSection: React.FC<CoursesSectionProps> = ({
  selectedClass,
  classCourses,
  isClassCoursesLoading,
  deletingCourseId,
  setIsCreateCourseModalOpen,
  openEditCourseModal,
  deleteClassCourse,
  onOpenCoursePage,
  safeNotify,
}) => {
  if (!selectedClass) return null;

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium text-slate-800">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Courses</p>
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">
            {classCourses.length} Course Blocks
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <button
            type="button" onClick={() => {
              setIsCreateCourseModalOpen(true);
            }}
            className="aspect-square rounded-2xl border-2 border-dashed border-brand-300 flex items-center justify-center text-4xl font-black bg-slate-50 dark:bg-slate-800 text-brand-500 hover:-translate-y-0.5 transition-all"
            title="Create course"
          >
            +
          </button>

          {isClassCoursesLoading && (
            <div className="col-span-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500">
              Loading courses...
            </div>
          )}

          {!isClassCoursesLoading &&
            classCourses.map(course => (
              <div
                key={course.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:-translate-y-0.5 transition-all relative"
              >
                <div className="absolute top-2 right-2 flex gap-2">
                  <button aria-label="Action"
                    type="button" onClick={(e) => {
                      e.stopPropagation();
                      openEditCourseModal(course);
                    }}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:text-brand-500 border border-slate-100 dark:border-slate-700 flex items-center justify-center"
                    title="Edit course"
                  >
                    <i className="fas fa-pen text-xs"></i>
                  </button>
                  <button aria-label="Action"
                    type="button" onClick={(e) => {
                      e.stopPropagation();
                      void deleteClassCourse(course);
                    }}
                    disabled={deletingCourseId === course.id}
                    className={`w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 flex items-center justify-center ${
                      deletingCourseId === course.id ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500'
                    }`}
                    title="Delete course"
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                </div>

                <button
                  type="button" onClick={() => {
                    if (onOpenCoursePage) {
                      onOpenCoursePage({
                        id: course.id,
                        name: course.name,
                        classId: course.class_id,
                        className: selectedClass?.name,
                      });
                      return;
                    }
                    safeNotify('Course page navigation is not configured.');
                  }}
                  className="w-full text-left"
                  title="Open course page"
                >
                  {course.image_url ? (
                    <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <img src={course.image_url} alt={course.name} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course</p>
                  <p className="text-sm font-black text-brand-500 mt-1 line-clamp-3">{course.name}</p>
                </button>
              </div>
            ))}
        </div>
      </div>
    </>
  );
};
