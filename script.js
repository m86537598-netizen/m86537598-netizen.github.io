document.addEventListener('DOMContentLoaded', () => {

    // --- STATE MANAGEMENT ---
    let db = JSON.parse(localStorage.getItem('story-publisher-db')) || { books: [] };
    let currentEditingBookId = null;
    let currentReadingBook = { id: null, page: 0 };

    function saveDB() {
        localStorage.setItem('story-publisher-db', JSON.stringify(db));
    }

    // --- UI NAVIGATION ---
    const views = document.querySelectorAll('.view');
    function showView(viewId) {
        views.forEach(view => {
            view.classList.toggle('active', view.id === viewId);
        });
    }

    // --- DASHBOARD ---
    const bookGrid = document.getElementById('book-grid');
    const createNewBtn = document.getElementById('create-new-btn');

    function renderDashboard() {
        bookGrid.innerHTML = ''; // Clear existing grid
        if (db.books.length === 0) {
            bookGrid.innerHTML = "<p>You haven't created any stories yet. Click 'Create New Story' to start!</p>";
            return;
        }

        db.books.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card';
            card.dataset.id = book.id; // Store book ID on the element

            // Add listener to read book
            card.addEventListener('click', () => loadReader(book.id));

            // Use a placeholder if no cover is provided
            const coverImg = book.cover 
                ? `<img src="${book.cover}" alt="${book.title} Cover" class="book-card-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                : '';
            
            const coverPlaceholder = `<div class="book-card-cover">${book.title}</div>`;

            card.innerHTML = `
                ${book.cover ? coverImg : ''}
                ${book.cover ? `<div class="book-card-cover" style="display:none;">${book.title}</div>` : coverPlaceholder}
                <div class="book-card-info">
                    <h3>${book.title}</h3>
                    <div class="book-card-stats">
                        <span>Views: ${book.views}</span>
                        <span>Pages: ${book.content.length}</span>
                    </div>
                </div>
            `;
            bookGrid.appendChild(card);
        });
    }

    createNewBtn.addEventListener('click', () => {
        document.getElementById('create-form').reset();
        showView('create-view');
    });

    // --- CREATE BOOK ---
    const createForm = document.getElementById('create-form');
    createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('book-title-input').value;
        const cover = document.getElementById('book-cover-input').value;

        const newBook = {
            id: Date.now().toString(),
            title: title,
            cover: cover,
            views: 0,
            theme: 'theme-light',
            content: ["<h2>Chapter 1</h2><p>Start writing your story here... You can paste images!</p>"] // Start with one page
        };

        db.books.push(newBook);
        saveDB();
        loadEditor(newBook.id); // Go straight to the editor
    });

    // --- EDITOR ---
    const editorTitle = document.getElementById('editor-title');
    const themeSelector = document.getElementById('theme-selector');
    const pagesContainer = document.getElementById('pages-container');
    const addPageBtn = document.getElementById('add-page-btn');
    const saveAndCloseBtn = document.getElementById('save-and-close-btn');

    function loadEditor(bookId) {
        currentEditingBookId = bookId;
        const book = db.books.find(b => b.id === bookId);
        if (!book) return;

        editorTitle.textContent = `Editing: ${book.title}`;
        themeSelector.value = book.theme;
        pagesContainer.innerHTML = ''; // Clear pages

        book.content.forEach((pageHtml, index) => {
            const pageEditor = document.createElement('div');
            pageEditor.className = 'page-editor';
            pageEditor.contentEditable = 'true';
            pageEditor.innerHTML = pageHtml;
            pageEditor.dataset.pageIndex = index;
            pagesContainer.appendChild(pageEditor);
        });

        showView('editor-view');
    }

    addPageBtn.addEventListener('click', () => {
        // First, save current state to DB object (but don't save to localStorage yet)
        saveEditorPagesToDB();

        // Now add the new page
        const book = db.books.find(b => b.id === currentEditingBookId);
        book.content.push(`<p>New page...</p>`);
        
        // Re-load the editor to show the new page
        loadEditor(currentEditingBookId);
        
        // Scroll to the bottom
        window.scrollTo(0, document.body.scrollHeight);
    });

    function saveEditorPagesToDB() {
        const book = db.books.find(b => b.id === currentEditingBookId);
        if (!book) return;

        const pageEditors = pagesContainer.querySelectorAll('.page-editor');
        let newContent = [];
        pageEditors.forEach(editor => {
            newContent.push(editor.innerHTML);
        });
        
        book.content = newContent;
        book.theme = themeSelector.value;
    }

    saveAndCloseBtn.addEventListener('click', () => {
        saveEditorPagesToDB();
        saveDB();
        renderDashboard();
        showView('dashboard-view');
    });

    // --- READER ---
    const readerView = document.getElementById('reader-view');
    const readerTitle = document.getElementById('reader-title');
    const pageIndicator = document.getElementById('page-indicator');
    const readerContent = document.getElementById('reader-content');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    function loadReader(bookId) {
        const book = db.books.find(b => b.id === bookId);
        if (!book) return;

        // Increment views
        book.views++;
        saveDB();

        currentReadingBook.id = bookId;
        currentReadingBook.page = 0;

        readerTitle.textContent = book.title;
        readerView.className = `view ${book.theme}`; // Apply theme

        renderReaderPage();
        showView('reader-view');
    }

    function renderReaderPage() {
        const book = db.books.find(b => b.id === currentReadingBook.id);
        const pageIndex = currentReadingBook.page;
        
        readerContent.innerHTML = book.content[pageIndex];
        pageIndicator.textContent = `Page ${pageIndex + 1} of ${book.content.length}`;

        // Update button states
        prevPageBtn.disabled = (pageIndex === 0);
        nextPageBtn.disabled = (pageIndex === book.content.length - 1);
    }

    prevPageBtn.addEventListener('click', () => {
        if (currentReadingBook.page > 0) {
            currentReadingBook.page--;
            renderReaderPage();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const book = db.books.find(b => b.id === currentReadingBook.id);
        if (currentReadingBook.page < book.content.length - 1) {
            currentReadingBook.page++;
            renderReaderPage();
        }
    });

    // --- GLOBAL: Back Buttons ---
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            renderDashboard(); // Always refresh dashboard when going back
            showView('dashboard-view');
        });
    });

    // --- INITIALIZATION ---
    renderDashboard(); // Show dashboard on page load
    showView('dashboard-view');
});
