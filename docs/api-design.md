# Concord — API & Domain Architecture Specification

This document defines the domain contexts, data models, REST endpoints, and real-time event protocols for the Concord backend (Phoenix / Elixir).

---

## 1. Domain Contexts & Boundaries

```
Concord (Backend)
├── Accounts        # Identity, Auth, Global Profiles, Sessions
├── Realms          # Realm Management, Realm Rules, Admissions / Waiting Room
├── Spaces          # Spaces, Space Membership, Contextual Tags (Personas), View Settings
├── Conversations   # Continuous Chat Stream, Reactions, Message Lifecycle
├── Posts           # Deliberately Published Content, Comments, Echo Provenance
├── Media           # Document/File Storage, In-App Previews, Metadata
└── Discovery       # Multi-faceted search (People, Spaces, Realms) & Semantic Search
```

---

## 2. Core Entities & Data Schema

All primary keys use **UUIDv7** (time-sortable, millisecond precision, distributed uniqueness).

### Accounts & Identity
- **`users`**
  - `id`: `uuid` (UUIDv7, PK)
  - `username`: `string` (unique global handle, e.g. `alex`)
  - `display_name`: `string`
  - `email`: `string` (unique, private)
  - `avatar_url`: `string` (optional)
  - `bio`: `text` (optional)
  - `inserted_at`, `updated_at`: `utc_datetime_usec`

### Realms
- **`realms`**
  - `id`: `uuid` (PK)
  - `name`: `string`
  - `slug`: `string` (unique)
  - `description`: `text`
  - `icon_url`: `string` (optional)
  - `banner_url`: `string` (optional)
  - `visibility`: `enum` (`public`, `unlisted`, `private`)
  - `rules_checklist`: `jsonb` (array of rule objects `{ id, title, description, required }`)
  - `inserted_at`, `updated_at`: `utc_datetime_usec`

- **`realm_members`**
  - `realm_id`: `uuid` (FK -> `realms.id`, composite PK)
  - `user_id`: `uuid` (FK -> `users.id`, composite PK)
  - `is_curator`: `boolean` (default: `false`)
  - `status`: `enum` (`admitted`, `waiting_room`, `declined`)
  - `admitted_at`: `utc_datetime_usec` (optional)
  - `inserted_at`: `utc_datetime_usec`

### Spaces
- **`spaces`**
  - `id`: `uuid` (PK)
  - `realm_id`: `uuid` (FK -> `realms.id`, optional — a space can exist independently)
  - `name`: `string`
  - `slug`: `string`
  - `description`: `text` (optional)
  - `icon_url`: `string` (optional)
  - `kind`: `enum` (`direct`, `group`, `community`, `organization`)
  - `visibility`: `enum` (`public`, `unlisted`, `private`, `direct`)
  - `echo_policy`: `enum` (`space_only`, `realm_only`, `universal`)
  - `enabled_views`: `jsonb` (array, e.g. `["conversation", "posts", "files", "media"]`)
  - `realm_agreement_status`: `enum` (`none`, `pending`, `agreed`, `rejected`)
  - `realm_agreed_rules`: `jsonb` (snapshot of accepted rule IDs)
  - `inserted_at`, `updated_at`: `utc_datetime_usec`

- **`space_members`**
  - `space_id`: `uuid` (FK -> `spaces.id`, composite PK)
  - `user_id`: `uuid` (FK -> `users.id`, composite PK)
  - `tag`: `string` (contextual Space-specific handle for mentions & identity)
  - `display_name`: `string` (optional override)
  - `avatar_url`: `string` (optional override)
  - `is_curator`: `boolean` (default: `false`)
  - `is_anonymous`: `boolean` (default: `false`)
  - `joined_at`: `utc_datetime_usec`

