const fs = require('fs');
const path = 'c:/Data_D/Apollo/backup/IEM_WEB/src/sms/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const openEditModalOriginal = `  const openEditModal = (type: string, data: any) => {
    if (type === 'student') {
      setEditTarget({
        type,
        data: {
          ...data,
          dateOfBirth: data?.date_of_birth ?? '',
          parentName: data?.parent_name ?? '',
          parentCountryCode: '+1',
          parent_number: data?.parent_number ?? '',
          parent_email: data?.parent_email ?? '',
          secondary_parent_name: data?.secondary_parent_name ?? '',
          secondary_parent_number: data?.secondary_parent_number ?? '',
          secondary_parent_email: data?.secondary_parent_email ?? '',
          phone: data?.phone ?? '',
          address: data?.address ?? '',
        },
      });
      setIsEditModalOpen(true);
      return;
    }

    setEditTarget({ type, data: { ...data } });
    setIsEditModalOpen(true);
  };`;

const handleUpdateFixed = `  const handleUpdate = async (newAvatarFile?: File) => {
    if (!editTarget) return;
    const { type, data } = editTarget;

    try {
      let finalData = { ...data };

      // Handle avatar upload if provided
      if (newAvatarFile && (type === 'student' || type === 'teacher' || type === 'student_service')) {
        const imageUrl = await uploadStudentProfileImage(newAvatarFile);
        finalData.avatar = imageUrl;
      }

      // Sync with Supabase if it's a student
      if (type === 'student') {
        const schoolId = await requireSchoolId();
        const existingStudent = students.find(s => s.id === data.id);
        
        // Strip other roles' school IDs and non-DB fields
        const { 
          teacherschool_id, 
          staffschool_id, 
          courseAttendance, 
          securityStatus, 
          ...sanitizedStudentData 
        } = finalData;

        const studentPayload = withSchoolId({
          ...sanitizedStudentData,
          role: finalData.role ?? existingStudent?.role ?? 'student',
          status: finalData.status ?? existingStudent?.status ?? Status.PENDING,
          attendanceRate: finalData.attendanceRate ?? existingStudent?.attendanceRate ?? 0,
        }, schoolId);

        const { error } = await supabase.from('students').upsert(studentPayload);
        if (error) {
          console.error('Supabase Update Error:', error);
          notify(\`Student sync failed: \${error.message}\`);
          return;
        }
        finalData = studentPayload;
      }

      if (type === 'teacher') {
        const schoolId = await requireSchoolId();
        const existingTeacher = teachers.find(t => t.id === data.id);
        
        // Strip other roles' school IDs and non-DB fields
        const { 
          studentschool_id, 
          staffschool_id, 
          courseAttendance, 
          securityStatus, 
          ...sanitizedTeacherData 
        } = finalData;

        const teacherPayload = withSchoolId({
          ...sanitizedTeacherData,
          id: finalData.id,
          name: finalData.name,
          email: finalData.email,
          role: 'teacher',
          gender: finalData.gender ?? existingTeacher?.gender ?? 'Male',
          status: finalData.status ?? existingTeacher?.status ?? Status.PENDING,
          type: finalData.type ?? existingTeacher?.type ?? 'New',
          avatar: finalData.avatar ?? existingTeacher?.avatar ?? null,
          phone: finalData.phone ?? existingTeacher?.phone ?? '',
          address: finalData.address ?? existingTeacher?.address ?? '',
          teacherschool_id: finalData.teacherschool_id ?? null,
        }, schoolId);

        const { error } = await supabase.from('teachers').upsert(teacherPayload);
        if (error) {
          console.error('Supabase Teacher Update Error:', error);
          notify(\`Teacher sync failed: \${error.message}\`);
          return;
        }
        finalData = teacherPayload;
      }

      if (type === 'student_service') {
        const schoolId = await requireSchoolId();
        const existingStaff = studentServiceStaff.find(s => s.id === data.id);
        
        // Strip other roles' school IDs and non-DB fields
        const { 
          studentschool_id, 
          teacherschool_id, 
          courseAttendance, 
          securityStatus, 
          ...sanitizedStaffData 
        } = finalData;

        const staffPayload = withSchoolId({
          ...sanitizedStaffData,
          id: data.id,
          name: data.name,
          email: data.email,
          role: 'student_service',
          gender: data.gender ?? existingStaff?.gender ?? 'Male',
          status: data.status ?? existingStaff?.status ?? Status.PENDING,
          type: data.type ?? existingStaff?.type ?? 'New',
          avatar: data.avatar ?? existingStaff?.avatar ?? null,
          phone: data.phone ?? existingStaff?.phone ?? '',
          address: data.address ?? existingStaff?.address ?? '',
          staffschool_id: finalData.staffschool_id ?? null,
        }, schoolId);

        const { error } = await supabase.from('student_services').upsert(staffPayload);
        if (error) {
          console.error('Supabase Student Service Update Error:', error);
          notify(\`Staff sync failed: \${error.message}\`);
          return;
        }
        finalData = staffPayload;
      }

      switch (type) {
        case 'student':
          setStudents(prev => prev.map(s => s.id === finalData.id ? finalData : s));
          break;
        case 'teacher': setTeachers(prev => prev.map(t => t.id === finalData.id ? finalData : t)); break;
        case 'student_service': setStudentServiceStaff(prev => prev.map(s => s.id === finalData.id ? finalData : s)); break;
        case 'subject': setSubjects(prev => prev.map(s => s.id === finalData.id ? finalData : s)); break;
        case 'library': setLibraryItems(prev => prev.map(i => i.id === finalData.id ? finalData : i)); break;
        case 'exam': setExams(prev => prev.map(e => e.id === finalData.id ? finalData : e)); break;
        case 'homework': setHomeworks(prev => prev.map(h => h.id === finalData.id ? finalData : h)); break;
        case 'program': setPrograms(prev => prev.map(p => p.id === finalData.id ? finalData : p)); break;
      }

      notify(\`\${type.charAt(0).toUpperCase() + type.slice(1)} synchronized.\`);
      setIsEditModalOpen(false);
      setEditTarget(null);
    } catch (err) {
      console.error('Update operation failed:', err);
      notify(err.message || \`Failed to update \${type}.\`);
    }
  };`;

// Use a regex that is very specific to the current corrupted state
// It starts from openEditModal and ends after the massive catch/switch block
const startMarker = "const openEditModal = (type: string, data: any) => {";
const endMarker = "notify(err.message || `Failed to update ${type}.`);\n    }\n  };";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker) + endMarker.length;

if (startIdx !== -1 && endIdx !== -1) {
    const newContent = content.slice(0, startIdx) + openEditModalOriginal + "\n\n" + handleUpdateFixed + content.slice(endIdx);
    fs.writeFileSync(path, newContent, 'utf8');
    console.log('App.tsx restored and fixed successfully');
} else {
    console.error('Markers not found. startIdx:', startIdx, 'endIdx:', endIdx);
}
