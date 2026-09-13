Software Requirements Specification

**CloudSent()**

*A Digital Prayer Wall for Faith, Hope, and Community*

Document Version 1.1

Prepared for Academic Capstone Submission

June 2026

# **Table of Contents**

# **1\. Introduction**

## **1.1 Purpose**

This Software Requirements Specification (SRS) describes the functional and non-functional requirements for CloudSent(), a web-based digital prayer wall. The document is intended for the development team, academic panel members, and any future maintainers of the system. It defines the scope of the application, the behavior expected of the system, and the constraints under which it must operate, following an IEEE-inspired structure suitable for academic capstone documentation.

## **1.2 Scope**

CloudSent() is a web application that allows visitors to anonymously or publicly submit prayer intentions, thanksgiving messages, reflections, encouragement, and memorial prayers to a shared digital "wall." The concept draws inspiration from The Unsent Project's visual card-wall format, but reorients the emotional and thematic focus away from unsent personal messages and toward faith, hope, healing, and gratitude. The system supports public browsing, searching, and filtering of prayers, as well as an administrative back end for content moderation. The platform does not require user accounts for core participation and is explicitly designed to avoid social-media mechanics such as likes, follower counts, or public commentary threads, in favor of a calm and contemplative experience.

## **1.3 Definitions, Acronyms, and Abbreviations**

| Term | Definition |
| :---- | :---- |
| SRS | Software Requirements Specification |
| Prayer Card | A single submitted prayer rendered on the Prayer Wall, styled with a color, mood, and category |
| Prayer Wall | The public, grid-based display of all approved prayer cards |
| Moderation Queue | The pending list of submitted prayers awaiting administrator approval or rejection |
| Mood | A user-selected emotional tag (e.g., Hopeful, Grateful, Sorrowful) attached to a prayer |
| Category | A classification of the prayer's intent (e.g., Intention, Thanksgiving, Reflection, Encouragement, Memorial) |
| JWT | JSON Web Token, used for authenticating administrator sessions |
| ERD | Entity-Relationship Diagram |
| WCAG | Web Content Accessibility Guidelines |
| CSRF | Cross-Site Request Forgery |
| XSS | Cross-Site Scripting |

## **1.4 References**

* IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications

* Web Content Accessibility Guidelines (WCAG) 2.1, W3C

* OWASP Top Ten Web Application Security Risks

* React, Node.js/Express, and PostgreSQL official documentation

## **1.5 Document Overview**

Section 2 describes the product at a high level. Section 3 details functional requirements by feature area. Section 4 specifies non-functional requirements. Sections 5 through 11 describe the architecture, database design, and behavioral models (use cases, activity flow, sequence flow, and the ER diagram). Sections 12 through 15 cover interface design, security, and deployment. The remaining sections cover future enhancements, assumptions, constraints, and supporting appendices.

# **2\. Overall Description**

## **2.1 Product Perspective**

CloudSent() is a standalone web application composed of a React-based single-page front end, a Node.js/Express REST API, and a PostgreSQL relational database. It is not part of a larger product family. The system is hosted entirely on free-tier infrastructure suitable for academic deployment: the front end on Vercel, the back end on Render or Railway, and the database on Neon (serverless PostgreSQL).

## **2.2 Product Functions**

At a high level, CloudSent() allows the system to:

* Accept anonymous or named prayer submissions across five categories

* Display approved submissions on a public, visually organic Prayer Wall

* Allow visitors to search and filter prayers by keyword, category, mood, color, name, and date

* Present a detailed view for each individual prayer

* Provide administrators with tools to review, approve, reject, edit, delete, and export submissions

* Apply automated moderation safeguards, including bad-word filtering and spam detection

* Allow visitors to report inappropriate content for administrator review

## **2.3 User Classes and Characteristics**

| User Class | Description | Technical Expertise |
| :---- | :---- | :---- |
| Visitor (Guest) | Any unauthenticated person who browses, searches, or submits a prayer | None required |
| Contributor | A visitor in the act of submitting a prayer; functionally the same as a Visitor | None required |
| Administrator | An authenticated user responsible for moderating content and managing taxonomy | Basic familiarity with web dashboards |

## **2.4 Operating Environment**

CloudSent() runs as a responsive web application accessible through modern desktop and mobile browsers (Chrome, Firefox, Safari, Edge, and their mobile equivalents). The back end runs on a Node.js runtime targeting Node 18 LTS or later, with PostgreSQL 14 or later as the data store.

