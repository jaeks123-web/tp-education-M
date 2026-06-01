/**
 * tp-firebase.js — 대주 이전가격 교육 플랫폼
 * Firebase Authentication + Firestore 공유 유틸리티
 * 모든 HTML 페이지에서 로드됩니다.
 */

const _firebaseConfig = {
  apiKey: "AIzaSyCmSW9hbSCtM0OGMC3z57OpKnTf5004aRo",
  authDomain: "daejoo-tp-education.firebaseapp.com",
  projectId: "daejoo-tp-education",
  storageBucket: "daejoo-tp-education.firebasestorage.app",
  messagingSenderId: "824400244520",
  appId: "1:824400244520:web:037e5e2fe7f609b9c92a1d"
};

// Firebase 초기화 (중복 방지)
if (!firebase.apps.length) {
  firebase.initializeApp(_firebaseConfig);
}

const _auth = firebase.auth();
const _db   = firebase.firestore();

let _uid       = null;   // 현재 로그인한 사용자 UID
let _cache     = {};     // Firestore에서 불러온 진도 데이터 캐시
let _ready     = false;  // 인증 및 데이터 로드 완료 여부
let _callbacks = [];     // tpOnReady에 등록된 콜백 목록

// ─── 인증 상태 감지 ───────────────────────────────────────────
_auth.onAuthStateChanged(async function(user) {
  var isLoginPage = window.location.pathname.indexOf('login.html') !== -1;

  if (!user) {
    // 로그인 안 됨 → 로그인 페이지로 이동 (login.html은 제외)
    if (!isLoginPage) {
      window.location.replace('login.html');
    }
    return;
  }

  // ─── 승인 여부 확인 (allowedUsers 컬렉션) ────────────────────
  try {
    var allowedSnap = await _db.collection('allowedUsers').doc(user.email).get();
    if (!allowedSnap.exists) {
      // 미승인 사용자 → 로그아웃 후 거절 메시지 표시
      await _auth.signOut();
      window.location.replace(
        'login.html?denied=true&email=' + encodeURIComponent(user.email)
      );
      return;
    }
  } catch(e) {
    console.warn('[tp-firebase] 승인 확인 실패:', e);
    await _auth.signOut();
    window.location.replace('login.html?denied=true');
    return;
  }
  // ─────────────────────────────────────────────────────────────

  // 이미 로그인한 상태에서 login.html 접근 → index로 이동
  if (isLoginPage) {
    window.location.replace('index.html');
    return;
  }

  _uid = user.uid;

  // Firestore에서 이 사용자의 진도 데이터 로드
  try {
    var snap = await _db.collection('progress').doc(_uid).get();
    if (snap.exists) {
      _cache = snap.data() || {};
    }
  } catch(e) {
    console.warn('[tp-firebase] 진도 데이터 로드 실패:', e);
  }

  // 준비 완료 → 대기 중인 콜백 실행
  _ready = true;
  _callbacks.forEach(function(cb) { cb(user); });
  _callbacks = [];
});

// ─── 공개 API ─────────────────────────────────────────────────

/**
 * 인증 및 데이터 로드가 완료되면 콜백을 실행합니다.
 * 각 페이지의 init() 대신 이 함수를 사용합니다.
 * @param {function} callback - (user) => void
 */
window.tpOnReady = function(callback) {
  if (_ready) {
    callback(_auth.currentUser);
  } else {
    _callbacks.push(callback);
  }
};

/**
 * 진도 데이터를 읽습니다 (localStorage.getItem 대체).
 * 값이 없으면 null 반환.
 * @param {string} key
 * @returns {string|null}
 */
window.tpGet = function(key) {
  return _cache[key] !== undefined ? String(_cache[key]) : null;
};

/**
 * 진도 데이터를 저장합니다 (localStorage.setItem 대체).
 * 로컬 캐시에 즉시 반영하고 Firestore에 비동기로 저장.
 * @param {string} key
 * @param {*} value
 */
window.tpSet = function(key, value) {
  _cache[key] = value;
  if (_uid) {
    var update = {};
    update[key] = value;
    _db.collection('progress').doc(_uid)
      .set(update, { merge: true })
      .catch(function(e) {
        console.warn('[tp-firebase] 저장 실패 (' + key + '):', e);
      });
  }
};

/**
 * 로그아웃 처리
 */
window.tpSignOut = function() {
  _auth.signOut().then(function() {
    window.location.replace('login.html');
  });
};

/**
 * 현재 로그인한 사용자 반환
 * @returns {firebase.User|null}
 */
window.tpCurrentUser = function() {
  return _auth.currentUser;
};
