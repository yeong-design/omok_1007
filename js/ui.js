/**
 * UI and Canvas Controller for 15x15 Gomoku
 */

import { EMPTY, BLACK, WHITE, BOARD_SIZE, OmokGame } from './omok.js';
import { GomokuAI } from './ai.js';

class SoundEffects {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
    }

    playPlaceStone() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Wooden thud / snap sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    playWin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const start = this.ctx.currentTime + idx * 0.1;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.3, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(start);
            osc.stop(start + 0.4);
        });
    }
}

export class GomokuUI {
    constructor() {
        this.game = new OmokGame(BOARD_SIZE);
        this.ai = new GomokuAI('medium');
        this.sound = new SoundEffects();

        // Game Configuration
        this.gameMode = 'pvai'; // 'pvp' or 'pvai'
        this.humanColor = BLACK; // When pvai: human plays BLACK or WHITE
        this.showMoveNumbers = false;
        this.isAIThinking = false;

        // Canvas & Dimensions
        this.canvas = document.getElementById('board-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.hoverCell = null;

        this.initDimensions();
        this.bindEvents();
        this.updateUI();
        this.render();
    }

    initDimensions() {
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = 600;
        const displayHeight = 600;

        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.canvas.style.width = `${displayWidth}px`;
        this.canvas.style.height = `${displayHeight}px`;

        this.ctx.scale(dpr, dpr);

        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
        this.padding = 36;
        this.gridSize = (displayWidth - this.padding * 2) / (BOARD_SIZE - 1);
        this.stoneRadius = this.gridSize * 0.44;
    }

    bindEvents() {
        // Canvas events
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Buttons
        document.getElementById('btn-new-game').addEventListener('click', () => this.startNewGame());
        document.getElementById('btn-undo').addEventListener('click', () => this.handleUndo());
        document.getElementById('btn-redo').addEventListener('click', () => this.handleRedo());
        
        // Mode & Difficulty
        document.getElementById('select-mode').addEventListener('change', (e) => {
            this.gameMode = e.target.value;
            const aiSettings = document.getElementById('ai-settings');
            if (this.gameMode === 'pvai') {
                aiSettings.style.display = 'flex';
            } else {
                aiSettings.style.display = 'none';
            }
            this.startNewGame();
        });

        document.getElementById('select-player-color').addEventListener('change', (e) => {
            this.humanColor = parseInt(e.target.value, 10);
            this.startNewGame();
        });

        document.getElementById('select-difficulty').addEventListener('change', (e) => {
            this.ai.setDifficulty(e.target.value);
        });

        document.getElementById('toggle-numbers').addEventListener('change', (e) => {
            this.showMoveNumbers = e.target.checked;
            this.render();
        });

        document.getElementById('toggle-sound').addEventListener('change', (e) => {
            this.sound.enabled = e.target.checked;
        });

        // Modal close
        document.getElementById('btn-modal-restart').addEventListener('click', () => {
            document.getElementById('win-modal').classList.remove('active');
            this.startNewGame();
        });
    }

    startNewGame() {
        this.game.reset();
        this.isAIThinking = false;
        this.hoverCell = null;
        document.getElementById('win-modal').classList.remove('active');
        this.updateUI();
        this.render();

        // If AI is Black (First player), trigger AI move
        if (this.gameMode === 'pvai' && this.humanColor === WHITE) {
            this.triggerAIMove();
        }
    }

    handleCanvasClick(e) {
        if (this.game.isGameOver || this.isAIThinking) return;

        const cell = this.getGridCoord(e);
        if (!cell) return;

        if (this.gameMode === 'pvai') {
            // Human move
            if (this.game.currentTurn !== this.humanColor) return;

            if (this.game.placeStone(cell.row, cell.col)) {
                this.sound.playPlaceStone();
                this.updateUI();
                this.render();

                if (this.game.isGameOver) {
                    this.handleGameOver();
                } else {
                    this.triggerAIMove();
                }
            }
        } else {
            // 2P PvP Move
            if (this.game.placeStone(cell.row, cell.col)) {
                this.sound.playPlaceStone();
                this.updateUI();
                this.render();

                if (this.game.isGameOver) {
                    this.handleGameOver();
                }
            }
        }
    }

    triggerAIMove() {
        if (this.game.isGameOver) return;

        this.isAIThinking = true;
        this.updateUI();

        const aiPlayer = this.game.currentTurn;

        // Slight delay for smooth visual feel and async thread execution
        setTimeout(() => {
            const bestMove = this.ai.findBestMove(this.game, aiPlayer);
            if (bestMove && this.game.placeStone(bestMove.row, bestMove.col)) {
                this.sound.playPlaceStone();
            }

            this.isAIThinking = false;
            this.updateUI();
            this.render();

            if (this.game.isGameOver) {
                this.handleGameOver();
            }
        }, 80);
    }

    handleUndo() {
        if (this.isAIThinking) return;

        if (this.gameMode === 'pvai') {
            // In PvAI mode, undo 2 steps (AI move + player move)
            if (this.game.history.length >= 2) {
                this.game.undo();
                this.game.undo();
            } else if (this.game.history.length === 1 && this.game.history[0].player === this.humanColor) {
                this.game.undo();
            }
        } else {
            this.game.undo();
        }

        document.getElementById('win-modal').classList.remove('active');
        this.updateUI();
        this.render();
    }

    handleRedo() {
        if (this.isAIThinking) return;

        if (this.gameMode === 'pvai') {
            // In PvAI mode, redo 2 steps
            if (this.game.redoStack.length >= 2) {
                this.game.redo();
                this.game.redo();
            } else if (this.game.redoStack.length === 1) {
                this.game.redo();
            }
        } else {
            this.game.redo();
        }

        this.updateUI();
        this.render();
        if (this.game.isGameOver) {
            this.handleGameOver();
        }
    }

    handleGameOver() {
        this.sound.playWin();
        const modal = document.getElementById('win-modal');
        const title = document.getElementById('modal-title');
        const desc = document.getElementById('modal-desc');

        if (this.game.winner === EMPTY) {
            title.textContent = '무승부 (Draw)!';
            desc.textContent = '바둑판이 가득 차 무승부로 끝났습니다.';
        } else {
            const winnerName = this.game.winner === BLACK ? '흑돌(Black)' : '백돌(White)';
            let detail = `${winnerName}이 5목을 완성하여 승리했습니다!`;

            if (this.gameMode === 'pvai') {
                if (this.game.winner === this.humanColor) {
                    detail = `🎉 축하합니다! 플레이어(${winnerName})의 승리입니다!`;
                } else {
                    detail = `🤖 AI(${winnerName})의 승리입니다! 다시 도전해보세요.`;
                }
            }
            title.textContent = `${winnerName} 승리!`;
            desc.textContent = detail;
        }

        setTimeout(() => {
            modal.classList.add('active');
        }, 500);
    }

    handleMouseMove(e) {
        if (this.game.isGameOver || this.isAIThinking) {
            this.hoverCell = null;
            this.render();
            return;
        }

        if (this.gameMode === 'pvai' && this.game.currentTurn !== this.humanColor) {
            this.hoverCell = null;
            this.render();
            return;
        }

        const cell = this.getGridCoord(e);
        if (cell && this.game.isValidMove(cell.row, cell.col)) {
            this.hoverCell = cell;
        } else {
            this.hoverCell = null;
        }
        this.render();
    }

    handleMouseLeave() {
        this.hoverCell = null;
        this.render();
    }

    getGridCoord(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const col = Math.round((x - this.padding) / this.gridSize);
        const row = Math.round((y - this.padding) / this.gridSize);

        if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
            const snapX = this.padding + col * this.gridSize;
            const snapY = this.padding + row * this.gridSize;
            const dist = Math.hypot(x - snapX, y - snapY);
            if (dist <= this.gridSize * 0.55) {
                return { row, col };
            }
        }
        return null;
    }

