/* Dandy World Skins Wiki Engine 
    Includes: Auth, WikiParser, Admin System, "Server" Simulation
*/

const STORAGE_KEY = 'dw_wiki_data';
const ADMIN_USER = 'BUBBLDEDS';
const ADMIN_PASS = 'ERG98UESG9';
const VERIFY_CODE = '8723';

// Initial Data Structure
const defaultData = {
    users: [], // { username, email, password, isBanned, timeoutUntil }
    pages: [
        { 
            title: "Main Page", 
            content: "Welcome to the '''Dandy World Skins Wiki'''!\n\nThis is the community wiki for all Dandy World skins. \n\n[[Request a Page]] to contribute!\n\n{{Infobox|Dandy World|https://placehold.co/150}}", 
            comments: [] 
        }
    ],
    requests: [] // { title, description, requester, status }
};

// --- CORE APP LOGIC ---
const app = {
    data: null,
    currentUser: null,

    init: () => {
        // Load from LocalStorage or use Default
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            app.data = JSON.parse(stored);
        } else {
            app.data = defaultData;
            app.save();
        }

        // Session check
        const session = sessionStorage.getItem('dw_user');
        if (session) app.currentUser = JSON.parse(session);

        app.updateUI();
        app.renderPage('Main Page');
    },

    save: () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(app.data));
    },

    updateUI: () => {
        const panel = document.getElementById('user-panel');
        if (app.currentUser) {
            panel.innerHTML = `
                <span>Hello, <b>${app.currentUser.username}</b></span>
                <button onclick="app.requestPageModal()">Request Page</button>
                <button onclick="app.logout()">Logout</button>
            `;
            
            // Admin Check
            if (app.currentUser.username === ADMIN_USER) {
                document.getElementById('admin-sidebar').classList.remove('hidden');
                panel.innerHTML += ` <span style="color:red; font-weight:bold;">[ADMIN]</span>`;
            } else {
                document.getElementById('admin-sidebar').classList.add('hidden');
            }
        } else {
            panel.innerHTML = `
                <button onclick="app.showLogin()">Login</button>
                <button onclick="app.showSignup()">Sign Up</button>
            `;
            document.getElementById('admin-sidebar').classList.add('hidden');
        }
    },

    // --- AUTHENTICATION ---
    login: (user, pass, code) => {
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            if (code !== VERIFY_CODE) return alert("Invalid Verification Code.");
            app.setCurrentUser({ username: user, isAdmin: true });
            return;
        }

        const found = app.data.users.find(u => u.username === user && u.password === pass);
        if (found) {
            if (found.isBanned) return alert("You are banned from this Wiki.");
            if (found.timeoutUntil && new Date(found.timeoutUntil) > new Date()) return alert(`Timed out until ${found.timeoutUntil}`);
            app.setCurrentUser(found);
        } else {
            alert("Invalid credentials.");
        }
    },

    signup: (user, email, pass) => {
        if (app.data.users.find(u => u.username === user)) return alert("Username taken.");
        app.data.users.push({ username: user, email, password: pass, isBanned: false });
        app.save();
        alert("Account created! Please log in.");
        app.closeModal();
    },

    setCurrentUser: (userObj) => {
        app.currentUser = userObj;
        sessionStorage.setItem('dw_user', JSON.stringify(userObj));
        app.closeModal();
        app.updateUI();
    },

    logout: () => {
        app.currentUser = null;
        sessionStorage.removeItem('dw_user');
        window.location.reload();
    },

    // --- PAGE & REQUEST LOGIC ---
    renderPage: (title) => {
        const page = app.data.pages.find(p => p.title.toLowerCase() === title.toLowerCase());
        const display = document.getElementById('content-display');
        
        if (!page) {
            display.innerHTML = `<h2>Page Not Found</h2><p>The page "${title}" does not exist. <a onclick="app.requestPageModal('${title}')">Request it?</a></p>`;
            return;
        }

        let html = `<h1>${page.title}</h1>`;
        // Add Edit button if Admin
        if (app.currentUser && app.currentUser.username === ADMIN_USER) {
            html += `<button onclick="editor.open('${page.title}')" style="float:right; font-size:0.8em;">[Edit Page]</button>`;
        }
        
        html += `<div class="wiki-content">${wikiParser.parse(page.content)}</div>`;
        
        // Comments Section
        html += `<div class="comments-section"><h3>Discussions</h3>`;
        page.comments.forEach(c => {
            html += `<div class="comment"><div class="comment-meta">${c.user} - ${c.date}</div>${c.text}</div>`;
        });

        // Add Comment Box
        if (app.currentUser && !app.currentUser.isBanned) {
            html += `
                <div style="margin-top:10px;">
                    <textarea id="new-comment" placeholder="Add a comment..."></textarea>
                    <button class="btn-primary" onclick="app.addComment('${page.title}')">Post Comment</button>
                </div>
            `;
        } else {
            html += `<p><i>Login to comment.</i></p>`;
        }
        html += `</div>`;

        display.innerHTML = html;
    },

    addComment: (title) => {
        const text = document.getElementById('new-comment').value;
        if (!text) return;
        const page = app.data.pages.find(p => p.title === title);
        page.comments.push({
            user: app.currentUser.username,
            text: text,
            date: new Date().toLocaleString()
        });
        app.save();
        app.renderPage(title);
    },

    // --- REQUESTS ---
    requestPageModal: (prefillTitle = '') => {
        if(!app.currentUser) return alert("Must be logged in.");
        if(app.currentUser.isBanned) return alert("You are banned.");

        app.openModal(`
            <h3>Request New Page</h3>
            <input type="text" id="req-title" placeholder="Page Title" value="${prefillTitle}">
            <textarea id="req-desc" placeholder="What is this page for?"></textarea>
            <button class="btn-primary" onclick="app.submitRequest()">Send Request</button>
            <div id="req-error"></div>
        `);
    },

    submitRequest: () => {
        const title = document.getElementById('req-title').value;
        const desc = document.getElementById('req-desc').value;
        const errorBox = document.getElementById('req-error');

        // Check duplicates
        if (app.data.pages.find(p => p.title.toLowerCase() === title.toLowerCase())) {
            errorBox.innerHTML = `<p class="red-popup">Page already made! Please request another.</p>`;
            return;
        }

        app.data.requests.push({
            title, description: desc, requester: app.currentUser.username, status: 'pending'
        });
        app.save();
        alert("Request sent to Admins!");
        app.closeModal();
    },

    // --- ADMIN TOOLS ---
    viewRequests: () => {
        let html = `<h3>Pending Requests</h3>`;
        app.data.requests.forEach((req, index) => {
            html += `
                <div style="border:1px solid #ccc; padding:10px; margin:5px 0;">
                    <b>${req.title}</b> (${req.requester})<br>
                    ${req.description}<br>
                    <button onclick="app.adminCreatePage(${index})">Approve & Create</button>
                    <button onclick="app.adminDeleteRequest(${index})">Deny</button>
                </div>
            `;
        });
        app.openModal(html);
    },

    adminCreatePage: (reqIndex) => {
        const req = app.data.requests[reqIndex];
        const newPage = {
            title: req.title,
            content: `'''${req.title}''' is a skin in Dandy World.\n\n{{Infobox|${req.title}|https://placehold.co/150}} \n\nWrite content here...`,
            comments: []
        };
        app.data.pages.push(newPage);
        app.data.requests.splice(reqIndex, 1);
        app.save();
        app.closeModal();
        app.renderPage(req.title);
        alert("Page created successfully!");
    },
    
    adminDeleteRequest: (index) => {
        app.data.requests.splice(index, 1);
        app.save();
        app.viewRequests();
    },

    createPageAdmin: () => {
        const title = prompt("Enter Page Title:");
        if (!title) return;
        if (app.data.pages.find(p => p.title.toLowerCase() === title.toLowerCase())) return alert("Exists.");
        
        app.data.pages.push({
            title: title,
            content: "New Admin Page content...",
            comments: []
        });
        app.save();
        app.renderPage(title);
    },

    viewUsers: () => {
        let html = `<h3>User Management</h3>`;
        app.data.users.forEach(u => {
            if(u.username === ADMIN_USER) return;
            html += `
                <div style="margin-bottom:5px; border-bottom:1px solid #ddd;">
                    <b>${u.username}</b> 
                    ${u.isBanned ? '<span style="color:red">(BANNED)</span>' : ''}
                    <button onclick="app.adminBan('${u.username}')">${u.isBanned ? 'Unban' : 'Ban'}</button>
                    <button onclick="app.adminTimeout('${u.username}')">Timeout 1hr</button>
                </div>
            `;
        });
        app.openModal(html);
    },

    adminBan: (username) => {
        const user = app.data.users.find(u => u.username === username);
        user.isBanned = !user.isBanned;
        app.save();
        app.viewUsers();
    },

    adminTimeout: (username) => {
        const user = app.data.users.find(u => u.username === username);
        const date = new Date();
        date.setHours(date.getHours() + 1);
        user.timeoutUntil = date;
        app.save();
        alert(`${username} timed out for 1 hour.`);
    },

    // --- MODAL UTILS ---
    openModal: (content) => {
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },
    closeModal: () => {
        document.getElementById('modal-overlay').classList.add('hidden');
    },
    showLogin: () => {
        app.openModal(`
            <h3>Login</h3>
            <input id="l-user" placeholder="Username">
            <input id="l-pass" type="password" placeholder="Password">
            <div id="admin-code-area" class="hidden">
                 <input id="l-code" placeholder="Admin Verification Code">
            </div>
            <button class="btn-primary" onclick="app.login(
                document.getElementById('l-user').value, 
                document.getElementById('l-pass').value,
                document.getElementById('l-code') ? document.getElementById('l-code').value : null
            )">Login</button>
        `);
        // Listener to show admin code input
        document.getElementById('l-user').addEventListener('input', (e) => {
            if(e.target.value === ADMIN_USER) document.getElementById('admin-code-area').classList.remove('hidden');
        });
    },
    showSignup: () => {
        app.openModal(`
            <h3>Sign Up</h3>
            <input id="s-user" placeholder="Username">
            <input id="s-email" placeholder="Email">
            <input id="s-pass" type="password" placeholder="Password">
            <button class="btn-primary" onclick="app.signup(
                document.getElementById('s-user').value,
                document.getElementById('s-email').value,
                document.getElementById('s-pass').value
            )">Create Account</button>
        `);
    },
    setTheme: (themeName) => {
        document.body.className = themeName;
    }
};

