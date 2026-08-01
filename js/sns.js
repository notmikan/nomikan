/**
 * js/sns.js - サークルSNS (X/Twitter風 投稿・写真WebP自動圧縮・2KBアバターアイコン・いいね・リプライ)
 */

let currentPosts = [];
let firebaseDbPostsRef = null;
let firebaseStorageRef = null;
let currentPostTeamFilter = 'all';
let currentUser = { author: '', avatar: '', id: '' };
let pendingPostImages = []; // 送信待ち圧縮画像リスト (WebP Base64 DataURI)
let pendingAvatarImage = ''; // 設定中のアバター画像 (2KB WebP)

const defaultPosts = [];

// 端末ユニークIDの取得または自動生成
function getOrCreateUserId() {
  let uid = localStorage.getItem('hope_user_id');
  if (!uid) {
    uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    localStorage.setItem('hope_user_id', uid);
  }
  return uid;
}

// イニシャルアバター文字取得
function getAvatarInitial(name) {
  if (!name) return '👤';
  return name.trim().charAt(0).toUpperCase();
}

// ユーザープロフィールの初期ロード
function initPostsUser() {
  currentUser.id = getOrCreateUserId();
  const savedAuthor = localStorage.getItem('hope_user_author');
  const savedAvatar = localStorage.getItem('hope_user_avatar');

  if (savedAuthor) {
    currentUser.author = savedAuthor;
    currentUser.avatar = savedAvatar || '';
    updateUserProfileUI();
  } else {
    setTimeout(() => {
      openUserProfileModal(true);
    }, 150);
  }
}

// 画面フォーム上のユーザーアバター・名前表示更新
function updateUserProfileUI() {
  const nameEl = document.getElementById('currentLoginUserName');
  const avatarEl = document.getElementById('currentComposeAvatar');

  if (nameEl) nameEl.textContent = currentUser.author || '未設定';
  
  if (avatarEl) {
    if (currentUser.avatar) {
      avatarEl.style.backgroundImage = `url(${currentUser.avatar})`;
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = 'none';
      avatarEl.textContent = getAvatarInitial(currentUser.author);
    }
  }
}

// アバター要素HTMLの共通レンダリング関数
function renderAvatarHtml(author, avatarUrl, extraClass = '', teamTag = '雑談') {
  if (avatarUrl) {
    return `<div class="x-avatar ${extraClass}" style="background-image: url('${avatarUrl}');"></div>`;
  }
  return `<div class="x-avatar ${extraClass} x-avatar-${teamTag}">${getAvatarInitial(author)}</div>`;
}

// メンバー登録モーダルの開閉制御
function openUserProfileModal(isFirstTime = false) {
  const modal = document.getElementById('userProfileModal');
  const closeBtn = document.getElementById('closeProfileModal');
  const modalAuthorInput = document.getElementById('modalAuthorInput');
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');

  if (!modal) return;

  if (modalAuthorInput) modalAuthorInput.value = currentUser.author || '';
  pendingAvatarImage = currentUser.avatar || '';

  if (profileAvatarPreview) {
    if (pendingAvatarImage) {
      profileAvatarPreview.style.backgroundImage = `url('${pendingAvatarImage}')`;
      profileAvatarPreview.textContent = '';
    } else {
      profileAvatarPreview.style.backgroundImage = 'none';
      profileAvatarPreview.textContent = getAvatarInitial(currentUser.author);
    }
  }

  if (closeBtn) {
    closeBtn.style.display = isFirstTime ? 'none' : 'block';
  }
  modal.classList.add('active');
}

