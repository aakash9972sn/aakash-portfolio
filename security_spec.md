# Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}` and its subcollections (`bookmarks`, `testAttempts`, `orders`) belongs solely to the authenticated, email-verified user whose `request.auth.uid == userId`.
2. **Master Gate on Subcollections**: Subcollection documents under `/users/{userId}/...` cannot be created or updated unless the parent `/users/{userId}` document already exists and has `data.uid == request.auth.uid`.
3. **Immutable Identity & Creation Timestamps**: `uid` and `createdAt` must be set accurately on creation (`uid == request.auth.uid`, `createdAt == request.time`) and can never change on update.
4. **Server Timestamps Only**: `createdAt` and `updatedAt` must equal `request.time`.
5. **Bounded Payloads & Safe IDs**: Every document ID (`userId`, `bookmarkId`, `attemptId`, `orderId`) must match `^[a-zA-Z0-9_\\-]+$` and have length `<= 128`. All strings enforce explicit `.size()` bounds (`photoURL <= 1000`, compressed `photoDataUrl <= 150000` matching `data:image/(jpeg|png|webp);base64,...`). No shadow/arbitrary keys are allowed (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read of `/users/userA`.
2. Cross-user read of `/users/userA` or `/users/userA/bookmarks/home` signed in as `userB`.
3. Unverified email (`email_verified: false`) attempting to create `/users/userA`.
4. Identity spoofing: `userB` writing `uid: "userA"` into `/users/userB`.
5. Shadow field injection on create: `/users/userA` with extra field `isAdmin: true`.
6. Shadow field injection on update: updating `/users/userA` with `role: "admin"`.
7. Client-forged timestamp on create: `createdAt: Timestamp(2020-01-01)`.
8. Mutating immutable `createdAt` on update.
9. Orphaned bookmark write: creating `/users/userA/bookmarks/home` when `/users/userA` does not exist.
10. ID poisoning: creating `/users/userA/bookmarks/bad..slash` or a 500-char document ID.
11. Value poisoning: creating a bookmark with a 2000-character `title` or non-string `url`.
12. Unconstrained list query on `/users` collection (no `allow list` on `/users` at all).
