rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Posts
    match /posts/{postId} {
      allow read: if resource.data.visibility == 'public' ||
                   (request.auth != null && resource.data.authorId == request.auth.uid) ||
                   (request.auth != null && resource.data.visibility == 'followers' && exists(/databases/$(database)/documents/follows/$(request.auth.uid)_$(resource.data.authorId)));
      allow create: if request.auth != null && request.auth.uid == request.resource.data.authorId;
      allow update: if request.auth != null && request.auth.uid == resource.data.authorId;
      allow delete: if false;

      // Subcollections
      match /likes/{userId} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
      match /saves/{userId} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
      match /shares/{userId} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
      match /reactions/{userId} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
      match /{shardedCollection}/{shard} {
        allow read: if true;
        allow write: if request.auth != null;
      }
      match /views_daily/{date} {
        allow read: if true;
        allow create, update: if request.auth != null;
      }
    }

    // Blocks
    match /blocks/{blockId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == blockId.split('_')[0];
    }

    // User post counts (sharded)
    match /user_post_counts/{userId}/shards/{shard} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Gift transactions
    match /gift_transactions/{txId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }

    // Post reports
    match /post_reports/{reportId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null && (resource.data.userId == request.auth.uid || request.auth.token.admin == true);
    }

    // Users
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}