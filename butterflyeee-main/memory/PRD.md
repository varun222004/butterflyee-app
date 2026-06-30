# Butterfly — Product Requirements Document

## Original Problem Statement
Butterfly is a private digital sanctuary shared between exactly two people. The app preserves appreciation, memories, voice notes, letters, surprises, and everyday moments inside a calm, timeless environment.

**Core philosophy**: every account is equal (no creator/visitor). You DO NOT edit your own world — you edit your buddy's world. The visual identity (midnight navy gradient, Cormorant Garamond serif, Caveat script accents, Manrope body, floating butterflies, glassmorphism cards, slim left icon rail) must be preserved exactly. Only the architecture changes.

## User Personas
- **Two paired humans** (any relationship — partners, friends, family) who want a small, private, shared space.

## Architecture (v1)

### Auth & Identity
- JWT-based email/password auth with bcrypt hashing.
- HttpOnly cookies (`access_token` + `refresh_token`). SameSite=None; Secure.
- Google OAuth designed for as a future drop-in (parallel provider).
- Every account auto-receives a unique **Buddy ID** (BTF-XXXX-XXXX, permanent) and a **@handle** (changeable, lowercase, unique, optional).

### Buddy Pairing
- "Connect With Buddy" page: enter buddy's @handle or BTF-ID → send request.
- Recipient sees magical incoming request, accepts/declines.
- Accepting creates a `pairs` record. Exactly one buddy per user.

### Three Worlds
- **My World** (`/my/*`): read-only; entries authored FOR me by my buddy.
- **Buddy's World** (`/buddy/*`): Studio mode; I write FOR my buddy.
- **Our World** (`/our/*`): shared; both can read/write.

### Rooms
- 10 personal rooms: appreciation, letters, memories, butterfly_lounge, good_night, dog_cafe, doctor_corner, achievements, surprises, secret_room.
- 2 shared rooms: shared_journal, bucket_list.
- Each room has a unique presentation (envelopes for letters, audio cards for voice notes, glass cards for notes, photo cards for memories, badge cards for achievements, etc.).
- Full CRUD via Studio mode.
- Scheduled publishing (`publish_at`), draft/scheduled/published/archived status, metadata bag for future fields.

### Media
- Object storage via Emergent storage API (audio + images, up to 25 MB).
- DB-backed file references with soft-delete.
- Files served through `/api/files/{path}` (cookie auth or query token).

## Backend Stack
- FastAPI, Motor (async MongoDB), PyJWT, bcrypt, pydantic v2.
- Modules: `auth.py`, `db.py`, `models.py`, `storage.py`, `utils.py`, `routes_auth.py`, `routes_buddy.py`, `routes_entries.py`, `routes_uploads.py`.

## Frontend Stack
- React 19 + react-router-dom 7.
- Tailwind + custom Butterfly CSS variables.
- Atmosphere components: Background (sky/stars/grain/butterflies/moon), IconRail, WorldSwitcher, AppShell.
- Pages: AuthPage, OnboardingPage, ConnectPage, HomePage, RoomPage (generic for all 12), SettingsPage.
- Sonner toasts wrapped in `magic.{whisper,butterfly,success,error}` for emotionally consistent notifications.

## Implemented (2026-06-30)
- ✅ JWT auth (register/login/logout/me/refresh)
- ✅ Profile management (display_name, handle, onboarding flag)
- ✅ Buddy lookup, request flow (send/accept/decline/cancel), pairing
- ✅ Entries CRUD with author/target rules per world
- ✅ Object storage uploads + signed-cookie file serving
- ✅ 10 personal rooms + 2 shared rooms (all routed)
- ✅ Atmosphere: gradient, stars, moon, drifting butterflies, grain texture
- ✅ Three-worlds navigation (subtle quiet tabs)
- ✅ Studio mode (writing for buddy)
- ✅ Magical notifications
- ✅ Scheduling (publish_at → status "scheduled")
- ✅ Surprises with sealed cover overlay
- ✅ Bucket list completion checkbox

## Deferred (Backlog)
- P1: Google OAuth provider (auth surface already designed for it)
- P1: Voice note recording UI (currently upload-only — drag/drop audio works)
- P1: Photo galleries with lightbox
- P1: "Notifications" inbox screen for magical announcements (toasts only for now)
- P2: AI yearly memory recaps (architecture supports it; metadata bag ready)
- P2: Drafts UI / Archived view filters
- P2: Multiple media attachments per entry
- P2: Email reset password flow (endpoints scaffolded in playbook but UI deferred)
- P2: Mobile app shell polish
- P2: Recurring/anniversary surprises (publish_at exists, recurrence not yet)

## Next Action Items
1. Run the testing subagent to validate end-to-end flow.
2. Address any critical bugs surfaced.
3. Ship v1; iterate on P1 backlog with user feedback.
