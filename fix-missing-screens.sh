#!/bin/bash

echo "🔍 Scanning AppRoutes for missing screens..."

ROUTES_FILE="src/routes/AppRoutes.jsx"
SCREEN_DIR="src/screens"

mkdir -p "$SCREEN_DIR"

# Extract all screen imports
grep -oE '\.\./screens/[A-Za-z0-9]+\.jsx' "$ROUTES_FILE" | sort | uniq | while read -r path; do

  # Convert path -> filename
  filename=$(basename "$path")
  fullpath="$SCREEN_DIR/$filename"

  if [ ! -f "$fullpath" ]; then
    name=$(basename "$filename" .jsx)

    echo "❌ Missing: $filename → Creating placeholder..."

    cat > "$fullpath" <<EOL
import React from "react";

export default function ${name}() {
  return (
    <div style={{
      display: "flex",
      height: "100vh",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "20px",
      fontWeight: "bold"
    }}>
      ${name} Screen (Placeholder)
    </div>
  );
}
EOL

    echo "✅ Created: $filename"
  else
    echo "✔ Exists: $filename"
  fi

done

echo "🚀 Done. All missing screens are now created."
