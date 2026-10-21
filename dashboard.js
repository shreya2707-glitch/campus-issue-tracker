const messageBox = document.getElementById('message');
const issueList = document.getElementById('issuesList');
const issueForm = document.getElementById('issueForm');
const maximumImageSize = 2 * 1024 * 1024;
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function showMessage(text, kind = 'error') {
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
  if (user.role !== 'student') {
    window.location.replace('/');
    return false;
  }
  document.getElementById('welcomeName').textContent = `Hello, ${user.name}`;
  return true;
}

document.querySelector('[data-logout]').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Could not log out. Please try again.');
    window.location.replace('/');
  } catch (error) {
    showMessage(error.message || 'Could not log out. Please try again.');
  }
});

document.getElementById('refreshIssues').addEventListener('click', loadIssues);

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
  if (typeof issue.imageUrl === 'string' && issue.imageUrl.startsWith('uploads/')) {
    const image = document.createElement('img');
    image.src = `/${issue.imageUrl}`;
    image.alt = `Photo attached to ${issue.title}`;
    image.className = 'issue-image';
    card.append(image);
  }
  return card;
}

async function loadIssues() {
  issueList.replaceChildren(element('p', 'muted', 'Loading your reports…'));
  try {
    const response = await fetch('/api/student/issues');
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    const issues = await response.json();
    if (!response.ok) throw new Error(issues.message || 'Could not load your reports.');
    issueList.replaceChildren();
    if (!issues.length) issueList.append(element('p', 'muted empty-state', 'You have not submitted any reports yet.'));
    for (const issue of issues) issueList.append(makeIssueCard(issue));
  } catch (error) {
    issueList.replaceChildren(element('p', 'message error', error.message || 'Could not load your reports.'));
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

for (const name of ['title', 'location', 'description']) {
  issueForm.elements.namedItem(name).addEventListener('input', (event) => event.currentTarget.setCustomValidity(''));
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

checkAccess().then((allowed) => {
  if (allowed) return loadIssues();
}).catch((error) => {
  showMessage(error.message || 'Could not check your sign-in status.');
});
