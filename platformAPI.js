const axios = require('axios');
const cheerio = require('cheerio');

class PlatformAPI {
    constructor() {
        this.csesBaseUrl = 'https://cses.fi';
        this.codeforcesBaseUrl = 'https://codeforces.com/api';
        this.vjudgeBaseUrl = 'https://vjudge.net/user';
    }

    // CSES Topics Scraper (Problem Set Categories)
    async fetchCSESTopics() {
        const url = `${this.csesBaseUrl}/problemset/`;
        try {
            const resp = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });

            const $ = cheerio.load(resp.data);
            const topics = [];

            // Heuristic parsing: categories often marked by h2, followed by a table of problems
            $('h2').each((i, el) => {
                const title = $(el).text().trim();
                if (!title) return;

                // Count problems under the next table or list until next h2
                let count = 0;
                let $cursor = $(el).next();
                while ($cursor.length && $cursor[0].tagName !== 'h2') {
                    // Count table rows or list items that look like problems
                    count += $cursor.find('tr').length;
                    count += $cursor.find('li').length;
                    // Fallback: look for links with task path
                    count += $cursor.find('a[href*="/task/"]').length;
                    $cursor = $cursor.next();
                }

                const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                topics.push({
                    title,
                    slug,
                    count: count || null,
                    url: `${url}#${slug}`
                });
            });

            // Filter out non-topic headers if any (keep those with reasonable titles)
            const filtered = topics.filter(t => /[a-z]/i.test(t.title) && t.title.length < 60);

            // If parsing failed or empty, provide a sensible fallback list
            if (!filtered.length) {
                return {
                    success: true,
                    fromCache: true,
                    topics: [
                        { title: 'Introductory Problems', slug: 'introductory-problems', count: 19, url },
                        { title: 'Sorting and Searching', slug: 'sorting-and-searching', count: 35, url },
                        { title: 'Dynamic Programming', slug: 'dynamic-programming', count: 19, url },
                        { title: 'Graph Algorithms', slug: 'graph-algorithms', count: 36, url },
                        { title: 'Range Queries', slug: 'range-queries', count: 19, url },
                        { title: 'Tree Algorithms', slug: 'tree-algorithms', count: 16, url },
                        { title: 'Mathematics', slug: 'mathematics', count: null, url },
                        { title: 'String Algorithms', slug: 'string-algorithms', count: null, url },
                        { title: 'Geometry', slug: 'geometry', count: null, url },
                        { title: 'Advanced Techniques', slug: 'advanced-techniques', count: null, url },
                        { title: 'Additional Problems', slug: 'additional-problems', count: null, url }
                    ]
                };
            }

