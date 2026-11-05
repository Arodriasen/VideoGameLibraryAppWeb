import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import type { Game } from '../../domain/game';
import { GameCard } from './GameCard';
import { Icon } from './Icon';

const LONG_PRESS_MS = 500;
/** Más movimiento que esto es desplazar la lista, no mantener pulsado. */
const MOVE_TOLERANCE_PX = 10;

interface SelectableCardProps {
  game: Game;
  selecting: boolean;
  selected: boolean;
  onLongPress: (id: number) => void;
  onToggle: (id: number) => void;
}

/** Tarjeta normal que, como en Android, entra en modo selección al mantenerla pulsada. */
export function SelectableCard({ game, selecting, selected, onLongPress, onToggle }: SelectableCardProps) {
  const timer = useRef<number | null>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  // Al soltar tras la pulsación larga llega un clic que no debe abrir la ficha.
  const ignoreNextClick = useRef(false);

  function cancelTimer() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => cancelTimer, []);

  function handlePointerDown(event: PointerEvent) {
    ignoreNextClick.current = false;
    if (selecting) return;
    startPoint.current = { x: event.clientX, y: event.clientY };
    cancelTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      ignoreNextClick.current = true;
      onLongPress(game.id);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: PointerEvent) {
    const movedX = Math.abs(event.clientX - startPoint.current.x);
    const movedY = Math.abs(event.clientY - startPoint.current.y);
    if (movedX > MOVE_TOLERANCE_PX || movedY > MOVE_TOLERANCE_PX) cancelTimer();
  }

  function handleClickCapture(event: MouseEvent) {
    if (!selecting && !ignoreNextClick.current) return;

    // Antes de que llegue al enlace, para que no abra la ficha.
    event.preventDefault();
    event.stopPropagation();
    if (ignoreNextClick.current) ignoreNextClick.current = false;
    else onToggle(game.id);
  }

  return (
    <div
      className={selected ? 'selectable selectable--selected' : 'selectable'}
      aria-selected={selecting ? selected : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelTimer}
      onPointerCancel={cancelTimer}
      onContextMenu={(event) => event.preventDefault()}
      onClickCapture={handleClickCapture}
    >
      <GameCard game={game} />
      {selecting && (
        <span className="selectable__check" aria-hidden="true">
          {selected && <Icon name="check" size={16} />}
        </span>
      )}
    </div>
  );
}
