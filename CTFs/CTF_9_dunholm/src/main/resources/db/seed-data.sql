-- Staff seed. Passwords for helen/rachel/james/sophie are random bcrypt hashes
-- and are not used for login. amir.patel's plaintext lives in the boot log.
-- Player rows are inserted by DataSeedRunner at boot from data/users.json and data/flags.json.

INSERT INTO users (username, display_name, email, password_hash, role, active)
VALUES
    ('helen.cross', 'Dr. Helen Cross', 'helen.cross@dunholm.example', '$2a$10$unusedhashhelenxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'research_lead', TRUE),
    ('amir.patel', 'Amir Patel', 'amir.patel@dunholm.example', '$2a$10$unusedhashamirxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'cto_admin', TRUE),
    ('rachel.osei', 'Rachel Osei', 'rachel.osei@dunholm.example', '$2a$10$unusedhashrachelxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'security_lead', TRUE),
    ('james.whitfield', 'Dr. James Whitfield', 'james.whitfield@dunholm.example', '$2a$10$unusedhashjamesxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'clinical_lead', TRUE),
    ('sophie.chen', 'Sophie Chen', 'sophie.chen@dunholm.example', '$2a$10$unusedhashsophiexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'trial_coordinator', TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO trials (code, title, phase, status, summary, lead_investigator)
VALUES
    ('DR-2024-017', 'Neuroinflammation modulation in early-onset MS', 'Phase 2', 'enrolling', 'Open-label pilot extension of DR-2023-011 recruiting at two UK sites. Internal code: NIMMOD-2.', 'james.whitfield'),
    ('DR-2024-018', 'Cardiorenal safety of compound DRH-412', 'Phase 1b', 'analysis', 'Healthy-volunteer safety dose extension. Enrolment closed January 2024.', 'james.whitfield'),
    ('DR-2024-019', 'Oncology biomarker screen, solid tumour cohort', 'Phase 2', 'enrolling', 'Biomarker-led patient selection study, collaborator site in Newcastle.', 'helen.cross'),
    ('DR-2023-011', 'Neuroinflammation baseline survey', 'Phase 2', 'closed', 'Predecessor of DR-2024-017. Data frozen, embargoed until publication.', 'james.whitfield'),
    ('DR-2024-020', 'Respiratory endpoint registry', 'Phase 3', 'pre-launch', 'Phase 3 registry study. Protocol under sponsor review.', 'helen.cross')
ON CONFLICT (code) DO NOTHING;

INSERT INTO documents (filename, display_title, owner_username, classification, summary)
VALUES
    ('trial-summary-2024-q2.txt', 'Q2 2024 trial operations summary', 'james.whitfield', 'internal', 'Quarterly operations summary prepared for the clinical team.'),
    ('regulatory-draft-v3.txt', 'MHRA submission draft v3', 'helen.cross', 'internal', 'Draft regulatory submission covering DR-2024-017.'),
    ('board-minutes-2024-09.txt', 'Board minutes, September 2024', 'helen.cross', 'internal', 'Board-level discussion of the competitor disclosure incident.'),
    ('rachel-security-memo.txt', 'Security memo on archive handling', 'rachel.osei', 'internal', 'Rachel Osei''s standing memo on archive handling and SQL hygiene.'),
    ('staff-handbook.txt', 'Dunholm Research staff handbook extract', 'helen.cross', 'public', 'Director letter and staff bio section from the handbook.'),
    ('access-policy.txt', 'Information access policy, short form', 'rachel.osei', 'public', 'Short-form information access policy.'),
    ('welcome-note.txt', 'Welcome note to the Phase 2 cohort', 'sophie.chen', 'public', 'Draft welcome note authored by Sophie Chen.')
ON CONFLICT DO NOTHING;

INSERT INTO secrets (secret_key, secret_value, owner_username, description)
VALUES
    ('encryption_key_part2', 'SEED_PART2_PLACEHOLDER', NULL, 'Second half of the document AES key. Rotated with each encrypted release.')
ON CONFLICT DO NOTHING;
