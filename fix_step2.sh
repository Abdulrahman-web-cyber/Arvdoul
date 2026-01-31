#!/bin/bash

FILE="src/screens/SignupStep2VerifyContact.jsx"
BACKUP="${FILE}.backup"

# Create backup
cp "$FILE" "$BACKUP"
echo "📁 Created backup: $BACKUP"

# Define the new imports
NEW_IMPORTS='import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext";
import { countryCodes, sortedCountryCodes, getCountryByIso } from "../data/countryCodes";

// ==================== FIREBASE IMPORTS ====================
import { 
  auth, 
  db, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider,
  collection,
  query,
  where,
  getDocs,
  createRecaptchaVerifier,
  signInWithGoogle,
  verifyPhoneNumber
} from "../firebase/firebase";'

# Read the file and replace imports
TEMP_FILE="${FILE}.temp"

# Process the file
awk -v new_imports="$NEW_IMPORTS" '
BEGIN { imports_printed = 0; skip_imports = 0; }
/^import.*from.*firebase/ { 
  if (!imports_printed) {
    print new_imports;
    imports_printed = 1;
  }
  skip_imports = 1;
  next;
}
/^import/ && skip_imports { next; }
!/^import/ { skip_imports = 0; }

# Fix reCAPTCHA initialization
/const verifier = new RecaptchaVerifier/ {
  gsub(/const verifier = new RecaptchaVerifier\(recaptchaContainerRef\.current/, "const verifier = createRecaptchaVerifier('\''recaptcha-container'\''");
  print $0;
  next;
}

# Fix phone verification call
/signInWithPhoneNumber\(auth, phoneNumber, recaptchaVerifier\)/ {
  gsub(/signInWithPhoneNumber\(auth, phoneNumber, recaptchaVerifier\)/, "verifyPhoneNumber(phoneNumber, recaptchaVerifier)");
  print $0;
  next;
}

# Fix Google sign-in
/const result = await signInWithPopup\(auth, googleProvider\)/ {
  print "        const result = await signInWithGoogle();";
  next;
}

# Remove Google provider setup lines
/googleProvider = new GoogleAuthProvider\(\)/ { next; }
/googleProvider\.addScope/ { next; }
/googleProvider\.setCustomParameters/ { next; }

# Add hidden class to recaptcha container
/<div id="recaptcha-container".*>/ && !/className="hidden"/ {
  print "      {/* Hidden reCAPTCHA container */}";
  print "      <div id=\"recaptcha-container\" className=\"hidden\"></div>";
  next;
}

{ print $0; }
' "$FILE" > "$TEMP_FILE"

# Replace the original file
mv "$TEMP_FILE" "$FILE"

echo "✅ Successfully updated $FILE"
echo "✅ Fixed:"
echo "   - Firebase imports"
echo "   - reCAPTCHA initialization"
echo "   - Phone verification call"
echo "   - Google sign-in method"
echo ""
echo "🔄 Restart your development server to apply changes"
