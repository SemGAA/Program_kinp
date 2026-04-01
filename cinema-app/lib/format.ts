export function formatShortDate(value: string | null) {
  if (!value) {
    return 'Без даты';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function formatRuntime(runtime: number | null) {
  if (!runtime) {
    return 'Длительность не указана';
  }

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}