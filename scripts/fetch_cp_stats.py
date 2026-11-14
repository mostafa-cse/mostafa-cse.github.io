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

    existing_stats = {}
    if os.path.exists('data/cp_stats.json'):
        try:
            with open('data/cp_stats.json', 'r') as f:
                existing_stats = json.load(f)
        except Exception:
            pass

    # 1. Codeforces (Main ID + Second ID deduped)
    cf_solved = set()
    for handle in ['m0stafa', '...-_-...']:
        cf_res = fetch_json(f'https://codeforces.com/api/user.status?handle={handle}')
        if cf_res and cf_res.get('status') == 'OK':
            for sub in cf_res.get('result', []):
                if sub.get('verdict') == 'OK':
                    problem = sub.get('problem', {})
                    name = problem.get('name')
                    if name:
                        cf_solved.add(name)
    stats['codeforces'] = max(len(cf_solved), existing_stats.get('codeforces', 2754))

    # 2. LeetCode
    lc_query = {
        "query": "query userProblemsSolved($username: String!) { matchedUser(username: $username) { submitStatsGlobal { acSubmissionNum { count } } } }",
        "variables": {"username": "m0stafa_kamal"}
    }
    lc_data = json.dumps(lc_query).encode('utf-8')
    lc_res = fetch_json('https://leetcode.com/graphql', data=lc_data)
    lc_solved = 0
    if lc_res and 'data' in lc_res and lc_res['data'].get('matchedUser'):
        try:
            lc_solved = int(lc_res['data']['matchedUser']['submitStatsGlobal']['acSubmissionNum'][0]['count'])
        except Exception:
            lc_solved = 0
    stats['leetcode'] = max(lc_solved, existing_stats.get('leetcode', 314))

    # 3. AtCoder
    ac_res = fetch_json('https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=mostafa___')
    ac_solved = 0
    if ac_res and 'count' in ac_res:
        ac_solved = int(ac_res['count'])
    stats['atcoder'] = max(ac_solved, existing_stats.get('atcoder', 250))

    # 4. CodeChef
    cc_res = fetch_html('https://www.codechef.com/users/mostafa_kamal')
    cc_solved = 0
    if cc_res:
        match = re.search(r'Fully Solved \((\d+)\)', cc_res)
        if match:
            cc_solved = int(match.group(1))
    stats['codechef'] = max(cc_solved, existing_stats.get('codechef', 682))

    # 5. VJUDGE (M00stafa & mostafa_188)
    vj_users = ['M00stafa', 'mostafa_188']
    vj_total = 0
    for u in vj_users:
        html = fetch_html(f'https://vjudge.net/user/{u}')
        if html:
            m = re.search(r'<script type="application/json" id="profile-header-data">(.*?)</script>', html)
            if m:
                try:
                    data = json.loads(m.group(1))
                    ac_cnt = data.get('counts', {}).get('acAll', 0)
                    if ac_cnt > 0:
                        vj_total += ac_cnt
                        continue
                except Exception:
                    pass
            m2 = re.search(r'title="Overall solved".*?>(\d+)<', html)
            if m2:
                vj_total += int(m2.group(1))
    stats['vjudge'] = max(vj_total, existing_stats.get('vjudge', 1933))

    # 6. LightOJ
    loj_res = fetch_json('https://lightoj.com/api/v1/users/m0stafa_')
    loj_solved = 0
    if loj_res and 'data' in loj_res and 'userStat' in loj_res['data']:
        loj_solved = int(loj_res['data']['userStat'].get('isSolved', 0))
    stats['lightoj'] = max(loj_solved, existing_stats.get('lightoj', 180))

    total = sum(stats.values())
    stats['total'] = total

    print("Fetched stats:", stats)

    # Make sure data directory exists
    os.makedirs('data', exist_ok=True)
    with open('data/cp_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

if __name__ == '__main__':
    main()
