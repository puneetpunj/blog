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
        ${project.tech.map(t => `<span class='px-2 py-1 rounded-md bg-white/10'>${t}</span>`).join('')}
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

async function boot() {
  const [config, posts, ghProjects] = await Promise.all([
    fetchJson('/portfolio/config.json'),
    fetchJson('/portfolio/data/medium.json').catch(() => []),
    fetchJson('/portfolio/data/projects.json').catch(() => null)
  ]);

  const nameEl = document.getElementById('name');
  const titleEl = document.getElementById('title');
  const bioEl = document.getElementById('bio');
  const avatarEl = document.getElementById('avatar');
  const socialLinksEl = document.getElementById('socialLinks');
  const emailLinkEl = document.getElementById('emailLink');
  const githubLinkEl = document.getElementById('githubLink');
  const footerTextEl = document.getElementById('footerText');
  const resumeLinkEl = document.getElementById('resumeLink');

  nameEl.textContent = config.name;
  titleEl.textContent = config.title;
  bioEl.textContent = config.bio;
  emailLinkEl.href = `mailto:${config.email}`;
  emailLinkEl.textContent = config.email;
  footerTextEl.innerHTML = `© <span id="year"></span> ${config.name}. All rights reserved.`;
  document.getElementById('year').textContent = String(new Date().getFullYear());

  if (config.avatar) {
    avatarEl.src = config.avatar.startsWith('http') ? config.avatar : `/portfolio${config.avatar}`;
  }

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
    socialLinksEl.appendChild(createSocialLink(`https://medium.com/@${config.social.medium}`, 'Medium'));
  }

  // Merge GitHub-derived projects with manually configured ones, de-duping by name
  const manualProjects = Array.isArray(config.projects) ? config.projects : [];
  const apiProjects = Array.isArray(ghProjects) ? ghProjects : [];
  const mergedByName = new Map();
  for (const p of [...apiProjects, ...manualProjects]) {
    if (!p || !p.name) continue;
    if (!mergedByName.has(p.name)) mergedByName.set(p.name, p);
  }
  const mergedProjects = Array.from(mergedByName.values());
  if (mergedProjects.length) renderProjects(mergedProjects);

  renderPosts(posts);

  // Hide resume link if not present
  fetch('/portfolio/public/resume.pdf', { method: 'HEAD' }).then(r => {
    if (!r.ok) resumeLinkEl.classList.add('hidden');
  }).catch(() => resumeLinkEl.classList.add('hidden'));
}

boot().catch((err) => {
  console.error(err);
});