    updateUI() {
        // Turn indicator
        const turnBadge = document.getElementById('current-turn-badge');
        const turnText = document.getElementById('current-turn-text');
        const moveCount = document.getElementById('move-count');

        moveCount.textContent = `총 착수: ${this.game.history.length}수`;

        if (this.game.isGameOver) {
            turnBadge.className = 'turn-indicator-badge done';
            turnText.textContent = '게임 종료';
        } else if (this.isAIThinking) {
            turnBadge.className = 'turn-indicator-badge thinking';
            turnText.textContent = 'AI 연산 중...';
        } else {
            if (this.game.currentTurn === BLACK) {
                turnBadge.className = 'turn-indicator-badge black-turn';
                turnText.textContent = this.gameMode === 'pvai' 
                    ? (this.humanColor === BLACK ? '플레이어 차례 (흑돌)' : 'AI 차례 (흑돌)')
                    : '흑돌 차례 (선공)';
            } else {
                turnBadge.className = 'turn-indicator-badge white-turn';
                turnText.textContent = this.gameMode === 'pvai'
                    ? (this.humanColor === WHITE ? '플레이어 차례 (백돌)' : 'AI 차례 (백돌)')
                    : '백돌 차례 (후공)';
            }
        }

        // Undo / Redo button states
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');

        undoBtn.disabled = this.game.history.length === 0 || this.isAIThinking;
        redoBtn.disabled = this.game.redoStack.length === 0 || this.isAIThinking;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);

        // 1. Draw Wood Board Background
        this.drawBoardBackground(ctx);

        // 2. Draw Grid Lines & Star Points
        this.drawGrid(ctx);

        // 3. Draw Placed Stones
        this.drawStones(ctx);

        // 4. Draw Last Move Marker
        this.drawLastMove(ctx);

        // 5. Draw Winning Line
        if (this.game.winningLine) {
            this.drawWinningHighlight(ctx);
        }

