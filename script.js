// --- 1. マスターデータベース ---
const ALL_CARDS = {
    // 日常シリーズ
    "morning": { id: "m1", title: "朝の結びカード [通常]", text: "今日の空気はちょっと味方してくれそう。深呼吸をひとつして、お出かけしてみては？", series: "daily" },
    "afternoon": { id: "a1", title: "昼の結びカード [通常]", text: "美味しいお昼は食べられましたか？ 午後を乗り切るコツは、少しだけ『まぁいっか』の気持ちを持つこと。", series: "daily" },
    "night": { id: "n1", title: "夜の結びカード [通常]", text: "今日も1日、本当にお疲れ様でした。目に見える成果がなくても、今日を無事に生き抜いただけで満点です。", series: "daily" },
    
    // 祝日・記念日限定
    "newyear": { id: "s1", title: "【限定】お正月カード", text: "新しい1年の真っ白なスタート。今日はいつもより少し遅く起きたって、全部『おめでたい』で許される日です。", series: "special" },
    "gw": { id: "s2", title: "【限定】端午の節句・GWカード", text: "カレンダーに並ぶ赤い文字を見るだけで、心がふっと軽くなる。思いきり羽を伸ばす時間です。", series: "special" },
    "christmas": { id: "s3", title: "【限定】クリスマスカード", text: "街中がきらめく、特別な冬の1日。自分へのご褒美ケーキを味わう時間も、優しい光に包まれますように。", series: "special" },
    
    // ガチャ・コンプご褒美
    "premium_gold": { id: "p1", title: "【極レア】黄金の結び紐カード", text: "すべての縁が美しく結ばれる瞬間。あなたにとって、これ以上ない最高のタイミングが訪れています。", series: "special" },
    "premium_star": { id: "p2", title: "【極レア】満天の星々カード", text: "静かな夜空に輝く星たち。あなたの積み重ねてきた努力が、まもなく綺麗な星座を結びます。", series: "special" },
    "reward_spring": { id: "r1", title: "【至高】春爛漫・万華鏡カード", text: "『日常シリーズ』をすべて集めた者だけが辿り着く。美しく咲き誇るすべての季節の要素が融合した、究極の結晶です。", series: "special" }
};

// --- 2. アプリの状態（ユーザーのローカルデータ） ---
let userData = {
    points: 0,
    // 所持カード管理： { cardId: 数量 }
    collection: {
        "m1": 0, "a1": 0, "n1": 0,
        "s1": 0, "s2": 0, "s3": 0,
        "p1": 0, "p2": 0, "r1": 0
    }
};

// 交換シミュレーション用の友達データ
let friendData = {
    collection: {
        "m1": 1, "a1": 0, "n1": 2,
        "s1": 0, "s2": 0, "s3": 0,
        "p1": 1, "p2: ": 0, "r1": 0
    }
};

// Web Audio API を使った効果音の擬似生成（木と紐の摩擦音風）
function playHimoSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // ノイズ生成（ガラガラ感）
        const bufferSize = ctx.sampleRate * 0.4; // 0.4秒
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        // フィルターで音をこもらせて木製っぽく
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 2;
        
        // ボリューム制御
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        noise.start();
    } catch (e) {
        console.log("Audio play blocked or unsupported");
    }
}

// --- 3. 画面遷移ロジック ---
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if (screenId === 'collection-screen') {
        renderCollection();
    } else if (screenId === 'trade-screen') {
        renderTrade();
    }
}

// --- 4. おみくじ排出ロジック ---
function getCardByTime() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const hour = now.getHours();
    
    // 📌 A. 祝日・記念日判定（シミュレート用含む）
    // 通常のリアル判定例
    if (month === 1 && date === 1) return ALL_CARDS.newyear;
    if (month === 5 && date === 5) return ALL_CARDS.gw;
    if (month === 12 && date === 25) return ALL_CARDS.christmas;
    
    // 確率でたまに祝日カードが出るようにエンタメ要素追加
    const rand = Math.random();
    if (rand < 0.05) return ALL_CARDS.newyear;
    if (rand < 0.10) return ALL_CARDS.gw;
    
    // 📌 B. 時間帯判定
    if (hour >= 5 && hour < 11) {
        return ALL_CARDS.morning;
    } else if (hour >= 11 && hour < 17) {
        return ALL_CARDS.afternoon;
    } else {
        return ALL_CARDS.night;
    }
}