## **2.5 Design and Implementation Constraints**

* All third-party services and infrastructure must remain within free-tier limits

* The technology stack is fixed to React, Tailwind CSS, Node.js, Express, and PostgreSQL

* No mandatory account creation may be introduced for core prayer submission or browsing

* The visual design must avoid social-media affordances such as public likes, follows, or comment threads enabled by default

## **2.6 Assumptions and Dependencies**

* Users have access to a modern browser with JavaScript enabled

* Free-tier hosting quotas (bandwidth, compute hours, storage) are sufficient for capstone-scale traffic

* A single administrator role is sufficient; multi-tier admin permissions are out of scope for the initial release

# **3\. Functional Requirements**

Each subsection below corresponds to a major system feature. Requirements are labeled with identifiers of the form FR-\<Section\>.\<Number\> for traceability.

## **3.1 Home Page**

| ID | Requirement |
| :---- | :---- |
| FR-3.1.1 | The system shall display a hero section introducing CloudSent() with a short statement of purpose. |
| FR-3.1.2 | The system shall display a prominent "Send a Prayer" call-to-action button that navigates to the submission form. |
| FR-3.1.3 | The system shall display a "Browse Prayers" call-to-action button that navigates to the Prayer Wall. |
| FR-3.1.4 | The home page shall render correctly on both desktop and mobile viewports. |

## **3.2 Submit Prayer**

Users shall be able to submit one of five prayer types: Prayer Intention, Thanksgiving, Reflection, Encouragement, or Memorial Prayer.

| ID | Requirement |
| :---- | :---- |
| FR-3.2.1 | The system shall provide a submission form capturing: optional title, prayer message (required), category, mood/emotion, background color, anonymous/display-name toggle, and submission date (system-generated). |
| FR-3.2.2 | The system shall require the prayer message field to be non-empty and within a defined maximum character length. |
| FR-3.2.3 | The system shall allow the user to choose "Anonymous" instead of supplying a display name. |
| FR-3.2.4 | The system shall route every new submission into a Pending status until reviewed by an administrator. |
| FR-3.2.5 | The system shall confirm successful submission to the user without revealing internal moderation status details. |

## **3.3 Prayer Wall**

| ID | Requirement |
| :---- | :---- |
| FR-3.3.1 | The system shall display all approved prayers in a responsive grid layout. |
| FR-3.3.2 | Each prayer card shall display its background color, title (if provided), message excerpt, category, mood, submission date, and contributor name or "Anonymous." |
| FR-3.3.3 | Cards shall be rendered at varying sizes to produce an organic, non-uniform wall appearance. |
| FR-3.3.4 | The Prayer Wall shall support incremental loading (pagination or infinite scroll) to maintain performance as the number of prayers grows. |

## **3.4 Search**

| ID | Requirement |
| :---- | :---- |
| FR-3.4.1 | The system shall allow searching prayers by free-text keyword across title and message. |
| FR-3.4.2 | The system shall allow searching by category, mood, and display name. |
| FR-3.4.3 | The system shall return search results within the Prayer Wall grid without requiring a full page reload. |

## **3.5 Filter**

| ID | Requirement |
| :---- | :---- |
| FR-3.5.1 | The system shall allow filtering of the Prayer Wall by category, color, mood, and date range. |
| FR-3.5.2 | Filters shall be combinable (e.g., category AND mood AND date range applied simultaneously). |
| FR-3.5.3 | The system shall allow users to clear all active filters in a single action. |

## **3.6 Prayer Detail Page**

| ID | Requirement |
| :---- | :---- |
| FR-3.6.1 | Selecting a prayer card shall open a detail view showing the full prayer text, submission date, background color, category, and mood. |
| FR-3.6.2 | Deferred: comments and public response threads are not enabled in version 1.1. |
| FR-3.6.3 | The detail page shall include a "Report" action for flagging inappropriate content. |

## **3.7 Admin Dashboard**

| ID | Requirement |
| :---- | :---- |
| FR-3.7.1 | The system shall require administrator authentication (JWT-based) to access the dashboard. |
| FR-3.7.2 | Administrators shall be able to view all prayers regardless of status (pending, approved, rejected). |
| FR-3.7.3 | Administrators shall be able to approve, reject, edit, or delete any submission. |
| FR-3.7.4 | Administrators shall be able to manage the list of categories and moods. |
| FR-3.7.5 | Administrators shall be able to view aggregate statistics (e.g., total prayers, prayers by category, submissions over time). |
| FR-3.7.6 | Administrators shall be able to export prayer data (e.g., as CSV). |
| FR-3.7.7 | Administrators shall be able to search and filter submissions within the dashboard. |

