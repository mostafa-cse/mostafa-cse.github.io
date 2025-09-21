// CP Journey Progress Tracker - Professional Edition
class CPJourney {
    constructor() {
        this.API_BASE = 'http://localhost:3001/api';
        this.data = {};
        this.isOnline = navigator.onLine;
        this.currentUser = null;
        this.authToken = localStorage.getItem('authToken');
    // Removed loading overlay timing

        // Performance optimizations
        this.cache = new Map(); // Add caching system
        this.apiRetryCount = 3; // API retry configuration
        this.apiRetryDelay = 1000; // 1 second initial delay
        this.throttleTimeouts = new Map(); // Throttling system
        this.lazyLoadObserver = null; // Lazy loading observer

        this.initializeApp();
    }

    async initializeApp() {
        try {

            // Initialize critical features first (synchronously)
            this.setupSecurityHeaders();
            this.setupCaching();

            // Initialize UI features in parallel
            const uiPromises = [
                Promise.resolve(this.setupThemeToggle()),
                Promise.resolve(this.setupDropdowns()),
                Promise.resolve(this.setupBreadcrumbs()),
                Promise.resolve(this.setupNotifications()),
                Promise.resolve(this.setupProfessionalInteractions())
            ];

            // Initialize auth and data loading in parallel
            const dataPromises = [
                this.initAuth(),
                this.loadData()
            ];

            // Wait for critical UI features
            await Promise.all(uiPromises);

            // Initialize event listeners (non-blocking)
            try {
                this.initializeEventListeners();
            } catch (e) {
                console.warn('Some UI listeners failed to initialize:', e);
            }

            // Load data in parallel
            await Promise.all(dataPromises);

            // Update UI after data loads
            this.updateUI();

            // Start background processes during idle time (non-blocking)
            const runBackground = () => {
                try {
                    this.setupLazyLoading();
                    this.startPeriodicUpdates();
                    this.setupNetworkListeners();
                    this.initializeEnhancedFeatures();
                } catch (e) {
                    console.warn('Background init error', e);
                }
            };
            if ('requestIdleCallback' in window) {
                requestIdleCallback(runBackground, { timeout: 1000 });
            } else {
                setTimeout(runBackground, 50);
            }

            // No loading overlay; proceed immediately

        } catch (error) {
            console.error('App initialization failed:', error);
            this.showNotification('Failed to initialize application. Please refresh the page.', 'error');
        }
    }

    // Loading overlay removed; no-op methods deleted

    initializeEnhancedFeatures() {
        // Initialize hero stats
        this.updateHeroStats();

        // Set up intersection observers for animations
        this.setupScrollAnimations();

        // Initialize keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Set up mobile optimizations
        this.optimizeForMobile();

        // Register service worker for PWA
        this.registerServiceWorker();
    }

    updateHeroStats() {
        const totalProblems = this.getTotalProblemsolved();
        const currentStreak = this.data.currentStreak || 0;
        const journeyProgress = this.data.journeyStarted ?
            Math.min((this.getDaysElapsed() / 315) * 100, 100) : 0; // Total journey is 315 days across all phases

        // Animate numbers
        this.animateNumber('hero-problems', totalProblems);
        this.animateNumber('hero-streak', currentStreak);
        this.animateNumber('hero-progress', Math.round(journeyProgress), '%');
    }

    animateNumber(elementId, target, suffix = '') {
        const element = document.getElementById(elementId);
        if (!element) return;

        const duration = 2000;
        const start = parseInt(element.textContent) || 0;
        const range = target - start;
        const startTime = Date.now();

        const animation = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easing = 1 - Math.pow(1 - progress, 3); // Ease out cubic
            const current = Math.round(start + (range * easing));

            element.textContent = current + suffix;

            if (progress < 1) {
                requestAnimationFrame(animation);
            }
        };

