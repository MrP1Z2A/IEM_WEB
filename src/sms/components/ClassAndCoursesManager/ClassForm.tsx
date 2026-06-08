import React from 'react';
import { ClassRow } from './useClassAndCoursesManager';

interface ClassFormProps {
  className: string;
  setClassName: (name: string) => void;
  classOuterColor: string;
  setClassOuterColor: (color: string) => void;
  isClassFormOpen: boolean;
  setIsClassFormOpen: (open: boolean) => void;
  editingClassId: string | null;
  resetClassForm: () => void;
  createOrUpdateClass: () => Promise<void>;
  classImageInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'class' | 'course-create' | 'course-edit') => void;
  classImage: File | null;
}

export const ClassForm: React.FC<ClassFormProps> = ({
  className,
  setClassName,
  classOuterColor,
  setClassOuterColor,
  isClassFormOpen,
  setIsClassFormOpen,
  editingClassId,
  resetClassForm,
  createOrUpdateClass,
  classImageInputRef,
  handleFileChange,
  classImage,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-premium space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {editingClassId ? 'Edit Class' : 'Create Class'}
          </h2>
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2">
            {editingClassId ? 'Update class appearance and details' : 'Build a class profile'}
          </p>
        </div>
        <button
          type="button" onClick={() => setIsClassFormOpen(!isClassFormOpen)}
          className="px-4 py-2 rounded-xl bg-brand-50 text-brand-500 border border-brand-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
        >
          <i className={`fas ${isClassFormOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
          {isClassFormOpen ? 'Hide Form' : 'Create Class'}
        </button>
      </div>

      {isClassFormOpen && (
        <>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Name</label>
            <input aria-label="Action"
              type="text"
              placeholder="Enter class name"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-2 border-transparent focus:border-brand-500 outline-none font-bold"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Image</label>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
              <input aria-label="Action"
                ref={classImageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'class')}
                className="w-full text-xs font-semibold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-500 file:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Image Area Color</label>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex items-center gap-3">
              <input aria-label="Action"
                type="color"
                value={classOuterColor}
                onChange={(e) => setClassOuterColor(e.target.value)}
                className="w-12 h-10 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">{classOuterColor}</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {editingClassId && (
              <button
                onClick={resetClassForm}
                className="px-6 py-3 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest"
               type="button">
                Cancel
              </button>
            )}
            <button
              type="button" onClick={() => void createOrUpdateClass()}
              className="px-8 py-3 rounded-2xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest"
            >
              {editingClassId ? 'Update Class' : 'Create Class'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
