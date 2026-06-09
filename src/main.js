import './css/css.js'
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const CONFIG = {
    text: 'Pixel\nVanguard',
    // For two lines, use either an array or \n. Example: ['TEST', 'SITE']
    // text: ['TEST', 'SITE'],
    fontFamily: 'Inter, Arial Black, Helvetica, sans-serif',
    particleGap: 4,
    particleSize: 2.7,
    lineGap: 0.88,
    maxTextWidthRatio: 0.82,
    y: 'auto', // 'auto' or number. Example: -80 moves particle text upward.
    autoYRatio: 0.37,
    mouseBreakRadius: 180,
    mouseBreakPower: 210,
    scrollBreakPower: 520,
    tapPulsePower: 360,
    colors: {
        // Hero is intentionally darkened even in light mode, so use luminous particles for readability.
        lightA: '#f8fbff',
        lightB: '#8ee8ff',
        darkA: '#65d7ff',
        darkB: '#ff65d8'
    },
    heroCopyVisible: true,
    autoSlide: true,
    autoSlideIntervalSeconds: 5
};

// type: 'image' | 'video' | 'youtube' | 'empty'
// local files are also OK, e.g. src: './assets/hero.mp4'
const MEDIA_ITEMS = [
    { type: 'empty' },
    { type: 'video', src: 'assets/hero/Hero_1.mp4' },
    { type: 'image', src: 'assets/history/History__3.jpg', alt: '' },
    // { type: 'youtube', id: 'dQw4w9WgXcQ' }
];

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const canvas = document.getElementById('particleText');
const heroCopy = document.querySelector('.hero-copy');
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
camera.position.z = 980;

const pointer = { x: -9999, y: -9999, active: false, pulse: 0, pulseX: 0, pulseY: 0 };
const state = { width: 1, height: 1, particles: 0, scroll: 0, targetScroll: 0 };
let geometry, material, points, basePositions, randomPositions, colors, sizes;
let startTime = performance.now();
let resizeTimer;
let mediaIndex = 0;
let autoSlideTimer;

function normalizeLines(text) {
    return Array.isArray(text) ? text : String(text).split('\n');
}

function currentColors() {
    return prefersDark.matches
    ? [new THREE.Color(CONFIG.colors.darkA), new THREE.Color(CONFIG.colors.darkB)]
    : [new THREE.Color(CONFIG.colors.lightA), new THREE.Color(CONFIG.colors.lightB)];
}

function fitFontSize(ctx, lines, maxWidth, maxHeight) {
    let fontSize = Math.min(maxWidth / Math.max(...lines.map(line => Math.max(line.length, 1))) * 1.7, maxHeight / Math.max(lines.length, 1));
    fontSize = Math.min(fontSize, maxHeight * 0.46, window.innerWidth < 720 ? 86 : 178);
    for (let i = 0; i < 32; i++) {
        ctx.font = `900 ${fontSize}px ${CONFIG.fontFamily}`;
        const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
        const blockHeight = fontSize * (1 + (lines.length - 1) * CONFIG.lineGap);
        if (widest <= maxWidth && blockHeight <= maxHeight) break;
        fontSize *= 0.94;
    }
    return fontSize;
}

