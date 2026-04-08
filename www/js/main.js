// Codeforces 查题助手 - 主要逻辑

// DOM 元素
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const problemSection = document.getElementById('problemSection');
const loaderWrapper = document.getElementById('loaderWrapper');
const toastMessage = document.getElementById('toastMessage');
const toastText = document.getElementById('toastText');

// 主题切换
const themeToggle = document.querySelector('.theme-toggle');
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// 初始化主题
function initTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    initTheme();
    showToast(`已切换到${isDarkMode ? '暗色' : '亮色'}模式`);
});

initTheme();

// 隐藏加载器
setTimeout(() => {
    loaderWrapper.classList.add('hide');
    setTimeout(() => {
        loaderWrapper.style.display = 'none';
    }, 300);
}, 500);

// 显示 Toast
function showToast(message, duration = 2000) {
    toastText.textContent = message;
    toastMessage.classList.add('show');
    setTimeout(() => {
        toastMessage.classList.remove('show');
    }, duration);
}

// 显示错误
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// 隐藏错误
function hideError() {
    errorMessage.style.display = 'none';
}

// 解析题目 ID
function parseProblemId(input) {
    input = input.trim();
    
    // 如果是 URL
    const urlPattern = /codeforces\.com\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/;
    const match = input.match(urlPattern);
    if (match) {
        return `${match[1]}${match[2]}`;
    }
    
    // 直接输入 ID
    if (/^\d+[A-Za-z0-9]+$/i.test(input)) {
        return input.toUpperCase();
    }
    
    return null;
}

// 获取题目信息
async function fetchProblemInfo(contestId, problemIndex) {
    const apiUrl = `https://codeforces.com/api/problemset.problems`;
    
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status !== 'OK') {
            throw new Error('API 请求失败');
        }
        
        const problem = data.result.problems.find(
            p => p.contestId == contestId && p.index === problemIndex
        );
        
        if (!problem) {
            throw new Error('未找到题目');
        }
        
        // 获取题目通过数
        let solvedCount = 0;
        if (data.result.problemStatistics) {
            const stats = data.result.problemStatistics.find(
                s => s.contestId == contestId && s.index === problemIndex
            );
            solvedCount = stats ? stats.solvedCount : 0;
        }
        
        return {
            contestId: problem.contestId,
            index: problem.index,
            name: problem.name,
            rating: problem.rating || '暂无',
            tags: problem.tags || [],
            solvedCount: solvedCount,
            url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
        };
    } catch (error) {
        console.error('获取题目信息失败:', error);
        throw error;
    }
}

// 获取题解（模拟数据，实际可以从本地或第三方 API 获取）
function getSolution(problemId) {
    const solutions = {
        '4A': {
            text: '这是一个经典的水题。判断西瓜的重量是否为偶数且大于2即可。因为要分成两个偶数部分，所以重量必须能被2整除，且不能是2（因为2只能分成1和1，都是奇数）。',
            complexity: '时间复杂度: O(1)，空间复杂度: O(1)'
        },
        '1850A': {
            text: '题目要求判断三个数中是否有两个数的和大于等于10。直接两两相加判断即可。',
            complexity: '时间复杂度: O(1)，空间复杂度: O(1)'
        }
    };
    
    return solutions[problemId] || {
        text: '这是一道 Codeforces 题目。建议先理解题意，然后思考解题思路。通常可以从暴力解法开始，再考虑优化。',
        complexity: '时间复杂度: 根据具体解法而定，空间复杂度: 根据具体解法而定'
    };
}

