const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const multer = require('multer');
require('dotenv').config();

const uploadDirectory = path.join(__dirname, 'uploads');
const allowedImageTypes = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `issue-${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const allowedExtensions = allowedImageTypes[file.mimetype];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions && allowedExtensions.includes(ext)) return cb(null, true);
  const error = new Error('Only JPEG, PNG, or WebP images are allowed.');
  error.code = 'INVALID_IMAGE_TYPE';
  cb(error);
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 4, parts: 5, fieldSize: 1000 },
  fileFilter
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'campus_issue_tracker';
const client = new MongoClient(MONGO_URI);
let users;
let issues;

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('Set SESSION_SECRET to a random value with at least 32 characters in your .env file.');
}

app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'campus.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, dbName: DB_NAME, collectionName: 'sessions' }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: 'Please log in first.' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message: 'Please log in first.' });
    if (req.session.user.role !== role) return res.status(403).json({ message: 'You do not have permission for this action.' });
    next();
  };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const body = req.body || {};
    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (name.length < 2 || name.length > 60) return res.status(400).json({ message: 'Name must be between 2 and 60 characters.' });
    if (!validEmail(email) || email.length > 120) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (await users.findOne({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });

    const user = { name, email, passwordHash: await bcrypt.hash(password, 10), role: 'student', createdAt: new Date() };
    await users.insertOne(user);
    res.status(201).json({ message: 'Account created successfully. Please sign in with your new account.' });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ message: 'Could not create your account. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const body = req.body || {};
    const email = clean(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!validEmail(email) || !password) return res.status(400).json({ message: 'Enter your email and password.' });
    const user = await users.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    req.session.regenerate((error) => {
      if (error) return res.status(500).json({ message: 'Could not start your session.' });
      req.session.user = publicUser(user);
      res.json({ user: req.session.user });
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Could not log in. Please try again.' });
  }
});

app.get('/api/auth/me', requireLogin, (req, res) => res.json({ user: req.session.user }));

app.post('/api/auth/logout', requireLogin, (req, res) => {
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ message: 'Could not log out.' });
    res.clearCookie('campus.sid');
    res.json({ message: 'Logged out.' });
  });
});

// Update signed-in user profile name
app.patch('/api/auth/profile', requireLogin, async (req, res) => {
  try {
    const name = clean(req.body && req.body.name);
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: 'Name must be between 2 and 60 characters.' });
    }
    const userId = req.session.user.id;
    const setObj = {};
    setObj['name'] = name;
    setObj['updatedAt'] = new Date();
    const updateOp = {};
    updateOp['$set'] = setObj;
    const result = await users.updateOne({ _id: new ObjectId(userId) }, updateOp);
    if (!result.matchedCount) return res.status(404).json({ message: 'User account not found.' });
    req.session.user.name = name;
    res.json({ message: 'Profile name updated successfully.', user: req.session.user });
  } catch (error) {
    console.error('Profile update error:', error.message);
    res.status(500).json({ message: 'Could not update profile.' });
  }
});

// Change signed-in user password with current password verification
app.patch('/api/auth/password', requireLogin, async (req, res) => {
  try {
    const body = req.body || {};
    const currPass = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPass = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!currPass || !newPass) {
      return res.status(400).json({ message: 'Enter your current password and new password.' });
    }
    if (newPass.length < 8 || newPass.length > 72) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }
    const userId = req.session.user.id;
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ message: 'User account not found.' });
    const isMatch = await bcrypt.compare(currPass, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });
    const passwordHash = await bcrypt.hash(newPass, 10);
    const setObj = {};
    setObj['passwordHash'] = passwordHash;
    setObj['updatedAt'] = new Date();
    const updateOp = {};
    updateOp['$set'] = setObj;
    await users.updateOne({ _id: new ObjectId(userId) }, updateOp);
    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password change error:', error.message);
    res.status(500).json({ message: 'Could not update password.' });
  }
});

const issueCategories = ['Classroom', 'IT / Internet', 'Hostel / Facilities', 'Cafeteria', 'Other'];

async function removeUploadedFile(file) {
  if (!file) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Issue photo cleanup error:', error.message);
  }
}

async function imageMatchesFile(file) {
  const handle = await fs.open(file.path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    let detectedType = '';
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      detectedType = 'image/jpeg';
    } else if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      detectedType = 'image/png';
    } else if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
      detectedType = 'image/webp';
    }
    const ext = path.extname(file.originalname).toLowerCase();
    return detectedType === file.mimetype && allowedImageTypes[detectedType].includes(ext);
  } finally {
    await handle.close();
  }
}

app.get('/api/student/issues', requireRole('student'), async (req, res) => {
  try {
    const records = await issues.find({ studentId: req.session.user.id }).sort({ createdAt: -1 }).toArray();
    res.json(records.map((issue) => ({
      _id: issue._id.toString(),
      title: issue.title,
      category: issue.category,
      location: issue.location,
      description: issue.description,
      status: issue.status,
      imageUrl: issue.imageUrl,
      createdAt: issue.createdAt
    })));
  } catch (error) {
    console.error('Student issue list error:', error.message);
    res.status(500).json({ message: 'Could not load your reports.' });
  }
});

app.post('/api/student/issues', requireRole('student'), (req, res) => {
  upload.single('image')(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image must be 2 MB or smaller.' });
      }
      if (uploadError.code === 'INVALID_IMAGE_TYPE') {
        return res.status(400).json({ message: uploadError.message });
      }
      if (uploadError instanceof multer.MulterError) {
        return res.status(400).json({ message: 'Submit one photo and the required report fields.' });
      }
      console.error('Issue upload error:', uploadError.message);
      return res.status(500).json({ message: 'Could not upload the photo.' });
    }

    let savedImage = false;
    try {
      const body = req.body || {};
      const title = clean(body.title);
      const category = clean(body.category);
      const location = clean(body.location);
      const description = clean(body.description);
      if (title.length < 3 || title.length > 100) return res.status(400).json({ message: 'Title must be between 3 and 100 characters.' });
      if (!issueCategories.includes(category)) return res.status(400).json({ message: 'Choose a valid category.' });
      if (location.length < 2 || location.length > 100) return res.status(400).json({ message: 'Location must be between 2 and 100 characters.' });
      if (description.length < 10 || description.length > 1000) return res.status(400).json({ message: 'Description must be between 10 and 1000 characters.' });
      if (req.file && !(await imageMatchesFile(req.file))) {
        return res.status(400).json({ message: 'The photo must be a valid JPEG, PNG, or WebP image.' });
      }

      const issue = {
        title,
        category,
        location,
        description,
        status: 'Reported',
        imageUrl: req.file ? `uploads/${req.file.filename}` : null,
        studentId: req.session.user.id,
        studentName: req.session.user.name,
        createdAt: new Date()
      };
      const result = await issues.insertOne(issue);
      savedImage = Boolean(req.file);
      res.status(201).json({ issue: { ...issue, _id: result.insertedId.toString() } });
    } catch (error) {
      console.error('Issue create error:', error.message);
      res.status(500).json({ message: 'Could not save this report.' });
    } finally {
      if (!savedImage) await removeUploadedFile(req.file);
    }
  });
});

// Administrator routes: view reports, update status, and view status counts
app.get('/api/admin/issues', requireRole('admin'), async (req, res) => {
  try {
    const records = await issues.find().sort({ createdAt: -1 }).toArray();
    res.json(records.map((issue) => ({
      _id: issue._id.toString(),
      title: issue.title,
      category: issue.category,
      location: issue.location,
      description: issue.description,
      status: issue.status,
      imageUrl: issue.imageUrl,
      studentId: issue.studentId,
      studentName: issue.studentName || 'Student',
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt
    })));
  } catch (error) {
    console.error('Admin issue list error:', error.message);
    res.status(500).json({ message: 'Could not load issues.' });
  }
});

app.get('/api/issues', requireRole('admin'), async (req, res) => {
  try {
    const records = await issues.find().sort({ createdAt: -1 }).toArray();
    res.json(records.map((issue) => ({
      _id: issue._id.toString(),
      title: issue.title,
      category: issue.category,
      location: issue.location,
      description: issue.description,
      status: issue.status,
      imageUrl: issue.imageUrl,
      studentId: issue.studentId,
      studentName: issue.studentName || 'Student',
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt
    })));
  } catch (error) {
    console.error('Issue list error:', error.message);
    res.status(500).json({ message: 'Could not load issues.' });
  }
});

async function updateIssueStatus(req, res) {
  try {
    const { id } = req.params;
    const status = req.body && req.body.status;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid issue ID.' });
    if (!['Reported', 'In Progress', 'Resolved'].includes(status)) {
      return res.status(400).json({ message: 'Choose a valid status.' });
    }
    const result = await issues.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ message: 'Issue not found.' });
    res.json({ message: 'Issue status updated.' });
  } catch (error) {
    console.error('Issue status update error:', error.message);
    res.status(500).json({ message: 'Could not update issue status.' });
  }
}

app.patch('/api/admin/issues/:id/status', requireRole('admin'), updateIssueStatus);
app.patch('/api/issues/:id/status', requireRole('admin'), updateIssueStatus);

app.get('/api/admin/stats', requireRole('admin'), async (req, res) => {
  try {
    const total = await issues.countDocuments();
    const reported = await issues.countDocuments({ status: 'Reported' });
    const inProgress = await issues.countDocuments({ status: 'In Progress' });
    const resolved = await issues.countDocuments({ status: 'Resolved' });
    res.json({ total, reported, inProgress, resolved });
  } catch (error) {
    console.error('Admin stats error:', error.message);
    res.status(500).json({ message: 'Could not load stats.' });
  }
});

app.get('/profile.html', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/student.html', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  if (req.session.user.role !== 'student') return res.redirect('/admin.html');
  res.sendFile(path.join(__dirname, 'student.html'));
});

app.get('/admin.html', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  if (req.session.user.role !== 'admin') return res.redirect('/student.html');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use('/uploads', express.static(uploadDirectory));
app.use(express.static(__dirname));

async function start() {
  await fs.mkdir(uploadDirectory, { recursive: true });
  await client.connect();
  const db = client.db(DB_NAME);
  users = db.collection('users');
  issues = db.collection('issues');
  await users.createIndex({ email: 1 }, { unique: true });

  if (await issues.countDocuments() === 0) {
    await issues.insertMany([
      { title: 'Projector not working in Room 204', category: 'Classroom', location: 'Academic Block B', description: 'The HDMI cable is broken and the display turns off repeatedly.', status: 'In Progress', studentName: 'Demo Student', createdAt: new Date() },
      { title: 'Wi-Fi disconnected in Central Library', category: 'IT / Internet', location: 'Library 2nd Floor', description: 'Students cannot access the internet in the quiet study area.', status: 'Reported', studentName: 'Demo Student', createdAt: new Date() },
      { title: 'Water cooler leaking near stairs', category: 'Hostel / Facilities', location: 'Hostel 1 Ground Floor', description: 'Water is spilling onto the corridor floor and making it slippery.', status: 'Resolved', studentName: 'Demo Student', createdAt: new Date() }
    ]);
  }

  // Create the admin account from local .env values; admins cannot self-register.
  const adminEmail = clean(process.env.ADMIN_EMAIL).toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (adminEmail && validEmail(adminEmail) && adminPassword.length >= 8) {
    await users.updateOne(
      { email: adminEmail },
      { $setOnInsert: { name: 'Campus Admin', email: adminEmail, role: 'admin', passwordHash: await bcrypt.hash(adminPassword, 10), createdAt: new Date() } },
      { upsert: true }
    );
  }

  app.listen(PORT, () => console.log(`Campus Issue Tracker running at http://localhost:${PORT}`));
}

start().catch((error) => {
  console.error('Could not start the app. Check that local MongoDB is running and .env is configured.');
  console.error(error.message);
  process.exit(1);
});