// X (Twitter) 風 投稿用ポップアップモーダルの開閉
function openPostComposeModal() {
  if (!currentUser.author) {
    openUserProfileModal(true);
    return;
  }
  const modal = document.getElementById('xPostComposeModal');
  if (modal) {
    updateUserProfileUI();
    pendingPostImages = [];
    renderImagePreviews();
    modal.classList.add('active');
    const input = document.getElementById('postContentInput');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

function closePostComposeModal() {
  const modal = document.getElementById('xPostComposeModal');
  if (modal) modal.classList.remove('active');
  pendingPostImages = [];
  renderImagePreviews();
}

// 📷 超軽量 WebP クライアント自動圧縮・リサイズ関数 (Canvas API)
function compressImageToWebP(file, maxSide = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const webpDataUri = canvas.toDataURL('image/webp', quality);
        resolve(webpDataUri);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// 👤 アバター用 80x80 超超軽量WebP圧縮関数 (たった2KB)
function compressAvatarToWebP(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const side = 80;
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext('2d');

        let srcX = 0, srcY = 0, srcSide = Math.min(img.width, img.height);
        if (img.width > img.height) {
          srcX = Math.round((img.width - img.height) / 2);
        } else {
          srcY = Math.round((img.height - img.width) / 2);
        }

        ctx.drawImage(img, srcX, srcY, srcSide, srcSide, 0, 0, side, side);
        const webpUri = canvas.toDataURL('image/webp', 0.75);
        resolve(webpUri);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// プレビューサムネイル描画
function renderImagePreviews() {
  const bar = document.getElementById('imagePreviewBar');
  if (!bar) return;

  if (pendingPostImages.length === 0) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = pendingPostImages.map((imgUri, idx) => `
    <div class="x-image-thumb-wrap">
      <img src="${imgUri}" class="x-image-thumb">
      <button type="button" class="x-image-remove-btn" onclick="removePendingImage(${idx})">✕</button>
    </div>
  `).join('');
}

window.removePendingImage = function(idx) {
  pendingPostImages.splice(idx, 1);
  renderImagePreviews();
};

// イベントリスナーの登録
document.addEventListener('DOMContentLoaded', () => {
  setupSnsEventListeners();
});

setupSnsEventListeners();

function setupSnsEventListeners() {
  const fabBtn = document.getElementById('openComposeFabBtn');
  const closeComposeBtn = document.getElementById('closeComposeModalBtn');
  const changeBtn = document.getElementById('changeProfileBtn');
  const closeBtn = document.getElementById('closeProfileModal');
  const profileForm = document.getElementById('userProfileForm');
  const createPostForm = document.getElementById('createPostForm');
  const postImageInput = document.getElementById('postImageInput');
  const modalAvatarInput = document.getElementById('modalAvatarInput');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');

  if (fabBtn && !fabBtn.dataset.bound) {
    fabBtn.dataset.bound = "true";
    fabBtn.addEventListener('click', openPostComposeModal);
  }

  if (closeComposeBtn && !closeComposeBtn.dataset.bound) {
    closeComposeBtn.dataset.bound = "true";
    closeComposeBtn.addEventListener('click', closePostComposeModal);
  }

  if (changeBtn && !changeBtn.dataset.bound) {
    changeBtn.dataset.bound = "true";
    changeBtn.addEventListener('click', () => {
      closePostComposeModal();
      openUserProfileModal(false);
    });
  }

  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = "true";
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('userProfileModal');
      if (currentUser.author && modal) modal.classList.remove('active');
    });
  }

  if (closeLightboxBtn && !closeLightboxBtn.dataset.bound) {
    closeLightboxBtn.dataset.bound = "true";
    closeLightboxBtn.addEventListener('click', () => {
      const lightbox = document.getElementById('imageLightboxModal');
      if (lightbox) lightbox.classList.remove('active');
    });
  }

  // 👤 アバター画像選択ハンドラ (自動2KB WebP圧縮)
  if (modalAvatarInput && !modalAvatarInput.dataset.bound) {
    modalAvatarInput.dataset.bound = "true";
    modalAvatarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        pendingAvatarImage = await compressAvatarToWebP(file);
        const preview = document.getElementById('profileAvatarPreview');
        if (preview) {
          preview.style.backgroundImage = `url('${pendingAvatarImage}')`;
          preview.textContent = '';
        }
      } catch (err) {
        console.error("Avatar compression error:", err);
      }
    });
  }

  // 📷 写真選択ハンドラ (自動WebP圧縮)
  if (postImageInput && !postImageInput.dataset.bound) {
    postImageInput.dataset.bound = "true";
    postImageInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;

      for (const file of files) {
        try {
          const compressedWebP = await compressImageToWebP(file);
          pendingPostImages.push(compressedWebP);
        } catch (err) {
          console.error("Image compression error:", err);
        }
      }
      renderImagePreviews();
      e.target.value = '';
    });
  }

  // プロフィール設定フォーム送信ハンドラ
  if (profileForm && !profileForm.dataset.bound) {
    profileForm.dataset.bound = "true";
    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const authorInput = document.getElementById('modalAuthorInput');
      const author = authorInput ? authorInput.value.trim() : '';

      if (!author) {
        alert('表示名を入力してください');
        return;
      }

      currentUser.author = author;
      currentUser.avatar = pendingAvatarImage || '';
      localStorage.setItem('hope_user_author', author);
      localStorage.setItem('hope_user_avatar', currentUser.avatar);

      updateUserProfileUI();

      const modal = document.getElementById('userProfileModal');
      if (modal) modal.classList.remove('active');
    });
  }

  // モーダル投稿フォーム送信ハンドラ
  if (createPostForm && !createPostForm.dataset.bound) {
    createPostForm.dataset.bound = "true";
    createPostForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const contentInput = document.getElementById('postContentInput');
      const categorySelect = document.getElementById('postCategorySelect');
      
      const content = contentInput ? contentInput.value.trim() : '';
      const selectedCategory = categorySelect ? categorySelect.value : '雑談';

      if (!content && pendingPostImages.length === 0) return;

      if (!currentUser.author) {
        openUserProfileModal(true);
        return;
      }

      const newPost = {
        id: 'post_' + Date.now(),
        author: currentUser.author,
        authorAvatar: currentUser.avatar || '',
        team: selectedCategory,
        userId: currentUser.id,
        content: content,
        images: [...pendingPostImages],
        createdAt: Date.now(),
        likedBy: [],
        replies: []
      };

      savePosts([newPost, ...currentPosts]);
      if (contentInput) contentInput.value = '';
      closePostComposeModal();
    });
  }

  // タイムラインタブ切り替えバインド
  document.querySelectorAll('.x-tab-item').forEach(btn => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = "true";
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.x-tab-item').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentPostTeamFilter = e.currentTarget.dataset.postTeam;
        renderPostsTimeline();
      });
    }
  });
}

