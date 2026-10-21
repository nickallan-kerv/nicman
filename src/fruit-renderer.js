import { FRUIT_TILE } from "./config.js";
import { tileCenterToPixels } from "./grid.js";

export function createFruitRenderer({ state, clock, dom }) {
  const { ctx } = dom;
  const { fruit, powerApple } = state;

  const APPLE_RENDER_STYLE = {
    regular: {
      body: "#38c866",
      stem: "#7f4e2c",
      leaf: "#62d77a"
    },
    power: {
      body: "#39d66b",
      stem: "#ffdca3",
      leaf: "#66cc7a"
    }
  };

  function drawAppleStemAndLeaf(center, options) {
    const {
      stemColor,
      leafColor,
      lineWidth,
      stemStart,
      stemControl,
      stemEnd,
      leafCenter,
      leafRadius,
      leafRotation
    } = options;

    ctx.strokeStyle = stemColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(center.x + stemStart.x, center.y + stemStart.y);
    ctx.quadraticCurveTo(
      center.x + stemControl.x,
      center.y + stemControl.y,
      center.x + stemEnd.x,
      center.y + stemEnd.y
    );
    ctx.stroke();

    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.ellipse(
      center.x + leafCenter.x,
      center.y + leafCenter.y,
      leafRadius.x,
      leafRadius.y,
      leafRotation,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  function drawFruit() {
    if (!fruit.active) {
      return;
    }

    const center = tileCenterToPixels(FRUIT_TILE);
    const pulse = 1 + Math.sin(clock.now() * 0.01) * 0.08;

    if (fruit.kind === "cherry") {
      ctx.fillStyle = "#d92d43";
      ctx.beginPath();
      ctx.arc(center.x - 4, center.y + 2, 5 * pulse, 0, Math.PI * 2);
      ctx.arc(center.x + 4, center.y + 2, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffe59a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(center.x - 4, center.y - 2);
      ctx.quadraticCurveTo(center.x - 1, center.y - 10, center.x + 2, center.y - 8);
      ctx.moveTo(center.x + 4, center.y - 2);
      ctx.quadraticCurveTo(center.x + 6, center.y - 10, center.x + 2, center.y - 8);
      ctx.stroke();

      ctx.fillStyle = "#5dcf72";
      ctx.beginPath();
      ctx.ellipse(center.x + 6, center.y - 10, 4, 2.4, -0.35, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (fruit.kind === "strawberry") {
      ctx.fillStyle = "#e83b56";
      ctx.beginPath();
      ctx.ellipse(center.x, center.y + 1, 8 * pulse, 9.5 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd86b";
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(center.x + Math.cos(a) * 4, center.y + 2 + Math.sin(a) * 4, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#5dcf72";
      ctx.beginPath();
      ctx.moveTo(center.x - 5, center.y - 7);
      ctx.lineTo(center.x, center.y - 12);
      ctx.lineTo(center.x + 5, center.y - 7);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (fruit.kind === "orange") {
      ctx.fillStyle = "#ff9a28";
      ctx.beginPath();
      ctx.arc(center.x, center.y + 1, 8 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffc56a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(center.x, center.y + 1, 5.6 * pulse, -0.6, 0.9);
      ctx.stroke();
      return;
    }

    if (fruit.kind === "apple") {
      ctx.fillStyle = APPLE_RENDER_STYLE.regular.body;
      ctx.beginPath();
      ctx.arc(center.x, center.y + 2, 8.2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      drawAppleStemAndLeaf(center, {
        stemColor: APPLE_RENDER_STYLE.regular.stem,
        leafColor: APPLE_RENDER_STYLE.regular.leaf,
        lineWidth: 2,
        stemStart: { x: 0, y: -7 },
        stemControl: { x: 1, y: -11 },
        stemEnd: { x: 3, y: -10 },
        leafCenter: { x: 5, y: -8 },
        leafRadius: { x: 3.8, y: 2.4 },
        leafRotation: -0.4
      });
      return;
    }

    if (fruit.kind === "melon") {
      ctx.fillStyle = "#4cc66a";
      ctx.beginPath();
      ctx.arc(center.x, center.y + 1, 8.3 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2f8f47";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(center.x, center.y + 1, 5.4 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (fruit.kind === "galaxian") {
      ctx.fillStyle = "#6de6ff";
      ctx.beginPath();
      ctx.moveTo(center.x, center.y - 9);
      ctx.lineTo(center.x + 9, center.y + 4);
      ctx.lineTo(center.x + 2, center.y + 9);
      ctx.lineTo(center.x - 2, center.y + 9);
      ctx.lineTo(center.x - 9, center.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff5f8a";
      ctx.beginPath();
      ctx.arc(center.x, center.y + 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (fruit.kind === "bell") {
      ctx.fillStyle = "#ffd74f";
      ctx.beginPath();
      ctx.moveTo(center.x - 7, center.y + 5);
      ctx.quadraticCurveTo(center.x - 7, center.y - 7, center.x, center.y - 8);
      ctx.quadraticCurveTo(center.x + 7, center.y - 7, center.x + 7, center.y + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#6da8ff";
      ctx.beginPath();
      ctx.arc(center.x, center.y + 6, 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Key (default/fallback for highest levels)
    ctx.strokeStyle = "#ffe27a";
    ctx.fillStyle = "#ffe27a";
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.arc(center.x - 3, center.y - 1, 4.2 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(center.x + 1, center.y - 1);
    ctx.lineTo(center.x + 10, center.y - 1);
    ctx.lineTo(center.x + 10, center.y + 2);
    ctx.lineTo(center.x + 7, center.y + 2);
    ctx.lineTo(center.x + 7, center.y + 5);
    ctx.lineTo(center.x + 5, center.y + 5);
    ctx.lineTo(center.x + 5, center.y + 2);
    ctx.lineTo(center.x + 1, center.y + 2);
    ctx.closePath();
    ctx.fill();

    // Cherry-style fruit with stem and leaf.
    ctx.fillStyle = "#d92d43";
    ctx.beginPath();
    ctx.arc(center.x - 4, center.y + 2, 5 * pulse, 0, Math.PI * 2);
    ctx.arc(center.x + 4, center.y + 2, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffe59a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x - 4, center.y - 2);
    ctx.quadraticCurveTo(center.x - 1, center.y - 10, center.x + 2, center.y - 8);
    ctx.moveTo(center.x + 4, center.y - 2);
    ctx.quadraticCurveTo(center.x + 6, center.y - 10, center.x + 2, center.y - 8);
    ctx.stroke();

    ctx.fillStyle = "#5dcf72";
    ctx.beginPath();
    ctx.ellipse(center.x + 6, center.y - 10, 4, 2.4, -0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPowerApple() {
    if (!powerApple.active) {
      return;
    }

    const center = tileCenterToPixels({ x: powerApple.x, y: powerApple.y });
    const pulse = 0.92 + Math.sin(clock.now() / 140) * 0.08;
    const radius = 8.2 * pulse;

    ctx.fillStyle = APPLE_RENDER_STYLE.power.body;
    ctx.beginPath();
    ctx.arc(center.x - 4, center.y + 1.5, radius * 0.8, 0, Math.PI * 2);
    ctx.arc(center.x + 4, center.y + 1.5, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    drawAppleStemAndLeaf(center, {
      stemColor: APPLE_RENDER_STYLE.power.stem,
      leafColor: APPLE_RENDER_STYLE.power.leaf,
      lineWidth: 1.8,
      stemStart: { x: 0, y: -1 },
      stemControl: { x: 1, y: -11 },
      stemEnd: { x: 5, y: -10 },
      leafCenter: { x: 7, y: -10 },
      leafRadius: { x: 3.8, y: 2.2 },
      leafRotation: -0.45
    });
  }

  return { drawFruit, drawPowerApple };
}
