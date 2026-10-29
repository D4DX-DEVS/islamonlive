# Admin: homepage builder, editor role, activity trail, new login

Status: implemented 2026-10-29 (see "Results" at the end). MongoDB backend only
(`DATA_SOURCE=mongo`); in WordPress mode the homepage renders the built-in
default layout and the new admin screens answer 501.

## Goals (from the request)

1. **Homepage fully editable from the admin**: every section can be reordered,
   edited, hidden, duplicated, deleted, and new sections added. Changes go live
   on save, with no deploy.
2. **Modern admin login** that no longer reads like a WordPress bridge
   ("Connecting…", wp-login links, WordPress wording).
3. **Editor role**: editors get only the everyday menu (Overview, Articles,
   New article, Authors read-only). No homepage layout, team, analytics or
   activity screens, and the APIs refuse them too.
4. **Who did what**: every article create / edit / publish / trash, every
   upload and every account or layout change records the staff account that did
   it. Administrators see it on each article row and in an Activity log.
5. **Administrators manage editor accounts**: create as many as needed, edit,
   reset password, change role, deactivate / reactivate.

## Design

### 1. Homepage layout model (`src/lib/home-layout/`)

One document, `home_layout` collection, `_id: "home"`:

```ts
{ _id: "home", sections: HomeSection[], updated_at, updated_by: { id, name },
  history: { sections, saved_at, saved_by }[] /* last 10 publishes */ }
```

Section kinds (each has `id`, `kind`, `enabled`, `placement`, `visibility`):

| kind       | what it renders                          | config |
|------------|------------------------------------------|--------|
| `hero`     | big slider + 2 side cards                | categories (pool), main/side counts |
| `reels`    | Instagram reels (YouTube shorts fallback) | title, link, count |
| `banners`  | promo banner strip (banners collection)   | — |
| `watch`    | YouTube player band                      | title, link, count |
| `listen`   | podcast player                           | title, link, rows per page |
| `posts`    | any post list                            | title, link, source (categories / tag / latest), count, style, tabs, rows |
| `image`    | custom linked image banner (new)         | image URL, link, alt |

