#!/bin/bash
echo "=== FILE-BY-FILE DIAGNOSTIC ==="
echo "Checking each file for syntax errors..."

# Create error report
ERROR_REPORT="syntax_errors_$(date +%s).txt"
echo "Syntax Error Report - $(date)" > "$ERROR_REPORT"

# Check each file
for file in $(find src -name "*.js" -o -name "*.jsx"); do
    if node -c "$file" 2>&1 | grep -q "SyntaxError"; then
        echo "❌ $file" | tee -a "$ERROR_REPORT"
        node -c "$file" 2>&1 | head -3 >> "$ERROR_REPORT"
        echo "---" >> "$ERROR_REPORT"
        
        # Show the problematic line
        echo "Problematic line(s):"
        node -c "$file" 2>&1 | grep -o ":[0-9]*:[0-9]*" | head -1 | while read linecol; do
            line=${linecol%:*}
            echo "Line $line:"
            sed -n "${line}p" "$file"
        done
        echo ""
    fi
done

echo "=== SUMMARY ==="
echo "Error report saved to: $ERROR_REPORT"
grep -c "❌" "$ERROR_REPORT" | xargs echo "Total files with errors:"
