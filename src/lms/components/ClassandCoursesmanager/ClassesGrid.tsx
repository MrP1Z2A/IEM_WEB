import React from 'react';
import { ClassRow } from '../ClassandCoursesmanager';

interface ClassesGridProps {
  classes: ClassRow[];
  filteredClasses: ClassRow[];
  classSearchQuery: string;
  setClassSearchQuery: (q: string) => void;
  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;
  onOpenClassPage?: (classItem: { id: string; name: string }) => void;
  isTeacher: boolean;
  startEditClass: (classItem: ClassRow) => void;
  deleteClass: (classId: string) => Promise<void>;
}

export const ClassesGrid: React.FC<ClassesGridProps> = ({
  classes,
  filteredClasses,
  classSearchQuery,
  setClassSearchQuery,
  selectedClassId,
  setSelectedClassId,
  onOpenClassPage,
  isTeacher,
  startEditClass,
  deleteClass,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
         <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#4ea59d]/60">Active Formations ({classes.length})</p>
         <div className="relative w-full md:w-80">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-[#4ea59d]/40 text-xs"></i>
            <input
              type="text"
              value={classSearchQuery}
              onChange={(e) => setClassSearchQuery(e.target.value)}
              placeholder="Lookup classes..."
              aria-label="Search classes"
              className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-[20px] outline-none font-bold text-slate-900 focus:border-[#4ea59d] transition-all text-sm"
            />
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredClasses.map((classItem) => {
          const isActive = selectedClassId === String(classItem.id);
          return (
            <div
              key={classItem.id}
              className={`group bg-white/5 border backdrop-blur-2xl rounded-[32px] p-6 text-left transition-all duration-500 overflow-hidden relative shadow-lg ${
                isActive 
                  ? 'border-[#4ea59d] shadow-[0_0_40px_-10px_rgba(78,165,157,0.3)] ring-1 ring-[#4ea59d]/50' 
                  : 'border-white/10 hover:border-white/30 hover:bg-white/10'
              }`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 w-full h-full cursor-pointer opacity-0"
                aria-label={`Select class ${classItem.name}`}
                onClick={() => {
                  setSelectedClassId(String(classItem.id));
                  if (onOpenClassPage) onOpenClassPage(classItem);
                }}
              />
              {/* ACTIONS OVERLAY */}
              {isTeacher && (
                <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 pointer-events-auto">
                  <button
                    type="button" onClick={(e) => { e.stopPropagation(); startEditClass(classItem); }}
                    aria-label="Edit class"
                    className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-[#4ea59d] flex items-center justify-center transition-all"
                  >
                    <i className="fas fa-pen text-[10px]"></i>
                  </button>
                  <button
                    type="button" onClick={(e) => { e.stopPropagation(); void deleteClass(String(classItem.id)); }}
                    aria-label="Delete class"
                    className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-rose-500 flex items-center justify-center transition-all"
                  >
                    <i className="fas fa-trash text-[10px]"></i>
                  </button>
                </div>
              )}

              <div 
                 className="w-full aspect-[4/3] relative overflow-hidden flex items-center justify-center pointer-events-none"
                 style={{ backgroundColor: classItem.outer_color || classItem.color || '#134e4a' }}
              >
                {classItem.image_url ? (
                  <img src={classItem.image_url} alt={classItem.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="text-slate-400 text-4xl"><i className="fas fa-building-columns"></i></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
              </div>

              <div className="p-6 space-y-3 relative pointer-events-none">
                <h4 className="font-black text-slate-900 text-lg tracking-tight truncate">{classItem.name}</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-lg bg-black/20 border border-white/5 text-[8px] font-black uppercase text-slate-400 tracking-widest">{classItem.class_code || 'CLASS-ID'}</span>
                  <span className="px-3 py-1 rounded-lg bg-[#4ea59d]/20 border border-[#4ea59d]/20 text-[8px] font-black uppercase text-[#4ea59d] tracking-widest">{classItem.student_count || 0} Students</span>
                </div>
              </div>
              
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#4ea59d]"></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
