<!-- components/ChessBoard.vue -->
<template>
  <div class="chess-board-container">
    <h1>Chess Game Analysis</h1>

    <div class="main-content">
      <div class="board-column">
        <!-- Chess board -->
        <div class="chessboard">
          <div class="board">
            <div v-for="row in 8" :key="`row-${row}`" class="board-row">
              <div
                  v-for="col in 8"
                  :key="`${row}-${col}`"
                  :class="[
                    'square',
                    (row + col) % 2 === 0 ? 'light' : 'dark',
                    isHighlighted(row-1, col-1) ? 'highlighted-square' : ''
                  ]"
                            >
                <div
                    v-if="getPiece(row-1, col-1)"
                    class="piece"
                >
                  {{ getPiece(row-1, col-1) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Move controls below the board -->
        <div class="move-controls">
          <button @click="goToStart" :disabled="currentMoveIndex === 0">
            <span>⏮</span>
          </button>
          <button @click="prevMove" :disabled="currentMoveIndex === 0">
            <span>◀</span>
          </button>
          <span class="move-number">Move: {{ currentMoveIndex }} / {{ boardStates.length - 1 }}</span>
          <button @click="nextMove" :disabled="currentMoveIndex >= boardStates.length - 1">
            <span>▶</span>
          </button>
          <button @click="goToEnd" :disabled="currentMoveIndex >= boardStates.length - 1">
            <span>⏭</span>
          </button>
        </div>
      </div>

      <div class="moves-column">
        <!-- PGN Moves List -->
        <div class="pgn-moves">
          <h3>Moves</h3>
          <div class="moves-list">
            <span v-for="(movePair, index) in formattedMoves" :key="index">
              <span class="move-number">{{ index + 1 }}.</span>
              <span
                  :class="['move white', { active: isActiveMove(index * 2) }]"
                  @click="jumpToMove(index * 2)"
              >
                {{ movePair.white }}
              </span>
              <span
                  v-if="movePair.black"
                  :class="['move black', { active: isActiveMove(index * 2 + 1) }]"
                  @click="jumpToMove(index * 2 + 1)"
              >
                {{ movePair.black }}
              </span>
            </span>
          </div>
        </div>

        <!-- Interesting Moves -->
        <div class="interesting-moves">
          <h3>Interesting Moves</h3>
          <div v-if="interestingMoves.length === 0" class="no-interesting-moves">
            No interesting moves found
          </div>
          <div v-else class="interesting-moves-list">
            <div
                v-for="(move, idx) in interestingMoves"
                :key="idx"
                class="interesting-move-item"
                @click="jumpToInterestingMove(move)"
            >
              <span class="move-range">Moves {{ formatMoveWithColor(move.start_move) }} - {{ formatMoveWithColor(move.end_move) }}:</span>
              <span class="move-description">{{ move.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="actions">
      <button @click="backToUpload" class="back-button">Upload New PGN</button>
    </div>
  </div>
</template>

<!-- components/ChessBoard.vue -->
<script>
import { Chess } from "chess.js";

export default {
  props: {
    pgnContent: {
      type: String,
      required: true
    },
    interestingMoves: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      chess: null,
      pgnMoves: [],
      boardStates: [],
      currentMoveIndex: 0,
      currentPosition: null,
      nextMoveHighlight: []
    }
  },
  computed: {
    formattedMoves() {
      const movePairs = [];

      for (let i = 0; i < this.pgnMoves.length; i += 2) {
        const pair = {
          white: this.pgnMoves[i] ? this.addPieceSymbolToMove(this.pgnMoves[i].san) : null,
          black: i + 1 < this.pgnMoves.length ? this.addPieceSymbolToMove(this.pgnMoves[i + 1].san) : null
        };
        movePairs.push(pair);
      }

      return movePairs;
    }
  },
  mounted() {
    // Initialize chess.js
    this.chess = new Chess()

    try {
      // Load PGN from props
      if (this.pgnContent) {
        this.chess.loadPgn(this.pgnContent)

        // Generate board states for each move
        this.generateBoardStates()
        this.updateCurrentPosition()
        this.calculateCurrentMoveHighlight()
      }
    } catch (error) {
      console.error('Error loading PGN data:', error)
    }
  },
  methods: {
    parseInterestingMoves(moves) {
      return moves.map(move => {
        // Handle format [24B, 28W, desc] if needed
        if (Array.isArray(move)) {
          return {
            start_move: move[0], // e.g. "24B"
            end_move: move[1], // e.g. "28W"
            description: move[2] // description
          };
        }
        // Keep compatibility with other formats
        return move;
      });
    },
    formatMoveWithColor(moveString) {
      if (typeof moveString === 'string' && (moveString.endsWith('B') || moveString.endsWith('W'))) {
        const moveNumber = moveString.slice(0, -1);
        const color = moveString.endsWith('B') ? 'Black' : 'White';
        return `${moveNumber} ${color}`;
      }
      return moveString;
    },
    getMoveNumber(moveString) {
      if (typeof moveString !== 'string') return moveString;

      // Extract just the number part
      const moveNumber = parseInt(moveString.match(/\d+/)[0]);
      const isBlack = moveString.endsWith('B');

      // For white moves: move number * 2 - 2
      // For black moves: move number * 2 - 1
      return isBlack ? (moveNumber * 2 - 1) : (moveNumber * 2 - 2);
    },
    jumpToInterestingMove(move) {
      const moveIndex = this.getMoveNumber(move.start_move);
      this.jumpToMove(moveIndex);
    },
    generateBoardStates() {
      // Get the history of moves
      const history = this.chess.history({ verbose: true })
      this.pgnMoves = history

      let chess_temp = new Chess()
      this.boardStates = [chess_temp.fen()]

      // Generate a FEN string for each position after each move
      for (const move of history) {
        chess_temp.move(move)
        this.boardStates.push(chess_temp.fen())
      }
    },
    updateCurrentPosition() {
      if (this.boardStates.length > 0 && this.currentMoveIndex < this.boardStates.length) {
        this.currentPosition = this.parseFEN(this.boardStates[this.currentMoveIndex])
      }
    },
    parseFEN(fen) {
      // Parse FEN notation to get piece positions
      const parts = fen.split(' ')
      const rows = parts[0].split('/')
      const board = Array(8).fill().map(() => Array(8).fill(null))

      for (let i = 0; i < 8; i++) {
        let col = 0
        for (let j = 0; j < rows[i].length; j++) {
          const char = rows[i].charAt(j)
          if (isNaN(char)) {
            board[i][col] = this.fenCharToPiece(char)
            col++
          } else {
            col += parseInt(char)
          }
        }
      }

      return board
    },
    fenCharToPiece(char) {
      const pieces = {
        'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
        'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
      }
      return pieces[char]
    },
    getPiece(row, col) {
      if (this.currentPosition && row >= 0 && row < 8 && col >= 0 && col < 8) {
        return this.currentPosition[row][col]
      }
      return null
    },
    calculateCurrentMoveHighlight() {
      this.nextMoveHighlight = [];

      // If at initial position, there's no current move
      if (this.currentMoveIndex <= 0) {
        return;
      }

      // Get the move that was just played to reach the current position
      const currentMove = this.pgnMoves[this.currentMoveIndex - 1];
      if (currentMove) {
        // Add move highlight
        this.nextMoveHighlight.push({
          from: {
            row: 8 - (currentMove.from.charAt(1) - '0'),
            col: currentMove.from.charCodeAt(0) - 'a'.charCodeAt(0)
          },
          to: {
            row: 8 - (currentMove.to.charAt(1) - '0'),
            col: currentMove.to.charCodeAt(0) - 'a'.charCodeAt(0)
          }
        });

        // Special handling for castling
        if (currentMove.san === 'O-O' || currentMove.san === 'O-O-O') {
          const isKingSide = currentMove.san === 'O-O';
          const rank = currentMove.color === 'w' ? '1' : '8';

          // For king side castling, rook moves from h to f, for queen side from a to d
          const rookFrom = isKingSide ? 'h' + rank : 'a' + rank;
          const rookTo = isKingSide ? 'f' + rank : 'd' + rank;

          // Add rook movement to highlights
          this.nextMoveHighlight.push({
            from: {
              row: 8 - (rookFrom.charAt(1) - '0'),
              col: rookFrom.charCodeAt(0) - 'a'.charCodeAt(0)
            },
            to: {
              row: 8 - (rookTo.charAt(1) - '0'),
              col: rookTo.charCodeAt(0) - 'a'.charCodeAt(0)
            }
          });
        }
      }
    },
    isHighlighted(row, col) {
      if (!this.nextMoveHighlight || !this.nextMoveHighlight.length) return false;

      return this.nextMoveHighlight.some(highlight =>
          (highlight.from.row === row && highlight.from.col === col) ||
          (highlight.to.row === row && highlight.to.col === col)
      );
    },
    isActiveMove(moveIndex) {
      return this.currentMoveIndex === moveIndex + 1; // +1 because the first state is the initial position
    },
    goToStart() {
      this.currentMoveIndex = 0
      this.updateCurrentPosition()
      this.calculateCurrentMoveHighlight()
    },
    prevMove() {
      if (this.currentMoveIndex > 0) {
        this.currentMoveIndex--
        this.updateCurrentPosition()
        this.calculateCurrentMoveHighlight()
      }
    },
    nextMove() {
      if (this.currentMoveIndex < this.boardStates.length - 1) {
        this.currentMoveIndex++
        this.updateCurrentPosition()
        this.calculateCurrentMoveHighlight()
      }
    },
    goToEnd() {
      this.currentMoveIndex = this.boardStates.length - 1
      this.updateCurrentPosition()
      this.calculateCurrentMoveHighlight()
    },
    jumpToMove(moveIndex) {
      // Add 1 because index 0 is the initial board state
      this.currentMoveIndex = moveIndex + 1;
      this.updateCurrentPosition()
      this.calculateCurrentMoveHighlight()
    },
    backToUpload() {
      this.$router.push('/games')
    },
    addPieceSymbolToMove(san) {
      if (!san) return san;

      const pieceMap = {
        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙'
      };

      // Special case for castling
      if (san === 'O-O' || san === 'O-O-O') {
        return '♔' + san; // King symbol for castling
      }

      // For regular moves, check the first character
      const firstChar = san.charAt(0);
      if ('KQRBNP'.includes(firstChar)) {
        // It's a piece move
        return pieceMap[firstChar] + san.substring(1);
      } else {
        // It's a pawn move
        return pieceMap['P'] + san;
      }
    }
  }
}
</script>

<style scoped>
.chess-board-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.main-content {
  display: flex;
  gap: 30px;
  margin-bottom: 30px;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
}

.board-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.moves-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chessboard {
  width: 100%;
  max-width: 480px;
}

.board {
  width: 100%;
  aspect-ratio: 1 / 1;
  border: 2px solid #333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.board-row {
  display: flex;
  height: 12.5%;
}

.square {
  width: 12.5%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.square.light {
  background-color: #f0d9b5;
}

.square.dark {
  background-color: #b58863;
}

.piece {
  font-size: 2vw;
  user-select: none;
  position: relative;
  z-index: 2; /* Give pieces a higher z-index */
}

.square.highlighted-square {
  position: relative;
}

.square.highlighted-square::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(76, 175, 80, 0.3);
  border: 2px solid #7ea45f;
  pointer-events: none;
  z-index: 1; /* Make sure this is lower than the piece z-index */
}

@media (min-width: 600px) {
  .piece {
    font-size: 3.3rem;
  }
}

.move-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.move-controls button {
  width: 40px;
  height: 40px;
  border-radius: 4px; /* Changed from 50% to make buttons rectangular */
  background-color: #4CAF50;
  color: white;
  border: none;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.move-controls button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.move-number {
  font-size: 16px;
  font-weight: 500;
  margin: 0 10px;
}

.pgn-moves {
  background-color: #f8f8f8;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
}

.moves-list {
  display: flex;
  flex-wrap: wrap;
  line-height: 1.8;
}

.move-number {
  margin-right: 1px; /* Reduced from 4px */
  margin-left: 4px;
  color: #888;
}

.move {
  margin-right: 1px; /* Reduced from 6px */
  padding: 1.5px 3px;
  border-radius: 3px;
  cursor: pointer;
  display: inline-block;
}

.move:hover {
  background-color: #e8f5e9;
}

.move.active {
  background-color: #4CAF50;
  color: white;
}

.move.white {
  color: #333;
}

.move.black {
  color: #555;
}

h3 {
  margin-top: 0;
  color: #333;
  margin-bottom: 15px;
}

.interesting-moves {
  background-color: #f8f8f8;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-interesting-moves {
  color: #666;
  font-style: italic;
}

.interesting-move-item {
  padding: 10px;
  background-color: white;
  border-radius: 4px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.interesting-move-item:hover {
  background-color: #e8f5e9;
}

.move-range {
  font-weight: bold;
  color: #4CAF50;
  display: block;
  margin-bottom: 4px;
}

.move-description {
  color: #555;
}

.actions {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

.back-button {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.back-button:hover {
  background-color: #0b7dda;
}
</style>

