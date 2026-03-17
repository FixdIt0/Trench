// 3D Mine cart tunnel ride — smooth, centered, realistic
export function runTunnelAnimation(
  canvas: HTMLCanvasElement,
  onDone: () => void
) {
  const ctx = canvas.getContext("2d")!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  let t = 0;
  const DURATION = 5;

  // 3D → 2D projection centered on screen
  const proj = (x: number, y: number, z: number) => {
    const fov = 500;
    const s = fov / Math.max(z, 1);
    return { x: cx + x * s, y: cy + y * s, s };
  };

  // Smooth easing
  const ease = (v: number) => v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2;

  // Pre-gen torches
  const torches: { z: number; side: number }[] = [];
  for (let i = 0; i < 16; i++) torches.push({ z: 150 + i * 180, side: i % 2 === 0 ? -1 : 1 });

  function draw() {
    t += 1 / 60;
    const progress = Math.min(t / DURATION, 1);

    // Phase: 0-0.25 = looking at entrance, 0.25-0.9 = riding, 0.9-1 = fade out
    const phase = progress;
    const moveZ = phase < 0.2 ? 0 : ease((phase - 0.2) / 0.7) * 2800;

    // Very subtle sway, not jitter
    const swayX = Math.sin(t * 1.8) * 1.5;
    const swayY = Math.sin(t * 2.5) * 0.8;

    ctx.fillStyle = "#050403";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(swayX, swayY);

    const TW = 180; // tunnel half-width
    const TH = 150; // tunnel half-height
    const SEG = 100;
    const COUNT = 30;

    // Draw tunnel segments back to front
    for (let i = COUNT; i >= 0; i--) {
      const zFar = i * SEG - (moveZ % SEG) + SEG;
      const zNear = zFar - SEG;
      if (zNear < 5) continue;

      const nTL = proj(-TW, -TH, zNear), nTR = proj(TW, -TH, zNear);
      const nBL = proj(-TW, TH, zNear), nBR = proj(TW, TH, zNear);
      const fTL = proj(-TW, -TH, zFar), fTR = proj(TW, -TH, zFar);
      const fBL = proj(-TW, TH, zFar), fBR = proj(TW, TH, zFar);

      const depth = zNear / (COUNT * SEG);
      const lit = Math.max(0, 1 - depth * 1.2);

      // Ceiling gradient
      const ceilGrad = ctx.createLinearGradient(cx, nTL.y, cx, fTL.y);
      ceilGrad.addColorStop(0, `rgba(${35 + lit * 25},${25 + lit * 15},${15 + lit * 8},1)`);
      ceilGrad.addColorStop(1, `rgba(${15 + lit * 10},${10 + lit * 8},${5 + lit * 4},1)`);
      ctx.fillStyle = ceilGrad;
      ctx.beginPath();
      ctx.moveTo(nTL.x, nTL.y); ctx.lineTo(nTR.x, nTR.y);
      ctx.lineTo(fTR.x, fTR.y); ctx.lineTo(fTL.x, fTL.y);
      ctx.fill();

      // Floor
      const floorGrad = ctx.createLinearGradient(cx, nBL.y, cx, fBL.y);
      floorGrad.addColorStop(0, `rgba(${40 + lit * 30},${30 + lit * 20},${18 + lit * 12},1)`);
      floorGrad.addColorStop(1, `rgba(${18 + lit * 12},${12 + lit * 8},${6 + lit * 4},1)`);
      ctx.fillStyle = floorGrad;
      ctx.beginPath();
      ctx.moveTo(nBL.x, nBL.y); ctx.lineTo(nBR.x, nBR.y);
      ctx.lineTo(fBR.x, fBR.y); ctx.lineTo(fBL.x, fBL.y);
      ctx.fill();

      // Left wall
      ctx.fillStyle = `rgba(${28 + lit * 20},${18 + lit * 12},${10 + lit * 6},1)`;
      ctx.beginPath();
      ctx.moveTo(nTL.x, nTL.y); ctx.lineTo(nBL.x, nBL.y);
      ctx.lineTo(fBL.x, fBL.y); ctx.lineTo(fTL.x, fTL.y);
      ctx.fill();

      // Right wall
      ctx.fillStyle = `rgba(${32 + lit * 22},${22 + lit * 14},${12 + lit * 8},1)`;
      ctx.beginPath();
      ctx.moveTo(nTR.x, nTR.y); ctx.lineTo(nBR.x, nBR.y);
      ctx.lineTo(fBR.x, fBR.y); ctx.lineTo(fTR.x, fTR.y);
      ctx.fill();

      // Wooden support beams every 3 segments
      if (i % 3 === 0 && lit > 0.08) {
        const bw = Math.max(2, 10 * nTL.s);
        // Left post
        ctx.fillStyle = `rgba(110,75,35,${lit})`;
        ctx.fillRect(nTL.x - bw / 2, nTL.y, bw, nBL.y - nTL.y);
        // Right post
        ctx.fillRect(nTR.x - bw / 2, nTR.y, bw, nBR.y - nTR.y);
        // Top beam
        const beamH = Math.max(2, 12 * nTL.s);
        ctx.fillStyle = `rgba(120,82,38,${lit})`;
        ctx.fillRect(nTL.x, nTL.y - beamH / 2, nTR.x - nTL.x, beamH);
        // Beam highlight
        ctx.fillStyle = `rgba(160,120,60,${lit * 0.3})`;
        ctx.fillRect(nTL.x, nTL.y - beamH / 2, nTR.x - nTL.x, beamH * 0.3);
        // Shadow under beam
        ctx.fillStyle = `rgba(0,0,0,${lit * 0.2})`;
        ctx.fillRect(nTL.x, nTL.y + beamH * 0.3, nTR.x - nTL.x, beamH * 0.4);
      }

      // Rails
      if (lit > 0.05) {
        const rOff = 50;
        const rl1 = proj(-rOff, TH - 8, zNear), rl2 = proj(-rOff, TH - 8, zFar);
        const rr1 = proj(rOff, TH - 8, zNear), rr2 = proj(rOff, TH - 8, zFar);
        // Rail shadow
        ctx.strokeStyle = `rgba(0,0,0,${lit * 0.3})`;
        ctx.lineWidth = Math.max(1, 5 * rl1.s);
        ctx.beginPath(); ctx.moveTo(rl1.x, rl1.y + 2); ctx.lineTo(rl2.x, rl2.y + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rr1.x, rr1.y + 2); ctx.lineTo(rr2.x, rr2.y + 2); ctx.stroke();
        // Rails (metallic)
        ctx.strokeStyle = `rgba(170,170,180,${lit * 0.6})`;
        ctx.lineWidth = Math.max(1, 3 * rl1.s);
        ctx.beginPath(); ctx.moveTo(rl1.x, rl1.y); ctx.lineTo(rl2.x, rl2.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rr1.x, rr1.y); ctx.lineTo(rr2.x, rr2.y); ctx.stroke();
        // Rail shine
        ctx.strokeStyle = `rgba(220,220,230,${lit * 0.15})`;
        ctx.lineWidth = Math.max(0.5, 1 * rl1.s);
        ctx.beginPath(); ctx.moveTo(rl1.x, rl1.y - 1); ctx.lineTo(rl2.x, rl2.y - 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rr1.x, rr1.y - 1); ctx.lineTo(rr2.x, rr2.y - 1); ctx.stroke();
        // Ties
        if (i % 2 === 0) {
          ctx.strokeStyle = `rgba(90,60,30,${lit * 0.5})`;
          ctx.lineWidth = Math.max(1, 5 * rl1.s);
          ctx.beginPath(); ctx.moveTo(rl1.x - 5 * rl1.s, rl1.y); ctx.lineTo(rr1.x + 5 * rr1.s, rr1.y); ctx.stroke();
        }
      }
    }

    // Torches
    for (const torch of torches) {
      const tz = ((torch.z - moveZ) % 2880 + 2880) % 2880;
      if (tz < 30 || tz > 2600) continue;
      const lit = Math.max(0, 1 - tz / 2600);
      if (lit < 0.05) continue;
      const p = proj(torch.side * (TW - 15), -30, tz);

      // Bracket
      ctx.fillStyle = `rgba(80,60,30,${lit})`;
      ctx.fillRect(p.x - 2 * p.s, p.y, 4 * p.s, 18 * p.s);

      // Flame glow on wall
      const glowR = 50 * p.s;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      glow.addColorStop(0, `rgba(255,140,40,${lit * 0.12})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2); ctx.fill();

      // Flame
      const fh = (6 + Math.sin(t * 6 + torch.z) * 2) * p.s;
      const fw = fh * 0.5;
      // Outer flame
      ctx.fillStyle = `rgba(255,120,20,${lit * 0.8})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - fh * 0.5, fw, fh, 0, 0, Math.PI * 2); ctx.fill();
      // Inner flame
      ctx.fillStyle = `rgba(255,220,80,${lit * 0.9})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - fh * 0.3, fw * 0.4, fh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // "TRENCH" sign at entrance (visible in first phase)
    if (phase < 0.4) {
      const signAlpha = phase < 0.25 ? 1 : Math.max(0, 1 - (phase - 0.25) / 0.15);
      const signZ = 200 - moveZ * 0.3;
      if (signZ > 10) {
        const sl = proj(-TW * 0.8, -TH - 30, signZ);
        const sr = proj(TW * 0.8, -TH - 30, signZ);
        const signW = sr.x - sl.x;
        const signH = signW * 0.25;

        // Board
        ctx.fillStyle = `rgba(60,40,15,${signAlpha})`;
        ctx.fillRect(sl.x, sl.y - signH, signW, signH);
        // Border
        ctx.strokeStyle = `rgba(200,168,78,${signAlpha * 0.6})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sl.x, sl.y - signH, signW, signH);

        // Text
        const fontSize = Math.max(12, signW * 0.22);
        ctx.font = `bold ${fontSize}px Georgia, serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(240,230,211,${signAlpha})`;
        ctx.shadowColor = `rgba(255,224,102,${signAlpha * 0.5})`;
        ctx.shadowBlur = 15;
        ctx.fillText("TRENCH", cx, sl.y - signH * 0.3);
        ctx.shadowBlur = 0;
      }
    }

    // Mine cart at bottom
    const cartW = Math.min(260, W * 0.28);
    const cartH = cartW * 0.35;
    const cartY = H - cartH * 0.6;

    // Cart shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(cx, H - 5, cartW * 0.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cart body (trapezoid)
    const cartGrad = ctx.createLinearGradient(cx, cartY - cartH, cx, H);
    cartGrad.addColorStop(0, "#5a3d1a");
    cartGrad.addColorStop(0.5, "#4a3015");
    cartGrad.addColorStop(1, "#3a2510");
    ctx.fillStyle = cartGrad;
    ctx.beginPath();
    ctx.moveTo(cx - cartW * 0.5, cartY - cartH * 0.3);
    ctx.lineTo(cx - cartW * 0.42, H + 5);
    ctx.lineTo(cx + cartW * 0.42, H + 5);
    ctx.lineTo(cx + cartW * 0.5, cartY - cartH * 0.3);
    ctx.closePath();
    ctx.fill();

    // Cart rim (metal edge)
    ctx.strokeStyle = "#9a7a50";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - cartW * 0.52, cartY - cartH * 0.32);
    ctx.lineTo(cx + cartW * 0.52, cartY - cartH * 0.32);
    ctx.stroke();
    // Rim highlight
    ctx.strokeStyle = "rgba(200,170,100,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - cartW * 0.5, cartY - cartH * 0.35);
    ctx.lineTo(cx + cartW * 0.5, cartY - cartH * 0.35);
    ctx.stroke();

    // Metal bands on cart
    ctx.strokeStyle = "rgba(120,120,130,0.5)";
    ctx.lineWidth = 2;
    for (const xOff of [-0.3, 0, 0.3]) {
      const bx = cx + cartW * xOff;
      ctx.beginPath();
      ctx.moveTo(bx, cartY - cartH * 0.28);
      ctx.lineTo(bx * 0.98 + cx * 0.02, H);
      ctx.stroke();
    }

    // Hands gripping cart
    const handY = cartY - cartH * 0.35;
    for (const side of [-1, 1]) {
      const hx = cx + side * cartW * 0.3;
      // Glove
      ctx.fillStyle = "#7a5a20";
      ctx.beginPath();
      ctx.roundRect(hx - 10, handY - 10, 20, 14, 3);
      ctx.fill();
      // Fingers
      ctx.fillStyle = "#8a6a2a";
      for (let f = 0; f < 4; f++) {
        ctx.fillRect(hx - 8 + f * 5, handY - 2, 4, 8);
      }
    }

    // Light at end of tunnel
    const endGlow = ease(Math.max(0, (phase - 0.5) / 0.5));
    if (endGlow > 0) {
      const gr = 30 + endGlow * 300;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      g.addColorStop(0, `rgba(255,230,150,${endGlow * 0.5})`);
      g.addColorStop(0.4, `rgba(255,200,100,${endGlow * 0.15})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Vignette
    const vig = ctx.createRadialGradient(cx, cy, W * 0.25, cx, cy, W * 0.65);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Final fade to white
    if (phase > 0.85) {
      const fade = (phase - 0.85) / 0.15;
      ctx.fillStyle = `rgba(255,250,240,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();

    if (progress < 1) requestAnimationFrame(draw);
    else onDone();
  }

  requestAnimationFrame(draw);
}
