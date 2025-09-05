# Project chat history and decisions

Date: 2025-09-05

Purpose: Keep a lightweight, append-only summary of our discussions, decisions, and progress for this app (a Thingiverse-like platform backed by Firebase).

## Goals
- Users upload, preview (live 3D), share, discover, and download 3D printing files.
- Galleries (Home/Explore) show models with reliable cover images.
- Model page shows live 3D preview and a list of all files; clicking a file switches the preview.
- Secure auth, safe storage rules, PWA-ready, analytics later.

## Tech stack
- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS.
- 3D: three, @react-three/fiber, @react-three/drei; custom ModelViewer (generateThumbnail/captureFrame APIs).
- Firebase v10: Auth (Google), Firestore, Storage.

## Key decisions
- Thumbnails: Use a static JPEG snapshot from the live viewer or an uploaded image. Dropped GIF/video conversion for stability and speed.
- Firestore queries use fallbacks when composite indexes are missing, so Explore/Home still load.
- CORS configured on the actual Storage bucket to fix upload and cover snapshot issues.

## Implemented
- Upload flow: multi-file selection, progress, and guaranteed cover image upload.
- Explore and Home pages: list latest/popular public models; cards link to model pages via slug.
- Model detail page: live 3D preview for 3D files (STL/OBJ/3MF), image preview for images, and clickable file list to switch active preview.
- README: full setup (env, Firebase, rules, CORS), run/build/deploy, GitHub steps, troubleshooting.

## Security and rules
- Storage rules (summary):
  - Public reads for uploaded files and thumbnails.
  - Writes allowed only for the signed-in owner path: uploads/{uid}/... and thumbnails/{uid}/...
- Buckets:
  - Web endpoint: <project-id>.firebasestorage.app
  - gsutil bucket name: gs://<project-id>.appspot.com

## Pages and data
- Upload: accepts .stl, .obj, .3mf, and images (.png/.jpg/.jpeg/.webp). Generates and uploads `cover.jpg` if needed.
- Explore/Home: query public models; fallback to index-safe queries when missing composite indexes.
- Model [slug]: fetch by slug; default to first 3D file for live preview; sidebar lists all files.

## Pending / next steps
- Create Firestore composite indexes for performance: (visibility asc, createdAt desc) and (visibility asc, stats.likes desc).
- Deep-link specific file in model page (query param/segment).
- "Download all" ZIP for a model.
- Likes/Save interactions with server-side counters.
- Add App Check for production.

## Short timeline (latest first)
- Simplified cover generation (static JPEG). Implemented model page with live 3D + file list. Updated README with Firebase/GitHub steps.
- Fixed Storage CORS on the correct bucket; stabilized viewer readiness and snapshot.
- Built upload page, Explore/Home galleries, and ModelViewer with capture APIs.

Notes: Append future sessions under a new dated heading. Keep lists concise for quick scanning.
