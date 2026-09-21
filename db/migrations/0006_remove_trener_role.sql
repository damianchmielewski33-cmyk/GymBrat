-- Konta z rolą trenera nie są już wspierane — normalizacja do zawodnika.
UPDATE users SET app_role = 'zawodnik' WHERE app_role = 'trener';
