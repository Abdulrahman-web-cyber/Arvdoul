#!/data/data/com.termux/files/usr/bin/env bash
# APEX FIXER - Pure Bash, No Dependencies
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[FIXER]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# ============================================================================
# MAIN FIX FUNCTIONS
# ============================================================================

fix_stray_text() {
    local file="$1"
    local line="$2"
    local text="$3"
    
    if [[ ! -f "$file" ]]; then
        warning "File not found: $file"
        return 1
    fi
    
    # Create backup
    backup_file "$file"
    
    # Read file
    local content
    content=$(cat "$file")
    local lines=()
    IFS=$'\n' read -rd '' -a lines <<< "$content" || true
    
    if [[ $line -le ${#lines[@]} ]]; then
        local idx=$((line - 1))
        local original="${lines[$idx]}"
        
        # Only fix if not already a comment
        if [[ ! "$original" =~ ^[[:space:]]*// ]] && [[ ! "$original" =~ ^[[:space:]]*/\* ]]; then
            # Preserve indentation
            local spaces="${original%%[^[:space:]]*}"
            lines[$idx]="${spaces}// APEX: Fixed stray text - ${text}"
            
            # Write back
            printf "%s\n" "${lines[@]}" > "$file"
            success "Fixed stray text in $file (line $line)"
            return 0
        else
            warning "Line $line already commented in $file"
            return 1
        fi
    else
        warning "Line $line not found in $file"
        return 1
    fi
}

fix_template_literals() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        warning "File not found: $file"
        return 1
    fi
    
    # Check if file has template literal issues
    if grep -q 'className={[^}]*\$[^}]*}' "$file" 2>/dev/null; then
        backup_file "$file"
        
        # Fix: className={something ${x} something} -> className={`something ${x} something`}
        sed -i 's/className={\([^}]*\)\$\([^}]*\)}/className={`\1$\2`}/g' "$file" 2>/dev/null || true
        
        # Also fix other patterns
        sed -i 's/className={[[:space:]]*\([^{}]*\)\$\({[^}]*}\)[[:space:]]*\([^{}]*\)}/className={`\1$\2\3`}/g' "$file" 2>/dev/null || true
        
        success "Fixed template literals in $file"
        return 0
    else
        warning "No template literal issues found in $file"
        return 1
    fi
}

fix_missing_react_import() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        warning "File not found: $file"
        return 1
    fi
    
    # Check if it's a JSX file
    if [[ "$file" != *.jsx ]] && [[ "$file" != *.tsx ]]; then
        return 0
    fi
    
    # Check if file has JSX
    if grep -q '<' "$file" && grep -q '>' "$file"; then
        # Check if React import exists
        if ! grep -q "import React" "$file" && ! grep -q "from 'react'" "$file" && ! grep -q 'from "react"' "$file"; then
            backup_file "$file"
            
            # Add React import after any existing imports or at the top
            local content
            content=$(cat "$file")
            
            # Find the line after the last import
            local import_line=-1
            local line_num=0
            while IFS= read -r line; do
                if [[ "$line" =~ ^import ]]; then
                    import_line=$line_num
                fi
                line_num=$((line_num + 1))
            done <<< "$content"
            
            # Insert React import
            if [[ $import_line -ge 0 ]]; then
                # Insert after last import
                awk -v n=$((import_line + 2)) -v s="import React from 'react';" 'NR == n {print s} {print}' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
            else
                # Insert at the beginning
                echo "import React from 'react';" > "${file}.tmp"
                cat "$file" >> "${file}.tmp"
                mv "${file}.tmp" "$file"
            fi
            
            success "Added React import to $file"
            return 0
        fi
    fi
    
    return 0
}

fix_missing_default_export() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        warning "File not found: $file"
        return 1
    fi
    
    # Check if it's an App component file
    if [[ ! "$file" =~ App\.(js|jsx)$ ]] && ! grep -q "function App\|const App\|class App" "$file"; then
        return 0
    fi
    
    # Check if default export exists
    if ! grep -q "export default" "$file"; then
        backup_file "$file"
        
        # Add default export at the end
        echo "" >> "$file"
        echo "export default App;" >> "$file"
        
        success "Added default export to $file"
        return 0
    fi
    
    return 0
}

fix_missing_files() {
    local type="$1"
    
    case "$type" in
        "package.json")
            if [[ ! -f "package.json" ]]; then
                log "Creating package.json..."
                cat > package.json << PKG_JSON
{
  "name": "arvdoul",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "firebase": "^10.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.4.0"
  }
}
PKG_JSON
                success "Created package.json"
                return 0
            fi
            ;;
            
        "index.html")
            if [[ ! -f "index.html" ]]; then
                log "Creating index.html..."
                cat > index.html << HTML
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Arvdoul</title>
    <style>
      #root {
        max-width: 1280px;
        margin: 0 auto;
        padding: 2rem;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
