const fs = require('fs');
fetch("https://lzlhsmtkkcpomabqaqdu.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6bGhzbXRra2Nwb21hYnFhcWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTc0ODksImV4cCI6MjA4NTY5MzQ4OX0.Tmday5nk3oElp1UMZCjeTfLBefw4oOLBOIfcAb__DYE")
  .then(res => res.json())
  .then(data => {
    if (data.definitions && data.definitions.homework_assignments) {
        fs.writeFileSync('schema-homework.txt', JSON.stringify(Object.keys(data.definitions.homework_assignments.properties), null, 2));
    } else {
        fs.writeFileSync('schema-homework.txt', "No homework_assignments table found");
    }
  });