// カード獲得処理
function acquireCard(card) {
    const isFirst = userData.collection[card.id] === 0;
    userData.collection[card.id] += 1;
    
    // モーダルに反映
    document.getElementById('modal-card-badge').innerText = isFirst ? "新規!" : "ダブリ";
    document.getElementById('modal-card-badge').className = isFirst ? "tc-badge" : "tc-badge dup";
    document.getElementById('modal-card-title').innerText = card.title;
    document.getElementById('modal-card-text').innerText = card.text;
    
    const now = new Date();
    document.getElementById('modal-card-date').innerText = `結び日時: ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    // コンプリートチェック
    checkAndAwardCompletion();
    
    // モーダル表示
    document.getElementById('card-modal').classList.add('active');
}

// コンプリートご褒美判定
function checkAndAwardCompletion() {
    // 朝・昼・夜が揃っているか
    if (userData.collection["m1"] > 0 && userData.collection["a1"] > 0 && userData.collection["n1"] > 0) {
        // まだご褒美をもらっていなければ
        if (userData.collection["r1"] === 0) {
            setTimeout(() => {
                alert("🎉【シリーズコンプリート！】日常のカードがすべて揃ったため、至高のご褒美カードが結ばれました！");
                userData.collection["r1"] = 1;
                renderCollection();
            }, 1000);
        }
    }
}

// --- 5. UIレンダリング ---
function renderCollection() {
    document.getElementById('display-points').innerText = userData.points;
    
    const gridDaily = document.getElementById('grid-daily');
    const gridSpecial = document.getElementById('grid-special');
    
    gridDaily.innerHTML = '';
    gridSpecial.innerHTML = '';
    
    Object.values(ALL_CARDS).forEach(card => {
        const count = userData.collection[card.id];
        const cardEl = document.createElement('div');
        
        if (count > 0) {
            cardEl.className = 'mini-card';
            cardEl.innerHTML = `
                <div class="mini-title">${card.title.replace(/【.*】/,'')}</div>
                ${count > 1 ? `<div class="mini-count">${count}</div>` : ''}
            `;
            cardEl.onclick = () => {
                document.getElementById('modal-card-badge').innerText = "所持中";
                document.getElementById('modal-card-badge').className = "tc-badge dup";
                document.getElementById('modal-card-title').innerText = card.title;
                document.getElementById('modal-card-text').innerText = card.text;
                document.getElementById('modal-card-date').innerText = "アルバム保存済み";
                document.getElementById('card-modal').classList.add('active');
            };
        } else {
            cardEl.className = 'mini-card locked';
            cardEl.innerHTML = `<div class="mini-title">？</div>`;
        }
        
        if (card.series === 'daily') {
            gridDaily.appendChild(cardEl);
        } else {
            gridSpecial.appendChild(cardEl);
        }
    });
}

// オンライン交換のレンダリング
let selectedMyCardId = null;
let selectedFriendCardId = null;

function renderTrade() {
    const myPanel = document.getElementById('my-trade-list');
    const friendPanel = document.getElementById('friend-trade-list');
    
    myPanel.innerHTML = '';
    friendPanel.innerHTML = '';
    
    // 自分のリスト
    Object.values(ALL_CARDS).forEach(card => {
        const count = userData.collection[card.id];
        if (count > 0) {
            const item = document.createElement('div');
            item.className = `trade-item ${selectedMyCardId === card.id ? 'selected' : ''}`;
            item.innerText = `${card.title.substring(0,12)}.. (x${count})`;
            item.onclick = () => {
                selectedMyCardId = selectedMyCardId === card.id ? null : card.id;
                renderTrade();
            };
            myPanel.appendChild(item);
        }
    });
    
    // 友達のリスト
    Object.values(ALL_CARDS).forEach(card => {
        const count = friendData.collection[card.id];
        if (count > 0) {
            const item = document.createElement('div');
            item.className = `trade-item ${selectedFriendCardId === card.id ? 'selected' : ''}`;
            item.innerText = `${card.title.substring(0,12)}.. (x${count})`;
            item.onclick = () => {
                selectedFriendCardId = selectedFriendCardId === card.id ? null : card.id;
                renderTrade();
            };
            friendPanel.appendChild(item);
        }
    });
    
    document.getElementById('btn-execute-trade').disabled = !(selectedMyCardId && selectedFriendCardId);
}

// --- 6. イベントリスナーとドラッグ（紐引き）のシミュレーション ---
const handle = document.getElementById('himo-handle');
const rope = document.getElementById('himo-rope');
let isDragging = false;
let startY = 0;

handle.addEventListener('mousedown', startDrag);
handle.addEventListener('touchstart', startDrag, { passive: true });

window.addEventListener('mousemove', doDrag);
window.addEventListener('touchmove', doDrag, { passive: false });

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

function startDrag(e) {
    isDragging = true;
    startY = e.clientY || e.touches[0].clientY;
}

function doDrag(e) {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();
    
    const currentY = e.clientY || e.touches[0].clientY;
    let deltaY = currentY - startY;
    
    if (deltaY < 0) deltaY = 0;
    if (deltaY > 120) deltaY = 120; // 最大引き下げ距離
    
    rope.style.height = (200 + deltaY) + 'px';
    handle.style.top = (200 + deltaY) + 'px';
    
    if (deltaY >= 110 && isDragging) {
        // 一番下まで引ききったらおみくじ発動
        endDrag();
        playHimoSound();
        const rolledCard = getCardByTime();
        acquireCard(rolledCard);
    }
}

function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    // 元の位置にバネのように戻る演出
    rope.style.transition = 'height 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    handle.style.transition = 'top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    rope.style.height = '200px';
    handle.style.top = '200px';
    
    setTimeout(() => {
        rope.style.transition = 'none';
        handle.style.transition = 'none';
    }, 300);
}

// ボタンアクション各種
document.getElementById('btn-to-collection').onclick = () => switchScreen('collection-screen');
document.getElementById('btn-to-trade').onclick = () => switchScreen('trade-screen');
document.querySelectorAll('.btn-back').forEach(btn => btn.onclick = () => switchScreen('main-screen'));

document.getElementById('btn-close-modal').onclick = () => {
    document.getElementById('card-modal').classList.remove('active');
};

// ダブリ一括リサイクル
document.getElementById('btn-recycle-all').onclick = () => {
    let gainedPoints = 0;
    Object.keys(userData.collection).forEach(id => {
        if (userData.collection[id] > 1) {
            const dupCount = userData.collection[id] - 1;
            gainedPoints += dupCount * 10;
            userData.collection[id] = 1; // 1枚だけ残す
        }
    });
    
    if (gainedPoints > 0) {
        userData.points += gainedPoints;
        alert(`♻️ ダブリカードをリサイクルし、${gainedPoints} pt を獲得しました！`);
        renderCollection();
    } else {
        alert("リサイクルできるダブリカードがありません。");
    }
};

// プレミアムガチャ
document.getElementById('btn-draw-premium').onclick = () => {
    if (userData.points < 10) {
        alert("❌ ポイントが足りません。ダブリカードをリサイクルして貯めてください。");
        return;
    }
    userData.points -= 10;
    const pCards = [ALL_CARDS.premium_gold, ALL_CARDS.premium_star];
    const rolled = pCards[Math.floor(Math.random() * pCards.length)];
    acquireCard(rolled);
    renderCollection();
};

// 交換実行
document.getElementById('btn-execute-trade').onclick = () => {
    if (selectedMyCardId && selectedFriendCardId) {
        userData.collection[selectedMyCardId]--;
        userData.collection[selectedFriendCardId]++;
        
        friendData.collection[selectedFriendCardId]--;
        friendData.collection[selectedMyCardId]++;
        
        const myCardName = ALL_CARDS[Object.keys(ALL_CARDS).find(k => ALL_CARDS[k].id === selectedMyCardId)].title;
        const friendCardName = ALL_CARDS[Object.keys(ALL_CARDS).find(k => ALL_CARDS[k].id === selectedFriendCardId)].title;
        
        alert(`🤝 交換が成立しました！\nあなたの『${myCardName}』と友達の『${friendCardName}』が結ばれました。`);
        
        selectedMyCardId = null;
        selectedFriendCardId = null;
        renderTrade();
    }
};