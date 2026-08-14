import React from 'react';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  newCourseName: string;
  setNewCourseName: (name: string) => void;
  newCourseImage: File | null;
  newCourseError: string | null;
  newCourseImageInputRef: React.RefObject<HTMLInputElement | null>;
  createClassCourse: () => Promise<void>;
  isCreating: boolean;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'class' | 'course-create' | 'course-edit') => void;
}

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  newCourseName,
  setNewCourseName,
  newCourseImage,
  newCourseError,
  newCourseImageInputRef,
  createClassCourse,
  isCreating,
  handleFileChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[230] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5 text-slate-800">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xl font-black tracking-tight">Create Course</h3>
          <button aria-label="Action"
            type="button" onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-3">
          <label htmlFor="createCourseNameInput" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Name</label>
          <input
            id="createCourseNameInput"
            type="text"
            value={newCourseName}
            onChange={(e) => {
              setNewCourseName(e.target.value);
            }}
            placeholder="Enter course name"
            className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-2 border-transparent focus:border-brand-500 outline-none font-bold"
          />
          {newCourseError && <p className="text-xs font-bold text-rose-500">{newCourseError}</p>}
        </div>

        <div className="space-y-3">
          <label htmlFor="createCourseImageInput" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Profile Image</label>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3">
            <button
              type="button"
              onClick={() => newCourseImageInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
            >
              Add Image
            </button>
            <input
              id="createCourseImageInput"
              ref={newCourseImageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, 'course-create')}
              className="hidden"
              aria-label="Upload Course Profile Image"
            />
            {newCourseImage && (
              <p className="mt-2 text-[11px] text-slate-500 truncate">Selected: {newCourseImage.name}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button" onClick={onClose}
            className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            type="button" onClick={() => void createClassCourse()}
            disabled={isCreating}
            className={`px-6 py-3 rounded-2xl text-white text-xs font-black uppercase tracking-widest ${
              isCreating ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'
            }`}
          >
            {isCreating ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </div>
    </div>
  );
};
