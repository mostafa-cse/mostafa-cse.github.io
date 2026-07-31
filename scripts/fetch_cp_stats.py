import urllib.request
import json
import re
import os

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

def fetch_json(url, data=None):
    req = urllib.request.Request(url, data=data, headers=headers)
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching JSON from {url}: {e}")
        return None

def fetch_html(url):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read().decode()
    except Exception as e:
        print(f"Error fetching HTML from {url}: {e}")
        return None

def main():
    stats = {}

    # 1. Codeforces
    cf_res = fetch_json('https://codeforces.com/api/user.status?handle=m0stafa')
    if cf_res and cf_res.get('status') == 'OK':
        solved = set()
        for sub in cf_res.get('result', []):
            if sub.get('verdict') == 'OK':
                problem = sub.get('problem', {})
                name = problem.get('name')
                if name:
                    solved.add(name)
        stats['codeforces'] = len(solved)
    else:
        stats['codeforces'] = 0

    # 2. LeetCode
    lc_query = {
        "query": "query userProblemsSolved($username: String!) { matchedUser(username: $username) { submitStatsGlobal { acSubmissionNum { count } } } }",
        "variables": {"username": "m0stafa_kamal"}
    }
    lc_data = json.dumps(lc_query).encode('utf-8')
    lc_res = fetch_json('https://leetcode.com/graphql', data=lc_data)
    if lc_res and 'data' in lc_res and lc_res['data'].get('matchedUser'):
        try:
            stats['leetcode'] = lc_res['data']['matchedUser']['submitStatsGlobal']['acSubmissionNum'][0]['count']
        except Exception:
            stats['leetcode'] = 0
    else:
        stats['leetcode'] = 0

    # 3. AtCoder
    ac_res = fetch_json('https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=i_love_sabnaj')
    if ac_res and 'count' in ac_res:
        stats['atcoder'] = ac_res['count']
    else:
        stats['atcoder'] = 0

    # 4. CodeChef
    cc_res = fetch_html('https://www.codechef.com/users/mostafa_kamal')
    if cc_res:
        match = re.search(r'Fully Solved \((\d+)\)', cc_res)
        if match:
            stats['codechef'] = int(match.group(1))
        else:
            stats['codechef'] = 659 # Fallback
    else:
        stats['codechef'] = 659 # Fallback

    # 5. VJUDGE
    vj_res = fetch_html('https://vjudge.net/user/M00stafa')
    if vj_res:
        match = re.search(r'title="Overall solved".*?>(\d+)<', vj_res)
        if match:
            stats['vjudge'] = int(match.group(1))
        else:
            match2 = re.search(r'Overall solved.*?(\d+)', vj_res, re.IGNORECASE | re.DOTALL)
            if match2:
                stats['vjudge'] = int(match2.group(1))
            else:
                stats['vjudge'] = 400 # Fallback
    else:
        stats['vjudge'] = 400 # Fallback

    # 6. LightOJ
    loj_res = fetch_json('https://lightoj.com/api/v1/users/m0stafa_')
    if loj_res and 'data' in loj_res and 'userStat' in loj_res['data']:
        stats['lightoj'] = int(loj_res['data']['userStat'].get('isSolved', 141))
    else:
        stats['lightoj'] = 141 # Fallback

    total = sum(stats.values())
    stats['total'] = total

    print("Fetched stats:", stats)

    # Make sure data directory exists
    os.makedirs('data', exist_ok=True)
    with open('data/cp_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

if __name__ == '__main__':
    main()
