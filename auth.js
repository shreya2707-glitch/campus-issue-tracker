const messageBox = document.getElementById('message');

function showMessage(text, kind = 'error') {
  messageBox.textContent = text;
  messageBox.className = `message ${kind}`;
}

// Display registration success message if redirected from signup page
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('registered') === 'true') {
  showMessage('Account created successfully. Please sign in with your new account.', 'success');
}

async function getCurrentUser() {
  const response = await fetch('/api/auth/me');
  if (!response.ok) return null;
  const data = await response.json();
  return data.user;
}

function goToWorkspace(user) {
  window.location.href = user.role === 'admin' ? '/admin.html' : '/student.html';
}

getCurrentUser().then((user) => { if (user) goToWorkspace(user); }).catch(() => {});

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value })
      });
      const data = await response.json();
      if (!response.ok) return showMessage(data.message || 'Could not sign in.');
      goToWorkspace(data.user);
    } catch {
      showMessage('Cannot reach the server. Check that the app is running.');
    } finally {
      submitButton.disabled = false;
    }
  });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!signupForm.reportValidity()) return;
    if (signupForm.password.value !== signupForm.confirmPassword.value) {
      signupForm.confirmPassword.setCustomValidity('Passwords do not match.');
      signupForm.confirmPassword.reportValidity();
      signupForm.confirmPassword.addEventListener('input', () => signupForm.confirmPassword.setCustomValidity(''), { once: true });
      return;
    }
    const submitButton = signupForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('name').value,
          email: document.getElementById('email').value,
          password: document.getElementById('password').value
        })
      });
      const data = await response.json();
      if (!response.ok) return showMessage(data.message || 'Could not create the account.');
      window.location.href = 'index.html?registered=true';
    } catch {
      showMessage('Cannot reach the server. Check that the app is running.');
    } finally {
      submitButton.disabled = false;
    }
  });
}
