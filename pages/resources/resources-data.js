export const TOPICS = [
  { icon:'🧩', name:'Dynamic Programming', count:'400+', link:'https://codeforces.com/problemset?tags=dp' },
  { icon:'🕸', name:'Graph Theory',         count:'350+', link:'https://codeforces.com/problemset?tags=graphs' },
  { icon:'🔢', name:'Mathematics',          count:'300+', link:'https://codeforces.com/problemset?tags=math' },
  { icon:'🏗', name:'Data Structures',      count:'280+', link:'https://codeforces.com/problemset?tags=data+structures' },
  { icon:'⚡', name:'Greedy',               count:'260+', link:'https://codeforces.com/problemset?tags=greedy' },
  { icon:'🔤', name:'Strings',              count:'200+', link:'https://codeforces.com/problemset?tags=strings' },
  { icon:'🌲', name:'Trees',                count:'220+', link:'https://codeforces.com/problemset?tags=trees' },
  { icon:'➕', name:'Binary Search',        count:'180+', link:'https://codeforces.com/problemset?tags=binary+search' },
  { icon:'🎭', name:'Two Pointers',         count:'140+', link:'https://codeforces.com/problemset?tags=two+pointers' },
  { icon:'🌀', name:'Divide & Conquer',     count:'120+', link:'https://codeforces.com/problemset?tags=divide+and+conquer' },
  { icon:'🔗', name:'Union-Find',           count:'100+', link:'https://codeforces.com/problemset?tags=dsu' },
  { icon:'📐', name:'Geometry',             count:'90+',  link:'https://codeforces.com/problemset?tags=geometry' },
];

export const TEMPLATES = [
  { name: 'Fast I/O + Template', lang: 'C++', code: `#include <bits/stdc++.h>
using namespace std;
#define int long long
#define pb push_back
#define all(x) x.begin(),x.end()
const int MOD = 1e9+7;
signed main(){
  ios_base::sync_with_stdio(false);
  cin.tie(NULL);
  int t; cin >> t;
  while(t--){
    // your code
  }
}` },
  { name: 'BFS Template', lang: 'C++', code: `void bfs(int src, vector<vector<int>>& adj, int n){
  vector<int> dist(n+1, -1);
  queue<int> q;
  q.push(src); dist[src] = 0;
  while(!q.empty()){
    int u = q.front(); q.pop();
    for(int v : adj[u])
      if(dist[v]==-1){ dist[v]=dist[u]+1; q.push(v); }
  }
}` },
  { name: 'Segment Tree', lang: 'C++', code: `struct SegTree {
  int n; vector<long long> tree;
  SegTree(int n): n(n), tree(4*n, 0){}
  void update(int i, long long val, int node=1, int l=0, int r=-1){
    if(r==-1) r=n-1;
    if(l==r){ tree[node]=val; return; }
    int mid=(l+r)/2;
    if(i<=mid) update(i,val,2*node,l,mid);
    else update(i,val,2*node+1,mid+1,r);
    tree[node]=tree[2*node]+tree[2*node+1];
  }
  long long query(int ql,int qr,int node=1,int l=0,int r=-1){
    if(r==-1) r=n-1;
    if(ql<=l&&r<=qr) return tree[node];
    if(qr<l||r<ql) return 0;
    int mid=(l+r)/2;
    return query(ql,qr,2*node,l,mid)+query(ql,qr,2*node+1,mid+1,r);
  }
};` },
];
