/* ============================================================
  蜜雪冰城 · 点单模拟  ——  交互逻辑 + 液态玻璃（WebGL）引擎
  作者：Doubao AI（基础版由 @laugh-white 制作）
  ============================================================ */

// ---------------- 全局变量 ----------------
let cart = [];
let currentPassword = '';
let currentPayAmount = '0.10';
let currentProduct = {
    name: '珍珠奶茶',
    price: 0.1,
    img: 'assets/images/zhenzhu_naicha.jpg'
};

// 音频元素
const mixueAudio = document.getElementById('mixue-audio');
mixueAudio.volume = 1.0;
const yingtaoAudio = document.getElementById('yingtao-audio');
yingtaoAudio.volume = 1.0;
const zhuniuAudio = document.getElementById('zhuniu-audio');
zhuniuAudio.volume = 1.0;

// 各 tab 页的滚动位置记忆
const scrollMemory = {};

// ---------------- 页面切换函数 ----------------
function showPage(pageId) {
    // 先记录当前页面切走时的滚动位置
    const curActive = document.querySelector('.page.active');
    if (curActive && curActive.id && TAB_INDEX[curActive.id] !== undefined) {
        scrollMemory[curActive.id] = window.scrollY;
    }
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');

    // tab 页显示全局底部栏；详情/支付/成功等全屏页隐藏
    const idx = TAB_INDEX[pageId];
    if (idx !== undefined) {
        document.body.classList.remove('no-tab-nav');
        currentTab = idx;
        setNavActive(idx);
        // tab 页切回来时恢复上次滚动位置（详情页仍从顶部开始）
        requestAnimationFrame(function() {
            window.scrollTo(0, scrollMemory[pageId] || 0);
        });
    } else {
        document.body.classList.add('no-tab-nav');
        window.scrollTo(0, 0);
    }
    updateCartSettle();
}

/* ============================================================
  底部栏 Tab 系统（可拖动切换 + 360°×间隔页数旋转动画）
  ============================================================ */
const TAB_PAGE_IDS = ['home-page', 'orders-page', 'cart-page', 'profile-page'];
const TAB_INDEX = { 'home-page': 0, 'orders-page': 1, 'cart-page': 2, 'profile-page': 3 };
let currentTab = 0;
const mainNav = document.getElementById('main-nav');
const navKnob = document.getElementById('nav-knob');
const KNOB_COUNT = TAB_PAGE_IDS.length;

// 旋钮物理状态：x 为 0..3 的 tab 坐标；scale/opacity 受“风阻力”影响
const knobState = {
    x: 0, v: 0, scale: 1, opacity: 1,
    target: null, dragging: false, pointerNorm: 0, raf: 0
};

// 液态玻璃通透度（0~1），旋钮透明度与其联动
let glassT = 0.7;

function clampKnobX(x) { return Math.max(0, Math.min(KNOB_COUNT - 1, x)); }

// 旋钮静止时透明度（与液态玻璃通透度联动：越通透旋钮越透明）
function knobIdleOpacity() { return Math.max(0.28, 0.55 - 0.25 * glassT); }

// 将旋钮状态绘制到 DOM（位移 + 缩放 + 通透度 + 高亮）
function applyKnob() {
    if (!navKnob || !mainNav) return;
    const itemW = mainNav.clientWidth / KNOB_COUNT;
    const cx = (knobState.x + 0.5) * itemW;
    const half = navKnob.clientWidth / 2;
    navKnob.style.transform =
        'translateX(' + (cx - half) + 'px) scale(' + knobState.scale.toFixed(3) + ')';
    navKnob.style.opacity = knobState.opacity.toFixed(3);
    setNavActive(clampKnobX(Math.round(knobState.x)));
}