function makeTextMap(text, width, height) {
    const cvs = document.createElement('canvas');
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    cvs.width = Math.floor(width);
    cvs.height = Math.floor(height);
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    
    const lines = normalizeLines(text).map(s => String(s).trim()).filter(Boolean);
    const maxWidth = width * CONFIG.maxTextWidthRatio;
    const maxHeight = height * (lines.length > 1 ? 0.36 : 0.26);
    const fontSize = fitFontSize(ctx, lines, maxWidth, maxHeight);
    const centerY = typeof CONFIG.y === 'number' ? height / 2 - CONFIG.y : height * CONFIG.autoYRatio;
    const lineStep = fontSize * CONFIG.lineGap;
    const totalHeight = lineStep * (lines.length - 1);
    
    ctx.font = `900 ${fontSize}px ${CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = fontSize * 0.08;
    lines.forEach((line, index) => {
        const y = centerY - totalHeight / 2 + index * lineStep;
        ctx.fillText(line, cvs.width / 2, y);
    });
    
    const img = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
    const positions = [];
    const gap = Math.max(3, Math.round(CONFIG.particleGap));
    for (let y = 0; y < cvs.height; y += gap) {
        for (let x = 0; x < cvs.width; x += gap) {
            const alpha = img[(y * cvs.width + x) * 4 + 3];
            if (alpha > 80) positions.push((x / cvs.width - 0.5) * width, -(y / cvs.height - 0.5) * height, 0);
        }
    }
    return positions;
}

function rebuild() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    renderer.setSize(state.width, state.height, false);
    camera.aspect = state.width / state.height;
    camera.updateProjectionMatrix();
    
    if (heroCopy) heroCopy.dataset.visible = CONFIG.heroCopyVisible ? 'true' : 'false';
    
    const positions = makeTextMap(CONFIG.text, state.width, state.height);
    state.particles = positions.length / 3;
    basePositions = new Float32Array(positions);
    randomPositions = new Float32Array(basePositions.length);
    colors = new Float32Array(basePositions.length);
    sizes = new Float32Array(state.particles);
    
    const [colorA, colorB] = currentColors();
    const radius = Math.max(state.width, state.height) * 0.84;
    for (let i = 0; i < state.particles; i++) {
        const i3 = i * 3;
        const a = Math.random() * Math.PI * 2;
        const r = radius * (0.2 + Math.random() * 1.1);
        randomPositions[i3] = Math.cos(a) * r;
        randomPositions[i3 + 1] = Math.sin(a) * r;
        randomPositions[i3 + 2] = (Math.random() - 0.5) * 900;
        
        const mix = (basePositions[i3] / state.width + 0.5) * 0.75 + Math.random() * 0.25;
        const c = colorA.clone().lerp(colorB, mix);
        colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b;
        sizes[i] = CONFIG.particleSize * (0.7 + Math.random() * 1.15) * (state.width < 720 ? 1.12 : 1);
    }
    
    geometry?.dispose();
    material?.dispose();
    if (points) scene.remove(points);
    
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(basePositions.length), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        uniforms: {
            uPixelRatio: { value: renderer.getPixelRatio() },
            uTime: { value: 0 },
            uDark: { value: 1 }
        },
        vertexShader: `
      attribute float size;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;
      uniform float uTime;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float pulse = 0.84 + 0.16 * sin(uTime * 2.0 + position.x * 0.015 + position.y * 0.018);
        gl_PointSize = size * uPixelRatio * pulse * (760.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = pulse;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uDark;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float core = smoothstep(0.50, 0.05, d);
        float rim = smoothstep(0.48, 0.22, d) * smoothstep(0.04, 0.24, d);
        float halo = smoothstep(0.50, 0.0, d) * mix(0.16, 0.48, uDark);
        vec3 ink = mix(vColor * 0.82, vColor * 1.38, uDark);
        vec3 edge = mix(vec3(0.02, 0.035, 0.07), vColor * 1.6, uDark);
        vec3 outColor = mix(edge, ink, core) + halo * vColor;
        float alpha = (core * mix(0.92, 1.0, uDark) + rim * mix(0.32, 0.12, uDark) + halo) * vAlpha;
        gl_FragColor = vec4(outColor, alpha);
      }
    `
    });
    points = new THREE.Points(geometry, material);
    scene.add(points);
    startTime = performance.now();
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function animate(now) {
    requestAnimationFrame(animate);
    if (!geometry || !material) return;
    const elapsed = (now - startTime) / 1000;
    const gather = easeOutCubic(Math.min(elapsed / 2.2, 1));
    state.targetScroll = Math.min(window.scrollY / Math.max(1, window.innerHeight), 1);
    state.scroll += (state.targetScroll - state.scroll) * 0.08;
    pointer.pulse *= 0.92;
    
    const pos = geometry.attributes.position.array;
    const time = now * 0.001;
    const mouseX = pointer.x - state.width / 2;
    const mouseY = -(pointer.y - state.height / 2);
    const pulseX = pointer.pulseX - state.width / 2;
    const pulseY = -(pointer.pulseY - state.height / 2);
    const scrollPower = state.scroll * CONFIG.scrollBreakPower;
    
    for (let i = 0; i < state.particles; i++) {
        const i3 = i * 3;
        const bx = basePositions[i3];
        const by = basePositions[i3 + 1];
        const rz = randomPositions[i3 + 2];
        let x = randomPositions[i3] * (1 - gather) + bx * gather;
        let y = randomPositions[i3 + 1] * (1 - gather) + by * gather;
        let z = rz * (1 - gather);
        
        const wave = Math.sin(time * 1.15 + bx * 0.018 + by * 0.014) * 7.5;
        x += wave * gather;
        y += Math.cos(time * 1.05 + bx * 0.012) * 4.5 * gather;
        
        if (pointer.active) {
            const dx = bx - mouseX;
            const dy = by - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONFIG.mouseBreakRadius) {
                const force = Math.pow(1 - dist / CONFIG.mouseBreakRadius, 2);
                const angle = Math.atan2(dy, dx);
                x += Math.cos(angle) * CONFIG.mouseBreakPower * force;
                y += Math.sin(angle) * CONFIG.mouseBreakPower * force;
                z += CONFIG.mouseBreakPower * force * 1.45;
            }
        }
        
        if (pointer.pulse > 0.01) {
            const dx = bx - pulseX;
            const dy = by - pulseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const radius = CONFIG.mouseBreakRadius * 1.35;
            if (dist < radius) {
                const force = Math.pow(1 - dist / radius, 2) * pointer.pulse;
                const angle = Math.atan2(dy, dx);
                x += Math.cos(angle) * CONFIG.tapPulsePower * force;
                y += Math.sin(angle) * CONFIG.tapPulsePower * force;
                z += CONFIG.tapPulsePower * force * 1.6;
            }
        }
        
        if (scrollPower > 0.5) {
            const seed = Math.sin(i * 12.9898) * 43758.5453;
            const n = seed - Math.floor(seed);
            x += (n - 0.5) * scrollPower * 2.3;
            y += (Math.sin(i * 0.73) - 0.5) * scrollPower * 1.5 - scrollPower * 0.35;
            z += scrollPower * (0.4 + n * 1.8);
        }
        
        pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
    }
    
    geometry.attributes.position.needsUpdate = true;
    material.uniforms.uTime.value = time;
    points.rotation.z = Math.sin(time * 0.18) * 0.01;
    renderer.render(scene, camera);
}

function createMediaItem(item) {
    const wrap = document.createElement('div');
    wrap.className = 'media-item';
    if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.alt || '';
        img.loading = 'eager';
        wrap.appendChild(img);
    } else if (item.type === 'video') {
        const video = document.createElement('video');
        video.src = item.src;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        wrap.appendChild(video);
    } else if (item.type === 'youtube') {
        const iframe = document.createElement('iframe');
        const id = item.id || item.src;
        iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1&modestbranding=1&rel=0`;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.title = 'YouTube background video';
        wrap.appendChild(iframe);
    } else {
        const empty = document.createElement('div');
        empty.className = 'media-empty';
        wrap.appendChild(empty);
    }
    return wrap;
}

