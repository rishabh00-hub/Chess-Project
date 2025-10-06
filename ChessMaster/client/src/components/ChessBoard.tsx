import { useState, useEffect } from "react";
import { ChessEngine, type Move } from "@shared/chessEngine";

interface ChessBoardProps {
  size?: 'small' | 'medium' | 'large';
  interactive?: boolean;
  position?: string;
  currentTurn?: 'white' | 'black';
  onMove?: (move: { from: string; to: string; promotion?: string }) => void;
  disabled?: boolean;
  showStatus?: boolean;
}

const pieceSymbols: { [key: string]: string } = {
  'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
  'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

export default function ChessBoard({ 
  size = 'medium', 
  interactive = false, 
  position = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  currentTurn = 'white',
  onMove,
  disabled = false,
  showStatus = true
}: ChessBoardProps) {
  const [engine, setEngine] = useState<ChessEngine>(new ChessEngine(position));
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    setEngine(new ChessEngine(position));
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [position]);

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return { board: 'w-64 h-64', square: 'w-8 h-8', text: 'text-2xl' };
      case 'large':
        return { board: 'w-[28rem] h-[28rem]', square: 'w-14 h-14', text: 'text-5xl' };
      default:
        return { board: 'w-80 h-80', square: 'w-10 h-10', text: 'text-3xl' };
    }
  };

  const classes = getSizeClasses();
  const board = engine.getBoard();
  const gameStatus = engine.getGameStatus();
  const isCheck = engine.isCheck();

  const handleSquareClick = (row: number, col: number) => {
    if (!interactive || disabled || gameStatus !== 'active') return;
    
    const squareId = coordsToSquare(row, col);
    const piece = board[row][col];

    if (selectedSquare) {
      if (legalMoves.includes(squareId)) {
        const [fromRow, fromCol] = selectedSquare.split('').map((c, i) => 
          i === 0 ? c.charCodeAt(0) - 'a'.charCodeAt(0) : 8 - parseInt(c)
        );
        const movingPiece = board[fromRow][fromCol];
        
        const isPromotion = movingPiece?.toLowerCase() === 'p' && 
          ((row === 0 && currentTurn === 'white') || (row === 7 && currentTurn === 'black'));
        
        let promotion: string | undefined;
        if (isPromotion) {
          promotion = currentTurn === 'white' ? 'Q' : 'q';
        }

        setLastMove({ from: selectedSquare, to: squareId });
        setSelectedSquare(null);
        setLegalMoves([]);
        
        if (onMove) {
          onMove({ from: selectedSquare, to: squareId, promotion });
        }
      } else if (piece && isPieceOwnedByPlayer(piece, currentTurn)) {
        const moves = engine.getValidMoves(squareId);
        setSelectedSquare(squareId);
        setLegalMoves(moves);
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    } else {
      if (piece && isPieceOwnedByPlayer(piece, currentTurn)) {
        const moves = engine.getValidMoves(squareId);
        setSelectedSquare(squareId);
        setLegalMoves(moves);
      }
    }
  };

  const coordsToSquare = (row: number, col: number): string => {
    return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
  };

  const isPieceOwnedByPlayer = (piece: string | null, player: 'white' | 'black'): boolean => {
    if (!piece) return false;
    if (player === 'white') return piece === piece.toUpperCase();
    return piece === piece.toLowerCase();
  };

  const isLightSquare = (row: number, col: number) => {
    return (row + col) % 2 === 0;
  };

  const isSelected = (row: number, col: number) => {
    return selectedSquare === coordsToSquare(row, col);
  };

  const isLegalMove = (row: number, col: number) => {
    return legalMoves.includes(coordsToSquare(row, col));
  };

  const isLastMove = (row: number, col: number) => {
    if (!lastMove) return false;
    const square = coordsToSquare(row, col);
    return square === lastMove.from || square === lastMove.to;
  };

  const isKingInCheck = (row: number, col: number) => {
    const piece = board[row][col];
    return isCheck && piece?.toLowerCase() === 'k' && isPieceOwnedByPlayer(piece, currentTurn);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="chessboard-container">
      {showStatus && (
        <div className="flex justify-between items-center px-2" data-testid="game-status">
          <div className={`px-3 py-1.5 rounded-lg font-medium text-sm ${
            currentTurn === 'white' 
              ? 'bg-slate-700 text-white' 
              : 'bg-slate-900 text-white'
          }`}>
            {currentTurn === 'white' ? '⚪' : '⚫'} {currentTurn === 'white' ? 'White' : 'Black'} to move
          </div>
          {isCheck && gameStatus === 'active' && (
            <div className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-medium text-sm animate-pulse" data-testid="check-indicator">
              ⚠️ Check!
            </div>
          )}
          {gameStatus === 'checkmate' && (
            <div className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-sm" data-testid="checkmate-indicator">
              👑 Checkmate!
            </div>
          )}
          {gameStatus === 'stalemate' && (
            <div className="px-3 py-1.5 rounded-lg bg-yellow-500 text-white font-medium text-sm" data-testid="stalemate-indicator">
              🤝 Stalemate
            </div>
          )}
        </div>
      )}
      
      <div 
        className={`grid grid-cols-8 gap-0 ${classes.board} mx-auto border-4 border-slate-700 rounded-xl overflow-hidden shadow-2xl`}
        data-testid="chessboard-grid"
      >
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const square = coordsToSquare(rowIndex, colIndex);
            const isLight = isLightSquare(rowIndex, colIndex);
            const selected = isSelected(rowIndex, colIndex);
            const legal = isLegalMove(rowIndex, colIndex);
            const lastMoveHighlight = isLastMove(rowIndex, colIndex);
            const kingCheck = isKingInCheck(rowIndex, colIndex);

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                data-testid={`square-${square}`}
                className={`
                  ${classes.square} 
                  flex items-center justify-center 
                  ${classes.text}
                  relative
                  ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
                  ${selected ? 'ring-4 ring-blue-500 ring-inset bg-blue-200 dark:bg-blue-700' : ''}
                  ${lastMoveHighlight ? 'bg-yellow-300 dark:bg-yellow-700' : ''}
                  ${kingCheck ? 'bg-red-400 dark:bg-red-700 ring-4 ring-red-600' : ''}
                  ${interactive && !disabled ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : ''}
                  transition-all duration-150
                `}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
              >
                {piece && (
                  <span 
                    data-testid={`piece-${square}`}
                    className={`
                      ${piece === piece.toUpperCase() ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]'}
                      font-bold
                      ${interactive && !disabled ? 'select-none' : ''}
                      z-10 relative
                    `}
                  >
                    {pieceSymbols[piece]}
                  </span>
                )}
                
                {legal && (
                  <div 
                    data-testid={`legal-move-${square}`}
                    className={`absolute inset-0 flex items-center justify-center pointer-events-none z-0`}
                  >
                    <div className={`
                      ${piece ? 'w-full h-full border-4 border-green-500 rounded-full' : 'w-4 h-4 bg-green-500 rounded-full opacity-70'}
                    `} />
                  </div>
                )}

                {rowIndex === 7 && (
                  <span className={`absolute bottom-0.5 right-0.5 text-[10px] font-semibold ${isLight ? 'text-amber-700' : 'text-amber-200'}`}>
                    {String.fromCharCode(97 + colIndex)}
                  </span>
                )}
                {colIndex === 0 && (
                  <span className={`absolute top-0.5 left-0.5 text-[10px] font-semibold ${isLight ? 'text-amber-700' : 'text-amber-200'}`}>
                    {8 - rowIndex}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {showStatus && (
        <div className="text-center text-sm text-slate-400" data-testid="move-hint">
          {selectedSquare ? `Selected: ${selectedSquare.toUpperCase()} • Click a highlighted square to move` : 'Click a piece to see legal moves'}
        </div>
      )}
    </div>
  );
}
