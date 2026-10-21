const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'campus_issue_tracker';
const client = new MongoClient(MONGO_URI);
let users;

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

app.get('/profile.html', (req, res) => { if (!req.session.user) return res.redirect('/'); res.sendFile(path.join(__dirname, 'profile.html')); });
app.use(express.static(__dirname));

async function start() {
  await client.connect();
  const db = client.db(DB_NAME);
  users = db.collection('users');
  await users.createIndex({ email: 1 }, { unique: true });

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
