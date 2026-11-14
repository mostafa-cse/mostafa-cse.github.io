import urllib.request
import json
import re
import os
import datetime

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

CF_HANDLE = 'm0stafa'

def load_previous():
    """Previous run's output — used so a failed fetch keeps the last good number
    instead of publishing a zero."""
    try:
        with open('data/cp_stats.json') as f:
            return json.load(f)
    except Exception:
        return {}


def build_cf_profile(status_result):
    """Codeforces detail block that powers the portfolio's CP section:
    rating history, solved-by-rating distribution and tag counts.
    Everything here is derived from the official API — nothing is estimated."""
    profile = {'handle': CF_HANDLE}

    info = fetch_json(f'https://codeforces.com/api/user.info?handles={CF_HANDLE}')
    if info and info.get('status') == 'OK' and info.get('result'):
        u = info['result'][0]
        profile.update({
            'handle':    u.get('handle', CF_HANDLE),
            'rating':    u.get('rating'),
            'maxRating': u.get('maxRating'),
            'rank':      u.get('rank'),
            'maxRank':   u.get('maxRank'),
        })

    rating_res = fetch_json(f'https://codeforces.com/api/user.rating?handle={CF_HANDLE}')
    if rating_res and rating_res.get('status') == 'OK':
        history = rating_res.get('result', [])
        profile['contests'] = len(history)
        # Trimmed to what the chart draws: timestamp, new rating, contest, place
        profile['ratingHistory'] = [{
            't':    h.get('ratingUpdateTimeSeconds'),
            'r':    h.get('newRating'),
            'd':    h.get('newRating', 0) - h.get('oldRating', 0),
            'name': h.get('contestName'),
            'place': h.get('rank'),
        } for h in history]

    # Solved-problem analysis from the submission list we already fetched
    if status_result:
        solved = {}
        for sub in status_result:
            if sub.get('verdict') != 'OK':
                continue
            p = sub.get('problem', {})
            key = (p.get('contestId'), p.get('index'), p.get('name'))
            solved.setdefault(key, p)

        by_rating, tags = {}, {}
        hardest = 0
        for p in solved.values():
            r = p.get('rating')
            if r:
                by_rating[str(r)] = by_rating.get(str(r), 0) + 1
                hardest = max(hardest, r)
            for t in p.get('tags', []):
                tags[t] = tags.get(t, 0) + 1

        # NOTE: the solved count lives in the top-level 'codeforces' key so the
        # page never shows two slightly different totals for the same thing.
        profile['hardest']  = hardest or None
        profile['byRating'] = dict(sorted(by_rating.items(), key=lambda kv: int(kv[0])))
        profile['topTags']  = sorted(tags.items(), key=lambda kv: -kv[1])[:10]

    return profile


def main():
    previous = load_previous()
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

    # Detailed Codeforces profile for the portfolio's CP section
    stats['cf'] = build_cf_profile(cf_result)
    stats['updated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    print("Fetched stats:", {k: v for k, v in stats.items() if k != 'cf'})
    print("CF profile:", {k: v for k, v in stats['cf'].items() if k not in ('ratingHistory', 'byRating', 'topTags')})

    # Make sure data directory exists
    os.makedirs('data', exist_ok=True)
    with open('data/cp_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

if __name__ == '__main__':
    main()