### Continuous Chat (Conversations)
- **`messages`**
  - `id`: `uuid` (UUIDv7, PK)
  - `space_id`: `uuid` (FK -> `spaces.id`, indexed)
  - `author_id`: `uuid` (FK -> `users.id`)
  - `content`: `text`
  - `reply_to_id`: `uuid` (FK -> `messages.id`, optional)
  - `type`: `enum` (`text`, `file`, `media`, `system`)
  - `edited_at`: `utc_datetime_usec` (optional)
  - `deleted_at`: `utc_datetime_usec` (optional, soft-delete)
  - `inserted_at`: `utc_datetime_usec`

- **`reactions`**
  - `message_id`: `uuid` (FK -> `messages.id`, composite PK)
  - `user_id`: `uuid` (FK -> `users.id`, composite PK)
  - `emoji`: `string` (composite PK)
  - `inserted_at`: `utc_datetime_usec`

### Published Posts & Comments
- **`posts`**
  - `id`: `uuid` (UUIDv7, PK)
  - `space_id`: `uuid` (FK -> `spaces.id`, indexed)
  - `author_id`: `uuid` (FK -> `users.id`)
  - `title`: `string`
  - `body`: `text` (rich markdown / structured content)
  - `echo_policy`: `enum` (`space_only`, `realm_only`, `universal`)
  - `original_post_id`: `uuid` (FK -> `posts.id`, for Echos)
  - `echo_source_space_id`: `uuid` (FK -> `spaces.id`, for Echos)
  - `echo_count`: `integer` (default: `0`)
  - `comment_count`: `integer` (default: `0`)
  - `published_at`: `utc_datetime_usec`
  - `edited_at`: `utc_datetime_usec` (optional)
  - `inserted_at`: `utc_datetime_usec`

- **`comments`**
  - `id`: `uuid` (UUIDv7, PK)
  - `post_id`: `uuid` (FK -> `posts.id`, indexed)
  - `author_id`: `uuid` (FK -> `users.id`)
  - `parent_comment_id`: `uuid` (FK -> `comments.id`, optional for nested replies)
  - `content`: `text`
  - `edited_at`: `utc_datetime_usec` (optional)
  - `inserted_at`: `utc_datetime_usec`

### Files & Media
- **`file_assets`**
  - `id`: `uuid` (PK)
  - `space_id`: `uuid` (FK -> `spaces.id`, indexed)
  - `uploader_id`: `uuid` (FK -> `users.id`)
  - `filename`: `string`
  - `content_type`: `string`
  - `size_bytes`: `bigint`
  - `url`: `string`
  - `preview_url`: `string` (optional)
  - `metadata`: `jsonb` (e.g. `{ width, height, duration, page_count, preview_text }`)
  - `inserted_at`: `utc_datetime_usec`

---

## 3. REST API Endpoint Map (`/api/v1`)

### Identity & Current User
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/users/@me` | Get current user profile and active contexts |
| `PATCH` | `/api/v1/users/@me` | Update global profile (display name, bio, avatar) |
| `GET` | `/api/v1/users/:username` | Public profile by unique username |

### Realms
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/realms` | List user's realms (admitted & waiting room) |
| `POST` | `/api/v1/realms` | Create a new Realm |
| `GET` | `/api/v1/realms/:realmId` | Get Realm details & Spaces list |
| `PATCH` | `/api/v1/realms/:realmId` | Update Realm details & rules checklist (Curator only) |
| `DELETE` | `/api/v1/realms/:realmId` | Delete Realm (Curator only) |
| `GET` | `/api/v1/realms/:realmId/members` | List Realm members (filter by `status=waiting_room\|admitted`) |
| `POST` | `/api/v1/realms/:realmId/join` | Request admission / enter waiting room |
| `PATCH` | `/api/v1/realms/:realmId/members/:userId` | Admit or reject a waiting-room member (Curator only) |
| `POST` | `/api/v1/realms/:realmId/spaces` | Attach an existing Space to this Realm (triggers agreement) |

