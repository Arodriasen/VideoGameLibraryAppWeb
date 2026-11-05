import type { GameCandidate } from '../../domain/game';
import { Icon } from './Icon';

interface CandidatePickerProps {
  candidates: GameCandidate[];
  onPick: (candidate: GameCandidate) => void;
  onClose: () => void;
}

export function CandidatePicker({ candidates, onPick, onClose }: CandidatePickerProps) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Elige el juego">
      <div className="sheet__panel">
        <header className="sheet__header">
          <h2>¿Cuál es?</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <ul className="sheet__list">
          {candidates.map((candidate, index) => (
            <li key={`${candidate.title}-${index}`}>
              <button type="button" className="candidate" onClick={() => onPick(candidate)}>
                <span className="candidate__cover">
                  {candidate.coverUrl ? (
                    <img
                      src={candidate.coverUrl.replace(/^http:/, 'https:')}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Icon name="gamepad" size={22} />
                  )}
                </span>
                <span className="candidate__text">
                  <strong>{candidate.title}</strong>
                  <small>{[candidate.platform, candidate.year].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