        requestAnimationFrame(animation);
    }

    setupScrollAnimations() {
        // Add intersection observer for fade-in animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-visible');
                }
            });
        }, observerOptions);

        // Observe all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('fade-in');
            observer.observe(section);
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K for quick search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                // Focus on search if available
                const searchInput = document.querySelector('.search-input');
                if (searchInput) searchInput.focus();
            }
        });
    }

    optimizeForMobile() {
        // Add touch optimizations
        document.body.style.webkitTouchCallout = 'none';
        document.body.style.webkitUserSelect = 'none';

        // Handle mobile viewport
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
    }

    // Performance optimization methods
    setupCaching() {
        // Set cache expiry times (in milliseconds)
        this.cacheExpiry = {
            'cses-topics': 30 * 60 * 1000, // 30 minutes
            'user-data': 5 * 60 * 1000, // 5 minutes
            'platform-stats': 15 * 60 * 1000 // 15 minutes
        };
    }

    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < (this.cacheExpiry[key] || 10 * 60 * 1000)) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCachedData(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    async fetchWithRetry(url, options = {}, retries = this.apiRetryCount) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response;
        } catch (error) {
            if (retries > 0 && (error.name === 'NetworkError' || error.name === 'TypeError')) {
                await new Promise(resolve => setTimeout(resolve, this.apiRetryDelay));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    throttle(func, delay, key) {
        if (this.throttleTimeouts.has(key)) {
            clearTimeout(this.throttleTimeouts.get(key));
        }

        const timeout = setTimeout(() => {
            func();
            this.throttleTimeouts.delete(key);
        }, delay);

        this.throttleTimeouts.set(key, timeout);
    }

    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.lazyLoadObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const target = entry.target;

                        // Lazy load images
                        if (target.dataset.src) {
                            target.src = target.dataset.src;
                            target.removeAttribute('data-src');
                        }

                        // Lazy load content sections
                        if (target.classList.contains('lazy-content')) {
                            target.classList.add('loaded');
                            this.loadSectionContent(target);
                        }

                        this.lazyLoadObserver.unobserve(target);
                    }
                });
            }, {
                rootMargin: '50px'
            });

            // Observe lazy load targets
            document.querySelectorAll('[data-src], .lazy-content').forEach(element => {
                this.lazyLoadObserver.observe(element);
            });
        }
    }

    async loadSectionContent(section) {
        const contentType = section.dataset.contentType;
        if (contentType) {
            try {
                // Check cache first
                const cachedContent = this.getCachedData(`section-${contentType}`);
                if (cachedContent) {
                    section.innerHTML = cachedContent;
                    return;
                }

                // Load content dynamically
                const content = await this.loadDynamicContent(contentType);
                section.innerHTML = content;
                this.setCachedData(`section-${contentType}`, content);
            } catch (error) {
                console.error(`Error loading section content: ${contentType}`, error);
                section.innerHTML = '<p>Error loading content. Please refresh the page.</p>';
            }
        }
    }

    async loadDynamicContent(type) {
        switch (type) {
            case 'statistics':
                return await this.generateStatisticsHTML();
            case 'leaderboard':
                return await this.generateLeaderboardHTML();
            case 'achievements':
                return await this.generateAchievementsHTML();
            default:
                return '<p>Content not found</p>';
        }
    }

    // Security enhancement methods
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;

        // Remove potentially dangerous characters and scripts
        return input
            .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
            .replace(/javascript:/gi, '') // Remove javascript: protocols
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
    }

    validateUsername(username) {
        if (!username || typeof username !== 'string') {
            throw new Error('Username is required and must be a string');
        }

        const sanitized = this.sanitizeInput(username);
        if (sanitized.length < 3 || sanitized.length > 20) {
            throw new Error('Username must be between 3 and 20 characters');
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
            throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
        }

        return sanitized;
    }

    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            throw new Error('Email is required and must be a string');
        }

        const sanitized = this.sanitizeInput(email);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(sanitized)) {
            throw new Error('Please enter a valid email address');
        }

        return sanitized;
    }

    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            throw new Error('Password is required');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
        }

        return password; // Don't sanitize passwords
    }

    handleSecureError(error, context = '') {
        // Log full error for debugging (server-side only in production)
        console.error(`Error in ${context}:`, error);

        // Return sanitized error message to user
        let userMessage = 'An unexpected error occurred. Please try again.';

        if (error.message && typeof error.message === 'string') {
            // Only show safe error messages
            const safeErrors = [
                'Username is required',
                'Email is required',
                'Password is required',
                'Username must be between',
                'Username can only contain',
                'Please enter a valid email',
                'Password must be at least',
                'Password must contain',
                'Network error',
                'Authentication failed',
                'User not found'
            ];

            const isSafeError = safeErrors.some(safe => error.message.includes(safe));
            if (isSafeError) {
                userMessage = this.sanitizeInput(error.message);
            }
        }

        return userMessage;
    }

    setupSecurityHeaders() {
        // Add Content Security Policy meta tag if not exists
        if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
            const csp = document.createElement('meta');
            csp.httpEquiv = 'Content-Security-Policy';
            csp.content = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:3001";
            document.head.appendChild(csp);
        }

        // Add X-Content-Type-Options
        const contentType = document.createElement('meta');
        contentType.httpEquiv = 'X-Content-Type-Options';
        contentType.content = 'nosniff';
        document.head.appendChild(contentType);

        // Add Referrer Policy
        const referrer = document.createElement('meta');
        referrer.name = 'referrer';
        referrer.content = 'strict-origin-when-cross-origin';
        document.head.appendChild(referrer);
    }

    // Rate limiting for API calls
    checkRateLimit(endpoint) {
        const now = Date.now();
        const key = `rate_limit_${endpoint}`;
        const lastCall = localStorage.getItem(key);

        if (lastCall && now - parseInt(lastCall) < 1000) { // 1 second rate limit
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        localStorage.setItem(key, now.toString());
        return true;
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js', {
                        scope: '/'
                    });

                    console.log('Service Worker registered successfully:', registration.scope);

                    // Handle updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker?.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New content is available, show update notification
                                this.addNotification('info', 'Update Available',
                                    'A new version is available. Refresh to update.',
                                    () => window.location.reload());
                            }
                        });
                    });

                } catch (error) {
                    console.log('Service Worker registration failed:', error);
                }
            });
        }
    }

    // Professional UI features
    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        const savedTheme = localStorage.getItem('cp-journey-theme') || 'light';

        // Apply saved theme
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

        themeToggle?.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-theme', newTheme);
            themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            localStorage.setItem('cp-journey-theme', newTheme);
        });
    }

    setupDropdowns() {
        // Settings dropdown
        const settingsDropdown = document.getElementById('settingsDropdown');
        const settingsToggle = settingsDropdown?.querySelector('.dropdown-toggle');

        settingsToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('open');
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown').forEach(dropdown => {
                dropdown.classList.remove('open');
            });
        });

        // Handle dropdown items
        document.getElementById('exportDataBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.exportData('manual');
        });

        document.getElementById('importDataBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.importData();
        });

        document.getElementById('preferencesBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPreferences();
        });
    }

    setupBreadcrumbs() {
        this.breadcrumbNav = document.getElementById('breadcrumbNav');
        this.breadcrumb = document.getElementById('breadcrumb') || document.querySelector('.breadcrumb');

        // Show breadcrumbs when user is logged in
        if (this.authToken && this.breadcrumbNav) {
            this.breadcrumbNav.style.display = 'block';
        }
    }

    updateBreadcrumb(items) {
        if (!this.breadcrumb) return;

        this.breadcrumb.innerHTML = items.map((item, index) => {
            const isLast = index === items.length - 1;
            return `
                <li class="breadcrumb-item">
                    ${isLast ?
                        `<span class="breadcrumb-link">
                            ${item.icon ? `<i class="${item.icon}" aria-hidden="true"></i>` : ''}
                            <span>${item.text}</span>
                        </span>` :
                        `<a href="${item.href || '#'}" class="breadcrumb-link">
                            ${item.icon ? `<i class="${item.icon}" aria-hidden="true"></i>` : ''}
                            <span>${item.text}</span>
                        </a>`
                    }
                </li>
            `;
        }).join('');
    }

    setupNotifications() {
        this.notifications = [];
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationBadge = document.getElementById('notificationBadge');

        notificationBtn?.addEventListener('click', () => {
            this.showNotifications();
        });

        // Check for updates and achievements
        this.checkForNotifications();
    }

    addNotification(type, title, message, action = null) {
        const notification = {
            id: Date.now(),
            type, // 'success', 'warning', 'error', 'info'
            title,
            message,
            action,
            timestamp: new Date().toISOString(),
            read: false
        };

        this.notifications.unshift(notification);
        this.updateNotificationBadge();

        // Show toast notification
        this.showToast(notification);

        return notification.id;
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        const unreadCount = this.notifications.filter(n => !n.read).length;

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    showToast(notification) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${notification.type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${notification.title}</div>
                <div class="toast-message">${notification.message}</div>
            </div>
            <button class="toast-close" aria-label="Close notification">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add toast styles if not exists
        this.ensureToastStyles();

        document.body.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);

        // Close button
        toast.querySelector('.toast-close')?.addEventListener('click', () => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        });
    }

    ensureToastStyles() {
        if (document.getElementById('toast-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 1rem;
                box-shadow: var(--shadow-lg);
                z-index: 10000;
                max-width: 350px;
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                animation: toastSlideIn 0.3s ease;
            }

            .toast-success { border-left: 4px solid var(--success-color); }
            .toast-warning { border-left: 4px solid var(--warning-color); }
            .toast-error { border-left: 4px solid var(--danger-color); }
            .toast-info { border-left: 4px solid var(--primary-color); }

            .toast-content { flex: 1; }
            .toast-title { font-weight: 600; margin-bottom: 0.25rem; }
            .toast-message { font-size: 0.875rem; color: var(--text-secondary); }

            .toast-close {
                background: none;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 4px;
                transition: all 0.2s ease;
            }

            .toast-close:hover {
                background-color: var(--bg-secondary);
                color: var(--text-primary);
            }

            .toast-fade-out {
                animation: toastSlideOut 0.3s ease forwards;
            }

            @keyframes toastSlideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            @keyframes toastSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }

    checkForNotifications() {
        // Check for achievements, milestones, etc.
        this.throttle(() => {
            this.checkAchievements();
            this.checkMilestones();
        }, 30000, 'notification-check'); // Check every 30 seconds
    }

    checkAchievements() {
        // Implementation for checking achievements
        // This would check user progress and trigger notifications
    }

    checkMilestones() {
        // Implementation for checking milestones
        // This would check for progress milestones
    }

    showPreferences() {
        // Implementation for preferences modal
        this.addNotification('info', 'Preferences', 'Preferences panel coming soon!');
    }

    showNotifications() {
        // Implementation for notifications panel
        this.addNotification('info', 'Notifications', `You have ${this.notifications.length} notifications.`);
    }

    // Load CSES topics
    async loadCSESTopics() {
        try {
            // Check cache first
            const cachedTopics = this.getCachedData('cses-topics');
            if (cachedTopics) {
                return cachedTopics;
            }

            const response = await this.fetchWithRetry(`${this.API_BASE}/cses/topics`);
            const topics = await response.json();

            // Cache the result
            this.setCachedData('cses-topics', topics);
            return topics;
        } catch (error) {
            console.error('Error loading CSES topics:', error);
            return [];
        }
    }

    async initAuth() {
        // Check if user is already logged in
        if (this.authToken) {
            try {
                const response = await fetch(`${this.API_BASE}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        this.currentUser = result.user;
                        this.updateAuthUI(true);
                        this.prefillPlatformInputs();
                        console.log('✅ User already logged in:', this.currentUser.username);
                        return;
                    }
                }
            } catch (error) {
                console.log('❌ Auth check failed:', error.message);
            }

            // Token is invalid, remove it
            localStorage.removeItem('authToken');
            this.authToken = null;
        }

        this.updateAuthUI(false);
    }

    async loadCSESTopics() {
        const statusEl = document.getElementById('cses-topics-status');
        const grid = document.getElementById('cses-topics-grid');
        if (!statusEl || !grid) return;

        try {
            statusEl.textContent = 'Loading topics...';
            statusEl.className = 'topics-status loading';
            grid.innerHTML = '<div class="loading-spinner">🔄 Fetching CSES topics...</div>';

            const resp = await fetch(`${this.API_BASE}/cses/topics`);
            const data = await resp.json();

            if (!data.success) throw new Error(data.error || 'Failed to fetch topics');

            grid.innerHTML = '';

            data.topics.forEach((topic, index) => {
                const card = document.createElement('div');
                card.className = 'topic-card';

                // Add animation delay for stagger effect
                card.style.animationDelay = `${index * 0.1}s`;

                const countText = topic.count ? `${topic.count} problems` : 'Browse problems';
                const description = topic.description || 'Programming problems and algorithms';

                card.innerHTML = `
                    <div class="topic-header">
                        <div class="topic-title">${topic.title}</div>
                        <div class="topic-count">${countText}</div>
                    </div>
                    <div class="topic-description">${description}</div>
                    <div class="topic-actions">
                        <a class="topic-link primary" href="${topic.url}" target="_blank" rel="noopener">
                            <i class="fas fa-external-link-alt"></i> Open on CSES
                        </a>
                        ${topic.problems && topic.problems.length > 0 ?
                            `<button class="topic-link secondary" onclick="this.toggleProblems(this)">
                                <i class="fas fa-list"></i> Preview Problems
                            </button>` : ''
                        }
                    </div>
                    ${topic.problems && topic.problems.length > 0 ?
                        `<div class="topic-problems" style="display: none;">
                            ${topic.problems.slice(0, 5).map(p =>
                                `<a href="${p.url}" target="_blank" class="problem-link">${p.title}</a>`
                            ).join('')}
                            ${topic.problems.length > 5 ? `<span class="more-problems">...and ${topic.problems.length - 5} more</span>` : ''}
                        </div>` : ''
                    }
                `;

                grid.appendChild(card);
            });

            // Add toggle functionality for problem previews
            window.toggleProblems = function(btn) {
                const card = btn.closest('.topic-card');
                const problemsDiv = card.querySelector('.topic-problems');
                if (problemsDiv) {
                    const isVisible = problemsDiv.style.display !== 'none';
                    problemsDiv.style.display = isVisible ? 'none' : 'block';
                    btn.innerHTML = isVisible ?
                        '<i class="fas fa-list"></i> Preview Problems' :
                        '<i class="fas fa-chevron-up"></i> Hide Problems';
                }
            };

            const statusText = data.fromCache ?
                `Loaded ${data.topics.length} topics (cached)` :
                `Loaded ${data.topics.length} topics from CSES`;

            statusEl.textContent = statusText;
            statusEl.className = 'topics-status success';

            if (data.error) {
                statusEl.textContent += ` (${data.error})`;
                statusEl.className = 'topics-status warning';
            }

        } catch (e) {
            console.error('CSES topics load error:', e);
            statusEl.textContent = 'Unable to load topics (showing defaults)';
            statusEl.className = 'topics-status error';
            grid.innerHTML = '<div class="error-message">Failed to load CSES topics. Please try refreshing the page.</div>';
        }
    }

    updateAuthUI(isLoggedIn) {
        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');

        if (isLoggedIn && this.currentUser) {
            authButtons.style.display = 'none';
            userInfo.style.display = 'flex';
            document.getElementById('username').textContent = this.currentUser.username;
        } else {
            authButtons.style.display = 'flex';
            userInfo.style.display = 'none';
        }

        // Update the journey start button and status based on auth state
        this.updateTimeachine();
    }

    prefillPlatformInputs() {
        if (!this.currentUser || !this.currentUser.platformCredentials) return;
        const creds = this.currentUser.platformCredentials;
        const csesInput = document.getElementById('cses-username');
        const cfInput = document.getElementById('cf-username');
        const vjInput = document.getElementById('vjudge-username');
        if (csesInput && creds.cses) csesInput.value = creds.cses;
        if (cfInput && creds.codeforces) cfInput.value = creds.codeforces;
        if (vjInput && creds.vjudge) vjInput.value = creds.vjudge;
    }

    // Enhanced Data Management with Database Integration
    async loadData() {
        const defaultData = {
            journeyStarted: false,
            startDate: null,
            startedBy: null,
            currentStreak: 0,
            bestStreak: 0,
            lastActiveDate: null,
            cses: {
                intro: { solved: 0, total: 19 },
                sort: { solved: 0, total: 35 },
                dp: { solved: 0, total: 19 },
                graph: { solved: 0, total: 36 },
                range: { solved: 0, total: 19 },
                tree: { solved: 0, total: 16 }
            },
            usaco: {
                bronze: 0,
                silver: 0,
                gold: 0,
                platinum: 0
            },
            codeforces: {
                rating: 'Unrated',
                problemsSolved: 0,
                contests: 0
            },
            revision: {
                problems: 0
            },
            iupc: {
                contests: 0,
                problemsSolved: 0
            },
            icpc: {
                gymProblems: 0,
                contests: 0
            }
        };

        try {
            // Try to load from database first
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await fetch(`${this.API_BASE}/journey`, { headers });
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.data = { ...defaultData, ...result.data };
                    const message = this.currentUser ?
                        `📊 ${this.currentUser.username}'s data loaded` :
                        '📊 Data loaded from database';
                    this.showNotification(message, 'success');
                    return;
                }
            }
        } catch (error) {
            console.log('Database unavailable, using localStorage');
        }

        // Fallback to localStorage
        const savedData = localStorage.getItem('cpJourneyData');
        this.data = savedData ? { ...defaultData, ...JSON.parse(savedData) } : defaultData;

        if (savedData) {
            this.showNotification('💾 Data loaded from local storage', 'info');
        }
    }

    async saveData() {
        // Save to localStorage first (immediate)
        localStorage.setItem('cpJourneyData', JSON.stringify(this.data));

        // Try to save to database
        try {
            const response = await fetch(`${this.API_BASE}/journey`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.data)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ Data saved to database');
                    return true;
                }
            }
        } catch (error) {
            console.log('⚠️ Database save failed, data saved locally');
        }

        return false;
    }

    // Network status monitoring
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('🌐 Back online! Data will sync to database', 'success');
            this.saveData(); // Sync when back online
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNotification('📱 Working offline - data saved locally', 'warning');
        });
    }

    // Authentication helper method
    isAuthenticated() {
        return this.authToken && this.currentUser;
    }

    // Guide new users through account creation
    guideNewUser() {
        this.showNotification('👋 Welcome! Let\'s create your account to start tracking your competitive programming journey!', 'info');
        setTimeout(() => {
            this.showAuthModal('register');
        }, 1500);
    }

    // Journey Management with Database Integration
    startJourney() {
        // Check if user is authenticated
        if (!this.isAuthenticated()) {
            this.guideNewUser();
            return;
        }

        // Check if journey is already started for this user
        if (this.data.journeyStarted) {
            this.showNotification(`⏰ Journey already started by ${this.currentUser.username}!`, 'warning');
            return;
        }

        // Start the journey for authenticated user
        this.data.journeyStarted = true;
        this.data.startDate = new Date().toISOString();
        this.data.startedBy = this.currentUser.username; // Track who started it
        this.saveData();
        this.updateUI();
        this.showNotification(`🚀 Welcome ${this.currentUser.username}! Your CP journey has begun! Data saved to database!`, 'success');
    }

    resetJourney() {
        // Check if user is authenticated
        if (!this.isAuthenticated()) {
            this.showNotification('🔐 You need an account to manage the journey! Please register or login first.', 'error');
            this.showAuthModal('login');
            return;
        }

        // Check if user is the one who started the journey
        if (this.data.startedBy && this.data.startedBy !== this.currentUser.username) {
            this.showNotification(`⛔ Only ${this.data.startedBy} can reset this journey! Each user manages their own journey.`, 'error');
            return;
        }

        if (confirm(`Are you sure you want to reset your entire journey? This action cannot be undone.\n\nJourney started by: ${this.data.startedBy || 'Unknown'}\nStarted on: ${this.data.startDate ? new Date(this.data.startDate).toLocaleDateString() : 'Unknown'}`)) {
            // Create backup before reset
            this.exportData('backup');

            localStorage.removeItem('cpJourneyData');
            this.data = this.getDefaultData();
            this.saveData();
            this.updateUI();
            this.showNotification(`🔄 Journey reset successfully by ${this.currentUser.username}! Previous data backed up.`, 'info');
        }
    }

    getDefaultData() {
        return {
            journeyStarted: false,
            startDate: null,
            startedBy: null,
            currentStreak: 0,
            bestStreak: 0,
            lastActiveDate: null,
            cses: {
                intro: { solved: 0, total: 19 },
                sort: { solved: 0, total: 35 },
                dp: { solved: 0, total: 19 },
                graph: { solved: 0, total: 36 },
                range: { solved: 0, total: 19 },
                tree: { solved: 0, total: 16 }
            },
            usaco: {
                bronze: 0,
                silver: 0,
                gold: 0,
                platinum: 0
            },
            codeforces: {
                rating: 'Unrated',
                problemsSolved: 0,
                contests: 0
            },
            revision: {
                problems: 0
            },
            iupc: {
                contests: 0,
                problemsSolved: 0
            },
            icpc: {
                gymProblems: 0,
                contests: 0
            }
        };
    }

    // Database and Backup Operations
    async exportData(type = 'manual') {
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `cp_journey_${type}_${timestamp}.json`;

            const dataStr = JSON.stringify(this.data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = filename;
            link.click();

            this.showNotification(`📁 Data exported as ${filename}`, 'success');

            // Also try to create server backup
            try {
                const response = await fetch(`${this.API_BASE}/backup`, { method: 'POST' });
                if (response.ok) {
                    console.log('✅ Server backup created');
                }
            } catch (error) {
                console.log('Server backup failed, but file exported');
            }

        } catch (error) {
            this.showNotification('❌ Export failed', 'error');
            console.error('Export error:', error);
        }
    }

    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const importedData = JSON.parse(text);

                // Validate data structure
                if (this.validateImportData(importedData)) {
                    // Create backup before importing
                    this.exportData('pre_import_backup');

                    // Import data
                    this.data = { ...this.getDefaultData(), ...importedData };
                    await this.saveData();
                    this.updateUI();

                    this.showNotification('✅ Data imported successfully! Previous data backed up.', 'success');
                } else {
                    this.showNotification('❌ Invalid file format', 'error');
                }
            } catch (error) {
                this.showNotification('❌ Import failed - invalid JSON file', 'error');
                console.error('Import error:', error);
            }
        };

        input.click();
    }

    validateImportData(data) {
        // Basic validation of import data structure
        const requiredFields = ['cses', 'usaco', 'codeforces'];
        return requiredFields.every(field => data.hasOwnProperty(field));
    }

    async createBackup() {
        try {
            const response = await fetch(`${this.API_BASE}/backup`, { method: 'POST' });
            if (response.ok) {
                const result = await response.json();
                this.showNotification('📦 Backup created on server', 'success');
                return result;
            }
        } catch (error) {
            // Fallback to local export
            this.exportData('backup');
        }
    }

    getDaysElapsed() {
        if (!this.data.journeyStarted || !this.data.startDate) return 0;
        const startDate = new Date(this.data.startDate);
        const currentDate = new Date();
        const timeDiff = currentDate - startDate;
        return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    }

    getCurrentPhase() {
        const daysElapsed = this.getDaysElapsed();

        if (!this.data.journeyStarted) return 'Not Started';
        if (daysElapsed <= 60) return `Phase 1: CSES Problems (Day ${daysElapsed}/60)`;
        if (daysElapsed <= 90) return `Phase 2: Revision (Day ${daysElapsed - 60}/30)`;
        if (daysElapsed <= 165) return `Phase 3: USACO Problems (Day ${daysElapsed - 90}/75)`;
        if (daysElapsed <= 240) return 'Phase 4: Codeforces Victory';
        if (daysElapsed <= 315) return 'Phase 5: IUPC Practice';
        return 'Phase 6: ICPC GYM Practices';
    }

    // Progress Calculation
    getPhaseProgress() {
        const daysElapsed = this.getDaysElapsed();

        return {
            cses: Math.min(Math.max((daysElapsed / 60) * 100, 0), 100),
            revision: Math.min(Math.max(((daysElapsed - 60) / 30) * 100, 0), 100),
            usaco: Math.min(Math.max(((daysElapsed - 90) / 75) * 100, 0), 100),
            codeforces: Math.min(Math.max(((daysElapsed - 165) / 75) * 100, 0), 100),
            iupc: Math.min(Math.max(((daysElapsed - 240) / 75) * 100, 0), 100),
            icpc: daysElapsed > 315 ? 100 : 0 // Final phase - always active when reached
        };
    }

    getTotalProblemsolved() {
        let total = 0;
        Object.values(this.data.cses).forEach(category => {
            total += category.solved || 0;
        });
        Object.values(this.data.usaco).forEach(level => {
            total += level || 0;
        });
        total += this.data.codeforces.problemsSolved;
        total += this.data.revision.problems;
        total += this.data.iupc.problemsSolved || 0;
        total += this.data.icpc.gymProblems || 0;
        return total;
    }

    // Streak Management
    updateStreak() {
        const today = new Date().toDateString();
        const lastActive = this.data.lastActiveDate;

        if (!lastActive) {
            this.data.currentStreak = 1;
        } else {
            const lastActiveDate = new Date(lastActive).toDateString();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayString = yesterday.toDateString();

            if (lastActiveDate === today) {
                // Already active today, don't change streak
                return;
            } else if (lastActiveDate === yesterdayString) {
                // Consecutive day
                this.data.currentStreak++;
            } else {
                // Streak broken
                this.data.currentStreak = 1;
            }
        }

        this.data.lastActiveDate = today;
        this.data.bestStreak = Math.max(this.data.bestStreak, this.data.currentStreak);
        this.saveData();
    }

    // Event Listeners with Database and Platform Sync Features
    initializeEventListeners() {
        // Authentication Event Listeners
        this.initAuthEventListeners();

        // Time Machine
        document.getElementById('start-journey')?.addEventListener('click', () => this.startJourney());
        document.getElementById('reset-journey')?.addEventListener('click', () => this.resetJourney());

        // Database Operations
        document.getElementById('export-data')?.addEventListener('click', () => this.exportData());
        document.getElementById('import-data')?.addEventListener('click', () => this.importData());
        document.getElementById('create-backup')?.addEventListener('click', () => this.createBackup());

        // Platform Sync Operations
        if (document.getElementById('sync-cses')) {
            document.getElementById('sync-cses').addEventListener('click', () => this.syncCSES());
        }
        if (document.getElementById('sync-codeforces')) {
            document.getElementById('sync-codeforces').addEventListener('click', () => this.syncCodeforces());
        }
        if (document.getElementById('sync-vjudge')) {
            document.getElementById('sync-vjudge').addEventListener('click', () => this.syncVJudge());
        }
        if (document.getElementById('sync-all-platforms')) {
            document.getElementById('sync-all-platforms').addEventListener('click', () => this.syncAllPlatforms());
        }
        if (document.getElementById('auto-sync-enabled')) {
            document.getElementById('auto-sync-enabled').addEventListener('change', (e) => {
                this.toggleAutoSync(e.target.checked);
            });
        }

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // Mobile menu
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        hamburger?.addEventListener('click', () => {
            navMenu?.classList.toggle('active');
        });

        // CSES Problem buttons
        document.querySelectorAll('.add-problem[data-category]').forEach(button => {
            button.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.addCSESProblem(category);
            });
        });

        // USACO Problem buttons
        document.querySelectorAll('.add-problem[data-level]').forEach(button => {
            button.addEventListener('click', (e) => {
                const level = e.target.dataset.level;
                this.addUSACOProblem(level);
            });
        });

        // Codeforces buttons
        document.querySelector('.add-problem[data-source="codeforces"]').addEventListener('click', () => {
            this.addCodeforcesproblem();
        });

        document.getElementById('add-contest').addEventListener('click', () => {
            this.addContest();
        });

        document.getElementById('update-rating').addEventListener('click', () => {
            this.updateRating();
        });

        // IUPC and ICPC practice buttons
        const iupcBtn = document.getElementById('iupc-practice-btn');
        if (iupcBtn) {
            iupcBtn.addEventListener('click', () => {
                this.startUnlimitedPractice('IUPC');
            });
        }

        const icpcBtn = document.getElementById('icpc-practice-btn');
        if (icpcBtn) {
            icpcBtn.addEventListener('click', () => {
                this.startUnlimitedPractice('ICPC');
            });
        }
    }

    // Problem Addition Methods
    addCSESProblem(category) {
        if (this.data.cses[category] && this.data.cses[category].solved < this.data.cses[category].total) {
            this.data.cses[category].solved++;
            this.updateStreak();
            this.saveData();
            this.updateUI();
            this.showNotification(`✅ CSES ${this.getCategoryName(category)} problem solved!`, 'success');
        } else {
            this.showNotification(`🎉 All ${this.getCategoryName(category)} problems completed!`, 'info');
        }
    }

    addUSACOProblem(level) {
        this.data.usaco[level]++;
        this.updateStreak();
        this.saveData();
        this.updateUI();
        this.showNotification(`🏆 USACO ${level.toUpperCase()} problem solved!`, 'success');
    }

    addCodeforcesproblem() {
        this.data.codeforces.problemsSolved++;
        this.updateStreak();
        this.saveData();
        this.updateUI();
        this.showNotification('👑 Codeforces problem solved!', 'success');
    }

    addContest() {
        this.data.codeforces.contests++;
        this.updateStreak();
        this.saveData();
        this.updateUI();
        this.showNotification('🎯 Contest participated!', 'success');
    }

    updateRating() {
        const rating = prompt('Enter your current Codeforces rating:');
        if (rating && !isNaN(rating)) {
            this.data.codeforces.rating = parseInt(rating);
            this.saveData();
            this.updateUI();
            this.showNotification(`📈 Rating updated to ${rating}!`, 'success');
        } else if (rating !== null) {
            this.showNotification('❌ Please enter a valid rating number!', 'error');
        }
    }

    startUnlimitedPractice(contestType) {
        const messages = {
            'IUPC': {
                title: '🎓 IUPC Unlimited Practice Started!',
                description: 'Practice IUPC problems with unlimited time. Focus on learning algorithms and problem-solving techniques without any time pressure.',
                url: 'https://toph.co/contests'
            },
            'ICPC': {
                title: '🏆 ICPC Unlimited Practice Started!',
                description: 'Master ICPC-style problems with unlimited attempts. Build your competitive programming skills at your own pace.',
                url: 'https://codeforces.com/contests'
            }
        };

        const message = messages[contestType];

        // Show success notification
        this.showNotification(message.title, 'success');

        // Show detailed practice info
        setTimeout(() => {
            alert(`${message.title}\n\n${message.description}\n\n💡 Tips for unlimited practice:\n• Take your time to understand each problem\n• Try multiple approaches\n• Don't worry about time limits\n• Focus on learning over speed\n• Review solutions after solving`);
        }, 1000);

        // Optional: Open practice platform
        const openPlatform = confirm(`Would you like to open the ${contestType} practice platform?`);
        if (openPlatform) {
            window.open(message.url, '_blank');
        }

        // Track practice sessions (optional)
        const practiceKey = `${contestType.toLowerCase()}Practice`;
        if (!this.data[practiceKey]) {
            this.data[practiceKey] = { sessions: 0, problemsSolved: 0 };
        }
        this.data[practiceKey].sessions++;
        this.saveData();

        console.log(`🚀 ${contestType} unlimited practice session started!`);
    }

    // UI Update Methods
    updateUI() {
        this.updateTimeachine();
        this.updateDashboard();
        this.updateCSESSection();
        this.updateUSACOSection();
        this.updateCodeforcesSection();
        this.updateStatistics();
    }

    updateTimeachine() {
        const startButton = document.getElementById('start-journey');
        const resetButton = document.getElementById('reset-journey');
        const journeyStatus = document.getElementById('journey-status');
        const journeyTimer = document.getElementById('journey-timer');
        const daysElapsed = document.getElementById('days-elapsed');
        const currentPhase = document.getElementById('current-phase');

        if (this.data.journeyStarted) {
            startButton.style.display = 'none';
            resetButton.style.display = 'inline-block';

            // Show who started the journey and when
            const startedBy = this.data.startedBy || 'Unknown User';
            const startDate = new Date(this.data.startDate).toLocaleDateString();
            journeyStatus.innerHTML = `
                <span>🚀 Journey started by <strong>${startedBy}</strong> on ${startDate}</span>
            `;
            journeyTimer.style.display = 'flex';

            daysElapsed.textContent = this.getDaysElapsed();
            currentPhase.textContent = this.getCurrentPhase();
        } else {
            resetButton.style.display = 'none';
            journeyTimer.style.display = 'none';

            // Check authentication status for start button
            if (this.isAuthenticated()) {
                startButton.style.display = 'inline-block';
                startButton.disabled = false;
                startButton.textContent = '🚀 Start Your Journey';
                journeyStatus.textContent = `Ready to start your competitive programming journey, ${this.currentUser.username}?`;
            } else {
                startButton.style.display = 'inline-block';
                startButton.disabled = false;
                startButton.textContent = '� Create Account to Start';
                journeyStatus.innerHTML = `
                    <div class="account-required">
                        <p><strong>🔐 Account Required to Start Journey</strong></p>
                        <p>You need to create a free account to start your competitive programming journey!</p>
                        <p><small>✨ Track progress • Save data • Sync across devices • Access all features</small></p>
                        <p><small>🚀 Join thousands of programmers improving their skills!</small></p>
                    </div>
                `;
            }
        }
    }

    updateDashboard() {
        const progress = this.getPhaseProgress();

        // Update progress bars
        document.getElementById('cses-progress').style.width = `${progress.cses}%`;
        document.getElementById('revision-progress').style.width = `${progress.revision}%`;
        document.getElementById('usaco-progress').style.width = `${progress.usaco}%`;
        document.getElementById('cf-progress').style.width = `${progress.codeforces}%`;
        document.getElementById('iupc-progress').style.width = `${progress.iupc}%`;
        document.getElementById('icpc-progress').style.width = `${progress.icpc}%`;

        // Update progress text
        const daysElapsed = this.getDaysElapsed();
        document.getElementById('cses-progress-text').textContent =
            `${Math.min(daysElapsed, 60)}/60 days`;
        document.getElementById('revision-progress-text').textContent =
            `${Math.max(Math.min(daysElapsed - 60, 30), 0)}/30 days`;
        document.getElementById('usaco-progress-text').textContent =
            `${Math.max(Math.min(daysElapsed - 90, 75), 0)}/75 days`;

        // Update Codeforces progress text for unlimited time
        const cfProgressText = document.getElementById('cf-progress-text');
        if (cfProgressText) {
            if (daysElapsed > 165) {
                cfProgressText.textContent = '∞ Unlimited practice time - Learn at your own pace!';
            } else {
                cfProgressText.textContent = 'Practice at your own pace!';
            }
        }

        // Update IUPC progress text
        const iupcProgressText = document.getElementById('iupc-progress-text');
        if (iupcProgressText) {
            if (daysElapsed > 240) {
                iupcProgressText.textContent = '🏆 Master university contests - Unlimited time!';
            } else {
                iupcProgressText.textContent = 'Master university contests!';
            }
        }

        // Update ICPC progress text
        const icpcProgressText = document.getElementById('icpc-progress-text');
        if (icpcProgressText) {
            if (daysElapsed > 315) {
                icpcProgressText.textContent = '🌍 Train for world finals - Unlimited practice!';
            } else {
                icpcProgressText.textContent = 'Train for world finals!';
            }
        }

        // Update problem counts
        const totalCSES = Object.values(this.data.cses).reduce((sum, cat) => sum + (cat.solved || 0), 0);
        document.getElementById('cses-solved').textContent = totalCSES;
        document.getElementById('revision-problems').textContent = this.data.revision.problems;

        const totalUSACO = Object.values(this.data.usaco).reduce((sum, count) => sum + count, 0);
        document.getElementById('usaco-solved').textContent = totalUSACO;
        document.getElementById('cf-rating').textContent = this.data.codeforces.rating;

        // Update IUPC and ICPC counts
        document.getElementById('iupc-solved').textContent = this.data.iupc.contests || 0;
        document.getElementById('icpc-solved').textContent = this.data.icpc.gymProblems || 0;
    }

    updateCSESSection() {
        Object.keys(this.data.cses).forEach(category => {
            const solved = this.data.cses[category].solved;
            const total = this.data.cses[category].total;
            const percentage = (solved / total) * 100;

            document.getElementById(`${category}-solved`).textContent = solved;
            document.getElementById(`${category}-progress`).style.width = `${percentage}%`;
        });
    }

    updateUSACOSection() {
        Object.keys(this.data.usaco).forEach(level => {
            document.getElementById(`${level}-solved`).textContent = this.data.usaco[level];
        });
    }

    updateCodeforcesSection() {
        document.getElementById('cf-current-rating').textContent = this.data.codeforces.rating;
        document.getElementById('cf-problems-solved').textContent = this.data.codeforces.problemsSolved;
        document.getElementById('cf-contests').textContent = this.data.codeforces.contests;
    }

    updateStatistics() {
        const totalProblems = this.getTotalProblemsolved();
        const journeyProgress = this.data.journeyStarted ?
            Math.min((this.getDaysElapsed() / 165) * 100, 100) : 0;

        document.getElementById('total-problems').textContent = totalProblems;
        document.getElementById('current-streak').textContent = `${this.data.currentStreak} days`;
        document.getElementById('best-streak').textContent = `${this.data.bestStreak} days`;
        document.getElementById('journey-progress').textContent = `${Math.round(journeyProgress)}%`;
    }

    // Utility Methods
    getCategoryName(category) {
        const names = {
            intro: 'Introductory',
            sort: 'Sorting and Searching',
            dp: 'Dynamic Programming',
            graph: 'Graph Algorithms',
            range: 'Range Queries',
            tree: 'Tree Algorithms'
        };
        return names[category] || category;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            color: 'white',
            fontWeight: '500',
            zIndex: '9999',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease',
            transform: 'translateX(400px)'
        });

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // Add to DOM
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    startPeriodicUpdates() {
        // Update UI every minute to keep timers current
        setInterval(() => {
            if (this.data.journeyStarted) {
                this.updateTimeachine();
                this.updateDashboard();
            }
        }, 60000);

        // Update progress every hour
        setInterval(() => {
            if (this.data.journeyStarted) {
                this.updateUI();
            }
        }, 3600000);

        // Check database status every 30 seconds
        setInterval(() => {
            this.checkDatabaseStatus();
        }, 30000);

        // Initial database status check
        this.checkDatabaseStatus();
    }

    async checkDatabaseStatus() {
        const statusElement = document.getElementById('db-status');
        if (!statusElement) return;

        try {
            const response = await fetch(`${this.API_BASE}/health`);
            if (response.ok) {
                statusElement.textContent = 'Online';
                statusElement.className = 'status-badge status-online';
                this.isOnline = true;
                // Load sync status when database is online
                this.loadSyncStatus();
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            statusElement.textContent = 'Offline';
            statusElement.className = 'status-badge status-offline';
            this.isOnline = false;
        }
    }

    // Platform Sync Methods
    async syncCSES() {
        let username = '';
        if (this.currentUser && this.currentUser.platformCredentials && this.currentUser.platformCredentials.cses) {
            username = this.currentUser.platformCredentials.cses.trim();
        } else {
            username = document.getElementById('cses-username').value.trim();
        }
        if (!username) {
            this.showNotification('❌ Please enter your CSES username', 'error');
            return;
        }

        const button = document.getElementById('sync-cses');
        const status = document.getElementById('cses-sync-status');

        this.setSyncStatus('cses', 'syncing', 'Syncing...');
        button.disabled = true;

        this.addLogEntry('info', `Starting CSES sync for user: ${username}`);

        try {
            const response = await fetch(`${this.API_BASE}/sync/cses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            const result = await response.json();

            if (result.success) {
                this.setSyncStatus('cses', 'success', `✅ ${result.totalSolved} problems synced`);
                this.addLogEntry('success', `CSES: Found ${result.totalSolved} solved problems`);
                this.showNotification(`🎉 CSES sync successful! ${result.totalSolved} problems found`, 'success');

                // Save username for future syncs
                localStorage.setItem('cses-username', username);

                // Reload data to reflect changes
                await this.loadData();
                this.updateUI();
            } else {
                throw new Error(result.error || 'Sync failed');
            }
        } catch (error) {
            this.setSyncStatus('cses', 'error', '❌ Sync failed');
            this.addLogEntry('error', `CSES sync error: ${error.message}`);
            this.showNotification(`❌ CSES sync failed: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
        }
    }

    async syncCodeforces() {
        let username = '';
        if (this.currentUser && this.currentUser.platformCredentials && this.currentUser.platformCredentials.codeforces) {
            username = this.currentUser.platformCredentials.codeforces.trim();
        } else {
            username = document.getElementById('cf-username').value.trim();
        }
        if (!username) {
            this.showNotification('❌ Please enter your Codeforces handle', 'error');
            return;
        }

        const button = document.getElementById('sync-codeforces');
        const status = document.getElementById('cf-sync-status');

        this.setSyncStatus('codeforces', 'syncing', 'Syncing...');
        button.disabled = true;

        this.addLogEntry('info', `Starting Codeforces sync for user: ${username}`);

        try {
            const response = await fetch(`${this.API_BASE}/sync/codeforces`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            const result = await response.json();

            if (result.success) {
                this.setSyncStatus('codeforces', 'success', `✅ Rating: ${result.rating}, ${result.problemsSolved} problems`);
                this.addLogEntry('success', `Codeforces: Rating ${result.rating}, ${result.problemsSolved} problems, ${result.contests} contests`);
                this.showNotification(`🎉 Codeforces sync successful! Rating: ${result.rating}`, 'success');

                // Save username for future syncs
                localStorage.setItem('cf-username', username);

                // Reload data to reflect changes
                await this.loadData();
                this.updateUI();
            } else {
                throw new Error(result.error || 'Sync failed');
            }
        } catch (error) {
            this.setSyncStatus('codeforces', 'error', '❌ Sync failed');
            this.addLogEntry('error', `Codeforces sync error: ${error.message}`);
            this.showNotification(`❌ Codeforces sync failed: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
        }
    }

    async syncVJudge() {
        let username = '';
        if (this.currentUser && this.currentUser.platformCredentials && this.currentUser.platformCredentials.vjudge) {
            username = this.currentUser.platformCredentials.vjudge.trim();
        } else {
            username = document.getElementById('vjudge-username').value.trim();
        }
        if (!username) {
            this.showNotification('❌ Please enter your VJudge username', 'error');
            return;
        }

        const button = document.getElementById('sync-vjudge');
        const status = document.getElementById('vjudge-sync-status');

        this.setSyncStatus('vjudge', 'syncing', 'Syncing...');
        button.disabled = true;

        this.addLogEntry('info', `Starting VJudge sync for user: ${username}`);

        try {
            const response = await fetch(`${this.API_BASE}/sync/vjudge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            const result = await response.json();

            if (result.success) {
                this.setSyncStatus('vjudge', 'success', `✅ ${result.totalSolved} problems synced`);
                this.addLogEntry('success', `VJudge: ${result.totalSolved} solved problems`);
                this.showNotification(`🎉 VJudge sync successful! ${result.totalSolved} problems found`, 'success');

                // Save username for future syncs
                localStorage.setItem('vjudge-username', username);

                // Update streaks based on VJudge activity
                this.updateStreakFromVJudge(result.dailyActivity);

                // Reload data to reflect changes
                await this.loadData();
                this.updateUI();
            } else {
                throw new Error(result.error || 'Sync failed');
            }
        } catch (error) {
            this.setSyncStatus('vjudge', 'error', '❌ Sync failed');
            this.addLogEntry('error', `VJudge sync error: ${error.message}`);
            this.showNotification(`❌ VJudge sync failed: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
        }
    }

    async syncAllPlatforms() {
        let usernames = { cses: '', codeforces: '', vjudge: '' };
        if (this.currentUser && this.currentUser.platformCredentials) {
            usernames = {
                cses: this.currentUser.platformCredentials.cses.trim(),
                codeforces: this.currentUser.platformCredentials.codeforces.trim(),
                vjudge: this.currentUser.platformCredentials.vjudge.trim()
            };
        } else {
            usernames = {
                cses: document.getElementById('cses-username').value.trim(),
                codeforces: document.getElementById('cf-username').value.trim(),
                vjudge: document.getElementById('vjudge-username').value.trim()
            };
        }
        // Check if at least one username is provided
        if (!usernames.cses && !usernames.codeforces && !usernames.vjudge) {
            this.showNotification('❌ Please enter at least one platform username', 'error');
            return;
        }

        const button = document.getElementById('sync-all-platforms');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing All...';

        this.addLogEntry('info', 'Starting multi-platform sync...');
        this.showSyncLog();

        try {
            const response = await fetch(`${this.API_BASE}/sync/all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames })
            });

            const result = await response.json();

            if (result.success) {
                // Update individual platform statuses
                if (result.results.cses) {
                    const status = result.results.cses.success ? 'success' : 'error';
                    const text = result.results.cses.success ?
                        `✅ ${result.results.cses.totalSolved} problems` : '❌ Sync failed';
                    this.setSyncStatus('cses', status, text);
                    this.addLogEntry(status, `CSES: ${result.results.cses.success ? 'Success' : result.results.cses.error}`);
                }

                if (result.results.codeforces) {
                    const status = result.results.codeforces.success ? 'success' : 'error';
                    const text = result.results.codeforces.success ?
                        `✅ Rating: ${result.results.codeforces.rating}` : '❌ Sync failed';
                    this.setSyncStatus('codeforces', status, text);
                    this.addLogEntry(status, `Codeforces: ${result.results.codeforces.success ? 'Success' : result.results.codeforces.error}`);
                }

                if (result.results.vjudge) {
                    const status = result.results.vjudge.success ? 'success' : 'error';
                    const text = result.results.vjudge.success ?
                        `✅ ${result.results.vjudge.totalSolved} problems` : '❌ Sync failed';
                    this.setSyncStatus('vjudge', status, text);
                    this.addLogEntry(status, `VJudge: ${result.results.vjudge.success ? 'Success' : result.results.vjudge.error}`);
                }

                // Save usernames for future syncs
                Object.keys(usernames).forEach(platform => {
                    if (usernames[platform]) {
                        localStorage.setItem(`${platform === 'codeforces' ? 'cf' : platform}-username`, usernames[platform]);
                    }
                });

                this.showNotification('🎉 Multi-platform sync completed!', 'success');
                this.addLogEntry('success', 'Multi-platform sync completed successfully');

                // Reload data to reflect all changes
                await this.loadData();
                this.updateUI();
            } else {
                throw new Error(result.error || 'Multi-platform sync failed');
            }
        } catch (error) {
            this.addLogEntry('error', `Multi-platform sync error: ${error.message}`);
            this.showNotification(`❌ Multi-platform sync failed: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-sync-alt"></i> Sync All Platforms';
        }
    }

    // Helper methods for sync UI
    setSyncStatus(platform, status, text) {
        const statusElement = document.getElementById(`${platform === 'codeforces' ? 'cf' : platform}-sync-status`);
        if (statusElement) {
            statusElement.textContent = text;
            statusElement.className = `sync-status ${status}`;
        }
    }

    addLogEntry(type, message) {
        const logContent = document.getElementById('log-content');
        if (logContent) {
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logContent.appendChild(entry);
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    showSyncLog() {
        const syncLog = document.getElementById('sync-log');
        if (syncLog) {
            syncLog.style.display = 'block';
        }
    }

    async loadSyncStatus() {
        try {
            const response = await fetch(`${this.API_BASE}/sync/status`);
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    const status = result.status;

                    // Load saved usernames and update UI
                    const csesUsername = localStorage.getItem('cses-username') || status.platforms.cses.username;
                    const cfUsername = localStorage.getItem('cf-username') || status.platforms.codeforces.username;
                    const vjudgeUsername = localStorage.getItem('vjudge-username') || status.platforms.vjudge.username;

                    if (csesUsername) {
                        document.getElementById('cses-username').value = csesUsername;
                        const statusText = status.platforms.cses.success ?
                            `✅ Last sync: ${new Date(status.platforms.cses.lastSync).toLocaleDateString()}` :
                            'Not configured';
                        this.setSyncStatus('cses', status.platforms.cses.success ? 'success' : 'not-configured', statusText);
                    }

                    if (cfUsername) {
                        document.getElementById('cf-username').value = cfUsername;
                        const statusText = status.platforms.codeforces.success ?
                            `✅ Rating: ${status.platforms.codeforces.currentRating}` :
                            'Not configured';
                        this.setSyncStatus('codeforces', status.platforms.codeforces.success ? 'success' : 'not-configured', statusText);
                    }

                    if (vjudgeUsername) {
                        document.getElementById('vjudge-username').value = vjudgeUsername;
                        const statusText = status.platforms.vjudge.success ?
                            `✅ ${status.platforms.vjudge.totalSolved} problems` :
                            'Not configured';
                        this.setSyncStatus('vjudge', status.platforms.vjudge.success ? 'success' : 'not-configured', statusText);
                    }
                }
            }
        } catch (error) {
            console.log('Could not load sync status');
        }
    }

    updateStreakFromVJudge(dailyActivity) {
        if (!dailyActivity) return;

        const today = new Date().toDateString();
        if (dailyActivity[today] && dailyActivity[today] > 0) {
            this.updateStreak();
        }
    }

    toggleAutoSync(enabled) {
        localStorage.setItem('auto-sync-enabled', enabled);
        if (enabled) {
            this.startAutoSync();
            this.showNotification('🔄 Daily auto-sync enabled', 'success');
        } else {
            this.stopAutoSync();
            this.showNotification('⏸️ Daily auto-sync disabled', 'info');
        }
    }

    startAutoSync() {
        // Auto-sync every 24 hours
        this.autoSyncInterval = setInterval(() => {
            const usernames = {
                cses: document.getElementById('cses-username').value.trim(),
                codeforces: document.getElementById('cf-username').value.trim(),
                vjudge: document.getElementById('vjudge-username').value.trim()
            };

            if (usernames.cses || usernames.codeforces || usernames.vjudge) {
                this.addLogEntry('info', 'Starting automatic daily sync...');
                this.syncAllPlatforms();
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
    }

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    }

    // Authentication Methods
    initAuthEventListeners() {
        // Login button
        document.getElementById('loginBtn')?.addEventListener('click', () => {
            this.showAuthModal('login');
        });

        // Register button
        document.getElementById('registerBtn')?.addEventListener('click', () => {
            this.showAuthModal('register');
        });

        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });

        // Modal close button
        document.querySelector('.close')?.addEventListener('click', () => {
            this.hideAuthModal();
        });

        // Modal background click
        document.getElementById('authModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('authModal')) {
                this.hideAuthModal();
            }
        });

        // Tab switching
        document.getElementById('loginTab')?.addEventListener('click', () => {
            this.switchAuthTab('login');
        });

        document.getElementById('registerTab')?.addEventListener('click', () => {
            this.switchAuthTab('register');
        });

        // Form submissions
        document.getElementById('loginFormElement')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerFormElement')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
    }

    showAuthModal(tab = 'login') {
        const modal = document.getElementById('authModal');
        modal.style.display = 'block';
        this.switchAuthTab(tab);
        this.hideAuthMessage();
    }

    hideAuthModal() {
        const modal = document.getElementById('authModal');
        modal.style.display = 'none';
        this.clearAuthForms();
        this.hideAuthMessage();
    }

    switchAuthTab(tab) {
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.style.display = 'block';
            loginForm.style.display = 'none';
        }
        this.hideAuthMessage();
    }

    clearAuthForms() {
        document.getElementById('loginFormElement').reset();
        document.getElementById('registerFormElement').reset();
    }

    showAuthMessage(message, type = 'success') {
        const messageDiv = document.getElementById('authMessage');
        messageDiv.textContent = message;
        messageDiv.className = `auth-message ${type}`;
        messageDiv.style.display = 'block';
    }

    hideAuthMessage() {
        const messageDiv = document.getElementById('authMessage');
        messageDiv.style.display = 'none';
    }

    async handleLogin() {
        const formData = new FormData(document.getElementById('loginFormElement'));
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const response = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (result.success) {
                this.authToken = result.token;
                this.currentUser = result.user;
                localStorage.setItem('authToken', this.authToken);

                this.showAuthMessage('Login successful! Welcome back!', 'success');
                this.updateAuthUI(true);

                setTimeout(() => {
                    this.hideAuthModal();
                    // Auto-sync platform data if credentials are available
                    if (result.platformCredentials) {
                        this.autoSyncOnLogin(result.platformCredentials);
                    }
                    // Prefill any platform inputs in UI
                    this.prefillPlatformInputs();
                    // Reload journey data
                    this.loadData();
                }, 1500);
            } else {
                this.showAuthMessage(result.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAuthMessage('Login failed. Please try again.', 'error');
        }
    }

    async handleRegister() {
        const formData = new FormData(document.getElementById('registerFormElement'));

        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');

        if (password !== confirmPassword) {
            this.showAuthMessage('Passwords do not match', 'error');
            return;
        }

        const registerData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: password,
            platformCredentials: {
                cses: formData.get('csesUsername') || '',
                codeforces: formData.get('codeforcesHandle') || '',
                vjudge: formData.get('vjudgeUsername') || ''
            },
            preferences: {
                autoSync: formData.get('autoSync') === 'on'
            }
        };

        try {
            const response = await fetch(`${this.API_BASE}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });

            const result = await response.json();

            if (result.success) {
                this.showAuthMessage('Registration successful! You can now login.', 'success');
                setTimeout(() => {
                    this.switchAuthTab('login');
                    document.getElementById('loginUsername').value = registerData.username;
                }, 1500);
            } else {
                this.showAuthMessage(result.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showAuthMessage('Registration failed. Please try again.', 'error');
        }
    }

    async logout() {
        try {
            await fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear local auth data
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');

        // Update UI
        this.updateAuthUI(false);

        // Reload with default data
        this.loadData();

        console.log('✅ Logged out successfully');
    }

    async autoSyncOnLogin(platformCredentials) {
        if (!platformCredentials || !this.currentUser?.preferences?.autoSync) {
            return;
        }

        console.log('🔄 Starting auto-sync on login...');

        // Show sync notification
        this.showNotification('Auto-syncing platform data...', 'info');

        // Trigger platform sync in background
        setTimeout(() => {
            this.syncAllPlatformsWithCredentials(platformCredentials);
        }, 2000);
    }

    async syncAllPlatformsWithCredentials(credentials) {
        try {
            const usernames = {
                cses: credentials.cses,
                codeforces: credentials.codeforces,
                vjudge: credentials.vjudge
            };

            const response = await fetch(`${this.API_BASE}/sync/all`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ usernames })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Auto-sync completed successfully!', 'success');
                // Reload data to reflect sync results
                setTimeout(() => {
                    this.loadData();
                }, 1000);
            } else {
                this.showNotification('Auto-sync completed with some errors', 'warning');
            }
        } catch (error) {
            console.error('Auto-sync error:', error);
            this.showNotification('Auto-sync failed', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.className = `notification ${type} show`;

        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize the application regardless of when the script loads
(function initCPJourney() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new CPJourney());
    } else {
        // DOM is already parsed (interactive/complete)
        new CPJourney();
    }
})();

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl + R for reset (with confirmation)
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        const resetButton = document.getElementById('reset-journey');
        if (resetButton.style.display !== 'none') {
            resetButton.click();
        }
    }

    // Space bar to start journey
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        const startButton = document.getElementById('start-journey');
        if (startButton.style.display !== 'none') {
            startButton.click();
        }
    }
});

