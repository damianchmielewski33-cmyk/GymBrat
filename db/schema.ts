import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey(),
  /** 1 = admin wyłączył AI globalnie w aplikacji */
  aiGloballyDisabled: integer("ai_globally_disabled").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Assety brandingu (logo / ikony) — upload z panelu admina, bez deployu kodu.
 * Wartość to data URL (jak body_report_photos); serwowane przez /api/branding/asset/[slot].
 */
export const appBrandingAssets = sqliteTable("app_branding_assets", {
  /** np. logo_app | logo_login | icon_web | icon_pwa | icon_android | icon_ios */
  slot: text("slot").primaryKey(),
  mimeType: text("mime_type").notNull(),
  dataUrl: text("data_url").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  weightKg: real("weight_kg"),
  heightCm: integer("height_cm"),
  age: integer("age"),
  /** `male` | `female` — opcjonalne; Keytel kcal cardio. */
  sex: text("sex"),
  activityLevel: text("activity_level"),
  /** `zawodnik` | `trener` | `admin` — admin ustawiany przez ADMIN_EMAILS, bootstrap lub panel. */
  appRole: text("app_role").notNull().default("zawodnik"),
  /** @deprecated kolumna historyczna — integracja Fitatu usunięta, wartość czyszczona przy starcie. */
  fitatuAccessToken: text("fitatu_access_token"),
  /** Koniec aktywnego pakietu (NULL = brak / reklamy AdMob). */
  packageEndsAt: integer("package_ends_at", { mode: "timestamp_ms" }),
  /** Ostatni zakupiony / nadany plan (sku). */
  packagePlanSku: text("package_plan_sku"),
  /** Notatka administratora na karcie konta. */
  adminNote: text("admin_note"),
  /** Potwierdzenie kontroli adresu (kod z e-maila, Google z `email_verified`); NULL = niezweryfikowany. */
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
  /** Wersja sesji: podbicie unieważnia wszystkie wydane JWT (`lib/account-auth-state.ts`). */
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Oferty pakietów — ceny i opisy edytowalne w panelu admina. */
export const subscriptionPlans = sqliteTable(
  "subscription_plans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** np. d7 | d30 | d90 | d365 */
    sku: text("sku").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    days: integer("days").notNull(),
    /** Cena w groszach PLN (np. 399 = 3,99 zł). */
    priceGrosze: integer("price_grosze").notNull(),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("subscription_plans_active_sort").on(t.active, t.sortOrder)],
);

/** Zamówienia HotPay / ręczne nadania pakietu. */
export const subscriptionOrders = sqliteTable(
  "subscription_orders",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").references(() => subscriptionPlans.id, {
      onDelete: "set null",
    }),
    planSku: text("plan_sku").notNull(),
    days: integer("days").notNull(),
    amountGrosze: integer("amount_grosze").notNull(),
    /** pending | paid | failed | cancelled | manual */
    status: text("status").notNull().default("pending"),
    hotpayPaymentId: text("hotpay_payment_id"),
    source: text("source").notNull().default("hotpay"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("subscription_orders_user_created").on(t.userId, t.createdAt),
    index("subscription_orders_status").on(t.status),
  ],
);

/**
 * Powiązania OAuth (Google itd.) z kontem `users`.
 * Logowanie hasłem nadal używa `users.password_hash`; konta Google mają losowy hash.
 */
export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("oauth_accounts_provider_account").on(
      t.provider,
      t.providerAccountId,
    ),
    index("oauth_accounts_user").on(t.userId),
  ],
);

/**
 * Jednorazowe kody weryfikacyjne wysyłane e-mailem (rejestracja / reset hasła w przyszłości).
 * Przechowujemy wyłącznie hash kodu (nigdy jawnego kodu).
 */
export const emailVerificationCodes = sqliteTable(
  "email_verification_codes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    /** np. "register" (przyszłościowo: "reset_password") */
    purpose: text("purpose").notNull().default("register"),
    codeHash: text("code_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    sendCount: integer("send_count").notNull().default(1),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastSentAt: integer("last_sent_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("idx_email_verification_codes_email_purpose").on(t.email, t.purpose),
    index("idx_email_verification_codes_expires").on(t.expiresAt),
  ],
);

export const bodyReports = sqliteTable("body_reports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Data utworzenia raportu */
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  weightKg: real("weight_kg"),
  waistCm: real("waist_cm"),
  chestCm: real("chest_cm"),
  thighCm: real("thigh_cm"),
  /** Obwód ramienia (cm) */
  armCm: real("arm_cm"),
  /** Obwód brzucha (cm) */
  abdomenCm: real("abdomen_cm"),
  /** Energia podczas ćwiczeń 1-10 */
  trainingEnergy: integer("training_energy"),
  /** Jakość snu 1-10 */
  sleepQuality: integer("sleep_quality"),
  /** Energia w ciągu dnia 1-10 */
  dayEnergy: integer("day_energy"),
  /** Trawienie 1-10 */
  digestionScore: integer("digestion_score"),
  /** Czy cardio zgodnie z zaleceniami: tak / nie */
  cardioCompliance: text("cardio_compliance"),
  /** Czy dieta zgodnie z zaleceniami: tak / nie */
  dietCompliance: text("diet_compliance"),
  /** Czy trening zgodnie z zaleceniami: tak / nie */
  trainingCompliance: text("training_compliance"),
  /** Jeśli w poprzednich polach jest NIE — czego nie zrealizowano */
  complianceNotes: text("compliance_notes"),
  /** Informacje dodatkowe */
  additionalInfo: text("additional_info"),
});

