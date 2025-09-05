# share4print

Thingiverse-like platform to upload, preview, discover, and download 3D printing models. Next.js + Firebase + Three.js.

## Stack
- Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Firebase v10: Auth, Firestore, Storage (Hosting optional)
- Three.js via @react-three/fiber and @react-three/drei

## Features
- Upload multiple files per model (STL/OBJ/3MF/images)
- Live 3D preview and auto snapshot cover (JPEG)
- Explore and Home galleries (Latest, Popular)
- Model page with 3D preview and file list selector

## 1) Local setup
1. Node.js 18+.
2. Install deps and run dev server:
	 - npm install
	 - npm run dev
3. Create `.env.local` in the project root with your Firebase values:
```
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=share4print-33e99.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```
Replace values with your Firebase console values. Storage bucket should match the actual bucket shown in the Firebase console or `gsutil ls`.

Optional (dev only):
```
NEXT_PUBLIC_USE_AUTH_EMULATOR=false
NEXT_PUBLIC_USE_FIRESTORE_EMULATOR=false
NEXT_PUBLIC_USE_STORAGE_EMULATOR=false
```

## 2) Firebase configuration
Create a Firebase project (console.firebase.google.com) and enable:
- Authentication → Sign-in method → Google
- Firestore Database → Native mode
- Storage → default bucket

### Firestore indexes (recommended)
Create composite indexes when prompted for queries:
- collection: models | fields: visibility (ASC), createdAt (DESC)
- collection: models | fields: visibility (ASC), stats.likes (DESC)

### Storage rules
File: `firebase/storage.rules` (already included):
```
rules_version = '2';
service firebase.storage {
	match /b/{bucket}/o {
		function isSignedIn() { return request.auth != null; }

		match /uploads/{uid}/{modelId}/{version}/{allPaths=**} {
			allow read: if true; // public downloads
			allow write: if isSignedIn() && request.auth.uid == uid;
		}

		match /thumbnails/{uid}/{modelId}/{fileName} {
			allow read: if true;
			allow write: if isSignedIn() && request.auth.uid == uid;
		}
	}
}
```
Deploy via Firebase CLI (optional):
- npm i -g firebase-tools
- firebase login
- firebase init (choose Firestore/Storage/Hosting as needed)
- firebase deploy --only storage

### Storage CORS (for resumable uploads)
File: `cors.json` (example):
```
[
	{
		"origin": ["http://localhost:3000", "http://localhost:3001", "https://YOUR_DOMAIN"],
		"method": ["GET", "POST", "PUT", "HEAD", "DELETE", "OPTIONS"],
		"responseHeader": [
			"Content-Type", "Authorization", "x-goog-resumable", "x-goog-meta-*, x-goog-upload-protocol", "x-goog-upload-command", "x-goog-upload-offset", "x-firebase-appcheck"
		],
		"maxAgeSeconds": 3600
	}
]
```
Apply to the correct bucket (use your bucket name):
```
gsutil cors set cors.json gs://share4print-33e99.firebasestorage.app
gsutil cors get gs://share4print-33e99.firebasestorage.app
```

## 3) Running
- Dev: `npm run dev` then open http://localhost:3000
- Build: `npm run build` and `npm start`

## 4) Deploying the web app
You can deploy to Vercel, Firebase Hosting, or any Node host. For Firebase Hosting:
1. firebase init hosting (link to project, set `out` or Next.js SSR per your plan)
2. firebase deploy --only hosting

Vercel: connect your repo, set environment vars in the dashboard, and deploy.

## 5) GitHub: first push
From the project root:
```
git init
git add .
git commit -m "Initial commit: share4print"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```
Add a `.gitignore` (Next.js defaults) and ensure `.env.local` is NOT committed.

## 6) Usage
- Sign in (Google) → Upload → choose files (STL/OBJ/3MF/images).
- A cover is auto-generated (snapshot) or you can upload an image.
- After upload, the model appears in Explore and on the Home page.
- Click a card to open the model page with a live 3D preview and file list.

## 7) Troubleshooting
- Cover missing: ensure CORS set on the real bucket and Storage rules deployed.
- Not visible in Explore: check `visibility: "public"` and `createdAt` exists. Create Firestore indexes when prompted.
- App Check: keep disabled for dev, or set a real site key and register a debug token.

## License
MVP for demonstration purposes.
