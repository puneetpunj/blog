async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function createSocialLink(href, label) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer noopener';
  a.className = 'text-neutral-300 hover:text-white inline-flex items-center gap-2';
  a.textContent = label;
  return a;
}

function renderProjects(projects) {
  const grid = document.getElementById('projectsGrid');
  grid.innerHTML = '';
  for (const project of projects) {
    const card = document.createElement('article');
    card.className = 'rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold">${project.name}</h3>
          <p class="mt-1 text-sm text-neutral-300">${project.description}</p>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap gap-2 text-xs text-neutral-300">
        ${Array.isArray(project.tech) ? project.tech.map(t => `<span class='px-2 py-1 rounded-md bg-white/10'>${t}</span>`).join('') : ''}
      </div>
      <div class="mt-4 flex items-center gap-3 text-sm">
        ${project.url ? `<a class='text-brand-300 hover:text-brand-200' href='${project.url}' target='_blank' rel='noreferrer noopener'>Live ↗</a>` : ''}
        ${project.repo ? `<a class='text-neutral-300 hover:text-white' href='${project.repo}' target='_blank' rel='noreferrer noopener'>Code ↗</a>` : ''}
      </div>
    `;
    grid.appendChild(card);
  }
}

function renderPosts(posts) {
  const grid = document.getElementById('postsGrid');
  grid.innerHTML = '';
  if (!Array.isArray(posts) || posts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-neutral-400';
    empty.textContent = 'No posts found yet. Configure your Medium username and run the fetch script.';
    grid.appendChild(empty);
    return;
  }
  for (const post of posts.slice(0, 6)) {
    const card = document.createElement('article');
    card.className = 'rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition overflow-hidden';
    const thumbnail = post.thumbnail || post.image || '';
    card.innerHTML = `
      ${thumbnail ? `<img class='w-full h-40 object-cover' src='${thumbnail}' alt='${post.title}' />` : ''}
      <div class='p-5'>
        <h3 class='text-lg font-semibold'><a href='${post.link}' target='_blank' rel='noreferrer noopener' class='hover:underline decoration-dotted'>${post.title}</a></h3>
        <p class='mt-2 text-sm text-neutral-300 line-clamp-3'>${post.description || ''}</p>
        <p class='mt-3 text-xs text-neutral-400'>${post.pubDate ? new Date(post.pubDate).toLocaleDateString() : ''}</p>
      </div>
    `;
    grid.appendChild(card);
  }
}

async function detectResumePath() {
  const candidates = [
    './public/resume.pdf',
    './Puneet_Punj_Resume.pdf'
  ];
  for (const href of candidates) {
    try {
      const res = await fetch(href, { method: 'HEAD' });
      if (res.ok) return href;
    } catch {}
  }
  return null;
}

async function loadPdfJs() {
  // Load pdf.js (UMD build) dynamically
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
  if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.js';
  }
  return pdfjsLib;
}

async function extractTextFromPdf(url) {
  try {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    const maxPages = Math.min(pdf.numPages, 3);
    let text = '';
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n';
    }
    return text;
  } catch (e) {
    console.warn('Resume parse failed', e);
    return '';
  }
}

function parseDetailsFromText(text) {
  const details = {};
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) details.email = emailMatch[0];
  const ghMatch = text.match(/https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-_.]+)/i);
  if (ghMatch) details.githubUrl = `https://github.com/${ghMatch[1]}`;
  const liMatch = text.match(/https?:\/\/(?:[a-z]+\.)?linkedin\.com\/in\/[^\s)]+/i);
  if (liMatch) details.linkedinUrl = liMatch[0].replace(/[).,]$/, '');
  return details;
}

async function fetchGithubProjectsFromApi(githubUrlOrUser) {
  try {
    let username = githubUrlOrUser || '';
    const m = username.match && username.match(/github\.com\/([^/]+)/i);
    if (m) username = m[1];
    if (!username) return [];
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) return [];
    const repos = await res.json();
    const projects = repos
      .filter(r => !r.fork)
      .map(r => ({
        name: r.name,
        description: r.description || '',
        tech: Array.isArray(r.topics) ? r.topics.slice(0, 6) : [],
        url: r.homepage || '',
        repo: r.html_url,
        stars: r.stargazers_count || 0,
        updatedAt: r.updated_at
      }))
      .sort((a, b) => (b.stars - a.stars) || (new Date(b.updatedAt) - new Date(a.updatedAt)))
      .slice(0, 12);
    return projects;
  } catch {
    return [];
  }
}

