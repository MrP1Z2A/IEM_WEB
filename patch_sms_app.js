import fs from 'fs';

const path = 'src/sms/App.tsx';
let content = fs.readFileSync(path, 'utf8');

console.log('Original content length:', content.length);

// 1. Add StaffLogin import
if (!content.includes("import StaffLogin")) {
  content = content.replace(
    "import CreateSchoolPage from './components/CreateSchoolPage';",
    "import CreateSchoolPage from './components/CreateSchoolPage';\nimport StaffLogin from './components/StaffLogin';"
  );
}

// 2. Update onboardingStatus state type
content = content.replace(
  /'loading' \| 'needs-school' \| 'ready'/,
  "'loading' | 'needs-school' | 'needs-auth' | 'ready'"
);

// 3. Update handleLogout - using a simpler regex that matches after authService.signOut()
content = content.replace(
  /await authService\.signOut\(\);\s+if \(onSchoolIdChange\) onSchoolIdChange\(undefined\);\s+setOnboardingStatus\('needs-school'\);/,
  `await authService.signOut();
      
      // If student service, preserve school context but require re-auth
      if (isStudentService && schoolId) {
        setOnboardingStatus('needs-auth');
      } else {
        if (onSchoolIdChange) onSchoolIdChange(undefined);
        setOnboardingStatus('needs-school');
      }

      notify('Logged out successfully.');`
);

// 4. Update checkOnboarding
content = content.replace(
  /const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\);\s+if \(!user\) \{\s+setOnboardingStatus\('needs-school'\);\s+return;\s+\}/,
  `const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // If we have a school context in Student Service mode, require staff login
          if (isStudentService && schoolId) {
            setOnboardingStatus('needs-auth');
          } else {
            setOnboardingStatus('needs-school');
          }
          return;
        }`
);

// 5. Update render
content = content.replace(
  /if \(onboardingStatus === 'needs-school'\) \{[\s\S]+?return \([\s\S]+?\<CreateSchoolPage[\s\S]+?\/\>[\s\S]+?\);[\s\S]+?\}/,
  `if (onboardingStatus === 'needs-school') {
    return (
      <CreateSchoolPage
        onCreated={(id) => {
          if (onSchoolIdChange) onSchoolIdChange(id);
          setOnboardingStatus('ready');
        }}
      />
    );
  }

  if (onboardingStatus === 'needs-auth') {
    return (
      <StaffLogin 
        schoolName={schoolName}
        onLoginSuccess={() => setOnboardingStatus('loading')}
        onBackToSchoolSelect={() => {
          if (onSchoolIdChange) onSchoolIdChange(undefined);
          setOnboardingStatus('needs-school');
        }}
      />
    );
  }`
);

fs.writeFileSync(path, content);
console.log('Successfully patched src/sms/App.tsx');
console.log('New content length:', content.length);
