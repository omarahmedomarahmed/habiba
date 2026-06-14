-- ============================================================
-- 011_marketplace.sql
-- 24Therapy — Therapist Marketplace: Listings, Reviews,
--             Searches, Bookmarks, Categories, Featured Slots,
--             Analytics
-- ============================================================

-- ------------------------------------------------------------
-- marketplace_listings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id          UUID          NOT NULL REFERENCES therapists(id),
  organization_id       UUID          NOT NULL REFERENCES organizations(id),
  display_name          VARCHAR(255),
  headline              VARCHAR(500),
  about                 TEXT,
  approach              TEXT,
  education             TEXT,
  specializations       TEXT[]        NOT NULL DEFAULT '{}',
  treatment_approaches  TEXT[]        NOT NULL DEFAULT '{}',
  client_types          TEXT[]        NOT NULL DEFAULT '{}',
  languages             TEXT[]        NOT NULL DEFAULT '{en}',
  session_types         TEXT[]        NOT NULL DEFAULT '{video}',
  session_duration      INTEGER       NOT NULL DEFAULT 50,
  hourly_rate           NUMERIC(10,2),
  currency              VARCHAR(10)   NOT NULL DEFAULT 'USD',
  sliding_scale         BOOLEAN       NOT NULL DEFAULT FALSE,
  sliding_scale_min     NUMERIC(10,2),
  accepting_patients    BOOLEAN       NOT NULL DEFAULT TRUE,
  new_patient_wait_days INTEGER       NOT NULL DEFAULT 0,
  overall_rating        NUMERIC(3,2)  NOT NULL DEFAULT 0,
  total_reviews         INTEGER       NOT NULL DEFAULT 0,
  total_sessions        INTEGER       NOT NULL DEFAULT 0,
  years_experience      INTEGER       NOT NULL DEFAULT 0,
  is_published          BOOLEAN       NOT NULL DEFAULT FALSE,
  is_featured           BOOLEAN       NOT NULL DEFAULT FALSE,
  featured_until        TIMESTAMPTZ,
  slug                  VARCHAR(255),
  meta_title            VARCHAR(255),
  meta_description      TEXT,
  profile_photo_url     TEXT,
  intro_video_url       TEXT,
  verified_license      BOOLEAN       NOT NULL DEFAULT FALSE,
  verified_at           TIMESTAMPTZ,
  profile_views         INTEGER       NOT NULL DEFAULT 0,
  booking_clicks        INTEGER       NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_listings_therapist_id_unique UNIQUE (therapist_id),
  CONSTRAINT marketplace_listings_slug_unique         UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_is_published    ON marketplace_listings (is_published);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_featured        ON marketplace_listings (is_featured, featured_until);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_slug            ON marketplace_listings (slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_overall_rating  ON marketplace_listings (overall_rating DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_specializations ON marketplace_listings USING GIN (specializations);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_languages       ON marketplace_listings USING GIN (languages);

CREATE OR REPLACE TRIGGER trg_marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- marketplace_reviews
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id                   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id           UUID    NOT NULL REFERENCES marketplace_listings(id),
  therapist_id         UUID    NOT NULL REFERENCES therapists(id),
  patient_id           UUID    NOT NULL REFERENCES patients(id),
  session_id           UUID    NOT NULL REFERENCES sessions(id),
  overall_rating       INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  expertise_rating     INTEGER CHECK (expertise_rating BETWEEN 1 AND 5),
  helpfulness_rating   INTEGER CHECK (helpfulness_rating BETWEEN 1 AND 5),
  title                VARCHAR(255),
  review_text          TEXT,
  is_anonymous         BOOLEAN     NOT NULL DEFAULT FALSE,
  is_verified          BOOLEAN     NOT NULL DEFAULT TRUE,
  is_approved          BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_at          TIMESTAMPTZ,
  is_flagged           BOOLEAN     NOT NULL DEFAULT FALSE,
  flag_reason          TEXT,
  therapist_reply      TEXT,
  therapist_replied_at TIMESTAMPTZ,
  helpful_count        INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_reviews_patient_session_unique UNIQUE (patient_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_listing_id      ON marketplace_reviews (listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_therapist_id    ON marketplace_reviews (therapist_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_overall_rating  ON marketplace_reviews (overall_rating);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_approval_flag   ON marketplace_reviews (is_approved, is_flagged);

CREATE OR REPLACE TRIGGER trg_marketplace_reviews_updated_at
  BEFORE UPDATE ON marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- update_listing_rating()
-- Recalculates overall_rating and total_reviews on the listing
-- whenever an approved review is inserted or updated.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_listing_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_listings
  SET    overall_rating = (
           SELECT COALESCE(AVG(overall_rating::NUMERIC), 0)
           FROM   marketplace_reviews
           WHERE  listing_id = NEW.listing_id
             AND  is_approved = TRUE
             AND  is_flagged  = FALSE
         ),
         total_reviews  = (
           SELECT COUNT(*)
           FROM   marketplace_reviews
           WHERE  listing_id = NEW.listing_id
             AND  is_approved = TRUE
             AND  is_flagged  = FALSE
         ),
         updated_at = NOW()
  WHERE  id = NEW.listing_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_marketplace_reviews_update_rating
  AFTER INSERT OR UPDATE ON marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION update_listing_rating();

-- ------------------------------------------------------------
-- review_votes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_votes (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  UUID        NOT NULL REFERENCES marketplace_reviews(id),
  user_id    UUID        NOT NULL REFERENCES users(id),
  helpful    BOOLEAN     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_votes_unique UNIQUE (review_id, user_id)
);

-- ------------------------------------------------------------
-- marketplace_searches
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_searches (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        REFERENCES users(id),
  search_query    TEXT,
  filters         JSONB,
  results_count   INTEGER,
  clicked_listing UUID        REFERENCES marketplace_listings(id),
  booked          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- marketplace_bookmarks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_bookmarks (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID        NOT NULL REFERENCES patients(id),
  listing_id UUID        NOT NULL REFERENCES marketplace_listings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_bookmarks_unique UNIQUE (patient_id, listing_id)
);

-- ------------------------------------------------------------
-- marketplace_categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_categories (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          VARCHAR(50) NOT NULL,
  key           VARCHAR(100) NOT NULL,
  display_name  VARCHAR(255) NOT NULL,
  description   TEXT,
  icon          VARCHAR(100),
  display_order INTEGER      NOT NULL DEFAULT 0,
  listing_count INTEGER      NOT NULL DEFAULT 0,
  is_featured   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_categories_key_unique UNIQUE (key)
);

-- ------------------------------------------------------------
-- marketplace_featured_slots
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_featured_slots (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id   UUID          NOT NULL REFERENCES marketplace_listings(id),
  slot_type    VARCHAR(50)   NOT NULL,
  category_key VARCHAR(100),
  priority     INTEGER       NOT NULL DEFAULT 1,
  starts_at    TIMESTAMPTZ   NOT NULL,
  ends_at      TIMESTAMPTZ   NOT NULL,
  is_paid      BOOLEAN       NOT NULL DEFAULT FALSE,
  amount_paid  NUMERIC(10,2),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- marketplace_analytics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_analytics (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  date               DATE          NOT NULL,
  listing_id         UUID          REFERENCES marketplace_listings(id),
  organization_id    UUID          REFERENCES organizations(id),
  profile_views      INTEGER       NOT NULL DEFAULT 0,
  search_impressions INTEGER       NOT NULL DEFAULT 0,
  booking_clicks     INTEGER       NOT NULL DEFAULT 0,
  sessions_booked    INTEGER       NOT NULL DEFAULT 0,
  revenue_generated  NUMERIC(10,2) NOT NULL DEFAULT 0,
  new_reviews        INTEGER       NOT NULL DEFAULT 0,
  avg_review_score   FLOAT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_analytics_date_listing_unique UNIQUE (date, listing_id)
);

-- ------------------------------------------------------------
-- search_marketplace()
-- Basic full-text + filter search returning listing summaries.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_marketplace(
  p_query          TEXT    DEFAULT NULL,
  p_specializations TEXT[] DEFAULT NULL,
  p_languages      TEXT[]  DEFAULT NULL,
  p_limit          INT     DEFAULT 20,
  p_offset         INT     DEFAULT 0
)
RETURNS TABLE (
  listing_id      UUID,
  therapist_id    UUID,
  display_name    VARCHAR,
  headline        VARCHAR,
  specializations TEXT[],
  languages       TEXT[],
  overall_rating  NUMERIC,
  total_reviews   INTEGER,
  hourly_rate     NUMERIC,
  accepting_patients BOOLEAN,
  profile_photo_url  TEXT,
  slug            VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id,
    ml.therapist_id,
    ml.display_name,
    ml.headline,
    ml.specializations,
    ml.languages,
    ml.overall_rating,
    ml.total_reviews,
    ml.hourly_rate,
    ml.accepting_patients,
    ml.profile_photo_url,
    ml.slug
  FROM marketplace_listings ml
  WHERE ml.is_published = TRUE
    AND (
      p_query IS NULL
      OR ml.display_name   ILIKE '%' || p_query || '%'
      OR ml.headline       ILIKE '%' || p_query || '%'
      OR ml.about          ILIKE '%' || p_query || '%'
    )
    AND (
      p_specializations IS NULL
      OR ml.specializations && p_specializations
    )
    AND (
      p_languages IS NULL
      OR ml.languages && p_languages
    )
  ORDER BY
    ml.is_featured DESC,
    ml.overall_rating DESC,
    ml.total_reviews DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
