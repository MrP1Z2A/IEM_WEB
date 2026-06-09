const fs = require('fs');
const path = 'src/sms/components/HomeworkManager.tsx';

let code = fs.readFileSync(path, 'utf8');

// Ensure we start from clean state if previously modified
code = code.replace(
  /function renderHomeworkManager\(\{ schoolId \}: \{ schoolId: string \| undefined \}\) \{/,
  'export default function HomeworkManager({ schoolId }: { schoolId: string | undefined }) {'
);
code = code.replace(
  /export default function HomeworkManager\(props: \{ schoolId: string \| undefined \}\) \{\s*return renderHomeworkManager\(props\);\s*\}/,
  ''
);

// Add the Context
code = code.replace(
  /import React, \{ useEffect, useMemo, useRef, useState \} from 'react';/,
  `import React, { useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';\n\nconst HomeworkManagerContext = createContext<any>(null);`
);

// Find "return (" at line 1161 roughly
const returnMatch = code.match(/return \(\s*<div className="space-y-8 animate-in fade-in duration-700 pb-20">/);
if (!returnMatch) {
    console.error("Return not found");
    process.exit(1);
}
const returnIndex = returnMatch.index;

const logicCode = code.substring(0, returnIndex);
let jsxCode = code.substring(returnIndex);

// Replace "export default function HomeworkManager" with "function useHomeworkManagerLogic"
const logicPartReplaced = logicCode.replace(
  /export default function HomeworkManager\(\{ schoolId \}: \{ schoolId: string \| undefined \}\) \{/,
  'function useHomeworkManagerLogic({ schoolId }: { schoolId: string | undefined }) {'
);

const contextValueStr = `
  const contextValue = {
    error, setError,
    classes, setClasses,
    courses, setCourses,
    activeSchoolId, setActiveSchoolId,
    viewerContext, setViewerContext,
    isResolvingContext, setIsResolvingContext,
    selectedClassId, setSelectedClassId,
    selectedCourseId, setSelectedCourseId,
    homeworkItems, setHomeworkItems,
    openHomework, setOpenHomework,
    isLoadingAcademic, setIsLoadingAcademic,
    isLoadingHomework, setIsLoadingHomework,
    isSavingHomework, setIsSavingHomework,
    submissions, setSubmissions,
    isLoadingSubmissions, setIsLoadingSubmissions,
    isComposerOpen, setIsComposerOpen,
    editingHomeworkId, setEditingHomeworkId,
    title, setTitle,
    body, setBody,
    dueDate, setDueDate,
    selectedFile, setSelectedFile,
    existingAttachmentUrl, setExistingAttachmentUrl,
    existingAttachmentPath, setExistingAttachmentPath,
    confirmDialog, setConfirmDialog,
    isConfirmActionSubmitting, setIsConfirmActionSubmitting,
    previewUrl, setPreviewUrl,
    previewTitle, setPreviewTitle,
    courseFolders, setCourseFolders,
    openCourseFolders, setOpenCourseFolders,
    courseFolderFiles, setCourseFolderFiles,
    newFolderName, setNewFolderName,
    isCreatingFolder, setIsCreatingFolder,
    uploadingFolderName, setUploadingFolderName,
    
    effectiveClassId, classCourses, effectiveCourseId, selectedClass, selectedCourse,
    courseFolderBasePath, resolveStorageUrl, guessFileNameFromUrl, downloadFileDirectly,
    resolveClassImageUrl, resolveCourseImageUrl, resolveHomeworkAttachmentUrl,
    extractHomeworkStoragePath, getAttachmentValueFromRow, resetComposer,
    clearAttachmentReference, deleteAttachmentFile, openConfirmDialog,
    resolveViewerContext, fetchAcademicData, fetchHomework, fetchSubmissions,
    handleAllowResubmission, loadCourseFolders, createCourseFolder, loadFilesForFolder,
    toggleCourseFolderOpen, uploadFilesToFolder, uploadHomeworkFile, handleSaveHomework,
    handleEditHomework, handleDeleteAttachmentOnly, handleDeleteHomework, toggleHomeworkOpen
  };
  return contextValue;
}
`;

const logicFinal = logicPartReplaced + contextValueStr;

const c_Header = `
function HomeworkHeader() {
  return (
    <div>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Homework Manager</h2>
      <p className="mt-2 text-slate-500 dark:text-slate-400 font-semibold">Pick class → pick course → create and manage homework.</p>
    </div>
  );
}`;

const c_Alerts = `
function HomeworkAlerts() {
  const { error, viewerContext } = useContext(HomeworkManagerContext);
  return (
    <>
      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}
      {viewerContext && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {viewerContext.role === 'teacher' ? 'Teacher Session' : 'Signed In'}
          </p>
          <p className="mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
            {viewerContext.displayName}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {viewerContext.role === 'teacher'
              ? 'Homework is filtered to the classes and courses assigned to this teacher.'
              : 'Showing homework across the current school context.'}
          </p>
        </div>
      )}
    </>
  );
}
`;

const c_Classes = `
function HomeworkClasses() {
  const { 
    selectedClassId, viewerContext, classes, isResolvingContext, 
    isLoadingAcademic, setSelectedClassId, setSelectedCourseId, 
    resetComposer, resolveClassImageUrl 
  } = useContext(HomeworkManagerContext);
  
  if (selectedClassId) return null;
  
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500">
          {viewerContext?.role === 'teacher' ? 'Assigned Classes' : 'Classes'}
        </h3>
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{classes.length} Class Blocks</span>
      </div>

      {isResolvingContext || isLoadingAcademic ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 p-6 text-sm font-bold text-slate-500">
          {viewerContext?.role === 'teacher' ? 'Loading teacher assignments...' : 'Loading classes...'}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 p-8 text-sm font-bold text-slate-500">
          {viewerContext?.role === 'teacher'
            ? 'No classes or courses are assigned to this teacher yet.'
            : 'No classes found. Create classes first.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {classes.map((item: any) => {
            const classImageUrl = resolveClassImageUrl(item);
            return (
            <button
              key={item.id}
              type="button" onClick={() => {
                setSelectedClassId(item.id);
                setSelectedCourseId('');
                resetComposer();
              }}
              className="group p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:-translate-y-0.5 transition-all"
            >
              <div className="w-full aspect-square" style={{ backgroundColor: item.color || item.outer_color || '#f8fafc' }}>
                {classImageUrl ? (
                  <img src={classImageUrl} alt={item.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
                    No Image
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1 bg-white dark:bg-slate-900 mt-2 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class</p>
                <p className="font-black text-sm truncate text-brand-500">{item.name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {item.class_code || \`\${item.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'class'}1\`}
                </p>
              </div>
            </button>
          )})}
        </div>
      )}
    </>
  );
}
`;

const c_Courses = `
function HomeworkCourses() {
  const { 
    selectedClassId, selectedCourseId, setSelectedClassId, setSelectedCourseId, 
    resetComposer, selectedClass, classCourses, resolveCourseImageUrl, setIsComposerOpen, setEditingHomeworkId 
  } = useContext(HomeworkManagerContext);
  
  if (!selectedClassId || selectedCourseId) return null;
  
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button" onClick={() => {
            setSelectedClassId('');
            setSelectedCourseId('');
            resetComposer();
          }}
          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 text-xs font-black uppercase tracking-widest"
        >
          Back to Classes
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          {selectedClass?.name || 'Selected Class'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500">Courses</h3>
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{classCourses.length} Course Blocks</span>
      </div>

      {classCourses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 p-8 text-sm font-bold text-slate-500">
          No courses found for this class.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {classCourses.map((item: any) => {
            const courseImageUrl = resolveCourseImageUrl(item);
            return (
            <button
              key={item.id}
              type="button" onClick={() => {
                setSelectedCourseId(item.id);
                setIsComposerOpen(false);
                setEditingHomeworkId(null);
              }}
              className="group p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:-translate-y-0.5 transition-all"
            >
              {courseImageUrl ? (
                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <img src={courseImageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full aspect-square rounded-xl mb-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
                  No Image
                </div>
              )}
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course</p>
              <p className="text-sm font-black text-brand-500 mt-1 line-clamp-3">{item.name}</p>
            </button>
          )})}
        </div>
      )}
    </>
  );
}
`;

const c_ComposerAndList = `
function HomeworkComposerAndList() {
  const state = useContext(HomeworkManagerContext);
  const {
    selectedClassId, selectedCourseId, setSelectedCourseId, resetComposer,
    selectedClass, selectedCourse, isComposerOpen, setIsComposerOpen,
    editingHomeworkId, setEditingHomeworkId, title, setTitle, body, setBody,
    dueDate, setDueDate, selectedFile, setSelectedFile, existingAttachmentUrl,
    setExistingAttachmentUrl, existingAttachmentPath, setExistingAttachmentPath,
    previewUrl, setPreviewUrl, previewTitle, setPreviewTitle, handleDeleteAttachmentOnly,
    isSavingHomework, handleSaveHomework, homeworkItems, isLoadingHomework,
    openHomework, handleEditHomework, handleDeleteHomework, toggleHomeworkOpen,
    submissions, fetchSubmissions, isLoadingSubmissions, handleAllowResubmission,
    resolveClassImageUrl, resolveCourseImageUrl
  } = state;

  if (!selectedClassId || !selectedCourseId) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={() => {
              setSelectedCourseId('');
              resetComposer();
            }}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 text-xs font-black uppercase tracking-widest"
          >
            Back to Courses
          </button>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            {selectedClass?.name} / {selectedCourse?.name}
          </span>
        </div>

        <button
          type="button" onClick={() => {
            if (isComposerOpen && !editingHomeworkId) {
              resetComposer();
              return;
            }
            setIsComposerOpen(true);
            if (!editingHomeworkId) {
              setTitle('');
              setBody('');
              setSelectedFile(null);
              setExistingAttachmentUrl(null);
              setExistingAttachmentPath(null);
            }
          }}
          className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest"
        >
          {editingHomeworkId ? 'Editing Homework' : isComposerOpen ? 'Close Create Homework' : 'Create Homework'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" style={{ backgroundColor: selectedClass?.color || selectedClass?.outer_color || '#f8fafc' }}>
            {selectedClass && resolveClassImageUrl(selectedClass) ? (
              <img src={resolveClassImageUrl(selectedClass)} alt={selectedClass.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">No Image</div>
            )}
          </div>
          <div className="p-3 space-y-1 bg-white dark:bg-slate-900 mt-2 rounded-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class</p>
            <p className="font-black text-sm truncate text-brand-500">{selectedClass?.name || 'Selected Class'}</p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          {selectedCourse && resolveCourseImageUrl(selectedCourse) ? (
            <div className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <img src={resolveCourseImageUrl(selectedCourse)} alt={selectedCourse.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full aspect-square rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
              No Image
            </div>
          )}
          <div className="p-3 space-y-1 bg-white dark:bg-slate-900 mt-2 rounded-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course</p>
            <p className="font-black text-sm truncate text-brand-500">{selectedCourse?.name || 'Selected Course'}</p>
          </div>
        </div>
      </div>

      {isComposerOpen && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 space-y-4 bg-slate-50/80 dark:bg-slate-950/40">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">
            {editingHomeworkId ? 'Update Homework' : 'Create Homework'}
          </h4>

          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Homework heading"
            aria-label="Homework heading"
            className="w-full bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
          />

          <textarea
            value={body}
            onChange={event => setBody(event.target.value)}
            placeholder="Homework body"
            aria-label="Homework body"
            rows={6}
            className="w-full bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
          />

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due Date (Optional)</p>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              aria-label="Due Date"
              className="w-full bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Attach PDF / DOC / DOCX</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={event => setSelectedFile(event.target.files?.[0] || null)}
              aria-label="Attach PDF, DOC, or DOCX file"
              className="w-full text-sm"
            />
            {selectedFile && (
              <p className="text-xs font-semibold text-slate-500">Selected: {selectedFile.name}</p>
            )}
            {!selectedFile && existingAttachmentUrl && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setPreviewUrl(existingAttachmentUrl); setPreviewTitle(\`Instructions: \${title}\`); }}
                  className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-500"
                >
                  <i className="fas fa-paperclip"></i>
                  Download Current Attachment
                </button>
                {editingHomeworkId && (
                  <button
                    type="button" onClick={() => void handleDeleteAttachmentOnly(editingHomeworkId, existingAttachmentPath || existingAttachmentUrl, true)}
                    disabled={isSavingHomework}
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-500 disabled:opacity-60"
                  >
                    <i className="fas fa-trash"></i>
                    Delete Attachment
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button" onClick={() => void handleSaveHomework()}
              disabled={isSavingHomework}
              className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
            >
              {isSavingHomework ? 'Saving...' : editingHomeworkId ? 'Update Homework' : 'Create Homework'}
            </button>

            <button
              onClick={resetComposer}
              disabled={isSavingHomework}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest"
             type="button">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-950/40">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Homework List</h4>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{homeworkItems.length} Items</span>
        </div>

        {isLoadingHomework ? (
          <p className="text-sm text-slate-500 font-semibold">Loading homework...</p>
        ) : homeworkItems.length === 0 ? (
          <p className="text-sm text-slate-500 font-semibold">No homework yet for this course.</p>
        ) : (
          <div className="space-y-3">
            {homeworkItems.map((item: any) => {
              const isOpen = Boolean(openHomework[item.id]);
              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-black tracking-tight truncate">{item.title}</p>
                      <p className="text-[11px] uppercase tracking-widest font-black text-slate-400 mt-1">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button" onClick={() => handleEditHomework(item)}
                        aria-label="Edit homework"
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500"
                      >
                        <i className="fas fa-pen-to-square text-xs"></i>
                      </button>
                      <button
                        type="button" onClick={() => void handleDeleteHomework(item.id)}
                        aria-label="Delete homework"
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500"
                      >
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                      <button
                        type="button" onClick={() => toggleHomeworkOpen(item.id)}
                        aria-label="Toggle details"
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500"
                      >
                        <i className={\`fas fa-chevron-down text-xs transition-transform \${isOpen ? 'rotate-180' : ''}\`}></i>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item.description}</p>
                      {item.attachment_url ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => { setPreviewUrl(item.attachment_url || ''); setPreviewTitle(\`Instructions: \${item.title}\`); }}
                            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-500"
                          >
                            <i className="fas fa-paperclip"></i>
                            Download Attachment
                          </button>
                          <button
                            type="button" onClick={() => void handleDeleteAttachmentOnly(item.id, item.attachment_url)}
                            disabled={isSavingHomework}
                            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-500 disabled:opacity-60"
                          >
                            <i className="fas fa-trash"></i>
                            Delete Attachment
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-slate-400">No attachment</p>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h5 className="text-xs font-black uppercase tracking-widest text-slate-500">Student Submissions</h5>
                          <button
                            type="button" onClick={() => void fetchSubmissions(item.id)}
                            className="text-[10px] font-black uppercase tracking-widest text-brand-500 hover:underline"
                          >
                            Refresh List
                          </button>
                        </div>

                        {isLoadingSubmissions[item.id] ? (
                          <p className="text-[11px] font-bold text-slate-400">Loading submissions...</p>
                        ) : !submissions[item.id] || submissions[item.id].length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                            <p className="text-[11px] font-bold text-slate-400">No submissions yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {submissions[item.id].map((sub: any) => (
                              <div key={sub.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{sub.student?.name || 'Unknown Student'}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={\`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider \${sub.status === 'Reopened' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}\`}>
                                      {sub.status || 'Submitted'}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : ''}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {sub.submission_url && (
                                    <button
                                      type="button" onClick={() => { setPreviewUrl(sub.submission_url || ''); setPreviewTitle(\`Submission: \${sub.student?.name || 'Student'}\`); }}
                                      aria-label="View submission"
                                      className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-500 flex items-center justify-center transition-all"
                                      title="View Submission"
                                    >
                                      <i className="fas fa-external-link-alt text-[10px]"></i>
                                    </button>
                                  )}
                                  {sub.status !== 'Reopened' && (
                                    <button
                                      type="button" onClick={() => void handleAllowResubmission(sub)}
                                      className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all flex items-center gap-1.5"
                                    >
                                      <i className="fas fa-rotate-left"></i>
                                      Allow Again
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
`;

const c_Modals = `
function HomeworkModals() {
  const { confirmDialog, setConfirmDialog, isConfirmActionSubmitting, previewUrl, setPreviewUrl, previewTitle } = useContext(HomeworkManagerContext);
  return (
    <>
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-premium">
            <h5 className="text-sm font-black uppercase tracking-widest text-slate-500">Confirm Action</h5>
            <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{confirmDialog.message}</p>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button" onClick={() => setConfirmDialog(null)}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button" onClick={() => void confirmDialog.onConfirm()}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
              >
                {isConfirmActionSubmitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {previewUrl && (
        <PdfViewer
          url={previewUrl}
          title={previewTitle}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </>
  );
}
`;

const c_MainView = `
function HomeworkManagerView() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <HomeworkHeader />
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[48px] p-6 sm:p-8 lg:p-10 shadow-premium space-y-6">
        <HomeworkAlerts />
        <HomeworkClasses />
        <HomeworkCourses />
        <HomeworkComposerAndList />
      </div>
      <HomeworkModals />
    </div>
  );
}

export default function HomeworkManager({ schoolId }: { schoolId: string | undefined }) {
  const state = useHomeworkManagerLogic({ schoolId });
  return (
    <HomeworkManagerContext.Provider value={state}>
      <HomeworkManagerView />
    </HomeworkManagerContext.Provider>
  );
}
`;

const finalCode = logicFinal + '\n' + c_Header + '\n' + c_Alerts + '\n' + c_Classes + '\n' + c_Courses + '\n' + c_ComposerAndList + '\n' + c_Modals + '\n' + c_MainView;

fs.writeFileSync(path, finalCode, 'utf8');
console.log('Refactoring complete.');
