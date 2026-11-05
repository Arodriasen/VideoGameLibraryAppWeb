import { Icon } from './Icon';

/** Como en las otras apps: tocar la estrella ya puesta quita la puntuación. */
export function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="stars" role="group" aria-label="Puntuación">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
          aria-pressed={value === star}
          className={star <= value ? 'stars__star stars__star--on' : 'stars__star'}
          onClick={() => onChange(value === star ? 0 : star)}
        >
          <Icon name="star" filled={star <= value} size={30} />
        </button>
      ))}
    </div>
  );
}