// データベース同期初期化
function initPostsDatabase() {
  initPostsUser();

  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
    try {
      firebaseDbPostsRef = firebase.database().ref('hope_webapp_posts');
      firebaseDbPostsRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          const list = Array.isArray(val) ? val : Object.values(val);
          currentPosts = list.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
        } else {
          currentPosts = [...defaultPosts];
          savePostsToDb(currentPosts);
        }
        renderPostsTimeline();
      }, (err) => {
        console.warn("Firebase posts error:", err);
        loadPostsFromLocal();
      });
      return;
    } catch (e) {
      console.error("Firebase posts init error:", e);
    }
  }
  loadPostsFromLocal();
}

function loadPostsFromLocal() {
  try {
    const local = localStorage.getItem('hope_webapp_posts_v10');
    if (local) {
      currentPosts = JSON.parse(local).sort((a, b) => b.createdAt - a.createdAt);
    } else {
      currentPosts = [...defaultPosts];
    }
  } catch (e) {
    currentPosts = [...defaultPosts];
  }
  renderPostsTimeline();
}

function savePosts(newPosts) {
  currentPosts = newPosts.sort((a, b) => b.createdAt - a.createdAt);
  localStorage.setItem('hope_webapp_posts_v10', JSON.stringify(currentPosts));
  renderPostsTimeline();

  if (firebaseDbPostsRef) {
    savePostsToDb(currentPosts);
  }
}

function savePostsToDb(postsToSave) {
  if (firebaseDbPostsRef) {
    firebaseDbPostsRef.set(postsToSave).catch(err => {
      console.error("Posts DB write error:", err);
    });
  }
}

