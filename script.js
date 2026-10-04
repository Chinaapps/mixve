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

// ---------------- 页面切换函数 ----------------
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
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

function closeNormalProduct() { showPage('home-page'); }

// ---------------- 购物车 ----------------
function openCart() { updateCartUI(); showPage('cart-page'); }
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

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            if (this.classList.contains('cart-nav')) return;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    updateCartUI();
    LiquidGlass.init();
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
            document.getElementById('liquid-toggle').classList.add('on');
            document.getElementById('liquid-toggle').setAttribute('aria-checked', 'true');
            enabled = true;
            return;
        }
        canvas.style.opacity = 1;
        enabled = true;
        startTime = performance.now();
        document.body.classList.add('liquid-glass');
        document.getElementById('liquid-toggle').classList.add('on');
        document.getElementById('liquid-toggle').setAttribute('aria-checked', 'true');
        rafId = requestAnimationFrame(frame);
    }

    function disable() {
        if (!enabled) return;
        enabled = false;
        document.body.classList.remove('liquid-glass');
        document.getElementById('liquid-toggle').classList.remove('on');
        document.getElementById('liquid-toggle').setAttribute('aria-checked', 'false');
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
