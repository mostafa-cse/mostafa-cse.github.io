const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');

class AuthManager {
    constructor(dataDir) {
        this.usersFile = path.join(dataDir, 'users.json');
        this.JWT_SECRET = process.env.JWT_SECRET || 'cp-journey-secret-key-2025';
        this.sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
    }

    async initializeUsers() {
        if (!await fs.pathExists(this.usersFile)) {
            const defaultUsers = {
                users: [],
                lastUpdated: new Date().toISOString()
            };
            await fs.writeJson(this.usersFile, defaultUsers, { spaces: 2 });
        }
    }

    async readUsers() {
        try {
            return await fs.readJson(this.usersFile);
        } catch (error) {
            return { users: [] };
        }
    }

    async writeUsers(data) {
        try {
            data.lastUpdated = new Date().toISOString();
            await fs.writeJson(this.usersFile, data, { spaces: 2 });
            return true;
        } catch (error) {
            console.error('Error writing users:', error);
            return false;
        }
    }

    async registerUser(userData) {
        try {
            const { username, email, password, platformCredentials } = userData;
            
            // Validate required fields
            if (!username || !email || !password) {
                return { success: false, error: 'Missing required fields' };
            }

            const usersData = await this.readUsers();
            
            // Check if user already exists
            const existingUser = usersData.users.find(u => 
                u.username === username || u.email === email
            );
            
            if (existingUser) {
                return { success: false, error: 'User already exists' };
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new user
            const newUser = {
                id: Date.now().toString(),
                username,
                email,
                password: hashedPassword,
                platformCredentials: {
                    cses: platformCredentials?.cses || '',
                    codeforces: platformCredentials?.codeforces || '',
                    vjudge: platformCredentials?.vjudge || ''
                },
                preferences: {
                    autoSync: false,
                    syncTime: '06:00',
                    notifications: true
                },
                createdAt: new Date().toISOString(),
                lastLogin: null,
                isActive: true
            };

            usersData.users.push(newUser);
            const saved = await this.writeUsers(usersData);

            if (saved) {
                // Generate token
                const token = this.generateToken(newUser);
                
                return {
                    success: true,
                    message: 'User registered successfully',
                    user: this.sanitizeUser(newUser),
                    token
                };
            } else {
                return { success: false, error: 'Failed to save user' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async loginUser(credentials) {
        try {
            const { identifier, password } = credentials; // identifier can be username or email
            
            if (!identifier || !password) {
                return { success: false, error: 'Missing credentials' };
            }

            const usersData = await this.readUsers();
            
            // Find user by username or email
            const user = usersData.users.find(u => 
                u.username === identifier || u.email === identifier
            );

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            if (!user.isActive) {
                return { success: false, error: 'Account is deactivated' };
            }

            // Verify password
            const passwordValid = await bcrypt.compare(password, user.password);
            
            if (!passwordValid) {
                return { success: false, error: 'Invalid password' };
            }

            // Update last login
            user.lastLogin = new Date().toISOString();
            await this.writeUsers(usersData);

            // Generate token
            const token = this.generateToken(user);

            return {
                success: true,
                message: 'Login successful',
                user: this.sanitizeUser(user),
                token,
                platformCredentials: user.platformCredentials
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updatePlatformCredentials(userId, platformCredentials) {
        try {
            const usersData = await this.readUsers();
            const user = usersData.users.find(u => u.id === userId);

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            user.platformCredentials = {
                ...user.platformCredentials,
                ...platformCredentials
            };

            const saved = await this.writeUsers(usersData);

            return {
                success: saved,
                message: saved ? 'Platform credentials updated' : 'Failed to update credentials',
                platformCredentials: user.platformCredentials
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateUserPreferences(userId, preferences) {
        try {
            const usersData = await this.readUsers();
            const user = usersData.users.find(u => u.id === userId);

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            user.preferences = {
                ...user.preferences,
                ...preferences
            };

            const saved = await this.writeUsers(usersData);

            return {
                success: saved,
                message: saved ? 'Preferences updated' : 'Failed to update preferences',
                preferences: user.preferences
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    generateToken(user) {
        return jwt.sign(
            { 
                id: user.id, 
                username: user.username,
                email: user.email 
            },
            this.JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    sanitizeUser(user) {
        const { password, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    // Middleware for protected routes
    requireAuth = async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ success: false, error: 'No token provided' });
            }

            const decoded = this.verifyToken(token);
            
            if (!decoded) {
                return res.status(401).json({ success: false, error: 'Invalid token' });
            }

            // Get current user data
            const usersData = await this.readUsers();
            const user = usersData.users.find(u => u.id === decoded.id);

            if (!user || !user.isActive) {
                return res.status(401).json({ success: false, error: 'User not found or inactive' });
            }

            req.user = this.sanitizeUser(user);
            next();
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async getUserById(id) {
        try {
            const usersData = await this.readUsers();
            const user = usersData.users.find(u => u.id === id);
            return user ? this.sanitizeUser(user) : null;
        } catch (error) {
            return null;
        }
    }
}

module.exports = AuthManager;