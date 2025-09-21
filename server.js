const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const session = require('express-session');
const compression = require('compression');
const PlatformAPI = require('./platformAPI');
const AuthManager = require('./authManager');

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Initialize Platform API and Auth Manager
const platformAPI = new PlatformAPI();
const authManager = new AuthManager(DATA_DIR);

// Performance optimizations - compression first
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// Cache control for static assets
app.use('/styles.css', (req, res, next) => {
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
    next();
});
app.use('/script.js', (req, res, next) => {
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
    next();
});

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.static('.', {
    maxAge: '1d', // Cache static files for 1 day
    setHeaders: (res, path) => {
        if (path.endsWith('.css') || path.endsWith('.js')) {
            res.set('Cache-Control', 'public, max-age=86400');
        }
    }
}));
app.use(session({
    secret: 'cp-journey-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Ensure directories exist
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(BACKUP_DIR);

// Database file paths
const DB_FILE = path.join(DATA_DIR, 'journey.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Initialize database files if they don't exist
const initializeDatabase = async () => {
    try {
        // Initialize auth system
        await authManager.initializeUsers();

        // Initialize main journey data
        if (!await fs.pathExists(DB_FILE)) {
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
                },
                lastUpdated: new Date().toISOString(),
                version: '1.0.0'
            };
            await fs.writeJson(DB_FILE, defaultData, { spaces: 2 });
        }

        console.log('✅ Database and authentication initialized successfully!');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
    }
};

// Database operations
const readDatabase = async () => {
    try {
        return await fs.readJson(DB_FILE);
    } catch (error) {
        console.error('Error reading database:', error);
        return null;
    }
};

const writeDatabase = async (data) => {
    try {
        data.lastUpdated = new Date().toISOString();
        await fs.writeJson(DB_FILE, data, { spaces: 2 });
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
};

const createBackup = async () => {
    try {
        const data = await readDatabase();
        if (data) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
            await fs.writeJson(backupFile, data, { spaces: 2 });
            console.log(`📦 Backup created: ${backupFile}`);
            return backupFile;
        }
    } catch (error) {
        console.error('Error creating backup:', error);
    }
    return null;
};

// Helper function to get default journey data
async function getDefaultJourneyData() {
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
            rating: 0,
            maxRating: 0,
            problems: 0,
            contests: 0
        },
        totalProblems: 0,
        platforms: {}
    };
}

// API Routes

