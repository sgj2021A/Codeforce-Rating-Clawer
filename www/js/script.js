// script.js —— 集成后续比赛、刷新动画、添加成员对话框、题板链接
class Person {
    constructor() {
        this.users = [];
        this.userContests = { result: [] };
        this.getUserList;
        this.refreshUser;
        this.addUser;
    }

    async getUserList() {
        try {
            const response = await fetch('/getUserList');
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            const data = await response.json();
            this.users = data.user || [];
            await this.refreshUser();
        } catch (error) {
            console.error('错误:', error);
            this.users = [];
            this.userContests = { result: [] };
        }
    }

    async addUser(adduser) {
        // 先验证 Codeforces 用户是否存在
        try {
            const checkUrl = `https://codeforces.com/api/user.info?handles=${adduser}`;
            const checkResponse = await fetch(checkUrl);
            const checkData = await checkResponse.json();
            
            if (checkData.status !== 'OK') {
                alert('添加失败：用户 "' + adduser + '" 不存在，请检查用户名');
                return;
            }
            
            // 用户存在，继续添加
            const response = await fetch('/addUser', {
                method: 'post',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: adduser
            });

            const data = await response.json();

            if (!response.ok || data.status !== 'ok') {
                alert('添加失败：' + (data.comment || '请检查用户名'));
                return;
            }

            await this.getUserList();
        } catch (error) {
            console.error('添加用户错误:', error);
            alert('添加失败：网络错误，请稍后重试');
        }
    }
    async refreshUser() {
        if (!this.users || this.users.length === 0) {
            console.warn('用户列表为空');
            this.userContests = { result: [] };
            return;
        }

        const baseUrl = 'https://codeforces.com/api/user.info';
        const handlesParam = this.users.join(';');
        const params = new URLSearchParams();
        params.append('handles', handlesParam);
        params.append('checkHistoricHandles', 'true');
        const finalUrl = `${baseUrl}?${params.toString()}`;

        try {
            const response = await fetch('/get', {
                method: 'post',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: finalUrl
            });

            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }

            const data = await response.json();
            this.userContests = data;
        } catch (error) {
            console.error('错误:', error);
            this.userContests = { result: [] };
        }
    }

    async deleteUser(deleteuser) {
        try {
            const response = await fetch('/deleteUser', {
                method: 'post',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: deleteuser
            });

            const data = await response.json();

            if (!response.ok || data.status !== 'ok') {
                alert('删除失败：' + (data.comment || '请检查用户名'));
                return;
            }

            await this.getUserList();
        } catch (error) {
            console.error('删除用户错误:', error);
            alert('删除失败：网络错误');
        }
    }
}