// --- WIKITEXT PARSER ---
const wikiParser = {
    parse: (text) => {
        let html = text
            // HTML Safety (Prevent XSS injections from users)
            .replace(/</g, "&lt;").replace(/>/g, "&gt;")
            
            // Bold '''text'''
            .replace(/'''(.*?)'''/g, '<b>$1</b>')
            
            // Italic ''text''
            .replace(/''(.*?)''/g, '<i>$1</i>')
            
            // Highlight {{Highlight|text|color}}
            .replace(/{{Highlight\|(.*?)\|(.*?)}}/g, '<span class="wiki-highlight" style="background-color:$2">$1</span>')
            
            // Infobox {{Infobox|Title|ImageURL}}
            .replace(/{{Infobox\|(.*?)\|(.*?)}}/g, `
                <div class="infobox">
                    <div class="infobox-title">$1</div>
                    <img src="$2" alt="$1">
                </div>`)
            
            // Link [[PageName]]
            .replace(/\[\[(.*?)\]\]/g, (match, p1) => {
                if(p1.startsWith("Image:")) {
                    // Image Logic [[Image:URL|width|align]]
                    let parts = p1.split('|');
                    let url = parts[0].replace('Image:', '');
                    let width = parts[1] || '200';
                    let align = parts[2] || 'right';
                    let style = `width:${width}px; float:${align}; margin:10px;`;
                    return `<img src="${url}" style="${style}" class="wiki-image">`;
                }
                return `<a onclick="app.renderPage('${p1}')">${p1}</a>`;
            })

            // Icons (Small images) [[Icon:URL]]
            .replace(/\[\[Icon:(.*?)\]\]/g, '<img src="$1" class="wiki-icon">')

            // Newlines to <br>
            .replace(/\n/g, '<br>');

        return html;
    }
};

