import { TILE_SIZE, GHOST_GATE_TILE, widthTiles, heightTiles, PACMAN_DEATH_DURATION_MS } from "./config.js";

export function createRenderer({ state, clock, dom, status, mode, fruitRenderer }) {
  const { canvas, ctx } = dom;
  const { pacman, pacmanDeath } = state;
  const { isPacmanGiant, isPacmanShrinking, pacmanHeading } = status;
  const { ghostIsFrightened, frightenedWarningActive, frightenedFlashOn } = mode;
  const { drawFruit, drawPowerApple } = fruitRenderer;

  function drawScorePopups(now) {
    state.scorePopups = state.scorePopups.filter((p) => p.expiresAt > now);
    ctx.font = "bold 16px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    for (const popup of state.scorePopups) {
      const life = Math.max(0, (popup.expiresAt - now) / 900);
      const rise = (1 - life) * 16;
      ctx.globalAlpha = Math.max(0.2, life);
      ctx.fillStyle = "#ffe27a";
      ctx.fillText(popup.text, popup.x, popup.y - rise);
    }
    ctx.globalAlpha = 1;
  }

  function isWallCell(x, y) {
    if (x < 0 || x >= widthTiles || y < 0 || y >= heightTiles) {
      return false;
    }
    return state.map[y][x] === "#";
  }

  function drawWalls() {
    const inset = 2.5;
    const overlap = 1.2;
    const cornerRadius = 11;

    ctx.fillStyle = "#020816";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const segmentPath = new Path2D();
    const cornerPath = new Path2D();

    for (let y = 0; y < heightTiles; y += 1) {
      for (let x = 0; x < widthTiles; x += 1) {
        if (!isWallCell(x, y)) {
          continue;
        }

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (!isWallCell(x, y - 1)) {
          segmentPath.moveTo(px + inset - overlap, py + inset);
          segmentPath.lineTo(px + TILE_SIZE - inset + overlap, py + inset);
        }
        if (!isWallCell(x, y + 1)) {
          segmentPath.moveTo(px + inset - overlap, py + TILE_SIZE - inset);
          segmentPath.lineTo(px + TILE_SIZE - inset + overlap, py + TILE_SIZE - inset);
        }
        if (!isWallCell(x - 1, y)) {
          segmentPath.moveTo(px + inset, py + inset - overlap);
          segmentPath.lineTo(px + inset, py + TILE_SIZE - inset + overlap);
        }
        if (!isWallCell(x + 1, y)) {
          segmentPath.moveTo(px + TILE_SIZE - inset, py + inset - overlap);
          segmentPath.lineTo(px + TILE_SIZE - inset, py + TILE_SIZE - inset + overlap);
        }

        if (!isWallCell(x, y - 1) && !isWallCell(x - 1, y)) {
          cornerPath.moveTo(px + inset + cornerRadius, py + inset);
          cornerPath.arc(
            px + inset + cornerRadius,
            py + inset + cornerRadius,
            cornerRadius,
            -Math.PI / 2,
            Math.PI,
            true
          );
        }
        if (!isWallCell(x, y - 1) && !isWallCell(x + 1, y)) {
          cornerPath.moveTo(px + TILE_SIZE - inset - cornerRadius, py + inset);
          cornerPath.arc(
            px + TILE_SIZE - inset - cornerRadius,
            py + inset + cornerRadius,
            cornerRadius,
            -Math.PI / 2,
            0,
            false
          );
        }
        if (!isWallCell(x, y + 1) && !isWallCell(x - 1, y)) {
          cornerPath.moveTo(px + inset + cornerRadius, py + TILE_SIZE - inset);
          cornerPath.arc(
            px + inset + cornerRadius,
            py + TILE_SIZE - inset - cornerRadius,
            cornerRadius,
            Math.PI / 2,
            Math.PI,
            false
          );
        }
        if (!isWallCell(x, y + 1) && !isWallCell(x + 1, y)) {
          cornerPath.moveTo(px + TILE_SIZE - inset - cornerRadius, py + TILE_SIZE - inset);
          cornerPath.arc(
            px + TILE_SIZE - inset - cornerRadius,
            py + TILE_SIZE - inset - cornerRadius,
            cornerRadius,
            Math.PI / 2,
            0,
            true
          );
        }
      }
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(42, 165, 255, 0.35)";
    ctx.lineWidth = 8;
    ctx.shadowColor = "rgba(42, 165, 255, 0.9)";
    ctx.shadowBlur = 16;
    ctx.stroke(segmentPath);
    ctx.stroke(cornerPath);

    ctx.strokeStyle = "#34b7ff";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = "rgba(122, 217, 255, 0.8)";
    ctx.shadowBlur = 6;
    ctx.stroke(segmentPath);
    ctx.stroke(cornerPath);

    const gateLeft = (GHOST_GATE_TILE.x + 0.05) * TILE_SIZE;
    const gateY = (GHOST_GATE_TILE.y + 0.5) * TILE_SIZE;
    const gateWidth = TILE_SIZE * 0.9;
    ctx.strokeStyle = "#ff66cc";
    ctx.lineWidth = 4;
    ctx.shadowColor = "rgba(255, 102, 204, 0.8)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(gateLeft, gateY);
    ctx.lineTo(gateLeft + gateWidth, gateY);
    ctx.stroke();

    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.shadowBlur = 0;
  }

  function drawPellets() {
    for (let y = 0; y < heightTiles; y += 1) {
      for (let x = 0; x < widthTiles; x += 1) {
        const cell = state.map[y][x];
        if (cell !== "." && cell !== "o") {
          continue;
        }
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        ctx.fillStyle = "#f8f3d4";
        const radius = cell === "o" ? 6 : 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPacman() {
    if (clock.now() < state.pacmanHiddenUntil) {
      return;
    }

    if (pacmanDeath.active) {
      drawPacmanDeath(clock.now());
      return;
    }

    const moving = pacman.dir.x !== 0 || pacman.dir.y !== 0;
    const angle = moving ? Math.abs(Math.sin(pacman.mouth)) * 0.9 : 0.22;
    const heading = pacmanHeading();
    let facing = 0;
    if (heading.x === -1) {
      facing = Math.PI;
    } else if (heading.y === -1) {
      facing = -Math.PI / 2;
    } else if (heading.y === 1) {
      facing = Math.PI / 2;
    }

    ctx.fillStyle = "#ffd447";
    ctx.beginPath();
    ctx.moveTo(pacman.x, pacman.y);
    ctx.arc(
      pacman.x,
      pacman.y,
      pacman.radius,
      facing + angle,
      facing + Math.PI * 2 - angle
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawPacmanDeath(now) {
    const elapsed = Math.max(0, now - pacmanDeath.startedAt);
    const t = Math.min(1, elapsed / PACMAN_DEATH_DURATION_MS);
    const bodyPhaseEnd = 0.8;

    if (t < bodyPhaseEnd) {
      const bodyT = t / bodyPhaseEnd;
      const mouthHalfAngle = bodyT * Math.PI;
      const sweepStart = pacmanDeath.facing + mouthHalfAngle;
      const sweepEnd = pacmanDeath.facing + Math.PI * 2 - mouthHalfAngle;

      ctx.fillStyle = "#ffd447";
      ctx.beginPath();
      ctx.moveTo(pacman.x, pacman.y);
      ctx.arc(
        pacman.x,
        pacman.y,
        pacman.radius,
        sweepStart,
        sweepEnd,
        true
      );
      ctx.closePath();
      ctx.fill();
      return;
    }

    {
      const burstT = (t - bodyPhaseEnd) / (1 - bodyPhaseEnd);
      const rayCount = 12;
      const outerRadius = pacman.radius;
      const innerRadius = outerRadius * 0.5;

      ctx.strokeStyle = `rgba(255, 228, 120, ${Math.max(0, 0.95 - burstT)})`;
      ctx.lineWidth = Math.max(1, 3 - burstT * 2);
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < rayCount; i += 1) {
        const a = (i / rayCount) * Math.PI * 2;
        const x1 = pacman.x + Math.cos(a) * innerRadius;
        const y1 = pacman.y + Math.sin(a) * innerRadius;
        const x2 = pacman.x + Math.cos(a) * outerRadius;
        const y2 = pacman.y + Math.sin(a) * outerRadius;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.lineCap = "butt";
    }
  }

  function drawGhostEyes(ghost, look = null) {
    const eyeOffsetX = 6;
    const eyeOffsetY = -3;
    const pupilTravel = 1.8;
    let lookX = Math.max(-1, Math.min(1, ghost.dir.x));
    let lookY = Math.max(-1, Math.min(1, ghost.dir.y));

    if (look) {
      const len = Math.hypot(look.x, look.y);
      if (len > 0.001) {
        lookX = look.x / len;
        lookY = look.y / len;
      }
    }

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ghost.x - eyeOffsetX, ghost.y + eyeOffsetY, 4.4, 0, Math.PI * 2);
    ctx.arc(ghost.x + eyeOffsetX, ghost.y + eyeOffsetY, 4.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#112244";
    ctx.beginPath();
    ctx.arc(
      ghost.x - eyeOffsetX + lookX * pupilTravel,
      ghost.y + eyeOffsetY + lookY * pupilTravel,
      1.8,
      0,
      Math.PI * 2
    );
    ctx.arc(
      ghost.x + eyeOffsetX + lookX * pupilTravel,
      ghost.y + eyeOffsetY + lookY * pupilTravel,
      1.8,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  function drawGhost(ghost) {
    if (ghost.isReturning) {
      drawGhostEyes(ghost);
      return;
    }

    const now = clock.now();
    const giantVisualActive = isPacmanGiant(now) || isPacmanShrinking();
    const frightened = ghostIsFrightened(ghost, now);
    const flashingWarning = frightened && frightenedWarningActive(now);
    const frightenedColor = flashingWarning && !frightenedFlashOn(now) ? ghost.color : "#3b68ff";
    const color = giantVisualActive ? "#37d65f" : frightened ? frightenedColor : ghost.color;
    const bodyW = ghost.radius * 1.9;
    const bodyH = ghost.radius * 2;
    const frame = Math.floor(now / 130) % 2;
    const skirtA = [0, 6, 0, 6, 0];
    const skirtB = [6, 0, 6, 0, 6];
    const skirt = frame === 0 ? skirtA : skirtB;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y - ghost.radius * 0.25, ghost.radius, Math.PI, 0);
    ctx.lineTo(ghost.x + bodyW / 2, ghost.y + bodyH / 2);

    const waveCount = 4;
    for (let i = waveCount; i >= 0; i -= 1) {
      const wx = ghost.x - bodyW / 2 + (i * bodyW) / waveCount;
      const wy = ghost.y + bodyH / 2 - skirt[i];
      ctx.lineTo(wx, wy);
    }

    ctx.closePath();
    ctx.fill();

    if (frightened) {
      drawGhostEyes(ghost, { x: pacman.x - ghost.x, y: pacman.y - ghost.y });
    } else {
      drawGhostEyes(ghost);
    }
  }

  function render() {
    const now = clock.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWalls();
    drawPellets();
    drawFruit();
    drawPowerApple();
    drawPacman();
    state.ghosts.forEach(drawGhost);
    drawScorePopups(now);
  }

  return { render };
}
