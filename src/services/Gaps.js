Service Orchestrator Call Actual Implementation Status
firestoreService createPost ✅ Exists Works
firestoreService saveDraft ❌ Missing Falls back with correct toast
firestoreService getDraft ❌ Missing Fails quietly
firestoreService deleteDraft ❌ Missing Fails quietly
firestoreService publishToPlatform ❌ Missing Shows error
notificationsService sendNotification with coauthor ❌ Type missing Untyped notification
monetizationService spendCoins ✅ Exists Works
storageService uploadFileWithProgress ✅ Exists Works
searchService searchUsers ✅ Exists Works (if Algolia)
moderation moderatePost Cloud Function ❌ May be missing Fallback only on error
analytics predictPostPerformance Cloud Function ❌ May be missing Silent fail