/* ============================================================
   神秘猪妞 · 3D 预览器（three.js + FBXLoader）
   由 classic script（openZhuniu/closeNormalProduct）通过全局函数调用
   ============================================================ */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let zViewer = null;

window.initZhuniuViewer = async function (containerId) {
    disposeZhuniuViewer();
    const container = document.getElementById(containerId);
    if (!container) return;

    const w = container.clientWidth || 340;
    const h = container.clientHeight || 300;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h);
    } catch (e) {
        console.warn('WebGL 不可用', e);
        container.innerHTML = '<div class="zhuniu-3d-err">当前环境不支持 3D 预览</div>';
        return;
    }
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(2.4, 1.7, 3.4);
    camera.lookAt(0, 0.5, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x808080, 1.15));
    const dl = new THREE.DirectionalLight(0xffffff, 1.25); dl.position.set(3, 5, 2); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.5); dl2.position.set(-3, 2, -2); scene.add(dl2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.8;
    controls.maxDistance = 20;

    const state = { renderer, scene, camera, controls, obj: null, raf: 0, onResize: null };
    zViewer = state;

    let obj = null;
    try {
        const loader = new FBXLoader();
        const loaded = await loader.loadAsync('assets/models/zhuniu.fbx');

        // 归一化缩放（适配预览框）并居中、落在地面上
        const box = new THREE.Box3().setFromObject(loaded);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        loaded.scale.setScalar(2.2 / maxDim);
        loaded.updateMatrixWorld(true);

        const box2 = new THREE.Box3().setFromObject(loaded);
        const center = box2.getCenter(new THREE.Vector3());
        loaded.position.x -= center.x;
        loaded.position.y -= (box2.min.y - 0.08);
        loaded.position.z -= center.z;
        scene.add(loaded);
        obj = loaded;
        state.obj = loaded;

        // 底部参考光环
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.85, 1.15, 48),
            new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        scene.add(ring);
    } catch (e) {
        console.warn('3D 模型加载失败', e);
        container.innerHTML = '<div class="zhuniu-3d-err">3D 预览加载失败</div>';
        return;
    }

    function animate() {
        state.raf = requestAnimationFrame(animate);
        if (obj) obj.rotation.y += 0.005;
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    state.onResize = function () {
        const nw = container.clientWidth || w;
        const nh = container.clientHeight || h;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', state.onResize);
};

window.disposeZhuniuViewer = function () {
    if (!zViewer) return;
    if (zViewer.raf) cancelAnimationFrame(zViewer.raf);
    if (zViewer.onResize) window.removeEventListener('resize', zViewer.onResize);
    if (zViewer.scene) {
        zViewer.scene.traverse(function (o) {
            if (o.geometry) o.geometry.dispose();
        });
    }
    if (zViewer.renderer) {
        zViewer.renderer.dispose();
        if (zViewer.renderer.domElement && zViewer.renderer.domElement.parentNode) {
            zViewer.renderer.domElement.parentNode.removeChild(zViewer.renderer.domElement);
        }
    }
    zViewer = null;
};
