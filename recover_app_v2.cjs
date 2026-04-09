const fs = require('fs');
const path = 'c:/Data_D/Apollo/backup/IEM_WEB/src/sms/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. mapStudentFromDB (Line 529 area)
content = content.replace(
    /const mapStudentFromDB = \(student: any\): Student => \(\{[\s\S]+?securityStatus: student\?\.securityStatus \|\| \{ lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' \},/g,
    `const mapStudentFromDB = (student: any): Student => ({
    ...(student as Student),
    role: (student?.role || 'student') as Student['role'],
    gender: (student?.gender || 'Male') as Student['gender'],
    status: (student?.status || Status.PENDING) as Status,
    attendanceRate: typeof student?.attendanceRate === 'number' ? student.attendanceRate : 0,
    courseAttendance: Array.isArray(student?.courseAttendance) ? student.courseAttendance : [],
    securityStatus: student?.securityStatus || { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
    studentschool_id: student?.studentschool_id || null,
    teacherschool_id: student?.teacherschool_id || null,
    staffschool_id: student?.staffschool_id || null,`
);

// 2. handleUpdate (Line 1862 area)
// This is the most complex part. I will replace the entire logic inside handleUpdate correctly.
content = content.replace(
    /const handleUpdate = async \(newAvatarFile\?: File\) => \{[\s\S]+?const \{ type, data \} = editTarget;[\s\S]+?try \{[\s\S]+?if \(type === 'student'\) \{[\s\S]+?const schoolId = await requireSchoolId\(\);[\s\S]+?const \{ error \} = await supabase\.from\('students'\)\.upsert\(studentPayload\);[\s\S]+?finalData = studentPayload;[\s\S]+?\}[\s\S]+?if \(type === 'teacher'\) \{[\s\S]+?finalData = teacherPayload;[\s\S]+?\}[\s\S]+?if \(type === 'student_service'\) \{[\s\S]+?finalData = staffPayload;[\s\S]+?\}/g,
    `const handleUpdate = async (newAvatarFile?: File) => {
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
      }`
);

// 3. handleEnrollSubmit (Student, Line 2353 area)
content = content.replace(
    /const studentPayload = withSchoolId\(\{[\s\S]+?address: enrollData\.address \|\| null,/g,
    `const studentPayload = withSchoolId({
        id: newStudent.id,
        name: newStudent.name,
        email: newStudent.email,
        role: 'student',
        gender: newStudent.gender,
        status: newStudent.status,
        date_of_birth: newStudent.dateOfBirth,
        parent_name: newStudent.parentName,
        parent_number: toInternationalPhone(enrollData.parentCountryCode, enrollData.parent_number),
        parent_email: enrollData.parent_email,
        secondary_parent_name: enrollData.secondary_parent_name || null,
        secondary_parent_number: enrollData.secondary_parent_number ? toInternationalPhone(enrollData.parentCountryCode, enrollData.secondary_parent_number) : null,
        secondary_parent_email: enrollData.secondary_parent_email || null,
        phone: enrollData.phone || null,
        address: enrollData.address || null,
        studentschool_id: enrollData.school_id || null,`
);

// 4. handleTeacherEnrollSubmit (Line 2662 area)
content = content.replace(
    /const insertPayload = withSchoolId\(\{[\s\S]+?temp_password_created_at: new Date\(\)\.toISOString\(\),/g,
    `const insertPayload = withSchoolId({
        id: newTeacher.id,
        name: newTeacher.name,
        email: newTeacher.email,
        role: 'teacher',
        gender: newTeacher.gender,
        status: newTeacher.status,
        type: newTeacher.type,
        phone: newTeacher.phone,
        address: newTeacher.address,
        avatar: newTeacher.avatar,
        auth_user_id: authUserId,
        temp_password: generatedPassword,
        temp_password_created_at: new Date().toISOString(),
        teacherschool_id: teacherEnrollData.school_id || null,`
);

// 5. handleStudentServiceEnrollSubmit (Line 2742 area)
content = content.replace(
    /const insertPayload = withSchoolId\(\{[\s\S]+?temp_password_created_at: new Date\(\)\.toISOString\(\),/g,
    `(type === 'student_service') { // We need to be careful with withSchoolId matches
          // For staff, we match the block after the withSchoolId open
          const staffFlag = "id: newStaff.id,";` // Wait, I'll use a better approach for staff
);

// Actually, I'll just use a more targeted replacement for staff
content = content.replace(
    /role: 'student_service',[\s\S]+?temp_password_created_at: new Date\(\)\.toISOString\(\),/g,
    `role: 'student_service',
        gender: newStaff.gender,
        status: newStaff.status,
        type: newStaff.type,
        phone: newStaff.phone,
        address: newStaff.address,
        avatar: newStaff.avatar,
        auth_user_id: authUserId,
        temp_password: generatedPassword,
        temp_password_created_at: new Date().toISOString(),
        staffschool_id: studentServiceEnrollData.school_id || null,`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Recovery and fix applied successfully');