export const bodyReportPhotos = sqliteTable("body_report_photos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reportId: text("report_id")
    .notNull()
    .references(() => bodyReports.id, { onDelete: "cascade" }),
  /** Data URL (base64) — docelowo można wymienić na URL storage */
  dataUrl: text("data_url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const dailyCheckins = sqliteTable(
  "daily_checkins",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Local calendar day as YYYY-MM-DD */
    date: text("date").notNull(),
    /** 1-10 */
    sleepQuality: integer("sleep_quality"),
    /** 1-10 */
    dayEnergy: integer("day_energy"),
    /** 1-10 */
    stress: integer("stress"),
    weightKg: real("weight_kg"),
    notes: text("notes"),
    dayClosedAt: integer("day_closed_at", { mode: "timestamp_ms" }),
    summaryJson: text("summary_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_daily_checkins_user_date").on(t.userId, t.date)],
);

export const workouts = sqliteTable(
  "workouts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Ostatnio zapisany trening z planu — do sortowania i historii. */
    workoutPlanId: text("workout_plan_id"),
    /** Local calendar day as YYYY-MM-DD */
    date: text("date").notNull(),
    cardioMinutes: integer("cardio_minutes").notNull().default(0),
    exercises: text("exercises").notNull(),
  },
  (t) => [
    index("idx_workouts_user_plan_date").on(t.userId, t.workoutPlanId, t.date),
    index("idx_workouts_user_date").on(t.userId, t.date),
  ],
);

/** Wejścia na ekrany — agregacja w panelu administratora (por. page_views). */
export const pageViews = sqliteTable(
  "page_views",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    screenKey: text("screen_key").notNull(),
    pathname: text("pathname").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    visitorId: text("visitor_id").notNull(),
    /** `production` | `preview` | `development` — zsynchronizowane z Vercel / NODE_ENV. */
    deploymentEnv: text("deployment_env"),
    /** Przechowywane jako ISO 8601 (UTC) dla porównań z zakresem dat. */
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_page_views_created").on(t.createdAt),
    index("idx_page_views_screen_created").on(t.screenKey, t.createdAt),
    index("idx_page_views_user_created").on(t.userId, t.createdAt),
  ],
);

