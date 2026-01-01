// public/js/app.js
// Shared client code for index + editor
(function(){
  // Elements
  const pagesList = document.getElementById('pagesList');
  const themeSelect = document.getElementById('themeSelect');
  const loginBtn = document.getElementById('loginBtn');
  const authModal = document.getElementById('authModal');
  const reqBtn = document.getElementById('reqBtn');
  const requestModal = document.getElementById('requestModal');
  const adminModal = document.getElementById('adminModal');
  const adminBtn = document.getElementById('adminBtn');
  const userInfo = document.getElementById('userInfo');

  if(themeSelect) themeSelect.onchange = ()=> document.documentElement.setAttribute('data-theme', themeSelect.value);

  // Load pages
  async function loadPages(){
    const res = await fetch('/api/pages');
    const list = await res.json();
    if(!pagesList) return;
    pagesList.innerHTML = '';
    list.forEach(p=>{
      const li = document.createElement('li');
      li.innerHTML = `<a href="#" data-title="${p.title}" onclick="return false">${p.title}</a>`;
      li.querySelector('a').onclick = ()=> viewPage(p.title);
      pagesList.appendChild(li);
    });
  }
  window.loadPages = loadPages;
  loadPages();

  // view page
  window.viewPage = async function(title){
    const res = await fetch('/api/page/'+encodeURIComponent(title));
    const data = await res.json();
    if(data.error) return alert('Not found');
    document.getElementById('contentPanel').scrollTop = 0;
    document.getElementById('mainPage').classList.add('hidden');
    const pv = document.getElementById('pageView'); pv.classList.remove('hidden');
    document.getElementById('pageHeader').innerHTML = `<h1>${data.title}</h1>`;
    document.getElementById('pageContent').innerHTML = parseWiki(data.content || '');
    loadComments(data.id);
  }

  // comments
  async function loadComments(pageId){
    const r = await fetch('/api/comments/'+pageId);
    const arr = await r.json();
    const holder = document.getElementById('commentsList');
    holder.innerHTML = '';
    arr.forEach(c=>{
      const d = document.createElement('div'); d.className='comment';
      d.innerHTML = `<b>${c.username||'Guest'}</b> <small>${new Date(c.created_at||0).toLocaleString()}</small><div>${escapeHtml(c.content)}</div>`;
      holder.appendChild(d);
    });
    // submit
    const submit = document.getElementById('submitComment');
    submit.onclick = async ()=>{
      const text = document.getElementById('commentText').value;
      if(!text) return alert('Write comment');
      // Need current page id: get from header title
      const title = document.getElementById('pageHeader').querySelector('h1').textContent;
      const res = await fetch('/api/page/'+encodeURIComponent(title));
      const page = await res.json();
      const r = await fetch('/api/comment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pageId:page.id, content:text})});
      const j = await r.json();
      if(j.error) return alert(j.error);
      document.getElementById('commentText').value='';
      loadComments(page.id);
    };
  }

  // request modal
  if(reqBtn) reqBtn.onclick = ()=> {
    fetch('/api/users').catch(()=>{}); // no-op
    openModal('requestModal');
  };
  document.getElementById && document.getElementById('sendRequest') && (document.getElementById('sendRequest').onclick = async ()=>{
    const title = document.getElementById('reqTitle').value;
    const purpose = document.getElementById('reqPurpose').value;
    const content = document.getElementById('reqContent').value;
    const res = await fetch('/api/request-page',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,purpose,content})});
    const j = await res.json();
    const err = document.getElementById('reqError');
    if(j.error){
      err.textContent = j.message || j.error;
    } else {
      err.textContent = 'Requested. Wait for admin approval.';
    }
  });

  // modals
  window.openModal = (id)=> document.getElementById(id).classList.remove('hidden');
  window.closeModal = (id)=> document.getElementById(id).classList.add('hidden');

  // login/register
  if(loginBtn) loginBtn.onclick = ()=> openModal('authModal');
  document.getElementById && (document.getElementById('doRegister') && (document.getElementById('doRegister').onclick = async ()=>{
    const u = document.getElementById('regUser').value;
    const e = document.getElementById('regEmail').value;
    const p = document.getElementById('regPass').value;
    const r = await fetch('/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:u,email:e,password:p})});
    const j = await r.json();
    if(j.error) return alert(j.error);
    loadPages();
    closeModal('authModal');
    userInfo.innerText = `Logged in: ${j.username}`;
  }));
  document.getElementById && (document.getElementById('doLogin') && (document.getElementById('doLogin').onclick = async ()=>{
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPass').value;
    const c = document.getElementById('loginCode').value;
    const r = await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:u,password:p,code:c})});
    const j = await r.json();
    if(j.error) return alert(j.error);
    loadPages();
    closeModal('authModal');
    userInfo.innerText = `Logged in: ${j.username} ${j.role?('('+j.role+')'):''}`;
    if(j.role === 'admin') openModal('adminModal') && loadPending();
  }));

  // admin panel
  async function loadPending(){
    const r = await fetch('/api/pending');
    const arr = await r.json();
    const holder = document.getElementById('pendingList');
    holder.innerHTML = '';
    arr.forEach(p=>{
      const el = document.createElement('div'); el.innerHTML = `<b>${p.title}</b> by ${p.requester_name||'unknown'} <div>${p.purpose||''}</div><div><button onclick="approve(${p.id})">Approve</button> <button onclick="reject(${p.id})">Reject</button></div>`;
      holder.appendChild(el);
    });
  }
  window.loadPending = loadPending;
  window.approve = async (id)=> {
    await fetch('/api/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pendingId:id})});
    loadPages(); loadPending();
  }
  window.reject = async (id)=> {
    await fetch('/api/reject',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pendingId:id})});
    loadPending();
  }

  // helper: escape html
  function escapeHtml(s){ return (s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // ================= WIKITEXT PARSER =================
  window.parseWiki = function(t){
    if(!t) return '';
    // basic HTML passthrough: if input contains < and > we assume allowed HTML (sanitization not implemented)
    // Do replacements for wikitext constructs:
    t = t.replace(/'''(.*?)'''/gs, '<b>$1</b>');
    t = t.replace(/''(.*?)''/gs, '<i>$1</i>');
    t = t.replace(/==\s*(.+?)\s*==/gs, '<h2>$1</h2>');
    // links [[Page Title]]
    t = t.replace(/\[\[(.*?)\]\]/g, (m,p)=>`<a href="#" onclick="viewPage('${encodeURIComponent(p)}');return false">${p}</a>`);
    // Highlight: {{Highlight|color=#ff0|Text}}
    t = t.replace(/\{\{Highlight\|color=(.*?)\|(.*?)\}\}/g, '<span class="highlight" style="background:$1;color:#000;padding:2px 6px;border-radius:4px">$2</span>');
    // Quote
    t = t.replace(/\{\{Quote\|(.*?)\}\}/g, '<blockquote>$1</blockquote>');
    // Infobox: {{Infobox|title=Name|image=/uploads/x.png|desc=Text}}
    t = t.replace(/\{\{Infobox\|([^}]*)\}\}/g, function(m, params){
      const obj = {};
      params.split('|').forEach(part=>{
        const kv = part.split('=');
        if(kv[0]) obj[kv[0].trim()] = (kv[1]||'').trim();
      });
      return `<div class="infobox"><b>${escapeHtml(obj.title||'')}</b>${obj.image?('<img src="'+obj.image+'" style="width:100%;display:block;margin-top:6px">'):''}<p>${escapeHtml(obj.desc||'')}</p></div>`;
    });
    // Icon: {{icon|/uploads/x.png|Text}}
    t = t.replace(/\{\{icon\|(.*?)\|(.*?)\}\}/g, '<img src="$1" style="width:16px;vertical-align:middle;margin-right:6px"> $2');
    // Gallery: <gallery>url1,url2</gallery> OR {{Gallery|url1,url2}}
    t = t.replace(/\{\{Gallery\|(.*?)\}\}/g, function(m,list){
      const items = list.split(',').map(s=>s.trim());
      return '<div class="gallery">'+items.map(i=>`<img src="${i}" style="max-width:160px;margin:4px">`).join('')+'</div>';
    });

    // raw <img> pass-through: allow inline transform style present
    return t;
  };

  // initial theme from html attr
  const initial = document.documentElement.getAttribute('data-theme') || 'green';
  if(themeSelect) themeSelect.value = initial;

  // expose some for editor usage
  window.openModal = window.openModal;
  window.closeModal = window.closeModal;
  window.loadPages = loadPages;

  // helpers for encoded titles
  window.viewPage = async function(encodedTitle){
    const title = decodeURIComponent(encodedTitle);
    // call global viewPage in index scope (exists there)
    const el = document.querySelector && document.querySelector(`[data-title="${title}"]`);
    // use fetch-based view if on index.html
    if(location.pathname.endsWith('index.html') || location.pathname === '/'){
      // call server API and render in page
      const res = await fetch('/api/page/'+encodeURIComponent(title));
      const data = await res.json();
      if(data.error) return alert('Not found');
      document.getElementById('mainPage').classList.add('hidden');
      document.getElementById('pageView').classList.remove('hidden');
      document.getElementById('pageHeader').innerHTML = `<h1>${data.title}</h1><small>Author: ${data.author_name||'unknown'}</small>`;
      document.getElementById('pageContent').innerHTML = parseWiki(data.content || '');
      loadComments(data.id);
    } else {
      location.href = '/';
      setTimeout(()=> window.viewPage(title), 400);
    }
  }

  // expose functions globally
  window.parseWiki = window.parseWiki;
  window.approve = window.approve;
  window.reject = window.reject;

})();
