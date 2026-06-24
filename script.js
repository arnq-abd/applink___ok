// Interactive Logic for Bookmark Launchpad Manager

document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Configuration
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const htmlElement = document.documentElement;

    const savedTheme = localStorage.getItem('theme') || 
                       (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    function setTheme(theme) {
        htmlElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'light') {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        }
    }

    // 2. State Management for Bookmarks
    let bookmarks = [];
    let isEditMode = false;

    const defaultBookmarks = [
        {
            id: '1',
            name: 'গুগল অনুসন্ধান / Google Search',
            url: 'https://google.com',
            visible: true
        },
        {
            id: '2',
            name: 'গিটহাব প্রোফাইল / GitHub',
            url: 'https://github.com',
            visible: true
        },
        {
            id: '3',
            name: 'অচল লিঙ্ক উদাহরণ / Sample Disabled Link',
            url: '', // Empty URL makes it unclickable
            visible: true
        },
        {
            id: '4',
            name: 'লুকানো বুকমার্ক উদাহরণ / Sample Hidden Link',
            url: 'https://example.com',
            visible: false // Hidden by default from visitors
        }
    ];

    // Load bookmarks from LocalStorage or initialize defaults
    function loadBookmarks() {
        const localData = localStorage.getItem('launchpad_bookmarks');
        if (localData) {
            try {
                bookmarks = JSON.parse(localData);
            } catch (e) {
                bookmarks = [...defaultBookmarks];
            }
        } else {
            bookmarks = [...defaultBookmarks];
            saveToLocalStorage();
        }
    }

    function saveToLocalStorage() {
        localStorage.setItem('launchpad_bookmarks', JSON.stringify(bookmarks));
    }

    // 3. Render Bookmarks Grid
    const bookmarksGrid = document.getElementById('bookmarks-grid');

    function renderBookmarks() {
        bookmarksGrid.innerHTML = '';

        bookmarks.forEach(bookmark => {
            const isClickable = bookmark.url && bookmark.url.trim() !== '';

            // In Visitor Mode, skip rendering hidden bookmarks completely
            if (!isEditMode && !bookmark.visible) {
                return;
            }

            // Create main card element
            const card = document.createElement(isEditMode || !isClickable ? 'div' : 'a');
            card.className = 'bookmark-card';
            
            if (!isEditMode && isClickable) {
                card.href = bookmark.url;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
                card.classList.add('clickable');
            } else if (isEditMode) {
                card.classList.add('editor-mode-card');
                // Open edit modal on click in edit mode
                card.addEventListener('click', (e) => {
                    // Prevent normal links/actions from firing
                    e.preventDefault();
                    openEditModal(bookmark.id);
                });
            } else {
                card.classList.add('unclickable');
            }

            // CSS classes for states in Editor/Visitor mode
            if (!bookmark.visible) {
                card.classList.add('invisible-card');
            }
            if (!isClickable) {
                card.classList.add('unclickable-card');
            }

            // Build Card Content
            let badgesHTML = '';
            if (!isClickable) {
                badgesHTML += `<span class="lock-badge">অচল / Unclickable</span>`;
            }
            if (isEditMode && !bookmark.visible) {
                badgesHTML += `<span class="invisible-badge">লুকানো / Hidden</span>`;
            }

            // Choose appropriate icon based on link presence/state
            let iconSVG = '';
            if (!isClickable) {
                // Lock Icon SVG for unclickable items
                iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                           </svg>`;
            } else {
                // Global/Link SVG Icon for clickable bookmarks
                iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                           </svg>`;
            }

            card.innerHTML = `
                <div class="card-content">
                    <div class="card-icon-box">
                        ${iconSVG}
                    </div>
                    <div class="card-details">
                        <div class="card-title">
                            <span>${escapeHTML(bookmark.name)}</span>
                            ${badgesHTML}
                        </div>
                    </div>
                    ${isEditMode ? `<button class="edit-overlay-btn">সম্পাদনা / Edit</button>` : ''}
                </div>
            `;

            bookmarksGrid.appendChild(card);
        });

        if (bookmarksGrid.children.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'add-btn';
            emptyMsg.style.borderStyle = 'none';
            emptyMsg.innerHTML = '<span>কোনো বুকমার্ক নেই। এডিট মোড অন করে বুকমার্ক যোগ করুন!</span>';
            bookmarksGrid.appendChild(emptyMsg);
        }
    }

    // Escape helper to prevent HTML injection
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // 4. Editor Mode Toggle Handler
    const editorToggleBtn = document.getElementById('editor-toggle');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');

    editorToggleBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;
        if (isEditMode) {
            editorToggleBtn.classList.add('active');
            addBookmarkBtn.classList.remove('hidden');
        } else {
            editorToggleBtn.classList.remove('active');
            addBookmarkBtn.classList.add('hidden');
        }
        renderBookmarks();
    });

    // 5. Modal Controllers (CRUD)
    const modal = document.getElementById('bookmark-modal');
    const modalTitle = document.getElementById('modal-title');
    const bookmarkForm = document.getElementById('bookmark-form');
    const bookmarkIdInput = document.getElementById('bookmark-id');
    const bookmarkNameInput = document.getElementById('bookmark-name');
    const bookmarkUrlInput = document.getElementById('bookmark-url');
    const bookmarkVisibleInput = document.getElementById('bookmark-visible');
    const deleteBtn = document.getElementById('modal-delete');
    const cancelBtn = document.getElementById('modal-cancel');

    addBookmarkBtn.addEventListener('click', () => {
        openEditModal(null);
    });

    cancelBtn.addEventListener('click', closeEditModal);
    
    // Close modal if clicking overlay
    document.querySelector('.modal-overlay').addEventListener('click', closeEditModal);

    function openEditModal(id) {
        bookmarkForm.reset();
        if (id) {
            // Edit Existing Bookmark
            const bookmark = bookmarks.find(b => b.id === String(id));
            if (!bookmark) return;
            
            modalTitle.textContent = 'বুকমার্ক সম্পাদনা / Edit Bookmark';
            bookmarkIdInput.value = bookmark.id;
            bookmarkNameInput.value = bookmark.name;
            bookmarkUrlInput.value = bookmark.url || '';
            bookmarkVisibleInput.checked = bookmark.visible;
            deleteBtn.classList.remove('hidden');
        } else {
            // Add New Bookmark
            modalTitle.textContent = 'নতুন বুকমার্ক যোগ করুন / Add New Bookmark';
            bookmarkIdInput.value = '';
            bookmarkVisibleInput.checked = true;
            deleteBtn.classList.add('hidden');
        }
        modal.classList.remove('hidden');
    }

    function closeEditModal() {
        modal.classList.add('hidden');
    }

    // Handle form submit (Save/Create)
    bookmarkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = bookmarkIdInput.value;
        const name = bookmarkNameInput.value.trim();
        const url = bookmarkUrlInput.value.trim();
        const visible = bookmarkVisibleInput.checked;

        if (id) {
            // Update
            const index = bookmarks.findIndex(b => b.id === id);
            if (index !== -1) {
                bookmarks[index] = { ...bookmarks[index], name, url, visible };
            }
        } else {
            // Create
            const newId = String(Date.now());
            bookmarks.push({ id: newId, name, url, visible });
        }

        saveToLocalStorage();
        renderBookmarks();
        closeEditModal();
    });

    // Handle delete action
    deleteBtn.addEventListener('click', () => {
        const id = bookmarkIdInput.value;
        if (id) {
            bookmarks = bookmarks.filter(b => b.id !== id);
            saveToLocalStorage();
            renderBookmarks();
            closeEditModal();
        }
    });

    // 6. Footer Copyright Year
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // 7. Hidden Edit Mode Clicks Trigger & Password Verification
    let logoClicks = 0;
    const logoTitle = document.querySelector('.logo-title');
    const passwordModal = document.getElementById('password-modal');
    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('password-input');
    const passwordError = document.getElementById('password-error');
    const passwordCancel = document.getElementById('password-cancel');

    logoTitle.style.cursor = 'pointer';
    
    logoTitle.addEventListener('click', () => {
        const isHidden = editorToggleBtn.classList.contains('hidden');
        
        if (isHidden) {
            logoClicks++;
            if (logoClicks === 9) {
                openPasswordModal();
                logoClicks = 0;
            }
        } else {
            logoClicks++;
            if (logoClicks === 3) {
                hideEditorToggle();
                logoClicks = 0;
            }
        }
    });

    function openPasswordModal() {
        passwordForm.reset();
        passwordError.classList.add('hidden');
        passwordModal.classList.remove('hidden');
        setTimeout(() => passwordInput.focus(), 100);
    }

    function closePasswordModal() {
        passwordModal.classList.add('hidden');
    }

    function hideEditorToggle() {
        editorToggleBtn.classList.add('hidden');
        if (isEditMode) {
            isEditMode = false;
            editorToggleBtn.classList.remove('active');
            addBookmarkBtn.classList.add('hidden');
            renderBookmarks();
        }
    }

    passwordCancel.addEventListener('click', closePasswordModal);
    document.getElementById('password-overlay').addEventListener('click', closePasswordModal);

    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPassword = passwordInput.value;
        
        if (enteredPassword === '2026') {
            editorToggleBtn.classList.remove('hidden');
            closePasswordModal();
        } else {
            passwordError.classList.remove('hidden');
            passwordInput.focus();
            passwordInput.select();
        }
    });

    // Initialize Page
    loadBookmarks();
    renderBookmarks();
});
