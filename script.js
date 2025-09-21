// CP Journey Progress Tracker with Database Integration
class CPJourney {
    constructor() {
        this.API_BASE = 'http://localhost:3001/api';
        this.data = {};
        this.isOnline = navigator.onLine;
        this.currentUser = null;
        this.authToken = localStorage.getItem('authToken');
        this.initializeApp();
    }

    async initializeApp() {
        // Initialize authentication first
        await this.initAuth();
        
        await this.loadData();
        this.initializeEventListeners();
        this.updateUI();
        this.startPeriodicUpdates();
        this.setupNetworkListeners();
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
    }

    // Enhanced Data Management with Database Integration
    async loadData() {
        const defaultData = {
            journeyStarted: false,
            startDate: null,
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
            }
        };

        try {
            // Try to load from database first
            const response = await fetch(`${this.API_BASE}/journey`);
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.data = { ...defaultData, ...result.data };
                    this.showNotification('📊 Data loaded from database', 'success');
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

    // Journey Management with Database Integration
    startJourney() {
        if (!this.data.journeyStarted) {
            this.data.journeyStarted = true;
            this.data.startDate = new Date().toISOString();
            this.saveData();
            this.updateUI();
            this.showNotification('🚀 Your CP journey has begun! Data saved to database!', 'success');
        }
    }

    resetJourney() {
        if (confirm('Are you sure you want to reset your entire journey? This action cannot be undone.')) {
            // Create backup before reset
            this.exportData('backup');
            
            localStorage.removeItem('cpJourneyData');
            this.data = this.getDefaultData();
            this.saveData();
            this.updateUI();
            this.showNotification('🔄 Journey reset successfully! Previous data backed up.', 'info');
        }
    }

    getDefaultData() {
        return {
            journeyStarted: false,
            startDate: null,
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
        return 'Phase 4: Codeforces Victory!';
    }

    // Progress Calculation
    getPhaseProgress() {
        const daysElapsed = this.getDaysElapsed();
        
        return {
            cses: Math.min(Math.max((daysElapsed / 60) * 100, 0), 100),
            revision: Math.min(Math.max(((daysElapsed - 60) / 30) * 100, 0), 100),
            usaco: Math.min(Math.max(((daysElapsed - 90) / 75) * 100, 0), 100),
            codeforces: daysElapsed > 165 ? 25 : 0 // Basic progress indicator
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
        document.getElementById('start-journey').addEventListener('click', () => this.startJourney());
        document.getElementById('reset-journey').addEventListener('click', () => this.resetJourney());

        // Database Operations
        if (document.getElementById('export-data')) {
            document.getElementById('export-data').addEventListener('click', () => this.exportData());
        }
        if (document.getElementById('import-data')) {
            document.getElementById('import-data').addEventListener('click', () => this.importData());
        }
        if (document.getElementById('create-backup')) {
            document.getElementById('create-backup').addEventListener('click', () => this.createBackup());
        }

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
        document.querySelector('.hamburger').addEventListener('click', () => {
            document.querySelector('.nav-menu').classList.toggle('active');
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
            journeyStatus.textContent = 'Your competitive programming journey is in progress!';
            journeyTimer.style.display = 'flex';
            
            daysElapsed.textContent = this.getDaysElapsed();
            currentPhase.textContent = this.getCurrentPhase();
        } else {
            startButton.style.display = 'inline-block';
            resetButton.style.display = 'none';
            journeyStatus.textContent = 'Ready to start your competitive programming journey?';
            journeyTimer.style.display = 'none';
        }
    }

    updateDashboard() {
        const progress = this.getPhaseProgress();
        
        // Update progress bars
        document.getElementById('cses-progress').style.width = `${progress.cses}%`;
        document.getElementById('revision-progress').style.width = `${progress.revision}%`;
        document.getElementById('usaco-progress').style.width = `${progress.usaco}%`;
        document.getElementById('cf-progress').style.width = `${progress.codeforces}%`;

        // Update progress text
        const daysElapsed = this.getDaysElapsed();
        document.getElementById('cses-progress-text').textContent = 
            `${Math.min(daysElapsed, 60)}/60 days`;
        document.getElementById('revision-progress-text').textContent = 
            `${Math.max(Math.min(daysElapsed - 60, 30), 0)}/30 days`;
        document.getElementById('usaco-progress-text').textContent = 
            `${Math.max(Math.min(daysElapsed - 90, 75), 0)}/75 days`;

        // Update problem counts
        const totalCSES = Object.values(this.data.cses).reduce((sum, cat) => sum + (cat.solved || 0), 0);
        document.getElementById('cses-solved').textContent = totalCSES;
        document.getElementById('revision-problems').textContent = this.data.revision.problems;
        
        const totalUSACO = Object.values(this.data.usaco).reduce((sum, count) => sum + count, 0);
        document.getElementById('usaco-solved').textContent = totalUSACO;
        document.getElementById('cf-rating').textContent = this.data.codeforces.rating;
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
        const username = document.getElementById('cses-username').value.trim();
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
        const username = document.getElementById('cf-username').value.trim();
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
        const username = document.getElementById('vjudge-username').value.trim();
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
        const usernames = {
            cses: document.getElementById('cses-username').value.trim(),
            codeforces: document.getElementById('cf-username').value.trim(),
            vjudge: document.getElementById('vjudge-username').value.trim()
        };

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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new CPJourney();
});

// Add some additional interactive features
document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add loading animation
    window.addEventListener('load', () => {
        document.body.classList.add('loaded');
    });

    // Add intersection observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);

    // Observe all sections
    document.querySelectorAll('.section').forEach(section => {
        observer.observe(section);
    });
});

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