## **3.8 Moderation**

| ID | Requirement |
| :---- | :---- |
| FR-3.8.1 | The system shall reject incoming submissions that contain configured prohibited whole-word terms; the rejected content shall not be stored. |
| FR-3.8.2 | The system shall apply basic spam-detection heuristics (e.g., rate limiting, duplicate-content detection) to incoming submissions. |
| FR-3.8.3 | The system shall provide a "Report Prayer" action available to any visitor on the Prayer Wall or detail page. |
| FR-3.8.4 | The system shall maintain a pending-approval queue visible only to administrators. |

# **4\. Non-Functional Requirements**

## **4.1 Performance**

* The Prayer Wall shall load its initial view in under 3 seconds on a standard broadband connection.

* The interface shall be fully responsive across desktop, tablet, and mobile breakpoints.

* API endpoints shall respond within 500ms under normal load for read operations.

## **4.2 Security**

* CAPTCHA is not used in version 1.1. Abuse protection uses pseudonymous device/network limits, duplicate detection, and moderation review.

* All user input shall be validated and sanitized on both client and server.

* The system shall use parameterized queries to prevent SQL injection.

* The system shall encode all user-generated output to prevent Cross-Site Scripting (XSS).

* State-changing requests shall be protected against Cross-Site Request Forgery (CSRF).

* Administrator sessions shall be authenticated using signed JWTs with a defined expiration window.

## **4.3 Availability**

* The system shall target a minimum of 99% monthly uptime, consistent with the chosen free-tier hosting providers' typical service levels.

## **4.4 Accessibility**

* The interface shall conform to WCAG 2.1 Level AA where feasible.

* All interactive elements shall be operable via keyboard navigation.

* The color palette shall offer a high-contrast mode or sufficiently contrasting defaults for readability.

## **4.5 Privacy**

* Submissions shall default to anonymous unless the user explicitly opts to display a name.

* The system shall not require any personally identifiable information to submit or browse prayers.

* Stored data shall be handled in accordance with general data-protection best practices (data minimization, restricted admin access).

## **4.6 Scalability**

* The database schema and Prayer Wall pagination strategy shall support at least several thousand stored prayers without degradation in browsing performance.

# **5\. System Architecture**

CloudSent() follows a three-tier architecture: a presentation tier (React \+ Tailwind CSS), an application/business-logic tier (Node.js \+ Express REST API), and a data tier (PostgreSQL). Communication between tiers occurs over HTTPS using JSON payloads.

|   \+-----------------------+        HTTPS/JSON        \+----------------------------+   |   PRESENTATION TIER   |  \----------------------\> |     APPLICATION TIER       |   |  React \+ Tailwind CSS |  \<---------------------- |   Node.js \+ Express API    |   |  (Vercel)             |                          |   (Render / Railway)       |   \+-----------------------+                          \+--------------+-------------+                                                                      |                                                                      | SQL (pg)                                                                      v                                                       \+----------------------------+                                                       |        DATA TIER           |                                                       |   PostgreSQL (Neon)        |                                                       \+----------------------------+ |
| :---- |

*Figure 5.1 — Three-tier system architecture*

## **5.1 Component Overview**

| Component | Responsibility |
| :---- | :---- |
| Public Web Client | Renders Home, Prayer Wall, Submission Form, and Prayer Detail views |
| Admin Web Client | Renders the Admin Dashboard, protected by JWT authentication |
| REST API | Exposes endpoints for prayers, categories, moods, reports, and admin actions |
| Moderation Service | Runs bad-word filtering and spam heuristics on incoming submissions |
| Database | Persists prayers, categories, moods, reports, and admin accounts |

# **6\. Database Design**

The schema below supports the core entities required by CloudSent(): Prayer, Category, Mood, Report, and Admin.

## **6.1 Prayer Table**

