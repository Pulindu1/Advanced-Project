from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from flask_login import login_required, current_user
from ..models import db, Post

blog_bp = Blueprint('blog', __name__)


@blog_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('blog.dashboard'))
    return redirect(url_for('auth.login'))


@blog_bp.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    if request.method == 'POST' and request.form.get('action') == 'dismiss_onboarding':
        session['onboarded'] = True
        return redirect(url_for('blog.dashboard'))

    show_onboarding = not session.get('onboarded')
    posts = Post.query.filter_by(author_id=current_user.id).order_by(Post.created_at.desc()).all()
    all_published = Post.query.filter_by(published=True).order_by(Post.created_at.desc()).all()
    return render_template('dashboard.html', posts=posts, published=all_published, show_onboarding=show_onboarding)


@blog_bp.route('/editor')
@blog_bp.route('/editor/<int:post_id>')
@login_required
def editor(post_id=None):
    post = None
    if post_id:
        post = Post.query.get_or_404(post_id)
    return render_template('editor.html', post=post)


@blog_bp.route('/post/save', methods=['POST'])
@login_required
def save_post():
    post_id = request.form.get('post_id')
    title = request.form.get('title', '').strip()
    body = request.form.get('body', '')
    publish = request.form.get('publish') == 'on'

    if not title:
        flash('Title is required.', 'error')
        return redirect(url_for('blog.editor'))

    if post_id:
        post = Post.query.get_or_404(int(post_id))
        post.title = title
        post.body = body
        post.published = publish
    else:
        post = Post(title=title, body=body, author_id=current_user.id, published=publish)
        db.session.add(post)

    db.session.commit()
    flash('Post saved.', 'success')
    return redirect(url_for('blog.dashboard'))


@blog_bp.route('/post/<int:post_id>')
@login_required
def view_post(post_id):
    post = Post.query.get_or_404(post_id)
    return render_template('post.html', post=post)
