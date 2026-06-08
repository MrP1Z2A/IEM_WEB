import React from 'react';
import { Student } from '../types';
import { LightweightSubject } from './ClassAndCoursesManager/useClassAndCoursesManager';
import { useClassAndCoursesManager } from './ClassAndCoursesManager/useClassAndCoursesManager';
import ImageCropper from './Modals/ImageCropper';
import { ClassForm } from './ClassAndCoursesManager/ClassForm';
import { ClassesGrid } from './ClassAndCoursesManager/ClassesGrid';
import { CoursesSection } from './ClassAndCoursesManager/CoursesSection';
import { CreateCourseModal } from './ClassAndCoursesManager/CreateCourseModal';
import { EditCourseModal } from './ClassAndCoursesManager/EditCourseModal';
import { AttendanceSection } from './ClassAndCoursesManager/AttendanceSection';

interface ClassAndCoursesManagerProps {
  students?: Student[];
  allStudents?: Student[];
  subjects?: LightweightSubject[];
  notify?: (message: string) => void;
  onOpenCoursePage?: (course: { id: string; name: string; classId: string; className?: string }) => void;
}

const ClassAndCoursesManager: React.FC<ClassAndCoursesManagerProps> = (props) => {
  const hub = useClassAndCoursesManager(props);
  const { state, dispatch, classImageInputRef, newCourseImageInputRef, editCourseImageInputRef, safeNotify, uploadImage, handleFileChange, onCropComplete, loadClasses, filteredClasses, selectedClass, resetClassForm, createOrUpdateClass, startEditClass, deleteClass, loadClassCourses, createClassCourse, openEditCourseModal, closeEditCourseModal, saveCourseEdits, deleteClassCourse, setClassName, setClassOuterColor, setClassFormOpen, setClassSearchQuery, setSelectedClassId, setCreateCourseModalOpen, setEditCourseModalOpen, setNewCourseName, setNewCourseImage, setNewCourseError, setEditCourseName, setEditCourseCurrentImageUrl, setEditCourseImage, setEditCourseError, setContextType, setSelectedAttendanceContextId, setAttendanceDate } = hub;
  const { onOpenCoursePage, students = [], allStudents = [], subjects = [] } = props;

  return (
    <div className="space-y-8">
      <ClassForm
        className={state.className}
        setClassName={setClassName}
        classOuterColor={state.classOuterColor}
        setClassOuterColor={setClassOuterColor}
        isClassFormOpen={state.isClassFormOpen}
        setIsClassFormOpen={setClassFormOpen}
        editingClassId={state.editingClassId}
        resetClassForm={resetClassForm}
        createOrUpdateClass={createOrUpdateClass}
        classImageInputRef={classImageInputRef}
        handleFileChange={handleFileChange}
        classImage={state.classImage}
      />

      <ClassesGrid
        classes={state.classes}
        filteredClasses={filteredClasses}
        classSearchQuery={state.classSearchQuery}
        setClassSearchQuery={setClassSearchQuery}
        selectedClassId={state.selectedClassId}
        setSelectedClassId={setSelectedClassId}
        startEditClass={startEditClass}
        deleteClass={deleteClass}
      />

      <CoursesSection
        selectedClass={selectedClass}
        classCourses={state.classCourses}
        isClassCoursesLoading={state.isClassCoursesLoading}
        deletingCourseId={state.deletingCourseId}
        onOpenCoursePage={onOpenCoursePage}
        safeNotify={safeNotify}
        setIsCreateCourseModalOpen={setCreateCourseModalOpen}
        openEditCourseModal={openEditCourseModal}
        deleteClassCourse={deleteClassCourse}
      />

      <CreateCourseModal
        isOpen={state.isCreateCourseModalOpen}
        onClose={() => {
          if (state.isClassCourseCreating) return;
          setCreateCourseModalOpen(false);
          setNewCourseName('');
          setNewCourseImage(null);
          setNewCourseError(null);
        }}
        newCourseName={state.newCourseName}
        setNewCourseName={setNewCourseName}
        newCourseImage={state.newCourseImage}
        newCourseError={state.newCourseError}
        newCourseImageInputRef={newCourseImageInputRef}
        createClassCourse={createClassCourse}
        isCreating={state.isClassCourseCreating}
        handleFileChange={handleFileChange}
      />

      <EditCourseModal
        isOpen={state.isEditCourseModalOpen}
        onClose={closeEditCourseModal}
        editCourseName={state.editCourseName}
        setEditCourseName={setEditCourseName}
        editCourseCurrentImageUrl={state.editCourseCurrentImageUrl}
        setEditCourseCurrentImageUrl={setEditCourseCurrentImageUrl}
        editCourseImage={state.editCourseImage}
        setEditCourseImage={setEditCourseImage}
        editCourseError={state.editCourseError}
        editCourseImageInputRef={editCourseImageInputRef}
        saveCourseEdits={saveCourseEdits}
        isUpdating={state.isClassCourseUpdating}
        handleFileChange={handleFileChange}
      />

      <AttendanceSection
        classes={state.classes}
        students={students}
        allStudents={allStudents}
        subjects={subjects}
        contextType={state.contextType}
        setContextType={setContextType}
        selectedAttendanceContextId={state.selectedAttendanceContextId}
        setSelectedAttendanceContextId={setSelectedAttendanceContextId}
        attendanceDate={state.attendanceDate}
        setAttendanceDate={setAttendanceDate}
        safeNotify={safeNotify}
        selectedClassId={state.selectedClassId}
        setSelectedAttendanceContextIdStateOnly={setSelectedAttendanceContextId}
      />

      {state.cropperOpen && state.cropperImage && (
        <ImageCropper
          image={state.cropperImage}
          onCropComplete={onCropComplete}
          onCancel={() => {
            dispatch({ type: 'SET_CROPPER_OPEN', payload: false });
            dispatch({ type: 'SET_CROPPER_IMAGE', payload: null });
            dispatch({ type: 'SET_CROPPER_TYPE', payload: null });
          }}
          aspect={1}
        />
      )}
    </div>
  );
};

export default ClassAndCoursesManager;