### Spaces
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/spaces` | List accessible Spaces (direct, group, or within Realms) |
| `POST` | `/api/v1/spaces` | Create an independent Space or Space within a Realm |
| `GET` | `/api/v1/spaces/:spaceId` | Get Space overview, enabled views, and metadata |
| `PATCH` | `/api/v1/spaces/:spaceId` | Update Space settings & enabled views (Curator only) |
| `DELETE` | `/api/v1/spaces/:spaceId` | Delete Space (Curator only) |
| `GET` | `/api/v1/spaces/:spaceId/identity` | Get contextual tag and persona for current user |
| `PATCH` | `/api/v1/spaces/:spaceId/identity` | Update contextual tag/persona within this Space |
| `GET` | `/api/v1/spaces/:spaceId/members` | List members & curators of the Space |
| `POST` | `/api/v1/spaces/:spaceId/join` | Join Space |
| `POST` | `/api/v1/spaces/:spaceId/realm-agreement` | Space Curator accepts/rejects Realm rules |

### Continuous Chat Stream
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/spaces/:spaceId/messages` | Cursor pagination: `?before=:id&limit=50` |
| `POST` | `/api/v1/spaces/:spaceId/messages` | Send message to continuous chat |
| `PATCH` | `/api/v1/spaces/:spaceId/messages/:messageId` | Edit message |
| `DELETE` | `/api/v1/spaces/:spaceId/messages/:messageId` | Soft delete message |
| `PUT` | `/api/v1/spaces/:spaceId/messages/:messageId/reactions/:emoji` | Add reaction |
| `DELETE` | `/api/v1/spaces/:spaceId/messages/:messageId/reactions/:emoji` | Remove reaction |

### Published Posts & Comments
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/spaces/:spaceId/posts` | List published posts in Space (Posts Tab view) |
| `POST` | `/api/v1/spaces/:spaceId/posts` | Publish a new Post in Space |
| `GET` | `/api/v1/posts/:postId` | Get post content, provenance, and top comments |
| `PATCH` | `/api/v1/posts/:postId` | Edit post content |
| `DELETE` | `/api/v1/posts/:postId` | Delete post |
| `POST` | `/api/v1/posts/:postId/echo` | Echo/share post to target Space (subject to Echo policy) |
| `GET` | `/api/v1/posts/:postId/comments` | List comments on a Post |
| `POST` | `/api/v1/posts/:postId/comments` | Post comment / reply on a Post |

### Space Views: Files & Media
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/spaces/:spaceId/files` | Filtered list of documents & files (Files Tab) |
| `GET` | `/api/v1/spaces/:spaceId/media` | Gallery of images & videos (Media Tab) |
| `POST` | `/api/v1/spaces/:spaceId/uploads` | Generate signed upload URL / register file asset |

### Discovery & Search
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/discovery/search?type=people\|spaces\|realms&q=...` | Explicit search by type and tags |
| `POST` | `/api/v1/discovery/semantic` | Natural language / AI query for Spaces and Realms |

---

## 4. Phoenix Channels Realtime Event Protocol

### Topics
- **`space:<space_id>`** — Realtime communication stream inside a Space.
- **`realm:<realm_id>`** — Realm-level events (admissions, rule updates).
- **`user:<user_id>`** — Personal inbox, direct invitations, waiting-room approvals.

### Event Payloads
1. **Chat Events**:
   - `chat:message_created` -> `{ message }`
   - `chat:message_updated` -> `{ message }`
   - `chat:message_deleted` -> `{ message_id }`
   - `chat:reaction_updated` -> `{ message_id, emoji, user_id, action: "add" | "remove" }`
2. **Post Events**:
   - `post:published` -> `{ post }`
   - `post:echoed` -> `{ echo_post, original_post_id, source_space }`
   - `post:comment_created` -> `{ post_id, comment }`
3. **Contextual Activity (Ephemeral)**:
   - `activity:update` -> `{ user_id, tag, state: "reading" | "typing_chat" | "composing_post" | "in_call" }`
4. **Realm & Space Lifecycle**:
   - `realm:member_waiting` -> `{ user, realm_id }`
   - `realm:member_admitted` -> `{ user_id, realm_id }`
   - `space:realm_agreement_required` -> `{ space_id, realm_id, rules }`
