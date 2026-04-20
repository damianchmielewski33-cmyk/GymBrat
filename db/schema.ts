import { relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  activityLevel: text("activity_level"),
  /** Konto zawodnika lub trenera — administrator to zawsze pierwszy zarejestrowany użytkownik. */
  appRole: text("app_role").notNull().default("zawodnik"),
  fitatuAccessToken: text("fitatu_access_token"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

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

export const workouts = sqliteTable("workouts", {
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
});

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

/** Wpisy posiłków dodane ręcznie na stronie Start — źródło spożycia makro. */
export const mealLogs = sqliteTable(
  "meal_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD — dzień kalendarzowy jak w treningach / Fitatu */
    date: text("date").notNull(),
    name: text("name"),
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

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weeklyCardioGoalMinutes: integer("weekly_cardio_goal_minutes")
    .notNull()
    .default(150),
  /** JSON: { calories, proteinG, fatG, carbsG } — cele na dzień treningowy */
  trainingNutritionGoalsJson: text("training_nutrition_goals_json"),
  /** JSON: { calories, proteinG, fatG, carbsG } — cele na dzień nietreningowy */
  restNutritionGoalsJson: text("rest_nutrition_goals_json"),
  /** JSON: Record<YYYY-MM-DD, "training" | "rest"> — brak wpisu = dzień nietreningowy */
  nutritionDayTypesJson: text("nutrition_day_types_json"),
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
