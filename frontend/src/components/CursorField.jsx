import { useEffect, useRef } from "react";

function CursorField({ variant = "auth", enableClickBurst = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let animationFrameId;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      lastMoved: Date.now(),
    };

    const ripples = [];
    const bursts = [];
    const dots = [];

    const isAuth = variant === "auth";
    const dotCount = isAuth ? 20 : 35;

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    for (let index = 0; index < dotCount; index += 1) {
      dots.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (isAuth ? 0.4 : 0.6),
        vy: isAuth ? -0.3 - Math.random() * 0.5 : (Math.random() - 0.5) * 0.6,
        radius: isAuth ? 1.5 + Math.random() * 2 : 1.2 + Math.random() * 1.8,
        color: index % 3 === 0 ? "rgba(232, 162, 75, " : "rgba(79, 70, 229, ",
        alpha: 0.2 + Math.random() * 0.35,
      });
    }

    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = event.clientX - rect.left;
      mouse.targetY = event.clientY - rect.top;
      mouse.lastMoved = Date.now();
    };

    const handleClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      if (isAuth) {
        ripples.push({ x: clickX, y: clickY, radius: 4, maxRadius: 80, alpha: 0.5 });
      }

      if (enableClickBurst || (!isAuth && enableClickBurst)) {
        const particleCount = 12;
        for (let index = 0; index < particleCount; index += 1) {
          const angle = (Math.PI * 2 * index) / particleCount + (Math.random() - 0.5) * 0.3;
          const speed = 1.5 + Math.random() * 2.5;
          bursts.push({
            x: clickX,
            y: clickY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            decay: 0.03 + Math.random() * 0.02,
            size: 2 + Math.random() * 2,
            color: Math.random() > 0.4 ? "rgba(232, 162, 75," : "rgba(99, 102, 241,",
          });
        }
      }
    };

    const parentElement = canvas.parentElement || window;
    parentElement.addEventListener("mousemove", handleMouseMove);
    parentElement.addEventListener("click", handleClick);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const lerpFactor = isAuth ? 0.12 : 0.06;
      mouse.x += (mouse.targetX - mouse.x) * lerpFactor;
      mouse.y += (mouse.targetY - mouse.y) * lerpFactor;

      const idleTime = Date.now() - mouse.lastMoved;
      const cursorAlpha = Math.max(0, 1 - idleTime / 1600);

      if (mouse.x > -500 && cursorAlpha > 0) {
        const glowRadius = isAuth ? 120 : 160;
        const radialGradient = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          glowRadius
        );
        if (isAuth) {
          radialGradient.addColorStop(0, `rgba(232, 162, 75, ${0.14 * cursorAlpha})`);
          radialGradient.addColorStop(0.5, `rgba(232, 162, 75, ${0.05 * cursorAlpha})`);
          radialGradient.addColorStop(1, "rgba(232, 162, 75, 0)");
        } else {
          radialGradient.addColorStop(0, "rgba(232, 162, 75, 0.12)");
          radialGradient.addColorStop(0.4, "rgba(79, 70, 229, 0.06)");
          radialGradient.addColorStop(1, "rgba(11, 18, 32, 0)");
        }
        ctx.fillStyle = radialGradient;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isAuth) {
        dots.forEach((dot) => {
          dot.y += dot.vy;
          dot.x += dot.vx + Math.sin(dot.y * 0.02) * 0.2;

          if (dot.y < -10) {
            dot.y = height + 10;
            dot.x = Math.random() * width;
          }
          if (dot.x < -10) dot.x = width + 10;
          if (dot.x > width + 10) dot.x = -10;

          if (mouse.x > -500) {
            const dx = mouse.x - dot.x;
            const dy = mouse.y - dot.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 150) {
              const force = (1 - dist / 150) * 0.6;
              dot.x += (dx / dist) * force;
              dot.y += (dy / dist) * force;
            }
          }

          ctx.fillStyle = `${dot.color}${dot.alpha})`;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        for (let index = ripples.length - 1; index >= 0; index -= 1) {
          const ripple = ripples[index];
          ripple.radius += 2.5;
          ripple.alpha -= 0.015;

          if (ripple.alpha <= 0 || ripple.radius >= ripple.maxRadius) {
            ripples.splice(index, 1);
          } else {
            ctx.strokeStyle = `rgba(232, 162, 75, ${ripple.alpha})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      } else {
        dots.forEach((dot) => {
          dot.x += dot.vx;
          dot.y += dot.vy;

          if (dot.x < 0 || dot.x > width) dot.vx *= -1;
          if (dot.y < 0 || dot.y > height) dot.vy *= -1;

          ctx.fillStyle = `${dot.color}${dot.alpha})`;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        for (let i = 0; i < dots.length; i += 1) {
          for (let j = i + 1; j < dots.length; j += 1) {
            const dx = dots[i].x - dots[j].x;
            const dy = dots[i].y - dots[j].y;
            const dist = Math.hypot(dx, dy);

            if (dist < 100) {
              const lineAlpha = (1 - dist / 100) * 0.12;
              ctx.strokeStyle = `rgba(232, 162, 75, ${lineAlpha})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(dots[i].x, dots[i].y);
              ctx.lineTo(dots[j].x, dots[j].y);
              ctx.stroke();
            }
          }

          if (mouse.x > -500) {
            const dx = dots[i].x - mouse.x;
            const dy = dots[i].y - mouse.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 120) {
              const lineAlpha = (1 - dist / 120) * 0.16;
              ctx.strokeStyle = `rgba(99, 102, 241, ${lineAlpha})`;
              ctx.lineWidth = 0.9;
              ctx.beginPath();
              ctx.moveTo(dots[i].x, dots[i].y);
              ctx.lineTo(mouse.x, mouse.y);
              ctx.stroke();
            }
          }
        }
      }

      for (let index = bursts.length - 1; index >= 0; index -= 1) {
        const particle = bursts[index];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;

        if (particle.life <= 0) {
          bursts.splice(index, 1);
        } else {
          ctx.fillStyle = `${particle.color}${particle.life * 0.6})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      parentElement.removeEventListener("mousemove", handleMouseMove);
      parentElement.removeEventListener("click", handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [variant, enableClickBurst]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

export default CursorField;
