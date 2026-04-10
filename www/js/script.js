// script.js —— 集成后续比赛、刷新动画、添加成员对话框、题板链接
(function(){
    "use strict";

    // 实际数据

    fetch('/getUserList')
      .then(response => {
        if (!response.ok) {
          throw new Error('HTTP error! status: ' + response.status);
        }
        return response.json();
      })
      .then(data => {
        console.log('成功:', data);
      })
      .catch(error => {
        console.error('错误:', error);
     });

    // 模拟数据

    const MOCK_USERS = [
        { handle: 'tourist', title: 'Legendary Grandmaster', rating: 3879, maxRating: 3979, contestCount: 112, recent180Contests: 8, maxRecent180: 3850 },
        { handle: 'jiangly', title: 'Legendary Grandmaster', rating: 3745, maxRating: 3820, contestCount: 78, recent180Contests: 12, maxRecent180: 3780 },
        { handle: 'ksun48', title: 'International Grandmaster', rating: 3420, maxRating: 3520, contestCount: 65, recent180Contests: 9, maxRecent180: 3450 }
    ];

    const generateMockContests = (handle) => [
        { contestId: 1945, name: 'Codeforces Round 945 (Div. 2)', time: Date.now() - 3*86400000, rank: 24, oldRating: 3720, newRating: 3756, points: 7280,
          problems: [{ idx:'A', score:500, solved: true, upsolved: false }, { idx:'B', score:1000, solved: true }, { idx:'C', score:1500, solved: false, upsolved: true }] },
        { contestId: 1930, name: 'Round 930 (Div. 1)', time: Date.now() - 15*86400000, rank: 12, oldRating: 3680, newRating: 3720, points: 8450,
          problems: [{ idx:'A', score:500, solved: true }, { idx:'B', score:1000, solved: true }] },
        { contestId: 1900, name: 'Educational Round 160', time: Date.now() - 45*86400000, rank: 56, oldRating: 3620, newRating: 3680, points: 6200,
          problems: [{ idx:'A', score:500, solved: true }, { idx:'B', score:1000, solved: false, upsolved: true }] }
    ];

    const generateMockSubmissions = (handle) => {
        const subs = [];
        const problems = [
            { rating: 800, name: 'A. Watermelon', contestId: 4, index:'A' }, { rating: 1200, name: 'B. Before an Exam', contestId: 4, index:'B' },
            { rating: 1500, name: 'C. Registration', contestId: 5, index:'C' }, { rating: 1900, name: 'D. Mysterious Present', contestId: 4, index:'D' },
            { rating: 2100, name: 'E. Tree Queries', contestId: 200, index:'E' }
        ];
        problems.forEach((p,i) => subs.push({ id:i, problem:p, verdict:'OK', creationTimeSeconds: Date.now()/1000 - i*10*86400 }));
        subs.push({ id:999, problem:{ rating:1800, name:'H. Hard Problem', contestId:1945, index:'H' }, verdict:'WRONG_ANSWER', creationTimeSeconds: Date.now()/1000 - 2*86400 });
        return subs;
    };

    // 后续比赛模拟
    const UPCOMING_CONTESTS = [
        { name: 'Codeforces Round #950 (Div. 2)', startTime: Date.now() + 2*86400000 },
        { name: 'Educational Codeforces Round 162', startTime: Date.now() + 5*86400000 },
        { name: 'Codeforces Round #951 (Div. 1)', startTime: Date.now() + 9*86400000 }
    ];

    // 全局状态
    let users = [...MOCK_USERS];
    let currentUser = users[0];
    let currentContests = generateMockContests(currentUser.handle);
    let currentSubmissions = generateMockSubmissions(currentUser.handle);
    let chartHistogram = null, chartCurve = null;

    // DOM 元素
    const memberListEl = document.getElementById('member-list-container');
    const profileHeaderEl = document.getElementById('profile-header-card');
    const contestsWrapper = document.getElementById('contests-table-wrapper');
    const solvedListEl = document.getElementById('solved-problems-list');
    const contestProblemsEl = document.getElementById('contests-problems-list');
    const unsolvedListEl = document.getElementById('unsolved-problems-list');
    const memberCountSpan = document.getElementById('member-count');
    const upcomingListEl = document.getElementById('upcomingContestsList');
    const modal = document.getElementById('problemModal');
    const modalTitle = document.getElementById('modalProblemTitle');
    const modalBody = document.getElementById('modalProblemBody');
    const modalLink = document.getElementById('modalProblemLink');
    const addMemberModal = document.getElementById('addMemberModal');
    const newMemberInput = document.getElementById('newMemberHandle');

    // 辅助: 等级颜色
    function getRatingColorClass(r) {
        if (r<1200) return 'rating-newbie'; if (r<1400) return 'rating-pupil'; if (r<1600) return 'rating-specialist';
        if (r<1900) return 'rating-expert'; if (r<2100) return 'rating-cm'; if (r<2400) return 'rating-master';
        return 'rating-grandmaster';
    }

    // 渲染后续比赛
    function renderUpcoming() {
        upcomingListEl.innerHTML = UPCOMING_CONTESTS.map(c => {
            const days = Math.ceil((c.startTime - Date.now()) / 86400000);
            return `<div class="upcoming-item">📅 ${c.name} · ${days}天后</div>`;
        }).join('');
    }

    // 渲染成员列表
    function renderMemberList() {
        memberCountSpan.textContent = users.length;
        memberListEl.innerHTML = users.map(u => {
            const active = currentUser.handle === u.handle ? 'active' : '';
            return `<div class="member-card ${active}" data-handle="${u.handle}">
                <button class="delete-member-btn" data-handle-del="${u.handle}"><i class="fas fa-trash-alt"></i></button>
                <div class="member-row"><div class="member-avatar">${u.handle[0]}</div>
                <div class="member-info"><div class="member-handle">${u.handle}</div>
                <div class="member-title ${getRatingColorClass(u.rating)}">${u.title} · ${u.rating}</div></div></div>
                <div class="member-stats"><div>比赛 ${u.contestCount}</div><div>最高 ${u.maxRating}</div></div>
            </div>`;
        }).join('');
        document.querySelectorAll('.member-card').forEach(c => c.addEventListener('click', (e) => {
            if(e.target.closest('.delete-member-btn')) return;
            const h = c.dataset.handle; const user = users.find(u=>u.handle===h);
            if(user) { currentUser = user; currentContests = generateMockContests(user.handle); currentSubmissions = generateMockSubmissions(user.handle); updateAllUI(); }
        }));
        document.querySelectorAll('.delete-member-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation(); const handle = btn.dataset.handleDel;
            users = users.filter(u => u.handle !== handle);
            if(users.length === 0) { users = [{ handle:'default', title:'newbie', rating:800, maxRating:800, contestCount:0 }]; }
            if(currentUser.handle === handle) currentUser = users[0];
            currentContests = generateMockContests(currentUser.handle); currentSubmissions = generateMockSubmissions(currentUser.handle);
            updateAllUI();
        }));
    }

    // 刷新按钮动画 + 模拟刷新
    function refreshData() {
        // 模拟重新请求数据
        currentContests = generateMockContests(currentUser.handle);
        currentSubmissions = generateMockSubmissions(currentUser.handle);
        updateAllUI();
    }

    // 添加成员对话框
    function openAddMemberModal() {
        addMemberModal.classList.add('show');
        newMemberInput.value = '';
    }

    function addNewMember(handle) {
        if(!handle) return;
        const newUser = { handle, title: 'Expert', rating: 1600 + Math.floor(Math.random()*500), maxRating: 1800, contestCount: 20, recent180Contests: 5, maxRecent180: 1650 };
        users.push(newUser); 
        currentUser = newUser; 
        currentContests = generateMockContests(handle); 
        currentSubmissions = generateMockSubmissions(handle);
        updateAllUI();
    }

    // 渲染概览卡片
    function renderProfileHeader() {
        const u = currentUser;
        profileHeaderEl.innerHTML = `<div class="profile-avatar-large">${u.handle[0]}</div>
            <div><h2>${u.handle} <span class="${getRatingColorClass(u.rating)}">(${u.rating})</span></h2><div>${u.title}</div></div>
            <div class="profile-stat-blocks"><div class="stat-cell"><span class="stat-label">总数</span><span class="stat-number">${u.contestCount}</span></div>
            <div class="stat-cell"><span class="stat-label">最高</span><span class="stat-number">${u.maxRating}</span></div>
            <div class="stat-cell"><span class="stat-label">近180场</span><span class="stat-number">${u.recent180Contests||0}</span></div></div>`;
    }

    function renderContestsTable() {
        let html = `<table><thead><tr><th>赛事</th><th>时间</th><th>赛前/后</th><th>排名</th><th>题目</th></tr></thead><tbody>`;
        [...currentContests].sort((a,b)=>b.time-a.time).forEach(c => {
            const problemSpans = c.problems.map(p => `<span class="problem-clickable" data-name="${p.idx} ${c.name}">${p.idx} ${p.solved?'✅':(p.upsolved?'🔄':'❌')}</span>`).join(' ');
            html += `<tr><td>${c.name}</td><td>${new Date(c.time).toLocaleDateString()}</td><td class="${getRatingColorClass(c.oldRating)}">${c.oldRating}→<span class="${getRatingColorClass(c.newRating)}">${c.newRating}</span></td><td>#${c.rank}</td><td>${problemSpans}</td></tr>`;
        });
        html += `</tbody></table>`; contestsWrapper.innerHTML = html;
    }

    function renderSolvedProblems() {
        const ac = currentSubmissions.filter(s=>s.verdict==='OK');
        solvedListEl.innerHTML = ac.map(s=>`<div class="problem-item problem-clickable" data-name="${s.problem.name}">${s.problem.name} (${s.problem.rating}) ✔</div>`).join('');
    }
    function renderContestProblems() {
        const map = new Map(); currentSubmissions.forEach(s => { const cid = s.problem.contestId; if(!map.has(cid)) map.set(cid, []); map.get(cid).push(s.problem); });
        let h = ''; for(let [cid, arr] of map) { h += `<div class="contest-group-title">📌 Round ${cid}</div>`; arr.forEach(p => h += `<div class="problem-item problem-clickable" data-name="${p.name}">${p.name} (${p.rating})</div>`); }
        contestProblemsEl.innerHTML = h;
    }
    function renderUnsolved() {
        const uns = currentSubmissions.filter(s=>s.verdict!=='OK');
        unsolvedListEl.innerHTML = uns.map(s=>`<div class="problem-item problem-clickable" data-name="${s.problem.name}">⚠️ ${s.problem.name} (${s.problem.rating})</div>`).join('');
    }

    // 题板 + 链接
    function showProblemModal(problemName) {
        modalTitle.innerText = problemName || '题目详情';
        modalBody.innerHTML = `<p><strong>描述：</strong> ${problemName} 的题面。给定n个整数，求…</p><pre>输入: 3\n1 2 3\n输出: 6</pre><p>标签: implementation</p>`;
        modalLink.href = `https://codeforces.com/problemset/problem/4/A`; // 模拟链接
        modal.classList.add('show');
    }

    // 直方图
    function renderHistogram(range='all') {
        const dom = document.getElementById('rating-histogram-chart'); if(chartHistogram) chartHistogram.dispose();
        chartHistogram = echarts.init(dom); let filtered = currentSubmissions.filter(s=>s.verdict==='OK'&&s.problem.rating);
        const now = Date.now()/1000; if(range==='year') filtered = filtered.filter(s=>now-s.creationTimeSeconds<=31536000); else if(range==='180d') filtered=filtered.filter(s=>now-s.creationTimeSeconds<=15552000); else if(range==='month') filtered=filtered.filter(s=>now-s.creationTimeSeconds<=2592000);
        const buckets = {'800-1199':0,'1200-1399':0,'1400-1599':0,'1600-1899':0,'1900-2099':0,'2100-2399':0,'2400+':0};
        filtered.forEach(s=>{ const r=s.problem.rating; if(r<1200) buckets['800-1199']++; else if(r<1400) buckets['1200-1399']++; else if(r<1600) buckets['1400-1599']++; else if(r<1900) buckets['1600-1899']++; else if(r<2100) buckets['1900-2099']++; else if(r<2400) buckets['2100-2399']++; else buckets['2400+']++; });
        chartHistogram.setOption({ xAxis:{data:Object.keys(buckets)}, yAxis:{}, series:[{type:'bar',data:Object.values(buckets), color:'#3b82f6'}] });
    }

    function renderRatingCurve() {
        const dom = document.getElementById('rating-curve-chart'); if(chartCurve) chartCurve.dispose();
        chartCurve = echarts.init(dom);
        const data = currentContests.map(c => ({ time: new Date(c.time).toLocaleDateString(), rating: c.newRating })).sort((a,b)=>a.time-b.time);
        chartCurve.setOption({ xAxis: { data: data.map(d=>d.time) }, yAxis: {}, series: [{ type:'line', data: data.map(d=>d.rating), smooth: true, color:'#e67e22' }], tooltip:{trigger:'axis'} });
    }

    function updateAllUI() {
        renderMemberList(); renderProfileHeader(); renderContestsTable(); renderSolvedProblems(); renderContestProblems(); renderUnsolved();
        renderHistogram('all'); renderRatingCurve(); renderUpcoming();
        document.querySelectorAll('.filter-btn').forEach(b=>b.addEventListener('click', ()=>{
            document.querySelectorAll('.filter-btn').forEach(bb=>bb.classList.remove('active')); b.classList.add('active'); renderHistogram(b.dataset.range);
        }));
    }

    // 事件绑定
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('addMemberBtn').addEventListener('click', openAddMemberModal);
    document.getElementById('closeAddModalBtn').addEventListener('click', ()=> addMemberModal.classList.remove('show'));
    document.getElementById('confirmAddMemberBtn').addEventListener('click', ()=>{
        const handle = newMemberInput.value.trim();
        if(handle) { addNewMember(handle); addMemberModal.classList.remove('show'); }
    });
    document.getElementById('closeModalBtn').addEventListener('click', ()=> modal.classList.remove('show'));
    document.getElementById('modalCloseFooterBtn').addEventListener('click', ()=> modal.classList.remove('show'));
    document.addEventListener('click', (e) => { if(e.target.classList.contains('problem-clickable')) showProblemModal(e.target.dataset.name || e.target.innerText); });

    // 初始化
    updateAllUI();
    window.addEventListener('resize', ()=>{ chartHistogram?.resize(); chartCurve?.resize(); });
})();