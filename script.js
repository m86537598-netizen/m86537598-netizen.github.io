const ADMIN_EMAIL = "m86537598@gmail.com";
let currentUser = null;
let currentMode = 'edit';

// DOM Elements
const visualEditor = document.getElementById('visual-editor');
const sourceEditor = document.getElementById('source-editor');
const adminPanel = document.getElementById('admin-panel');

// 1. Mock Login Logic
document.getElementById('login-btn').addEventListener('click', () => {
    // In a real app, use Firebase Auth here
    const email = prompt("Enter your email (Use m86537598@gmail.com for admin):");
    if (email) {
        currentUser = { email: email, verified: true };
        document.getElementById('user-info').innerText = `Logged in as: ${email}`;
        checkPermissions();
    }
});

function checkPermissions() {
    if (currentUser?.email === ADMIN_EMAIL) {
        adminPanel.classList.remove('hidden');
        document.getElementById('submit-page').innerText = "Instantly Publish";
    }
}

// 2. Editor Mode Switching
function setMode(mode) {
    currentMode = mode;
    if (mode === 'source') {
        sourceEditor.value = visualEditor.innerHTML;
        visualEditor.classList.add('hidden');
        sourceEditor.classList.remove('hidden');
    } else {
        visualEditor.innerHTML = sourceEditor.value;
        sourceEditor.classList.add('hidden');
        visualEditor.classList.remove('hidden');
    }
}

// 3. Text Formatting
function execCmd(cmd, value = null) {
    document.execCommand(cmd, false, value);
}

document.getElementById('highlightColor').addEventListener('input', (e) => {
    execCmd('hiliteColor', e.target.value);
});

document.getElementById('textColor').addEventListener('input', (e) => {
    execCmd('foreColor', e.target.value);
});

// 4. Image Handling (Paste/Drag/Drop)
visualEditor.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.kind === 'file') {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = `<img src="${event.target.result}" style="width:200px;">`;
                execCmd('insertHTML', img);
            };
            reader.readAsDataURL(blob);
        }
    }
});

// 5. Page Submission
document.getElementById('submit-page').addEventListener('click', () => {
    const pageData = {
        title: "New Page",
        content: currentMode === 'edit' ? visualEditor.innerHTML : sourceEditor.value,
        status: (currentUser.email === ADMIN_EMAIL) ? 'approved' : 'queued'
    };
    
    alert(pageData.status === 'approved' ? "Published!" : "Sent to m86537598@gmail.com for approval.");
    // Here you would fetch() your Cloud API to save to a database
});