/** Dziennik zdarzeń (logowanie, rejestracja, akcje) do analizy zachowań. */
export const siteActivityLog = sqliteTable("site_activity_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metaJson: text("meta_json"),
  deploymentEnv: text("deployment_env"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Zmiany w panelu administratora (kto, co, kiedy). */
export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorUserId: text("actor_user_id").notNull(),
    action: text("action").notNull(),
    targetUserId: text("target_user_id"),
    metaJson: text("meta_json"),
    deploymentEnv: text("deployment_env"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_admin_audit_created").on(t.createdAt)],
);

/** Globalny katalog przepisów (import JSON z panelu admina). */
export const mealCatalog = sqliteTable(
  "meal_catalog",
  {
    id: text("id").primaryKey(),
    /** Pełny obiekt CatalogMeal jako JSON. */
    payloadJson: text("payload_json").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedByUserId: text("updated_by_user_id"),
  },
  (t) => [index("idx_meal_catalog_updated").on(t.updatedAt)],
);

/**
 * Grafiki przepisów wygenerowane raz przy imporcie JSON (Pollinations).
 * Serwowane przez /api/catalog-meal-image/[id] — bez ponownej generacji przy przeglądaniu.
 */
export const mealCatalogImages = sqliteTable("meal_catalog_images", {
  mealId: text("meal_id")
    .primaryKey()
    .references(() => mealCatalog.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  /** data:image/…;base64,… */
  dataUrl: text("data_url").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Linki techniki (YouTube) do ćwiczeń z katalogu — konfiguracja w panelu admina.
 * `id` = CatalogExercise.id (np. c-bench-bar).
 */
export const exerciseTechniqueLinks = sqliteTable(
  "exercise_technique_links",
  {
    id: text("id").primaryKey(),
    youtubeUrl: text("youtube_url").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedByUserId: text("updated_by_user_id"),
  },
  (t) => [index("idx_exercise_technique_updated").on(t.updatedAt)],
);

/** Wpisy posiłków dodane ręcznie / ze skanu — źródło spożycia makroskładników. */
export const mealLogs = sqliteTable(
  "meal_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD — dzień kalendarzowy jak w treningach */
    date: text("date").notNull(),
    name: text("name"),
    /** Sekcja dziennika: śniadanie / drugie / lunch / obiad / przekąska */
    slot: text("slot"),
    /** Kod EAN produktu, jeśli dodano ze skanu / bazy */
    barcode: text("barcode"),
    calories: real("calories").notNull(),
    proteinG: real("protein_g").notNull(),
    fatG: real("fat_g").notNull(),
    carbsG: real("carbs_g").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_meal_logs_user_date").on(t.userId, t.date)],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  settings: one(userSettings),
  trainingSessions: many(trainingSessions),
  workouts: many(workouts),
  workoutPlans: many(workoutPlans),
  weightLogs: many(weightLogs),
  bodyReports: many(bodyReports),
  mealLogs: many(mealLogs),
  dailyCheckins: many(dailyCheckins),
  oauthAccounts: many(oauthAccounts),
  subscriptionOrders: many(subscriptionOrders),
}));

export const subscriptionPlansRelations = relations(
  subscriptionPlans,
  ({ many }) => ({
    orders: many(subscriptionOrders),
  }),
);

export const subscriptionOrdersRelations = relations(
  subscriptionOrders,
  ({ one }) => ({
    user: one(users, {
      fields: [subscriptionOrders.userId],
      references: [users.id],
    }),
    plan: one(subscriptionPlans, {
      fields: [subscriptionOrders.planId],
      references: [subscriptionPlans.id],
    }),
  }),
);

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

export const mealLogsRelations = relations(mealLogs, ({ one }) => ({
  user: one(users, {
    fields: [mealLogs.userId],
    references: [users.id],
  }),
}));

export const bodyReportsRelations = relations(bodyReports, ({ one, many }) => ({
  user: one(users, {
    fields: [bodyReports.userId],
    references: [users.id],
  }),
  photos: many(bodyReportPhotos),
}));

export const bodyReportPhotosRelations = relations(bodyReportPhotos, ({ one }) => ({
  report: one(bodyReports, {
    fields: [bodyReportPhotos.reportId],
    references: [bodyReports.id],
  }),
}));

export const dailyCheckinsRelations = relations(dailyCheckins, ({ one }) => ({
  user: one(users, {
    fields: [dailyCheckins.userId],
    references: [users.id],
  }),
}));

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Cel minut cardio na tydzień */
  weeklyCardioGoalMinutes: integer("weekly_cardio_goal_minutes")
    .notNull()
    .default(150),
  /** Co ile dni dodawać raport sylwetki (timer na Pulpicie restartuje się po zapisie). */
  reportCadenceDays: integer("report_cadence_days").notNull().default(14),
  /** JSON: { calories, proteinG, fatG, carbsG } — cele na dzień treningowy */
  trainingNutritionGoalsJson: text("training_nutrition_goals_json"),
  /** JSON: { calories, proteinG, fatG, carbsG } — cele na dzień nietreningowy */
  restNutritionGoalsJson: text("rest_nutrition_goals_json"),
  /** JSON: Record<YYYY-MM-DD, "training" | "rest"> — brak wpisu = dzień nietreningowy */
  nutritionDayTypesJson: text("nutrition_day_types_json"),
  /** JSON: przypomnienia przeglądarki / e-mail — patrz lib/reminders-types.ts */
  remindersJson: text("reminders_json"),
  /** JSON: szablony posiłków [{ id, name, calories, proteinG, fatG, carbsG }] */
  mealTemplatesJson: text("meal_templates_json"),
  /** JSON: cele treningowe — patrz lib/fitness-goals.ts */
  fitnessGoalsJson: text("fitness_goals_json"),
  /** Ukończony onboarding / kliknięto „Później” */
  onboardingCompletedAt: integer("onboarding_completed_at", { mode: "timestamp_ms" }),
  /** Przejrzana instrukcja startowa (popup z Dalej) po założeniu konta */
  introTourCompletedAt: integer("intro_tour_completed_at", { mode: "timestamp_ms" }),
  /** 1 = admin nadał dostęp do funkcji AI; 0 = użytkownik nie widzi opcji AI i API blokuje wywołania */
  aiEntitled: integer("ai_entitled").notNull().default(1),
  /** 1 = użytkownik wyłączył wszystkie funkcje korzystające z modelu AI */
  aiFeaturesDisabled: integer("ai_features_disabled").notNull().default(0),
  /** Jednostka delty postępów: percent | kg (tonaż / objętość vs poprzedni trening planu). */
  progressDeltaUnit: text("progress_delta_unit").notNull().default("percent"),
  /** Własne zdjęcie startowe (data URL, szyfrowane) — Przemiana / Postępy → Zdjęcia. */
  startPhotoDataUrl: text("start_photo_data_url"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const workoutPlans = sqliteTable("workout_plans", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planJson: text("plan_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Jedna aktywna (niedokończona) sesja treningu na użytkownika — sync między urządzeniami. */
export const activeWorkoutSessions = sqliteTable("active_workout_sessions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  payloadJson: text("payload_json").notNull(),
  revision: integer("revision").notNull().default(1),
  deviceId: text("device_id").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const workoutPlansRelations = relations(workoutPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [workoutPlans.userId],
    references: [users.id],
  }),
  workouts: many(workouts),
}));

export const weightLogs = sqliteTable("weight_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recordedAt: integer("recorded_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  weightKg: real("weight_kg").notNull(),
  notes: text("notes"),
});

export const weightLogsRelations = relations(weightLogs, ({ one }) => ({
  user: one(users, {
    fields: [weightLogs.userId],
    references: [users.id],
  }),
}));

export const trainingSessions = sqliteTable("training_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  cardioMinutes: integer("cardio_minutes").notNull().default(0),
  exerciseDataJson: text("exercise_data_json"),
  notes: text("notes"),
});

export const trainingSessionsRelations = relations(
  trainingSessions,
  ({ one }) => ({
    user: one(users, {
      fields: [trainingSessions.userId],
      references: [users.id],
    }),
  }),
);

export const workoutsRelations = relations(workouts, ({ one }) => ({
  user: one(users, {
    fields: [workouts.userId],
    references: [users.id],
  }),
  workoutPlan: one(workoutPlans, {
    fields: [workouts.workoutPlanId],
    references: [workoutPlans.id],
  }),
}));

/**
 * Zgłoszenia błędów od testerów / użytkowników.
 * status: `analysis` | `in_fix` | `retest` | `fixed`
 * priority: `critical` | `high` | `normal` | `low`
 * expected_behavior / steps_to_reproduce: legacy (puste przy nowych zgłoszeniach).
 */
export const bugReports = sqliteTable(
  "bug_reports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    expectedBehavior: text("expected_behavior").notNull().default(""),
    stepsToReproduce: text("steps_to_reproduce").notNull().default(""),
    priority: text("priority").notNull(),
    status: text("status").notNull().default("analysis"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    /** Kiedy admin pierwszy raz zobaczył zgłoszenie na liście (NULL = niewidziane → badge). */
    adminSeenAt: integer("admin_seen_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("bug_reports_status_created").on(t.status, t.createdAt),
    index("bug_reports_user").on(t.userId),
  ],
);

export const bugReportPhotos = sqliteTable(
  "bug_report_photos",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReports.id, { onDelete: "cascade" }),
    /** Data URL — szyfrowany jak zdjęcia raportów. */
    dataUrl: text("data_url").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("bug_report_photos_bug").on(t.bugReportId)],
);

