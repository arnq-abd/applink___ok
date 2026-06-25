// Interactive Logic for Bookmark Launchpad Manager

document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Configuration (Forced Dark Theme)
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');

    // 2. State Management for Bookmarks
    let bookmarks = [];
    let isEditMode = false;
    let githubToken = localStorage.getItem('GITHUB_TOKEN') || '';

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
        }

    ];

    // GitHub API Configuration
    const REPO_OWNER = 'arnq-abd';
    const REPO_NAME = 'mdrs';
    const FILE_PATH = 'bookmarks.json';

    async function saveBookmarksToGitHub() {
        try {
            const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
            const headers = {
                'Accept': 'application/vnd.github.v3+json'
            };
            if (githubToken) {
                headers['Authorization'] = `token ${githubToken}`;
            }

            const getResponse = await fetch(getUrl, {
                headers: headers
            });

            if (!getResponse.ok) {
                throw new Error('Failed to fetch file metadata from GitHub');
            }

            const fileMeta = await getResponse.json();
            const currentSha = fileMeta.sha;

            const jsonString = JSON.stringify(bookmarks, null, 4);
            const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

            const putResponse = await fetch(getUrl, {
                method: 'PUT',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Update bookmarks via Launchpad UI',
                    content: base64Content,
                    sha: currentSha
                })
            });

            if (!putResponse.ok) {
                const errorData = await putResponse.json();
                throw new Error(errorData.message || 'Failed to update file on GitHub');
            }

            alert('বুকমার্ক সফলভাবে গিটহাবে সংরক্ষণ করা হয়েছে এবং এটি সাথে সাথে লাইভ হয়ে গেছে!');
            return true;
        } catch (error) {
            console.error('Error saving to GitHub:', error);
            alert('গিটহাবে সংরক্ষণ করতে ব্যর্থ হয়েছে!\nভুল: ' + error.message);
            return false;
        }
    }

    // Load bookmarks from GitHub REST API, falling back to local file or defaults
    async function loadBookmarks() {
        try {
            const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
            const headers = {
                'Accept': 'application/vnd.github.v3+json'
            };
            if (githubToken) {
                headers['Authorization'] = `token ${githubToken}`;
            }
            const response = await fetch(`${getUrl}?t=${Date.now()}`, {
                headers: headers
            });

            if (response.ok) {
                const fileMeta = await response.json();
                const base64Content = fileMeta.content.replace(/\s/g, '');
                const jsonString = decodeURIComponent(escape(atob(base64Content)));
                const data = JSON.parse(jsonString);
                if (Array.isArray(data)) {
                    bookmarks = data;
                    renderBookmarks();
                    return;
                }
            }
        } catch (e) {
            console.warn('Failed to load bookmarks from GitHub REST API, falling back to local file', e);
        }

        // Fallback to local bookmarks.json
        try {
            const response = await fetch(`./bookmarks.json?t=${Date.now()}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    bookmarks = data;
                    renderBookmarks();
                    return;
                }
            }
        } catch (e) {
            console.warn('Failed to load local bookmarks.json fallback, falling back to defaults', e);
        }

        bookmarks = [...defaultBookmarks];
        renderBookmarks();
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
            const card = document.createElement('div');
            card.className = 'bookmark-card';

            if (!isEditMode && isClickable) {
                card.classList.add('clickable');

                // Single click to select/highlight card
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.bookmark-card').forEach(c => {
                        if (c !== card) c.classList.remove('selected');
                    });
                    card.classList.add('selected');
                });

                // Double click to open the link
                card.addEventListener('dblclick', (e) => {
                    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
                });
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
    const editorActionsBar = document.getElementById('editor-actions-bar');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');

    editorToggleBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;
        if (isEditMode) {
            editorToggleBtn.classList.add('active');
            editorActionsBar.classList.remove('hidden');
        } else {
            editorToggleBtn.classList.remove('active');
            editorActionsBar.classList.add('hidden');
        }
        renderBookmarks();
    });

    exportJsonBtn.addEventListener('click', () => {
        const jsonStr = JSON.stringify(bookmarks, null, 4);
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert('বুকমার্ক কনফিগারেশন JSON ক্লিপবোর্ডে কপি হয়েছে!\n\nগিটহাবের bookmarks.json ফাইলটি এডিট করে এটি পেস্ট করুন এবং কমিট করুন।');
        }).catch(err => {
            console.error('Failed to copy configuration', err);
            // Fallback: show prompt or copy manually
            const textarea = document.createElement('textarea');
            textarea.value = jsonStr;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('ক্লিপবোর্ডে কপি হয়েছে (ম্যানুয়াল পদ্ধতি)!\n\nগিটহাবের bookmarks.json ফাইলটি এডিট করে এটি পেস্ট করুন এবং কমিট করুন।');
        });
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
    bookmarkForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = bookmarkIdInput.value;
        const name = bookmarkNameInput.value.trim();
        const url = bookmarkUrlInput.value.trim();
        const visible = bookmarkVisibleInput.checked;

        const originalBookmarks = [...bookmarks];

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

        const saveBtn = document.getElementById('modal-save');
        const originalBtnText = saveBtn.textContent;
        saveBtn.textContent = 'সংরক্ষণ করা হচ্ছে... / Saving...';
        saveBtn.disabled = true;

        const success = await saveBookmarksToGitHub();

        if (success) {
            renderBookmarks();
            closeEditModal();
        } else {
            bookmarks = originalBookmarks;
        }

        saveBtn.textContent = originalBtnText;
        saveBtn.disabled = false;
    });

    // Handle delete action
    deleteBtn.addEventListener('click', async () => {
        const id = bookmarkIdInput.value;
        if (id) {
            const originalBookmarks = [...bookmarks];
            bookmarks = bookmarks.filter(b => b.id !== id);

            const originalBtnText = deleteBtn.textContent;
            deleteBtn.textContent = 'মুছা হচ্ছে... / Deleting...';
            deleteBtn.disabled = true;

            const success = await saveBookmarksToGitHub();

            if (success) {
                renderBookmarks();
                closeEditModal();
            } else {
                bookmarks = originalBookmarks;
            }

            deleteBtn.textContent = originalBtnText;
            deleteBtn.disabled = false;
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
        githubToken = '';
        localStorage.removeItem('GITHUB_TOKEN');
        if (isEditMode) {
            isEditMode = false;
            editorToggleBtn.classList.remove('active');
            editorActionsBar.classList.add('hidden');
            renderBookmarks();
        }
        alert('এডিটর মোড লক করা হয়েছে এবং টোকেন মুছে ফেলা হয়েছে! / Editor Mode locked and token cleared!');
    }

    passwordCancel.addEventListener('click', closePasswordModal);
    document.getElementById('password-overlay').addEventListener('click', closePasswordModal);

    async function verifyToken(token) {
        try {
            const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
            const response = await fetch(getUrl, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enteredToken = passwordInput.value.trim();
        
        const submitBtn = passwordForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'যাচাই করা হচ্ছে... / Verifying...';
        submitBtn.disabled = true;

        const isValid = await verifyToken(enteredToken);
        
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;

        if (isValid) {
            githubToken = enteredToken;
            localStorage.setItem('GITHUB_TOKEN', enteredToken);
            editorToggleBtn.classList.remove('hidden');
            closePasswordModal();
            loadBookmarks();
        } else {
            passwordError.classList.remove('hidden');
            passwordInput.focus();
            passwordInput.select();
        }
    });

    // Global click listener to deselect bookmarks when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.bookmark-card')) {
            document.querySelectorAll('.bookmark-card').forEach(c => {
                c.classList.remove('selected');
            });
        }
    });

    // Initialize Page
    if (githubToken) {
        editorToggleBtn.classList.remove('hidden');
    }
    loadBookmarks();
});
