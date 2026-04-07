$path = 'c:\Data_D\Apollo\backup\IEM_WEB\src\sms\App.tsx'
$content = Get-Content -LiteralPath $path -Raw

$oldText = @'
    // 1. IMMEDIATELY RESET EVERYTHING BEFORE ANY AWAIT
    // This synchronously removes stale data from the previous school context
    setStudents([]);
    setAllStudents([]);
    setAttendanceStudents([]);
    setTeachers([]);
    setParents([]);
    setStudentServiceStaff([]);
    setClasses([]);
    setTotalEarningMMK(0);
    setSubjects([]);
    setLibraryItems([]);
    setExams([]);
    setHomeworks([]);
    setPrograms([]);
    setSelectedDate('');
'@

$newText = @'
    // Only reset the app state if we've actually switched schools
    const activeSchoolId = await requireSchoolId();
    const lastSchoolId = window.localStorage.getItem('iem_last_sync_school_id');
    if (lastSchoolId !== activeSchoolId && activeSchoolId) {
      setStudents([]);
      setAllStudents([]);
      setAttendanceStudents([]);
      setTeachers([]);
      setParents([]);
      setStudentServiceStaff([]);
      setClasses([]);
      setTotalEarningMMK(0);
      setSubjects([]);
      setLibraryItems([]);
      setExams([]);
      setHomeworks([]);
      setPrograms([]);
      setSelectedDate('');
      window.localStorage.setItem('iem_last_sync_school_id', activeSchoolId);
    }
'@

if ($content.Contains($oldText)) {
    $content = $content.Replace($oldText, $newText)
    Set-Content -LiteralPath $path -Value $content -NoNewline
    Write-Output "SUCCESS: Text replaced."
} else {
    Write-Error "FAILURE: Target text not found exactly. Check whitespace."
    # List a few lines around the suspected area
    $content.Substring(0, 500) | Write-Output
}