            return { success: true, topics: filtered };
        } catch (error) {
            console.error('CSES topics fetch error:', error.message);
            // Return fallback on error
            return {
                success: true,
                fromCache: true,
                topics: [
                    { title: 'Introductory Problems', slug: 'introductory-problems', count: 19, url },
                    { title: 'Sorting and Searching', slug: 'sorting-and-searching', count: 35, url },
                    { title: 'Dynamic Programming', slug: 'dynamic-programming', count: 19, url },
                    { title: 'Graph Algorithms', slug: 'graph-algorithms', count: 36, url },
                    { title: 'Range Queries', slug: 'range-queries', count: 19, url },
                    { title: 'Tree Algorithms', slug: 'tree-algorithms', count: 16, url },
                    { title: 'Mathematics', slug: 'mathematics', count: null, url },
                    { title: 'String Algorithms', slug: 'string-algorithms', count: null, url },
                    { title: 'Geometry', slug: 'geometry', count: null, url },
                    { title: 'Advanced Techniques', slug: 'advanced-techniques', count: null, url },
                    { title: 'Additional Problems', slug: 'additional-problems', count: null, url }
                ]
            };
        }
    }

    // CSES Account Integration
    async fetchCSESProgress(username) {
        try {
            console.log(`Fetching CSES progress for ${username}...`);
            
            // CSES doesn't have a public API, so we'll use web scraping
            const userUrl = `${this.csesBaseUrl}/user/${username}`;
            const response = await axios.get(userUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const solvedProblems = [];
            
            // Parse solved problems from the user profile
            $('.task-score.full').each((index, element) => {
                const taskElement = $(element).closest('tr');
                const taskName = taskElement.find('.task-name a').text().trim();
                const taskId = taskElement.find('.task-name a').attr('href');
                
                if (taskName && taskId) {
                    solvedProblems.push({
                        name: taskName,
                        id: taskId.split('/').pop(),
                        solved: true
                    });
                }
            });

            // Categorize problems
            const categories = {
                intro: { solved: 0, total: 19, problems: [] },
                sort: { solved: 0, total: 35, problems: [] },
                dp: { solved: 0, total: 19, problems: [] },
                graph: { solved: 0, total: 36, problems: [] },
                range: { solved: 0, total: 19, problems: [] },
                tree: { solved: 0, total: 16, problems: [] }
            };

            // Categorize solved problems (this would need a mapping of problem IDs to categories)
            const problemCategories = this.getCSESCategories();
            
            solvedProblems.forEach(problem => {
                const category = this.categorizeCSESProblem(problem.id, problemCategories);
                if (category && categories[category]) {
                    categories[category].solved++;
                    categories[category].problems.push(problem);
                }
            });

            return {
                success: true,
                totalSolved: solvedProblems.length,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error('CSES fetch error:', error.message);
            return {
                success: false,
                error: error.message,
                totalSolved: 0
            };
        }
    }

    // Codeforces API Integration
    async fetchCodeforcesProgress(username) {
        try {
            console.log(`Fetching Codeforces progress for ${username}...`);

            // Fetch user info
            const userInfoUrl = `${this.codeforcesBaseUrl}/user.info?handles=${username}`;
            const userResponse = await axios.get(userInfoUrl, { timeout: 10000 });
            
            if (userResponse.data.status !== 'OK') {
                throw new Error('User not found on Codeforces');
            }

            const userInfo = userResponse.data.result[0];
            const rating = userInfo.rating || 'Unrated';
            const maxRating = userInfo.maxRating || rating;

            // Fetch user submissions
            const submissionsUrl = `${this.codeforcesBaseUrl}/user.status?handle=${username}&from=1&count=10000`;
            const submissionsResponse = await axios.get(submissionsUrl, { timeout: 15000 });

            if (submissionsResponse.data.status !== 'OK') {
                throw new Error('Failed to fetch submissions');
            }

            const submissions = submissionsResponse.data.result;
            
            // Count unique solved problems
            const solvedProblems = new Set();
            const dailySolves = {};

            submissions.forEach(submission => {
                if (submission.verdict === 'OK') {
                    const problemKey = `${submission.problem.contestId}${submission.problem.index}`;
                    solvedProblems.add(problemKey);
                    
                    // Track daily solves
                    const solveDate = new Date(submission.creationTimeSeconds * 1000).toDateString();
                    if (!dailySolves[solveDate]) {
                        dailySolves[solveDate] = [];
                    }
                    
                    if (!dailySolves[solveDate].find(p => p.key === problemKey)) {
                        dailySolves[solveDate].push({
                            key: problemKey,
                            name: submission.problem.name,
                            rating: submission.problem.rating || 'Unrated'
                        });
                    }
                }
            });

            // Count contests participated
            const contests = new Set();
            submissions.forEach(submission => {
                if (submission.author.participantType === 'CONTESTANT') {
                    contests.add(submission.contestId);
                }
            });

            return {
                success: true,
                username: username,
                rating: rating,
                maxRating: maxRating,
                problemsSolved: solvedProblems.size,
                contests: contests.size,
                dailySolves: dailySolves,
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error('Codeforces fetch error:', error.message);
            return {
                success: false,
                error: error.message,
                rating: 'Error',
                problemsSolved: 0,
                contests: 0
            };
        }
    }

    // VJudge Integration
    async fetchVJudgeProgress(username) {
        try {
            console.log(`Fetching VJudge progress for ${username}...`);

            // VJudge user statistics
            const userUrl = `${this.vjudgeBaseUrl}/${username}`;
            const response = await axios.get(userUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            
            // Parse solve statistics
            const solvedCount = parseInt($('#solved').text().trim()) || 0;
            const submittedCount = parseInt($('#submitted').text().trim()) || 0;
            
            // Parse daily activity (last 30 days)
            const dailyActivity = {};
            $('.activity-cell').each((index, element) => {
                const count = parseInt($(element).text().trim()) || 0;
                if (count > 0) {
                    const date = $(element).attr('data-date');
                    if (date) {
                        dailyActivity[date] = count;
                    }
                }
            });

            // Fetch recent submissions for more detailed daily tracking
            const submissionsUrl = `${this.vjudgeBaseUrl}/${username}/submissions`;
            const submissionsResponse = await axios.get(submissionsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            const $subs = cheerio.load(submissionsResponse.data);
            const recentSolves = {};

            $subs('tr.submission-row').each((index, row) => {
                const status = $subs(row).find('.status').text().trim();
                if (status === 'Accepted') {
                    const problem = $subs(row).find('.problem-title').text().trim();
                    const timeStr = $subs(row).find('.timestamp').text().trim();
                    const date = new Date(timeStr).toDateString();
                    
                    if (!recentSolves[date]) {
                        recentSolves[date] = [];
                    }
                    
                    recentSolves[date].push({
                        problem: problem,
                        timestamp: timeStr
                    });
                }
            });

            return {
                success: true,
                username: username,
                totalSolved: solvedCount,
                totalSubmitted: submittedCount,
                dailyActivity: dailyActivity,
                recentSolves: recentSolves,
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error('VJudge fetch error:', error.message);
            return {
                success: false,
                error: error.message,
                totalSolved: 0
            };
        }
    }

    // Combined sync function
    async syncAllPlatforms(usernames) {
        console.log('Starting sync for all platforms...');
        
        const results = {
            cses: null,
            codeforces: null,
            vjudge: null,
            syncTime: new Date().toISOString()
        };

        // Fetch from all platforms concurrently
        const promises = [];
        
        if (usernames.cses) {
            promises.push(
                this.fetchCSESProgress(usernames.cses)
                    .then(result => results.cses = result)
            );
        }
        
        if (usernames.codeforces) {
            promises.push(
                this.fetchCodeforcesProgress(usernames.codeforces)
                    .then(result => results.codeforces = result)
            );
        }
        
        if (usernames.vjudge) {
            promises.push(
                this.fetchVJudgeProgress(usernames.vjudge)
                    .then(result => results.vjudge = result)
            );
        }

        await Promise.allSettled(promises);
        
        console.log('Sync completed for all platforms');
        return results;
    }

    // Helper functions
    getCSESCategories() {
        return {
            intro: [1068, 1083, 1069, 1094, 1070, 1071, 1072, 1617, 2165, 1618, 1754, 1755, 1624, 1092, 1622, 1623, 1073, 1619, 2431],
            sort: [1621, 1084, 1090, 1091, 1619, 1629, 1640, 1643, 1074, 1621, 1629, 1640, 1643, 2162, 2183, 2168, 1642, 1645, 1074, 1141, 1076, 1630, 1631, 1641, 1662, 1085, 1097, 1645, 1620, 2216, 2217, 2428, 1632, 1628, 1642],
            dp: [1633, 1634, 1635, 1636, 1637, 1638, 1158, 1746, 2413, 1639, 2181, 2220, 1653, 2442, 1097, 2181, 2220, 1644, 1097],
            graph: [1666, 1667, 1668, 1669, 1670, 1671, 1672, 1673, 1674, 1675, 1676, 1677, 1678, 1679, 1680, 1681, 1682, 1683, 1684, 1685, 1686, 1687, 1688, 1689, 1690, 1691, 1692, 1693, 1694, 1695, 1696, 1697, 1698, 1699, 1700, 1701],
            range: [1646, 1647, 1648, 1649, 1650, 1651, 1652, 1143, 1749, 2166, 2206, 2401, 2416, 1734, 1749, 1190, 2416, 2206, 2401],
            tree: [1674, 1130, 1131, 1132, 1133, 1134, 1135, 1136, 1137, 1138, 1139, 1702, 2079, 1703, 2134, 1704]
        };
    }

    categorizeCSESProblem(problemId, categories) {
        const id = parseInt(problemId);
        for (const [category, ids] of Object.entries(categories)) {
            if (ids.includes(id)) {
                return category;
            }
        }
        return null;
    }
}

module.exports = PlatformAPI;