`posts` styles: `tabbed` (Shari'ah/Opinion), `featured_list` (Columns /
Editor's Picks sidebar), `compact_tabs` (Culture "…" menu), `slider`
(phone Editor's Picks), `portrait_grid` (Infographics), `grid` (new card grid).
Category sources always include sub-categories (`includeChildren`), so the
hand-maintained `CAT` id lists go away.

`placement`: `full` | `main` | `side`. Consecutive main/side sections form the
two-column block; a row closes when a `main` section follows a `side` one,
which reproduces today's rows exactly (Shari'ah | Picks; Watch+Listen |
Columns; Opinion | Culture). Phones show the main column first, then the
sidebar, as today. A block with no sidebar sections spans the full width.

`visibility`: `all` | `desktop` (≥1024px) | `mobile` (<1024px).

`DEFAULT_LAYOUT` reproduces the current homepage, so nothing changes until an
administrator saves. A missing / unreadable document falls back to it.

Validation (`sanitizeLayout`) is strict and server-side: kind whitelist, text
trimmed and length-capped, ids integers, counts clamped, links relative or
http(s) only, max 40 sections.

Caching: `getHomeLayout()` goes through `cached()` with tag `home-layout`;
saving calls `revalidateTag("home-layout")`, `revalidatePath("/")` and the
Cloudflare purge for `/`.

### 2. Roles and access (`src/lib/auth/actor.ts`)

`getAdminActor()` reads the signed-in account from the users collection
(fresh, not from the cookie) → `{ id, username, name, role }` or null.
`requireAdministrator()` returns the actor or a 401/403 response. Used by every
new route. Menu per role:

- administrator: Overview, Analytics, Articles, New article, Homepage, Authors, Team, Activity
- editor: Overview, Articles, New article, Authors (no create form)

### 3. Activity trail (`src/lib/activity.ts`)

- Posts get `created_by` / `updated_by` (staff user ids) set by the admin REST
  emulator; media already stores the uploader in `author_id`.
- `admin_activity` collection: `{ at, actor: {id,name,role}, action, target:
  {type,id,title,link} }`, TTL 2 years, indexes on `at` and `actor.id`.
  Actions: `post.create`, `post.update`, `post.publish`, `post.trash`,
  `media.upload`, `media.delete`, `user.create`, `user.update`,
  `layout.update`, `layout.restore`. Logging never fails the request.
- Articles list shows "Added by / Last edited by"; Activity tab
  (administrators) lists the log with actor and action filters.

### 4. Team management (`/api/admin/team`)

Administrators only. List staff (administrator + editor), create (name,
username, email, password ≥ 8, role), update (name, email, role, active,
new password). Guards: you cannot demote or deactivate yourself, and the last
active administrator cannot be demoted or deactivated. Editor accounts have no
published posts, so they never appear on the public authors list.

### 5. Login

Rebuilt `AdminLogin.tsx`: one clean card, "Islamonlive Studio", username or
email, show/hide password, Caps Lock hint, remember-me (14 days), inline error,
spinner "Signing in…", redirect without a full reload flash. No WordPress
wording or links in MongoDB mode.

## Tasks

1. home-layout types, defaults, sanitize, row grouping + unit tests
2. layout store (read cached, save with history, restore) + API routes
3. homepage renders from the layout (section components)
4. admin Homepage screen: list, reorder (drag + buttons), edit dialog, add,
   duplicate, delete, enable/disable, reset to default, history restore
5. actor/roles helper, role-aware menu, editor restrictions
6. team API + Team screen
7. activity log: write hooks, articles "added by", Activity screen
8. login redesign
9. tests, typecheck, lint, build, browser walk at 375 / 1280

## Results (2026-10-29)

- `npm test`: 385 passed (new: home-layout schema, activity trail, team + layout routes).
- `npm run build`, `tsc --noEmit`, `eslint src`: clean.
- `scripts/e2e-local.mjs`: 60/60 on a fixture database.
- Browser walk on the e2e server: login, Homepage edit → publish → public page
  shows the change at once; phone order unchanged; editor sees 4 menu items and
  gets 403 from layout/team/activity APIs; Activity and Team screens; 1280 + 375.

Not done / follow-ups:
- Nothing committed or deployed.
- ~~Migrated staff accounts with no username can only sign in by email.~~ Done
  2026-10-29: Team → Edit sets or changes the username (checked against every
  other account's username and email, since sign-in accepts either).
- Team delete (2026-10-29): an account with no posts/pages/media/edits is
  deleted; one with any is demoted to a plain author (role "author", password
  removed) so bylines and /author/ pages survive. Its username/email stay taken.
- Hero now takes the newest N posts across its categories, instead of pooling
  each section's top 5/12 — the same stories in practice, not byte-identical.

## Builder v2: live preview (2026-10-29, same day)

User feedback: the list screen felt basic, with no preview. Rebuilt as a visual builder:

- Full-screen builder (`src/app/admin/home-layout/`): section list (left), live
  canvas (centre), inline settings for the selected section (right); on phones
  the three panels are tabs. Desktop / tablet / phone preview sizes.
- Canvas = `/preview/home/` (administrators only, noindex, no page-view beacon)
  rendering the **draft** in an iframe (`HomeSections preview` adds
  `data-section-id` markers). Two iframes double-buffer, so an edit swaps in
  without a blank flash and keeps the scroll position. Clicking in the
  preview selects that section (links and forms are stopped); hover/selected
  outlines with a name badge; empty sections show a dashed placeholder.
- Drafts: `home_layout.draft` autosaved ~0.7 s after each edit
  (`PUT/DELETE /api/admin/home-layout/draft`), serialised so an older save can
  never land after a newer one; survives reloads and is shared between admins
  (last write wins). Publish moves draft → live and clears it.
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z; keystrokes in one field are one step),
  version history menu with restore, "start from original layout", visual
  "Add section" gallery with schematic thumbnails, inserting after the
  selected section.
- Verified on the e2e server at 1440 and 390: select-in-preview, live heading
  edit → preview refresh, add card grid, undo, publish → live `/` updated.
  390 tests, build, lint, tsc green; e2e 60/60.
- Gotcha: the canvas reaches into a same-origin iframe, whose nodes belong to
  the frame's window, so `instanceof Element` from the parent is always false.
  Duck-type instead.
