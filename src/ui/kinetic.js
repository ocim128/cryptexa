/**
 * Kinetic Geometry Animation Engine
 * Creates mathematically satisfying motion patterns
 */

// ============================================
// LISSAJOUS CURVE RENDERER
// ============================================

class LissajousRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.time = 0;
        this.animationId = null;

        // Lissajous parameters (a:b ratios create different patterns)
        this.curves = [
            { a: 3, b: 2, delta: Math.PI / 2, speed: 0.008, size: 0.35 },
            { a: 5, b: 4, delta: Math.PI / 4, speed: 0.006, size: 0.25 },
            { a: 3, b: 4, delta: Math.PI / 3, speed: 0.004, size: 0.45 }
        ];

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    // Calculate point on Lissajous curve
    getPoint(curve, t) {
        const amplitude = Math.min(this.centerX, this.centerY) * curve.size;
        const x = amplitude * Math.sin(curve.a * t + curve.delta);
        const y = amplitude * Math.sin(curve.b * t);
        return { x: this.centerX + x, y: this.centerY + y };
    }

    draw() {
        // Fade effect for trail
        this.ctx.fillStyle = 'rgba(15, 17, 21, 0.03)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw each curve's current position
        this.curves.forEach((curve, i) => {
            const point = this.getPoint(curve, this.time * curve.speed);

            // Draw glowing dot
            const gradient = this.ctx.createRadialGradient(
                point.x, point.y, 0,
                point.x, point.y, 8
            );
            gradient.addColorStop(0, `rgba(122, 162, 255, ${0.4 - i * 0.1})`);
            gradient.addColorStop(1, 'transparent');

            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();

            // Small solid center
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(122, 162, 255, ${0.6 - i * 0.15})`;
            this.ctx.fill();
        });

        this.time += 1;
    }

    start() {
        const animate = () => {
            this.draw();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// ============================================
// ORBITAL SYSTEM GENERATOR
// ============================================

function createOrbitalSystem(container) {
    const system = document.createElement('div');
    system.className = 'orbital-system';

    // Create orbital rings
    for (let i = 1; i <= 4; i++) {
        const ring = document.createElement('div');
        ring.className = `orbital-ring orbital-ring--${i}`;
        system.appendChild(ring);
    }

    // Create orbiting shapes
    const shapes = ['circle', 'triangle', 'square', 'diamond'];
    for (let i = 1; i <= 4; i++) {
        const orbiter = document.createElement('div');
        orbiter.className = `orbiter orbiter--${i}`;

        const shape = document.createElement('div');
        shape.className = `orbiter__shape orbiter__shape--${shapes[i - 1]}`;
        orbiter.appendChild(shape);

        system.appendChild(orbiter);
    }

    container.appendChild(system);
    return system;
}

// ============================================
// BREATHING GRID GENERATOR
// ============================================

function createBreathingGrid(container) {
    const grid = document.createElement('div');
    grid.className = 'breathing-grid';

    // Create hexagonal layers
    for (let i = 1; i <= 3; i++) {
        const layer = document.createElement('div');
        layer.className = `breathing-grid__layer breathing-grid__layer--${i}`;

        const hexagon = document.createElement('div');
        hexagon.className = 'breathing-grid__hexagon';
        layer.appendChild(hexagon);

        grid.appendChild(layer);
    }

    container.appendChild(grid);
    return grid;
}

// ============================================
// PENDULUM WAVE LOADER
// ============================================

function createPendulumLoader(container, pendulumCount = 9) {
    const loader = document.createElement('div');
    loader.className = 'pendulum-loader';

    for (let i = 0; i < pendulumCount; i++) {
        const pendulum = document.createElement('div');
        pendulum.className = 'pendulum';
        loader.appendChild(pendulum);
    }

    container.appendChild(loader);
    return loader;
}

// ============================================
// HARMONIC SPINNER
// ============================================

function createHarmonicSpinner(container, dotCount = 5) {
    const spinner = document.createElement('div');
    spinner.className = 'harmonic-spinner';

    for (let i = 0; i < dotCount; i++) {
        const dot = document.createElement('div');
        dot.className = 'harmonic-dot';
        spinner.appendChild(dot);
    }

    container.appendChild(spinner);
    return spinner;
}

// ============================================
// GEAR SYSTEM
// ============================================

function createGearSystem(container) {
    const system = document.createElement('div');
    system.className = 'gear-system';

    for (let i = 1; i <= 3; i++) {
        const gear = document.createElement('div');
        gear.className = `gear gear--${i}`;
        system.appendChild(gear);
    }

    container.appendChild(system);
    return system;
}

// ============================================
// FLOATING PARTICLES
// ============================================

function createFloatingParticles(container, count = 15) {
    const particles = [];

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;

        // Random animation timing
        particle.style.animationDelay = `${Math.random() * 20}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;

        container.appendChild(particle);
        particles.push(particle);
    }

    return particles;
}

// ============================================
// KINETIC RIPPLE EFFECT
// ============================================

function addKineticRipple(element) {
    element.addEventListener('click', (e) => {
        const rect = element.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'kinetic-ripple';

        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);

        ripple.addEventListener('animationend', () => ripple.remove());
    });
}

// ============================================
// MAIN KINETIC INITIALIZATION
// ============================================

let lissajousRenderer = null;

function initKineticBackground(isLanding = false) {
    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return null;
    }

    // Create or get container
    let container = document.querySelector('.kinetic-bg');
    if (!container) {
        container = document.createElement('div');
        container.className = 'kinetic-bg';
        if (isLanding) container.classList.add('kinetic-bg--landing');
        document.body.insertBefore(container, document.body.firstChild);
    }

    // Clear existing content
    container.innerHTML = '';

    if (isLanding) {
        // Full kinetic experience for landing
        createOrbitalSystem(container);
        createBreathingGrid(container);
        createFloatingParticles(container, 12);

        // Add Lissajous canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'lissajous-canvas';
        container.appendChild(canvas);

        lissajousRenderer = new LissajousRenderer(canvas);
        lissajousRenderer.start();
    } else {
        // Subtle particles for main app
        createFloatingParticles(container, 8);
    }

    return container;
}

function destroyKineticBackground() {
    if (lissajousRenderer) {
        lissajousRenderer.stop();
        lissajousRenderer = null;
    }

    const container = document.querySelector('.kinetic-bg');
    if (container) {
        container.remove();
    }
}

// ============================================
// REPLACE DEFAULT LOADER WITH KINETIC LOADER
// ============================================

function replaceLoaderWithKinetic() {
    const loader = document.querySelector('.loader');
    if (!loader) return;

    const spinner = loader.querySelector('.spinner');
    if (spinner) {
        spinner.remove();
        createPendulumLoader(loader);
    }
}

// ============================================
// ADD RIPPLES TO BUTTONS
// ============================================

function initKineticButtons() {
    const buttons = document.querySelectorAll('#menubar-buttons button, .landing button');
    buttons.forEach(btn => addKineticRipple(btn));
}

// ============================================
// EXPORTS
// ============================================

export {
    initKineticBackground,
    destroyKineticBackground,
    createPendulumLoader,
    createHarmonicSpinner,
    createGearSystem,
    createOrbitalSystem,
    createBreathingGrid,
    replaceLoaderWithKinetic,
    initKineticButtons,
    addKineticRipple,
    LissajousRenderer
};