// 旋钮物理循环
function knobFrame() {
    const s = knobState;
    let busy = true;

    if (s.dragging) {
        // 手指按下拖动：旋钮变成玻璃球 —— 立即放大、变非常通透，覆盖下方文字；
        // 速度（风阻力）越快玻璃球越大；通透度再乘上全局通透度（更透）。
        const nx = clampKnobX(s.pointerNorm);
        s.v = (nx - s.x) * 55;
        s.x = nx;
        const speed = Math.abs(s.v);
        const base = 1.30;                                   // 按下即放大
        s.scale = base + Math.min(0.38, speed * 0.012);       // 越大（最多约 1.68）
        const dragOp = (0.34 - 0.12 * glassT) - speed * 0.012;
        s.opacity = Math.max(0.16, dragOp);                   // 越通透（玻璃球）
        setNavActive(clampKnobX(Math.round(s.x)));
    } else if (s.target !== null) {
        // 手指停止后：弹簧回中 + 空气阻力阻尼，到达最近 tab 再切换页面
        s.v += (s.target - s.x) * 0.34;
        s.v *= 0.80;
        s.x += s.v;
        s.scale += (1 - s.scale) * 0.18;
        s.opacity += (knobIdleOpacity() - s.opacity) * 0.18;
        if (Math.abs(s.target - s.x) < 0.006 && Math.abs(s.v) < 0.02) {
            const idx = clampKnobX(Math.round(s.target));
            s.target = null; s.v = 0; s.x = idx;
            applyKnob();
            s.raf = 0;
            switchTab(idx, true, currentTab); // 手指停止后才判定并切换页面
            return;
        }
    } else {
        // 静止：恢复大小，透明度回落到当前通透度对应的基线
        s.scale += (1 - s.scale) * 0.15;
        s.opacity += (knobIdleOpacity() - s.opacity) * 0.15;
        const idleOp = knobIdleOpacity();
        busy = !(Math.abs(1 - s.scale) < 0.005 && Math.abs(idleOp - s.opacity) < 0.005);
        if (!busy) { s.scale = 1; s.opacity = idleOp; }
    }

    applyKnob();
    s.raf = busy ? requestAnimationFrame(knobFrame) : 0;
}

function ensureKnobLoop() {
    if (!knobState.raf) knobState.raf = requestAnimationFrame(knobFrame);
}

function setNavActive(idx) {
    if (!mainNav) return;
    mainNav.querySelectorAll('.tab-item').forEach(item => {
        item.classList.toggle('active', Number(item.dataset.tab) === idx);
    });
}

// 购物车结算条：仅购物车 tab 且购物车非空时显示
function updateCartSettle() {
    const bar = document.getElementById('cart-settle-bar');
    if (!bar) return;
    const onCartTab = document.getElementById('cart-page').classList.contains('active');
    bar.classList.toggle('show', onCartTab && cart.length > 0);
}

// 页面旋转到位动画：--rot = 间隔页数 × 360°（带符号），--dur 时长
function spinPage(pageId, delta) {
    const gap = Math.abs(delta);
    if (!gap) return;
    const dir = delta < 0 ? -1 : 1;
    const el = document.getElementById(pageId);
    if (!el) return;
    const dur = 0.5 + gap * 0.14;
    el.style.setProperty('--rot', (dir * gap * 360) + 'deg');
    el.style.setProperty('--dur', dur + 's');
    el.classList.remove('spinning');
    void el.offsetWidth; // 强制回流以重启动画
    el.classList.add('spinning');
    el.addEventListener('animationend', function done() {
        el.classList.remove('spinning');
        el.removeEventListener('animationend', done);
    });
}

// 切换到某个 tab（含旋转动画），并让旋钮移动到位
function switchTab(idx, animate = true, spinFromIdx = null) {
    idx = clampKnobX(idx);
    const src = (spinFromIdx === null) ? currentTab : spinFromIdx;
    showPage(TAB_PAGE_IDS[idx]);
    // 旋钮定位到目标 tab
    knobState.x = idx; knobState.v = 0; knobState.target = null;
    knobState.scale = 1; knobState.opacity = 1;
    applyKnob();
    if (animate) {
        const gap = Math.abs(idx - src);
        if (gap > 0) spinPage(TAB_PAGE_IDS[idx], idx - src);
    }
}

