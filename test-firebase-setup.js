// Test script to verify Firebase setup
console.log("Testing Firebase configuration...\n");

const envVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID"
];

console.log("Checking environment variables:");
envVars.forEach(key => {
  const value = process.env[key] || import.meta.env?.[key];
  console.log(`  ${key}: ${value ? "✓ Set" : "✗ Missing"}`);
  if (value) {
    console.log(`    Value: ${value.substring(0, 10)}... (${value.length} chars)`);
  }
});

console.log("\nInstructions:");
console.log("1. Go to Firebase Console: https://console.firebase.google.com/");
console.log("2. Create a new project or select existing one");
console.log("3. Go to Project Settings > General");
console.log("4. Scroll down to 'Your apps' section");
console.log("5. Register a web app (if not done already)");
console.log("6. Copy the configuration object");
console.log("7. Update your .env.local file with the values");
console.log("\nExample .env.local file:");
console.log(`
VITE_FIREBASE_API_KEY="AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ123456"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef123456"
`);