HTML
                success "Created index.html"
                return 0
            else
                # Check if root div exists
                if ! grep -q 'id="root"' index.html && ! grep -q 'id="app"' index.html; then
                    backup_file "index.html"
                    # Add root div before closing body tag
                    sed -i 's|</body>|    <div id="root"></div>\n</body>|' index.html
                    success "Added root div to index.html"
                    return 0
                fi
            fi
            ;;
            
        "main.jsx")
            if [[ ! -f "src/main.jsx" ]] && [[ ! -f "main.jsx" ]] && [[ ! -f "src/index.jsx" ]] && [[ ! -f "index.jsx" ]]; then
                log "Creating main.jsx..."
                mkdir -p src
                cat > src/main.jsx << MAIN_JSX
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
MAIN_JSX
                success "Created src/main.jsx"
                return 0
            fi
            ;;
            
        "App.jsx")
            if [[ ! -f "src/App.jsx" ]] && [[ ! -f "App.jsx" ]]; then
                log "Creating App.jsx..."
                mkdir -p src
                cat > src/App.jsx << APP_JSX
import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Arvdoul Application</h1>
      <p>Your application is now working!</p>
    </div>
  );
}

export default App;
APP_JSX
                success "Created src/App.jsx"
                return 0
            fi
            ;;
    esac
    
    return 1
}

backup_file() {
    local file="$1"
    local backup_dir="$APEX_HOME/backups/$(date +%Y%m%d_%H%M%S)"
    
    mkdir -p "$backup_dir"
    local backup_path="$backup_dir/$(basename "$file")"
    
    if cp "$file" "$backup_path" 2>/dev/null; then
        log "Backup created: $backup_path"
    else
        warning "Could not create backup for $file"
    fi
}

