#!/bin/bash

# Remove all SASS nesting and convert to valid CSS
awk '
BEGIN { in_nested = 0; nesting_level = 0 }

# Handle nested selectors starting with &:
/&[:\.#\[]/ {
    # Convert &:hover, &:focus, etc.
    gsub(/&:/, "")
    gsub(/&\./, ".")
    gsub(/&\[/, "[")
}

# Handle nested rules without & (like .primary inside .btn)
/^[[:space:]]*\.[a-zA-Z]/ && in_nested > 0 {
    # Remove the dot if it's a direct child
    gsub(/^[[:space:]]*\./, "& ")
}

# Count braces
/{/ { nesting_level++ }
/}/ { nesting_level-- }

# Print line
{ print }
' src/tailwind.css > src/tailwind.css.fixed

# Replace the original
mv src/tailwind.css.fixed src/tailwind.css