| Column | Type | Constraints |
| :---- | :---- | :---- |
| prayer\_id | UUID | Primary Key, default gen\_random\_uuid() |
| title | VARCHAR(150) | Nullable |
| message | TEXT | Not Null |
| category\_id | UUID | Foreign Key \-\> category.category\_id |
| mood\_id | UUID | Foreign Key \-\> mood.mood\_id |
| color | VARCHAR(20) | Not Null, hex or named color |
| display\_name | VARCHAR(100) | Nullable (null implies Anonymous) |
| is\_anonymous | BOOLEAN | Not Null, default true |
| originally\_anonymous | BOOLEAN | Not Null; immutable origin marker used to prevent assigning a name to an originally anonymous prayer |
| status | VARCHAR(20) | Not Null, default 'pending' (pending | approved | rejected) |
| created\_at | TIMESTAMP | Not Null, default now() |
| updated\_at | TIMESTAMP | Not Null, default now() |

## **6.2 Category Table**

| Column | Type | Constraints |
| :---- | :---- | :---- |
| category\_id | UUID | Primary Key |
| name | VARCHAR(50) | Not Null, Unique |
| description | VARCHAR(255) | Nullable |

## **6.3 Mood Table**

| Column | Type | Constraints |
| :---- | :---- | :---- |
| mood\_id | UUID | Primary Key |
| name | VARCHAR(50) | Not Null, Unique |
| color\_hint | VARCHAR(20) | Nullable, suggested color association |

## **6.4 Report Table**

| Column | Type | Constraints |
| :---- | :---- | :---- |
| report\_id | UUID | Primary Key |
| prayer\_id | UUID | Foreign Key \-\> prayer.prayer\_id |
| device\_hash | CHAR(64) | Keyed pseudonym; raw device/IP values are not persisted |
| reason | VARCHAR(255) | Not Null |
| created\_at | TIMESTAMP | Not Null, default now() |
| resolved\_at | TIMESTAMP | Nullable; null means unresolved |
| resolved\_action | VARCHAR(20) | Nullable |

## **6.5 Admin Table**

| Column | Type | Constraints |
| :---- | :---- | :---- |
| admin\_id | UUID | Primary Key |
| username | VARCHAR(50) | Not Null, Unique |
| password\_hash | VARCHAR(255) | Not Null |
| created\_at | TIMESTAMP | Not Null, default now() |

# **7\. Entity-Relationship Diagram**

The diagram below illustrates the relationships among the core entities. Each Prayer references exactly one Category and one Mood; each Prayer may have zero or more Reports.

|    \+---------------+        \+---------------+        \+---------------+    |   CATEGORY    |        |     MOOD      |        |     ADMIN     |    \+---------------+        \+---------------+        \+---------------+    | category\_id PK|        | mood\_id     PK|        | admin\_id    PK|    | name          |        | name          |        | username      |    | description   |        | color\_hint    |        | password\_hash |    \+-------+-------+        \+-------+-------+        \+---------------+            | 1                      | 1            |                        |            | N                      | N    \+-------+------------------------+-------+    |                  PRAYER                |    \+-----------------------------------------+    | prayer\_id        PK                     |    | title                                   |    | message                                 |    | category\_id      FK \-\> CATEGORY          |    | mood\_id          FK \-\> MOOD              |    | color                                   |    | display\_name                            |    | is\_anonymous                            |    | status                                  |    | created\_at                              |    \+-------------------+---------------------+                        | 1                        |                        | N              \+---------+----------+              |      REPORT        |              \+--------------------+              | report\_id      PK  |              | prayer\_id      FK  |              | reason             |              | resolved           |              \+--------------------+ |
| :---- |

*Figure 7.1 — Entity-Relationship Diagram*

# **8\. Use Case Diagram**

Two actors interact with CloudSent(): the Visitor (unauthenticated) and the Administrator (authenticated). The diagram below summarizes their available use cases.

|           Visitor                                    Administrator              |                                              |              |---\> (Browse Prayer Wall)                    |              |---\> (Search Prayers)                         |              |---\> (Filter Prayers)                         |              |---\> (Submit Prayer)                          |              |---\> (View Prayer Detail)                     |              |---\> (Report Prayer)                          |              |                                              |              |                       (Log In)  \<------------|              |                       (Review Pending Queue) \<|              |                       (Approve / Reject)     \<|              |                       (Edit / Delete Prayer) \<|              |                       (Manage Categories)    \<|              |                       (Manage Moods)         \<|              |                       (View Statistics)      \<|              |                       (Export Prayers)       \<| |
| :---- |

*Figure 8.1 — Use case diagram (textual representation)*

# **9\. Use Case Descriptions**

