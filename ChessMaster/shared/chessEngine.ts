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

export type Piece =
  | 'p'
  | 'n'
  | 'b'
  | 'r'
  | 'q'
  | 'k'
  | 'P'
  | 'N'
  | 'B'
  | 'R'
  | 'Q'
  | 'K'
  | null;
export type Board = Piece[][];

export class ChessEngine {
  private board: Board;
  private turn: 'white' | 'black';
  private castlingRights: string;
  private enPassantSquare: string;
  private halfMoveClock: number;
  private fullMoveNumber: number;

  constructor(
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  ) {
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
      halfmove: parseInt(parts[4], 10) || 0,
      fullmove: parseInt(parts[5], 10) || 1,
    };
  }

  private fenToBoard(fen: string): Board {
    return fen.split('/').map((rank) => {
      const row: Piece[] = [];
      for (const char of rank) {
        if (/[1-8]/.test(char)) {
          const emptyCount = parseInt(char, 10);
          for (let i = 0; i < emptyCount; i++) {
            row.push(null);
          }
        } else {
          row.push(char as Piece);
        }
      }
      return row;
    });
  }

  private boardToFen(): string {
    return this.board
      .map((row) => {
        let fenRow = '';
        let emptyCount = 0;
        for (const piece of row) {
          if (piece === null) {
            emptyCount++;
          } else {
            if (emptyCount > 0) {
              fenRow += emptyCount;
              emptyCount = 0;
            }
            fenRow += piece;
          }
        }
        if (emptyCount > 0) fenRow += emptyCount;
        return fenRow;
      })
      .join('/');
  }

  public exportFEN(): string {
    const castling = this.castlingRights === '' ? '-' : this.castlingRights;
    return `${this.boardToFen()} ${this.turn === 'white' ? 'w' : 'b'} ${castling} ${this.enPassantSquare} ${this.halfMoveClock} ${this.fullMoveNumber}`;
  }

  public getPosition(): Position {
    return {
      fen: this.boardToFen(),
      turn: this.turn,
      castling: this.castlingRights === '' ? '-' : this.castlingRights,
      enPassant: this.enPassantSquare,
      halfmove: this.halfMoveClock,
      fullmove: this.fullMoveNumber,
    };
  }

  public getBoard(): Board {
    return this.board.map((row) => [...row]);
  }

  private squareToCoords(square: string): [number, number] {
    const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(square[1], 10);
    return [row, col];
  }

  private coordsToSquare(row: number, col: number): string {
    return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
  }

  private isValidCoords(row: number, col: number): boolean {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  public getPieceAt(square: string): Piece {
    const [row, col] = this.squareToCoords(square);
    return this.isValidCoords(row, col) ? this.board[row][col] : null;
  }

  private setPieceAt(square: string, piece: Piece): void {
    const [row, col] = this.squareToCoords(square);
    if (this.isValidCoords(row, col)) {
      this.board[row][col] = piece;
    }
  }

  private isWhitePiece(piece: Piece): boolean {
    return piece !== null && piece === piece.toUpperCase();
  }

  private isBlackPiece(piece: Piece): boolean {
    return piece !== null && piece === piece.toLowerCase();
  }

  private isOwnPiece(piece: Piece, color: 'white' | 'black'): boolean {
    if (piece === null) return false;
    return color === 'white' ? this.isWhitePiece(piece) : this.isBlackPiece(piece);
  }

  private isOpponentPiece(piece: Piece, color: 'white' | 'black'): boolean {
    if (piece === null) return false;
    return color === 'white' ? this.isBlackPiece(piece) : this.isWhitePiece(piece);
  }

  private normalizeCastlingRights(rights: string): string {
    const normalized = ['K', 'Q', 'k', 'q'].filter((ch) => rights.includes(ch)).join('');
    return normalized === '' ? '-' : normalized;
  }

  private removeCastlingRight(right: 'K' | 'Q' | 'k' | 'q'): void {
    this.castlingRights = this.normalizeCastlingRights(this.castlingRights.replace(right, ''));
  }

  private isSquareEmpty(square: string): boolean {
    return this.getPieceAt(square) === null;
  }

  public getValidMoves(square: string): string[] {
    const piece = this.getPieceAt(square);
    if (!piece || !this.isOwnPiece(piece, this.turn)) return [];

    const pieceType = piece.toLowerCase();
    let moves: string[] = [];

    switch (pieceType) {
      case 'p':
        moves = this.getPawnMoves(square);
        break;
      case 'n':
        moves = this.getKnightMoves(square);
        break;
      case 'b':
        moves = this.getBishopMoves(square);
        break;
      case 'r':
        moves = this.getRookMoves(square);
        break;
      case 'q':
        moves = this.getQueenMoves(square);
        break;
      case 'k':
        moves = this.getKingMoves(square);
        break;
    }

    return moves.filter((to) => !this.wouldBeInCheck(square, to));
  }

  private getPawnMoves(square: string): string[] {
    const moves: string[] = [];
    const [row, col] = this.squareToCoords(square);
    const piece = this.getPieceAt(square);
    const isWhite = this.isWhitePiece(piece);
    const direction = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;

    const forwardRow = row + direction;
    if (this.isValidCoords(forwardRow, col) && this.board[forwardRow][col] === null) {
      moves.push(this.coordsToSquare(forwardRow, col));
      if (row === startRow) {
        const doubleRow = row + direction * 2;
        if (this.board[doubleRow][col] === null) {
          moves.push(this.coordsToSquare(doubleRow, col));
        }
      }
    }

    for (const colOffset of [-1, 1]) {
      const captureCol = col + colOffset;
      if (!this.isValidCoords(forwardRow, captureCol)) continue;

      const captureSquare = this.coordsToSquare(forwardRow, captureCol);
      const targetPiece = this.getPieceAt(captureSquare);
      if (targetPiece && this.isOpponentPiece(targetPiece, this.turn)) {
        moves.push(captureSquare);
      }

      if (
        this.enPassantSquare !== '-' &&
        captureSquare === this.enPassantSquare
      ) {
        const capturedPawnRow = row;
        const capturedPawnSquare = this.coordsToSquare(capturedPawnRow, captureCol);
        const capturedPawn = this.getPieceAt(capturedPawnSquare);
        if (
          capturedPawn &&
          this.isOpponentPiece(capturedPawn, this.turn) &&
          capturedPawn.toLowerCase() === 'p'
        ) {
          moves.push(captureSquare);
        }
      }
    }

    return moves;
  }

  private getKnightMoves(square: string): string[] {
    const moves: string[] = [];
    const [row, col] = this.squareToCoords(square);
    const offsets = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];

    for (const [dRow, dCol] of offsets) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      if (!this.isValidCoords(newRow, newCol)) continue;
      const targetSquare = this.coordsToSquare(newRow, newCol);
      const targetPiece = this.getPieceAt(targetSquare);
      if (!targetPiece || this.isOpponentPiece(targetPiece, this.turn)) {
        moves.push(targetSquare);
      }
    }
    return moves;
  }

  private getBishopMoves(square: string): string[] {
    return this.getSlidingMoves(square, [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]);
  }

  private getRookMoves(square: string): string[] {
    return this.getSlidingMoves(square, [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]);
  }

  private getQueenMoves(square: string): string[] {
    return this.getSlidingMoves(square, [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]);
  }

  private getSlidingMoves(square: string, directions: number[][]): string[] {
    const moves: string[] = [];
    const [row, col] = this.squareToCoords(square);

    for (const [rowDelta, colDelta] of directions) {
      let newRow = row + rowDelta;
      let newCol = col + colDelta;
      while (this.isValidCoords(newRow, newCol)) {
        const targetSquare = this.coordsToSquare(newRow, newCol);
        const targetPiece = this.getPieceAt(targetSquare);
        if (targetPiece === null) {
          moves.push(targetSquare);
        } else {
          if (this.isOpponentPiece(targetPiece, this.turn)) {
            moves.push(targetSquare);
          }
          break;
        }
        newRow += rowDelta;
        newCol += colDelta;
      }
    }

    return moves;
  }

  private getKingMoves(square: string): string[] {
    const moves: string[] = [];
    const [row, col] = this.squareToCoords(square);
    const directions = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

    for (const [rowDelta, colDelta] of directions) {
      const newRow = row + rowDelta;
      const newCol = col + colDelta;
      if (!this.isValidCoords(newRow, newCol)) continue;
      const targetSquare = this.coordsToSquare(newRow, newCol);
      const targetPiece = this.getPieceAt(targetSquare);
      if (!targetPiece || this.isOpponentPiece(targetPiece, this.turn)) {
        moves.push(targetSquare);
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
    const kingSquare = this.coordsToSquare(row, 4);
    const rookSquare = this.coordsToSquare(row, 7);
    const fSquare = this.coordsToSquare(row, 5);
    const gSquare = this.coordsToSquare(row, 6);

    const king = this.getPieceAt(kingSquare);
    const rook = this.getPieceAt(rookSquare);
    if (
      !king ||
      !rook ||
      !this.isOwnPiece(king, color) ||
      !this.isOwnPiece(rook, color) ||
      king.toLowerCase() !== 'k' ||
      rook.toLowerCase() !== 'r'
    ) {
      return false;
    }

    if (this.getPieceAt(fSquare) !== null || this.getPieceAt(gSquare) !== null) {
      return false;
    }

    if (this.isCheck()) return false;
    const opponent = color === 'white' ? 'black' : 'white';
    if (this.isSquareAttacked(fSquare, opponent) || this.isSquareAttacked(gSquare, opponent)) {
      return false;
    }

    return true;
  }

  private canCastleQueenside(color: 'white' | 'black'): boolean {
    const row = color === 'white' ? 7 : 0;
    const kingSquare = this.coordsToSquare(row, 4);
    const rookSquare = this.coordsToSquare(row, 0);
    const dSquare = this.coordsToSquare(row, 3);
    const cSquare = this.coordsToSquare(row, 2);
    const bSquare = this.coordsToSquare(row, 1);

    const king = this.getPieceAt(kingSquare);
    const rook = this.getPieceAt(rookSquare);
    if (
      !king ||
      !rook ||
      !this.isOwnPiece(king, color) ||
      !this.isOwnPiece(rook, color) ||
      king.toLowerCase() !== 'k' ||
      rook.toLowerCase() !== 'r'
    ) {
      return false;
    }

    if (
      this.getPieceAt(dSquare) !== null ||
      this.getPieceAt(cSquare) !== null ||
      this.getPieceAt(bSquare) !== null
    ) {
      return false;
    }

    if (this.isCheck()) return false;
    const opponent = color === 'white' ? 'black' : 'white';
    if (this.isSquareAttacked(dSquare, opponent) || this.isSquareAttacked(cSquare, opponent)) {
      return false;
    }

    return true;
  }

  private isSquareAttacked(square: string, byColor: 'white' | 'black'): boolean {
    const [targetRow, targetCol] = this.squareToCoords(square);

    const pawnDirection = byColor === 'white' ? -1 : 1;
    const pawnRow = targetRow - pawnDirection;
    for (const colOffset of [-1, 1]) {
      const pawnCol = targetCol + colOffset;
      if (!this.isValidCoords(pawnRow, pawnCol)) continue;
      const originSquare = this.coordsToSquare(pawnRow, pawnCol);
      const piece = this.getPieceAt(originSquare);
      if (piece && this.isOwnPiece(piece, byColor) && piece.toLowerCase() === 'p') {
        return true;
      }
    }

    const knightOffsets = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (const [dRow, dCol] of knightOffsets) {
      const attackerRow = targetRow + dRow;
      const attackerCol = targetCol + dCol;
      if (!this.isValidCoords(attackerRow, attackerCol)) continue;
      const attackerSquare = this.coordsToSquare(attackerRow, attackerCol);
      const attackerPiece = this.getPieceAt(attackerSquare);
      if (attackerPiece && this.isOwnPiece(attackerPiece, byColor) && attackerPiece.toLowerCase() === 'n') {
        return true;
      }
    }

    const kingOffsets = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [dRow, dCol] of kingOffsets) {
      const attackerRow = targetRow + dRow;
      const attackerCol = targetCol + dCol;
      if (!this.isValidCoords(attackerRow, attackerCol)) continue;
      const attackerSquare = this.coordsToSquare(attackerRow, attackerCol);
      const attackerPiece = this.getPieceAt(attackerSquare);
      if (attackerPiece && this.isOwnPiece(attackerPiece, byColor) && attackerPiece.toLowerCase() === 'k') {
        return true;
      }
    }

    const orthogonalDirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    for (const [dRow, dCol] of orthogonalDirs) {
      let checkRow = targetRow + dRow;
      let checkCol = targetCol + dCol;
      while (this.isValidCoords(checkRow, checkCol)) {
        const checkSquare = this.coordsToSquare(checkRow, checkCol);
        const checkPiece = this.getPieceAt(checkSquare);
        if (checkPiece !== null) {
          if (this.isOwnPiece(checkPiece, byColor) && ['r', 'q'].includes(checkPiece.toLowerCase())) {
            return true;
          }
          break;
        }
        checkRow += dRow;
        checkCol += dCol;
      }
    }

    const diagonalDirs = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [dRow, dCol] of diagonalDirs) {
      let checkRow = targetRow + dRow;
      let checkCol = targetCol + dCol;
      while (this.isValidCoords(checkRow, checkCol)) {
        const checkSquare = this.coordsToSquare(checkRow, checkCol);
        const checkPiece = this.getPieceAt(checkSquare);
        if (checkPiece !== null) {
          if (this.isOwnPiece(checkPiece, byColor) && ['b', 'q'].includes(checkPiece.toLowerCase())) {
            return true;
          }
          break;
        }
        checkRow += dRow;
        checkCol += dCol;
      }
    }

    return false;
  }

  private wouldBeInCheck(from: string, to: string): boolean {
    const piece = this.getPieceAt(from);
    if (!piece) return false;

    const savedBoard = this.board.map((row) => [...row]);
    const savedEnPassant = this.enPassantSquare;
    const savedHalfmove = this.halfMoveClock;
    const savedFullmove = this.fullMoveNumber;
    const savedCastling = this.castlingRights;
    const savedTurn = this.turn;

    const [fromRow, fromCol] = this.squareToCoords(from);
    const [toRow, toCol] = this.squareToCoords(to);
    const isEnPassantCapture =
      piece.toLowerCase() === 'p' &&
      this.enPassantSquare !== '-' &&
      to === this.enPassantSquare &&
      this.isSquareEmpty(to);

    const capturedSquare = isEnPassantCapture
      ? this.coordsToSquare(fromRow, toCol)
      : to;
    const capturedPiece = this.getPieceAt(capturedSquare);

    this.setPieceAt(to, piece);
    this.setPieceAt(from, null);
    if (isEnPassantCapture) {
      this.setPieceAt(capturedSquare, null);
    }

    const check = this.isCheck();
    this.board = savedBoard.map((row) => [...row]);
    this.enPassantSquare = savedEnPassant;
    this.halfMoveClock = savedHalfmove;
    this.fullMoveNumber = savedFullmove;
    this.castlingRights = savedCastling;
    this.turn = savedTurn;

    return check;
  }

  public isCheck(): boolean {
    const kingSquare = this.findKing(this.turn);
    if (!kingSquare) return false;
    const opponent = this.turn === 'white' ? 'black' : 'white';
    return this.isSquareAttacked(kingSquare, opponent);
  }

  private findKing(color: 'white' | 'black'): string | null {
    const target = color === 'white' ? 'K' : 'k';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (this.board[row][col] === target) {
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
    if (!piece) return false;
    const pieceType = piece.toLowerCase();
    const [fromRow, fromCol] = this.squareToCoords(move.from);
    const [toRow, toCol] = this.squareToCoords(move.to);

    const isEnPassantCapture =
      pieceType === 'p' &&
      this.enPassantSquare !== '-' &&
      move.to === this.enPassantSquare &&
      this.isSquareEmpty(move.to);

    const capturedSquare = isEnPassantCapture
      ? this.coordsToSquare(fromRow, toCol)
      : move.to;

    const capturedPiece = this.getPieceAt(capturedSquare);
    move.captured = capturedPiece || undefined;
    move.piece = piece;

    this.setPieceAt(move.to, piece);
    this.setPieceAt(move.from, null);
    if (isEnPassantCapture) {
      this.setPieceAt(capturedSquare, null);
      move.enPassant = true;
    }

    if (pieceType === 'p') {
      if (Math.abs(toRow - fromRow) === 2) {
        this.enPassantSquare = this.coordsToSquare(
          fromRow + (toRow - fromRow) / 2,
          fromCol
        );
      } else {
        this.enPassantSquare = '-';
      }

      if (toRow === 0 || toRow === 7) {
        const promotionPiece = move.promotion
          ? move.promotion
          : this.turn === 'white'
          ? 'Q'
          : 'q';
        this.setPieceAt(move.to, promotionPiece as Piece);
        move.promotion = promotionPiece;
      }
    } else {
      this.enPassantSquare = '-';
    }

    if (pieceType === 'k') {
      const isCastle = Math.abs(toCol - fromCol) === 2;
      if (isCastle) {
        move.castle = true;
        const rookFrom = this.coordsToSquare(fromRow, toCol > fromCol ? 7 : 0);
        const rookTo = this.coordsToSquare(fromRow, toCol > fromCol ? 5 : 3);
        const rookPiece = this.getPieceAt(rookFrom);
        this.setPieceAt(rookFrom, null);
        this.setPieceAt(rookTo, rookPiece);
      }
      if (this.turn === 'white') {
        this.castlingRights = this.normalizeCastlingRights(
          this.castlingRights.replace(/[KQ]/g, '')
        );
      } else {
        this.castlingRights = this.normalizeCastlingRights(
          this.castlingRights.replace(/[kq]/g, '')
        );
      }
    }

    if (pieceType === 'r') {
      if (move.from === 'a1') this.removeCastlingRight('Q');
      if (move.from === 'h1') this.removeCastlingRight('K');
      if (move.from === 'a8') this.removeCastlingRight('q');
      if (move.from === 'h8') this.removeCastlingRight('k');
    }

    if (capturedPiece) {
      if (capturedSquare === 'a1') this.removeCastlingRight('Q');
      if (capturedSquare === 'h1') this.removeCastlingRight('K');
      if (capturedSquare === 'a8') this.removeCastlingRight('q');
      if (capturedSquare === 'h8') this.removeCastlingRight('k');
    }

    if (this.castlingRights === '') {
      this.castlingRights = '-';
    }

    if (capturedPiece || pieceType === 'p') {
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
    return this.isCheck() && this.getAllLegalMoves().length === 0;
  }

  public isStalemate(): boolean {
    return !this.isCheck() && this.getAllLegalMoves().length === 0;
  }

  public isDraw(): boolean {
    return (
      this.isStalemate() ||
      this.halfMoveClock >= 100 ||
      this.isInsufficientMaterial()
    );
  }

  private isInsufficientMaterial(): boolean {
    const pieces: Exclude<Piece, null>[] = [];
    for (const row of this.board) {
      for (const piece of row) {
        if (piece && piece.toLowerCase() !== 'k') {
          pieces.push(piece);
        }
      }
    }

    if (pieces.length === 0) return true;
    if (pieces.length === 1) {
      const single = pieces[0].toLowerCase();
      return single === 'n' || single === 'b';
    }
    return false;
  }

  private getAllLegalMoves(): Move[] {
    const moves: Move[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = this.coordsToSquare(row, col);
        const piece = this.getPieceAt(square);
        if (!piece || !this.isOwnPiece(piece, this.turn)) continue;
        const validMoves = this.getValidMoves(square);
        for (const to of validMoves) {
          moves.push({ from: square, to, piece });
        }
      }
    }
    return moves;
  }

  public getAIMove(elo: number | string = 1200): Move | null {
    const value = typeof elo === 'string' ? parseInt(elo, 10) : elo;
    const clamped = Math.max(600, Math.min(2100, Number.isFinite(value) ? value : 1200));
    const depth = clamped < 1000 ? 1 : clamped < 1400 ? 2 : clamped < 1800 ? 3 : 4;
    return this.getBestMove(depth);
  }

  private getBestMove(depth: number): Move | null {
    const moves = this.getAllLegalMoves();
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const state = this.saveState();
      this.makeMove(move);
      const score = -this.minimax(depth - 1, -Infinity, Infinity, false);
      this.restoreState(state);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  private minimax(
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): number {
    if (depth === 0) return this.evaluatePosition();

    const moves = this.getAllLegalMoves();
    if (moves.length === 0) {
      if (this.isCheckmate()) return isMaximizing ? -10000 : 10000;
      return 0;
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        const state = this.saveState();
        this.makeMove(move);
        const score = this.minimax(depth - 1, alpha, beta, false);
        this.restoreState(state);
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxScore;
    }

    let minScore = Infinity;
    for (const move of moves) {
      const state = this.saveState();
      this.makeMove(move);
      const score = this.minimax(depth - 1, alpha, beta, true);
      this.restoreState(state);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minScore;
  }

  private evaluatePosition(): number {
    const pieceValues: Record<string, number> = {
      p: 100,
      n: 320,
      b: 330,
      r: 500,
      q: 900,
      k: 20000,
      P: 100,
      N: 320,
      B: 330,
      R: 500,
      Q: 900,
      K: 20000,
    };

    let score = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (!piece) continue;
        const value = pieceValues[piece] || 0;
        score += this.isWhitePiece(piece) ? value : -value;
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

  private saveState(): {
    board: Board;
    turn: 'white' | 'black';
    castlingRights: string;
    enPassantSquare: string;
    halfMoveClock: number;
    fullMoveNumber: number;
  } {
    return {
      board: this.board.map((row) => [...row]),
      turn: this.turn,
      castlingRights: this.castlingRights,
      enPassantSquare: this.enPassantSquare,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
    };
  }

  private restoreState(state: {
    board: Board;
    turn: 'white' | 'black';
    castlingRights: string;
    enPassantSquare: string;
    halfMoveClock: number;
    fullMoveNumber: number;
  }): void {
    this.board = state.board.map((row) => [...row]);
    this.turn = state.turn;
    this.castlingRights = state.castlingRights;
    this.enPassantSquare = state.enPassantSquare;
    this.halfMoveClock = state.halfMoveClock;
    this.fullMoveNumber = state.fullMoveNumber;
  }
}