async function boot() {
  const [configRaw, posts, ghProjects] = await Promise.all([
    fetchJson('./config.json').catch(() => ({ name: '', title: '', bio: '', email: '', avatar: '', social: {}, projects: [] })),
    fetchJson('./data/medium.json').catch(() => []),
    fetchJson('./data/projects.json').catch(() => null)
  ]);

  const config = { ...configRaw };

  const nameEl = document.getElementById('name');
  const titleEl = document.getElementById('title');
  const bioEl = document.getElementById('bio');
  const avatarEl = document.getElementById('avatar');
  const socialLinksEl = document.getElementById('socialLinks');
  const emailLinkEl = document.getElementById('emailLink');
  const githubLinkEl = document.getElementById('githubLink');
  const footerTextEl = document.getElementById('footerText');
  const resumeLinkEl = document.getElementById('resumeLink');

  // Detect resume path and update link visibility
  const resumePath = await detectResumePath();
  if (resumePath) {
    resumeLinkEl.classList.remove('hidden');
    resumeLinkEl.href = resumePath;
  } else {
    resumeLinkEl.classList.add('hidden');
  }

  // If key details missing or placeholders, try extracting from resume
  const needsEmail = !config.email || /example\.com$/i.test(config.email);
  const needsGithub = !config.social?.github || /yourhandle/.test(config.social.github);
  const needsLinkedIn = !config.social?.linkedin || /yourhandle/.test(config.social.linkedin);
  if (resumePath && (needsEmail || needsGithub || needsLinkedIn)) {
    const text = await extractTextFromPdf(resumePath);
    const details = parseDetailsFromText(text);
    config.email = needsEmail && details.email ? details.email : config.email;
    config.social = config.social || {};
    if (needsGithub && details.githubUrl) config.social.github = details.githubUrl;
    if (needsLinkedIn && details.linkedinUrl) config.social.linkedin = details.linkedinUrl;
  }

  nameEl.textContent = config.name || 'Puneet Punj';
  titleEl.textContent = config.title || 'Software Engineer';
  bioEl.textContent = config.bio || 'Software engineer focused on cloud and scalable systems.';
  emailLinkEl.href = config.email ? `mailto:${config.email}` : '#';
  emailLinkEl.textContent = config.email || 'email@domain.com';
  footerTextEl.innerHTML = `© <span id="year"></span> ${config.name || 'Puneet Punj'}. All rights reserved.`;
  document.getElementById('year').textContent = String(new Date().getFullYear());

  // Avatar fallback to initials if missing or 404
  const setAvatar = (src) => { avatarEl.src = src; };
  const avatarSrc = config.avatar && !/^\s*$/.test(config.avatar)
    ? (config.avatar.startsWith('http') ? config.avatar : `./${config.avatar.replace(/^\//, '')}`)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(config.name || 'Puneet Punj')}&background=1d3094&color=fff&size=256`;
  setAvatar(avatarSrc);
  avatarEl.onerror = () => setAvatar(`https://ui-avatars.com/api/?name=${encodeURIComponent(config.name || 'Puneet Punj')}&background=1d3094&color=fff&size=256`);

  // Social links
  socialLinksEl.innerHTML = '';
  if (config.social?.github) {
    githubLinkEl.classList.remove('hidden');
    githubLinkEl.href = config.social.github;
    socialLinksEl.appendChild(createSocialLink(config.social.github, 'GitHub'));
  }
  if (config.social?.linkedin) {
    socialLinksEl.appendChild(createSocialLink(config.social.linkedin, 'LinkedIn'));
  }
  if (config.social?.twitter) {
    socialLinksEl.appendChild(createSocialLink(config.social.twitter, 'Twitter'));
  }
  if (config.social?.medium) {
    const m = config.social.medium;
    const mediumUrl = /^https?:\/\//i.test(m) ? m : `https://medium.com/@${m}`;
    socialLinksEl.appendChild(createSocialLink(mediumUrl, 'Medium'));
  }

  // Merge projects: pre-fetched + manual
  const manualProjects = Array.isArray(config.projects) ? config.projects : [];
  const apiProjects = Array.isArray(ghProjects) ? ghProjects : [];
  let mergedProjects = [];
  const mergedByName = new Map();
  for (const p of [...apiProjects, ...manualProjects]) {
    if (!p || !p.name) continue;
    if (!mergedByName.has(p.name)) mergedByName.set(p.name, p);
  }
  mergedProjects = Array.from(mergedByName.values());

  // If still empty and we have a GitHub URL, fetch directly client-side
  if ((!mergedProjects || mergedProjects.length === 0) && config.social?.github) {
    try {
      const extra = await fetchGithubProjectsFromApi(config.social.github);
      if (extra.length) mergedProjects = extra;
    } catch {}
  }

  if (mergedProjects.length) renderProjects(mergedProjects);

  renderPosts(posts);
}

boot().catch((err) => {
  console.error(err);
});