// 初始化可拖动圆形旋钮
function initTabNav() {
    if (!mainNav) return;
    let dragging = false;
    let pointerId = null;

    mainNav.addEventListener('pointerdown', function(e) {
        dragging = true;
        pointerId = e.pointerId;
        try { mainNav.setPointerCapture(e.pointerId); } catch (_) {}
        mainNav.classList.add('scrubbing');
        document.body.classList.add('scrubbing');
        knobState.dragging = true;
        const r = mainNav.getBoundingClientRect();
        const itemW = r.width / KNOB_COUNT;
        knobState.pointerNorm = (e.clientX - r.left) / itemW - 0.5;
        ensureKnobLoop();
        e.preventDefault();
    });

    mainNav.addEventListener('pointermove', function(e) {
        if (!dragging) return;
        const r = mainNav.getBoundingClientRect();
        const itemW = r.width / KNOB_COUNT;
        knobState.pointerNorm = (e.clientX - r.left) / itemW - 0.5;
    });

    function endDrag() {
        if (!dragging) return;
        dragging = false;
        try { mainNav.releasePointerCapture(pointerId); } catch (_) {}
        mainNav.classList.remove('scrubbing');
        document.body.classList.remove('scrubbing');
        knobState.dragging = false;
        // 手指停止后才计算应停靠的页面
        knobState.target = clampKnobX(Math.round(knobState.x));
        ensureKnobLoop();
    }

    mainNav.addEventListener('pointerup', endDrag);
    mainNav.addEventListener('pointercancel', endDrag);

    applyKnob();
}

// ---------------- 珍珠奶茶详情页（带音乐） ----------------
function openProductDetail() {
    showPage('detail-page');
    playMixueSong();
    // 雪王动画增强
    const snowking = document.getElementById('snowking-big');
    snowking.style.animation = 'none';
    setTimeout(() => { snowking.style.animation = ''; }, 10);
}

function playMixueSong() {
    try {
        mixueAudio.currentTime = 0;
        mixueAudio.volume = 1.0;
        mixueAudio.play().catch(e => {
            console.log('音频播放需要用户交互', e);
            document.addEventListener('click', function playOnce() {
                mixueAudio.play().catch(() => {});
                document.removeEventListener('click', playOnce);
            }, { once: true });
        });
    } catch (e) {
        console.log('音频播放错误', e);
    }
}

function stopMixueSong() {
    try {
        mixueAudio.pause();
        mixueAudio.currentTime = 0;
    } catch (e) {
        console.log('音频停止错误', e);
    }
}

function closeProductDetail() {
    stopMixueSong();
    showPage('home-page');
}

// ---------------- 普通商品详情 ----------------
function openNormalProduct(name, price, img) {
    currentProduct = { name, price, img };
    document.getElementById('normal-detail-img').src = img;
    document.getElementById('normal-detail-name').textContent = name;
    document.getElementById('normal-detail-price').textContent = price;
    const buyBtn = document.getElementById('normal-buy-btn');
    buyBtn.onclick = function() { goToPayment(name, price); };
    showPage('normal-detail-page');
}

function closeNormalProduct() {
    stopYingtaoSong();
    stopZhuniuSong();
    if (window.disposeZhuniuViewer) disposeZhuniuViewer();
    const wrap = document.getElementById('zhuniu-3d-wrap');
    if (wrap) wrap.style.display = 'none';
    showPage('home-page');
}

// ---------------- 安卓的樱桃派（复用珍珠奶茶的播放音乐逻辑） ----------------
function playYingtaoSong() {
    stopMixueSong();
    try {
        yingtaoAudio.currentTime = 0;
        yingtaoAudio.volume = 1.0;
        yingtaoAudio.play().catch(e => {
            console.log('音频播放需要用户交互', e);
            document.addEventListener('click', function playOnce() {
                yingtaoAudio.play().catch(() => {});
                document.removeEventListener('click', playOnce);
            }, { once: true });
        });
    } catch (e) {
        console.log('音频播放错误', e);
    }
}
function stopYingtaoSong() {
    try {
        yingtaoAudio.pause();
        yingtaoAudio.currentTime = 0;
    } catch (e) {
        console.log('音频停止错误', e);
    }
}
function openYingtaoPai() {
    openNormalProduct('安卓的樱桃派', 9, 'assets/images/yingtao_pai.jpg');
    playYingtaoSong();   // 复用珍珠奶茶的音乐播放代码，播放樱桃派音频
}

