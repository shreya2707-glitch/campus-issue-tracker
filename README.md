# Campus Issue Tracker

A beginner-friendly full-stack campus issue reporting web application. Students can create accounts, report problems with optional photo attachments, and track the progress of their reports. Administrators log in with dedicated credentials configured locally to review reports, view live status counts, and update statuses from Reported to In Progress or Resolved. Data and login sessions are persisted using a local MongoDB database.

## Project Structure

```text
index.html          Sign-in landing page
signup.html         Student registration page
student.html        Student reporting and issue tracking workspace
admin.html          Administrator issue management workspace
profile.html        User profile name and password management page
style.css           Shared cohesive responsive stylesheet
auth.js             Sign-in, registration, and initial redirect handling
dashboard.js        Shared dashboard logic for student and administrator workspaces
profile.js          Profile update and password change handling
server.js           Express server, routes, session store, upload handler, MongoDB connection
.env.example        Environment variable template for local configuration
.gitignore          Git rules ignoring .env, node_modules, and user-uploaded photos
package.json        Project dependencies and start script
PROJECT_REPORT.md   Two-page project summary report
README.md           Setup and usage documentation
uploads/            Local directory where uploaded issue photos are saved
```

## Prerequisites

- **Node.js** (v18 or higher recommended) and **npm**
- **MongoDB Community Server** installed and running locally at `mongodb://127.0.0.1:27017`

---

## Setup and Run Instructions

### 1. Start MongoDB

Make sure local MongoDB is running. If installed as a Windows service:

```powershell
net start MongoDB
```

Or start the daemon manually with your data directory:

```powershell
mongod --dbpath "C:\data\db"
```

### 2. Install Dependencies

Open a terminal in the project directory and run:

```powershell
npm install
```

### 3. Create and Configure `.env`

Copy the provided `.env.example` to create your private `.env` file:

```powershell
Copy-Item .env.example .env
```

Open `.env` in any text editor and configure:
- `PORT`: Server port (default: `3000`).
- `MONGO_URI`: MongoDB connection string (default: `mongodb://127.0.0.1:27017`).
- `SESSION_SECRET`: A secure random secret string of at least 32 characters.
- `ADMIN_EMAIL`: Email for the administrator account (e.g. `admin@campus.edu`).
- `ADMIN_PASSWORD`: Administrator password of at least 8 characters.

> Note: `.env` is ignored by Git. Never commit production secrets or real passwords to version control.

### 4. Start the Application

```powershell
npm start
```

When started, you should see:
```text
Campus Issue Tracker running at http://localhost:3000
```

### 5. Open in Browser

Open your browser and navigate to:
```text
http://localhost:3000
```

---

## User Roles and Workflows

### Student Workflow
1. Navigate to `http://localhost:3000` and click **Create an account** (or visit `/signup.html`).
2. Fill in your name, email, and password (minimum 8 characters) to register. Public registrations are automatically assigned the `student` role.
3. Sign in at `index.html`. You are directed to `/student.html`.
4. In the **Report a problem** form, submit an issue:
   - **Title**: 3 to 100 characters.
   - **Category**: Classroom, IT / Internet, Hostel / Facilities, Cafeteria, or Other.
   - **Location**: Building and room (2 to 100 characters).
   - **Description**: Detailed explanation (10 to 1000 characters).
   - **Photo attachment (optional)**: JPEG, PNG, or WebP up to 2 MB.
5. Submitted issues appear immediately in the **My reported issues** list with status badges (`Reported`, `In Progress`, or `Resolved`).
6. Click **Refresh** at any time to check for status changes made by administrators.

### Administrator Workflow
1. Sign in at `index.html` using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` credentials configured in your `.env` file.
2. The server automatically routes administrators to `/admin.html`.
3. In the admin workspace, you will see:
   - **Status summary cards**: Real-time totals for Total reports, Reported, In progress, and Resolved.
   - **Student reports list**: All reported campus issues showing title, category, location, description, reporter name, submission timestamp, and attached photo (if present).
   - **Status controls**: A dropdown menu on each issue card allowing you to select **Reported**, **In Progress**, or **Resolved**, and click **Save status**.
4. Saving a status update instantly saves the change to MongoDB, reloads the reports, and updates the status counts.
5. Click **Refresh reports** to pull the latest reports submitted by students.

### Profile Management
- Both students and administrators can click **My Profile** in the top navigation bar to access `/profile.html`.
- Users can update their display name and change their password by verifying their current password.

### Sample Seed Data
- When the server starts for the first time with an empty `issues` collection, it automatically seeds 3 sample reports (one Reported, one In Progress, and one Resolved) so administrators can immediately view reports and verify counts.

---

## Security and Verification Details

- **Role-Based Access Control**: Pages (`student.html`, `admin.html`) and API endpoints (`/api/student/*`, `/api/admin/*`) require active sessions and verify the user's role. Students cannot access administrative controls or update issue statuses.
- **Password Security**: Passwords are encrypted with `bcryptjs` using 10 salt rounds before storage.
- **Session Management**: Session cookies are managed securely with `express-session` and persisted in MongoDB via `connect-mongo`.
- **File Upload Protection**: Issue photo attachments are restricted to JPEG, PNG, and WebP formats up to 2 MB. Multer safely saves files with random UUID filenames, and server logic checks magic byte headers before finalizing uploads.