export const bugReportsRelations = relations(bugReports, ({ one, many }) => ({
  user: one(users, {
    fields: [bugReports.userId],
    references: [users.id],
  }),
  photos: many(bugReportPhotos),
}));

export const bugReportPhotosRelations = relations(bugReportPhotos, ({ one }) => ({
  bugReport: one(bugReports, {
    fields: [bugReportPhotos.bugReportId],
    references: [bugReports.id],
  }),
}));

/**
 * Community Teams — grupy zawodników (publiczne / prywatne).
 * role w team_members: owner | admin | moderator | member
 * privacy: public | private
 */
export const teams = sqliteTable(
  "teams",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** public = searchable + join; private = tylko kod / zaproszenie */
    privacy: text("privacy").notNull().default("private"),
    /** Kod dołączania (wielkość liter ignorowana przy join). */
    inviteCode: text("invite_code").notNull(),
    /** Emoji lub krótki znak jako avatar (bez osobnego storage w v1). */
    avatarEmoji: text("avatar_emoji").notNull().default("🏋️"),
    /** Hex koloru bannera, np. #1a1a1c */
    bannerColor: text("banner_color").notNull().default("#1a1a1c"),
    rankingMetric: text("ranking_metric").notNull().default("fcs"),
    maxMembers: integer("max_members").notNull().default(50),
    memberCount: integer("member_count").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("teams_invite_code_uidx").on(t.inviteCode),
    index("teams_owner_created_idx").on(t.ownerUserId, t.createdAt),
    index("teams_privacy_name_idx").on(t.privacy, t.name),
    index("teams_archived_idx").on(t.archivedAt),
  ],
);

/**
 * Cache tygodniowego Fair Competition Score (FCS) per członek teamu.
 * Recompute przy odczycie rankingu (TTL in-process + upsert).
 */
export const teamFcsScores = sqliteTable(
  "team_fcs_scores",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Poniedziałek tygodnia YYYY-MM-DD (kalendarz app). */
    weekStart: text("week_start").notNull(),
    /** 0–100 */
    fcs: real("fcs").notNull().default(0),
    /** JSON: komponenty 0–1 + newcomerBoost */
    componentsJson: text("components_json").notNull().default("{}"),
    computedAt: integer("computed_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("team_fcs_scores_team_user_week_uidx").on(
      t.teamId,
      t.userId,
      t.weekStart,
    ),
    index("team_fcs_scores_team_week_fcs_idx").on(t.teamId, t.weekStart, t.fcs),
  ],
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    /** active | invited | left | banned */
    status: text("status").notNull().default("active"),
    mutedNotifications: integer("muted_notifications").notNull().default(0),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    leftAt: integer("left_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("team_members_team_user_uidx").on(t.teamId, t.userId),
    index("team_members_user_status_idx").on(t.userId, t.status),
    index("team_members_team_status_idx").on(t.teamId, t.status),
  ],
);

/**
 * Zaproszenia do teamu — e-mail (dopasowanie do users) lub token linku.
 * status: pending | accepted | declined | revoked | expired
 */
export const teamInvitations = sqliteTable(
  "team_invitations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Docelowy user gdy znamy konto; null przy zaproszeniu tylko e-mailowym. */
    inviteeUserId: text("invitee_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    inviteeEmail: text("invitee_email"),
    /** Rola po akceptacji — nigdy owner. */
    role: text("role").notNull().default("member"),
    token: text("token").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("team_invitations_token_uidx").on(t.token),
    index("team_invitations_team_status_idx").on(t.teamId, t.status),
    index("team_invitations_invitee_user_idx").on(t.inviteeUserId, t.status),
    index("team_invitations_invitee_email_idx").on(t.inviteeEmail, t.status),
  ],
);

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, {
    fields: [teams.ownerUserId],
    references: [users.id],
  }),
  members: many(teamMembers),
  invitations: many(teamInvitations),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [teamInvitations.invitedByUserId],
    references: [users.id],
  }),
  invitee: one(users, {
    fields: [teamInvitations.inviteeUserId],
    references: [users.id],
  }),
}));