// ---------------- 神秘猪妞（复用珍珠奶茶的播放音乐逻辑 + 3D 预览器） ----------------
function playZhuniuSong() {
    stopMixueSong();
    try {
        zhuniuAudio.currentTime = 0;
        zhuniuAudio.volume = 1.0;
        zhuniuAudio.play().catch(e => {
            console.log('音频播放需要用户交互', e);
            document.addEventListener('click', function playOnce() {
                zhuniuAudio.play().catch(() => {});
                document.removeEventListener('click', playOnce);
            }, { once: true });
        });
    } catch (e) {
        console.log('音频播放错误', e);
    }
}
function stopZhuniuSong() {
    try {
        zhuniuAudio.pause();
        zhuniuAudio.currentTime = 0;
    } catch (e) {
        console.log('音频停止错误', e);
    }
}
function openZhuniu() {
    openNormalProduct('神秘猪妞', 8, 'assets/images/zhuniu_mystery.jpg');
    // 显示 3D 预览器，预览猪妞绑骨版模型
    const wrap = document.getElementById('zhuniu-3d-wrap');
    if (wrap) {
        wrap.style.display = 'block';
        // 等布局就绪后初始化 three.js 预览器
        setTimeout(function() {
            if (window.initZhuniuViewer) initZhuniuViewer('zhuniu-3d');
        }, 60);
    }
    playZhuniuSong();   // 复用珍珠奶茶的音乐播放代码，播放炸闺蜜.mp3
}

// ---------------- 购物车 ----------------
function openCart() { updateCartUI(); switchTab(2); }
function closeCart() { showPage('home-page'); }

