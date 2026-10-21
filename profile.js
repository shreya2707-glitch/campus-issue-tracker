const messageBox = document.getElementById('message');
const welcomeName = document.getElementById('welcomeName');
const roleBadge = document.getElementById('roleBadge');
const brandLink = document.getElementById('brandLink');
const backLink = document.getElementById('backLink');
const profileEmail = document.getElementById('profileEmail');
const fullName = document.getElementById('fullName');
const nameForm = document.getElementById('nameForm');
const passwordForm = document.getElementById('passwordForm');

function showMessage(text, kind = 'error') {
  messageBox.textContent = text;
  messageBox.className = `message ${kind}`;
  messageBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessage() {
  messageBox.textContent = '';
  messageBox.className = 'message';
}

async function loadProfile() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.replace('/');
      return;
    }
    const data = await res.json();
    const user = data.user;
    if (!user) {
      window.location.replace('/');
      return;
    }

    const homeUrl = user.role === 'admin' ? '/admin.html' : '/student.html';
    brandLink.href = homeUrl;
    backLink.href = homeUrl;
    backLink.textContent = user.role === 'admin' ? 'Back to Admin Workspace' : 'Back to Student Workspace';

    roleBadge.textContent = user.role === 'admin' ? 'Administrator' : 'Student';
    welcomeName.textContent = user.name;
    profileEmail.value = user.email;
    fullName.value = user.name;
  } catch (err) {
    showMessage('Could not load profile. Please refresh or try again.', 'error');
  }
}

nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage();
  const name = fullName.value.trim();
  if (name.length < 2 || name.length > 60) {
    showMessage('Name must be between 2 and 60 characters.', 'error');
    return;
  }

  const submitBtn = nameForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data.message || 'Could not update profile.', 'error');
      return;
    }
    fullName.value = data.user.name;
    welcomeName.textContent = data.user.name;
    showMessage('Profile name updated successfully.', 'success');
  } catch (err) {
    showMessage('Network error. Could not update profile.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!currentPassword) {
    showMessage('Please enter your current password.', 'error');
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    showMessage('New password must be at least 8 characters.', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    showMessage('New passwords do not match.', 'error');
    return;
  }

  const submitBtn = passwordForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data.message || 'Could not update password.', 'error');
      return;
    }
    passwordForm.reset();
    showMessage('Password updated successfully.', 'success');
  } catch (err) {
    showMessage('Network error. Could not update password.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

const logoutBtn = document.querySelector('[data-logout]');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.replace('/');
    }
  });
}

loadProfile();
