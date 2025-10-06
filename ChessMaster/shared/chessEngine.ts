export interface Position {
  fen: string;
  turn: 'white' | 'black';
  castling: string;
  enPassant: string;
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  castle?: boolean;
  enPassant?: boolean;
  notation?: string;
}

export type Piece = 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | null;
export type Board = Piece[][];

export class ChessEngine {
  private board: Board;
  private turn: 'white' | 'black';
  private castlingRights: string;
  private enPassantSquare: string;
  private halfMoveClock: number;
  private fullMoveNumber: number;

  constructor(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    const position = this.parseFEN(fen);
    this.board = this.fenToBoard(position.fen);
    this.turn = position.turn;
    this.castlingRights = position.castling;
    this.enPassantSquare = position.enPassant;
    this.halfMoveClock = position.halfmove;
    this.fullMoveNumber = position.fullmove;
  }

  private parseFEN(fen: string): Position {
    const parts = fen.split(' ');
    return {
      fen: parts[0],
      turn: parts[1] === 'w' ? 'white' : 'black',
      castling: parts[2] || '-',
      enPassant: parts[3] || '-',
      halfmove: parseInt(parts[4]) || 0,
      fullmove: parseInt(parts[5]) || 1
    };
  }

  private fenToBoard(fen: string): Board {
    const board: Board = [];
    const rows = fen.split('/');
    
    for (const row of rows) {
      const boardRow: Piece[] = [];
      for (const char of row) {
        if (char >= '1' && char <= '8') {
          const emptySquares = parseInt(char);
          for (let i = 0; i < emptySquares; i++) {
            boardRow.push(null);
          }
        } else {
          boardRow.push(char as Piece);
        }
      }
      board.push(boardRow);
    }
    
    return board;
  }

