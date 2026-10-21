const pageRole = document.body.dataset.page;
const messageBox = document.getElementById('message');
const issueList = document.getElementById('issuesList');
const issueForm = document.getElementById('issueForm');
const maximumImageSize = 2 * 1024 * 1024;
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function showMessage(text, kind = 'error') {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.className = text ? `message ${kind}` : 'message';
}

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

async function checkAccess() {
  const response = await fetch('/api/auth/me');
  if (response.status === 401) {
    window.location.replace('/');
    return false;
  }
  if (!response.ok) throw new Error('Could not check your sign-in status.');
  const { user } = await response.json();
  if (pageRole && user.role !== pageRole) {
    window.location.replace(user.role === 'admin' ? '/admin.html' : '/student.html');
    return false;
  }
  const welcome = document.getElementById('welcomeName');
  if (welcome) welcome.textContent = `Hello, ${user.name}`;
  return true;
}

const logoutButton = document.querySelector('[data-logout]');
if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not log out. Please try again.');
      window.location.replace('/');
    } catch (error) {
      showMessage(error.message || 'Could not log out. Please try again.');
    }
  });
}

const refreshButton = document.getElementById('refreshIssues');
if (refreshButton) {
  refreshButton.addEventListener('click', loadIssues);
}

function makeIssueCard(issue) {
  const card = element('article', 'issue-card');
  const heading = element('div', 'issue-heading');
  heading.append(element('h3', '', issue.title));
  const status = typeof issue.status === 'string' ? issue.status : 'Reported';
  const statusClass = status.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  heading.append(element('span', `status-badge status-${statusClass}`, status));
  card.append(heading);
  card.append(element('p', 'issue-meta', `${issue.category} · ${issue.location}`));
  card.append(element('p', 'issue-description', issue.description));
  if (issue.createdAt) {
    const date = new Date(issue.createdAt);
    if (!Number.isNaN(date.getTime())) card.append(element('p', 'issue-meta', `Submitted ${date.toLocaleString()}`));
  }
  if (typeof issue.imageUrl === 'string' && (issue.imageUrl.startsWith('uploads/') || issue.imageUrl.startsWith('/uploads/'))) {
    const image = document.createElement('img');
    image.src = issue.imageUrl.startsWith('/') ? issue.imageUrl : `/${issue.imageUrl}`;
    image.alt = `Photo attached to ${issue.title}`;
    image.className = 'issue-image';
    card.append(image);
  }
  if (pageRole === 'admin') {
    card.append(element('p', 'issue-reporter', `Reported by ${issue.studentName || 'Student'}`));
    const controls = element('div', 'status-controls');
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Status for ${issue.title}`);
    for (const optionStatus of ['Reported', 'In Progress', 'Resolved']) {
      const option = element('option', '', optionStatus);
      option.value = optionStatus;
      option.selected = optionStatus === status;
      select.append(option);
    }
    const saveButton = element('button', 'button small-button', 'Save status');
    saveButton.type = 'button';
    saveButton.addEventListener('click', () => updateStatus(issue._id, select.value, saveButton));
    controls.append(select, saveButton);
    card.append(controls);
  }
  return card;
}

function updateStats(issues) {
  const total = document.getElementById('totalCount');
  const reported = document.getElementById('reportedCount');
  const progress = document.getElementById('progressCount');
  const resolved = document.getElementById('resolvedCount');
  if (total) total.textContent = issues.length;
  if (reported) reported.textContent = issues.filter((i) => i.status === 'Reported').length;
  if (progress) progress.textContent = issues.filter((i) => i.status === 'In Progress').length;
  if (resolved) resolved.textContent = issues.filter((i) => i.status === 'Resolved').length;
}

async function updateStatus(id, status, button) {
  button.disabled = true;
  showMessage('');
  try {
    const response = await fetch(`/api/admin/issues/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not update status.');
    showMessage('Issue status updated.', 'success');
    await loadIssues();
  } catch (error) {
    showMessage(error.message || 'Could not update status.');
  } finally {
    button.disabled = false;
  }
}

async function loadIssues() {
  const loadingText = pageRole === 'admin' ? 'Loading issues…' : 'Loading your reports…';
  issueList.replaceChildren(element('p', 'muted', loadingText));
  try {
    const endpoint = pageRole === 'admin' ? '/api/admin/issues' : '/api/student/issues';
    const response = await fetch(endpoint);
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    const issues = await response.json();
    if (!response.ok) throw new Error(issues.message || (pageRole === 'admin' ? 'Could not load issues.' : 'Could not load your reports.'));
    issueList.replaceChildren();
    if (!issues.length) {
      const emptyText = pageRole === 'admin' ? 'No issues have been reported yet.' : 'You have not submitted any reports yet.';
      issueList.append(element('p', 'muted empty-state', emptyText));
    }
    for (const issue of issues) issueList.append(makeIssueCard(issue));
    if (pageRole === 'admin') updateStats(issues);
  } catch (error) {
    const defaultErr = pageRole === 'admin' ? 'Could not load issues.' : 'Could not load your reports.';
    issueList.replaceChildren(element('p', 'message error', error.message || defaultErr));
  }
}

function validateTextFields() {
  const fields = [
    ['title', 3, 100, 'Title must be between 3 and 100 characters.'],
    ['location', 2, 100, 'Location must be between 2 and 100 characters.'],
    ['description', 10, 1000, 'Description must be between 10 and 1000 characters.']
  ];
  for (const [name, minimum, maximum, message] of fields) {
    const field = issueForm.elements.namedItem(name);
    const length = field.value.trim().length;
    field.setCustomValidity(length < minimum || length > maximum ? message : '');
  }
  return issueForm.reportValidity();
}

if (issueForm) {
  for (const name of ['title', 'location', 'description']) {
    const input = issueForm.elements.namedItem(name);
    if (input) input.addEventListener('input', (event) => event.currentTarget.setCustomValidity(''));
  }

  issueForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateTextFields()) return;

    const fileInput = issueForm.elements.namedItem('image');
    const file = fileInput.files[0];
    if (file && !allowedImageTypes.includes(file.type)) {
      showMessage('Only JPEG, PNG, or WebP images are allowed.');
      fileInput.focus();
      return;
    }
    if (file && file.size > maximumImageSize) {
      showMessage('Image must be 2 MB or smaller.');
      fileInput.focus();
      return;
    }

    const formData = new FormData(issueForm);
    for (const name of ['title', 'category', 'location', 'description']) {
      formData.set(name, issueForm.elements.namedItem(name).value.trim());
    }

    const button = issueForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage('');
    try {
      const response = await fetch('/api/student/issues', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not submit your report.');
      issueForm.reset();
      showMessage('Your report has been submitted.', 'success');
      await loadIssues();
    } catch (error) {
      showMessage(error.message || 'Could not submit your report.');
    } finally {
      button.disabled = false;
    }
  });
}

checkAccess().then((allowed) => {
  if (allowed) return loadIssues();
}).catch((error) => {
  showMessage(error.message || 'Could not check your sign-in status.');
});
