$path = 'c:\Data_D\Apollo\backup\IEM_WEB\src\sms\App.tsx'
$lines = Get-Content -LiteralPath $path
$newBlock = @'
  // Main data synchronization effect with explicit state clearing only on school switch
  useEffect(() => {
    const performCloudSync = async () => {
      const activeSchoolId = await requireSchoolId();
      if (!activeSchoolId) return;

      // Only reset the whole app state if we've actually switched schools to prevent "Institutional Pulse" from zeroing out during refresh
      const lastSchoolId = window.localStorage.getItem('iem_last_sync_school_id');
      if (lastSchoolId !== activeSchoolId) {
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

      try {
        await Promise.allSettled([
          (async () => {
            if (activeSchoolId) {
              if (selectedDate) {
                await fetchStudentsByDate(selectedDate);
              } else {
                const { data, error } = await supabase
                  .schema('public')
                  .from('students')
                  .select('*')
                  .eq('school_id', activeSchoolId)
                  .order('created_at', { ascending: false });

                if (error) console.error('[Students] Sync failed:', error.message);
                if (data) {
                  const mapped = data.map(mapStudentFromDB);
                  setStudents(mapped);
                  setAttendanceStudents(mapped);
                }
              }
            }
          })(),
          fetchAllStudents(),
          fetchTeachers(),
          fetchParents(),
          fetchStudentServiceStaff(),
          fetchClasses(),
          fetchTotalEarnings(),
          fetchEvents(),
          fetchStudentActivities(),
          fetchParentAnnouncements(),
          fetchLiveIntel()
        ]);
      } catch (err) {
        console.error('Core data sync fatal error:', err);
      }
    };

    void performCloudSync();
  }, [schoolId, selectedDate, requireSchoolId]);
'@

# Replace lines 1421 to 1482 (1-based index)
$result = $lines[0..1419] + $newBlock + $lines[1482..($lines.Length-1)]
$result | Set-Content -LiteralPath $path -Encoding UTF8
Write-Output "Lines 1421-1482 replaced."
