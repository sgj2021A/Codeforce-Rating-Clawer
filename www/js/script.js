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

// 比赛详情管理类
class ContestDetailManager {
    constructor() {
        this.modalId = 'contest-detail-modal';
        this.initStyles();
    }
    
    initStyles() {
        if (document.getElementById('contest-detail-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'contest-detail-styles';
        style.textContent = `
            .loading-spinner {
                display: inline-block;
                width: 40px; height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .contest-card {
                transition: transform 0.2s, box-shadow 0.2s;
                cursor: pointer;
            }
            .contest-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .problem-vp {
                background-color: #fff3cd;
                border-left: 3px solid #ffc107;
            }
            .problem-unsolved {
                background-color: #f8d7da;
                border-left: 3px solid #dc3545;
            }
        `;
        document.head.appendChild(style);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
    }
    
    async showContestDetails(contestId, contestName, username, contestDataFromRating, userSubmissions = []) {
        this.showModal(`
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 18px; margin-bottom: 20px;">📊 加载比赛详情中...</div>
                <div class="loading-spinner"></div>
            </div>
        `, contestName);
        
        try {
            const response = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}`);
            const data = await response.json();
            
            let apiProblems = null;
            let userStanding = null;
            let hasRow = false;
            
            if (data.status === 'OK') {
                apiProblems = data.result.problems || null;
                if (data.result.rows && data.result.rows.length > 0) {
                    userStanding = data.result.rows.find(row => 
                        row.party.members.some(m => m.handle === username)
                    );
                    hasRow = !!userStanding;
                }
            }
            
            this.renderContestDetailsModal(
                contestName, contestId,
                apiProblems,       
                userStanding,
                hasRow,
                userSubmissions,
                contestDataFromRating
            );
        } catch (error) {
            console.error('获取比赛详情失败:', error);
            this.renderContestDetailsModal(
                contestName, contestId,
                null, null, false,
                userSubmissions, contestDataFromRating
            );
        }
    }
    
    renderContestDetailsModal(contestName, contestId, apiProblems, userStanding, hasRow, userSubmissions, contestDataFromRating) {
        let problemsList = [];
        if (apiProblems && apiProblems.length > 0) {
            problemsList = apiProblems.map(p => ({
                index: p.index,
                name: p.name,
                points: p.points || 0,
                rating: p.rating || 0
            }));
        } else if (contestDataFromRating && contestDataFromRating.problemResults) {
            const cnt = contestDataFromRating.problemResults.length;
            for (let i = 0; i < cnt; i++) {
                const idx = String.fromCharCode(65 + i);
                problemsList.push({
                    index: idx,
                    name: `Problem ${idx}`,
                    points: 0
                });
            }
        }
        if (problemsList.length === 0) {
            problemsList = [{ index: '?', name: '无法获取题目列表', points: 0 }];
        }
        
        const contestSubmissions = userSubmissions.filter(sub => 
            sub.problem && sub.problem.contestId === contestId
        );
        
        const subMap = new Map();
        contestSubmissions.forEach(sub => {
            const idx = sub.problem.index;
            const isOk = sub.verdict === 'OK';
            const time = sub.creationTimeSeconds || 0;
            if (!subMap.has(idx)) {
                subMap.set(idx, { ok: isOk, attempts: 1, bestTime: isOk ? time : 0 });
            } else {
                const cur = subMap.get(idx);
                cur.attempts++;
                if (isOk && (!cur.ok || time < cur.bestTime)) {
                    cur.ok = true;
                    cur.bestTime = time;
                }
            }
        });
        

        const solvedInContest = new Set(); 
        if (hasRow && userStanding && userStanding.problemResults) {
            userStanding.problemResults.forEach((res, idx) => {
                if (res.points > 0 && problemsList[idx]) {
                    solvedInContest.add(problemsList[idx].index);
                }
            });
        }
        
        let problemsHtml = '';
        for (let i = 0; i < problemsList.length; i++) {
            const prob = problemsList[i];
            const idx = prob.index;
            const sub = subMap.get(idx) || { ok: false, attempts: 0, bestTime: 0 };
            const ok = sub.ok;
            const attempts = sub.attempts;
            const bestSec = sub.bestTime;
            
            // 判断状态
            let statusIcon = '⚪';
            let statusColor = '#666';
            let statusText = '未尝试';
            let extraClass = '';
            let pointsDisplay = prob.points || '?';
            
            if (ok) {
                const isContest = solvedInContest.has(idx);
                if (isContest && hasRow) {
                    const pointVal = (userStanding && userStanding.problemResults && userStanding.problemResults[i]) 
                                   ? (userStanding.problemResults[i].points || 0) : 0;
                    pointsDisplay = pointVal > 0 ? `${pointVal} 分` : '通过';
                    statusIcon = '✅';
                    statusColor = '#28a745';
                    statusText = '比赛中通过';
                    extraClass = '';
                } else {
                    // 补题通过
                    pointsDisplay = '补题通过';
                    statusIcon = '🔄';
                    statusColor = '#ffc107';
                    statusText = '补题通过';
                    extraClass = 'problem-vp';
                }
            } else if (attempts > 0) {
                statusIcon = '❌';
                statusColor = '#dc3545';
                statusText = '未通过';
                extraClass = 'problem-unsolved';
            }
            
            // 时间格式化
            let timeStr = '';
            if (ok && bestSec > 0) {
                const mins = Math.floor(bestSec / 60);
                const secs = bestSec % 60;
                timeStr = ` (${mins}:${secs.toString().padStart(2, '0')})`;
            }
            
            problemsHtml += `
                <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; ${extraClass ? `background-color: ${extraClass === 'problem-vp' ? '#fff3cd' : '#f8d7da'};` : ''}">
                    <div style="width: 40px; font-weight: bold; color: ${statusColor};">${statusIcon}</div>
                    <div style="width: 60px; font-weight: bold;">${prob.index}</div>
                    <div style="flex: 1;">${this.escapeHtml(prob.name)}</div>
                    <div style="width: 100px; text-align: center;">${pointsDisplay}</div>
                    <div style="width: 140px; text-align: center; color: ${statusColor};">
                        ${!ok && attempts > 0 ? ` (尝试 ${attempts} 次)` : ''}
                    </div>
                </div>
            `;
        }
        
        let rank = '?';
        let points = 0;
        let penalty = 0;
        let solvedTotal = 0;
        if (hasRow && userStanding) {
            rank = userStanding.rank;
            points = userStanding.points || 0;
            penalty = userStanding.penalty || 0;
            solvedTotal = userStanding.problemResults.filter(r => r.points > 0).length;
        } else if (contestDataFromRating) {
            rank = contestDataFromRating.rank;

        }

        const solvedAfter = Array.from(subMap.entries())
            .filter(([idx, sub]) => sub.ok && !solvedInContest.has(idx)).length;
        const totalSolved = (hasRow ? solvedTotal : 0) + solvedAfter;
        
        // 数据来源提示
        let sourceMsg = '';
        if (hasRow) {
            sourceMsg = `<div style="font-size: 12px; color: #28a745; margin-bottom: 10px;">✓ 数据来源：比赛排名 API（含详细排名）</div>`;
        } else {
            sourceMsg = `<div style="font-size: 12px; color: #ffc107; margin-bottom: 10px;">
                <i class="fas fa-exclamation-triangle"></i> 数据来源：user.contest API（无详细排名）
                <br><a href="https://codeforces.com/contest/${contestId}/standings" target="_blank" style="color: #007bff;">点击查看官方完整排名</a>
            </div>`;
        }
        
        const modalContent = `
            <div style="max-height: 70vh; overflow-y: auto;">
                ${sourceMsg}
                <!-- 概要 -->
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-around; text-align: center;">
                        <div><div style="font-size:12px;color:#666;">排名</div><div style="font-size:24px;font-weight:bold;">#${rank}</div></div>
                        <div><div style="font-size:12px;color:#666;">总分</div><div style="font-size:24px;font-weight:bold;">${points}</div></div>
                        <div><div style="font-size:12px;color:#666;">解题数</div><div style="font-size:24px;font-weight:bold;">
                            ${totalSolved}/${problemsList.length}
                            ${solvedAfter > 0 ? `<span style="font-size:14px;color:#ffc107;"> (赛后补 ${solvedAfter})</span>` : ''}
                        </div></div>
                    </div>
                </div>
                <!-- 题目表 -->
                <div style="border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;">
                    <div style="background:#f0f0f0; padding:12px; font-weight:bold; border-bottom:1px solid #e0e0e0;">
                        📋 题目提交详情
                    </div>
                    ${problemsHtml}
                </div>
                <!-- 链接 -->
                <div style="margin-top:20px; text-align:center;">
                    <a href="https://codeforces.com/contest/${contestId}" target="_blank" 
                       style="display:inline-block; padding:8px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px; margin-right:10px;">
                        📊 比赛原站
                    </a>
                    <a href="https://codeforces.com/contest/${contestId}/standings" target="_blank" 
                       style="display:inline-block; padding:8px 20px; background:#28a745; color:white; text-decoration:none; border-radius:5px; margin-right:10px;">
                        🏆 完整排名
                    </a>
                    <button class="modal-close-btn" style="padding:8px 20px; background:#6c757d; color:white; border:none; border-radius:5px; cursor:pointer;">关闭</button>
                </div>
            </div>
        `;
        
        this.showModal(modalContent, `${contestName} - 详细数据`);
    }
    
    showModal(content, title) {
        this.closeModal();
        const modal = document.createElement('div');
        modal.id = this.modalId;
        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:10000; backdrop-filter:blur(3px);`;
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `background:white; border-radius:12px; padding:24px; max-width:800px; width:90%; max-height:85vh; overflow-y:auto; box-shadow:0 4px 20px rgba(0,0,0,0.3);`;
        modalContent.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:2px solid #e0e0e0; padding-bottom:12px;">
            <h3 style="margin:0; font-size:20px;">${this.escapeHtml(title)}</h3>
            <button class="modal-close-btn" style="background:none; border:none; font-size:24px; cursor:pointer; color:#666;">&times;</button>
        </div>${content}`;
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModal(); });
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) closeBtn.onclick = () => this.closeModal();
    }
    
    closeModal() {
        const existing = document.getElementById(this.modalId);
        if (existing) existing.remove();
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
    const contestDetailManager = new ContestDetailManager();
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

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
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
        //console.log('获取后续比赛数据...');
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
                    <div class="contest-card" 
                        data-contest-id="${c.contestId}" 
                        data-contest-name="${escapeHtml(c.contestName)}"
                        data-contest-rank="${c.rank}"
                        style="cursor: pointer;">
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
        
        // 获取当前时间戳（秒）
        const now = Math.floor(Date.now() / 1000);
        let cutoffTime = 0;
        
        // 根据选择的 range 设置截止时间
        switch (range) {
            case 'year':
                cutoffTime = now - 365 * 24 * 3600;
                break;
            case '180d':
                cutoffTime = now - 180 * 24 * 3600;
                break;
            case 'month':
                cutoffTime = now - 30 * 24 * 3600;
                break;
            default:
                cutoffTime = 0;
        }
        
        // 收集通过的题目（按时间筛选）
        const uniqueProblems = new Map();
        currentSubmissions.forEach(s => {
            if (s && s.verdict === 'OK' && s.problem) {
                if (cutoffTime > 0 && (!s.creationTimeSeconds || s.creationTimeSeconds < cutoffTime)) {
                    return;
                }
                
                const key = `${s.problem.contestId}|${s.problem.index}`;
                if (!uniqueProblems.has(key)) {
                    uniqueProblems.set(key, s.problem.rating || 0);
                }
            }
        });
        
        if (uniqueProblems.size === 0) {
            chartHistogram.setOption({ 
                title: { text: '该时间段内无通过题目', left: 'center', top: 'center' } 
            });
            return;
        }
        
        const ratings = Array.from(uniqueProblems.values());
        const withRating = ratings.filter(r => r > 0);
        const withoutRating = ratings.filter(r => r === 0);
        
        // 难度分桶
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
        
        // 计算总题目数
        const totalProblems = Object.values(buckets).reduce((a, b) => a + b, 0);
        
        // 生成标题（带上总题目数）
        let titleText = `通过题目难度分布 (共 ${totalProblems} 题)`;
        switch (range) {
            case 'year':
                titleText = `通过题目难度分布 - 近一年 (共 ${totalProblems} 题)`;
                break;
            case '180d':
                titleText = `通过题目难度分布 - 近180天 (共 ${totalProblems} 题)`;
                break;
            case 'month':
                titleText = `通过题目难度分布 - 近1个月 (共 ${totalProblems} 题)`;
                break;
            default:
                titleText = `通过题目难度分布 - 全部 (共 ${totalProblems} 题)`;
        }
        
        chartHistogram.setOption({
            title: { text: titleText, left: 'center' },
            tooltip: { trigger: 'axis' },
            xAxis: { data: Object.keys(buckets), axisLabel: { rotate: 45 } },
            yAxis: { name: '题目数量' },
            series: [{
                type: 'bar',
                data: Object.values(buckets),
                itemStyle: { color: (p) => p.dataIndex === 0 ? '#f59e0b' : '#3b82f6' },
                label: { 
                    show: true, 
                    position: 'top',
                    formatter: (params) => params.value > 0 ? params.value : ''
                }
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
        renderContestsTable();
        document.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(bb => bb.classList.remove('active'));
            b.classList.add('active');
            renderHistogram(b.dataset.range);
        }));
    }

    // 绑定比赛卡片点击事件
    contestsWrapper.addEventListener('click', (e) => {
        const card = e.target.closest('.contest-card');
        if (!card) return;
        
        const contestId = card.dataset.contestId;
        const contestName = card.dataset.contestName;
        
        if (contestId && contestName && currentUser && currentUser.handle) {
            // 找到对应的比赛数据（来自 rating API）
            const contestData = currentContests.find(c => c.contestId === parseInt(contestId));
            
            contestDetailManager.showContestDetails(
                parseInt(contestId), 
                contestName, 
                currentUser.handle,
                contestData,      // 传入比赛数据（来自 user.rating）
                currentSubmissions // 传入用户提交记录（用于判断补题）
            );
        }
    });
        
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