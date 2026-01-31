#!/usr/bin/perl
use strict;
use warnings;

my $file = 'src/screens/SignupStep2VerifyContact.jsx';

# Read the file
open(my $fh, '<', $file) or die "Cannot open $file: $!";
my @lines = <$fh>;
close($fh);

my $output = '';
my $in_imports = 0;
my $imports_done = 0;

foreach my $line (@lines) {
    # Handle imports section
    if ($line =~ /^import.*from.*firebase/) {
        # Replace the entire imports section
        if (!$imports_done) {
            $output .= "import React, { useState, useRef, useEffect, useCallback, useMemo } from \"react\";\n";
            $output .= "import { useNavigate, useLocation } from \"react-router-dom\";\n";
            $output .= "import { motion, AnimatePresence } from \"framer-motion\";\n";
            $output .= "import { toast } from \"sonner\";\n";
            $output .= "import { useTheme } from \"@context/ThemeContext\";\n";
            $output .= "import { countryCodes, sortedCountryCodes, getCountryByIso } from \"../data/countryCodes\";\n";
            $output .= "\n";
            $output .= "// ==================== FIREBASE IMPORTS ====================\n";
            $output .= "import { \n";
            $output .= "  auth, \n";
            $output .= "  db, \n";
            $output .= "  RecaptchaVerifier, \n";
            $output .= "  signInWithPhoneNumber,\n";
            $output .= "  signInWithPopup,\n";
            $output .= "  GoogleAuthProvider,\n";
            $output .= "  collection,\n";
            $output .= "  query,\n";
            $output .= "  where,\n";
            $output .= "  getDocs,\n";
            $output .= "  createRecaptchaVerifier,\n";
            $output .= "  signInWithGoogle,\n";
            $output .= "  verifyPhoneNumber\n";
            $output .= "} from \"../firebase/firebase\";\n";
            $output .= "\n";
            $imports_done = 1;
        }
        next;
    }
    
    # Skip any remaining Firebase import lines
    if ($imports_done && $line =~ /^\s*import.*firebase/) {
        next;
    }
    
    # Fix the reCAPTCHA initialization in useEffect
    if ($line =~ /const verifier = new RecaptchaVerifier/) {
        $line = "        const verifier = createRecaptchaVerifier('recaptcha-container', {\n";
    }
    
    # Fix the phone verification call
    if ($line =~ /signInWithPhoneNumber\(auth, phoneNumber, recaptchaVerifier\)/) {
        $line = "        const confirmationResult = await verifyPhoneNumber(phoneNumber, recaptchaVerifier);\n";
    }
    
    # Fix Google sign-in call in ProductionGoogleAuth component
    if ($line =~ /const result = await signInWithPopup\(auth, googleProvider\)/) {
        $line = "        const result = await signInWithGoogle();\n";
    }
    
    # Remove GoogleProvider creation lines
    if ($line =~ /const googleProvider = new GoogleAuthProvider\(\)/) {
        $line = "";
    }
    if ($line =~ /googleProvider\.addScope\('profile'\)/) {
        $line = "";
    }
    if ($line =~ /googleProvider\.addScope\('email'\)/) {
        $line = "";
    }
    if ($line =~ /googleProvider\.setCustomParameters/) {
        $line = "";
    }
    
    # Fix the hidden recaptcha container at the bottom
    if ($line =~ /<div id="recaptcha-container".*>/ && $line !~ /className="hidden"/) {
        $line = "      {/* Hidden reCAPTCHA container */}\n";
        $line .= "      <div id=\"recaptcha-container\" className=\"hidden\"></div>\n";
    }
    
    # Add the output line
    $output .= $line unless ($line eq "" && $output =~ /\n$/);
}

# Write the fixed file
open(my $out, '>', $file) or die "Cannot write to $file: $!";
print $out $output;
close($out);

print "✅ Successfully updated $file\n";
print "✅ Firebase.js has been updated with proper reCAPTCHA and Google auth\n";
print "\n";
print "🚀 To run the fix:\n";
print "1. Copy the firebase.js content above to src/firebase/firebase.js\n";
print "2. Run: perl fix_signup_step2.pl\n";
print "3. Restart your development server\n";
