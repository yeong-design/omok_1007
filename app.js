/**
 * 15x15 Gomoku (오목) - Standalone Universal Game Engine & UI
 * Compatible with both file:// local file execution and http:// server execution.
 */

(function () {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    const EMPTY = 0;
    const BLACK = 1;
    const WHITE = 2;
    const BOARD_SIZE = 15;

    const SCORE = {
        FIVE: 100000000,
        OPEN_FOUR: 10000000,
        BLOCKED_FOUR: 100000,
        OPEN_THREE: 80000,
        BLOCKED_THREE: 1000,
        OPEN_TWO: 1000,
        BLOCKED_TWO: 100,
        ONE: 10
    };

    // -------------------------------------------------------------------------
    // 1. Sound Effects (Web Audio API Synthesizer)
    // -------------------------------------------------------------------------
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
            try {
                this.init();
                if (!this.ctx) return;
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }

                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);

                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + 0.08);
            } catch (e) {
                console.warn('Audio play error:', e);
            }
        }

        playWin() {
            if (!this.enabled) return;
            try {
                this.init();
                if (!this.ctx) return;
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }

                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const start = this.ctx.currentTime + idx * 0.1;

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, start);

                    gain.gain.setValueAtTime(0.3, start);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);

                    osc.start(start);
                    osc.stop(start + 0.35);
                });
            } catch (e) {
                console.warn('Audio play error:', e);
            }
        }
    }

    // -------------------------------------------------------------------------
    // 2. Omok Game Engine
    // -------------------------------------------------------------------------
    class OmokGame {
        constructor(size = BOARD_SIZE) {
            this.size = size;
            this.board = Array.from({ length: size }, () => Array(size).fill(EMPTY));
            this.currentTurn = BLACK;
            this.history = [];
            this.redoStack = [];
            this.isGameOver = false;
            this.winner = EMPTY;
            this.winningLine = null;
        }

        reset() {
            this.board = Array.from({ length: this.size }, () => Array(this.size).fill(EMPTY));
            this.currentTurn = BLACK;
            this.history = [];
            this.redoStack = [];
            this.isGameOver = false;
            this.winner = EMPTY;
            this.winningLine = null;
        }

        isValidMove(row, col) {
            if (this.isGameOver) return false;
            if (row < 0 || row >= this.size || col < 0 || col >= this.size) return false;
            return this.board[row][col] === EMPTY;
        }

        placeStone(row, col) {
            if (!this.isValidMove(row, col)) return false;

            const player = this.currentTurn;
            this.board[row][col] = player;
            this.history.push({ row, col, player });
            this.redoStack = [];

            const winResult = this.checkWin(row, col, player);
            if (winResult) {
                this.isGameOver = true;
                this.winner = player;
                this.winningLine = winResult;
            } else if (this.isBoardFull()) {
                this.isGameOver = true;
                this.winner = EMPTY;
                this.winningLine = null;
            } else {
                this.currentTurn = player === BLACK ? WHITE : BLACK;
            }

            return true;
        }

        undo() {
            if (this.history.length === 0) return null;

            const lastMove = this.history.pop();
            this.board[lastMove.row][lastMove.col] = EMPTY;
            this.redoStack.push(lastMove);

            this.isGameOver = false;
            this.winner = EMPTY;
            this.winningLine = null;
            this.currentTurn = lastMove.player;

            return lastMove;
        }

        redo() {
            if (this.redoStack.length === 0) return null;

            const move = this.redoStack.pop();
            this.board[move.row][move.col] = move.player;
            this.history.push(move);

            const winResult = this.checkWin(move.row, move.col, move.player);
            if (winResult) {
                this.isGameOver = true;
                this.winner = move.player;
                this.winningLine = winResult;
            } else if (this.isBoardFull()) {
                this.isGameOver = true;
                this.winner = EMPTY;
                this.winningLine = null;
            } else {
                this.currentTurn = move.player === BLACK ? WHITE : BLACK;
            }

            return move;
        }

        isBoardFull() {
            return this.history.length >= this.size * this.size;
        }

        getLastMove() {
            if (this.history.length === 0) return null;
            return this.history[this.history.length - 1];
        }

        checkWin(row, col, player = this.board[row][col]) {
            if (player === EMPTY) return null;

            const directions = [
                [[0, 1], [0, -1]],
                [[1, 0], [-1, 0]],
                [[1, 1], [-1, -1]],
                [[1, -1], [-1, 1]]
            ];

            for (const [dir1, dir2] of directions) {
                const line = [[row, col]];

                let r = row + dir1[0];
                let c = col + dir1[1];
                while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
                    line.push([r, c]);
                    r += dir1[0];
                    c += dir1[1];
                }

                r = row + dir2[0];
                c = col + dir2[1];
                while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
                    line.push([r, c]);
                    r += dir2[0];
                    c += dir2[1];
                }

                if (line.length >= 5) {
                    return line;
                }
            }

            return null;
        }
    }

    // -------------------------------------------------------------------------
    // 3. Gomoku AI Engine
    // -------------------------------------------------------------------------
    class GomokuAI {
        constructor(difficulty = 'medium') {
            this.difficulty = difficulty;
        }

        setDifficulty(difficulty) {
            this.difficulty = difficulty;
        }

        findBestMove(game, aiPlayer) {
            const board = game.board;
            const opponent = aiPlayer === BLACK ? WHITE : BLACK;

            if (game.history.length === 0) {
                return { row: 7, col: 7 };
            }

            if (game.history.length === 1) {
                const first = game.history[0];
                const deltas = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
                const validDeltas = deltas.filter(([dr, dc]) => {
                    const r = first.row + dr;
                    const c = first.col + dc;
                    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
                });
                const chosen = validDeltas[Math.floor(Math.random() * validDeltas.length)];
                return { row: first.row + chosen[0], col: first.col + chosen[1] };
            }

            if (this.difficulty === 'easy') {
                return this.getGreedyMove(board, aiPlayer, opponent, true);
            }

            if (this.difficulty === 'medium') {
                return this.getMinimaxMove(board, aiPlayer, opponent, 2, 10);
            }

            if (this.difficulty === 'hard') {
                return this.getMinimaxMove(board, aiPlayer, opponent, 3, 12);
            }

            return this.getGreedyMove(board, aiPlayer, opponent, false);
        }

        getGreedyMove(board, aiPlayer, opponent, addRandomness = false) {
            const candidates = this.getCandidateMoves(board, 2);
            if (candidates.length === 0) return { row: 7, col: 7 };

            let bestScore = -Infinity;
            let bestMoves = [];

            for (const { row, col } of candidates) {
                const attackScore = this.evaluatePoint(board, row, col, aiPlayer);
                const defendScore = this.evaluatePoint(board, row, col, opponent);
                let totalScore = attackScore * 1.1 + defendScore;

                if (addRandomness) {
                    totalScore += Math.random() * (SCORE.OPEN_TWO / 2);
                }

                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestMoves = [{ row, col }];
                } else if (Math.abs(totalScore - bestScore) < 1e-5) {
                    bestMoves.push({ row, col });
                }
            }

            return bestMoves[Math.floor(Math.random() * bestMoves.length)];
        }

        getMinimaxMove(board, aiPlayer, opponent, depth, candidateLimit) {
            const candidates = this.getCandidateMoves(board, 2);
            if (candidates.length === 0) return { row: 7, col: 7 };

            for (const { row, col } of candidates) {
                if (this.evaluatePoint(board, row, col, aiPlayer) >= SCORE.FIVE) {
                    return { row, col };
                }
            }

            for (const { row, col } of candidates) {
                if (this.evaluatePoint(board, row, col, opponent) >= SCORE.FIVE) {
                    return { row, col };
                }
            }

            for (const { row, col } of candidates) {
                if (this.evaluatePoint(board, row, col, aiPlayer) >= SCORE.OPEN_FOUR) {
                    return { row, col };
                }
            }
            for (const { row, col } of candidates) {
                if (this.evaluatePoint(board, row, col, opponent) >= SCORE.OPEN_FOUR) {
                    return { row, col };
                }
            }

            const scoredCandidates = candidates.map(move => {
                const attack = this.evaluatePoint(board, move.row, move.col, aiPlayer);
                const defend = this.evaluatePoint(board, move.row, move.col, opponent);
                return {
                    ...move,
                    score: attack * 1.15 + defend
                };
            });

            scoredCandidates.sort((a, b) => b.score - a.score);
            const topCandidates = scoredCandidates.slice(0, candidateLimit);

            let bestScore = -Infinity;
            let bestMove = topCandidates[0];
            let alpha = -Infinity;
            let beta = Infinity;

            for (const move of topCandidates) {
                board[move.row][move.col] = aiPlayer;
                const score = this.minimax(board, depth - 1, false, alpha, beta, aiPlayer, opponent, candidateLimit);
                board[move.row][move.col] = EMPTY;

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, bestScore);
                if (beta <= alpha) break;
            }

            return { row: bestMove.row, col: bestMove.col };
        }

        minimax(board, depth, isMaximizing, alpha, beta, aiPlayer, opponent, candidateLimit) {
            if (depth === 0) {
                return this.evaluateBoard(board, aiPlayer, opponent);
            }

            const candidates = this.getCandidateMoves(board, 2);
            if (candidates.length === 0) return 0;

            const currentPlayer = isMaximizing ? aiPlayer : opponent;
            const otherPlayer = isMaximizing ? opponent : aiPlayer;

            const scoredCandidates = candidates.map(move => {
                const attack = this.evaluatePoint(board, move.row, move.col, currentPlayer);
                const defend = this.evaluatePoint(board, move.row, move.col, otherPlayer);
                return {
                    ...move,
                    score: attack * 1.1 + defend
                };
            });
            scoredCandidates.sort((a, b) => b.score - a.score);
            const topCandidates = scoredCandidates.slice(0, candidateLimit);

            if (isMaximizing) {
                let maxEval = -Infinity;
                for (const move of topCandidates) {
                    if (this.evaluatePoint(board, move.row, move.col, aiPlayer) >= SCORE.FIVE) {
                        return SCORE.FIVE * 2;
                    }

                    board[move.row][move.col] = aiPlayer;
                    const evaluation = this.minimax(board, depth - 1, false, alpha, beta, aiPlayer, opponent, candidateLimit);
                    board[move.row][move.col] = EMPTY;

                    maxEval = Math.max(maxEval, evaluation);
                    alpha = Math.max(alpha, evaluation);
                    if (beta <= alpha) break;
                }
                return maxEval;
            } else {
                let minEval = Infinity;
                for (const move of topCandidates) {
                    if (this.evaluatePoint(board, move.row, move.col, opponent) >= SCORE.FIVE) {
                        return -SCORE.FIVE * 2;
                    }

                    board[move.row][move.col] = opponent;
                    const evaluation = this.minimax(board, depth - 1, true, alpha, beta, aiPlayer, opponent, candidateLimit);
                    board[move.row][move.col] = EMPTY;

                    minEval = Math.min(minEval, evaluation);
                    beta = Math.min(beta, evaluation);
                    if (beta <= alpha) break;
                }
                return minEval;
            }
        }

        evaluateBoard(board, aiPlayer, opponent) {
            let aiScore = 0;
            let oppScore = 0;

            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (board[r][c] === aiPlayer) {
                        aiScore += this.evaluateStone(board, r, c, aiPlayer);
                    } else if (board[r][c] === opponent) {
                        oppScore += this.evaluateStone(board, r, c, opponent);
                    }
                }
            }

            return aiScore - oppScore * 1.1;
        }

        getCandidateMoves(board, distance = 2) {
            const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
            const candidates = [];

            let hasStones = false;
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (board[r][c] !== EMPTY) {
                        hasStones = true;
                        for (let dr = -distance; dr <= distance; dr++) {
                            for (let dc = -distance; dc <= distance; dc++) {
                                const nr = r + dr;
                                const nc = c + dc;
                                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                                    if (board[nr][nc] === EMPTY && !visited[nr][nc]) {
                                        visited[nr][nc] = true;
                                        candidates.push({ row: nr, col: nc });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (!hasStones) {
                return [{ row: 7, col: 7 }];
            }

            return candidates;
        }

        evaluatePoint(board, row, col, player) {
            const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
            let totalScore = 0;

            const distFromCenter = Math.abs(row - 7) + Math.abs(col - 7);
            totalScore += (14 - distFromCenter);

            for (const [dr, dc] of directions) {
                let count = 1;
                let openEnds = 0;

                let r = row + dr;
                let c = col + dc;
                while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                    count++;
                    r += dr;
                    c += dc;
                }
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === EMPTY) {
                    openEnds++;
                }

                r = row - dr;
                c = col - dc;
                while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                    count++;
                    r -= dr;
                    c -= dc;
                }
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === EMPTY) {
                    openEnds++;
                }

                totalScore += this.getLineScore(count, openEnds);
            }

            return totalScore;
        }

        evaluateStone(board, row, col, player) {
            const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
            let score = 0;

            for (const [dr, dc] of directions) {
                let count = 1;
                let openEnds = 0;

                let r = row + dr;
                let c = col + dc;
                while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                    count++;
                    r += dr;
                    c += dc;
                }
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === EMPTY) {
                    openEnds++;
                }

                r = row - dr;
                c = col - dc;
                while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                    count++;
                    r -= dr;
                    c -= dc;
                }
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === EMPTY) {
                    openEnds++;
                }

                score += this.getLineScore(count, openEnds);
            }

            return score;
        }

        getLineScore(count, openEnds) {
            if (count >= 5) return SCORE.FIVE;
            if (openEnds === 0) return 0;
            if (count === 4) return openEnds === 2 ? SCORE.OPEN_FOUR : SCORE.BLOCKED_FOUR;
            if (count === 3) return openEnds === 2 ? SCORE.OPEN_THREE : SCORE.BLOCKED_THREE;
            if (count === 2) return openEnds === 2 ? SCORE.OPEN_TWO : SCORE.BLOCKED_TWO;
            if (count === 1) return SCORE.ONE;
            return 0;
        }
    }

    // -------------------------------------------------------------------------
    // 4. Gomoku UI & Controller
    // -------------------------------------------------------------------------
    class GomokuUI {
        constructor() {
            this.game = new OmokGame(BOARD_SIZE);
            this.ai = new GomokuAI('medium');
            this.sound = new SoundEffects();

            this.gameMode = 'pvai';
            this.humanColor = BLACK;
            this.showMoveNumbers = false;
            this.isAIThinking = false;

            this.canvas = document.getElementById('board-canvas');
            if (!this.canvas) {
                console.error('Canvas element #board-canvas not found');
                return;
            }

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

            this.ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
            this.ctx.scale(dpr, dpr);

            this.displayWidth = displayWidth;
            this.displayHeight = displayHeight;
            this.padding = 36;
            this.gridSize = (displayWidth - this.padding * 2) / (BOARD_SIZE - 1);
            this.stoneRadius = this.gridSize * 0.44;
        }

        bindEvents() {
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
            this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

            const btnNew = document.getElementById('btn-new-game');
            if (btnNew) btnNew.addEventListener('click', () => this.startNewGame());

            const btnUndo = document.getElementById('btn-undo');
            if (btnUndo) btnUndo.addEventListener('click', () => this.handleUndo());

            const btnRedo = document.getElementById('btn-redo');
            if (btnRedo) btnRedo.addEventListener('click', () => this.handleRedo());

            const selectMode = document.getElementById('select-mode');
            if (selectMode) {
                selectMode.addEventListener('change', (e) => {
                    this.gameMode = e.target.value;
                    const aiSettings = document.getElementById('ai-settings');
                    if (aiSettings) {
                        aiSettings.style.display = this.gameMode === 'pvai' ? 'flex' : 'none';
                    }
                    this.startNewGame();
                });
            }

            const selectColor = document.getElementById('select-player-color');
            if (selectColor) {
                selectColor.addEventListener('change', (e) => {
                    this.humanColor = parseInt(e.target.value, 10);
                    this.startNewGame();
                });
            }

            const selectDiff = document.getElementById('select-difficulty');
            if (selectDiff) {
                selectDiff.addEventListener('change', (e) => {
                    this.ai.setDifficulty(e.target.value);
                });
            }

            const toggleNums = document.getElementById('toggle-numbers');
            if (toggleNums) {
                toggleNums.addEventListener('change', (e) => {
                    this.showMoveNumbers = e.target.checked;
                    this.render();
                });
            }

            const toggleSnd = document.getElementById('toggle-sound');
            if (toggleSnd) {
                toggleSnd.addEventListener('change', (e) => {
                    this.sound.enabled = e.target.checked;
                });
            }

            const btnModalRestart = document.getElementById('btn-modal-restart');
            if (btnModalRestart) {
                btnModalRestart.addEventListener('click', () => {
                    const modal = document.getElementById('win-modal');
                    if (modal) modal.classList.remove('active');
                    this.startNewGame();
                });
            }

            window.addEventListener('resize', () => {
                this.initDimensions();
                this.render();
            });
        }

        startNewGame() {
            this.game.reset();
            this.isAIThinking = false;
            this.hoverCell = null;
            const modal = document.getElementById('win-modal');
            if (modal) modal.classList.remove('active');
            this.updateUI();
            this.render();

            if (this.gameMode === 'pvai' && this.humanColor === WHITE) {
                this.triggerAIMove();
            }
        }

        handleCanvasClick(e) {
            if (this.game.isGameOver || this.isAIThinking) return;

            const cell = this.getGridCoord(e);
            if (!cell) return;

            if (this.gameMode === 'pvai') {
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
            }, 60);
        }

        handleUndo() {
            if (this.isAIThinking) return;

            if (this.gameMode === 'pvai') {
                if (this.game.history.length >= 2) {
                    this.game.undo();
                    this.game.undo();
                } else if (this.game.history.length === 1 && this.game.history[0].player === this.humanColor) {
                    this.game.undo();
                }
            } else {
                this.game.undo();
            }

            const modal = document.getElementById('win-modal');
            if (modal) modal.classList.remove('active');
            this.updateUI();
            this.render();
        }

        handleRedo() {
            if (this.isAIThinking) return;

            if (this.gameMode === 'pvai') {
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

            if (!modal || !title || !desc) return;

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
            }, 400);
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
            const turnBadge = document.getElementById('current-turn-badge');
            const turnText = document.getElementById('current-turn-text');
            const moveCount = document.getElementById('move-count');

            if (moveCount) moveCount.textContent = `총 착수: ${this.game.history.length}수`;

            if (turnBadge && turnText) {
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
            }

            const undoBtn = document.getElementById('btn-undo');
            const redoBtn = document.getElementById('btn-redo');

            if (undoBtn) undoBtn.disabled = this.game.history.length === 0 || this.isAIThinking;
            if (redoBtn) redoBtn.disabled = this.game.redoStack.length === 0 || this.isAIThinking;
        }

        render() {
            const ctx = this.ctx;
            if (!ctx) return;

            ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);

            this.drawBoardBackground(ctx);
            this.drawGrid(ctx);
            this.drawStones(ctx);
            this.drawLastMove(ctx);

            if (this.game.winningLine) {
                this.drawWinningHighlight(ctx);
            }

            if (this.hoverCell && !this.game.isGameOver && !this.isAIThinking) {
                this.drawHoverStone(ctx, this.hoverCell.row, this.hoverCell.col);
            }
        }

        drawBoardBackground(ctx) {
            const bgGrad = ctx.createLinearGradient(0, 0, this.displayWidth, this.displayHeight);
            bgGrad.addColorStop(0, '#e8b87a');
            bgGrad.addColorStop(0.5, '#deb887');
            bgGrad.addColorStop(1, '#c89d5f');

            ctx.fillStyle = bgGrad;
            
            // Rounded rect path fallback
            const r = 14;
            const w = this.displayWidth;
            const h = this.displayHeight;
            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(w - r, 0);
            ctx.quadraticCurveTo(w, 0, w, r);
            ctx.lineTo(w, h - r);
            ctx.quadraticCurveTo(w, h, w - r, h);
            ctx.lineTo(r, h);
            ctx.quadraticCurveTo(0, h, 0, h - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#8d5d2b';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        drawGrid(ctx) {
            ctx.strokeStyle = '#4a2e12';
            ctx.lineWidth = 1;
            ctx.lineCap = 'square';

            for (let i = 0; i < BOARD_SIZE; i++) {
                const pos = this.padding + i * this.gridSize;

                // Horizontal
                ctx.beginPath();
                ctx.moveTo(this.padding, pos);
                ctx.lineTo(this.displayWidth - this.padding, pos);
                ctx.stroke();

                // Vertical
                ctx.beginPath();
                ctx.moveTo(pos, this.padding);
                ctx.lineTo(pos, this.displayHeight - this.padding);
                ctx.stroke();
            }

            // Board outer line
            ctx.lineWidth = 2;
            ctx.strokeRect(
                this.padding,
                this.padding,
                this.displayWidth - this.padding * 2,
                this.displayHeight - this.padding * 2
            );

            // Star points: (3,3), (3,11), (7,7), (11,3), (11,11)
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

            // Coordinates
            ctx.fillStyle = '#6b441f';
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
            for (let i = 0; i < BOARD_SIZE; i++) {
                const pos = this.padding + i * this.gridSize;
                ctx.fillText(colLabels[i], pos, this.padding / 2);
                ctx.fillText(colLabels[i], pos, this.displayHeight - this.padding / 2);

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

    // Auto initialize when DOM is ready
    function init() {
        window.omokApp = new GomokuUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
