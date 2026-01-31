#!/bin/bash
echo "🔧 Applying fixes to AuthContext.jsx..."

# Replace the problematic line with safe navigation
sed -i "41s/network: navigator.onLine,/network: typeof navigator !== 'undefined' ? navigator.onLine : true,/" src/context/AuthContext.jsx

# Also fix the requiresProfileCompletion variable issue
sed -i 's/requiresProfileCompletion,/requiresProfileCompletion: false,/' src/context/AuthContext.jsx

# Fix all other navigator.onLine occurrences in the file
sed -i "s/navigator.onLine/typeof navigator !== 'undefined' ? navigator.onLine : true/g" src/context/AuthContext.jsx

echo "✅ Fixes applied successfully!"
