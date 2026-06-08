import React from 'react';
import { ClassRow } from './useClassAndCoursesManager';

interface ClassesGridProps {
  classes: ClassRow[];
  filteredClasses: ClassRow[];
  classSearchQuery: string;
  setClassSearchQuery: (q: string) => void;
  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;
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
  startEditClass,
  deleteClass,
}) => {
  if (classes.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-premium space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Created Classes</p>
        <input aria-label="Action"
          type="text"
          value={classSearchQuery}
          onChange={(e) => setClassSearchQuery(e.target.value)}
          placeholder="Search classes"
          className="w-full sm:w-72 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none font-semibold text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClasses.map((classItem) => (
          <div
            key={classItem.id}
            onClick={() => setSelectedClassId(String(classItem.id))}
            className={`rounded-2xl border overflow-hidden cursor-pointer hover:-translate-y-1 transition-all ${
              selectedClassId === String(classItem.id) ? 'border-brand-400' : 'border-slate-100 dark:border-slate-700'
            }`}
            style={{ backgroundColor: '#f8fafc' }}
          >
            <div className="flex justify-end p-2">
              <button aria-label="Action"
                type="button" onClick={(e) => {
                  e.stopPropagation();
                  startEditClass(classItem);
                }}
                className="w-8 h-8 mr-2 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:text-brand-500 border border-slate-100 dark:border-slate-700 flex items-center justify-center"
                title="Edit class"
              >
                <i className="fas fa-pen text-xs"></i>
              </button>
              <button aria-label="Action"
                type="button" onClick={(e) => {
                  e.stopPropagation();
                  void deleteClass(String(classItem.id));
                }}
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-500 border border-slate-100 dark:border-slate-700 flex items-center justify-center"
                title="Delete class"
              >
                <i className="fas fa-trash text-xs"></i>
              </button>
            </div>

            <div
              className="w-full aspect-square"
              style={{ backgroundColor: classItem.color || classItem.outer_color || '#f8fafc' }}
            >
              {classItem.image_url ? (
                <img src={classItem.image_url} alt={classItem.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
                  No Image
                </div>
              )}
            </div>

            <div className="p-3 space-y-1 bg-white dark:bg-slate-900">
              <p className="font-black text-sm truncate">{classItem.name}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {classItem.class_code || 'class-code'}
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">
                {classItem.student_count || 0} Students
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
