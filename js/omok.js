/**
 * Gomoku (오목) 15x15 Core Game Engine
 * Freestyle Rules: 5 or more in a row wins. No forbidden moves.
 */

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const BOARD_SIZE = 15;

export class OmokGame {
    constructor(size = BOARD_SIZE) {
        this.size = size;
        this.board = Array.from({ length: size }, () => Array(size).fill(EMPTY));
        this.currentTurn = BLACK; // Black goes first
        this.history = [];        // Array of { row, col, player }
        this.redoStack = [];      // Array of { row, col, player }
        this.isGameOver = false;
        this.winner = EMPTY;
        this.winningLine = null;  // Array of [row, col] coordinates forming the win
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

    /**
     * Places a stone on the board.
     * @returns {boolean} true if move was made, false otherwise
     */
    placeStone(row, col) {
        if (!this.isValidMove(row, col)) {
            return false;
        }

        const player = this.currentTurn;
        this.board[row][col] = player;
        this.history.push({ row, col, player });
        this.redoStack = []; // Clear redo on new move

        const winResult = this.checkWin(row, col, player);
        if (winResult) {
            this.isGameOver = true;
            this.winner = player;
            this.winningLine = winResult;
        } else if (this.isBoardFull()) {
            this.isGameOver = true;
            this.winner = EMPTY; // Draw
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

    /**
     * Checks if placing at (row, col) by player leads to 5 or more in a row (Freestyle rule).
     * @returns {Array<[number, number]>|null} Array of coordinates if won, null otherwise.
     */
    checkWin(row, col, player = this.board[row][col]) {
        if (player === EMPTY) return null;

        const directions = [
            [ [0, 1], [0, -1] ],   // Horizontal
            [ [1, 0], [-1, 0] ],   // Vertical
            [ [1, 1], [-1, -1] ],  // Diagonal \
            [ [1, -1], [-1, 1] ]   // Anti-diagonal /
        ];

        for (const [dir1, dir2] of directions) {
            const line = [[row, col]];

            // Explore dir1
            let r = row + dir1[0];
            let c = col + dir1[1];
            while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
                line.push([r, c]);
                r += dir1[0];
                c += dir1[1];
            }

            // Explore dir2
            r = row + dir2[0];
            c = col + dir2[1];
            while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
                line.push([r, c]);
                r += dir2[0];
                c += dir2[1];
            }

            // Freestyle rule: 5 or more consecutive stones
            if (line.length >= 5) {
                return line;
            }
        }

        return null;
    }
}