// Authentication Endpoints
app.post('/api/auth/register', async (req, res) => {
    try {
        const result = await authManager.registerUser(req.body);
        if (result.success) {
            // Auto-sync platform credentials after registration
            if (result.user.platformCredentials) {
                const usernames = {
                    cses: result.user.platformCredentials.cses,
                    codeforces: result.user.platformCredentials.codeforces,
                    vjudge: result.user.platformCredentials.vjudge
                };

                // Trigger initial sync in background
                setTimeout(async () => {
                    try {
                        await platformAPI.syncAllPlatforms(usernames);
                        console.log(`✅ Initial sync completed for user: ${result.user.username}`);
                    } catch (error) {
                        console.log(`⚠️ Initial sync failed for user: ${result.user.username}`);
                    }
                }, 5000); // 5 second delay
            }
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Map frontend fields to backend expected format
        const credentials = { identifier: username, password };
        const result = await authManager.loginUser(credentials);
        if (result.success) {
            // Set session
            req.session.userId = result.user.id;
            req.session.username = result.user.username;

            // Load user's journey data
            const userJourneyFile = path.join(DATA_DIR, `journey_${result.user.id}.json`);
            let journeyData = null;

            if (await fs.pathExists(userJourneyFile)) {
                journeyData = await fs.readJson(userJourneyFile);
            }

            // Auto-sync platform data on login
            if (result.platformCredentials) {
                const usernames = {
                    cses: result.platformCredentials.cses,
                    codeforces: result.platformCredentials.codeforces,
                    vjudge: result.platformCredentials.vjudge
                };

                // Trigger sync in background
                setTimeout(async () => {
                    try {
                        const syncResults = await platformAPI.syncAllPlatforms(usernames);

                        // Update user's journey data with sync results
                        let userJourney = journeyData || await this.getDefaultJourneyData();

                        // Update with sync results
                        if (syncResults.cses && syncResults.cses.success) {
                            userJourney.cses = syncResults.cses.categories;
                        }
                        if (syncResults.codeforces && syncResults.codeforces.success) {
                            userJourney.codeforces = {
                                rating: syncResults.codeforces.rating,
                                problemsSolved: syncResults.codeforces.problemsSolved,
                                contests: syncResults.codeforces.contests
                            };
                        }

                        userJourney.platforms = {
                            cses: syncResults.cses,
                            codeforces: syncResults.codeforces,
                            vjudge: syncResults.vjudge
                        };
                        userJourney.lastAutoSync = new Date().toISOString();

                        // Save updated journey data
                        await fs.writeJson(userJourneyFile, userJourney, { spaces: 2 });

                        console.log(`✅ Login sync completed for user: ${result.user.username}`);
                    } catch (error) {
                        console.log(`⚠️ Login sync failed for user: ${result.user.username}`, error.message);
                    }
                }, 2000); // 2 second delay
            }
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Failed to logout' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

app.get('/api/auth/me', authManager.requireAuth, async (req, res) => {
    try {
        const user = await authManager.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            user: user,
            platformCredentials: user.platformCredentials
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/auth/platform-credentials', authManager.requireAuth, async (req, res) => {
    try {
        const result = await authManager.updatePlatformCredentials(req.user.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/auth/preferences', authManager.requireAuth, async (req, res) => {
    try {
        const result = await authManager.updateUserPreferences(req.user.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current journey data (user-specific or global)
app.get('/api/journey', async (req, res) => {
    try {
        let data;

        // Check if user is authenticated
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = authManager.verifyToken(token);
            if (decoded) {
                // Load user-specific journey data
                const userJourneyFile = path.join(DATA_DIR, `journey_${decoded.id}.json`);
                if (await fs.pathExists(userJourneyFile)) {
                    data = await fs.readJson(userJourneyFile);
                } else {
                    // Create default journey for user
                    data = await getDefaultJourneyData();
                    await fs.writeJson(userJourneyFile, data, { spaces: 2 });
                }
            }
        }

        // Fallback to global journey data
        if (!data) {
            data = await readDatabase();
        }

        if (data) {
            res.json({ success: true, data });
        } else {
            res.status(500).json({ success: false, error: 'Failed to read data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CSES Topics route
app.get('/api/cses/topics', async (req, res) => {
    try {
        const topics = await platformAPI.fetchCSESTopics();
        res.json(topics);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Update journey data
app.post('/api/journey', async (req, res) => {
    try {
        const newData = req.body;
        const success = await writeDatabase(newData);

        if (success) {
            res.json({ success: true, message: 'Data saved successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to save data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create backup
app.post('/api/backup', async (req, res) => {
    try {
        const backupFile = await createBackup();
        if (backupFile) {
            res.json({
                success: true,
                message: 'Backup created successfully',
                backupFile: path.basename(backupFile)
            });
        } else {
            res.status(500).json({ success: false, error: 'Failed to create backup' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get list of backups
app.get('/api/backups', async (req, res) => {
    try {
        const files = await fs.readdir(BACKUP_DIR);
        const backups = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({ success: true, backups });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Download backup file
app.get('/api/backup/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(BACKUP_DIR, filename);

        if (await fs.pathExists(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).json({ success: false, error: 'Backup file not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export current data
app.get('/api/export', async (req, res) => {
    try {
        const data = await readDatabase();
        if (data) {
            const filename = `cp_journey_export_${new Date().toISOString().split('T')[0]}.json`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(data, null, 2));
        } else {
            res.status(500).json({ success: false, error: 'Failed to export data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Import data from file
app.post('/api/import', async (req, res) => {
    try {
        const importData = req.body;

        // Validate imported data structure
        if (!importData || typeof importData !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid import data format' });
        }

        // Create backup before importing
        await createBackup();

        // Import the new data
        const success = await writeDatabase(importData);

        if (success) {
            res.json({
                success: true,
                message: 'Data imported successfully. Previous data backed up.'
            });
        } else {
            res.status(500).json({ success: false, error: 'Failed to import data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'CP Journey Database Server is running!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Platform Integration Endpoints

// Sync from CSES
app.post('/api/sync/cses', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is required' });
        }

        const csesData = await platformAPI.fetchCSESProgress(username);

        if (csesData.success) {
            // Update journey data with CSES results
            const journeyData = await readDatabase();
            if (journeyData) {
                journeyData.cses = csesData.categories;
                journeyData.platforms = journeyData.platforms || {};
                journeyData.platforms.cses = {
                    username: username,
                    lastSync: csesData.lastUpdated,
                    totalSolved: csesData.totalSolved
                };

                await writeDatabase(journeyData);
            }
        }

        res.json(csesData);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Sync from Codeforces
app.post('/api/sync/codeforces', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is required' });
        }

        const cfData = await platformAPI.fetchCodeforcesProgress(username);

        if (cfData.success) {
            // Update journey data with Codeforces results
            const journeyData = await readDatabase();
            if (journeyData) {
                journeyData.codeforces.rating = cfData.rating;
                journeyData.codeforces.problemsSolved = cfData.problemsSolved;
                journeyData.codeforces.contests = cfData.contests;

                journeyData.platforms = journeyData.platforms || {};
                journeyData.platforms.codeforces = {
                    username: username,
                    lastSync: cfData.lastUpdated,
                    maxRating: cfData.maxRating,
                    dailySolves: cfData.dailySolves
                };

                await writeDatabase(journeyData);
            }
        }

        res.json(cfData);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Sync from VJudge
app.post('/api/sync/vjudge', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is required' });
        }

        const vjData = await platformAPI.fetchVJudgeProgress(username);

        if (vjData.success) {
            // Update journey data with VJudge results
            const journeyData = await readDatabase();
            if (journeyData) {
                journeyData.platforms = journeyData.platforms || {};
                journeyData.platforms.vjudge = {
                    username: username,
                    lastSync: vjData.lastUpdated,
                    totalSolved: vjData.totalSolved,
                    totalSubmitted: vjData.totalSubmitted,
                    dailyActivity: vjData.dailyActivity,
                    recentSolves: vjData.recentSolves
                };

                // Update daily streaks based on VJudge activity
                const today = new Date().toDateString();
                if (vjData.dailyActivity && vjData.dailyActivity[today] > 0) {
                    journeyData.lastActiveDate = today;
                }

                await writeDatabase(journeyData);
            }
        }

        res.json(vjData);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Sync from all platforms
app.post('/api/sync/all', async (req, res) => {
    try {
        const { usernames } = req.body;
        if (!usernames || typeof usernames !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Usernames object is required with cses, codeforces, and/or vjudge properties'
            });
        }

        const syncResults = await platformAPI.syncAllPlatforms(usernames);

        // Update journey data with all results
        const journeyData = await readDatabase();
        if (journeyData) {
            // Update CSES data
            if (syncResults.cses && syncResults.cses.success) {
                journeyData.cses = syncResults.cses.categories;
            }

            // Update Codeforces data
            if (syncResults.codeforces && syncResults.codeforces.success) {
                journeyData.codeforces.rating = syncResults.codeforces.rating;
                journeyData.codeforces.problemsSolved = syncResults.codeforces.problemsSolved;
                journeyData.codeforces.contests = syncResults.codeforces.contests;
            }

            // Store platform-specific data
            journeyData.platforms = journeyData.platforms || {};

            if (syncResults.cses) {
                journeyData.platforms.cses = {
                    username: usernames.cses,
                    lastSync: syncResults.cses.lastUpdated,
                    success: syncResults.cses.success,
                    error: syncResults.cses.error || null
                };
            }

            if (syncResults.codeforces) {
                journeyData.platforms.codeforces = {
                    username: usernames.codeforces,
                    lastSync: syncResults.codeforces.lastUpdated,
                    success: syncResults.codeforces.success,
                    error: syncResults.codeforces.error || null,
                    maxRating: syncResults.codeforces.maxRating,
                    dailySolves: syncResults.codeforces.dailySolves
                };
            }

            if (syncResults.vjudge) {
                journeyData.platforms.vjudge = {
                    username: usernames.vjudge,
                    lastSync: syncResults.vjudge.lastUpdated,
                    success: syncResults.vjudge.success,
                    error: syncResults.vjudge.error || null,
                    totalSolved: syncResults.vjudge.totalSolved,
                    dailyActivity: syncResults.vjudge.dailyActivity
                };
            }

            journeyData.lastAutoSync = syncResults.syncTime;
            await writeDatabase(journeyData);
        }

        res.json({
            success: true,
            message: 'Multi-platform sync completed',
            results: syncResults,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get platform sync status
app.get('/api/sync/status', async (req, res) => {
    try {
        const journeyData = await readDatabase();
        const platforms = journeyData?.platforms || {};

        const status = {
            lastAutoSync: journeyData?.lastAutoSync || null,
            platforms: {
                cses: {
                    configured: !!platforms.cses?.username,
                    username: platforms.cses?.username || null,
                    lastSync: platforms.cses?.lastSync || null,
                    success: platforms.cses?.success || false,
                    error: platforms.cses?.error || null
                },
                codeforces: {
                    configured: !!platforms.codeforces?.username,
                    username: platforms.codeforces?.username || null,
                    lastSync: platforms.codeforces?.lastSync || null,
                    success: platforms.codeforces?.success || false,
                    error: platforms.codeforces?.error || null,
                    currentRating: journeyData?.codeforces?.rating || 'Unrated'
                },
                vjudge: {
                    configured: !!platforms.vjudge?.username,
                    username: platforms.vjudge?.username || null,
                    lastSync: platforms.vjudge?.lastSync || null,
                    success: platforms.vjudge?.success || false,
                    error: platforms.vjudge?.error || null,
                    totalSolved: platforms.vjudge?.totalSolved || 0
                }
            }
        };

        res.json({ success: true, status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve the main website
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Auto-backup every 30 minutes
setInterval(async () => {
    await createBackup();
    console.log('🔄 Automatic backup completed');
}, 30 * 60 * 1000);

// Auto-sync functionality (runs daily at 6 AM if enabled)
const checkAndRunAutoSync = async () => {
    try {
        const journeyData = await readDatabase();
        const autoSyncEnabled = journeyData?.autoSyncEnabled || false;
        const platforms = journeyData?.platforms || {};

        if (autoSyncEnabled) {
            const usernames = {
                cses: platforms.cses?.username,
                codeforces: platforms.codeforces?.username,
                vjudge: platforms.vjudge?.username
            };

            if (usernames.cses || usernames.codeforces || usernames.vjudge) {
                console.log('🔄 Starting scheduled auto-sync...');
                const syncResults = await platformAPI.syncAllPlatforms(usernames);

                // Update journey data with sync results
                if (syncResults) {
                    journeyData.lastAutoSync = syncResults.syncTime;
                    await writeDatabase(journeyData);
                    console.log('✅ Auto-sync completed successfully');
                }
            }
        }
    } catch (error) {
        console.error('❌ Auto-sync failed:', error.message);
    }
};

// Schedule auto-sync to run daily at 6 AM
const scheduleAutoSync = () => {
    const now = new Date();
    const sixAM = new Date();
    sixAM.setHours(6, 0, 0, 0);

    // If it's past 6 AM today, schedule for tomorrow
    if (now > sixAM) {
        sixAM.setDate(sixAM.getDate() + 1);
    }

    const timeUntilSixAM = sixAM.getTime() - now.getTime();

    setTimeout(() => {
        checkAndRunAutoSync();
        // Then run every 24 hours
        setInterval(checkAndRunAutoSync, 24 * 60 * 60 * 1000);
    }, timeUntilSixAM);

    console.log(`⏰ Auto-sync scheduled for ${sixAM.toLocaleString()}`);
};

// Auto-sync toggle endpoint
app.post('/api/auto-sync/toggle', async (req, res) => {
    try {
        const { enabled } = req.body;
        const journeyData = await readDatabase();

        if (journeyData) {
            journeyData.autoSyncEnabled = enabled;
            await writeDatabase(journeyData);

            res.json({
                success: true,
                message: `Auto-sync ${enabled ? 'enabled' : 'disabled'}`,
                autoSyncEnabled: enabled
            });
        } else {
            res.status(500).json({ success: false, error: 'Failed to update settings' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
const startServer = async () => {
    await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`🚀 CP Journey Database Server running on http://localhost:${PORT}`);
        console.log(`📊 Dashboard available at http://localhost:${PORT}`);
        console.log(`💾 Database files stored in: ${DATA_DIR}`);
        console.log(`📦 Backups stored in: ${BACKUP_DIR}`);
        console.log(`🔄 Auto-backup every 30 minutes`);
        console.log(`🌐 Platform sync APIs enabled`);

        // Start auto-sync scheduler
        scheduleAutoSync();
    });
};

startServer().catch(console.error);

module.exports = app;