/**
 * Team Feed — posty auto (trening/PR/…) i ręczne (tekst/zdjęcia).
 * type: workout_complete | personal_record | achievement | streak | challenge_complete | level_up | text | gallery
 */
export const teamPosts = sqliteTable(
  "team_posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    body: text("body").notNull().default(""),
    /** Immutable snapshot metryk / tytułu auto-posta. */
    snapshotJson: text("snapshot_json").notNull().default("{}"),
    /** Dedup auto-postów w zespole, np. workout:{id}. */
    sourceKey: text("source_key"),
    reactionCount: integer("reaction_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    moderationStatus: text("moderation_status").notNull().default("visible"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("team_posts_team_created_idx").on(t.teamId, t.createdAt),
    index("team_posts_author_created_idx").on(t.authorUserId, t.createdAt),
    /** Feed list: team + moderation + created (deleted filtrowane w WHERE). */
    index("team_posts_team_mod_created_idx").on(
      t.teamId,
      t.moderationStatus,
      t.createdAt,
    ),
    uniqueIndex("team_posts_team_source_uidx").on(t.teamId, t.sourceKey),
  ],
);

export const teamPostMedia = sqliteTable(
  "team_post_media",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => teamPosts.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    mimeType: text("mime_type").notNull(),
    /** JPEG/PNG data URL (skompresowany po stronie klienta). */
    dataUrl: text("data_url").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("team_post_media_post_idx").on(t.postId, t.sortOrder)],
);

export const teamPostComments = sqliteTable(
  "team_post_comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => teamPosts.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: text("parent_comment_id"),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("team_post_comments_post_created_idx").on(t.postId, t.createdAt),
    index("team_post_comments_parent_idx").on(t.parentCommentId),
    index("team_post_comments_post_deleted_created_idx").on(
      t.postId,
      t.deletedAt,
      t.createdAt,
    ),
  ],
);

export const teamPostReactions = sqliteTable(
  "team_post_reactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => teamPosts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** beast | strong | king | monster | progress | insane */
    kind: text("kind").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("team_post_reactions_post_user_uidx").on(t.postId, t.userId),
    index("team_post_reactions_post_kind_idx").on(t.postId, t.kind),
  ],
);

export const teamPostMentions = sqliteTable(
  "team_post_mentions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => teamPosts.id, { onDelete: "cascade" }),
    commentId: text("comment_id").references(() => teamPostComments.id, {
      onDelete: "cascade",
    }),
    mentionedUserId: text("mentioned_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("team_post_mentions_post_idx").on(t.postId),
    index("team_post_mentions_user_idx").on(t.mentionedUserId),
  ],
);

/** Lekki log zdarzeń pod SSE realtime. */
export const teamFeedEvents = sqliteTable(
  "team_feed_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    /** post_created | post_deleted | comment_created | reaction_changed */
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    actorUserId: text("actor_user_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("team_feed_events_team_created_idx").on(t.teamId, t.createdAt)],
);

/** Dedup milestone’ów użytkownika (achievement / streak / level / challenge). */
export const communityMilestones = sqliteTable(
  "community_milestones",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    milestoneKey: text("milestone_key").notNull(),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    metaJson: text("meta_json").notNull().default("{}"),
  },
  (t) => [
    uniqueIndex("community_milestones_user_kind_key_uidx").on(
      t.userId,
      t.kind,
      t.milestoneKey,
    ),
  ],
);

export const teamPostsRelations = relations(teamPosts, ({ one, many }) => ({
  team: one(teams, {
    fields: [teamPosts.teamId],
    references: [teams.id],
  }),
  author: one(users, {
    fields: [teamPosts.authorUserId],
    references: [users.id],
  }),
  media: many(teamPostMedia),
  comments: many(teamPostComments),
  reactions: many(teamPostReactions),
  mentions: many(teamPostMentions),
}));

export const teamPostMediaRelations = relations(teamPostMedia, ({ one }) => ({
  post: one(teamPosts, {
    fields: [teamPostMedia.postId],
    references: [teamPosts.id],
  }),
}));

export const teamPostCommentsRelations = relations(
  teamPostComments,
  ({ one }) => ({
    post: one(teamPosts, {
      fields: [teamPostComments.postId],
      references: [teamPosts.id],
    }),
    author: one(users, {
      fields: [teamPostComments.authorUserId],
      references: [users.id],
    }),
  }),
);

export const teamPostReactionsRelations = relations(
  teamPostReactions,
  ({ one }) => ({
    post: one(teamPosts, {
      fields: [teamPostReactions.postId],
      references: [teamPosts.id],
    }),
    user: one(users, {
      fields: [teamPostReactions.userId],
      references: [users.id],
    }),
  }),
);

/**
 * Community Layer — wspólna sesja treningowa (presence), bez osobnego workflow ćwiczeń.
 * Każdy uczestnik nadal ma własny active_workout; tu synchronizujemy status na żywo.
 */
export const groupWorkoutSessions = sqliteTable(
  "group_workout_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    hostUserId: text("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Trening grupowy"),
    /** live | ended */
    status: text("status").notNull().default("live"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("group_workout_sessions_team_status_idx").on(t.teamId, t.status),
    index("group_workout_sessions_host_idx").on(t.hostUserId, t.status),
  ],
);