// 获取参考代码
function getCode(problemId, language) {
    const codes = {
        '4A': {
            cpp: `#include <iostream>
using namespace std;

int main() {
    int w;
    cin >> w;
    
    if (w % 2 == 0 && w > 2) {
        cout << "YES" << endl;
    } else {
        cout << "NO" << endl;
    }
    
    return 0;
}`,
            python: `w = int(input())

if w % 2 == 0 and w > 2:
    print("YES")
else:
    print("NO")`,
            java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int w = sc.nextInt();
        
        if (w % 2 == 0 && w > 2) {
            System.out.println("YES");
        } else {
            System.out.println("NO");
        }
        
        sc.close();
    }
}`
        },
        '1850A': {
            cpp: `#include <iostream>
using namespace std;

int main() {
    int t;
    cin >> t;
    
    while (t--) {
        int a, b, c;
        cin >> a >> b >> c;
        
        if (a + b >= 10 || a + c >= 10 || b + c >= 10) {
            cout << "YES" << endl;
        } else {
            cout << "NO" << endl;
        }
    }
    
    return 0;
}`,
            python: `t = int(input())

for _ in range(t):
    a, b, c = map(int, input().split())
    
    if a + b >= 10 or a + c >= 10 or b + c >= 10:
        print("YES")
    else:
        print("NO")`,
            java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int t = sc.nextInt();
        
        while (t-- > 0) {
            int a = sc.nextInt();
            int b = sc.nextInt();
            int c = sc.nextInt();
            
            if (a + b >= 10 || a + c >= 10 || b + c >= 10) {
                System.out.println("YES");
            } else {
                System.out.println("NO");
            }
        }
        
        sc.close();
    }
}`
        }
    };
    
    const problemCode = codes[problemId];
    if (problemCode && problemCode[language]) {
        return problemCode[language];
    }
    
    return `// ${problemId} 的 ${language.toUpperCase()} 代码示例
// 请根据题目要求编写代码
    
#include <iostream>
using namespace std;

int main() {
    // 在这里编写你的代码
    cout << "Hello Codeforces!" << endl;
    return 0;
}`;
}

// 获取相似题目
function getSimilarProblems(problemId) {
    const similar = {
        '4A': [
            { id: '71A', name: 'Way Too Long Words', rating: 800 },
            { id: '231A', name: 'Team', rating: 800 },
            { id: '158A', name: 'Next Round', rating: 800 }
        ],
        '1850A': [
            { id: '1850B', name: 'Ten Words of Wisdom', rating: 800 },
            { id: '1850C', name: 'Word on the Paper', rating: 800 }
        ]
    };
    
    return similar[problemId] || [
        { id: '4A', name: 'Watermelon', rating: 800 },
        { id: '71A', name: 'Way Too Long Words', rating: 800 }
    ];
}

// 渲染题目信息
function renderProblemInfo(problem) {
    document.getElementById('problemId').textContent = `${problem.contestId}${problem.index}`;
    document.getElementById('problemTitle').textContent = problem.name;
    document.getElementById('problemRating').innerHTML = `<i class="fas fa-chart-line"></i> 难度: ${problem.rating}`;
    document.getElementById('problemTags').innerHTML = `<i class="fas fa-tags"></i> 标签: ${problem.tags.slice(0, 5).join(', ')}`;
    document.getElementById('problemSolved').innerHTML = `<i class="fas fa-users"></i> 通过数: ${problem.solvedCount.toLocaleString()}`;
    
    // 模拟题目描述（实际可以从网页抓取）
    const statementDiv = document.getElementById('problemStatement');
    statementDiv.innerHTML = `
        <p>题目编号: ${problem.contestId}${problem.index}</p>
        <p>题目名称: ${problem.name}</p>
        <p>题目链接: <a href="${problem.url}" target="_blank">${problem.url}</a></p>
        <p style="margin-top: 16px;">点击上方链接查看完整题目描述。由于 API 限制，完整题目内容请访问 Codeforces 官网。</p>
    `;
    
    document.getElementById('inputSpec').innerHTML = '<p>请参考原题链接中的输入格式说明。</p>';
    document.getElementById('outputSpec').innerHTML = '<p>请参考原题链接中的输出格式说明。</p>';
    
    // 模拟示例
    const examplesDiv = document.getElementById('examples');
    examplesDiv.innerHTML = `
        <div class="example-item">
            <div class="example-title">示例 1</div>
            <div class="example-input"><strong>输入:</strong><pre>示例输入</pre></div>
            <div class="example-output"><strong>输出:</strong><pre>示例输出</pre></div>
        </div>
        <div class="example-item">
            <div class="example-title">示例 2</div>
            <div class="example-input"><strong>输入:</strong><pre>示例输入</pre></div>
            <div class="example-output"><strong>输出:</strong><pre>示例输出</pre></div>
        </div>
    `;
    
    // 题解
    const solution = getSolution(`${problem.contestId}${problem.index}`);
    document.getElementById('solutionText').innerHTML = `<p>${solution.text}</p>`;
    document.getElementById('complexity').innerHTML = `<p>${solution.complexity}</p>`;
    
    // 代码（默认 C++）
    window.currentProblemId = `${problem.contestId}${problem.index}`;
    window.currentLanguage = 'cpp';
    document.getElementById('codeContent').textContent = getCode(window.currentProblemId, 'cpp');
    
    // 相似题目
    const similarProblems = getSimilarProblems(`${problem.contestId}${problem.index}`);
    const similarDiv = document.getElementById('similarProblems');
    similarDiv.innerHTML = similarProblems.map(p => `
        <div class="similar-item" onclick="searchProblem('${p.id}')">
            <div class="similar-id">${p.id}</div>
            <div class="similar-name">${p.name}</div>
            <div class="similar-rating">难度: ${p.rating}</div>
        </div>
    `).join('');
}