// Enhanced CSES Organization and Management
class CSESManager {
    constructor() {
        this.categories = {
            intro: { name: 'Introductory Problems', total: 19, difficulty: 'beginner', solved: 0 },
            sort: { name: 'Sorting and Searching', total: 35, difficulty: 'beginner', solved: 0 },
            dp: { name: 'Dynamic Programming', total: 19, difficulty: 'intermediate', solved: 0 },
            graph: { name: 'Graph Algorithms', total: 36, difficulty: 'intermediate', solved: 0 },
            math: { name: 'Mathematics', total: 31, difficulty: 'intermediate', solved: 0 },
            range: { name: 'Range Queries', total: 19, difficulty: 'advanced', solved: 0 },
            tree: { name: 'Tree Algorithms', total: 16, difficulty: 'advanced', solved: 0 },
            geometry: { name: 'Geometry', total: 7, difficulty: 'advanced', solved: 0 },
            string: { name: 'String Algorithms', total: 17, difficulty: 'advanced', solved: 0 }
        };

        this.init();
    }

    init() {
        this.loadProgress();
        this.setupEventListeners();
        this.updateUI();
        this.updateRecommendations();
    }

    loadProgress() {
        // Load progress from localStorage or API
        const saved = localStorage.getItem('cses-progress');
        if (saved) {
            const progress = JSON.parse(saved);
            Object.keys(this.categories).forEach(key => {
                if (progress[key] !== undefined) {
                    this.categories[key].solved = progress[key];
                }
            });
        }
    }