### **UC-01 — Submit Prayer**

| Field | Description |
| :---- | :---- |
| Actor | Visitor |
| Precondition | Visitor has navigated to the Submission Form. |
| Main Flow | 1\. Visitor selects a category. 2\. Visitor enters the prayer message and optional title. 3\. Visitor selects a mood and background color. 4\. Visitor chooses anonymous or display name. 5\. Visitor submits the form. 6\. System validates input and runs moderation checks. 7\. System stores the prayer with status "pending" and confirms submission. |
| Postcondition | A new prayer record exists with status pending, awaiting administrator review. |

### **UC-02 — Browse and Filter Prayer Wall**

| Field | Description |
| :---- | :---- |
| Actor | Visitor |
| Precondition | At least one approved prayer exists. |
| Main Flow | 1\. Visitor opens the Prayer Wall. 2\. System retrieves approved prayers and renders them in a grid. 3\. Visitor optionally applies search keywords or filters (category, mood, color, date). 4\. System returns the matching subset and updates the grid. |
| Postcondition | Visitor views a filtered or unfiltered set of approved prayers. |

### **UC-03 — View Prayer Detail**

| Field | Description |
| :---- | :---- |
| Actor | Visitor |
| Precondition | Visitor is viewing the Prayer Wall. |
| Main Flow | 1\. Visitor selects a prayer card. 2\. System retrieves full prayer details. 3\. System displays the detail page and a Report action. |
| Postcondition | Visitor views the full content of the selected prayer. |

### **UC-04 — Report Prayer**

| Field | Description |
| :---- | :---- |
| Actor | Visitor |
| Precondition | Visitor is viewing a prayer on the wall or detail page. |
| Main Flow | 1\. Visitor selects "Report." 2\. Visitor provides a reason. 3\. System creates a report record linked to the prayer and notifies the moderation queue. |
| Postcondition | A report record is created and visible to administrators. |

### **UC-05 — Moderate Submissions**

| Field | Description |
| :---- | :---- |
| Actor | Administrator |
| Precondition | Administrator is authenticated and at least one pending or reported prayer exists. |
| Main Flow | 1\. Administrator opens the pending-approval queue. 2\. Administrator reviews a submission. 3\. Administrator approves, rejects, or edits the submission. 4\. System updates the prayer's status accordingly. |
| Postcondition | The prayer's status reflects the administrator's decision; approved prayers become visible on the public wall. |

### **UC-06 — Manage Taxonomy**

| Field | Description |
| :---- | :---- |
| Actor | Administrator |
| Precondition | Administrator is authenticated. |
| Main Flow | 1\. Administrator navigates to Category or Mood management. 2\. Administrator adds, edits, or removes an entry. 3\. System persists the change and reflects it in the submission form and filters. |
| Postcondition | The list of available categories or moods is updated system-wide. |

### **UC-07 — View Statistics and Export Data**

| Field | Description |
| :---- | :---- |
| Actor | Administrator |
| Precondition | Administrator is authenticated. |
| Main Flow | 1\. Administrator opens the Statistics panel. 2\. System aggregates counts by category, mood, and time period. 3\. Administrator optionally triggers an export. 4\. System generates a CSV file of the requested data set. |
| Postcondition | Administrator receives an up-to-date statistical summary or downloadable export. |

# **10\. Activity Diagram**

The activity diagram below describes the lifecycle of a single prayer submission, from creation through moderation.

|         \[Start\]            |            v    Visitor fills submission form            |            v    Client-side validation  \---- fails \----\>  Show inline error            | passes                                |            v                                        |    Submit to API  \<-------------------------------- (return to form)            |            v    Server-side validation & moderation filter            |      \+-----+------+      | flagged?   |      \+-----+------+         yes|   no            v    v    Hold for     Store with status \= pending    manual review        |            |            v            \+----\> Pending Approval Queue                         |                         v              Administrator reviews              /            \\         Approve          Reject            |                |            v                v    status \= approved   status \= rejected            |                |            v                v    Visible on Prayer    Not shown publicly    Wall                       |            \\\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_/                     |                   \[End\] |
| :---- |

*Figure 10.1 — Prayer submission and moderation activity flow*

# **11\. Sequence Diagram**

The sequence diagram below traces the interaction between the Client, API, Moderation Service, and Database during a prayer submission.

