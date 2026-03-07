# Community Hub

The Community Hub is a multi-tenant social engagement platform designed to foster connection within studios. It supports categorized discussion topics, dynamic membership eligibility, and AI-assisted content creation.

## Key Concepts

### 1. Topics & Isolation
- **Everyone (Global)**: The default channel for general studio-wide updates. Posts here are visible to all members.
- **Categorized Topics**: Studios can create custom topics (e.g., `# Nature`, `# Yoga Tips`, `# Workshop Prep`). 
- **Strict Feed Isolation**: Posts made within a topic stay within that topic. The "Everyone" feed does not show topic-specific posts, ensuring interest-based discussions remain focused.

### 2. Visibility & Eligibility
Topics can have different visibility levels regulated by a dynamic eligibility engine:
- **Public**: Visible and joinable by all studio members.
- **Private (Rule-Based)**: Access is automatically granted based on:
    - **Course Enrollment**: Access granted to students enrolled in a specific course (perfect for class-specific discusions).
    - **Membership Tier**: Access granted to members on specific subscription plans (e.g., "Elite Member Only" topics).
- **Hidden**: Topics that do not appear in the discovery list but can be posted to if access is granted.

### 3. Posting Logic
- **Context-Aware Compose Box**: The compose box automatically adjusts based on the active topic view.
    - Viewing **Everyone**: No topic tags are shown. Posts are global.
    - Viewing a **Topic**: The specific topic tag is auto-applied to new posts.
- **Topic Toggling**: Users can remove a topic tag before posting to convert a topic post into a global post without leaving their current view.

### 4. AI-Powered Writing (Gemini AI)
- An "AI Assist" feature enables members to generate post content from short prompts, leveraging Gemini AI to craft engaging, studio-appropriate updates.

### 5. Premium Post Management
- **Editing**: Full support for editing post text and **migrating or removing** topics after a post is live.
- **Deletion**: Clean, modal-based deletion confirmation.
- **Engagement**: Rich reactions (Like, Love, Celebrate, Fire) and nested comments.

### 6. UX & Layout Architecture
- **Optimized Readability**: The content area is constrained to a `max-width` (centered) on large monitors to prevent line-length fatigue and maintain a premium, balanced feel.
- **Responsive Design**: Sidebar topics collapse into a mobile-friendly menu on smaller viewports.

## API Architecture

### Posts & Topics
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/community/topics` | List accessible topics for the current member |
| `POST` | `/community/topics` | Create a new topic (Admin/Owner) |
| `PATCH` | `/community/topics/:id` | Update topic visibility, name, or metadata |
| `GET` | `/community` | Fetch posts (queryable by `topicId`) |
| `POST` | `/community` | Create a post (optionally linked to a `topicId`) |
| `PATCH` | `/community/:id` | Edit post content or update/remove `topicId` |
| `DELETE` | `/community/:id` | Delete a post and its data |

### Engagement
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/community/:id/like` | Toggle reactions |
| `POST` | `/community/:id/comments` | Post a comment |
| `DELETE` | `/community/comments/:id` | Remove a comment |

## Technical Implementation

### Database Schema
- **`community_posts`**: Main table for post content, linked to `tenant_id` and optional `topicId`.
- **`community_topics`**: Definitions for studio channels including `visibility` and `metadata`.
- **`community_topic_memberships`**: Tracks manual and automated eligibility mappings.

### Eligibility Engine
`packages/api/src/services/eligibility.ts`
- Evaluates `course` and `plan` rules against a member's active enrollments and subscriptions to determine topic access in real-time.

### Real-Time Interactions
- Leverages the `ChatRoom` Durable Object for live notification indicators and potentially real-time feed updates.
