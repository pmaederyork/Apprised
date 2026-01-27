// Space Theme Star Field System
class StarField {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.starCount = 150;
        this.mouse = { x: null, y: null, radius: 100 };

        this.init();
    }

    init() {
        this.resizeCanvas();
        this.createStars();
        this.animate();
        this.bindEvents();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createStars() {
        this.stars = [];
        for (let i = 0; i < this.starCount; i++) {
            const starType = Math.random();
            let color, size, twinkleSpeed;

            // Variety of star types
            if (starType < 0.6) {
                // White stars (most common)
                color = 'rgba(255, 255, 255,';
                size = Math.random() * 1.5 + 0.5;
            } else if (starType < 0.85) {
                // Blue-white stars
                color = 'rgba(191, 219, 254,';
                size = Math.random() * 2 + 0.5;
            } else {
                // Warm stars
                color = 'rgba(254, 243, 199,';
                size = Math.random() * 2.5 + 1;
            }

            twinkleSpeed = Math.random() * 0.02 + 0.005;
            const twinkleOffset = Math.random() * Math.PI * 2;

            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                baseSize: size,
                size: size,
                color: color,
                twinkleSpeed: twinkleSpeed,
                twinkleOffset: twinkleOffset,
                baseOpacity: Math.random() * 0.5 + 0.5,
                opacity: 1
            });
        }
    }

    drawStars(time) {
        this.stars.forEach(star => {
            // Static stars - no blinking, just steady glow
            const opacity = star.baseOpacity;
            const size = star.baseSize;

            // Draw star with subtle glow
            this.ctx.beginPath();

            // Outer glow
            const gradient = this.ctx.createRadialGradient(
                star.x, star.y, 0,
                star.x, star.y, size * 2
            );
            gradient.addColorStop(0, star.color + opacity + ')');
            gradient.addColorStop(0.5, star.color + (opacity * 0.2) + ')');
            gradient.addColorStop(1, 'transparent');

            this.ctx.fillStyle = gradient;
            this.ctx.arc(star.x, star.y, size * 2, 0, Math.PI * 2);
            this.ctx.fill();

            // Core
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = star.color + opacity + ')';
            this.ctx.fill();
        });
    }

    animate(time = 0) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawStars(time);
        requestAnimationFrame((t) => this.animate(t));
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.createStars();
        });
    }
}

// Parallax Controller
class ParallaxController {
    constructor() {
        this.layers = {
            starsFar: document.querySelector('.stars-far'),
            starsMid: document.querySelector('.stars-mid'),
            nebula: document.querySelector('.nebula')
        };

        // Strong parallax speeds for dramatic depth effect
        this.speeds = {
            starsFar: 0.15,
            starsMid: 0.35,
            nebula: 0.25
        };

        this.init();
    }

    init() {
        if (!this.layers.starsFar) return;

        window.addEventListener('scroll', () => this.onScroll(), { passive: true });
        this.onScroll();
    }

    onScroll() {
        const scrollY = window.pageYOffset;

        Object.keys(this.layers).forEach(key => {
            if (this.layers[key]) {
                const speed = this.speeds[key];
                const yPos = -(scrollY * speed);
                this.layers[key].style.transform = `translate3d(0, ${yPos}px, 0)`;
            }
        });
    }
}

// Shooting Star Generator
class ShootingStarGenerator {
    constructor() {
        this.container = document.body;
        this.minInterval = 3000;  // Minimum ms between shooting stars
        this.maxInterval = 8000; // Maximum ms between shooting stars

        this.init();
    }

    init() {
        this.scheduleNext();
    }

    scheduleNext() {
        const delay = Math.random() * (this.maxInterval - this.minInterval) + this.minInterval;
        setTimeout(() => {
            this.createShootingStar();
            this.scheduleNext();
        }, delay);
    }

    createShootingStar() {
        const star = document.createElement('div');
        star.className = 'shooting-star';

        // Random starting position (top portion of screen)
        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * (window.innerHeight * 0.4);

        // Random angle (mostly downward diagonal)
        const angle = Math.random() * 30 + 15; // 15-45 degrees
        const distance = Math.random() * 300 + 200;

        // Calculate end position
        const endX = startX + Math.cos(angle * Math.PI / 180) * distance;
        const endY = startY + Math.sin(angle * Math.PI / 180) * distance;

        // Style the shooting star
        star.style.cssText = `
            position: fixed;
            left: ${startX}px;
            top: ${startY}px;
            width: ${Math.random() * 2 + 1}px;
            height: ${Math.random() * 2 + 1}px;
            background: linear-gradient(${angle + 180}deg, #ffffff, transparent);
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
            box-shadow: 0 0 6px 2px rgba(255, 255, 255, 0.6);
        `;

        this.container.appendChild(star);

        // Animate
        const duration = Math.random() * 500 + 300;

        star.animate([
            {
                transform: 'translate(0, 0) scale(1)',
                opacity: 1
            },
            {
                transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0)`,
                opacity: 0
            }
        ], {
            duration: duration,
            easing: 'linear'
        }).onfinish = () => star.remove();
    }
}

// Smooth scroll for navigation
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Scroll-triggered animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .cta-section').forEach(el => {
        observer.observe(el);
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize star field
    new StarField('starField');

    // Initialize parallax
    new ParallaxController();

    // Initialize shooting stars
    new ShootingStarGenerator();

    // Initialize other features
    initSmoothScroll();
    initScrollAnimations();

    // Add cosmic glow effect to CTA buttons on hover
    document.querySelectorAll('.cta-primary').forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.boxShadow = '0 0 40px rgba(124, 58, 237, 0.6), 0 0 80px rgba(124, 58, 237, 0.3)';
        });

        button.addEventListener('mouseleave', function() {
            this.style.boxShadow = '0 0 20px rgba(124, 58, 237, 0.4)';
        });
    });
});
