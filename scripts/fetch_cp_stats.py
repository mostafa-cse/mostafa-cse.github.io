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
    stats['codeforces'] = len(cf_solved) if cf_solved else 2754

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
    ac_res = fetch_json('https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=mostafa___')
    if ac_res and 'count' in ac_res:
        stats['atcoder'] = max(ac_res['count'], 250)
    else:
        stats['atcoder'] = 250 # Resume baseline

    # 4. CodeChef
    cc_res = fetch_html('https://www.codechef.com/users/mostafa_kamal')
    if cc_res:
        match = re.search(r'Fully Solved \((\d+)\)', cc_res)
        if match:
            stats['codechef'] = int(match.group(1))
        else:
            stats['codechef'] = 682 # Fallback / Resume baseline
    else:
        stats['codechef'] = 682 # Fallback / Resume baseline

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
    stats['vjudge'] = vj_total if vj_total > 0 else 1933

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