// --- EDITOR LOGIC ---
const editor = {
    currentTitle: null,
    open: (title) => {
        editor.currentTitle = title;
        const page = app.data.pages.find(p => p.title === title);
        document.getElementById('content-display').classList.add('hidden');
        document.getElementById('editor-area').classList.remove('hidden');
        
        const source = document.getElementById('wiki-source');
        source.value = page.content;
        
        // Live Preview
        source.addEventListener('input', () => {
            document.getElementById('wiki-preview').innerHTML = wikiParser.parse(source.value);
        });
        // Trigger initial preview
        document.getElementById('wiki-preview').innerHTML = wikiParser.parse(page.content);
    },
    save: () => {
        const content = document.getElementById('wiki-source').value;
        const page = app.data.pages.find(p => p.title === editor.currentTitle);
        page.content = content;
        app.save();
        editor.close();
        app.renderPage(editor.currentTitle);
    },
    close: () => {
        document.getElementById('editor-area').classList.add('hidden');
        document.getElementById('content-display').classList.remove('hidden');
    },
    insert: (start, end) => {
        const textarea = document.getElementById('wiki-source');
        const s = textarea.selectionStart;
        const e = textarea.selectionEnd;
        const value = textarea.value;
        textarea.value = value.substring(0, s) + start + value.substring(s, e) + end + value.substring(e);
        textarea.focus();
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', app.init);