        // 6. Draw Hover Preview
        if (this.hoverCell && !this.game.isGameOver && !this.isAIThinking) {
            this.drawHoverStone(ctx, this.hoverCell.row, this.hoverCell.col);
        }
    }

    drawBoardBackground(ctx) {
        // Wood texture gradient
        const bgGrad = ctx.createLinearGradient(0, 0, this.displayWidth, this.displayHeight);
        bgGrad.addColorStop(0, '#e5b376');
        bgGrad.addColorStop(0.5, '#deb887');
        bgGrad.addColorStop(1, '#c89d5f');

        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.roundRect(0, 0, this.displayWidth, this.displayHeight, 14);
        ctx.fill();

        // Subtle board inner border
        ctx.strokeStyle = '#8d5d2b';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    drawGrid(ctx) {
        ctx.strokeStyle = '#4a2e12';
        ctx.lineWidth = 1;
        ctx.lineCap = 'square';

        // Grid lines
        for (let i = 0; i < BOARD_SIZE; i++) {
            const pos = this.padding + i * this.gridSize;

            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(this.padding, pos);
            ctx.lineTo(this.displayWidth - this.padding, pos);
            ctx.stroke();

            // Vertical line
            ctx.beginPath();
            ctx.moveTo(pos, this.padding);
            ctx.lineTo(pos, this.displayHeight - this.padding);
            ctx.stroke();
        }

        // Outer border line slightly thicker
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.padding,
            this.padding,
            this.displayWidth - this.padding * 2,
            this.displayHeight - this.padding * 2
        );

        // Star points (화점) for 15x15: (3,3), (3,11), (7,7), (11,3), (11,11)
        const starIndices = [3, 7, 11];
        ctx.fillStyle = '#4a2e12';
        for (const r of starIndices) {
            for (const c of starIndices) {
                const cx = this.padding + c * this.gridSize;
                const cy = this.padding + r * this.gridSize;
                ctx.beginPath();
                ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Coordinate labels (A-O, 1-15)
        ctx.fillStyle = '#6b441f';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
        for (let i = 0; i < BOARD_SIZE; i++) {
            const pos = this.padding + i * this.gridSize;
            // Top/Bottom Letters
            ctx.fillText(colLabels[i], pos, this.padding / 2);
            ctx.fillText(colLabels[i], pos, this.displayHeight - this.padding / 2);

            // Left/Right Numbers
            const numLabel = 15 - i;
            ctx.fillText(numLabel.toString(), this.padding / 2, pos);
            ctx.fillText(numLabel.toString(), this.displayWidth - this.padding / 2, pos);
        }
    }

    drawStones(ctx) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const stone = this.game.board[r][c];
                if (stone !== EMPTY) {
                    const x = this.padding + c * this.gridSize;
                    const y = this.padding + r * this.gridSize;
                    this.drawStone(ctx, x, y, stone);
                }
            }
        }

        // Move numbers
        if (this.showMoveNumbers) {
            this.game.history.forEach((move, idx) => {
                const x = this.padding + move.col * this.gridSize;
                const y = this.padding + move.row * this.gridSize;
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = move.player === BLACK ? '#ffffff' : '#111111';
                ctx.fillText((idx + 1).toString(), x, y);
            });
        }
    }

    drawStone(ctx, x, y, player) {
        ctx.save();

        // Drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2.5;
        ctx.shadowOffsetY = 2.5;

        ctx.beginPath();
        ctx.arc(x, y, this.stoneRadius, 0, Math.PI * 2);

        if (player === BLACK) {
            const grad = ctx.createRadialGradient(
                x - this.stoneRadius * 0.3,
                y - this.stoneRadius * 0.3,
                this.stoneRadius * 0.1,
                x,
                y,
                this.stoneRadius
            );
            grad.addColorStop(0, '#555555');
            grad.addColorStop(0.4, '#222222');
            grad.addColorStop(1, '#050505');
            ctx.fillStyle = grad;
        } else {
            const grad = ctx.createRadialGradient(
                x - this.stoneRadius * 0.3,
                y - this.stoneRadius * 0.3,
                this.stoneRadius * 0.1,
                x,
                y,
                this.stoneRadius
            );
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.6, '#f0f0f0');
            grad.addColorStop(1, '#d0d0d0');
            ctx.fillStyle = grad;
        }

        ctx.fill();
        ctx.restore();
    }

    drawHoverStone(ctx, row, col) {
        const x = this.padding + col * this.gridSize;
        const y = this.padding + row * this.gridSize;
        const player = this.game.currentTurn;

        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(x, y, this.stoneRadius, 0, Math.PI * 2);
        ctx.fillStyle = player === BLACK ? '#111111' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = player === BLACK ? '#ffffff' : '#111111';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    drawLastMove(ctx) {
        const last = this.game.getLastMove();
        if (!last) return;

        const x = this.padding + last.col * this.gridSize;
        const y = this.padding + last.row * this.gridSize;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, this.stoneRadius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3344';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    drawWinningHighlight(ctx) {
        if (!this.game.winningLine) return;

        ctx.save();
        for (const [r, c] of this.game.winningLine) {
            const x = this.padding + c * this.gridSize;
            const y = this.padding + r * this.gridSize;

            ctx.beginPath();
            ctx.arc(x, y, this.stoneRadius * 1.15, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e676';
            ctx.lineWidth = 3.5;
            ctx.stroke();
        }
        ctx.restore();
    }
}

// Instantiate UI when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.omokUI = new GomokuUI();
});