| Client          API (Express)        Moderation Service        Database   |                   |                       |                   |   |--POST /prayers----\>|                       |                   |   |                   |--validate input-------\>|                   |   |                   |\<--validation result----|                   |   |                   |--check bad words/spam-\>|                   |   |                   |\<--flag / clear---------|                   |   |                   |--INSERT prayer--------------------------\>|   |                   |\<--prayer\_id, status=pending---------------|   |\<--201 Created-----|                       |                   |   |  (confirmation)   |                       |                   | |
| :---- |

*Figure 11.1 — Sequence diagram for prayer submission*

# **12\. Wireframe Descriptions**

### **12.1 Home Page**

* Full-width hero section with soft cloud/sky imagery, headline, and one-sentence purpose statement

* Two primary buttons side-by-side (stacked on mobile): "Send a Prayer" and "Browse Prayers"

* Minimal footer with about/contact information

### **12.2 Submission Form**

* Single-column form with category selector at top, message textarea as the focal element

* Mood and color pickers shown as small selectable swatches/chips

* Anonymous toggle directly above the optional display-name field

* Clear, calm-toned submit button (e.g., "Send to the Cloud")

### **12.3 Prayer Wall**

* Masonry-style grid with varying card heights/widths

* Sticky search bar and filter chips above the grid

* Subtle fade-in animation as cards enter the viewport

### **12.4 Prayer Detail Page**

* Centered card-style layout reflecting the prayer's chosen background color

* Metadata (category, mood, date) displayed as small tags beneath the message

* Report action placed unobtrusively, away from primary content

### **12.5 Admin Dashboard**

* Sidebar navigation: Pending Queue, All Prayers, Categories, Moods, Reports, Statistics

* Tabular list views with inline approve/reject/edit/delete actions

* Statistics panel with simple bar/line charts for submissions over time

# **13\. User Interface Requirements**

## **13.1 Visual Design Language**

The interface shall feel calm, minimalist, peaceful, modern, and inspirational, avoiding visual patterns associated with social media (badges, like counters, infinite engagement prompts).

## **13.2 Color Palette**

| Color | Usage |
| :---- | :---- |
| White | Primary background |
| Sky Blue | Accents, primary buttons, hero section |
| Lavender | Secondary accents, card backgrounds |
| Soft Gold | Highlights, call-to-action emphasis |
| Light Gray | Borders, secondary text, dividers |

## **13.3 Typography**

* Headings: an elegant serif typeface to convey warmth and reflection

* Body text: a clean, highly legible sans-serif typeface

## **13.4 Motion and Animation**

* Soft fade-in transitions for cards entering view

* Subtle floating cloud effects in background decoration

* Smooth scrolling behavior across all pages

# **14\. Security Requirements**

| ID | Requirement |
| :---- | :---- |
| SEC-1 | Version 1.1 does not use CAPTCHA; public writes are protected by pseudonymous rate limits, duplicate detection, validation, and moderation. |
| SEC-2 | All user input shall undergo server-side validation regardless of client-side checks. |
| SEC-3 | All database queries shall use parameterized statements to prevent SQL injection. |
| SEC-4 | All rendered user-generated content shall be escaped to prevent XSS. |
| SEC-5 | All state-changing API requests shall require a valid CSRF token or equivalent same-site protection. |
| SEC-6 | Administrator authentication shall use signed, time-limited JWTs transmitted over HTTPS only. |
| SEC-7 | Passwords for administrator accounts shall be stored using a strong one-way hash (e.g., bcrypt). |
| SEC-8 | Rate limiting shall be applied to the submission endpoint to reduce spam and abuse. |

# **15\. Deployment Architecture**

|    Developer                GitHub Repo               Hosting Providers       |                          |                            |       |--git push----------------\>|                            |       |                          |--CI build/deploy hook------\>|       |                          |                             |--\> Vercel (Frontend, React build)       |                          |                             |--\> Render/Railway (Backend API)       |                          |                             |--\> Neon (PostgreSQL database) |
| :---- |

*Figure 15.1 — Deployment pipeline*

## **15.1 Environment Configuration**

| Tier | Provider | Notes |
| :---- | :---- | :---- |
| Frontend | Vercel | Automatic deploys from main branch; environment variables for API base URL |
| Backend API | Render or Railway | Node.js service; environment variables for DB connection string and JWT secret |
| Database | Neon (Serverless PostgreSQL) | Free-tier instance; connection pooling recommended |

# **16\. Future Enhancements**

