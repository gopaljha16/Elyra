-- Confirmation cohorts. Plans can be scheduled up to 30 days ahead.
-- Wait 37 days to give every round at least one week to receive answers.
-- The denominator includes later cancellations. Missing responses remain unknown.
WITH rounds AS (
  SELECT c.entity, c.version, date_trunc('week',c.occurred_at) AS week,
    count(f.id) AS responses, count(f.id) FILTER (WHERE f.attended) AS attended
  FROM dating_events c
  LEFT JOIN feedbacks f ON f."matchId"=c.entity AND f."planVersion"=c.version
    AND f."formVersion"=2
  WHERE c.kind='confirmed'
    AND date_trunc('week',c.occurred_at) + interval '44 days' <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  GROUP BY c.entity,c.version,date_trunc('week',c.occurred_at)
)
SELECT week, count(*) AS confirmed_rounds, count(*) FILTER(WHERE responses=2) AS both_responded,
  count(*) FILTER(WHERE attended=2) AS both_reported_attendance FROM rounds GROUP BY week ORDER BY week;

-- Compare invitations and proposal rounds with a consistent 14-day decision window.
SELECT date_trunc('week',start.occurred_at) AS week, start.kind,
  count(*) AS started, count(outcome.entity) AS accepted,
  count(outcome.entity)::numeric / count(*) AS acceptance_rate
FROM dating_events start
LEFT JOIN dating_events outcome ON outcome.entity=start.entity AND outcome.version=start.version
  AND outcome.kind=CASE start.kind WHEN 'invited' THEN 'accepted' ELSE 'confirmed' END
  AND outcome.occurred_at >= start.occurred_at
  AND outcome.occurred_at < start.occurred_at + interval '14 days'
WHERE start.kind IN ('invited','proposed')
  AND date_trunc('week',start.occurred_at) + interval '21 days' <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
GROUP BY 1,start.kind ORDER BY 1,start.kind;