  private boardToFen(): string {
    let fen = '';
    for (let row = 0; row < 8; row++) {
      let emptyCount = 0;
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece === null) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += piece;
        }
      }
      if (emptyCount > 0) fen += emptyCount;
      if (row < 7) fen += '/';
    }
    return fen;
  }

  public exportFEN(): string {
    return `${this.boardToFen()} ${this.turn === 'white' ? 'w' : 'b'} ${this.castlingRights} ${this.enPassantSquare} ${this.halfMoveClock} ${this.fullMoveNumber}`;
  }

  public getPosition(): Position {
    return {
      fen: this.boardToFen(),
      turn: this.turn,
      castling: this.castlingRights,
      enPassant: this.enPassantSquare,
      halfmove: this.halfMoveClock,
      fullmove: this.fullMoveNumber
    };
  }

  public getBoard(): Board {
    return this.board.map(row => [...row]);
  }

  private squareToCoords(square: string): [number, number] {
    const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(square[1]);
    return [row, col];
  }

  private coordsToSquare(row: number, col: number): string {
    return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
  }

  public getPieceAt(square: string): Piece {
    const [row, col] = this.squareToCoords(square);
    return this.board[row][col];
  }

  private setPieceAt(square: string, piece: Piece): void {
    const [row, col] = this.squareToCoords(square);
    this.board[row][col] = piece;
  }

  private isWhitePiece(piece: Piece): boolean {
    return piece !== null && piece === piece.toUpperCase();
  }

  private isBlackPiece(piece: Piece): boolean {
    return piece !== null && piece === piece.toLowerCase() && piece !== piece.toUpperCase();
  }

  private isOwnPiece(piece: Piece, color: 'white' | 'black'): boolean {
    if (piece === null) return false;
    return color === 'white' ? this.isWhitePiece(piece) : this.isBlackPiece(piece);
  }

  private isOpponentPiece(piece: Piece, color: 'white' | 'black'): boolean {
    if (piece === null) return false;
    return color === 'white' ? this.isBlackPiece(piece) : this.isWhitePiece(piece);
  }

  public getValidMoves(square: string): string[] {
    const piece = this.getPieceAt(square);
    if (!piece || !this.isOwnPiece(piece, this.turn)) return [];

    const pieceType = piece.toLowerCase();
    let moves: string[] = [];

    switch (pieceType) {
      case 'p': moves = this.getPawnMoves(square); break;
      case 'n': moves = this.getKnightMoves(square); break;
      case 'b': moves = this.getBishopMoves(square); break;
      case 'r': moves = this.getRookMoves(square); break;
      case 'q': moves = this.getQueenMoves(square); break;
      case 'k': moves = this.getKingMoves(square); break;
    }

    return moves.filter(to => !this.wouldBeInCheck(square, to));
  }

  private getPawnMoves(square: string): string[] {
    const moves: string[] = [];
    const [row, col] = this.squareToCoords(square);
    const piece = this.board[row][col];
    const isWhite = this.isWhitePiece(piece);
    const direction = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;

    const forward = row + direction;
    if (forward >= 0 && forward < 8 && this.board[forward][col] === null) {
      moves.push(this.coordsToSquare(forward, col));

      if (row === startRow) {
        const doubleForward = row + 2 * direction;
        if (this.board[doubleForward][col] === null) {
          moves.push(this.coordsToSquare(doubleForward, col));
        }
      }
    }

    for (const dcol of [-1, 1]) {
      const newCol = col + dcol;
      if (newCol >= 0 && newCol < 8 && forward >= 0 && forward < 8) {
        const targetPiece = this.board[forward][newCol];
        if (targetPiece && this.isOpponentPiece(targetPiece, this.turn)) {
          moves.push(this.coordsToSquare(forward, newCol));
        }
        
        const targetSquare = this.coordsToSquare(forward, newCol);
        if (targetSquare === this.enPassantSquare) {
          moves.push(targetSquare);
        }
      }
    }

    return moves;
  }

  private getKnightMoves(square: string): string[] {
    const moves: string[] = [];
    const [row, col] = this.squareToCoords(square);
    const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

    for (const [drow, dcol] of offsets) {
      const newRow = row + drow;
      const newCol = col + dcol;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const targetPiece = this.board[newRow][newCol];
        if (!targetPiece || this.isOpponentPiece(targetPiece, this.turn)) {
          moves.push(this.coordsToSquare(newRow, newCol));
        }
      }
    }

    return moves;
  }

  private getBishopMoves(square: string): string[] {
    return this.getSlidingMoves(square, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  }

  private getRookMoves(square: string): string[] {
    return this.getSlidingMoves(square, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
  }

  private getQueenMoves(square: string): string[] {
    return this.getSlidingMoves(square, [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
  }

  private getSlidingMoves(square: string, directions: number[][]): string[] {
    const moves: string[] = [];
    const [row, col] = this.squareToCoords(square);

    for (const [drow, dcol] of directions) {
      let newRow = row + drow;
      let newCol = col + dcol;

      while (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const targetPiece = this.board[newRow][newCol];
        if (!targetPiece) {
          moves.push(this.coordsToSquare(newRow, newCol));
        } else {
          if (this.isOpponentPiece(targetPiece, this.turn)) {
            moves.push(this.coordsToSquare(newRow, newCol));
          }
          break;
        }
        newRow += drow;
        newCol += dcol;
      }
    }

    return moves;
  }

  private getKingMoves(square: string): string[] {
    const moves: string[] = [];
    const [row, col] = this.squareToCoords(square);
    const offsets = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];

    for (const [drow, dcol] of offsets) {
      const newRow = row + drow;
      const newCol = col + dcol;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const targetPiece = this.board[newRow][newCol];
        if (!targetPiece || this.isOpponentPiece(targetPiece, this.turn)) {
          moves.push(this.coordsToSquare(newRow, newCol));
        }
      }
    }

    if (this.turn === 'white') {
      if (this.castlingRights.includes('K') && this.canCastleKingside('white')) {
        moves.push('g1');
      }
      if (this.castlingRights.includes('Q') && this.canCastleQueenside('white')) {
        moves.push('c1');
      }
    } else {
      if (this.castlingRights.includes('k') && this.canCastleKingside('black')) {
        moves.push('g8');
      }
      if (this.castlingRights.includes('q') && this.canCastleQueenside('black')) {
        moves.push('c8');
      }
    }

    return moves;
  }

  private canCastleKingside(color: 'white' | 'black'): boolean {
    const row = color === 'white' ? 7 : 0;
    return this.board[row][5] === null && 
           this.board[row][6] === null &&
           !this.isSquareAttacked(this.coordsToSquare(row, 4), color) &&
           !this.isSquareAttacked(this.coordsToSquare(row, 5), color) &&
           !this.isSquareAttacked(this.coordsToSquare(row, 6), color);
  }

  private canCastleQueenside(color: 'white' | 'black'): boolean {
    const row = color === 'white' ? 7 : 0;
    return this.board[row][1] === null && 
           this.board[row][2] === null &&
           this.board[row][3] === null &&
           !this.isSquareAttacked(this.coordsToSquare(row, 4), color) &&
           !this.isSquareAttacked(this.coordsToSquare(row, 3), color) &&
           !this.isSquareAttacked(this.coordsToSquare(row, 2), color);
  }

  private isSquareAttacked(square: string, byColor: 'white' | 'black'): boolean {
    const opponentColor = byColor === 'white' ? 'black' : 'white';
    const originalTurn = this.turn;
    this.turn = opponentColor;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && this.isOwnPiece(piece, opponentColor)) {
          const from = this.coordsToSquare(row, col);
          const pieceType = piece.toLowerCase();
          let attacks: string[] = [];

          switch (pieceType) {
            case 'p': attacks = this.getPawnAttacks(from, opponentColor); break;
            case 'n': attacks = this.getKnightMoves(from); break;
            case 'b': attacks = this.getBishopMoves(from); break;
            case 'r': attacks = this.getRookMoves(from); break;
            case 'q': attacks = this.getQueenMoves(from); break;
            case 'k': attacks = this.getKingAttacks(from); break;
          }

          if (attacks.includes(square)) {
            this.turn = originalTurn;
            return true;
          }
        }
      }
    }

    this.turn = originalTurn;
    return false;
  }

  private getPawnAttacks(square: string, color: 'white' | 'black'): string[] {
    const attacks: string[] = [];
    const [row, col] = this.squareToCoords(square);
    const direction = color === 'white' ? -1 : 1;
    const forward = row + direction;

    for (const dcol of [-1, 1]) {
      const newCol = col + dcol;
      if (newCol >= 0 && newCol < 8 && forward >= 0 && forward < 8) {
        attacks.push(this.coordsToSquare(forward, newCol));
      }
    }

    return attacks;
  }

  private getKingAttacks(square: string): string[] {
    const attacks: string[] = [];
    const [row, col] = this.squareToCoords(square);
    const offsets = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];

    for (const [drow, dcol] of offsets) {
      const newRow = row + drow;
      const newCol = col + dcol;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        attacks.push(this.coordsToSquare(newRow, newCol));
      }
    }

    return attacks;
  }

  private wouldBeInCheck(from: string, to: string): boolean {
    const piece = this.getPieceAt(from);
    const captured = this.getPieceAt(to);
    
    this.setPieceAt(to, piece);
    this.setPieceAt(from, null);
    
    const inCheck = this.isCheck();
    
    this.setPieceAt(from, piece);
    this.setPieceAt(to, captured);
    
    return inCheck;
  }

  public isCheck(): boolean {
    const kingSquare = this.findKing(this.turn);
    if (!kingSquare) return false;
    return this.isSquareAttacked(kingSquare, this.turn);
  }

  private findKing(color: 'white' | 'black'): string | null {
    const king = color === 'white' ? 'K' : 'k';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (this.board[row][col] === king) {
          return this.coordsToSquare(row, col);
        }
      }
    }
    return null;
  }

  public isValidMove(from: string, to: string): boolean {
    return this.getValidMoves(from).includes(to);
  }

  public makeMove(move: Move): boolean {
    if (!this.isValidMove(move.from, move.to)) return false;

    const piece = this.getPieceAt(move.from);
    const captured = this.getPieceAt(move.to);
    const pieceType = piece?.toLowerCase();

    this.setPieceAt(move.to, piece);
    this.setPieceAt(move.from, null);

    move.piece = piece!;
    move.captured = captured || undefined;

    if (pieceType === 'p') {
      const [fromRow] = this.squareToCoords(move.from);
      const [toRow, toCol] = this.squareToCoords(move.to);
      
      if (Math.abs(toRow - fromRow) === 2) {
        this.enPassantSquare = this.coordsToSquare((fromRow + toRow) / 2, toCol);
      } else {
        if (move.to === this.enPassantSquare) {
          move.enPassant = true;
          const capturedRow = this.turn === 'white' ? toRow + 1 : toRow - 1;
          this.setPieceAt(this.coordsToSquare(capturedRow, toCol), null);
        }
        this.enPassantSquare = '-';
      }

      if (toRow === 0 || toRow === 7) {
        const promotionPiece = move.promotion || (this.turn === 'white' ? 'Q' : 'q');
        this.setPieceAt(move.to, promotionPiece as Piece);
        move.promotion = promotionPiece;
      }
    } else {
      this.enPassantSquare = '-';
    }

    if (pieceType === 'k') {
      const [, fromCol] = this.squareToCoords(move.from);
      const [, toCol] = this.squareToCoords(move.to);
      
      if (Math.abs(toCol - fromCol) === 2) {
        move.castle = true;
        const isKingside = toCol > fromCol;
        const [row] = this.squareToCoords(move.to);
        
        if (isKingside) {
          const rook = this.getPieceAt(this.coordsToSquare(row, 7));
          this.setPieceAt(this.coordsToSquare(row, 7), null);
          this.setPieceAt(this.coordsToSquare(row, 5), rook);
        } else {
          const rook = this.getPieceAt(this.coordsToSquare(row, 0));
          this.setPieceAt(this.coordsToSquare(row, 0), null);
          this.setPieceAt(this.coordsToSquare(row, 3), rook);
        }
      }

      if (this.turn === 'white') {
        this.castlingRights = this.castlingRights.replace(/[KQ]/g, '');
      } else {
        this.castlingRights = this.castlingRights.replace(/[kq]/g, '');
      }
    }

    if (pieceType === 'r') {
      if (move.from === 'a1') this.castlingRights = this.castlingRights.replace('Q', '');
      if (move.from === 'h1') this.castlingRights = this.castlingRights.replace('K', '');
      if (move.from === 'a8') this.castlingRights = this.castlingRights.replace('q', '');
      if (move.from === 'h8') this.castlingRights = this.castlingRights.replace('k', '');
    }

    if (this.castlingRights === '') this.castlingRights = '-';

    if (captured || pieceType === 'p') {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    if (this.turn === 'black') {
      this.fullMoveNumber++;
    }

    this.turn = this.turn === 'white' ? 'black' : 'white';

    return true;
  }

  public isCheckmate(): boolean {
    if (!this.isCheck()) return false;
    return this.getAllLegalMoves().length === 0;
  }

  public isStalemate(): boolean {
    if (this.isCheck()) return false;
    return this.getAllLegalMoves().length === 0;
  }

  public isDraw(): boolean {
    return this.isStalemate() || this.halfMoveClock >= 100 || this.isInsufficientMaterial();
  }

  private isInsufficientMaterial(): boolean {
    const pieces: Piece[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.toLowerCase() !== 'k') {
          pieces.push(piece);
        }
      }
    }

    if (pieces.length === 0) return true;
    if (pieces.length === 1 && pieces[0]) {
      const piece = pieces[0].toLowerCase();
      if (piece === 'n' || piece === 'b') {
        return true;
      }
    }

    return false;
  }

  private getAllLegalMoves(): Move[] {
    const moves: Move[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && this.isOwnPiece(piece, this.turn)) {
          const from = this.coordsToSquare(row, col);
          const validMoves = this.getValidMoves(from);
          for (const to of validMoves) {
            moves.push({ from, to, piece });
          }
        }
      }
    }
    return moves;
  }

  public getAIMove(difficulty: 'easy' | 'medium' | 'hard' = 'easy'): Move | null {
    const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    return this.getBestMove(depth);
  }

  private getBestMove(depth: number): Move | null {
    const moves = this.getAllLegalMoves();
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const savedState = this.exportFEN();
      this.makeMove(move);
      const score = -this.minimax(depth - 1, -Infinity, Infinity, false);
      const newFEN = savedState;
      const parsedPosition = this.parseFEN(newFEN);
      this.board = this.fenToBoard(parsedPosition.fen);
      this.turn = parsedPosition.turn;
      this.castlingRights = parsedPosition.castling;
      this.enPassantSquare = parsedPosition.enPassant;
      this.halfMoveClock = parsedPosition.halfmove;
      this.fullMoveNumber = parsedPosition.fullmove;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private minimax(depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    if (depth === 0) return this.evaluatePosition();

    const moves = this.getAllLegalMoves();
    if (moves.length === 0) {
      if (this.isCheckmate()) return isMaximizing ? -10000 : 10000;
      return 0;
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        const savedState = this.exportFEN();
        this.makeMove(move);
        const score = this.minimax(depth - 1, alpha, beta, false);
        const newFEN = savedState;
        const parsedPosition = this.parseFEN(newFEN);
        this.board = this.fenToBoard(parsedPosition.fen);
        this.turn = parsedPosition.turn;
        this.castlingRights = parsedPosition.castling;
        this.enPassantSquare = parsedPosition.enPassant;
        this.halfMoveClock = parsedPosition.halfmove;
        this.fullMoveNumber = parsedPosition.fullmove;

        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const move of moves) {
        const savedState = this.exportFEN();
        this.makeMove(move);
        const score = this.minimax(depth - 1, alpha, beta, true);
        const newFEN = savedState;
        const parsedPosition = this.parseFEN(newFEN);
        this.board = this.fenToBoard(parsedPosition.fen);
        this.turn = parsedPosition.turn;
        this.castlingRights = parsedPosition.castling;
        this.enPassantSquare = parsedPosition.enPassant;
        this.halfMoveClock = parsedPosition.halfmove;
        this.fullMoveNumber = parsedPosition.fullmove;

        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minScore;
    }
  }

  private evaluatePosition(): number {
    const pieceValues: Record<string, number> = {
      p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
      P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000
    };

    let score = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece) {
          const value = pieceValues[piece.toLowerCase()];
          score += this.isWhitePiece(piece) ? value : -value;
        }
      }
    }

    return this.turn === 'white' ? score : -score;
  }

  public getTurn(): 'white' | 'black' {
    return this.turn;
  }

  public getGameStatus(): 'active' | 'checkmate' | 'stalemate' | 'draw' {
    if (this.isCheckmate()) return 'checkmate';
    if (this.isStalemate()) return 'stalemate';
    if (this.isDraw()) return 'draw';
    return 'active';
  }
}