(async function () {
    "use strict";
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

    // 实际数据
    const u = new Person();
    await u.getUserList();

    // 调试输出
    //console.log('用户列表:', u.users);
    //console.log('比赛数据:', u.userContests);

    // 全局状态
    let users = u.userContests?.result || [];
    let currentUser = users.length > 0 ? users[0] : null;
    let currentContests = [];
    let currentSubmissions = [];
    let chartHistogram = null, chartCurve = null;

    // 只有在有用户时才获取数据
    if (u.users && u.users.length > 0) {
        fetchRating(currentUser?.handle);
        fetchUserStatus(currentUser?.handle);
    }

    // 后续比赛数据
    let UPCOMING_CONTESTS = [];

    // 辅助: 等级颜色
    function getRatingColorClass(r) {
        if (r < 1200) return 'rating-newbie';
        if (r < 1400) return 'rating-pupil';
        if (r < 1600) return 'rating-specialist';
        if (r < 1900) return 'rating-expert';
        if (r < 2100) return 'rating-cm';
        if (r < 2400) return 'rating-master';
        return 'rating-grandmaster';
    }

    // 获取用户 status
    function fetchUserStatus(handle) {
        if (!handle) {
            console.warn('没有用户句柄，跳过获取状态');
            return;
        }
        
        const url = `https://codeforces.com/api/user.status?handle=${handle}`;
        fetch(url)
            .then(data => data.json())
            .then(data => {
                if (data.status === 'FAILED') {
                    console.error('获取status错误:', data.comment);
                } else {
                    currentSubmissions = data.result || [];
                    // 渲染用户状态
                    renderHistogram('all');
                    renderUnsolved();
                    renderSolvedProblems();
                    renderContestProblems();
                }
            })
            .catch(error => {
                console.error('获取status错误码:', error);
                currentSubmissions = [];
            });
    }

    // 渲染后续比赛
    function renderUpcoming() {
        if (!upcomingListEl) return;
        if (!UPCOMING_CONTESTS || UPCOMING_CONTESTS.length === 0) {
            upcomingListEl.innerHTML = '<div class="upcoming-item">暂无即将开始的比赛</div>';
            return;
        }
        upcomingListEl.innerHTML = UPCOMING_CONTESTS.map(c => {
            const days = Math.ceil((c.startTimeSeconds * 1000 - Date.now()) / 86400000);
            return `<div class="upcoming-item">📅 ${c.name} · ${c.type} · ${days} 天后</div>`;
        }).join('');
    }

    // 渲染成员列表 + 更新点击事件
    function renderMemberList() {
        if (!memberCountSpan || !memberListEl) return;
        
        const userList = u.userContests?.result || [];
        memberCountSpan.textContent = userList.length;
        
        if (userList.length === 0) {
            memberListEl.innerHTML = '<div class="member-card">暂无成员，请添加</div>';
            return;
        }
        
        memberListEl.innerHTML = userList.map(u => {
            const active = currentUser && currentUser.handle === u.handle ? 'active' : '';
            const avatarUrl = u.avatar || `https://via.placeholder.com/40/3b82f6/ffffff?text=${(u.handle?.[0] || '?').toUpperCase()}`;
            
            return `<div class="member-card ${active}" data-handle="${u.handle}">
                <button class="delete-member-btn" data-handle-del="${u.handle}"><i class="fas fa-trash-alt"></i></button>
                <div class="member-row">
                    <div class="member-avatar">
                        <img src="${avatarUrl}" alt="${u.handle}" onerror="this.src='https://via.placeholder.com/40/3b82f6/ffffff?text=${(u.handle?.[0] || '?').toUpperCase()}'">
                    </div>
                    <div class="member-info">
                        <div class="member-handle">${u.handle}</div>
                        <div class="member-title ${getRatingColorClass(u.rating)}">${u.rank || 'Newbie'} · ${u.rating || 0}</div>
                    </div>
                </div>
                <div class="member-stats">
                    <div>最高等级 ${u.maxRank || '-'}</div>
                    <div>最高分数 ${u.maxRating || 0}</div>
                </div>
            </div>`;
        }).join('');
        
        document.querySelectorAll('.member-card').forEach(c => c.addEventListener('click', async (e) => {
            if (e.target.closest('.delete-member-btn')) return;
            const h = c.dataset.handle;
            const user = (u.userContests?.result || []).find(u => u.handle === h);
            if (user) {
                fetchRating(user.handle);
                fetchUserStatus(user.handle);
                currentUser = user;
                updateAllUI();
            }
        }));
        
        document.querySelectorAll('.delete-member-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const handle = btn.dataset.handleDel;
            deleteMember(handle);
        }));
    }

    // 刷新按钮动画 + 模拟刷新
    function refreshData() {
        if (currentUser && currentUser.handle) {
            fetchRating(currentUser.handle);
            fetchUserStatus(currentUser.handle);
        }
        updateAllUI();
    }

    // 添加成员对话框
    function openAddMemberModal() {
        if (addMemberModal) {
            addMemberModal.classList.add('show');
            if (newMemberInput) newMemberInput.value = '';
        }
    }
    
    // 添加新成员
    async function addNewMember(handle) {
        if (!handle) return;
        await u.addUser(handle);
        users = u.userContests?.result || [];
        if (users.length > 0) currentUser = users[0];
        refreshData();
    }
    // 删除成员
    async function deleteMember(handle) {
        if (!handle) return;
        await u.deleteUser(handle);
        users = u.userContests?.result || [];
        if (users.length > 0) {
            currentUser = users[0];
        } else {
            currentUser = null;
            currentContests = [];
            currentSubmissions = [];
        }
        refreshData();
    }

    // 获取后续比赛数据
    function fetchUpcomingContests() {
        fetch('https://codeforces.com/api/contest.list')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'FAILED') {
                    console.error('获取比赛错误:', data.comment);
                    UPCOMING_CONTESTS = [];
                } else {
                    UPCOMING_CONTESTS = data.result.filter(contest => contest.phase === 'BEFORE');
                    UPCOMING_CONTESTS.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
                }
                renderUpcoming();
            })
            .catch(error => {
                console.error('获取比赛错误码:', error);
                UPCOMING_CONTESTS = [];
                renderUpcoming();
            });
    }
    
    // 渲染概览卡片
    function renderProfileHeader() {
        if (!profileHeaderEl) return;
        
        if (!currentUser) {
            profileHeaderEl.innerHTML = '<div>请添加成员</div>';
            return;
        }
        
        const u = currentUser;
        const lastOnline = u.lastOnlineTimeSeconds ? new Date(u.lastOnlineTimeSeconds * 1000) : new Date();
        const avatarUrl = u.avatar || `https://via.placeholder.com/80/3b82f6/ffffff?text=${(u.handle?.[0] || '?').toUpperCase()}`;
        
        profileHeaderEl.innerHTML = `
            <div class="profile-avatar-large">
                <img src="${avatarUrl}" alt="${u.handle}" 
                    onerror="this.src='https://via.placeholder.com/80/3b82f6/ffffff?text=${(u.handle?.[0] || '?').toUpperCase()}'">
            </div>
            <div>
                <h2>${u.handle} <span class="${getRatingColorClass(u.rating)}">(${u.rating || 0})</span></h2>
                <div>${u.rank || 'Newbie'}</div>
            </div>
            <div class="profile-stat-blocks">
                <div class="stat-cell">
                    <span class="stat-label">最高等级</span>
                    <span class="stat-number">${u.maxRank || '-'}</span>
                </div>
                <div class="stat-cell">
                    <span class="stat-label">最高分数</span>
                    <span class="stat-number">${u.maxRating || 0}</span>
                </div>
                <div class="stat-cell">
                    <span class="stat-label">最后登录时间</span>
                    <span class="stat-number">${lastOnline.toLocaleString()}</span>
                </div>
            </div>
        `;
    }
    
    // 渲染比赛列表
    function renderContestsTable() {
        if (!contestsWrapper) return;
        
        if (!currentContests || !Array.isArray(currentContests) || currentContests.length === 0) {
            contestsWrapper.innerHTML = '<div style="text-align:center; padding:40px;">暂无比赛数据</div>';
            return;
        }
        
        let html = '<div class="contests-cards-container">';
        [...currentContests]
            .sort((a, b) => b.ratingUpdateTimeSeconds - a.ratingUpdateTimeSeconds)
            .forEach(c => {
                const contestDate = new Date(c.ratingUpdateTimeSeconds * 1000).toLocaleDateString();
                const ratingChange = c.newRating - c.oldRating;
                const changeClass = ratingChange > 0 ? 'rating-up' : (ratingChange < 0 ? 'rating-down' : 'rating-same');
                const changeSign = ratingChange > 0 ? '+' : '';
                
                html += `
                    <div class="contest-card">
                        <div class="contest-header">
                            <div class="contest-name">${c.contestName}</div>
                            <div class="contest-date">📅 ${contestDate}</div>
                        </div>
                        <div class="contest-stats">
                            <div class="stat-item">
                                <span class="stat-label">排名</span>
                                <span class="stat-value">#${c.rank}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Rating变化</span>
                                <span class="stat-value ${changeClass}">
                                    ${c.oldRating} → ${c.newRating}
                                    <span class="rating-change">(${changeSign}${ratingChange})</span>
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            });
        html += '</div>';
        contestsWrapper.innerHTML = html;
    }
    
    // 渲染已通过题目
    function renderSolvedProblems() {
        if (!solvedListEl) return;
        
        if (!currentSubmissions || !Array.isArray(currentSubmissions) || currentSubmissions.length === 0) {
            solvedListEl.innerHTML = '<div>暂无提交数据</div>';
            return;
        }
        
        const ac = currentSubmissions.filter(s => s && s.verdict === 'OK');
        if (ac.length === 0) {
            solvedListEl.innerHTML = '<div>暂无通过的题目</div>';
            return;
        }
        
        solvedListEl.innerHTML = ac.map(s => `<div class="problem-item problem-clickable" 
            data-problem-name="${s.problem.name}" 
            data-contest-id="${s.problem.contestId}" 
            data-problem-index="${s.problem.index}">
            ${s.problem.name} (${s.problem.rating || '?'}) ✔
        </div>`).join('');
    }

    function renderContestProblems() {
        if (!contestProblemsEl) return;
        
        if (!currentSubmissions?.length) {
            contestProblemsEl.innerHTML = '<div>暂无数据</div>';
            return;
        }
        
        const problemMap = new Map();
        currentSubmissions.forEach(s => {
            if (!s?.problem) return;
            const contestId = s.problem.contestId;
            const problemId = `${contestId}|${s.problem.index}`;
            const isOk = s.verdict === 'OK';
            
            if (!problemMap.has(problemId)) {
                problemMap.set(problemId, {
                    name: s.problem.name,
                    index: s.problem.index,
                    rating: s.problem.rating,
                    points: s.problem.points,
                    contestId: contestId,
                    verdict: s.verdict,
                    isOk: isOk
                });
            } else {
                const existing = problemMap.get(problemId);
                if (isOk && !existing.isOk) {
                    existing.verdict = 'OK';
                    existing.isOk = true;
                }
            }
        });
        
        const unsolvedList = Array.from(problemMap.values()).filter(p => !p.isOk);
        
        if (unsolvedList.length === 0) {
            contestProblemsEl.innerHTML = '<div>🎉 恭喜！所有题目都已通过</div>';
            return;
        }
        
        const contestMap = new Map();
        unsolvedList.forEach(p => {
            const cid = p.contestId;
            if (!contestMap.has(cid)) contestMap.set(cid, []);
            contestMap.get(cid).push(p);
        });
        
        let html = '';
        for (let [cid, problems] of contestMap) {
            html += `<div class="contest-group-title">📌 Round ${cid}</div>`;
            problems.forEach(p => {
                html += `<div class="problem-item problem-clickable" 
                    data-problem-name="${p.name}" 
                    data-contest-id="${p.contestId}" 
                    data-problem-index="${p.index}">
                    ❌ ${p.index} - ${p.name} (${p.points || '跳过'})
                </div>`;
            });
        }
        contestProblemsEl.innerHTML = html;
    }

    // 渲染未通过题目
    function renderUnsolved() {
        if (!unsolvedListEl) return;
        
        if (!currentSubmissions?.length) {
            unsolvedListEl.innerHTML = '<div>暂无数据</div>';
            return;
        }
        
        const problemMap = new Map();
        currentSubmissions.forEach(s => {
            if (!s?.problem) return;
            const problemId = `${s.problem.contestId}${s.problem.index}`;
            const isOk = s.verdict === 'OK';
            
            if (!problemMap.has(problemId)) {
                problemMap.set(problemId, {
                    name: s.problem.name,
                    index: s.problem.index,
                    points: s.problem.points,
                    verdict: s.verdict,
                    contestId: s.problem.contestId,
                    isOk: isOk
                });
            } else {
                const existing = problemMap.get(problemId);
                if (isOk && !existing.isOk) {
                    existing.verdict = 'OK';
                    existing.isOk = true;
                }
            }
        });
        
        const unsolved = Array.from(problemMap.values()).filter(p => !p.isOk);
        
        if (unsolved.length === 0) {
            unsolvedListEl.innerHTML = '<div>🎉 恭喜！所有题目都已通过</div>';
            return;
        }
        
        unsolvedListEl.innerHTML = unsolved.map(p => {
            return `<div class="problem-item problem-clickable" 
                data-problem-name="${p.name}" 
                data-contest-id="${p.contestId}" 
                data-problem-index="${p.index}">
                ⚠️ ${p.index} - ${p.name} (${p.points || '跳过'})
            </div>`;
        }).join('');
    }

    // 题板 + 链接
    function showProblemModal(problemName, contestId, problemIndex) {
        if (!modal) return;
        modalTitle.innerText = problemName || '题目详情';
        //console.log('弹窗参数:', { problemName, contestId, problemIndex });

        let problemUrl = '#';
        if (contestId && problemIndex && contestId !== 'undefined' && problemIndex !== 'undefined') {
            problemUrl = `https://codeforces.com/problemset/problem/${contestId}/${problemIndex}`;
            if (contestId > 100000) {
                problemUrl = `https://codeforces.com/gym/${contestId}/problem/${problemIndex}`;
            }
        } else {
            problemUrl = `https://codeforces.com/problemset?tags=${encodeURIComponent(problemName)}`;
        }
        modalLink.href = problemUrl;
        modalBody.innerHTML = `
            <p>正在查看题目：<strong>${problemName}</strong></p>
            <p>题目ID: ${contestId}/${problemIndex}</p>
            <p>请点击下方链接查看完整的题目描述：</p>
            <a href="${problemUrl}" target="_blank" rel="noopener noreferrer">${problemUrl}</a>
        `;
        modal.classList.add('show');
    }

    // 事件监听
    document.addEventListener('click', (e) => {
        const problemElement = e.target.closest('.problem-clickable');
        if (problemElement) {
            const problemName = problemElement.dataset.problemName;
            const contestId = problemElement.dataset.contestId;
            const problemIndex = problemElement.dataset.problemIndex;
            
            //console.log('点击获取:', { problemName, contestId, problemIndex });
            showProblemModal(problemName, contestId, problemIndex);
        }
    });
    
    // 直方图
    function renderHistogram(range = 'all') {
        const dom = document.getElementById('rating-histogram-chart');
        if (!dom) return;
        
        if (chartHistogram) chartHistogram.dispose();
        chartHistogram = echarts.init(dom);
        
        if (!currentSubmissions?.length) {
            chartHistogram.setOption({ title: { text: '暂无数据', left: 'center', top: 'center' } });
            return;
        }
        
        const uniqueProblems = new Map();
        currentSubmissions.forEach(s => {
            if (s && s.verdict === 'OK' && s.problem) {
                const key = `${s.problem.contestId}|${s.problem.index}`;
                if (!uniqueProblems.has(key)) {
                    uniqueProblems.set(key, s.problem.rating || 0);
                }
            }
        });
        
        const ratings = Array.from(uniqueProblems.values());
        const withRating = ratings.filter(r => r > 0);
        const withoutRating = ratings.filter(r => r === 0);
        
        const buckets = { '无评级': withoutRating.length };
        const ranges = ['800-1199', '1200-1399', '1400-1599', '1600-1899', '1900-2099', '2100-2399', '2400+'];
        ranges.forEach(r => buckets[r] = 0);
        
        withRating.forEach(r => {
            if (r < 1200) buckets['800-1199']++;
            else if (r < 1400) buckets['1200-1399']++;
            else if (r < 1600) buckets['1400-1599']++;
            else if (r < 1900) buckets['1600-1899']++;
            else if (r < 2100) buckets['1900-2099']++;
            else if (r < 2400) buckets['2100-2399']++;
            else buckets['2400+']++;
        });
        
        chartHistogram.setOption({
            title: { text: `通过题目分布`, left: 'center' },
            tooltip: { trigger: 'axis' },
            xAxis: { data: Object.keys(buckets), axisLabel: { rotate: 45 } },
            yAxis: { name: '题目数量' },
            series: [{
                type: 'bar',
                data: Object.values(buckets),
                itemStyle: { color: (p) => p.dataIndex === 0 ? '#f59e0b' : '#3b82f6' },
                label: { show: true, position: 'top' }
            }]
        });
    }
    
    // Rating 曲线
    function renderRatingCurve() {
        const dom = document.getElementById('rating-curve-chart');
        if (!dom) return;
        
        if (chartCurve) chartCurve.dispose();
        chartCurve = echarts.init(dom);
        
        if (!currentContests || currentContests.length === 0) {
            chartCurve.setOption({ title: { text: '暂无数据', left: 'center', top: 'center' } });
            return;
        }
        
        const data = currentContests.map(c => ({
            time: new Date(c.ratingUpdateTimeSeconds * 1000).toLocaleDateString(),
            oldRating: c.oldRating,
            newRating: c.newRating
        })).sort((a, b) => new Date(a.time) - new Date(b.time));
        
        chartCurve.setOption({
            xAxis: {
                data: data.map(d => d.time),
                name: '比赛时间',
                axisLabel: { rotate: 45 }
            },
            yAxis: {
                name: 'Rating',
                min: Math.min(...data.map(d => d.oldRating), ...data.map(d => d.newRating)) - 100
            },
            series: [
                {
                    type: 'line',
                    name: '赛后 Rating',
                    data: data.map(d => d.newRating),
                    smooth: true,
                    color: '#e67e22',
                    lineStyle: { width: 3 },
                    symbol: 'circle',
                    symbolSize: 8
                },
                {
                    type: 'line',
                    name: '赛前 Rating',
                    data: data.map(d => d.oldRating),
                    smooth: true,
                    color: '#94a3b8',
                    lineStyle: { width: 2, type: 'dashed' },
                    symbol: 'diamond',
                    symbolSize: 6
                }
            ],
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const index = params[0].dataIndex;
                    const contest = currentContests[index];
                    return `${contest.contestName}<br/>
                            赛前: ${contest.oldRating}<br/>
                            赛后: ${contest.newRating}<br/>
                            变化: ${contest.newRating - contest.oldRating > 0 ? '+' : ''}${contest.newRating - contest.oldRating}<br/>
                            排名: #${contest.rank}`;
                }
            },
            legend: {
                data: ['赛后 Rating', '赛前 Rating'],
                top: 0,
                right: 10
            },
            grid: {
                containLabel: true,
                left: 10,
                right: 100,
                top: 40,
                bottom: 0
            }
        });
    }

    // 更新用户Rating数据
    function fetchRating(handle) {
        if (!handle) {
            console.warn('没有用户句柄，跳过获取Rating');
            return;
        }
        
        const url = `https://codeforces.com/api/user.rating?handle=${handle}`;
        currentContests = [];
        fetch(url)
            .then(data => data.json())
            .then(data => {
                if (data.status === 'FAILED') {
                    console.error('获取rating错误:', data.comment);
                } else {
                    currentContests = data.result || [];
                    renderRatingCurve();
                    renderContestsTable();
                }
            })
            .catch(error => {
                console.error('获取rating错误码:', error);
                currentContests = [];
            });
    }
    
    // 全局更新函数
    function updateAllUI() {
        renderContestsTable();
        renderContestProblems();
        renderMemberList();
        renderProfileHeader();
        renderSolvedProblems();
        renderUnsolved();
        renderHistogram('all');
        renderRatingCurve();
        renderUpcoming();
        
        document.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(bb => bb.classList.remove('active'));
            b.classList.add('active');
            renderHistogram(b.dataset.range);
        }));
    }

    // 事件绑定
    const refreshBtn = document.getElementById('refreshBtn');
    const addMemberBtn = document.getElementById('addMemberBtn');
    const closeAddModalBtn = document.getElementById('closeAddModalBtn');
    const confirmAddMemberBtn = document.getElementById('confirmAddMemberBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalCloseFooterBtn = document.getElementById('modalCloseFooterBtn');
    
    if (refreshBtn) refreshBtn.addEventListener('click', refreshData);
    if (addMemberBtn) addMemberBtn.addEventListener('click', openAddMemberModal);
    if (closeAddModalBtn) closeAddModalBtn.addEventListener('click', () => addMemberModal?.classList.remove('show'));
    if (confirmAddMemberBtn) {
        confirmAddMemberBtn.addEventListener('click', () => {
            const handle = newMemberInput?.value.trim();
            if (handle) {
                addNewMember(handle);
                addMemberModal?.classList.remove('show');
            }
        });
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal?.classList.remove('show'));
    if (modalCloseFooterBtn) modalCloseFooterBtn.addEventListener('click', () => modal?.classList.remove('show'));

    // 初始化
    updateAllUI();
    fetchUpcomingContests();
    if (currentUser && currentUser.handle) {
        fetchUserStatus(currentUser.handle);
    }
    window.addEventListener('resize', () => {
        if (chartHistogram) chartHistogram.resize();
        if (chartCurve) chartCurve.resize();
    });
})();