// 相対日時の計算フォーマット
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'たった今';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間`;
  if (diffSec < 172800) return '昨日';
  
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 拡大鑑賞モーダル
window.openImageLightbox = function(src) {
  const lightbox = document.getElementById('imageLightboxModal');
  const img = document.getElementById('lightboxImage');
  if (lightbox && img) {
    img.src = src;
    lightbox.classList.add('active');
  }
};

// X (Twitter) 風 タイムライン描画
function renderPostsTimeline() {
  const grid = document.getElementById('postsTimelineGrid');
  if (!grid) return;

  const filtered = currentPosts.filter(p => {
    return currentPostTeamFilter === 'all' || p.team === currentPostTeamFilter;
  });

  if (filtered.length === 0) {
    const filterName = currentPostTeamFilter === 'all' ? '' : `#${currentPostTeamFilter} の`;
    grid.innerHTML = `<div class="empty-state">まだ${filterName}投稿はありません。<br>右下のボタンから最初の投稿をしてみましょう。</div>`;
    return;
  }

  const html = filtered.map(post => {
    const likedByList = post.likedBy || [];
    const isLiked = likedByList.includes(currentUser.id);
    const likeCount = likedByList.length;

    const repliesList = post.replies || [];
    const replyCount = repliesList.length;

    const imagesList = post.images || [];
    let imagesHtml = '';

    if (imagesList.length > 0) {
      const gridClass = imagesList.length === 1 ? 'single' : 'multi';
      const imgs = imagesList.map(imgUri => `
        <img src="${imgUri}" class="post-media-img" onclick="openImageLightbox('${imgUri}')" alt="投稿画像" loading="lazy">
      `).join('');
      imagesHtml = `<div class="post-media-grid ${gridClass}">${imgs}</div>`;
    }

    // リプライ一覧HTML生成
    const repliesHtml = repliesList.map(rep => `
      <div class="x-reply-item">
        ${renderAvatarHtml(rep.author, rep.authorAvatar, 'x-avatar-sm', '雑談')}
        <div class="x-reply-main">
          <div class="x-reply-header">
            <span class="x-reply-author">${escapeHtml(rep.author)}</span>
            <span class="x-reply-time">${formatTimeAgo(rep.createdAt)}</span>
          </div>
          <div class="x-reply-content">${escapeHtml(rep.content)}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="x-post-item">
        ${renderAvatarHtml(post.author, post.authorAvatar, '', post.team || '雑談')}
        <div class="x-post-main">
          <div class="x-post-header">
            <div class="x-post-author-row">
              <span class="x-post-author-name">${escapeHtml(post.author)}</span>
              <span class="x-post-tag">#${post.team || '雑談'}</span>
              <span class="x-post-dot">·</span>
              <span class="x-post-time">${formatTimeAgo(post.createdAt)}</span>
            </div>
            <button class="x-post-delete" onclick="deletePostById('${post.id}')" title="削除">✕</button>
          </div>
          ${post.content ? `<div class="x-post-content">${escapeHtml(post.content)}</div>` : ''}

          <!-- 📷 写真画像添付エリア -->
          ${imagesHtml}

          <!-- ❤️ いいね ＆ 💬 リプライ アクションバー -->
          <div class="x-post-actions-row">
            <button class="x-action-btn" onclick="toggleReplyBox('${post.id}')">
              <span class="action-icon">💬</span>
              <span>${replyCount > 0 ? replyCount : '返信'}</span>
            </button>
            <button class="x-action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLikePost('${post.id}')">
              <span class="action-icon">${isLiked ? '❤️' : '🤍'}</span>
              <span>${likeCount > 0 ? likeCount : 'いいね'}</span>
            </button>
          </div>

          <!-- 返信入力フォーム -->
          <div class="x-reply-input-box" id="replyBox_${post.id}">
            <input type="text" id="replyInput_${post.id}" class="x-reply-input" placeholder="返信を投稿..." onkeypress="if(event.key==='Enter') submitReplyPost('${post.id}')">
            <button class="btn-reply-send" onclick="submitReplyPost('${post.id}')">返信</button>
          </div>

          <!-- 返信スレッド一覧 -->
          ${repliesList.length > 0 ? `<div class="x-replies-container">${repliesHtml}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = html;
}

// ❤️ いいね トグル処理
window.toggleLikePost = function(postId) {
  if (!currentUser.author) {
    openUserProfileModal(true);
    return;
  }

  const postIndex = currentPosts.findIndex(p => p.id === postId);
  if (postIndex < 0) return;

  const post = currentPosts[postIndex];
  let likedBy = post.likedBy || [];

  if (likedBy.includes(currentUser.id)) {
    likedBy = likedBy.filter(uid => uid !== currentUser.id);
  } else {
    likedBy.push(currentUser.id);
  }

  currentPosts[postIndex] = { ...post, likedBy };
  savePosts(currentPosts);
};

// 💬 返信フォーム トグル処理
window.toggleReplyBox = function(postId) {
  const box = document.getElementById(`replyBox_${postId}`);
  if (box) {
    box.classList.toggle('active');
    if (box.classList.contains('active')) {
      const input = document.getElementById(`replyInput_${postId}`);
      if (input) input.focus();
    }
  }
};

// 💬 返信送信処理
window.submitReplyPost = function(postId) {
  const input = document.getElementById(`replyInput_${postId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  if (!currentUser.author) {
    openUserProfileModal(true);
    return;
  }

  const postIndex = currentPosts.findIndex(p => p.id === postId);
  if (postIndex < 0) return;

  const post = currentPosts[postIndex];
  const replies = post.replies || [];

  const newReply = {
    id: 'reply_' + Date.now(),
    author: currentUser.author,
    authorAvatar: currentUser.avatar || '',
    userId: currentUser.id,
    content: content,
    createdAt: Date.now()
  };

  replies.push(newReply);
  currentPosts[postIndex] = { ...post, replies };
  savePosts(currentPosts);
  input.value = '';
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '<br>');
}

// 投稿削除関数
window.deletePostById = function(postId) {
  if (confirm('この投稿を削除してもよろしいですか？')) {
    const newPosts = currentPosts.filter(p => p.id !== postId);
    savePosts(newPosts);
  }
};
