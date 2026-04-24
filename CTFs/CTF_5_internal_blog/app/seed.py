import json
import os
import secrets
import bcrypt
from .models import db, User, Post, Flag


def write_flag4_files(app):
    """Write each player's Flag 4 to /app/secret/flag_<username>.txt.

    Runs on every startup so the file is present even when the DB volume
    already holds a seeded state (and seed_database early-returns).
    """
    flags_path = os.path.join(app.root_path, '..', 'flags.json')
    secret_dir = os.path.join(app.root_path, '..', 'secret')
    if not os.path.exists(flags_path):
        return
    with open(flags_path) as f:
        flags_data = json.load(f)
    os.makedirs(secret_dir, exist_ok=True)
    for username, user_flags in flags_data.items():
        if 'flag4' in user_flags:
            file_path = os.path.join(secret_dir, f'flag_{username}.txt')
            with open(file_path, 'w') as f:
                f.write(user_flags['flag4'] + '\n')


def seed_database(app):
    """Seed the database from flags.json and credentials.json."""
    with app.app_context():
        db.create_all()

        # Check if already seeded
        if User.query.first() is not None:
            return

        flags_path = os.path.join(app.root_path, '..', 'flags.json')
        creds_path = os.path.join(app.root_path, '..', 'credentials.json')

        # Load JSON files
        with open(flags_path) as f:
            flags_data = json.load(f)
        with open(creds_path) as f:
            creds_data = json.load(f)

        # Create users from credentials.json. Staff accounts ship with the
        # SYSTEM_INTERNAL sentinel password; we swap it for a process-local
        # random value before hashing so no one can actually log in as them.
        user_objects = {}
        for username, cred in creds_data.items():
            raw_password = cred['password']
            if raw_password == 'SYSTEM_INTERNAL':
                raw_password = secrets.token_urlsafe(32)
            pw_hash = bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user = User(username=username, password_hash=pw_hash, role=cred.get('role', 'editor'))
            db.session.add(user)
            user_objects[username] = user

        db.session.flush()
        admin = user_objects.get('admin')

        # Store flags
        for username, user_flags in flags_data.items():
            for flag_key, flag_value in user_flags.items():
                flag = Flag(username=username, flag_key=flag_key, flag_value=flag_value)
                db.session.add(flag)

        # Seed sample blog posts
        sample_posts = [
            {
                'title': 'Welcome to NovaCMS',
                'body': '<h2>Getting Started</h2><p>Welcome to the NovaCMS editorial platform. Use the editor to create and preview your posts before publishing.</p><p>Features:</p><ul><li>Rich text editing</li><li>Live preview with Jinja2 template support</li><li>Draft and publish workflow</li></ul>',
                'published': True,
            },
            {
                'title': 'Q1 2025 Product Roadmap',
                'body': '<h2>Upcoming Features</h2><p>We are planning the following improvements for Q1:</p><ul><li>Enhanced template library</li><li>Multi-author collaboration</li><li>Improved media management</li></ul><p>Stay tuned for updates.</p>',
                'published': True,
            },
            {
                'title': 'Internal: Security Audit Notes',
                'body': '<p>Audit flagged the preview endpoint for potential template injection. WAF v2 filter has been deployed to the /preview/v2 endpoint. See CHANGELOG for blocked keywords.</p><p>TODO: migrate all preview traffic to v2 before next release.</p><p><strong>Audit finding:</strong> Jinja2 sandbox does not restrict os.popen() or subprocess calls. Sensitive files under /app/secret/ must be protected at the OS level.</p>',
                'published': False,
            },
        ]

        for post_data in sample_posts:
            post = Post(
                title=post_data['title'],
                body=post_data['body'],
                author_id=admin.id,
                published=post_data['published'],
            )
            db.session.add(post)

        db.session.commit()
        print('[SEED] Database seeded successfully.')
