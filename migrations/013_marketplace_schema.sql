-- ============================================================
-- 013_marketplace_schema.sql
-- 24Therapy.ai — Therapist Marketplace, Reviews, Ratings,
--                Public Profiles, Search, Directory
-- ============================================================
-- The marketplace is the patient-facing therapist discovery layer.
-- Therapists list themselves. Patients search and book.
-- Platform earns commission on marketplace bookings.
-- ============================================================
-- Depends on: 001_core_schema.sql, 002_therapists_schema.sql,
--             003_patients_schema.sql, 006_sessions_schema.sql
-- ============================================================

-- ============================================================
-- MARKETPLACE LISTINGS
-- Public therapist profiles for the marketplace directory
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_listings (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id      UUID UNIQUE NOT NULL REFERENCES therapists(id),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    -- Profile content
    display_name      VARCHAR(255),     -- Could differ from legal name
    headline          VARCHAR(500),     -- Short pitch (e.g., "CBT specialist for anxiety & depression")
    about             TEXT,             -- Full bio
    approach          TEXT,             -- Therapeutic approach description
    education         TEXT,             -- Credentials and education
    -- Specializations & modalities
    specializations   TEXT[] DEFAULT '{}',
        -- anxiety, depression, trauma, adhd, ocd, relationships, addiction, grief, burnout
    treatment_approaches TEXT[] DEFAULT '{}',
        -- CBT, DBT, ACT, EMDR, psychodynamic, humanistic, mindfulness
    client_types      TEXT[] DEFAULT '{}',
        -- adults, adolescents, children, couples, families, groups
    languages         TEXT[] DEFAULT '{en}',
    -- Session options
    session_types     TEXT[] DEFAULT '{video}',
        -- video, audio, chat, in_person
    session_duration  INTEGER DEFAULT 50,
    hourly_rate       DECIMAL(10,2),
    currency          VARCHAR(10) DEFAULT 'USD',
    sliding_scale     BOOLEAN DEFAULT FALSE,
    sliding_scale_min DECIMAL(10,2),
    -- Availability
    accepting_patients BOOLEAN DEFAULT TRUE,
    new_patient_wait_days INTEGER DEFAULT 0,
    -- Ratings
    overall_rating    DECIMAL(3,2) DEFAULT 0.00,
    total_reviews     INTEGER DEFAULT 0,
    total_sessions    INTEGER DEFAULT 0,
    years_experience  INTEGER DEFAULT 0,
    -- Visibility
    is_published      BOOLEAN DEFAULT FALSE,
    is_featured       BOOLEAN DEFAULT FALSE,
    featured_until    TIMESTAMPTZ,
    -- SEO
    slug              VARCHAR(255) UNIQUE,    -- URL-friendly identifier
    meta_title        VARCHAR(255),
    meta_description  TEXT,
    -- Media
    profile_photo_url TEXT,
    intro_video_url   TEXT,
    -- Compliance
    verified_license  BOOLEAN DEFAULT FALSE,
    verified_at       TIMESTAMPTZ,
    -- Stats
    profile_views     INTEGER DEFAULT 0,
    booking_clicks    INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_published   ON marketplace_listings(is_published);
CREATE INDEX IF NOT EXISTS idx_marketplace_featured    ON marketplace_listings(is_featured, featured_until);
CREATE INDEX IF NOT EXISTS idx_marketplace_slug        ON marketplace_listings(slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_rating      ON marketplace_listings(overall_rating DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_specializations ON marketplace_listings USING gin(specializations);
CREATE INDEX IF NOT EXISTS idx_marketplace_languages   ON marketplace_listings USING gin(languages);

-- ============================================================
-- MARKETPLACE REVIEWS
-- Patient-submitted reviews after sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_reviews (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id        UUID NOT NULL REFERENCES marketplace_listings(id),
    therapist_id      UUID NOT NULL REFERENCES therapists(id),
    patient_id        UUID NOT NULL REFERENCES patients(id),
    session_id        UUID NOT NULL REFERENCES sessions(id),
    -- Rating dimensions
    overall_rating    INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    communication_rating   INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    expertise_rating       INTEGER CHECK (expertise_rating BETWEEN 1 AND 5),
    helpfulness_rating     INTEGER CHECK (helpfulness_rating BETWEEN 1 AND 5),
    -- Review content
    title             VARCHAR(255),
    review_text       TEXT,
    -- Metadata
    is_anonymous      BOOLEAN DEFAULT FALSE,
    is_verified       BOOLEAN DEFAULT TRUE,   -- Verified = came from actual session
    is_approved       BOOLEAN DEFAULT FALSE,  -- Admin approval required
    approved_at       TIMESTAMPTZ,
    is_flagged        BOOLEAN DEFAULT FALSE,
    flag_reason       TEXT,
    -- Response
    therapist_reply   TEXT,
    therapist_replied_at TIMESTAMPTZ,
    -- Helpful votes
    helpful_count     INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, session_id)  -- One review per session
);

CREATE INDEX IF NOT EXISTS idx_reviews_listing   ON marketplace_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_therapist ON marketplace_reviews(therapist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating    ON marketplace_reviews(overall_rating);
CREATE INDEX IF NOT EXISTS idx_reviews_approved  ON marketplace_reviews(is_approved, is_flagged);

-- ============================================================
-- REVIEW HELPFUL VOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS review_votes (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id  UUID NOT NULL REFERENCES marketplace_reviews(id),
    user_id    UUID NOT NULL REFERENCES users(id),
    helpful    BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, user_id)
);

-- ============================================================
-- MARKETPLACE SEARCH HISTORY
-- Track what patients search for (improves recommendations)
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_searches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),  -- NULL for anonymous
    search_query    TEXT,
    filters         JSONB,
        -- { "specializations": ["anxiety"], "language": "en", "max_price": 100 }
    results_count   INTEGER,
    clicked_listing UUID REFERENCES marketplace_listings(id),
    booked          BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MARKETPLACE BOOKMARKS
-- Patients can save therapists for later
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_bookmarks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id   UUID NOT NULL REFERENCES patients(id),
    listing_id   UUID NOT NULL REFERENCES marketplace_listings(id),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, listing_id)
);

