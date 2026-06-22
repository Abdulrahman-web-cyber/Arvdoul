#!/bin/bash

# ============================================================
# 🚀 Arvdoul Firebase Deployment Script
# ============================================================
# This script deploys Firestore rules, indexes, and Cloud Functions
# to your Firebase project.
#
# Usage:
#   ./deploy.sh [options]
#
# Options:
#   --rules-only       Deploy only Firestore security rules
#   --indexes-only    Deploy only Firestore indexes
#   --functions-only  Deploy only Cloud Functions
#   --all             Deploy everything (default)
#   --dry-run         Show what would be deployed without deploying
#   --help            Show this help message
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="arvdoul-8057b"
RULES_FILE="firestore.rules"
INDEXES_FILE="firestore.indexes.json"
FUNCTIONS_DIR="functions"

# Parse arguments
DEPLOY_RULES=true
DEPLOY_INDEXES=true
DEPLOY_FUNCTIONS=true
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --rules-only)
            DEPLOY_RULES=true
            DEPLOY_INDEXES=false
            DEPLOY_FUNCTIONS=false
            shift
            ;;
        --indexes-only)
            DEPLOY_RULES=false
            DEPLOY_INDEXES=true
            DEPLOY_FUNCTIONS=false
            shift
            ;;
        --functions-only)
            DEPLOY_RULES=false
            DEPLOY_INDEXES=false
            DEPLOY_FUNCTIONS=true
            shift
            ;;
        --all)
            DEPLOY_RULES=true
            DEPLOY_INDEXES=true
            DEPLOY_FUNCTIONS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Arvdoul Firebase Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  --rules-only       Deploy only Firestore security rules"
            echo "  --indexes-only    Deploy only Firestore indexes"
            echo "  --functions-only  Deploy only Cloud Functions"
            echo "  --all             Deploy everything (default)"
            echo "  --dry-run         Show what would be deployed without deploying"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if firebase CLI is installed
check_firebase_cli() {
    if ! command -v firebase &> /dev/null; then
        print_error "Firebase CLI is not installed!"
        echo "Please install it with: npm install -g firebase-tools"
        exit 1
    fi
    
    # Check if logged in
    if ! firebase projects:list &> /dev/null; then
        print_error "Not logged in to Firebase. Please run: firebase login"
        exit 1
    fi
    
    print_success "Firebase CLI is ready"
}

# Deploy Firestore Rules
deploy_rules() {
    print_step "Deploying Firestore Security Rules..."
    
    if [ "$DRY_RUN" = true ]; then
        echo "Would deploy rules from: $RULES_FILE"
        echo "Would set rules_version to: 2"
        return
    fi
    
    firebase deploy --only firestore:rules --project "$PROJECT_ID"
    
    if [ $? -eq 0 ]; then
        print_success "Firestore rules deployed successfully!"
    else
        print_error "Failed to deploy Firestore rules"
        return 1
    fi
}

# Deploy Firestore Indexes
deploy_indexes() {
    print_step "Deploying Firestore Composite Indexes..."
    
    if [ "$DRY_RUN" = true ]; then
        echo "Would deploy indexes from: $INDEXES_FILE"
        echo "This includes indexes for:"
        echo "  - posts (10+ indexes)"
        echo "  - comments (5+ indexes)"
        echo "  - users (2+ indexes)"
        echo "  - notifications (2+ indexes)"
        echo "  - conversations (3+ indexes)"
        echo "  - messages (2+ indexes)"
        echo "  - videos (6+ indexes)"
        echo "  - stories, follows, coin_transactions, etc."
        return
    fi
    
    firebase deploy --only firestore:indexes --project "$PROJECT_ID"
    
    if [ $? -eq 0 ]; then
        print_success "Firestore indexes deployed successfully!"
    else
        print_error "Failed to deploy Firestore indexes"
        return 1
    fi
}

# Deploy Cloud Functions
deploy_functions() {
    print_step "Deploying Cloud Functions..."
    
    if [ ! -d "$FUNCTIONS_DIR" ]; then
        print_error "Functions directory not found: $FUNCTIONS_DIR"
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        echo "Would deploy functions from: $FUNCTIONS_DIR"
        echo "Functions to be deployed:"
        echo "  - addCoins (HTTP callable)"
        echo "  - spendCoins (HTTP callable)"
        echo "  - transferCoins (HTTP callable)"
        echo "  - sendPushNotification (HTTP callable)"
        echo "  - sendEmailNotification (HTTP callable)"
        echo "  - verifyPurchase (HTTP callable)"
        echo "  - awardCoinsOnNotificationRead (Firestore trigger)"
        echo "  - cleanupExpiredStories (Scheduled)"
        echo "  - processVideo (Storage trigger)"
        echo "  - updateVideoRankingScores (Scheduled)"
        echo "  - cleanupSoftDeletedVideos (Scheduled)"
        echo "  - cleanupRateLimits (Scheduled)"
        return
    fi
    
    # Install dependencies first
    print_step "Installing function dependencies..."
    cd "$FUNCTIONS_DIR"
    npm install
    cd ..
    
    # Deploy functions
    firebase deploy --only functions --project "$PROJECT_ID"
    
    if [ $? -eq 0 ]; then
        print_success "Cloud Functions deployed successfully!"
    else
        print_error "Failed to deploy Cloud Functions"
        return 1
    fi
}

# Verify deployment
verify_deployment() {
    print_step "Verifying deployment..."
    
    # List deployed rules
    print_step "Current Firestore rules:"
    firebase firestore:rules:show --project "$PROJECT_ID" | head -20
    
    # List functions
    print_step "Deployed Cloud Functions:"
    firebase functions:list --project "$PROJECT_ID" 2>/dev/null || echo "Could not list functions"
}

# Main execution
main() {
    print_header "🚀 Arvdoul Firebase Deployment"
    
    echo "Project ID: $PROJECT_ID"
    echo "Configuration:"
    echo "  - Deploy Rules: $DEPLOY_RULES"
    echo "  - Deploy Indexes: $DEPLOY_INDEXES"
    echo "  - Deploy Functions: $DEPLOY_FUNCTIONS"
    echo "  - Dry Run: $DRY_RUN"
    echo ""
    
    # Check prerequisites
    if [ "$DRY_RUN" = false ]; then
        check_firebase_cli
    fi
    
    # Deploy in order
    if [ "$DEPLOY_RULES" = true ]; then
        deploy_rules || exit 1
    fi
    
    if [ "$DEPLOY_INDEXES" = true ]; then
        deploy_indexes || exit 1
    fi
    
    if [ "$DEPLOY_FUNCTIONS" = true ]; then
        deploy_functions || exit 1
    fi
    
    # Verify if not dry run
    if [ "$DRY_RUN" = false ]; then
        verify_deployment
    fi
    
    print_header "✅ Deployment Complete!"
    
    echo ""
    echo "Next steps:"
    echo "  1. Test your application"
    echo "  2. Monitor Cloud Functions logs in Firebase Console"
    echo "  3. Verify Firestore rules are working correctly"
    echo ""
    echo "For more information, visit: https://console.firebase.google.com/project/$PROJECT_ID"
}

# Run main
main