// 语言切换
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.currentLanguage = btn.dataset.lang;
        document.getElementById('codeContent').textContent = getCode(window.currentProblemId, window.currentLanguage);
    });
});

// 复制代码
document.getElementById('copyCodeBtn').addEventListener('click', () => {
    const code = document.getElementById('codeContent').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('代码已复制到剪贴板');
    }).catch(() => {
        showToast('复制失败，请手动复制');
    });
});

// 标签页切换
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}Tab`).classList.add('active');
    });
});

// 搜索题目
async function searchProblem(problemId) {
    const parsedId = parseProblemId(problemId);
    
    if (!parsedId) {
        showError('请输入正确的题目ID或URL');
        return;
    }
    
    hideError();
    problemSection.style.display = 'none';
    showToast('正在搜索题目...');
    
    // 解析 contestId 和 index
    const match = parsedId.match(/(\d+)([A-Za-z0-9]+)/);
    if (!match) {
        showError('题目ID格式错误');
        return;
    }
    
    const contestId = parseInt(match[1]);
    const problemIndex = match[2];
    
    try {
        const problem = await fetchProblemInfo(contestId, problemIndex);
        renderProblemInfo(problem);
        problemSection.style.display = 'block';
        
        // 保存到历史记录
        saveToHistory(parsedId);
        
        showToast(`成功加载题目 ${parsedId}`);
    } catch (error) {
        showError(`加载失败: ${error.message}`);
        console.error(error);
    }
}

// 历史记录管理
function saveToHistory(problemId) {
    let history = JSON.parse(localStorage.getItem('cf_history') || '[]');
    history = [problemId, ...history.filter(id => id !== problemId)];
    history = history.slice(0, 10);
    localStorage.setItem('cf_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('cf_history') || '[]');
    const historyList = document.getElementById('historyList');
    
    if (history.length === 0) {
        historyList.innerHTML = '<div style="color: var(--text-secondary);">暂无搜索记录</div>';
        return;
    }
    
    historyList.innerHTML = history.map(id => `
        <div class="history-item" onclick="searchProblem('${id}')">${id}</div>
    `).join('');
}

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    localStorage.removeItem('cf_history');
    renderHistory();
    showToast('历史记录已清空');
});

// 示例按钮点击
document.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        searchInput.value = id;
        searchProblem(id);
    });
});

// 搜索按钮点击
searchBtn.addEventListener('click', () => {
    const input = searchInput.value;
    if (input) {
        searchProblem(input);
    }
});

// 回车搜索
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const input = searchInput.value;
        if (input) {
            searchProblem(input);
        }
    }
});

// 暴露全局函数
window.searchProblem = searchProblem;

// 渲染历史记录
renderHistory();

// 控制台输出
console.log('%c✨ Codeforces 查题助手已启动 ✨', 'color: #1890ff; font-size: 16px; font-weight: bold;');
console.log('%c输入题目ID开始查询吧！', 'color: #52c41a; font-size: 14px;');