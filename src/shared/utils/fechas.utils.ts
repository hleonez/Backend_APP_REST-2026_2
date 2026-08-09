// Fechas canónicas de la aplicación.
// Todas las reglas de "día" (test diario, rachas, estadísticas) se calculan
// con la zona horaria del negocio (Colombia, America/Bogota, UTC-5 sin DST).

export const APP_TIMEZONE = 'America/Bogota';

const toIsoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const getTodayIso = (): string => {
  return toIsoFormatter.format(new Date());
};

export const toIsoDate = (date: Date): string => {
  return toIsoFormatter.format(date);
};