* Optional user accounts for returning contributors

* Ability to favorite or save prayers for personal reflection

* Notification system (e.g., when a prayer receives a supportive response, if comments are enabled)

* Multi-language support for the submission form and wall

* Tiered administrator roles (e.g., moderator vs. super-admin)

# **17\. Assumptions**

* A single deployed instance will serve all users; multi-tenant support is not required

* Free-tier infrastructure quotas are adequate for the expected academic-scale audience

* English is the primary language for the initial release

# **18\. Constraints**

* Budget constraint: all tools and services must remain free-tier

* Technology constraint: fixed stack of React, Tailwind CSS, Node.js, Express, and PostgreSQL

* Time constraint: development must fit within an academic capstone timeline

* Design constraint: the product must avoid social-media-style engagement mechanics

# **19\. Appendix**

## **19.1 Sample API Endpoints**

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| GET | /api/prayers | List approved prayers (supports search/filter query params) |
| POST | /api/prayers | Submit a new prayer (status defaults to pending) |
| GET | /api/prayers/:id | Retrieve full detail for a single prayer |
| POST | /api/prayers/:id/reports | Submit a report for a prayer |
| POST | /api/admin/session | Authenticate the administrator with a PIN and issue a JWT cookie |
| GET | /api/admin/prayers | List all prayers regardless of status (admin only) |
| PATCH | /api/admin/prayers/:id | Approve, reject, or edit a prayer (admin only) |
| DELETE | /api/admin/prayers/:id | Delete a prayer (admin only) |
| GET | /api/admin/stats | Retrieve aggregate statistics (admin only) |
| GET | /api/admin/export | Export prayer data as CSV (admin only) |

## **19.2 Glossary**

See Section 1.3 for the full table of definitions, acronyms, and abbreviations used throughout this document.

## **19.3 Revision History**

| Version | Date | Description |
| :---- | :---- | :---- |
| 1.0 | June 2026 | Initial Software Requirements Specification |
| 1.1 | September 2026 | Implementation-aligned requirements: comments, country, CAPTCHA, and general contact removed from v1; moderation, privacy, lifecycle, API, accessibility, and deployment behavior clarified. |

## **19.4 Version 1.1 Implementation Contract**

The following decisions are normative for version 1.1:

* The initial taxonomy is five categories (Prayer Intention, Thanksgiving, Reflection, Encouragement, and Memorial Prayer) and three moods (Hopeful, Grateful, and Sorrowful). Category and mood are required, may be added/renamed/reordered/deactivated by the administrator, and may not be hard-deleted while referenced.

* Every accepted prayer is stored as `pending`. Automated checks may flag duplicate, sensitive, crisis, or high-volume content, but do not auto-approve or auto-reject it. Configured prohibited whole-word terms are rejected before persistence.

* Prayer messages are plain text, 1–2,000 characters after trimming; titles are optional and limited to 150 characters. Anonymous submissions always persist a null display name. Administrators may anonymize a named prayer but may not assign a name to an originally anonymous prayer.

* The public wall uses newest approval first, cursor-based loading (24 initial, 48 maximum), title/message keyword search, and combinable category, mood, color, display-name, and submission-date filters. Pending, rejected, deleted, or unknown records return the same public 404 response.

* Reports are free-text (1–255 characters), deduplicated per unresolved prayer/device, and grouped by prayer in the administrator queue. Reports never automatically hide a prayer. Administrators may dismiss, edit/redact, reject, or soft-delete a reported prayer; soft-deleted prayers can be restored or permanently purged.

* Public abuse controls use a 20-prayer-per-device rolling 24-hour limit, a high-volume IP flag/delay after 100 per hour without IP blocking, and a 20-report-per-IP 15-minute limit. Device and IP values are stored only as keyed pseudonyms and are not logged.

* The administrator is a single PIN-only account. The 8–12 digit PIN is bcrypt-hashed with a deployment secret, protected by rate limiting and progressive delay, and issued an eight-hour HttpOnly/Secure JWT cookie with CSRF protection. A successful PIN change invalidates existing sessions.

* Core public and administrator flows conform to WCAG 2.1 AA, respect reduced-motion preferences, and use the Cloud Archive visual language. Production uses Node 24 LTS, React/Tailwind, Express, parameterized `pg` queries, PostgreSQL, Vercel, Render, and Neon. Free-tier cold starts are excluded from warmed performance measurements and uptime is a best-effort target.
