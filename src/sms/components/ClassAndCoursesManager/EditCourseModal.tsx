import React from 'react';

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editCourseName: string;
  setEditCourseName: (name: string) => void;
  editCourseCurrentImageUrl: string | null;
  setEditCourseCurrentImageUrl: (url: string | null) => void;
  editCourseImage: File | null;
  setEditCourseImage: (file: File | null) => void;
  editCourseError: string | null;
  editCourseImageInputRef: React.RefObject<HTMLInputElement | null>;
  saveCourseEdits: () => Promise<void>;
  isUpdating: boolean;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'class' | 'course-create' | 'course-edit') => void;
}

export const EditCourseModal: React.FC<EditCourseModalProps> = ({
  isOpen,
  onClose,
  editCourseName,
  setEditCourseName,
  editCourseCurrentImageUrl,
  setEditCourseCurrentImageUrl,
  editCourseImage,
  setEditCourseImage,
  editCourseError,
  editCourseImageInputRef,
  saveCourseEdits,
  isUpdating,
  handleFileChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[230] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5 text-slate-800">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xl font-black tracking-tight">Edit Course</h3>
          <button aria-label="Action"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
            type="button"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-3">
          <label htmlFor="editCourseNameInput" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Name</label>
          <input
            id="editCourseNameInput"
            type="text"
            value={editCourseName}
            onChange={(e) => {
              setEditCourseName(e.target.value);
            }}
            placeholder="Enter course name"
            className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-2 border-transparent focus:border-brand-500 outline-none font-bold"
          />
        </div>

        <div className="space-y-3">
          <label htmlFor="editCourseImageInput" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Profile Image</label>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 space-y-3">
            {(editCourseImage || editCourseCurrentImageUrl) && (
              <div className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <img
                  src={editCourseImage ? URL.createObjectURL(editCourseImage) : String(editCourseCurrentImageUrl)}
                  alt="Course preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => editCourseImageInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
              >
                Change Image
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditCourseImage(null);
                  setEditCourseCurrentImageUrl(null);
                  if (editCourseImageInputRef.current) editCourseImageInputRef.current.value = '';
                }}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest"
              >
                Remove Image
              </button>
            </div>

            <input
              id="editCourseImageInput"
              ref={editCourseImageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, 'course-edit')}
              className="hidden"
              aria-label="Upload Edit Course Profile Image"
            />
          </div>
        </div>

        {editCourseError && <p className="text-xs font-bold text-rose-500">{editCourseError}</p>}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest"
            type="button"
          >
            Cancel
          </button>
          <button
            type="button" onClick={() => void saveCourseEdits()}
            disabled={isUpdating}
            className={`px-6 py-3 rounded-2xl text-white text-xs font-black uppercase tracking-widest ${
              isUpdating ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'
            }`}
          >
            {isUpdating ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