# ============================================================================
# SCAN FUNCTION
# ============================================================================
scan_project() {
    echo ""
    echo "🔍 APEX - Scanning for blank screen causes..."
    echo "============================================="
    echo ""
    
    local issues=()
    local critical_issues=()
    
    # 1. Check package.json
    if [[ ! -f "package.json" ]]; then
        critical_issues+=("missing_package_json:No package.json - project cannot build")
    else
        # Check for React
        if ! grep -q '"react"' package.json; then
            issues+=("missing_react_dep:React not in package.json dependencies")
        fi
        
        # Check for build script
        if ! grep -q '"build"' package.json; then
            issues+=("missing_build_script:No build script in package.json")
        fi
    fi
    
    # 2. Check index.html
    if [[ ! -f "index.html" ]]; then
        critical_issues+=("missing_index_html:No index.html - browser has nothing to show")
    else
        if ! grep -q 'id="root"' index.html && ! grep -q 'id="app"' index.html; then
            critical_issues+=("missing_root_div:No root div (id='root' or id='app') in index.html")
        fi
        
        if ! grep -q '<script type="module"' index.html; then
            issues+=("missing_script_tag:No script tag in index.html")
        fi
    fi
    
    # 3. Find main entry
    local found_main=false
    for file in "src/main.jsx" "src/main.js" "main.jsx" "main.js" "src/index.jsx" "src/index.js"; do
        if [[ -f "$file" ]]; then
            found_main=true
            log "Found main entry: $file"
            
            # Check for ReactDOM
            if ! grep -q "ReactDOM" "$file" && ! grep -q "createRoot" "$file"; then
                critical_issues+=("missing_reactdom_render:Missing ReactDOM.render in $file")
            fi
            
            # Check for stray text (like "Core Providers")
            if grep -q "^[[:space:]]*Core Providers" "$file"; then
                critical_issues+=("stray_text_core_providers:Found 'Core Providers' text in $file")
            fi
            
            # Check for other stray text patterns
            if grep -n "^[[:space:]]*[A-Z][a-z]\+[[:space:]]\+[A-Z][a-z]\+" "$file" | grep -v "import\|export\|function\|const\|let\|var\|class" | grep -v "//\|/\*"; then
                issues+=("stray_text_generic:Found stray text in $file")
            fi
            
            # Check for template literal issues
            if grep -q 'className={[^}]*\$[^}]*}' "$file"; then
                issues+=("template_literal_issue:Template literal syntax error in $file")
            fi
            break
        fi
    done
    
    if [[ "$found_main" == false ]]; then
        critical_issues+=("missing_entry_file:No main entry file found (main.jsx, index.js, etc.)")
    fi
    
    # 4. Find App component
    local found_app=false
    for file in "src/App.jsx" "src/App.js" "App.jsx" "App.js"; do
        if [[ -f "$file" ]]; then
            found_app=true
            log "Found App component: $file"
            
            # Check for default export
            if ! grep -q "export default" "$file"; then
                issues+=("missing_default_export:Missing default export in $file")
            fi
            
            # Check for React import in JSX files
            if [[ "$file" == *.jsx ]] || [[ "$file" == *.tsx ]]; then
                if grep -q '<' "$file" && ! grep -q "import React" "$file"; then
                    issues+=("missing_react_import:Missing React import in $file")
                fi
            fi
            break
        fi
    done
    
    if [[ "$found_app" == false ]]; then
        critical_issues+=("missing_app_component:No App component found")
    fi
    
    # 5. Scan all JS/JSX files for stray text
    echo ""
    echo "📄 Scanning JS/JSX files..."
    while IFS= read -r -d '' file; do
        # Check for stray text pattern
        while IFS= read -r line; do
            if [[ "$line" =~ ^[[:space:]]*[A-Z][a-z]+[[:space:]]+[A-Z][a-z]+[[:space:]]*$ ]] && \
               [[ ! "$line" =~ ^[[:space:]]*// ]] && \
               [[ ! "$line" =~ ^[[:space:]]*/\* ]] && \
               [[ ! "$line" =~ import ]] && \
               [[ ! "$line" =~ export ]] && \
               [[ ! "$line" =~ function ]] && \
               [[ ! "$line" =~ const ]] && \
               [[ ! "$line" =~ let ]] && \
               [[ ! "$line" =~ var ]] && \
               [[ ! "$line" =~ class ]] && \
               [[ ! "$line" =~ = ]] && \
               [[ ! "$line" =~ { ]] && \
               [[ ! "$line" =~ } ]]; then
                local line_num=$(grep -n "$line" "$file" | head -1 | cut -d: -f1)
                issues+=("stray_text_${file}:Stray text in $file:$line_num:'$line'")
            fi
        done < <(grep -n "^[[:space:]]*[A-Z][a-z]\+[[:space:]]\+[A-Z][a-z]\+" "$file" | cut -d: -f2-)
    done < <(find . -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/.ares*/*" -print0)
    
    # Display results
    echo ""
    echo "📊 SCAN RESULTS:"
    echo "================="
    echo ""
    
    if [[ ${#critical_issues[@]} -eq 0 ]] && [[ ${#issues[@]} -eq 0 ]]; then
        success "✅ No structural issues found!"
        echo ""
        echo "Your blank screen is likely due to:"
        echo "• Component logic errors"
        echo "• State management issues"
        echo "• API/async problems"
        echo "• CSS/display issues"
        echo ""
        echo "Check browser console for errors"
        return 0
    fi
    
    if [[ ${#critical_issues[@]} -gt 0 ]]; then
        echo "🚨 CRITICAL ISSUES (MUST FIX):"
        echo "-------------------------------"
        for issue in "${critical_issues[@]}"; do
            echo "❌ $(echo "$issue" | cut -d: -f2-)"
        done
        echo ""
    fi
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo "⚠️  OTHER ISSUES:"
        echo "-----------------"
        for issue in "${issues[@]:0:10}"; do  # Show first 10
            echo "• $(echo "$issue" | cut -d: -f2-)"
        done
        
        if [[ ${#issues[@]} -gt 10 ]]; then
            echo "... and $(( ${#issues[@]} - 10 )) more issues"
        fi
        echo ""
    fi
    
    # Save issues to file
    local report_file="$APEX_HOME/scan_report.txt"
    {
        echo "APEX Scan Report - $(date)"
        echo "============================="
        echo ""
        
        if [[ ${#critical_issues[@]} -gt 0 ]]; then
            echo "CRITICAL ISSUES:"
            for issue in "${critical_issues[@]}"; do
                echo "$issue"
            done
            echo ""
        fi
        
        if [[ ${#issues[@]} -gt 0 ]]; then
            echo "OTHER ISSUES:"
            for issue in "${issues[@]}"; do
                echo "$issue"
            done
        fi
    } > "$report_file"
    
    log "Full report saved: $report_file"
    
    echo ""
    echo "🎯 SUMMARY:"
    echo "-----------"
    echo "Critical issues: ${#critical_issues[@]}"
    echo "Other issues: ${#issues[@]}"
    echo ""
    
    if [[ ${#critical_issues[@]} -gt 0 ]]; then
        error "❌ CRITICAL ISSUES FOUND - These WILL cause blank screen"
        echo "Run: ./ares_apex fix to apply fixes"
    else
        warning "⚠️  Issues found but no critical ones"
        echo "Run: ./ares_apex fix to apply fixes"
    fi
    
    return 0
}

# ============================================================================
# FIX FUNCTION
# ============================================================================
fix_project() {
    echo ""
    echo "🔧 APEX - Applying fixes..."
    echo "==========================="
    echo ""
    
    # Check if scan was done
    if [[ ! -f "$APEX_HOME/scan_report.txt" ]]; then
        warning "No scan report found. Running scan first..."
        scan_project
    fi
    
    echo "⚠️  WARNING: This will modify your files"
    echo "✅ Backups will be created automatically"
    echo ""
    
    read -p "Continue? (yes/NO): " confirm
    if [[ "$confirm" != "yes" ]]; then
        warning "Operation cancelled"
        return 0
    fi
    
    local fixes_applied=0
    local fixes_failed=0
    
    # Read scan report and apply fixes
    if [[ -f "$APEX_HOME/scan_report.txt" ]]; then
        while IFS= read -r line; do
            if [[ "$line" == *"stray_text_core_providers:"* ]]; then
                local file=$(echo "$line" | cut -d: -f2)
                if fix_stray_text "$file" 1 "Core Providers"; then
                    fixes_applied=$((fixes_applied + 1))
                else
                    fixes_failed=$((fixes_failed + 1))
                fi
                
            elif [[ "$line" == *"stray_text_"* && "$line" == *":"* ]]; then
                local parts=$(echo "$line" | cut -d: -f2-)
                local file=$(echo "$parts" | cut -d: -f1)
                local line_num=$(echo "$parts" | cut -d: -f2)
                local text=$(echo "$parts" | cut -d: -f3-)
                
                if [[ -n "$file" && -n "$line_num" ]]; then
                    if fix_stray_text "$file" "$line_num" "$text"; then
                        fixes_applied=$((fixes_applied + 1))
                    else
                        fixes_failed=$((fixes_failed + 1))
                    fi
                fi
                
            elif [[ "$line" == *"template_literal_issue:"* ]]; then
                local file=$(echo "$line" | cut -d: -f2)
                if fix_template_literals "$file"; then
                    fixes_applied=$((fixes_applied + 1))
                else
                    fixes_failed=$((fixes_failed + 1))
                fi
                
            elif [[ "$line" == *"missing_react_import:"* ]]; then
                local file=$(echo "$line" | cut -d: -f2)
                if fix_missing_react_import "$file"; then
                    fixes_applied=$((fixes_applied + 1))
                else
                    fixes_failed=$((fixes_failed + 1))
                fi
                
            elif [[ "$line" == *"missing_default_export:"* ]]; then
                local file=$(echo "$line" | cut -d: -f2)
                if fix_missing_default_export "$file"; then
                    fixes_applied=$((fixes_applied + 1))
                else
                    fixes_failed=$((fixes_failed + 1))
                fi
                
            elif [[ "$line" == *"missing_package_json:"* ]]; then
                if fix_missing_files "package.json"; then
                    fixes_applied=$((fixes_applied + 1))
                else
                    fixes_failed=$((fixes_failed + 1))
                fi
                
            elif [[ "$line" == *"missing_index_html:"* ]] || [[ "$line" == *"missing_root_div:"* ]]; then
                if fix_missing_files "index.html"; then
                    fixes_applied=$((fixes_applied + 1))
                else
                    fixes_failed=$((fixes_failed + 1))
                fi
                
            elif [[ "$line" == *"missing_entry_file:"* ]]; then
                if fix_missing_files "main.jsx"; then
                    fixes_applied=$((fixes_applied + 1))
                else
                    fixes_failed=$((fixes_failed + 1))
                fi
                
            elif [[ "$line" == *"missing_app_component:"* ]]; then
                if fix_missing_files "App.jsx"; then
                    fixes_applied=$((fixes_applied + 1))
                else
                    fixes_failed=$((fixes_failed + 1))
                fi
            fi
        done < <(grep -E "stray_text_|template_literal_|missing_" "$APEX_HOME/scan_report.txt")
    fi
    
    # Also scan and fix all JS/JSX files for stray text proactively
    echo ""
    echo "🔍 Proactively scanning all JS/JSX files..."
    
    while IFS= read -r -d '' file; do
        # Fix stray text
        local line_num=1
        while IFS= read -r line; do
            if [[ "$line" =~ ^[[:space:]]*[A-Z][a-z]+[[:space:]]+[A-Z][a-z]+[[:space:]]*$ ]] && \
               [[ ! "$line" =~ ^[[:space:]]*// ]] && \
               [[ ! "$line" =~ ^[[:space:]]*/\* ]] && \
               [[ ! "$line" =~ import ]] && \
               [[ ! "$line" =~ export ]] && \
               [[ ! "$line" =~ function ]] && \
               [[ ! "$line" =~ const ]] && \
               [[ ! "$line" =~ let ]] && \
               [[ ! "$line" =~ var ]] && \
               [[ ! "$line" =~ class ]] && \
               [[ ! "$line" =~ = ]] && \
               [[ ! "$line" =~ { ]] && \
               [[ ! "$line" =~ } ]]; then
                
                local text=$(echo "$line" | xargs)
                if fix_stray_text "$file" "$line_num" "$text"; then
                    fixes_applied=$((fixes_applied + 1))
                fi
            fi
            line_num=$((line_num + 1))
        done < "$file"
        
        # Fix template literals
        if fix_template_literals "$file"; then
            fixes_applied=$((fixes_applied + 1))
        fi
        
        # Fix missing React imports in JSX files
        if [[ "$file" == *.jsx ]] || [[ "$file" == *.tsx ]]; then
            if fix_missing_react_import "$file"; then
                fixes_applied=$((fixes_applied + 1))
            fi
        fi
        
        # Fix missing default exports in App files
        if [[ "$file" =~ App\.(js|jsx)$ ]] || grep -q "function App\|const App\|class App" "$file"; then
            if fix_missing_default_export "$file"; then
                fixes_applied=$((fixes_applied + 1))
            fi
        fi
        
    done < <(find . -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/.ares*/*" -print0 2>/dev/null || true)
    
    echo ""
    echo "📊 FIX SUMMARY:"
    echo "---------------"
    echo "✅ Fixes applied: $fixes_applied"
    echo "❌ Fixes failed: $fixes_failed"
    echo ""
    
    if [[ $fixes_applied -gt 0 ]]; then
        success "Some fixes were applied!"
        echo ""
        echo "🚀 NEXT STEPS:"
        echo "1. Run: ./ares_apex build"
        echo "2. Check if blank screen is fixed"
        echo "3. If not, check browser console for errors"
    else
        warning "No fixes were applied"
        echo ""
        echo "Try:"
        echo "1. Check if files exist and are readable"
        echo "2. Run: ./ares_apex scan to see current issues"
    fi
    
    return 0
}

# ============================================================================
# VERIFY FUNCTION
# ============================================================================
verify_project() {
    echo ""
    echo "✅ APEX - Verifying project..."
    echo "==============================="
    echo ""
    
    local ok=true
    
    echo "1. Checking package.json..."
    if [[ -f "package.json" ]]; then
        echo "   ✅ Found package.json"
        
        if grep -q '"react"' package.json; then
            echo "   ✅ React in dependencies"
        else
            echo "   ❌ React not in dependencies"
            ok=false
        fi
        
        if grep -q '"build"' package.json; then
            echo "   ✅ Build script exists"
        else
            echo "   ❌ No build script"
            ok=false
        fi
    else
        echo "   ❌ Missing package.json"
        ok=false
    fi
    
    echo ""
    echo "2. Checking index.html..."
    if [[ -f "index.html" ]]; then
        echo "   ✅ Found index.html"
        
        if grep -q 'id="root"' index.html || grep -q 'id="app"' index.html; then
            echo "   ✅ Root div exists"
        else
            echo "   ❌ Missing root div"
            ok=false
        fi
        
        if grep -q '<script type="module"' index.html; then
            echo "   ✅ Script tag exists"
        else
            echo "   ❌ Missing script tag"
            ok=false
        fi
    else
        echo "   ❌ Missing index.html"
        ok=false
    fi
    
    echo ""
    echo "3. Checking main entry..."
    local found_entry=false
    for file in "src/main.jsx" "src/main.js" "main.jsx" "main.js"; do
        if [[ -f "$file" ]]; then
            found_entry=true
            echo "   ✅ Found: $file"
            
            if grep -q "ReactDOM" "$file" || grep -q "createRoot" "$file"; then
                echo "   ✅ ReactDOM.render exists"
            else
                echo "   ❌ Missing ReactDOM.render"
                ok=false
            fi
            
            # Check for stray text
            if grep -q "^[[:space:]]*Core Providers" "$file"; then
                echo "   ❌ Contains 'Core Providers' text"
                ok=false
            fi
            break
        fi
    done
    
    if [[ "$found_entry" == false ]]; then
        echo "   ❌ No main entry found"
        ok=false
    fi
    
    echo ""
    echo "4. Checking App component..."
    local found_app=false
    for file in "src/App.jsx" "src/App.js" "App.jsx" "App.js"; do
        if [[ -f "$file" ]]; then
            found_app=true
            echo "   ✅ Found: $file"
            
            if grep -q "export default" "$file"; then
                echo "   ✅ Has default export"
            else
                echo "   ❌ Missing default export"
                ok=false
            fi
            
            # Check for React import in JSX
            if [[ "$file" == *.jsx ]] || [[ "$file" == *.tsx ]]; then
                if grep -q "import React" "$file"; then
                    echo "   ✅ Has React import"
                else
                    echo "   ❌ Missing React import"
                    ok=false
                fi
            fi
            break
        fi
    done
    
    if [[ "$found_app" == false ]]; then
        echo "   ❌ No App component found"
        ok=false
    fi
    
    echo ""
    echo "=" .repeat(40)
    
    if [[ "$ok" == true ]]; then
        success "✅ VERIFICATION PASSED"
        echo ""
        echo "Project structure is correct."
        echo "Blank screen is likely due to:"
        echo "• Component logic errors"
        echo "• State management issues"
        echo "• API/async problems"
        echo "• CSS/display issues"
        echo ""
        echo "Check browser console for errors"
    else
        error "❌ VERIFICATION FAILED"
        echo ""
        echo "Run: ./ares_apex fix to apply fixes"
    fi
}

# ============================================================================
# BUILD FUNCTION
# ============================================================================
run_build() {
    echo ""
    echo "⚙️  APEX - Running build..."
    echo "==========================="
    echo ""
    
    if [[ ! -f "package.json" ]]; then
        error "No package.json found"
        echo ""
        echo "Run: ./ares_apex fix to create package.json"
        return 1
    fi
    
    echo "1. Checking dependencies..."
    if [[ ! -d "node_modules" ]]; then
        warning "node_modules not found, installing..."
        if npm install --no-audit --no-fund 2>&1; then
            success "Dependencies installed"
        else
            error "Failed to install dependencies"
            return 1
        fi
    else
        success "Dependencies already installed"
    fi
    
    echo ""
    echo "2. Running build..."
    echo ""
    
    if npm run build 2>&1; then
        success "✅ BUILD SUCCESSFUL!"
        echo ""
        
        if [[ -d "dist" ]]; then
            echo "Build output:"
            ls -la dist/
        fi
        
        echo ""
        echo "🎉 Your project builds successfully!"
        echo "If you still see a blank screen:"
        echo "1. Run: ./ares_apex dev"
        echo "2. Check browser console for errors"
        echo "3. Check component logic and state"
        
    else
        error "❌ BUILD FAILED"
        echo ""
        echo "Check the error output above"
        echo ""
        echo "Common build failures:"
        echo "• Syntax errors in JS files"
        echo "• Missing imports"
        echo "• Invalid JSX"
        echo "• Missing dependencies"
    fi
}

# ============================================================================
# DEV FUNCTION
# ============================================================================
run_dev() {
    echo ""
    echo "🚀 APEX - Starting dev server..."
    echo "================================="
    echo ""
    
    if [[ ! -f "package.json" ]]; then
        error "No package.json found"
        return 1
    fi
    
    if ! grep -q '"dev"' package.json; then
        error "No dev script in package.json"
        return 1
    fi
    
    echo "Starting development server..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    npm run dev
}

# ============================================================================
# MAIN
# ============================================================================
main() {
    local command="${1:-help}"
    
    case "$command" in
        scan)
            scan_project
            ;;
        fix)
            fix_project
            ;;
        verify)
            verify_project
            ;;
        build)
            run_build
            ;;
        dev)
            run_dev
            ;;
        help|--help|-h|"")
            echo ""
            echo "APEX v8.0 - Ultimate Blank Screen Fixer"
            echo "========================================"
            echo ""
            echo "Commands:"
            echo "  scan    - Find issues causing blank screen"
            echo "  fix     - Apply fixes (with backup)"
            echo "  verify  - Quick project verification"
            echo "  build   - Run build to verify"
            echo "  dev     - Start dev server"
            echo "  help    - Show this help"
            echo ""
            echo "Examples:"
            echo "  ./ares_apex scan    # Find issues"
            echo "  ./ares_apex fix     # Fix issues"
            echo "  ./ares_apex verify  # Check project"
            echo ""
            echo "What it fixes:"
            echo "• 'Core Providers' text in JS files"
            echo "• Template literal syntax errors"
            echo "• Missing React imports"
            echo "• Missing default exports"
            echo "• Missing package.json/index.html"
            echo "• Missing main.jsx/App.jsx"
            echo ""
            ;;
        *)
            error "Unknown command: $command"
            echo "Try: ./ares_apex help"
            exit 1
            ;;
    esac
}

# Run
main "$@"