function updateCartUI() {
    const cartList = document.getElementById('cart-list');
    const cartEmpty = document.getElementById('cart-empty');
    const cartBadge = document.getElementById('cart-badge');
    const totalPrice = document.getElementById('cart-total-price');

    let totalCount = 0;
    let totalMoney = 0;

    if (cart.length === 0) {
        cartEmpty.style.display = 'block';
        cartList.classList.remove('show');
    } else {
        cartEmpty.style.display = 'none';
        cartList.classList.add('show');
        cartList.innerHTML = '';
        cart.forEach((item, index) => {
            totalCount += item.quantity;
            totalMoney += item.price * item.quantity;
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <img src="${item.img}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${item.name}</h4>
                    <p class="cart-item-spec">标准规格</p>
                    <span class="cart-item-price">¥${item.price.toFixed(2)}</span>
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn minus" onclick="changeQuantity(${index}, -1)">−</button>
                    <span class="quantity-num">${item.quantity}</span>
                    <button class="quantity-btn plus" onclick="changeQuantity(${index}, 1)">+</button>
                </div>
            `;
            cartList.appendChild(cartItem);
        });
    }

    cartBadge.textContent = totalCount;
    cartBadge.style.display = totalCount > 0 ? 'flex' : 'none';
    totalPrice.textContent = totalMoney.toFixed(2);
    updateCartSettle();
}

function changeQuantity(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) { cart.splice(index, 1); }
    updateCartUI();
}

function addToCart(name, price, img) {
    const existingItem = cart.find(item => item.name === name);
    if (existingItem) { existingItem.quantity++; }
    else { cart.push({ name, price, img, quantity: 1 }); }
    updateCartUI();
}

function settleCart() {
    if (cart.length === 0) { alert('购物车是空的哦~'); return; }
    const firstItem = cart[0];
    let totalPrice = 0;
    cart.forEach(item => { totalPrice += item.price * item.quantity; });
    goToPayment(firstItem.name, totalPrice, firstItem.img);
}

// ---------------- 去付款 ----------------
function goToPayment(name, price, img) {
    currentProduct = { name, price, img: img || currentProduct.img };
    currentPayAmount = price.toFixed(2);

    document.getElementById('order-item-img').src = currentProduct.img;
    document.getElementById('order-item-name').textContent = name;
    document.getElementById('order-item-price').textContent = price.toFixed(2);
    document.getElementById('fee-goods').textContent = '¥' + price.toFixed(2);
    document.getElementById('fee-total').textContent = '¥' + price.toFixed(2);
    document.getElementById('payment-total-price').textContent = price.toFixed(2);

    stopMixueSong();
    stopYingtaoSong();
    stopZhuniuSong();
    if (window.disposeZhuniuViewer) disposeZhuniuViewer();
    showPage('payment-page');
}

function closePayment() { showPage('home-page'); }

// ---------------- 微信支付 ----------------
function showWechatPay() {
    document.getElementById('pay-amount').textContent = currentPayAmount;
    document.getElementById('wechat-pay-modal').classList.add('show');
}
function closeWechatPay() { document.getElementById('wechat-pay-modal').classList.remove('show'); }

function showPasswordKeyboard() {
    currentPassword = '';
    updatePasswordDots();
    document.getElementById('password-amount').textContent = currentPayAmount;
    document.getElementById('password-modal').classList.add('show');
}
function closePasswordKeyboard() {
    document.getElementById('password-modal').classList.remove('show');
    currentPassword = '';
    updatePasswordDots();
}

function pressKey(key) {
    if (currentPassword.length >= 6) return;
    currentPassword += key;
    updatePasswordDots();
    if (currentPassword.length === 6) {
        setTimeout(() => {
            if (currentPassword === '123456') {
                closePasswordKeyboard();
                closeWechatPay();
                showSuccessPage();
            } else {
                alert('密码错误，请重新输入');
                currentPassword = '';
                updatePasswordDots();
            }
        }, 300);
    }
}

function deleteKey() {
    if (currentPassword.length > 0) {
        currentPassword = currentPassword.slice(0, -1);
        updatePasswordDots();
    }
}

function updatePasswordDots() {
    for (let i = 1; i <= 6; i++) {
        const dot = document.getElementById('dot-' + i);
        dot.classList.toggle('filled', i <= currentPassword.length);
    }
}

function showSuccessPage() {
    document.getElementById('success-amount').textContent = currentPayAmount;
    showPage('success-page');
    cart = [];
    updateCartUI();
}

function backToHome() { showPage('home-page'); }

// ---------------- DOM 交互绑定 ----------------
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.spec-options').forEach(optionsGroup => {
        optionsGroup.querySelectorAll('.spec-option').forEach(option => {
            option.addEventListener('click', function() {
                optionsGroup.querySelectorAll('.spec-option').forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
            });
        });
    });

    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // 底部导航：可拖动圆形旋钮（由 initTabNav 处理）
    initTabNav();

    updateCartUI();
    LiquidGlass.init();
    initGlassOpacity();
    initFingerGlow();
    initClock();
    initTheme();
});

// 点击设置弹窗背景关闭
document.getElementById('settings-modal').addEventListener('click', function(e) {
    if (e.target === this) { closeSettings(); }
});

// 点击弹窗背景关闭
document.getElementById('wechat-pay-modal').addEventListener('click', function(e) {
    if (e.target === this) { closeWechatPay(); }
});
document.getElementById('password-modal').addEventListener('click', function(e) {
    if (e.target === this) { closePasswordKeyboard(); }
});

/* ============================================================
  液态玻璃引擎（WebGL 实时渲染）
  参考实现思路：
  - martin65536/liquid-glass-webgl（WebGL 渲染）
  - xiaojiaenen/liquid-glass（SVG 物理折射 + 玻璃化）
  本页实现：CSS backdrop-filter 玻璃面板 + WebGL 叠加液态高光
  ============================================================ */
const LiquidGlass = (function() {
    let enabled = false;
    let gl = null;
    let program = null;
    let buf = null;
    let uniforms = {};
    let rafId = null;
    let startTime = 0;
    let mouse = { x: 0.5, y: 0.5 };
    let canvas = null;

    const VERT = `
        attribute vec2 a_pos;
        varying vec2 v_uv;
        void main() {
            v_uv = a_pos * 0.5 + 0.5;
            gl_Position = vec4(a_pos, 0.0, 1.0);
        }
    `;

    const FRAG = `
        precision mediump float;
        uniform vec2 u_res;
        uniform float u_time;
        uniform vec2 u_mouse;
        varying vec2 v_uv;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
                mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                f.y
            );
        }
        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
                v += a * noise(p);
                p = p * 2.02;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec2 uv = v_uv;
            float t = u_time * 0.28;

            // 液态流动噪声
            float n = fbm(uv * 3.0 + vec2(t, -t * 0.7));
            float n2 = fbm(uv * 6.0 - vec2(t * 1.3, t * 0.5) + n * 1.6);

            // 玻璃条纹高光
            float spec  = smoothstep(0.48, 0.86, n2);
            float spec2 = smoothstep(0.55, 0.90, fbm(uv * 2.0 + vec2(-t * 0.8, t * 0.6) + n * 2.2));

            // 边缘柔光
            vec2 cent = uv - 0.5;
            float rim = smoothstep(0.40, 0.06, length(cent));
            rim *= rim;

            // 光标视差微光
            vec2 mp = u_mouse - 0.5;
            float glint = smoothstep(0.22, 0.0, length(uv - (0.5 + mp * 0.25)));

            // 色差微光带
            float band = 0.5 + 0.5 * sin(uv.y * 36.0 + t * 5.0);

            vec3 col = vec3(0.0);
            col += vec3(1.00, 0.72, 0.50) * (spec * 0.16 + spec2 * 0.12);   // 暖橙玻璃光
            col += vec3(0.85, 0.72, 1.00) * glint * 0.12;                    // 冷紫高光
            col += vec3(1.00, 0.85, 0.62) * rim * 0.10;                      // 边缘柔光
            col += vec3(0.16, 0.14, 0.20) * band * 0.035;                    // 色差微光

            float alpha = clamp(max(col.r, max(col.g, col.b)) * 1.5, 0.0, 1.0) * 0.9;
            gl_FragColor = vec4(col, alpha);
        }
    `;

    function compileShader(type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.warn('液态玻璃 shader 编译失败:', gl.getShaderInfoLog(sh));
            gl.deleteShader(sh);
            return null;
        }
        return sh;
    }

    function initGL() {
        if (gl) return true;
        canvas = document.getElementById('liquid-canvas');
        const ctxAttrs = { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false };
        gl = canvas.getContext('webgl', ctxAttrs) || canvas.getContext('experimental-webgl', ctxAttrs);
        if (!gl) return false;

        const vs = compileShader(gl.VERTEX_SHADER, VERT);
        const fs = compileShader(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) { gl = null; return false; }

        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn('液态玻璃 program 链接失败:', gl.getProgramInfoLog(program));
            gl = null;
            return false;
        }
        gl.useProgram(program);

        // 全屏四边形
        buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,  1, -1,  -1, 1,
            -1, 1,   1, -1,   1, 1
        ]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, 'a_pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        uniforms = {
            u_res: gl.getUniformLocation(program, 'u_res'),
            u_time: gl.getUniformLocation(program, 'u_time'),
            u_mouse: gl.getUniformLocation(program, 'u_mouse')
        };

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        // RGB 叠加增亮 + Alpha 常规混合，保证画布透明可透出页面
        gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        return true;
    }

    function resize() {
        if (!gl) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.floor(canvas.clientWidth * dpr);
        const h = Math.floor(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function frame() {
        if (!enabled) return;
        if (!gl) { enabled = false; document.body.classList.remove('liquid-glass'); return; }
        resize();
        const t = (performance.now() - startTime) / 1000;

        gl.useProgram(program);
        gl.uniform2f(uniforms.u_res, canvas.width, canvas.height);
        gl.uniform1f(uniforms.u_time, t);
        gl.uniform2f(uniforms.u_mouse, mouse.x, mouse.y);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        rafId = requestAnimationFrame(frame);
    }

    function enable() {
        if (enabled) return;
        if (!initGL()) {
            // WebGL 不可用：仅保留 CSS 玻璃降级效果
            document.body.classList.add('liquid-glass');
            setGlassOn();
            enabled = true;
            return;
        }
        canvas.style.opacity = 1;
        enabled = true;
        startTime = performance.now();
        document.body.classList.add('liquid-glass');
        setGlassOn();
        rafId = requestAnimationFrame(frame);
    }

    function disable() {
        if (!enabled) return;
        enabled = false;
        document.body.classList.remove('liquid-glass');
        setGlassOff();
        if (canvas) canvas.style.opacity = 0;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    // 监听光标/触摸，驱动视差高光
    function bindPointer() {
        const onMove = (e) => {
            const rect = document.body.getBoundingClientRect();
            const cx = (e.clientX || 0) - rect.left;
            const cy = (e.clientY || 0) - rect.top;
            mouse.x = Math.min(1, Math.max(0, cx / (rect.width || 1)));
            mouse.y = Math.min(1, Math.max(0, cy / (rect.height || 1)));
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) onMove(e.touches[0]);
        }, { passive: true });
    }

    return {
        init: function() {
            bindPointer();
            // 恢复上次状态
            if (localStorage.getItem('mixve-liquid-glass') === '1') {
                enable();
            }
        },
        enable, disable
    };
})();

// 液态玻璃开关
function toggleLiquidGlass() {
    const isOn = document.body.classList.contains('liquid-glass');
    if (isOn) {
        LiquidGlass.disable();
        localStorage.setItem('mixve-liquid-glass', '0');
    } else {
        LiquidGlass.enable();
        localStorage.setItem('mixve-liquid-glass', '1');
    }
}

// 开关态（设置在设置弹窗里）
function setGlassOn() {
    const row = document.getElementById('liquid-toggle');
    if (row) { row.classList.add('on'); row.setAttribute('aria-checked', 'true'); }
}
function setGlassOff() {
    const row = document.getElementById('liquid-toggle');
    if (row) { row.classList.remove('on'); row.setAttribute('aria-checked', 'false'); }
}

// 液态玻璃通透度滑杆：0=毛玻璃，100=极通透
function initGlassOpacity() {
    const slider = document.getElementById('glass-opacity');
    if (!slider) return;
    const val = document.getElementById('glass-slider-val');
    function apply(v) {
        const t = Number(v) / 100;
        glassT = t;
        document.body.style.setProperty('--glass-alpha', (0.55 - 0.45 * t).toFixed(3));
        document.body.style.setProperty('--glass-blur', (26 - 22 * t).toFixed(1) + 'px');
        if (val) val.textContent = v;
        // 旋钮透明度随通透度联动
        if (!knobState.dragging && knobState.target === null) {
            knobState.opacity = knobIdleOpacity();
            applyKnob();
        }
    }
    slider.addEventListener('input', function() {
        apply(slider.value);
        localStorage.setItem('mixve-glass-opacity', slider.value);
    });
    const saved = localStorage.getItem('mixve-glass-opacity');
    slider.value = (saved !== null) ? saved : '70';
    apply(slider.value);
}

// 手指光晕：液态玻璃开启时，按压元素时光晕跟随手指
function initFingerGlow() {
    const g = document.getElementById('finger-glow');
    if (!g) return;
    function place(x, y) {
        if (!document.body.classList.contains('liquid-glass')) return;
        g.style.left = x + 'px';
        g.style.top = y + 'px';
        g.style.opacity = '1';
    }
    function hide() { g.style.opacity = '0'; }
    window.addEventListener('pointerdown', function(e) { place(e.clientX, e.clientY); }, true);
    window.addEventListener('pointermove', function(e) {
        if (g.style.opacity === '1') { g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; }
    }, true);
    window.addEventListener('pointerup', hide, true);
    window.addEventListener('pointercancel', hide, true);
    window.addEventListener('blur', hide);
}

// 状态栏时间与现在同步（每分钟刷新，参考 time.is 口径）
function initClock() {
    const el = document.getElementById('live-time');
    if (!el) return;
    function tick() {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        el.textContent = hh + ':' + mm;
    }
    tick();
    setInterval(tick, 1000);   // 每秒校验，分钟精确翻转
}

// 设置弹窗开关
function openSettings() {
    const m = document.getElementById('settings-modal');
    if (!m) return;
    m.classList.add('show');
    syncThemeSeg();
}
function closeSettings() {
    const m = document.getElementById('settings-modal');
    if (m) m.classList.remove('show');
}

// 显示模式：浅色 / 深色（手动切换，不跟随系统；默认浅色）
function applyTheme(mode) {
    document.body.classList.toggle('dark', mode === 'dark');
    document.querySelectorAll('#theme-seg .seg-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
}
function setTheme(mode) { applyTheme(mode); localStorage.setItem('mixve-theme', mode); }
function syncThemeSeg() {
    const mode = document.body.classList.contains('dark') ? 'dark' : 'light';
    document.querySelectorAll('#theme-seg .seg-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
}
function initTheme() {
    applyTheme(localStorage.getItem('mixve-theme') === 'dark' ? 'dark' : 'light');
}
