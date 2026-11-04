import {
  CommunityEvents,
  type CommunityEventName,
  type CommunityEventProps,
} from "@/lib/analytics/community-events";
import { posthogCapture } from "@/lib/analytics/posthog";
import { canUseAnalytics } from "@/lib/consent-preferences";

type TrackOpts = {
  distinctId: string;
  /** PostHog group analytics — zwykle team_id. */
  teamId?: string | null;
};

/**
 * Surowa wysyłka do PostHog — BEZ sprawdzania zgody. Wołać wyłącznie po sprawdzeniu zgody:
 * w przeglądarce przez `trackCommunityEvent`, na serwerze przez `track-server.ts` (zgoda z bazy).
 */
export function emitCommunityEvent<E extends CommunityEventName>(
  event: E,
  properties: CommunityEventProps[E],
  opts: TrackOpts,
): void {
  if (!opts.distinctId) return;

  const teamId =
    opts.teamId ??
    ("team_id" in properties
      ? ((properties as { team_id?: string | null }).team_id ?? null)
      : null);

  void posthogCapture({
    event,
    distinctId: opts.distinctId,
    properties: {
      analytics_schema: 1,
      surface: "community",
      ...properties,
    },
    groups: teamId ? { team: teamId } : undefined,
  });
}

/**
 * Typed Community → PostHog (przeglądarka). Tylko po zgodzie na analitykę (Z12);
 * na serwerze nic nie wysyła — serwer używa `@/lib/analytics/track-server`.
 */
export function trackCommunityEvent<E extends CommunityEventName>(
  event: E,
  properties: CommunityEventProps[E],
  opts: TrackOpts,
): void {
  if (typeof window === "undefined") return;
  if (!canUseAnalytics()) return;
  emitCommunityEvent(event, properties, opts);
}

type TrackEmit = typeof trackCommunityEvent;

/** Fabryka aliasów `track.*` nad wybranym nadawcą (przeglądarka lub serwer ze zgodą). */
export function createTrack(emit: TrackEmit) {
  return {
  teamCreated: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.teamCreated],
  ) =>
    emit(CommunityEvents.teamCreated, props, {
      distinctId,
      teamId: props.team_id,
    }),
  teamJoined: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.teamJoined],
  ) =>
    emit(CommunityEvents.teamJoined, props, {
      distinctId,
      teamId: props.team_id,
    }),
  postPublished: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.postPublished],
  ) =>
    emit(CommunityEvents.postPublished, props, {
      distinctId,
      teamId: props.team_id,
    }),
  postReacted: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.postReacted],
  ) =>
    emit(CommunityEvents.postReacted, props, {
      distinctId,
      teamId: props.team_id,
    }),
  postCommented: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.postCommented],
  ) =>
    emit(CommunityEvents.postCommented, props, {
      distinctId,
      teamId: props.team_id,
    }),
  challengeCreated: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.challengeCreated],
  ) =>
    emit(CommunityEvents.challengeCreated, props, {
      distinctId,
      teamId: props.team_id,
    }),
  challengeJoined: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.challengeJoined],
  ) =>
    emit(CommunityEvents.challengeJoined, props, {
      distinctId,
      teamId: props.team_id,
    }),
  challengeCompleted: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.challengeCompleted],
  ) =>
    emit(CommunityEvents.challengeCompleted, props, {
      distinctId,
      teamId: props.team_id,
    }),
  liveStarted: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.liveStarted],
  ) =>
    emit(CommunityEvents.liveStarted, props, {
      distinctId,
      teamId: props.team_id,
    }),
  liveJoined: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.liveJoined],
  ) =>
    emit(CommunityEvents.liveJoined, props, {
      distinctId,
      teamId: props.team_id,
    }),
  liveEnded: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.liveEnded],
  ) =>
    emit(CommunityEvents.liveEnded, props, {
      distinctId,
      teamId: props.team_id,
    }),
  rankingViewed: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.rankingViewed],
  ) =>
    emit(CommunityEvents.rankingViewed, props, {
      distinctId,
      teamId: props.team_id,
    }),
  rankingLeaderChanged: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.rankingLeaderChanged],
  ) =>
    emit(CommunityEvents.rankingLeaderChanged, props, {
      distinctId,
      teamId: props.team_id,
    }),
  hofViewed: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.hofViewed],
  ) =>
    emit(CommunityEvents.hofViewed, props, {
      distinctId,
      teamId: props.team_id,
    }),
  hofAwarded: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.hofAwarded],
  ) =>
    emit(CommunityEvents.hofAwarded, props, {
      distinctId,
      teamId: props.team_id,
    }),
};
}

/** Alias wygodny w komponentach klienckich (z bramką zgody w przeglądarce). */
export const track = createTrack(trackCommunityEvent);
