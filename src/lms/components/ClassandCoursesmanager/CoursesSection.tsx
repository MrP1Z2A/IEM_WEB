import React from 'react';
import { ClassRow, CourseRow } from '../ClassandCoursesmanager';

interface CoursesSectionProps {
  selectedClass: ClassRow | null;
  classCourses: CourseRow[];
  isClassCoursesLoading: boolean;
  deletingCourseId: string | null;
  onOpenCoursePage?: (course: { id: string; name: string; classId: string; className?: string }) => void;
  isTeacher: boolean;
  safeNotify: (msg: string) => void;
  setIsCreateCourseModalOpen: (open: boolean) => void;
  openEditCourseModal: (course: CourseRow) => void;
}

export const CoursesSection: React.FC<CoursesSectionProps> = ({
  selectedClass,
  classCourses,
  isClassCoursesLoading,
  isTeacher,
  setIsCreateCourseModalOpen,
  openEditCourseModal,
  onOpenCoursePage,
  safeNotify,
}) => {
  if (!selectedClass) return null;

  return (
    <div className="space-y-8 p-10 bg-white/5 backdrop-blur-3xl rounded-[48px] border border-white/10 animate-fadeIn">
      <header className="flex justify-between items-center">
         <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Academic Curricula</h3>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.3em] mt-1">Managed Courses for {selectedClass.name}</p>
         </div>
         {isTeacher && (
           <button
              type="button" onClick={() => setIsCreateCourseModalOpen(true)}
              aria-label="Add course"
              className="w-12 h-12 rounded-2xl bg-[#4ea59d] text-slate-900 shadow-lg shadow-[#4ea59d]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            >
              <i className="fas fa-plus"></i>
            </button>
         )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
         {isClassCoursesLoading ? (
           <div className="col-span-full p-20 flex flex-col items-center justify-center text-slate-500 gap-4">
              <i className="fas fa-circle-notch fa-spin text-3xl text-[#4ea59d]"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">Building Catalog...</p>
           </div>
         ) : classCourses.length === 0 ? (
            <div className="col-span-full p-20 border-2 border-dashed border-white/5 rounded-[40px] text-center space-y-4">
               <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No courses found in this formation</p>
               <button type="button" onClick={() => setIsCreateCourseModalOpen(true)} className="text-[#4ea59d] text-[9px] font-black uppercase underline decoration-2 underline-offset-4">Initialize Curriculum</button>
            </div>
         ) : classCourses.map(course => (
          <div
            key={course.id}
            className="group bg-white rounded-[32px] overflow-hidden border border-slate-100 hover:border-[#4ea59d]/40 transition-all hover:-translate-y-2 relative shadow-premium text-slate-800"
          >
            {isTeacher && (
              <div className="absolute top-8 right-8 z-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                <button type="button" onClick={() => openEditCourseModal(course)} aria-label="Edit course" className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur-md text-slate-600 border border-slate-200 hover:bg-[#4ea59d] hover:text-white flex items-center justify-center transition-all shadow-lg">
                   <i className="fas fa-pen text-[12px]"></i>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (onOpenCoursePage) {
                  onOpenCoursePage({ id: course.id, name: course.name, classId: course.class_id, className: selectedClass.name });
                } else {
                  safeNotify('Course selector is not bound.');
                }
              }}
              className="text-left w-full block cursor-pointer space-y-10"
            >
              <div className="w-full aspect-video bg-slate-50 overflow-hidden relative">
                {course.image_url ? (
                  <img src={course.image_url} alt={course.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100">
                    <i className="fas fa-book-open text-slate-300 text-5xl"></i>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-transparent"></div>
              </div>
              <div className="p-8 space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1.5">Course</p>
                  <h4 className="text-2xl font-black text-[#4ea59d] leading-tight group-hover:text-slate-900 transition-colors line-clamp-1 uppercase tracking-tighter">{course.name}</h4>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-4">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-slate-900 transition-colors">Catalog Entry</span>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#4ea59d] group-hover:bg-[#4ea59d] group-hover:text-white transition-all shadow-sm">
                    <i className="fas fa-arrow-right text-[10px]"></i>
                  </div>
                </div>
              </div>
            </button>
          </div>
         ))}
      </div>
    </div>
  );
};
