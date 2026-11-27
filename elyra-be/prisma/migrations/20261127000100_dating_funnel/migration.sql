ALTER TABLE feedbacks ADD COLUMN "formVersion" integer NOT NULL DEFAULT 1,
  ALTER COLUMN rating DROP NOT NULL, ALTER COLUMN comfort DROP NOT NULL,
  ALTER COLUMN enjoyment DROP NOT NULL, ALTER COLUMN "wouldMeetAgain" DROP NOT NULL;

-- Record first occurrence per member, pair, or proposal round in the writing transaction.
CREATE TABLE dating_events (
  kind text NOT NULL, entity text NOT NULL, version integer NOT NULL DEFAULT 0,
  occurred_at timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  PRIMARY KEY (kind, entity, version)
);
CREATE FUNCTION record_dating_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_kind text; event_entity text; event_version integer := 0;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'users' THEN
      IF NEW."liveVerifiedAt" IS NULL THEN RETURN NEW; END IF;
      event_kind := 'verified'; event_entity := NEW.id;
    WHEN 'matches' THEN
      IF TG_OP = 'INSERT' THEN event_kind := 'invited';
      ELSIF NEW.status = 'ACTIVE' THEN event_kind := 'accepted';
      ELSE RETURN NEW; END IF;
      event_entity := NEW.id;
    WHEN 'date_plans' THEN
      IF NEW.status = 'CONFIRMED' THEN event_kind := 'confirmed';
      ELSIF NEW.status = 'PROPOSED' THEN event_kind := 'proposed';
      ELSE RETURN NEW; END IF;
      event_entity := NEW."matchId"; event_version := NEW."proposalVersion";
    WHEN 'feedbacks' THEN
      event_kind := 'responded'; event_entity := NEW.id; event_version := NEW."planVersion";
  END CASE;
  INSERT INTO dating_events(kind,entity,version) VALUES(event_kind,event_entity,event_version)
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER dating_verified AFTER UPDATE OF "liveVerifiedAt" ON users FOR EACH ROW EXECUTE FUNCTION record_dating_event();
CREATE TRIGGER dating_invitation AFTER INSERT OR UPDATE OF status ON matches FOR EACH ROW EXECUTE FUNCTION record_dating_event();
CREATE TRIGGER dating_plan AFTER INSERT OR UPDATE OF status ON date_plans FOR EACH ROW EXECUTE FUNCTION record_dating_event();
CREATE TRIGGER dating_feedback AFTER INSERT OR UPDATE ON feedbacks FOR EACH ROW EXECUTE FUNCTION record_dating_event();

-- Keep existing verified members out of the prospective new-member cohort.
INSERT INTO dating_events(kind,entity,occurred_at)
SELECT 'previously_verified',id,"liveVerifiedAt" FROM users WHERE "liveVerifiedAt" IS NOT NULL;