-- ============================================================
-- MARKETPLACE CATEGORIES
-- Organized browsing by condition, approach, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type        VARCHAR(50) NOT NULL,  -- specialization, approach, client_type
    key         VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon        VARCHAR(100),
    display_order INTEGER DEFAULT 0,
    listing_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO marketplace_categories (type, key, display_name, description, display_order, is_featured) VALUES
('specialization', 'anxiety',           'Anxiety & Stress',           'Generalized anxiety, panic, social anxiety, phobias',          1,  TRUE),
('specialization', 'depression',        'Depression',                  'Major depression, dysthymia, mood disorders',                    2,  TRUE),
('specialization', 'trauma',            'Trauma & PTSD',               'PTSD, complex trauma, childhood trauma, abuse',                  3,  TRUE),
('specialization', 'relationships',     'Relationships & Couples',     'Couples therapy, communication, breakups, infidelity',           4,  TRUE),
('specialization', 'adhd',             'ADHD',                        'Attention deficit, hyperactivity, executive function',           5,  FALSE),
('specialization', 'grief',            'Grief & Loss',                'Bereavement, loss, complicated grief',                          6,  FALSE),
('specialization', 'ocd',              'OCD',                         'Obsessive-compulsive disorder, intrusive thoughts',             7,  FALSE),
('specialization', 'addiction',        'Addiction & Substance Use',   'Alcohol, drugs, behavioral addictions',                         8,  FALSE),
('specialization', 'burnout',          'Burnout & Work Stress',       'Professional burnout, career stress, work-life balance',        9,  FALSE),
('specialization', 'eating_disorders', 'Eating Disorders',            'Anorexia, bulimia, binge eating, body image',                   10, FALSE),
('approach',       'cbt',              'Cognitive Behavioral Therapy','CBT, thought patterns, behavioral change',                      1,  TRUE),
('approach',       'dbt',              'Dialectical Behavior Therapy','DBT, emotion regulation, distress tolerance',                   2,  FALSE),
('approach',       'emdr',             'EMDR',                        'Eye movement desensitization and reprocessing for trauma',      3,  FALSE),
('approach',       'mindfulness',      'Mindfulness-Based',           'Mindfulness, meditation, acceptance-based therapies',           4,  FALSE),
('client_type',    'adults',           'Adults',                      '18+ years of age',                                              1,  TRUE),
('client_type',    'adolescents',      'Adolescents',                 '13-17 years of age',                                            2,  FALSE),
('client_type',    'couples',          'Couples',                     'Relationship and couples therapy',                              3,  TRUE),
('client_type',    'families',         'Families',                    'Family systems therapy',                                        4,  FALSE)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- MARKETPLACE FEATURED SLOTS
-- Premium placement opportunities for therapists
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_featured_slots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id      UUID NOT NULL REFERENCES marketplace_listings(id),
    slot_type       VARCHAR(50) NOT NULL,
        -- homepage, category_top, search_top, sidebar
    category_key    VARCHAR(100),  -- For category-specific featuring
    priority        INTEGER DEFAULT 1,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    is_paid         BOOLEAN DEFAULT FALSE,
    amount_paid     DECIMAL(10,2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MARKETPLACE ANALYTICS
-- Track key conversion metrics
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_analytics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date            DATE NOT NULL,
    listing_id      UUID REFERENCES marketplace_listings(id),
    organization_id UUID REFERENCES organizations(id),
    profile_views   INTEGER DEFAULT 0,
    search_impressions INTEGER DEFAULT 0,
    booking_clicks  INTEGER DEFAULT 0,
    sessions_booked INTEGER DEFAULT 0,
    revenue_generated DECIMAL(10,2) DEFAULT 0,
    new_reviews     INTEGER DEFAULT 0,
    avg_review_score FLOAT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, listing_id)
);