function updateMediaDots(index) {
    const nav = document.getElementById('mediaNav');
    if (!nav) return;
    [...nav.children].forEach((dot, i) => dot.setAttribute('aria-current', i === index ? 'true' : 'false'));
}

function goToMedia(index, userDriven = false) {
    const stage = document.getElementById('mediaStage');
    if (!stage || !stage.children.length) return;
    const total = stage.children.length;
    mediaIndex = (index + total) % total;
    stage.scrollTo({ left: mediaIndex * stage.clientWidth, behavior: 'smooth' });
    updateMediaDots(mediaIndex);
    if (userDriven) restartAutoSlide();
}

function restartAutoSlide() {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
    if (!CONFIG.autoSlide) return;
    const stage = document.getElementById('mediaStage');
    if (!stage || stage.children.length <= 1) return;
    const seconds = Math.max(1, Number(CONFIG.autoSlideIntervalSeconds) || 5);
    autoSlideTimer = setInterval(() => goToMedia(mediaIndex + 1), seconds * 1000);
}

function initMedia() {
    const stage = document.getElementById('mediaStage');
    const nav = document.getElementById('mediaNav');
    if (!stage || !nav) return;
    const items = MEDIA_ITEMS.length ? MEDIA_ITEMS : [{ type: 'empty' }];
    items.forEach((item, index) => {
        stage.appendChild(createMediaItem(item));
        const dot = document.createElement('button');
        dot.className = 'media-dot';
        dot.type = 'button';
        dot.setAttribute('aria-label', `Show media ${index + 1}`);
        dot.setAttribute('aria-current', index === 0 ? 'true' : 'false');
        dot.addEventListener('click', () => goToMedia(index, true));
        nav.appendChild(dot);
    });
    if (items.length <= 1) nav.hidden = true;
    stage.addEventListener('scroll', () => {
        const index = Math.round(stage.scrollLeft / Math.max(1, stage.clientWidth));
        mediaIndex = Math.max(0, Math.min(index, items.length - 1));
        updateMediaDots(mediaIndex);
    }, { passive: true });
    stage.addEventListener('pointerdown', restartAutoSlide, { passive: true });
    restartAutoSlide();
}

window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
});
window.addEventListener('pointerleave', () => { pointer.active = false; });
window.addEventListener('pointerdown', (e) => {
    pointer.pulseX = e.clientX;
    pointer.pulseY = e.clientY;
    pointer.pulse = 1;
    pointer.active = true;
});
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuild, 120);
});
prefersDark.addEventListener?.('change', rebuild);

initMedia();
rebuild();
requestAnimationFrame(animate);


const copyrightYear = document.getElementById("copyrightYear");
if (copyrightYear) copyrightYear.textContent = String(new Date().getFullYear());
