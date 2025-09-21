'use client';

import { useEffect, useRef, useState } from 'react';

const LightLeakBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create noise texture
    const createNoiseTexture = () => {
      const noiseCanvas = document.createElement('canvas');
      const noiseCtx = noiseCanvas.getContext('2d');
      noiseCanvas.width = 256;
      noiseCanvas.height = 256;
      
      if (!noiseCtx) return null;
      
      const imageData = noiseCtx.createImageData(256, 256);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 40 - 20;
        data[i] = noise;
        data[i + 1] = noise;
        data[i + 2] = noise;
        data[i + 3] = 25;
      }
      
      noiseCtx.putImageData(imageData, 0, 0);
      return noiseCanvas;
    };

    const noiseTexture = createNoiseTexture();

    // Real light leak properties - now moves randomly
    const lightLeak = {
      x: canvas.width * Math.random(),
      y: canvas.height * Math.random(),
      dx: (Math.random() - 0.5) * 2.0, // horizontal speed (-1.0 to 1.0)
      dy: (Math.random() - 0.5) * 2.0, // vertical speed
      intensity: 0.6 + Math.random() * 0.3,
      size: 0.8 + Math.random() * 0.4,
      wobbleAmplitudeX: 20 + Math.random() * 40,
      wobbleAmplitudeY: 30 + Math.random() * 50,
      wobbleFreqX: 0.01 + Math.random() * 0.02,
      wobbleFreqY: 0.008 + Math.random() * 0.015,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      flickerIntensity: 0,
    };

    let animationId: number;
    let time = 0;

    const animate = () => {
      // Clear with deep black
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 0.016; // Timing for smooth movement

      // Move randomly across screen
      lightLeak.x += lightLeak.dx * 2; // speed multiplier for faster movement
      lightLeak.y += lightLeak.dy * 2;

      // Add organic wobbling motion
      const wobbleX = Math.sin(time * lightLeak.wobbleFreqX + lightLeak.phaseX) * lightLeak.wobbleAmplitudeX;
      const wobbleY =
        Math.sin(time * lightLeak.wobbleFreqY + lightLeak.phaseY) * lightLeak.wobbleAmplitudeY +
        Math.cos(time * lightLeak.wobbleFreqY * 1.3 + lightLeak.phaseY) * (lightLeak.wobbleAmplitudeY * 0.3);

      const currentX = lightLeak.x + wobbleX;
      const currentY = lightLeak.y + wobbleY;

      // Reset when moving too far off screen
      if (
        lightLeak.x < -canvas.width * 0.5 ||
        lightLeak.x > canvas.width * 1.5 ||
        lightLeak.y < -canvas.height * 0.5 ||
        lightLeak.y > canvas.height * 1.5
      ) {
        lightLeak.x = canvas.width * Math.random();
        lightLeak.y = canvas.height * Math.random();
        lightLeak.dx = (Math.random() - 0.5) * 2.0;
        lightLeak.dy = (Math.random() - 0.5) * 2.0;
        lightLeak.intensity = 0.5 + Math.random() * 0.4;
        lightLeak.size = 0.7 + Math.random() * 0.5;
        lightLeak.wobbleAmplitudeX = 15 + Math.random() * 45;
        lightLeak.wobbleAmplitudeY = 25 + Math.random() * 55;
        lightLeak.wobbleFreqX = 0.008 + Math.random() * 0.025;
        lightLeak.wobbleFreqY = 0.006 + Math.random() * 0.018;
        lightLeak.phaseX = Math.random() * Math.PI * 2;
        lightLeak.phaseY = Math.random() * Math.PI * 2;
      }

      // Dynamic intensity with subtle flicker
      const basePulse = Math.sin(time * 0.8) * 0.1 + 0.9;
      lightLeak.flickerIntensity = Math.random() < 0.08 ? Math.random() * 0.25 : 0;
      const currentIntensity = lightLeak.intensity * basePulse + lightLeak.flickerIntensity;

      // Main light leak with authentic film characteristics
      const mainRadius = (canvas.width * 0.6 + canvas.height * 0.4) * lightLeak.size;
      const mainGradient = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, mainRadius);

      mainGradient.addColorStop(0, `rgba(255, 120, 40, ${currentIntensity * 0.45})`);
      mainGradient.addColorStop(0.15, `rgba(255, 90, 20, ${currentIntensity * 0.35})`);
      mainGradient.addColorStop(0.35, `rgba(200, 60, 10, ${currentIntensity * 0.2})`);
      mainGradient.addColorStop(0.6, `rgba(120, 40, 5, ${currentIntensity * 0.1})`);
      mainGradient.addColorStop(0.85, `rgba(60, 20, 0, ${currentIntensity * 0.05})`);
      mainGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = mainGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Secondary organic blob
      const secondaryOffsetX = Math.sin(time * 1.2 + lightLeak.phaseX) * 30;
      const secondaryOffsetY = Math.cos(time * 0.9 + lightLeak.phaseY) * 40;
      const secondaryGradient = ctx.createRadialGradient(
        currentX + secondaryOffsetX,
        currentY + secondaryOffsetY,
        0,
        currentX + secondaryOffsetX,
        currentY + secondaryOffsetY,
        mainRadius * 0.7
      );

      secondaryGradient.addColorStop(0, `rgba(255, 150, 80, ${currentIntensity * 0.2})`);
      secondaryGradient.addColorStop(0.4, `rgba(255, 100, 40, ${currentIntensity * 0.12})`);
      secondaryGradient.addColorStop(0.8, `rgba(180, 70, 20, ${currentIntensity * 0.06})`);
      secondaryGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = secondaryGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Animated film grain
      if (noiseTexture) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.25 + Math.sin(time * 15) * 0.05;
        const noiseOffsetX = Math.sin(time * 12) * 4;
        const noiseOffsetY = Math.cos(time * 8) * 4;
        ctx.translate(noiseOffsetX, noiseOffsetY);
        const pattern = ctx.createPattern(noiseTexture, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);
        }
        ctx.restore();
      }

      // Dust particles
      if (Math.random() < 0.4) {
        for (let i = 0; i < 5; i++) {
          const dustX = Math.random() * canvas.width;
          const dustY = Math.random() * canvas.height;
          const dustSize = Math.random() * 2 + 0.5;
          const dustOpacity = Math.random() * 0.4 + 0.1;
          const dustDriftX = Math.sin(time * 3 + dustX * 0.01) * 0.5;
          const dustDriftY = Math.cos(time * 2 + dustY * 0.01) * 0.3;
          ctx.save();
          ctx.fillStyle = `rgba(255, 200, 100, ${dustOpacity})`;
          ctx.beginPath();
          ctx.arc(dustX + dustDriftX, dustY + dustDriftY, dustSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Bright flashes
      if (Math.random() < 0.005) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255, 180, 0, 0.1)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [isClient]);

  if (!isClient) {
    return (
      <div
        className="fixed top-0 left-0 w-full h-full -z-10"
        style={{ backgroundColor: '#0a0a0a' }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10"
      style={{
        pointerEvents: 'none',
        backgroundColor: '#0a0a0a',
      }}
    />
  );
};

export default LightLeakBackground;