export const groupWorkoutParticipants = sqliteTable(
  "group_workout_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => groupWorkoutSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** joined | left */
    status: text("status").notNull().default("joined"),
    /** JSON: exercise, set, reps, weight, elapsed, rest, progress, phase */
    presenceJson: text("presence_json").notNull().default("{}"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    leftAt: integer("left_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("group_workout_participants_session_user_uidx").on(
      t.sessionId,
      t.userId,
    ),
    index("group_workout_participants_session_status_idx").on(
      t.sessionId,
      t.status,
    ),
  ],
);

/**
 * Workout Chat — kanały Team / trening grupowy / challenge (Discord-level).
 * kind: team | workout | challenge
 */
export const chatChannels = sqliteTable(
  "chat_channels",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** team:{teamId} | workout:{sessionId} | challenge:{challengeId} */
    scopeKey: text("scope_key").notNull(),
    kind: text("kind").notNull(),
    teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
    groupSessionId: text("group_session_id").references(
      () => groupWorkoutSessions.id,
      { onDelete: "cascade" },
    ),
    /** Soft ref — Challenges mogą dojść później. */
    challengeId: text("challenge_id"),
    title: text("title").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("chat_channels_scope_uidx").on(t.scopeKey),
    index("chat_channels_kind_team_idx").on(t.kind, t.teamId),
    index("chat_channels_group_session_idx").on(t.groupSessionId),
    index("chat_channels_challenge_idx").on(t.challengeId),
  ],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    channelId: text("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    parentMessageId: text("parent_message_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("chat_messages_channel_created_idx").on(t.channelId, t.createdAt),
    index("chat_messages_channel_deleted_created_idx").on(
      t.channelId,
      t.deletedAt,
      t.createdAt,
    ),
    index("chat_messages_parent_idx").on(t.parentMessageId),
    index("chat_messages_author_idx").on(t.authorUserId),
  ],
);

export const chatMessageReactions = sqliteTable(
  "chat_message_reactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("chat_message_reactions_uidx").on(
      t.messageId,
      t.userId,
      t.emoji,
    ),
    index("chat_message_reactions_message_idx").on(t.messageId),
  ],
);

export const chatMentions = sqliteTable(
  "chat_mentions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    mentionedUserId: text("mentioned_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("chat_mentions_message_idx").on(t.messageId),
    index("chat_mentions_user_idx").on(t.mentionedUserId),
  ],
);

export const chatReadStates = sqliteTable(
  "chat_read_states",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    lastReadMessageId: text("last_read_message_id"),
    lastReadAt: integer("last_read_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("chat_read_states_uidx").on(t.userId, t.channelId),
    index("chat_read_states_channel_idx").on(t.channelId),
  ],
);

export const chatTyping = sqliteTable(
  "chat_typing",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("chat_typing_uidx").on(t.channelId, t.userId),
    index("chat_typing_updated_idx").on(t.channelId, t.updatedAt),
  ],
);

