/**
 * Gomoku AI Engine using Minimax with Alpha-Beta Pruning and Pattern Evaluation
 */

import { EMPTY, BLACK, WHITE, BOARD_SIZE } from './omok.js';

// Pattern score constants
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

export class GomokuAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty; // 'easy', 'medium', 'hard'
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    /**
     * Compute the best move for the AI.
     * @param {OmokGame} game 
     * @param {number} aiPlayer (BLACK or WHITE)
     * @returns {{row: number, col: number}}
     */
    findBestMove(game, aiPlayer) {
        const board = game.board;
        const opponent = aiPlayer === BLACK ? WHITE : BLACK;

        // If board is empty, play center
        if (game.history.length === 0) {
            return { row: 7, col: 7 };
        }

        // If it's turn 2 (AI is 2nd player) and center is taken, play nearby
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

        // Easy mode: Greedy heuristic with slight noise
        if (this.difficulty === 'easy') {
            return this.getGreedyMove(board, aiPlayer, opponent, true);
        }

        // Medium mode: Depth 2 Minimax
        if (this.difficulty === 'medium') {
            return this.getMinimaxMove(board, aiPlayer, opponent, 2, 10);
        }

        // Hard mode: Depth 3~4 Minimax with aggressive candidate pruning
        if (this.difficulty === 'hard') {
            return this.getMinimaxMove(board, aiPlayer, opponent, 3, 12);
        }

        return this.getGreedyMove(board, aiPlayer, opponent, false);
    }

    /**
     * Immediate greedy best move
     */
    getGreedyMove(board, aiPlayer, opponent, addRandomness = false) {
        const candidates = this.getCandidateMoves(board, 2);
        if (candidates.length === 0) return { row: 7, col: 7 };

        let bestScore = -Infinity;
        let bestMoves = [];

        for (const { row, col } of candidates) {
            const attackScore = this.evaluatePoint(board, row, col, aiPlayer);
            const defendScore = this.evaluatePoint(board, row, col, opponent);
            // Weight attack slightly more than defense, but immediate threats dominate
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

    /**
     * Minimax with Alpha-Beta Pruning
     */
    getMinimaxMove(board, aiPlayer, opponent, depth, candidateLimit) {
        // Immediate win / block check
        const candidates = this.getCandidateMoves(board, 2);
        if (candidates.length === 0) return { row: 7, col: 7 };

        // 1. Check if AI can win immediately (Score >= FIVE)
        for (const { row, col } of candidates) {
            if (this.evaluatePoint(board, row, col, aiPlayer) >= SCORE.FIVE) {
                return { row, col };
            }
        }

        // 2. Check if Opponent can win immediately and block
        for (const { row, col } of candidates) {
            if (this.evaluatePoint(board, row, col, opponent) >= SCORE.FIVE) {
                return { row, col };
            }
        }

        // 3. Check for open fours
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

        // Sort candidates by greedy heuristic score for optimal alpha-beta pruning
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

        // Sort candidates
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
                // If this move gives instant win
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
                // If opponent gets instant win
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

    /**
     * Evaluates total board state from AI's perspective
     */
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

    /**
     * Get candidate moves that are within `distance` of any existing stone.
     */
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

    /**
     * Evaluate how good placing a stone at (row, col) would be for `player`
     */
    evaluatePoint(board, row, col, player) {
        const directions = [
            [0, 1],   // Horizontal
            [1, 0],   // Vertical
            [1, 1],   // Diagonal \
            [1, -1]   // Anti-diagonal /
        ];

        let totalScore = 0;
        const opponent = player === BLACK ? WHITE : BLACK;

        // Small positional bonus: stones closer to center (7,7) are slightly favored
        const distFromCenter = Math.abs(row - 7) + Math.abs(col - 7);
        totalScore += (14 - distFromCenter);

        for (const [dr, dc] of directions) {
            let count = 1;
            let openEnds = 0;

            // Direction 1
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

            // Direction 2
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

    /**
     * Evaluate an existing stone's contribution to board score
     */
    evaluateStone(board, row, col, player) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        let score = 0;

        for (const [dr, dc] of directions) {
            let count = 1;
            let openEnds = 0;

            // Forward
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

            // Backward
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

        if (count === 4) {
            return openEnds === 2 ? SCORE.OPEN_FOUR : SCORE.BLOCKED_FOUR;
        }
        if (count === 3) {
            return openEnds === 2 ? SCORE.OPEN_THREE : SCORE.BLOCKED_THREE;
        }
        if (count === 2) {
            return openEnds === 2 ? SCORE.OPEN_TWO : SCORE.BLOCKED_TWO;
        }
        if (count === 1) {
            return SCORE.ONE;
        }
        return 0;
    }
}