-- ============================================================
-- TRIGGER: Update listing rating when review approved
-- ============================================================

CREATE OR REPLACE FUNCTION update_listing_rating()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_approved = TRUE AND OLD.is_approved = FALSE THEN
        UPDATE marketplace_listings
        SET
            overall_rating = (
                SELECT ROUND(AVG(overall_rating)::NUMERIC, 2)
                FROM marketplace_reviews
                WHERE listing_id = NEW.listing_id AND is_approved = TRUE AND is_flagged = FALSE
            ),
            total_reviews = (
                SELECT COUNT(*)
                FROM marketplace_reviews
                WHERE listing_id = NEW.listing_id AND is_approved = TRUE AND is_flagged = FALSE
            ),
            updated_at = NOW()
        WHERE id = NEW.listing_id;

        -- Also update therapist record
        UPDATE therapists
        SET rating = (
            SELECT ROUND(AVG(overall_rating)::NUMERIC, 2)
            FROM marketplace_reviews
            WHERE therapist_id = NEW.therapist_id AND is_approved = TRUE AND is_flagged = FALSE
        ),
        total_reviews = (
            SELECT COUNT(*)
            FROM marketplace_reviews
            WHERE therapist_id = NEW.therapist_id AND is_approved = TRUE AND is_flagged = FALSE
        ),
        updated_at = NOW()
        WHERE id = NEW.therapist_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_listing_rating
    AFTER UPDATE ON marketplace_reviews
    FOR EACH ROW EXECUTE FUNCTION update_listing_rating();

-- ============================================================
-- TRIGGER: Update listing view counts (from search/analytics)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_listing_views()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE marketplace_listings
    SET profile_views = profile_views + 1, updated_at = NOW()
    WHERE id = NEW.clicked_listing;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_listing_views
    AFTER INSERT ON marketplace_searches
    FOR EACH ROW WHEN (NEW.clicked_listing IS NOT NULL)
    EXECUTE FUNCTION increment_listing_views();

-- ============================================================
-- MARKETPLACE SEARCH FUNCTION (Full-text + filter)
-- ============================================================

CREATE OR REPLACE FUNCTION search_marketplace(
    p_specialization  VARCHAR DEFAULT NULL,
    p_language        VARCHAR DEFAULT NULL,
    p_max_price       DECIMAL DEFAULT NULL,
    p_session_type    VARCHAR DEFAULT NULL,
    p_client_type     VARCHAR DEFAULT NULL,
    p_limit           INTEGER DEFAULT 20,
    p_offset          INTEGER DEFAULT 0
) RETURNS TABLE (
    listing_id        UUID,
    display_name      VARCHAR,
    headline          VARCHAR,
    overall_rating    DECIMAL,
    total_reviews     INTEGER,
    hourly_rate       DECIMAL,
    currency          VARCHAR,
    languages         TEXT[],
    specializations   TEXT[],
    accepting_patients BOOLEAN,
    relevance_score   FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ml.id,
        ml.display_name,
        ml.headline,
        ml.overall_rating,
        ml.total_reviews,
        ml.hourly_rate,
        ml.currency,
        ml.languages,
        ml.specializations,
        ml.accepting_patients,
        (
            -- Relevance score calculation
            CASE WHEN p_specialization IS NOT NULL AND p_specialization = ANY(ml.specializations) THEN 0.4 ELSE 0 END +
            CASE WHEN p_language IS NOT NULL AND p_language = ANY(ml.languages) THEN 0.3 ELSE 0 END +
            (ml.overall_rating / 5.0 * 0.2) +
            (ml.is_featured::FLOAT * 0.1)
        ) AS relevance_score
    FROM marketplace_listings ml
    WHERE ml.is_published = TRUE
      AND ml.accepting_patients = TRUE
      AND (p_specialization IS NULL OR p_specialization = ANY(ml.specializations))
      AND (p_language IS NULL OR p_language = ANY(ml.languages))
      AND (p_max_price IS NULL OR ml.hourly_rate <= p_max_price OR ml.sliding_scale = TRUE)
      AND (p_session_type IS NULL OR p_session_type = ANY(ml.session_types))
      AND (p_client_type IS NULL OR p_client_type = ANY(ml.client_types))
    ORDER BY relevance_score DESC, ml.overall_rating DESC, ml.total_sessions DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Reviewed: 2026-06-13 — 24Therapy audit
