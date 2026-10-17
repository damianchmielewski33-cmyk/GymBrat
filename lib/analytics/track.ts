import {
  CommunityEvents,
  type CommunityEventName,
  type CommunityEventProps,
} from "@/lib/analytics/community-events";
import { posthogCapture } from "@/lib/analytics/posthog";

type TrackOpts = {
  distinctId: string;
  /** PostHog group analytics — zwykle team_id. */
  teamId?: string | null;
};

/**
 * Typed Community → PostHog. Bezpieczne fire-and-forget.
 */
export function trackCommunityEvent<E extends CommunityEventName>(
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

/** Alias wygodny przy importach z lib/community. */
export const track = {
  teamCreated: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.teamCreated],
  ) =>
    trackCommunityEvent(CommunityEvents.teamCreated, props, {
      distinctId,
      teamId: props.team_id,
    }),
  teamJoined: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.teamJoined],
  ) =>
    trackCommunityEvent(CommunityEvents.teamJoined, props, {
      distinctId,
      teamId: props.team_id,
    }),
  postPublished: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.postPublished],
  ) =>
    trackCommunityEvent(CommunityEvents.postPublished, props, {
      distinctId,
      teamId: props.team_id,
    }),
  postReacted: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.postReacted],
  ) =>
    trackCommunityEvent(CommunityEvents.postReacted, props, {
      distinctId,
      teamId: props.team_id,
    }),
  postCommented: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.postCommented],
  ) =>
    trackCommunityEvent(CommunityEvents.postCommented, props, {
      distinctId,
      teamId: props.team_id,
    }),
  challengeCreated: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.challengeCreated],
  ) =>
    trackCommunityEvent(CommunityEvents.challengeCreated, props, {
      distinctId,
      teamId: props.team_id,
    }),
  challengeJoined: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.challengeJoined],
  ) =>
    trackCommunityEvent(CommunityEvents.challengeJoined, props, {
      distinctId,
      teamId: props.team_id,
    }),
  challengeCompleted: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.challengeCompleted],
  ) =>
    trackCommunityEvent(CommunityEvents.challengeCompleted, props, {
      distinctId,
      teamId: props.team_id,
    }),
  liveStarted: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.liveStarted],
  ) =>
    trackCommunityEvent(CommunityEvents.liveStarted, props, {
      distinctId,
      teamId: props.team_id,
    }),
  liveJoined: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.liveJoined],
  ) =>
    trackCommunityEvent(CommunityEvents.liveJoined, props, {
      distinctId,
      teamId: props.team_id,
    }),
  liveEnded: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.liveEnded],
  ) =>
    trackCommunityEvent(CommunityEvents.liveEnded, props, {
      distinctId,
      teamId: props.team_id,
    }),
  rankingViewed: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.rankingViewed],
  ) =>
    trackCommunityEvent(CommunityEvents.rankingViewed, props, {
      distinctId,
      teamId: props.team_id,
    }),
  rankingLeaderChanged: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.rankingLeaderChanged],
  ) =>
    trackCommunityEvent(CommunityEvents.rankingLeaderChanged, props, {
      distinctId,
      teamId: props.team_id,
    }),
  hofViewed: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.hofViewed],
  ) =>
    trackCommunityEvent(CommunityEvents.hofViewed, props, {
      distinctId,
      teamId: props.team_id,
    }),
  hofAwarded: (
    distinctId: string,
    props: CommunityEventProps[typeof CommunityEvents.hofAwarded],
  ) =>
    trackCommunityEvent(CommunityEvents.hofAwarded, props, {
      distinctId,
      teamId: props.team_id,
    }),
};