    saveProgress() {
        const progress = {};
        Object.keys(this.categories).forEach(key => {
            progress[key] = this.categories[key].solved;
        });
        localStorage.setItem('cses-progress', JSON.stringify(progress));
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('cses-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterCategories(e.target.value);
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterByDifficulty(e.target.dataset.filter);
            });
        });

        // Add problem buttons
        document.querySelectorAll('.add-problem-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.closest('[data-category]').dataset.category;
                this.addProblem(category);
            });
        });

        // View problems buttons
        document.querySelectorAll('.view-problems-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.closest('[data-category]').dataset.category;
                this.viewProblems(category);
            });
        });
    }

    addProblem(category) {
        if (this.categories[category]) {
            const cat = this.categories[category];
            if (cat.solved < cat.total) {
                cat.solved++;
                this.saveProgress();
                this.updateUI();
                this.updateRecommendations();
                this.showSuccessMessage(`Added 1 problem to ${cat.name}! (${cat.solved}/${cat.total})`);
            } else {
                this.showInfoMessage(`${cat.name} is already completed! 🎉`);
            }
        }
    }

    viewProblems(category) {
        if (this.categories[category]) {
            const cat = this.categories[category];
            const url = `https://cses.fi/problemset/`;
            window.open(url, '_blank');
            this.showInfoMessage(`Opening CSES ${cat.name} problems...`);
        }
    }

    filterCategories(searchTerm) {
        const cards = document.querySelectorAll('.category-card');
        const term = searchTerm.toLowerCase();

        cards.forEach(card => {
            const category = card.dataset.category;
            const categoryInfo = this.categories[category];
            const matches = categoryInfo.name.toLowerCase().includes(term) ||
                          category.toLowerCase().includes(term);

            card.style.display = matches ? 'block' : 'none';
        });
    }

    filterByDifficulty(difficulty) {
        const sections = document.querySelectorAll('.difficulty-section');

        if (difficulty === 'all') {
            sections.forEach(section => {
                section.classList.remove('hidden');
            });
        } else {
            sections.forEach(section => {
                if (section.dataset.difficulty === difficulty) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            });
        }
    }

    updateUI() {
        let totalSolved = 0;
        let totalProblems = 0;

        // Update individual categories
        Object.keys(this.categories).forEach(key => {
            const cat = this.categories[key];
            totalSolved += cat.solved;
            totalProblems += cat.total;

            // Update solved count
            const solvedEl = document.getElementById(`${key}-solved`);
            if (solvedEl) {
                solvedEl.textContent = cat.solved;
            }

            // Update progress bar
            const progressEl = document.getElementById(`${key}-progress`);
            if (progressEl) {
                const percentage = (cat.solved / cat.total) * 100;
                progressEl.style.width = `${percentage}%`;
            }

            // Update progress circle
            const progressCircle = document.querySelector(`[data-category="${key}"] .progress-circle`);
            if (progressCircle) {
                const span = progressCircle.querySelector('span');
                if (span) {
                    span.textContent = cat.solved;
                }
            }
        });

        // Update overall stats
        const totalSolvedEl = document.getElementById('total-cses-solved');
        if (totalSolvedEl) {
            totalSolvedEl.textContent = totalSolved;
        }

        const completionEl = document.getElementById('cses-completion');
        if (completionEl) {
            const percentage = Math.round((totalSolved / totalProblems) * 100);
            completionEl.textContent = `${percentage}%`;
        }

        const progressStatsEl = document.getElementById('cses-progress-stats');
        if (progressStatsEl) {
            progressStatsEl.textContent = `${totalSolved} / ${totalProblems} problems`;
        }

        const overallProgressBar = document.getElementById('cses-overall-progress-bar');
        if (overallProgressBar) {
            const percentage = (totalSolved / totalProblems) * 100;
            overallProgressBar.style.width = `${percentage}%`;
        }
    }

    updateRecommendations() {
        const recommendationEl = document.getElementById('learning-recommendation');
        if (!recommendationEl) return;

        // Find next recommended category
        const beginnerCategories = Object.keys(this.categories).filter(key =>
            this.categories[key].difficulty === 'beginner'
        );

        const incompleteBeginnerCategories = beginnerCategories.filter(key =>
            this.categories[key].solved < this.categories[key].total
        );

        let recommendation = '';

        if (incompleteBeginnerCategories.length > 0) {
            const nextCategory = this.categories[incompleteBeginnerCategories[0]];
            recommendation = `Continue with <strong>${nextCategory.name}</strong> to strengthen your fundamentals! (${nextCategory.solved}/${nextCategory.total} completed)`;
        } else {
            const intermediateCategories = Object.keys(this.categories).filter(key =>
                this.categories[key].difficulty === 'intermediate' &&
                this.categories[key].solved < this.categories[key].total
            );

            if (intermediateCategories.length > 0) {
                const nextCategory = this.categories[intermediateCategories[0]];
                recommendation = `Great job on basics! Try <strong>${nextCategory.name}</strong> next! (${nextCategory.solved}/${nextCategory.total} completed)`;
            } else {
                recommendation = `Excellent progress! Ready for <strong>Advanced Level</strong> challenges! 🚀`;
            }
        }

        recommendationEl.innerHTML = `<p>${recommendation}</p>`;
    }

    updateRecentActivity() {
        const activityEl = document.getElementById('recent-activity');
        if (!activityEl) return;

        // This could be enhanced with actual activity tracking
        const recentlyWorked = Object.keys(this.categories).filter(key =>
            this.categories[key].solved > 0
        ).slice(-3);

        if (recentlyWorked.length === 0) {
            activityEl.innerHTML = '<p>No recent activity. Start solving problems!</p>';
        } else {
            const activityHTML = recentlyWorked.map(key => {
                const cat = this.categories[key];
                return `<div class="activity-item">
                    <span class="activity-category">${cat.name}</span>
                    <span class="activity-progress">${cat.solved}/${cat.total}</span>
                </div>`;
            }).join('');

            activityEl.innerHTML = activityHTML;
        }
    }

    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    showInfoMessage(message) {
        this.showToast(message, 'info');
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Style the toast
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease',
            maxWidth: '300px'
        });

        if (type === 'success') {
            toast.style.background = '#10b981';
        } else if (type === 'info') {
            toast.style.background = '#3b82f6';
        }

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // ====== PROFESSIONAL USER EXPERIENCE ENHANCEMENTS ======

    setupProfessionalInteractions() {
        // Enhanced form validation with real-time feedback
        this.setupFormValidation();

        // Professional loading states for all buttons
        this.setupButtonStates();

        // Smart error handling with user-friendly messages
        this.setupErrorHandling();

        // Performance monitoring and user feedback
        this.setupPerformanceMonitoring();

        // Enhanced keyboard navigation
        this.setupKeyboardNavigation();
    }

    setupFormValidation() {
        document.querySelectorAll('input, textarea, select').forEach(field => {
            // Real-time validation on blur
            field.addEventListener('blur', (e) => {
                this.validateField(e.target);
            });

            // Clear errors on focus
            field.addEventListener('focus', (e) => {
                this.clearFieldError(e.target);
            });
        });
    }

    validateField(field) {
        const value = field.value.trim();
        const type = field.type;
        let isValid = true;
        let message = '';

        // Field-specific validation
        switch (type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (value && !emailRegex.test(value)) {
                    isValid = false;
                    message = 'Please enter a valid email address';
                }
                break;
            case 'password':
                if (value && value.length < 8) {
                    isValid = false;
                    message = 'Password must be at least 8 characters long';
                }
                break;
            case 'url':
                try {
                    if (value) new URL(value);
                } catch {
                    isValid = false;
                    message = 'Please enter a valid URL';
                }
                break;
        }

        // Required field validation
        if (field.required && !value) {
            isValid = false;
            message = `${field.getAttribute('data-label') || 'This field'} is required`;
        }

        // Show validation result
        if (!isValid) {
            this.showFieldError(field, message);
        } else {
            this.clearFieldError(field);
        }

        return isValid;
    }

    showFieldError(field, message) {
        field.classList.add('field-error');

        // Remove existing error message
        const existingError = field.parentNode.querySelector('.field-error-message');
        if (existingError) existingError.remove();

        // Add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error-message text-sm text-danger-color';
        errorDiv.textContent = message;
        errorDiv.style.marginTop = '0.25rem';
        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(field) {
        field.classList.remove('field-error');
        const errorMessage = field.parentNode.querySelector('.field-error-message');
        if (errorMessage) errorMessage.remove();
    }

    setupButtonStates() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('button, .btn, input[type="submit"]')) {
                const button = e.target;

                // Add loading state for async operations
                if (button.hasAttribute('data-async')) {
                    this.setButtonLoading(button, true);

                    // Auto-clear loading state after 10 seconds (fallback)
                    setTimeout(() => {
                        this.setButtonLoading(button, false);
                    }, 10000);
                }
            }
        });
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('btn-loading');
            button.disabled = true;
            button.setAttribute('data-original-text', button.textContent);

            // Add spinner if not exists
            if (!button.querySelector('.loading-spinner')) {
                const spinner = document.createElement('span');
                spinner.className = 'loading-spinner';
                button.appendChild(spinner);
            }
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;

            // Restore original text
            const originalText = button.getAttribute('data-original-text');
            if (originalText) {
                button.textContent = originalText;
                button.removeAttribute('data-original-text');
            }

            // Remove spinner
            const spinner = button.querySelector('.loading-spinner');
            if (spinner) spinner.remove();
        }
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
            this.showUserFriendlyError('Something went wrong. Please refresh the page and try again.');
        });

        // Promise rejection handler
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showUserFriendlyError('A network error occurred. Please check your connection and try again.');
        });
    }

    showUserFriendlyError(message) {
        // Show user-friendly error notification
        if (this.addNotification) {
            this.addNotification('error', 'Error', message);
        } else {
            // Fallback notification
            this.showSimpleNotification(message, 'error');
        }
    }

    showSimpleNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--${type === 'error' ? 'danger' : 'primary'}-color);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            max-width: 350px;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    setupPerformanceMonitoring() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            setTimeout(() => {
                const perfData = performance.getEntriesByType('navigation')[0];
                if (perfData) {
                    const loadTime = perfData.loadEventEnd - perfData.loadEventStart;
                    console.log(`Page load time: ${loadTime}ms`);

                    // Warn if load time is too long
                    if (loadTime > 3000) {
                        console.warn('Slow page load detected');
                    }
                }
            }, 0);
        });

        // Monitor API response times
        this.monitorApiPerformance();
    }

    monitorApiPerformance() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const start = performance.now();
            try {
                const response = await originalFetch(...args);
                const end = performance.now();
                const duration = end - start;

                console.log(`API call to ${args[0]} took ${duration.toFixed(2)}ms`);

                // Show warning for slow API calls
                if (duration > 5000) {
                    this.showUserFriendlyError('The server is responding slowly. Please be patient.');
                }

                return response;
            } catch (error) {
                const end = performance.now();
                console.error(`API call to ${args[0]} failed after ${(end - start).toFixed(2)}ms:`, error);
                throw error;
            }
        };
    }

    setupKeyboardNavigation() {
        // Enhanced keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key to close modals
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    this.closeModal(openModal);
                }
            }

            // Ctrl/Cmd + S to save (prevent default browser save)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.saveData) {
                    this.saveData();
                    this.showSimpleNotification('Data saved successfully!', 'success');
                }
            }

            // Alt + T to toggle theme
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) themeToggle.click();
            }
        });

        // Improve tab navigation
        this.improveTabNavigation();
    }

    improveTabNavigation() {
        // Add visible focus indicators
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('using-keyboard');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('using-keyboard');
        });
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');

            // Return focus to trigger element if available
            const trigger = modal.getAttribute('data-trigger');
            if (trigger) {
                const triggerElement = document.getElementById(trigger);
                if (triggerElement) triggerElement.focus();
            }
        }
    }
}

// Initialize enhanced CSES manager when DOM is ready (works even if DOMContentLoaded already fired)
(function initCSESManager() {
    const start = () => setTimeout(() => { window.csesManager = new CSESManager(); }, 1000);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
