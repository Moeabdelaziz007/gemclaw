const fs = require('fs');
let file = fs.readFileSync('firebase.ts', 'utf8');

file = file.replace(
  /\} else \{\n\s+\/\/ SSR fallback\n\s+app = !getApps\(\)\.length \? initializeApp\(firebaseConfig\) : getApp\(\);\n\s+db = getFirestore\(app\);\n\s+auth = getAuth\(app\);\n\s+storage = getStorage\(app\);\n\}/,
  `} else {
  // SSR fallback
  // Only initialize if API key is present to prevent CI build failures
  if (firebaseConfig.apiKey) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } else {
    // Mock objects for CI environment build process where .env variables are missing
    console.warn('Firebase config missing (likely CI build). Using mocked SSR firebase instances.');
    app = {} as any;
    db = {} as any;
    auth = {} as any;
    storage = {} as any;
  }
}`
);

fs.writeFileSync('firebase.ts', file);
