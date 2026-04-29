document.addEventListener('DOMContentLoaded', () => {

    // ── CONFIG ───────────────────────────────────────────────────────────────
    const API = 'https://cool-the-globe-api.onrender.com/api'; // Point explicitly to the live backend

    // ── HELPERS ──────────────────────────────────────────────────────────────
    const getToken = () => localStorage.getItem('ctg_token');
    const setToken = (t) => localStorage.setItem('ctg_token', t);
    const clearToken = () => localStorage.removeItem('ctg_token');

    async function apiFetch(path, options = {}) {
        const token = getToken();
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API}${path}`, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────
    // Returns YYYY-MM-DD using LOCAL timezone (toISOString uses UTC which breaks in IST etc.)
    function localDateKey(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    // ── STATE ────────────────────────────────────────────────────────────────
    const state = { user: null };
    let chartInstance = null;

    // ── DOM REFS ─────────────────────────────────────────────────────────────
    const landingSection  = document.getElementById('landing-section');
    const authSection     = document.getElementById('auth-section');
    const mainNav         = document.getElementById('main-nav');
    const mainHeader      = document.getElementById('main-header');

    const navBtns = {
        calculator:  document.getElementById('nav-calculator'),
        dashboard:   document.getElementById('nav-dashboard'),
        leaderboard: document.getElementById('nav-leaderboard'),
        settings:    document.getElementById('nav-settings'),
        rewards:     document.getElementById('nav-rewards'),
    };
    const sections = {
        calculator:  document.getElementById('calculator-section'),
        dashboard:   document.getElementById('dashboard-section'),
        leaderboard: document.getElementById('leaderboard-section'),
        settings:    document.getElementById('settings-section'),
        rewards:     document.getElementById('rewards-section'),
    };
    const authForm      = document.getElementById('auth-form');
    const authError     = document.getElementById('auth-error');
    const authSpinner   = document.getElementById('auth-spinner');
    const authBtnText   = document.getElementById('auth-btn-text');
    const calculateBtn  = document.getElementById('calculate-btn');
    const leaderboardList = document.getElementById('leaderboard-list');

    // ── LANDING ───────────────────────────────────────────────────────────────
    const viewBriefingBtn = document.getElementById('view-briefing-btn');

    if (viewBriefingBtn) {
        viewBriefingBtn.addEventListener('click', () => {
            document.getElementById('how-to-calculate').scrollIntoView({ behavior: 'smooth' });
        });
    }

    document.getElementById('get-started-btn').addEventListener('click', () => {
        if (state.user) {
            // Already logged in — go straight to calculator
            switchView('calculator');
        } else {
            landingSection.classList.add('hidden');
            authSection.classList.remove('hidden');
            authSection.classList.add('fade-in');
        }
    });

    // ── AUTH TABS ─────────────────────────────────────────────────────────────
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const tabLoginBtn    = document.getElementById('tab-login-btn');
    const nameField      = document.getElementById('name-field');
    const authNameInput  = document.getElementById('auth-name');

    tabRegisterBtn.addEventListener('click', () => {
        tabRegisterBtn.classList.add('active');
        tabLoginBtn.classList.remove('active');
        authForm.dataset.mode = 'register';
        nameField.classList.remove('hidden');
        authNameInput.required = true;
        authBtnText.textContent = 'Create Account & Continue';
        authError.classList.add('hidden');
    });

    tabLoginBtn.addEventListener('click', () => {
        tabLoginBtn.classList.add('active');
        tabRegisterBtn.classList.remove('active');
        authForm.dataset.mode = 'login';
        nameField.classList.add('hidden');
        authNameInput.required = false;
        authBtnText.textContent = 'Sign In';
        authError.classList.add('hidden');
    });

    // ── AUTH SUBMIT ───────────────────────────────────────────────────────────
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');
        authSpinner.classList.remove('hidden');
        authBtnText.textContent = authForm.dataset.mode === 'register' ? 'Creating...' : 'Signing in...';

        const email    = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const name     = authNameInput.value.trim();

        try {
            let data;
            if (authForm.dataset.mode === 'register') {
                if (!name) throw new Error('Please enter your full name.');
                data = await apiFetch('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ name, email, password }),
                });
            } else {
                data = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password }),
                });
            }
            setToken(data.token);
            state.user = data.user;
            enterApp();
        } catch (err) {
            showAuthError(err.message);
        } finally {
            authSpinner.classList.add('hidden');
            authBtnText.textContent = authForm.dataset.mode === 'register' ? 'Create Account & Continue' : 'Sign In';
        }
    });

    function showAuthError(msg) {
        authError.textContent = msg;
        authError.classList.remove('hidden');
    }

    function enterApp() {
        authSection.classList.add('hidden');
        mainNav.classList.remove('hidden');
        mainHeader.classList.remove('hidden');
        document.getElementById('chatbot-widget').classList.remove('hidden');
        authForm.reset();
        switchView('calculator');
    }

    // ── AUTO-LOGIN (persisted token) ──────────────────────────────────────────
    (async () => {
        if (!getToken()) return;
        try {
            state.user = await apiFetch('/users/me');
            // Keep landing page & nav hidden — nav shows when user navigates into app
        } catch (_) {
            clearToken();
        }
    })();

    // ── LOGOUT ────────────────────────────────────────────────────────────────
    const navLogout = document.getElementById('nav-logout');
    if (navLogout) {
        navLogout.addEventListener('click', () => {
            clearToken();
            state.user = null;
            mainNav.classList.add('hidden');
            mainHeader.classList.add('hidden');
            document.getElementById('chatbot-widget').classList.add('hidden');
            Object.values(sections).forEach(s => s.classList.add('hidden'));
            landingSection.classList.remove('hidden');
        });
    }
    // ── NAVIGATION ────────────────────────────────────────────────────────────
    function switchView(viewName) {
        // Hide landing page when navigating to any app section
        landingSection.classList.add('hidden');
        // Show nav and chatbot (hidden on landing page)
        mainNav.classList.remove('hidden');
        document.getElementById('chatbot-widget').classList.remove('hidden');
        // Only show the main header on calculator & dashboard
        if (viewName === 'calculator' || viewName === 'dashboard') {
            mainHeader.classList.remove('hidden');
        } else {
            mainHeader.classList.add('hidden');
        }
        Object.values(sections).forEach(s => s.classList.add('hidden'));
        Object.values(navBtns).forEach(b => b.classList.remove('active'));
        if (sections[viewName]) {
            sections[viewName].classList.remove('hidden');
            sections[viewName].classList.add('fade-in');
        }
        if (navBtns[viewName]) navBtns[viewName].classList.add('active');

        if (viewName === 'leaderboard') renderLeaderboard();
        if (viewName === 'settings')    renderSettings();
        if (viewName === 'rewards')     renderRewards();
    }
    Object.keys(navBtns).forEach(key => navBtns[key].addEventListener('click', () => switchView(key)));

    // ── CALCULATOR TABS ───────────────────────────────────────────────────────
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    // ── COUNT-UP ANIMATION ────────────────────────────────────────────────────
    function animateValue(el, start, end, duration) {
        let startTs = null;
        const step = (ts) => {
            if (!startTs) startTs = ts;
            const p = Math.min((ts - startTs) / duration, 1);
            el.innerHTML = (p * (end - start) + start).toFixed(1);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    // ── FOOTPRINT CALCULATION + SAVE ──────────────────────────────────────────
    async function calculateFootprint() {
        const carKm      = parseFloat(document.getElementById('car-usage').value) || 0;
        const publicKm   = parseFloat(document.getElementById('public-usage').value) || 0;
        const flightHrs  = parseFloat(document.getElementById('flights-usage').value) || 0;
        const acHrs      = parseFloat(document.getElementById('ac-usage').value) || 0;
        const elecBill   = parseFloat(document.getElementById('electricity-bill').value) || 0;
        const showerMins = parseFloat(document.getElementById('showers-usage').value) || 0;
        const diet       = document.querySelector('input[name="diet"]:checked').value;
        const recycle    = document.getElementById('recycle-toggle').checked;
        const compost    = document.getElementById('compost-toggle').checked;

        // Local calculation for instant UI
        const transportTotal = (carKm * 0.192) + (publicKm * 0.04) + ((flightHrs * 250) / 365);
        const energyTotal    = (acHrs * 1.5 * 0.85) + ((elecBill / 0.15) / 30 * 0.85);
        const dietMap = { vegan: 2, vegetarian: 3.5, omnivore: 5, 'meat-heavy': 7.5 };
        const foodDaily  = dietMap[diet] ?? 5;
        let wasteDaily   = 1.2;
        if (recycle) wasteDaily -= 0.4;
        if (compost)  wasteDaily -= 0.3;
        const waterDaily  = showerMins * 0.05;
        const totalDaily  = transportTotal + energyTotal + foodDaily + wasteDaily + waterDaily;
        const annualTons  = (totalDaily * 365) / 1000;

        renderDashboard({
            total: totalDaily, annual: annualTons,
            categories: { Transport: transportTotal, Energy: energyTotal, Food: foodDaily, Waste: wasteDaily, Water: waterDaily },
            flags: { carKm, acHrs, dietSelected: diet, recycle, showerMins },
        });
        switchView('dashboard');

        // Save today's footprint to localStorage for rewards streak view
        const todayKey = localDateKey(new Date());
        const history = JSON.parse(localStorage.getItem('ctg_daily_footprint') || '{}');
        history[todayKey] = parseFloat(totalDaily.toFixed(2));
        localStorage.setItem('ctg_daily_footprint', JSON.stringify(history));

        // Save to backend (non-blocking)
        try {
            await apiFetch('/footprint', {
                method: 'POST',
                body: JSON.stringify({
                    transport: { carKm, publicKm, flightHrs },
                    energy:    { acHrs, electricityBill: elecBill },
                    food:      { diet },
                    waste:     { recycle, compost },
                    water:     { showerMins },
                }),
            });
            if (state.user) state.user.latestFootprint = parseFloat(totalDaily.toFixed(2));
        } catch (err) {
            console.warn('Footprint save failed:', err.message);
        }
    }

    calculateBtn.addEventListener('click', calculateFootprint);

    // ── DASHBOARD RENDER ──────────────────────────────────────────────────────
    function renderDashboard({ total, annual, categories, flags }) {
        animateValue(document.getElementById('total-co2'), 0, total, 1500);
        document.getElementById('annual-co2').textContent = annual.toFixed(2);

        const cmpMsg = document.getElementById('user-comparison');
        if (total < 10)      cmpMsg.innerHTML = '<i class="fa-solid fa-leaf"></i> Excellent! Below average.';
        else if (total > 20) cmpMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Above average.';
        else                 cmpMsg.innerHTML = '<i class="fa-solid fa-check"></i> Standard footprint. You can improve.';

        const suggestionsList = document.getElementById('suggestions-list');
        const aiLoading = document.getElementById('ai-loading');
        suggestionsList.innerHTML = '';
        if (aiLoading) aiLoading.classList.remove('hidden');

        EcoMind.generateSuggestions(flags).then(tips => {
            if (aiLoading) aiLoading.classList.add('hidden');
            suggestionsList.innerHTML = tips.map(t => `<li><i class="fa-solid ${t.icon}"></i> ${t.text}</li>`).join('');
        });

        const ctx = document.getElementById('emissionsChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Transport', 'Energy', 'Food', 'Waste', 'Water'],
                datasets: [{
                    data: [categories.Transport, categories.Energy, categories.Food, categories.Waste, categories.Water],
                    backgroundColor: ['#3498db', '#f1c40f', '#1ab05a', '#95a5a6', '#34e8eb'],
                    borderWidth: 0, hoverOffset: 4,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { font: { family: "'Outfit'", size: 14 } } } },
                cutout: '65%',
            },
        });
    }

    // ── LEADERBOARD ───────────────────────────────────────────────────────────
    let currentLbMode = 'friends';

    document.querySelectorAll('.lb-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.lb-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLbMode = btn.dataset.lb;
            renderLeaderboard();
        });
    });

    async function renderLeaderboard() {
        leaderboardList.innerHTML = '<p style="text-align:center;color:#aaa;padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</p>';
        try {
            const ranked = await apiFetch(`/leaderboard/${currentLbMode}`);
            if (!ranked.length) {
                leaderboardList.innerHTML = '<p style="text-align:center;color:#777;padding:2rem;">No data yet. Add friends and calculate your footprint!</p>';
                return;
            }
            leaderboardList.innerHTML = ranked.map((person, index) => {
                let rankClass = '', iconClass = 'fa-medal';
                if (index === 0)      { rankClass = 'gold';   iconClass = 'fa-trophy'; }
                else if (index === 1) { rankClass = 'silver'; }
                else if (index === 2) { rankClass = 'bronze'; }

                const footprintDisplay = person.latestFootprint !== null
                    ? `${person.latestFootprint.toFixed(1)} <span>kg CO₂</span>`
                    : '<span style="color:#888">No data</span>';

                const ecoScoreBadge = person.ecoScore !== null
                    ? `<span class="eco-score-badge" title="Eco Score">🌿 ${person.ecoScore}</span>` : '';

                return `
                <div class="leaderboard-item ${person.isMe ? 'current-user' : ''}">
                    <div class="rank ${rankClass}"><i class="fa-solid ${iconClass}"></i> ${person.rank ?? '-'}</div>
                    <div class="player-info">
                        <div class="player-name">
                            ${person.name}
                            ${person.isMe ? '<span class="player-badge">Me</span>' : ''}
                        </div>
                        ${ecoScoreBadge}
                    </div>
                    <div class="player-score">${footprintDisplay}</div>
                </div>`;
            }).join('');
        } catch (err) {
            leaderboardList.innerHTML = `<p style="text-align:center;color:#e74c3c;padding:2rem;">${err.message}</p>`;
        }
    }

    // ── SETTINGS ──────────────────────────────────────────────────────────────
    async function renderSettings() {
        // Load profile
        try {
            const me = await apiFetch('/users/me');
            state.user = me;
            document.getElementById('profile-name-input').value = me.name || '';
            document.getElementById('profile-public-toggle').checked = me.isPublic !== false;
        } catch (_) {}

        // Load friends
        await renderFriendsList();
        // Load incoming requests
        await renderIncomingRequests();
    }

    async function renderFriendsList() {
        const contactsListUl = document.getElementById('contacts-list');
        contactsListUl.innerHTML = '<li style="color:#aaa; padding:0.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</li>';
        try {
            const friends = await apiFetch('/friends');
            if (!friends.length) {
                contactsListUl.innerHTML = '<li style="color:#777; padding:1rem; text-align:center;">No friends yet. Search and add some!</li>';
                return;
            }
            contactsListUl.innerHTML = friends.map(f => `
                <li class="contact-row">
                    <span class="c-name"><i class="fa-regular fa-user" style="color:#aaa;margin-right:8px;"></i>${f.name}</span>
                    <div>
                        <span class="c-score">${f.latestFootprint !== null ? f.latestFootprint.toFixed(1) + ' kg' : 'No data'}</span>
                        <button class="rm-btn" onclick="window.removeFriend('${f.id}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </li>
            `).join('');
        } catch (err) {
            contactsListUl.innerHTML = `<li style="color:#e74c3c; padding:1rem;">${err.message}</li>`;
        }
    }

    async function renderIncomingRequests() {
        const container = document.getElementById('incoming-requests-list');
        try {
            const requests = await apiFetch('/friends/requests/incoming');
            if (!requests.length) {
                container.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.9rem;">No pending requests.</p>';
                return;
            }
            container.innerHTML = requests.map(r => `
                <div class="friend-request-row">
                    <span><i class="fa-regular fa-user" style="margin-right:6px;"></i>${r.from?.name || 'Unknown'}</span>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="primary-btn" style="padding:0.3rem 0.8rem;font-size:0.8rem;" onclick="window.acceptRequest('${r.from?.id}')">Accept</button>
                        <button class="rm-btn" onclick="window.rejectRequest('${r.from?.id}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
            `).join('');
        } catch (_) {}
    }

    // User search
    document.getElementById('user-search-btn').addEventListener('click', async () => {
        const q = document.getElementById('user-search-input').value.trim();
        if (!q) return;
        const resultsEl = document.getElementById('user-search-results');
        resultsEl.innerHTML = '<p style="color:#aaa;"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</p>';
        try {
            const results = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
            if (!results.length) {
                resultsEl.innerHTML = '<p style="color:#777;font-size:0.9rem;">No users found.</p>';
                return;
            }
            resultsEl.innerHTML = results.map(u => `
                <div class="search-result-row">
                    <span><i class="fa-regular fa-user" style="margin-right:6px;"></i>${u.name}</span>
                    <button class="primary-btn" style="padding:0.3rem 0.9rem;font-size:0.8rem;" onclick="window.sendFriendRequest('${u.id}', this)">
                        Add Friend
                    </button>
                </div>
            `).join('');
        } catch (err) {
            resultsEl.innerHTML = `<p style="color:#e74c3c;font-size:0.9rem;">${err.message}</p>`;
        }
    });

    // Enter key for search
    document.getElementById('user-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('user-search-btn').click();
    });

    // Profile save
    document.getElementById('save-profile-btn').addEventListener('click', async () => {
        const name     = document.getElementById('profile-name-input').value.trim();
        const isPublic = document.getElementById('profile-public-toggle').checked;
        try {
            const updated = await apiFetch('/users/me', {
                method: 'PUT',
                body: JSON.stringify({ name, isPublic }),
            });
            state.user = updated.user;
            showToast('Profile saved!');
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // Exposed globals for inline onclick
    window.removeFriend = async (friendId) => {
        try {
            await apiFetch(`/friends/${friendId}`, { method: 'DELETE' });
            renderFriendsList();
        } catch (err) { showToast(err.message, true); }
    };

    window.sendFriendRequest = async (toUserId, btn) => {
        btn.disabled = true;
        btn.textContent = 'Sent!';
        try {
            await apiFetch('/friends/request', { method: 'POST', body: JSON.stringify({ toUserId }) });
            btn.textContent = '✓ Sent';
            btn.style.background = '#1ab05a';
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Add Friend';
            showToast(err.message, true);
        }
    };

    window.acceptRequest = async (fromUserId) => {
        try {
            await apiFetch('/friends/accept', { method: 'POST', body: JSON.stringify({ fromUserId }) });
            renderIncomingRequests();
            renderFriendsList();
            showToast('Friend added! 🎉');
        } catch (err) { showToast(err.message, true); }
    };

    window.rejectRequest = async (fromUserId) => {
        try {
            await apiFetch('/friends/reject', { method: 'POST', body: JSON.stringify({ fromUserId }) });
            renderIncomingRequests();
        } catch (err) { showToast(err.message, true); }
    };

    // ── TOAST NOTIFICATION ────────────────────────────────────────────────────
    function showToast(msg, isError = false) {
        const existing = document.getElementById('ctg-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'ctg-toast';
        toast.textContent = msg;
        toast.style.cssText = `
            position:fixed; bottom:2rem; left:50%; transform:translateX(-50%);
            background:${isError ? '#c0392b' : '#1ab05a'}; color:#fff;
            padding:0.75rem 1.5rem; border-radius:2rem; font-family:'Outfit',sans-serif;
            font-size:0.95rem; z-index:9999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
            animation: fadeInUp 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ── ECOMIND AI (local) ────────────────────────────────────────────────────
    const EcoMind = {
        getAnswer(query) {
            query = query.toLowerCase();
            if (query.includes('health'))
                return "Carbon emissions increase harmful pollutants. This leads to <span class='highlight'>asthma</span>, <span class='highlight'>cardiovascular issues</span>, and premature death. Reducing your footprint directly improves air quality!";
            if (query.includes('environment') || query.includes('global warming') || query.includes('eco tips'))
                return "The environmental impact includes <span class='highlight'>rising temperatures</span>, extreme weather, melting ice caps, and ecosystem disruption. Every kg of CO₂ reduced helps stabilize our climate.";
            if (query.includes('footprint') || query.includes('co2') || query.includes('carbon'))
                return "Your carbon footprint is the total greenhouse gases generated by your actions. The global average is ~<span class='highlight'>4.7 tons/year</span>. Small changes in transport, diet, and energy have a massive cumulative effect!";
            if (query.includes('reduce') || query.includes('how'))
                return "Reduce your footprint by: using public transport, eating less meat, turning off unused appliances, and recycling/composting waste.";
            return "Great question! I'm specialized in environmental impacts of carbon footprints. Check your dashboard to see how your lifestyle affects the planet.";
        },
        generateSuggestions(flags) {
            return new Promise(resolve => {
                setTimeout(() => {
                    const tips = [];
                    if (flags.carKm > 20)
                        tips.push({ icon: 'fa-car', text: `Your daily driving (${flags.carKm}km) is significant. Carpooling or switching to transit 2 days/week can cut transport emissions by 40%.` });
                    if (flags.acHrs > 5)
                        tips.push({ icon: 'fa-fan', text: `AC for ${flags.acHrs} hours uses a lot of energy. Setting the thermostat 2°C higher saves up to 10% on energy.` });
                    if (flags.dietSelected === 'meat-heavy')
                        tips.push({ icon: 'fa-drumstick-bite', text: `A meat-heavy diet has a high carbon cost. Plant-based meals a couple of times/week could save ~1000kg CO₂/year.` });
                    else if (flags.dietSelected === 'vegan')
                        tips.push({ icon: 'fa-seedling', text: `Excellent vegan choice! Your diet alone avoids 1.5+ tons of CO₂ emissions annually.` });
                    if (!flags.recycle)
                        tips.push({ icon: 'fa-recycle', text: `A simple recycling habit can reduce your waste emissions by nearly 30%!` });
                    if (flags.showerMins > 15)
                        tips.push({ icon: 'fa-faucet-drip', text: `Reducing your shower to 10 mins saves both water and the energy used to heat it.` });
                    if (!tips.length)
                        tips.push({ icon: 'fa-star', text: `Your footprint is extremely optimized! Encourage your friends to adopt your practices.` });
                    resolve(tips);
                }, 1000);
            });
        },
    };

    // ── CHATBOT ───────────────────────────────────────────────────────────────
    const chatbotToggle = document.getElementById('chatbot-toggle');
    if (chatbotToggle) {
        const chatbotContainer = document.getElementById('chatbot-container');
        const chatbotClose     = document.getElementById('chatbot-close');
        const chatbotSendBtn   = document.getElementById('chatbot-send-btn');
        const chatbotInput     = document.getElementById('chatbot-input-field');
        const chatbotMessages  = document.getElementById('chatbot-messages');

        chatbotToggle.addEventListener('click', () => chatbotContainer.classList.remove('hidden'));
        chatbotClose.addEventListener('click',  () => chatbotContainer.classList.add('hidden'));

        document.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill');
            if (pill && pill.dataset.query) {
                chatbotInput.value = pill.dataset.query;
                handleChatbotSend();
            }
        });

        function addChatMessage(message, sender) {
            const wrapper = document.createElement('div');
            wrapper.className = `message-wrapper ${sender}-wrapper`;
            if (sender === 'ai') {
                const avatar = document.createElement('div');
                avatar.className = 'ai-avatar';
                avatar.innerHTML = '<i class="fa-solid fa-leaf"></i>';
                wrapper.appendChild(avatar);
            }
            const msg = document.createElement('div');
            msg.className = `message ${sender}-message`;
            msg.innerHTML = message;
            wrapper.appendChild(msg);
            chatbotMessages.appendChild(wrapper);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        }

        function handleChatbotSend() {
            const text = chatbotInput.value.trim();
            if (!text) return;
            addChatMessage(text, 'user');
            chatbotInput.value = '';
            setTimeout(() => addChatMessage(EcoMind.getAnswer(text), 'ai'), 600);
        }

        chatbotSendBtn.addEventListener('click', handleChatbotSend);
        chatbotInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChatbotSend(); });
    }

    // ── REWARDS SYSTEM ────────────────────────────────────────────────────────
    const rewardsState = {
        streak: 7,
        streakCoins: 14,
        reductionDays: 5,
        reductionCoins: 25,
        leaderboardWeeks: 2,
        leaderboardCoins: 14,
        get totalCoins() { return this.streakCoins + this.reductionCoins + this.leaderboardCoins; },
        friends: [
            { name: 'Alex "Carbon-Killer" Reed', saved: '12.4k kg', avatar: 'fa-user-ninja', rank: 1 },
            { name: 'S. Chen', saved: '10.1k kg', avatar: 'fa-user-astronaut', rank: 2 },
            { name: 'You', saved: '8.2k kg', avatar: 'fa-user', rank: 3, isMe: true },
            { name: 'Maria Lopez', saved: '6.5k kg', avatar: 'fa-user-graduate', rank: 4 },
            { name: 'Jake Wilson', saved: '4.1k kg', avatar: 'fa-user-tie', rank: 5 },
        ],
        coupons: [
            { threshold: 20, discount: '5% OFF', code: 'ECO5-GREEN-2026', desc: 'Eco-friendly store discount', tier: '\ud83e\udd49 Bronze' },
            { threshold: 50, discount: '15% OFF', code: 'SUSTAIN15-EARTH', desc: 'Sustainable brands discount', tier: '\ud83e\udd48 Silver' },
            { threshold: 100, discount: '30% OFF + Certificate', code: 'PLANET30-HERO', desc: 'Premium discount + carbon offset', tier: '\ud83e\udd47 Gold' },
        ],
    };

    function renderRewards() {
        const total = rewardsState.totalCoins;

        // Animate coin count
        const coinEl = document.getElementById('rewards-coin-count');
        animateValue(coinEl, 0, total, 1200);

        // Streak count
        const streakEl = document.getElementById('rewards-streak-count');
        streakEl.textContent = rewardsState.streak;

        // Streak dots — current week Mon→Sun in fixed order
        const dotsEl = document.getElementById('streak-dots');
        const history = JSON.parse(localStorage.getItem('ctg_daily_footprint') || '{}');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find this week's Monday
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon ... 6=Sat
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        const weekLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        dotsEl.innerHTML = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const key = localDateKey(date);
            const fp = history[key];
            const hasData = fp !== undefined;
            const isFuture = date > today;
            const label = date.toLocaleDateString('en', { weekday: 'short' });
            const stateClass = hasData ? 'calculated' : (isFuture ? 'inactive future' : 'active');
            return `<div class="streak-dot ${stateClass}"
                data-date="${key}" data-fp="${hasData ? fp : ''}" data-label="${label}"
                onclick="window.showDayFootprint(this)" title="${label} (${key})">${weekLetters[i]}</div>`;
        }).join('');

        // Earning breakdown
        document.getElementById('streak-coins').textContent = rewardsState.streakCoins;
        document.getElementById('reduction-coins').textContent = rewardsState.reductionCoins;
        document.getElementById('leaderboard-coins').textContent = rewardsState.leaderboardCoins;

        // Milestone progress
        const fillPct = Math.min((total / 100) * 100, 100);
        setTimeout(() => {
            document.getElementById('milestone-fill').style.width = fillPct + '%';
        }, 300);
        [20, 50, 100].forEach(threshold => {
            const marker = document.getElementById('marker-' + threshold);
            if (total >= threshold) marker.classList.add('unlocked');
            else marker.classList.remove('unlocked');
        });

        // Coupons
        const couponsList = document.getElementById('coupons-list');
        couponsList.innerHTML = rewardsState.coupons.map(c => {
            const unlocked = total >= c.threshold;
            return `
                <div class="coupon-item ${unlocked ? '' : 'locked'}">
                    <div class="coupon-info">
                        <span class="coupon-tier">${c.tier}</span>
                        <span class="coupon-discount">${c.discount}</span>
                        <span class="coupon-desc">${c.desc}</span>
                    </div>
                    ${unlocked
                        ? `<button class="copy-code-btn" onclick="window.copyCoupon(this, '${c.code}')">${c.code}</button>`
                        : `<span class="coupon-locked-label"><i class="fa-solid fa-lock"></i> ${c.threshold} coins</span>`
                    }
                </div>`;
        }).join('');

        // Leaderboard
        const lbList = document.getElementById('rewards-lb-list');
        lbList.innerHTML = rewardsState.friends.map((f, i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
            const top3 = i < 3 ? 'top-3' : '';
            const isMe = f.isMe ? 'is-me' : '';
            return `
                <div class="rewards-lb-item ${top3} ${isMe}">
                    <div class="lb-rank ${rankClass}">${f.rank}</div>
                    <div class="lb-avatar"><i class="fa-solid ${f.avatar}"></i></div>
                    <div class="lb-name">${f.name}${f.isMe ? '<span class="me-badge">YOU</span>' : ''}</div>
                    <div class="lb-saved">${f.saved}</div>
                </div>`;
        }).join('');
    }

    // Copy coupon code
    window.copyCoupon = (btn, code) => {
        navigator.clipboard.writeText(code).then(() => {
            btn.textContent = '\u2713 Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = code;
                btn.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            btn.textContent = code;
            showToast('Copy failed – try manually', true);
        });
    };

    // Show day footprint popup on streak dot click
    window.showDayFootprint = (dot) => {
        // Remove any existing popup
        document.querySelectorAll('.day-fp-popup').forEach(p => p.remove());
        const fp = dot.dataset.fp;
        const label = dot.dataset.label;
        const date = dot.dataset.date;
        const popup = document.createElement('div');
        popup.className = 'day-fp-popup';
        if (fp) {
            popup.innerHTML = `
                <div class="popup-label">${label} &bull; ${date}</div>
                <div class="popup-value">${fp} <span>kg CO₂</span></div>
                <div class="popup-sub">Daily footprint logged</div>`;
        } else {
            popup.innerHTML = `
                <div class="popup-label">${label} &bull; ${date}</div>
                <div class="popup-no-data"><i class="fa-solid fa-circle-xmark"></i> No footprint logged</div>`;
        }
        dot.style.position = 'relative';
        dot.appendChild(popup);
        // Auto-dismiss on outside click
        setTimeout(() => {
            document.addEventListener('click', function dismiss(e) {
                if (!dot.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', dismiss);
                }
            });
        }, 10);
    };

});
