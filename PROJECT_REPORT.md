# Campus Issue Tracker

## Motivation for Selection

Students frequently encounter campus maintenance problems—such as broken classroom projectors, Wi-Fi connectivity drops, plumbing leaks, or hostel facility defects—but lack a direct, transparent channel to report them and track resolution progress. Traditional manual complaints often lead to lost reports, duplicate tickets, and poor communication between students and facility managers. Campus Issue Tracker provides a unified, accessible web platform where students can report issues with optional photo evidence and facility administrators can review reports, update statuses in real time, and monitor campus-wide resolution metrics.

## Objectives

- Enable students to register securely, report campus maintenance problems with optional photo attachments, and track the status of their reports.
- Provide administrators with a protected management workspace to inspect student issues, attached photographs, and reporter details.
- Allow administrators to transition issue statuses across Reported, In Progress, and Resolved with immediate count recalculation.
- Implement role-based access control protecting student and administrative pages and API endpoints.
- Build a lightweight, beginner-friendly full-stack application using HTML5, Vanilla CSS, JavaScript, Node.js, Express, and local MongoDB storage.

## Customer Base / Target Users

- **Students**: College and university students who encounter infrastructure, IT, academic, or hostel issues across campus and need a simple, self-service channel to log reports and check updates.
- **Campus Administrators & Facilities Staff**: Campus maintenance teams, IT administrators, and facility managers responsible for triaging incoming student reports, scheduling repairs, and recording progress.

## Project Summary

Campus Issue Tracker is a responsive full-stack web application designed for campus maintenance communication. The application features user authentication, role-based dashboards, multipart file uploads, and persistent database storage.

Students create accounts via a public registration form (`signup.html`), which assigns the `student` role, and authenticate via a session-backed login form (`index.html`). In the student workspace (`student.html`), students submit reports specifying title, category, campus location, description, and an optional image attachment (JPEG, PNG, WebP up to 2 MB) stored safely on disk and referenced in MongoDB. Students can track the progress of their own submissions and refresh status updates dynamically.

Campus administrators authenticate using pre-provisioned credentials defined in local environment variables. The administrator workspace (`admin.html`) displays real-time status summary cards (Total reports, Reported, In Progress, and Resolved) alongside the complete list of student reports. For each issue, administrators can view full descriptions, reporter names, timestamps, attached photos, and an inline status selector. Changing an issue's status sends a protected `PATCH` request to the Express server, persisting the update to MongoDB and refreshing the status count metrics instantly.

The backend is built with Express, `express-session`, and `connect-mongo`, with passwords securely hashed using `bcryptjs`. Data validation occurs on both client and server, ensuring input constraints and preventing unauthorized role escalation.

## Git Repository Link

https://github.com/vatsalpostiwala/campus-issue-tracker
