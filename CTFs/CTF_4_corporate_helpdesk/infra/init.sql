-- Initialize database schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    flag VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS kb_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    tags TEXT[],
    author_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'visited', 'error')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    visited_at TIMESTAMP
);

-- Exfiltration logs (for collecting stolen data)
CREATE TABLE IF NOT EXISTS exfil_logs (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_agent TEXT,
    ip_address VARCHAR(50),
    report_id INTEGER REFERENCES reports(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tags ON kb_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Insert admin user (password: admin_secure_password_123)
INSERT INTO users (username, password_hash, role, flag) 
VALUES (
    'admin',
    '$2b$10$YourHashedPasswordHere',
    'admin',
    'CTF{admin_default_flag}'
) ON CONFLICT (username) DO NOTHING;

-- Insert sample KB articles
INSERT INTO kb_articles (title, body, tags, author_id) VALUES
    (
        'Password Reset Procedure',
        'To reset your password, navigate to the IT Portal and click "Forgot Password". Follow the on-screen instructions. For additional help, contact IT Support at extension 5555.',
        ARRAY['onboarding', 'security', 'authentication'],
        1
    ),
    (
        'VPN Setup Guide',
        'Download the corporate VPN client from the IT Portal. Install and configure using your employee ID and initial password provided during onboarding. For troubleshooting, see KB article #5.',
        ARRAY['onboarding', 'network', 'remote-access'],
        1
    ),
    (
        'Expense Report Submission',
        'Submit expense reports through the Finance Portal. Attach all receipts as PDF files. Manager approval is required for amounts exceeding $500.',
        ARRAY['finance', 'procedures'],
        1
    ),
    (
        'Meeting Room Booking System',
        'Book meeting rooms via the Calendar system. Rooms can be reserved up to 30 days in advance. Cancel bookings you won''t use to free up space for others.',
        ARRAY['facilities', 'procedures'],
        1
    ),
    (
        'IT Security Best Practices',
        'Never share passwords. Use strong, unique passwords for each system. Report suspicious emails to security@intradesk.local. Enable 2FA wherever possible.',
        ARRAY['security', 'best-practices'],
        1
    ),
    (
        'New Employee Onboarding Checklist',
        'Complete the following within your first week: Set up email, Complete security training, Set up VPN access, Review company handbook, Schedule 1:1 with manager.',
        ARRAY['onboarding', 'hr'],
        1
    ),
    (
        'Software License Requests',
        'Request software licenses through the IT Portal. Include business justification and cost center code. Approval typically takes 3-5 business days.',
        ARRAY['it', 'procedures'],
        1
    ),
    (
        'Remote Work Policy',
        'Employees may work remotely up to 3 days per week with manager approval. Maintain core hours 10am-3pm in your timezone. Use VPN for all company system access.',
        ARRAY['hr', 'remote-work', 'policies'],
        1
    )
ON CONFLICT DO NOTHING;