export const chatEvents = sqliteTable(
  "chat_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    channelId: text("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    /** message | reaction | typing | read */
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    actorUserId: text("actor_user_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("chat_events_channel_created_idx").on(t.channelId, t.createdAt)],
);

/**
 * Team / Global Challenges
 * scope: individual | group | seasonal | global
 * metric: sessions | distance_km | reps | sets | tonnage_kg | cardio_minutes
 */
export const challenges = sqliteTable(
  "challenges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scope: text("scope").notNull(),
    teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    emoji: text("emoji").notNull().default("🏆"),
    metricKind: text("metric_kind").notNull(),
    /** JSON: { exerciseKeywords?: string[] } */
    metricFilterJson: text("metric_filter_json").notNull().default("{}"),
    targetValue: integer("target_value").notNull(),
    unitLabel: text("unit_label").notNull().default(""),
    startsAt: integer("starts_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    rewardXp: integer("reward_xp").notNull().default(100),
    rewardBadgeKey: text("reward_badge_key"),
    rewardTitle: text("reward_title"),
    /** draft | active | completed | archived */
    status: text("status").notNull().default("active"),
    templateKey: text("template_key"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("challenges_team_status_idx").on(t.teamId, t.status),
    index("challenges_scope_status_idx").on(t.scope, t.status),
    index("challenges_ends_at_idx").on(t.endsAt),
    index("challenges_template_idx").on(t.templateKey),
  ],
);

export const challengeParticipants = sqliteTable(
  "challenge_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** active | completed | left */
    status: text("status").notNull().default("active"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("challenge_participants_uidx").on(t.challengeId, t.userId),
    index("challenge_participants_user_idx").on(t.userId, t.status),
  ],
);

export const challengeProgress = sqliteTable(
  "challenge_progress",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentValue: integer("current_value").notNull().default(0),
    lastWorkoutId: text("last_workout_id"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("challenge_progress_uidx").on(t.challengeId, t.userId),
    index("challenge_progress_challenge_idx").on(t.challengeId),
  ],
);

export const challengeRewardClaims = sqliteTable(
  "challenge_reward_claims",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    badgeKey: text("badge_key"),
    claimedAt: integer("claimed_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    celebrationSeenAt: integer("celebration_seen_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("challenge_reward_claims_uidx").on(t.challengeId, t.userId),
    index("challenge_reward_claims_user_idx").on(t.userId),
  ],
);

export const userCommunityXp = sqliteTable("user_community_xp", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  xpTotal: integer("xp_total").notNull().default(0),
  level: integer("level").notNull().default(1),
  /** 0 = brak, 1–5 = Prestige I–V */
  prestige: integer("prestige").notNull().default(0),
  prestigeXpLifetime: integer("prestige_xp_lifetime").notNull().default(0),
  titleKey: text("title_key"),
  frameKey: text("frame_key"),
  auraKey: text("aura_key"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Hall of Fame — okresy (tydzień / miesiąc / sezon / rok / all). */
export const hofSeasons = sqliteTable("hof_seasons", {
  key: text("key").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status").notNull().default("open"),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
});

export const hofAwards = sqliteTable(
  "hof_awards",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    seasonKey: text("season_key")
      .notNull()
      .references(() => hofSeasons.key, { onDelete: "cascade" }),
    category: text("category").notNull(),
    rank: integer("rank").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: real("score").notNull().default(0),
    scoreLabel: text("score_label").notNull().default(""),
    metaJson: text("meta_json").notNull().default("{}"),
    awardedAt: integer("awarded_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("hof_awards_season_cat_rank_uidx").on(
      t.seasonKey,
      t.category,
      t.rank,
    ),
    uniqueIndex("hof_awards_season_cat_user_uidx").on(
      t.seasonKey,
      t.category,
      t.userId,
    ),
    index("hof_awards_user_idx").on(t.userId),
  ],
);

/** Team Quests — wspólne misje zespołu. */
export const teamQuests = sqliteTable(
  "team_quests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    title: text("title").notNull(),
    emoji: text("emoji").notNull().default("🎯"),
    metricKind: text("metric_kind").notNull(),
    metricFilterJson: text("metric_filter_json").notNull().default("{}"),
    targetValue: real("target_value").notNull(),
    unitLabel: text("unit_label").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("active"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    rewardXpEach: integer("reward_xp_each").notNull().default(100),
    rewardBadgeKey: text("reward_badge_key").notNull(),
    rewardTitle: text("reward_title").notNull(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("team_quests_team_status_idx").on(t.teamId, t.status)],
);

export const teamQuestContributions = sqliteTable(
  "team_quest_contributions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    questId: text("quest_id")
      .notNull()
      .references(() => teamQuests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull().default(0),
    lastWorkoutId: text("last_workout_id"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("team_quest_contrib_quest_user_uidx").on(t.questId, t.userId),
  ],
);

export const teamQuestCompletions = sqliteTable(
  "team_quest_completions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    questId: text("quest_id")
      .notNull()
      .references(() => teamQuests.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    totalValue: real("total_value").notNull().default(0),
    participantsCount: integer("participants_count").notNull().default(0),
    metaJson: text("meta_json").notNull().default("{}"),
  },
  (t) => [
    uniqueIndex("team_quest_completions_quest_uidx").on(t.questId),
    index("team_quest_completions_team_idx").on(t.teamId, t.completedAt),
  ],
);

/** Team Wars — rywalizacja 1v1 na FCS. */
export const warSeasons = sqliteTable("war_seasons", {
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status").notNull().default("open"),
});

export const teamWarStats = sqliteTable("team_war_stats", {
  teamId: text("team_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  league: text("league").notNull().default("bronze"),
  lp: integer("lp").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  seasonKey: text("season_key").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const teamWarQueue = sqliteTable(
  "team_war_queue",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    league: text("league").notNull(),
    lp: integer("lp").notNull().default(0),
    queuedAt: integer("queued_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    status: text("status").notNull().default("queued"),
  },
  (t) => [
    uniqueIndex("team_war_queue_team_uidx").on(t.teamId),
    index("team_war_queue_league_status_idx").on(t.league, t.status, t.lp),
  ],
);

export const wars = sqliteTable(
  "wars",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    seasonKey: text("season_key").notNull(),
    teamAId: text("team_a_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    teamBId: text("team_b_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("live"),
    scoreA: real("score_a").notNull().default(0),
    scoreB: real("score_b").notNull().default(0),
    winnerTeamId: text("winner_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    summaryJson: text("summary_json").notNull().default("{}"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("wars_status_ends_idx").on(t.status, t.endsAt),
    index("wars_team_a_idx").on(t.teamAId, t.status),
    index("wars_team_b_idx").on(t.teamBId, t.status),
  ],
);

export const warScoreSnapshots = sqliteTable(
  "war_score_snapshots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    warId: text("war_id")
      .notNull()
      .references(() => wars.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    score: real("score").notNull().default(0),
    componentsJson: text("components_json").notNull().default("{}"),
  },
  (t) => [
    index("war_score_snapshots_war_team_idx").on(
      t.warId,
      t.teamId,
      t.capturedAt,
    ),
  ],
);

/** Progression multi-track XP. */
export const progressionXpLedger = sqliteTable(
  "progression_xp_ledger",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    track: text("track").notNull(),
    amount: integer("amount").notNull(),
    source: text("source").notNull(),
    sourceKey: text("source_key").notNull(),
    seasonKey: text("season_key"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("progression_xp_ledger_source_uidx").on(t.sourceKey),
    index("progression_xp_ledger_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const teamXp = sqliteTable("team_xp", {
  teamId: text("team_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  xpTotal: integer("xp_total").notNull().default(0),
  level: integer("level").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const communityXp = sqliteTable("community_xp", {
  id: text("id").primaryKey(),
  xpTotal: integer("xp_total").notNull().default(0),
  level: integer("level").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userSeasonXp = sqliteTable(
  "user_season_xp",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonKey: text("season_key").notNull(),
    xpTotal: integer("xp_total").notNull().default(0),
    level: integer("level").notNull().default(1),
    finalized: integer("finalized").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.seasonKey] })],
);

export const userCosmetics = sqliteTable(
  "user_cosmetics",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cosmeticKey: text("cosmetic_key").notNull(),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_cosmetics_user_key_uidx").on(t.userId, t.cosmeticKey),
  ],
);

export const userCosmeticLoadout = sqliteTable("user_cosmetic_loadout", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  frameKey: text("frame_key"),
  auraKey: text("aura_key"),
  titleKey: text("title_key"),
});

/** Social graph — profile, follows, activity feed. */
export const userSocialProfiles = sqliteTable("user_social_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  visibility: text("visibility").notNull().default("friends"),
  bio: text("bio"),
  showStats: integer("show_stats").notNull().default(1),
  showOnGlobal: integer("show_on_global").notNull().default(1),
  discoverable: integer("discoverable").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userFollows = sqliteTable(
  "user_follows",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_follows_pair_uidx").on(t.followerId, t.followingId),
    index("user_follows_following_idx").on(t.followingId),
  ],
);

export const userActivityPosts = sqliteTable(
  "user_activity_posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    metaJson: text("meta_json").notNull().default("{}"),
    visibilitySnapshot: text("visibility_snapshot").notNull().default("friends"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("user_activity_posts_user_created_idx").on(t.userId, t.createdAt),
    index("user_activity_posts_created_idx").on(t.createdAt),
    index("user_activity_posts_vis_created_idx").on(
      t.visibilitySnapshot,
      t.createdAt,
    ),
  ],
);

/**
 * Reputation Points (RP) — status społeczny Community (osobno od Challenge XP).
 * tier: bronze | silver | gold | platinum | diamond | legend
 */
export const userReputation = sqliteTable("user_reputation", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(0),
  tier: text("tier").notNull().default("bronze"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Ledger RP — idempotencja po source_key + anty-farm (cap dzienny w kodzie). */
export const userReputationEvents = sqliteTable(
  "user_reputation_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** help_reaction | help_comment | reply | comment | activity_post | live_join | challenge | achievement */
    kind: text("kind").notNull(),
    points: integer("points").notNull(),
    sourceKey: text("source_key").notNull(),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    metaJson: text("meta_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_reputation_events_source_uidx").on(t.sourceKey),
    index("user_reputation_events_user_created_idx").on(t.userId, t.createdAt),
    index("user_reputation_events_user_kind_created_idx").on(
      t.userId,
      t.kind,
      t.createdAt,
    ),
  ],
);

export const userBadges = sqliteTable(
  "user_badges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeKey: text("badge_key").notNull(),
    title: text("title").notNull(),
    emoji: text("emoji").notNull().default("🏅"),
    challengeId: text("challenge_id").references(() => challenges.id, {
      onDelete: "set null",
    }),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_badges_user_key_uidx").on(t.userId, t.badgeKey),
    index("user_badges_user_idx").on(t.userId),
  ],
);

/**
 * Community notification inbox
 * kind: comment | reaction | invite | achievement | challenge | live | ranking | hall_of_fame | team_announcement
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull().default(""),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    groupKey: text("group_key"),
    payloadJson: text("payload_json").notNull().default("{}"),
    collapsedCount: integer("collapsed_count").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    index("notifications_user_read_created_idx").on(
      t.userId,
      t.readAt,
      t.createdAt,
    ),
    index("notifications_user_kind_created_idx").on(
      t.userId,
      t.kind,
      t.createdAt,
    ),
    index("notifications_user_group_idx").on(t.userId, t.groupKey),
  ],
);

export const notificationEvents = sqliteTable(
  "notification_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** created | updated | read | deleted */
    kind: text("kind").notNull(),
    notificationId: text("notification_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("notification_events_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/**
 * Znajomości 1:1 — para kanoniczna user_a_id < user_b_id.
 * status: pending | accepted | blocked
 * Udostępnianie treningu: wzajemne (share_workout_a AND share_workout_b).
 */
export const friendships = sqliteTable(
  "friendships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userAId: text("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shareWorkoutA: integer("share_workout_a").notNull().default(0),
    shareWorkoutB: integer("share_workout_b").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("friendships_pair_uidx").on(t.userAId, t.userBId),
    index("friendships_user_a_status_idx").on(t.userAId, t.status),
    index("friendships_user_b_status_idx").on(t.userBId, t.status),
    index("friendships_requested_by_idx").on(t.requestedBy, t.status),
  ],
);

/** Sanitized presence do podglądu znajomych (bez payload_json sesji). */
export const friendLivePresence = sqliteTable(
  "friend_live_presence",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    presenceJson: text("presence_json").notNull().default("{}"),
    active: integer("active").notNull().default(0),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("friend_live_presence_active_updated_idx").on(t.active, t.updatedAt),
  ],
);


/** Web Push (przegladarka / PWA) - subskrypcje do przypomnien, gdy aplikacja jest zamknieta. */
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_uidx").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

/** Dedupe przypomnien: jeden wpis na uzytkownika / dzien kalendarza / rodzaj (workout, meal, checkin, email). */
export const reminderDispatches = sqliteTable(
  "reminder_dispatches",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateKey: text("date_key").notNull(),
    kind: text("kind").notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("reminder_dispatches_uidx").on(t.userId, t.dateKey, t.kind),
  ],
);