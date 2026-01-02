/* Dandy World Skins Wiki - Manual Database Edition */

const ADMIN_USER = 'BUBBLDEDS';
const VERIFY_CODE = '8723';

const app = {
    currentUser: null,
    
    init: () => {
        // Load the page
        app.loadPage('Main Page');
        app.updateUI();
    },

    // --- DISPLAY LOGIC ---
    loadPage: (title) => {
        // Search inside DB.pages (from database.js)
        const page = DB.pages.find(p => p.title.toLowerCase() === title.toLowerCase());
        const display = document.getElementById('content-display');

        if (!page) {
            display.innerHTML = `
                <h2>Page Not Found</h2>
                <p>The page "${title}" does not exist.</p>
                <button class="btn-primary" onclick="app.requestModal('${title}')">Request This Page</button>
            `;
            return;
        }

        let html = `<h1>${page.title}</h1>`;
        
        // Admin Edit Button
        if (app.currentUser && app.currentUser.username === ADMIN_USER) {
             html += `<p style="font-size:0.8em; color:red;">(Admin: To edit this, update database.js on GitHub)</p>`;
        }

        html += `<div class="wiki-content">${parser.parse(page.content)}</div>`;
        
        // Comments
        html += `<div class="comments-section"><h3>Discussions</h3>`;
        page.comments.forEach(c => {
            html += `<div class="comment"><b>${c.user}</b>: ${c.text}</div>`;
        });
        
        // Comment Button
        if (app.currentUser) {
            html += `<button class="btn-primary" onclick="app.generateCommentCode('${page.title}')">Add Comment</button>`;
        } else {
            html += `<i>Login to comment</i>`;
        }
        html += `</div>`;

        display.innerHTML = html;
    },

    // --- AUTHENTICATION ---
    login: (user, pass, code) => {
        // Check the database.js file
        const account = DB.users.find(u => u.username === user && u.password === pass);
        
        if (user === ADMIN_USER && code !== VERIFY_CODE) return alert("Wrong Admin Code");
        
        if (account) {
            if (account.isBanned) return alert("You are BANNED.");
            app.currentUser = account;
            app.updateUI();
            app.closeModal();
        } else {
            alert("User not found in database.js! Did you send your signup code to the admin?");
        }
    },

    // --- GENERATORS (The "Server" Replacement) ---
    // Instead of saving, we give the user code to send to YOU.
    
    signupModal: () => {
        app.openModal(`
            <h3>Sign Up</h3>
            <p>Because we don't use a server, you must generate a code and send it to the Admin.</p>
            <input id="s-user" placeholder="Desired Username">
            <input id="s-pass" placeholder="Password">
            <button class="btn-primary" onclick="app.generateSignup()">Get Code</button>
            <div id="result-area"></div>
        `);
    },

    generateSignup: () => {
        const user = document.getElementById('s-user').value;
        const pass = document.getElementById('s-pass').value;
        const code = `{ username: "${user}", password: "${pass}", isBanned: false },`;
        
        document.getElementById('result-area').innerHTML = `
            <p style="color:green"><b>Copy this code and send it to the Wiki Owner:</b></p>
            <textarea style="width:100%; height:50px">${code}</textarea>
            <p><i>Once the admin adds this to database.js, you can log in.</i></p>
        `;
    },

    requestModal: (title='') => {
        if(!app.currentUser) return alert("Login first.");
        app.openModal(`
            <h3>Request Page</h3>
            <input id="r-title" value="${title}" placeholder="Page Title">
            <textarea id="r-desc" placeholder="Description"></textarea>
            <button class="btn-primary" onclick="app.generateRequest()">Get Request Code</button>
            <div id="result-area"></div>
        `);
    },

    generateRequest: () => {
        const title = document.getElementById('r-title').value;
        const desc = document.getElementById('r-desc').value;
        const code = `{ title: "${title}", description: "${desc}", requester: "${app.currentUser.username}" },`;

        document.getElementById('result-area').innerHTML = `
            <p style="color:green"><b>Send this code to the Wiki Owner:</b></p>
            <textarea style="width:100%; height:60px">${code}</textarea>
        `;
    },

    generateCommentCode: (title) => {
        const text = prompt("Enter your comment:");
        if(!text) return;
        const code = `// Add to "${title}" comments:\n{ user: "${app.currentUser.username}", text: "${text}" },`;
        alert("Copy this and send to Admin:\n\n" + code);
    },

    // --- UTILS ---
    updateUI: () => {
        const panel = document.getElementById('user-panel');
        if (app.currentUser) {
            panel.innerHTML = `User: ${app.currentUser.username} <button onclick="location.reload()">Logout</button>`;
            if(app.currentUser.username === ADMIN_USER) {
                // Admin specific note
                panel.innerHTML += ` <span style="color:red; font-weight:bold">[ADMIN MODE: Edit database.js to make changes]</span>`;
            }
        } else {
            panel.innerHTML = `<button onclick="app.showLogin()">Login</button> <button onclick="app.signupModal()">Sign Up</button>`;
        }
    },
    showLogin: () => {
        app.openModal(`
            <h3>Login</h3>
            <input id="l-user" placeholder="Username">
            <input id="l-pass" type="password" placeholder="Password">
            <input id="l-code" placeholder="Admin Code (Only if Admin)">
            <button class="btn-primary" onclick="app.login(
                document.getElementById('l-user').value, 
                document.getElementById('l-pass').value,
                document.getElementById('l-code').value
            )">Login</button>
        `);
    },
    openModal: (html) => {
        document.getElementById('modal-content').innerHTML = html;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },
    closeModal: () => { document.getElementById('modal-overlay').classList.add('hidden'); },
    setTheme: (t) => document.body.className = t
};

// --- WIKITEXT PARSER (Same as before) ---
const parser = {
    parse: (text) => {
        return text
            .replace(/</g, "&lt;")
            .replace(/'''(.*?)'''/g, '<b>$1</b>')
            .replace(/''(.*?)''/g, '<i>$1</i>')
            .replace(/{{Highlight\|(.*?)\|(.*?)}}/g, '<span class="wiki-highlight" style="background-color:$2">$1</span>')
            .replace(/{{Infobox\|(.*?)\|(.*?)}}/g, `<div class="infobox"><div class="infobox-title">$1</div><img src="$2"></div>`)
            .replace(/\[\[Image:(.*?)\|(.*?)\|(.*?)\]\]/g, '<img src="$1" style="width:$2px; float:$3; margin:10px;" class="wiki-image">')
            .replace(/\[\[Icon:(.*?)\]\]/g, '<img src="$1" class="wiki-icon">')
            .replace(/\[\[(.*?)\]\]/g, '<a onclick="app.loadPage(\'$1\')">$1</a>')
            .replace(/\n/g, '<br>');
    }
};

document.addEventListener('DOMContentLoaded', app.init);
