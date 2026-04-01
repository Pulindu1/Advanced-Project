import json
import os
import bcrypt
from .models import db, User, Post, Flag


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

        # Create admin user
        admin_hash = bcrypt.hashpw(b'NovaCMS_Adm1n!2024', bcrypt.gensalt()).decode('utf-8')
        admin = User(username='admin', password_hash=admin_hash, role='admin')
        db.session.add(admin)
        db.session.flush()

        # Create player users from credentials.json
        user_objects = {}
        for username, cred in creds_data.items():
            pw_hash = bcrypt.hashpw(cred['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user = User(username=username, password_hash=pw_hash, role=cred.get('role', 'editor'))
            db.session.add(user)
            user_objects[username] = user

        db.session.flush()

        # Store flags
        first_flag4 = None
        for username, user_flags in flags_data.items():
            for flag_key, flag_value in user_flags.items():
                flag = Flag(username=username, flag_key=flag_key, flag_value=flag_value)
                db.session.add(flag)
                if flag_key == 'flag4' and first_flag4 is None:
                    first_flag4 = flag_value

        # Write flag4 to /app/secret/flag.txt
        if first_flag4:
            secret_dir = os.path.join(app.root_path, '..', 'secret')
            os.makedirs(secret_dir, exist_ok=True)
            with open(os.path.join(secret_dir, 'flag.txt'), 'w') as f:
                f.write(first_flag4 + '\n')

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
