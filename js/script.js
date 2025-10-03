// Import Firebase SDK (dùng CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

  import { getFirestore, doc, setDoc, getDoc, collection, addDoc } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Config thật từ Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAV4Afp9hY2GOfiuUvVV47pn1NZppGxLsc",
  authDomain: "learning-hub-web-e3e73.firebaseapp.com",
  projectId: "learning-hub-web-e3e73",
  storageBucket: "learning-hub-web-e3e73.firebasestorage.app",
  messagingSenderId: "15900647223",
  appId: "1:15900647223:web:f65bf6b964cb8f251504b2"
};

// 3) Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4) State cục bộ (UI)
let selectedPaymentMethod = "momo";
let currentCourse = null;

// ========= Helpers UI =========
function $(sel) { return document.querySelector(sel); }
function $id(id) { return document.getElementById(id); }

function showModal(modalId) { $id(modalId)?.classList.add("show"); }
function closeModal(modalId) { $id(modalId)?.classList.remove("show"); }

function showLoginModal() { showModal("loginModal"); }
function showRegisterModal() { showModal("registerModal"); }
function switchToRegister() { closeModal("loginModal"); showModal("registerModal"); }
function switchToLogin() { closeModal("registerModal"); showModal("loginModal"); }

function showSuccessMessage(message) {
  $id("successMessage").textContent = message;
  showModal("successModal");
}

function updateNavigation(user) {
  const navActions = $id("navActions");
  if (!navActions) return;
  if (user) {
    navActions.innerHTML = `
      <span style="color:#fff; margin-right:1rem;">Xin chào, ${user.displayName || user.email}!</span>
      <span class="btn btn-secondary" id="btnLogout">Đăng Xuất</span>
    `;
    $id("btnLogout").onclick = logout;
  } else {
    navActions.innerHTML = `
      <span class="btn btn-secondary" onclick="window.showLoginModal()">Đăng Nhập</span>
      <span class="btn btn-primary" onclick="window.showRegisterModal()">Đăng Ký</span>
    `;
  }
}

function showHomePage(){ window.scrollTo({ top: 0, behavior: "smooth" }); }
function scrollToSection(selector){ document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" }); }

// ========= Auth =========
async function registerUser(name, email, password, role) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      fullName: name,
      email: user.email,
      role: role || "student",
      createdAt: serverTimestamp(),
      enrolledCourses: []
    });
  }
  return user;
}

async function loginUser(email, password) {
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const { user } = await signInWithPopup(auth, provider);

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      fullName: user.displayName || "",
      email: user.email,
      role: "student",
      createdAt: serverTimestamp(),
      enrolledCourses: []
    });
  }
  return user;
}

async function logout() {
  await signOut(auth);
  showSuccessMessage("Đăng xuất thành công!");
}

// ========= Courses / Enrollments =========
// Trang của bạn đang render 3 course tĩnh; ta lưu đăng ký vào Firestore:
async function enrollCourse(courseName, price) {
  const user = auth.currentUser;
  if (!user) {
    alert("Bạn cần đăng nhập để đăng ký khóa học!");
    showLoginModal();
    return;
  }

  currentCourse = { name: courseName, price };

  if (!price || price === 0) {
    // Miễn phí: ghi completed ngay
    await addDoc(collection(db, "enrollments"), {
      userId: user.uid,
      courseId: courseName,       // ở bản thật bạn nên dùng id cố định (vd: 'react-basic')
      price: 0,
      enrolledAt: serverTimestamp(),
      paymentStatus: "completed",
      paymentMethod: "free"
    });

    // (Tuỳ chọn) tạo progress record để theo dõi
    await setDoc(doc(db, "progress", `${user.uid}_${courseName}`), {
      userId: user.uid,
      courseId: courseName,
      completedLessons: [],
      startDate: serverTimestamp(),
      lastAccessed: serverTimestamp(),
      progressPercentage: 0
    });

    // (Tuỳ chọn) thêm courseId vào users.enrolledCourses
    await updateDoc(doc(db, "users", user.uid), {
      enrolledCourses: arrayUnion(courseName)
    });

    showSuccessMessage(`Đăng ký khóa "${courseName}" thành công!`);
  } else {
    // Có phí: mở modal thanh toán
    $id("paymentCourseTitle").textContent = courseName;
    $id("paymentAmount").textContent = price.toLocaleString("vi-VN") + "đ";
    showModal("paymentModal");
  }
}

function previewCourse(courseName) {
  showSuccessMessage(`Đang phát video giới thiệu khóa học ${courseName}...`);
}

function selectPaymentMethod(method, ev) {
  selectedPaymentMethod = method;
  document.querySelectorAll(".payment-method").forEach(el => el.classList.remove("selected"));
  ev?.target?.closest(".payment-method")?.classList.add("selected");
}

// ========= Wire forms & listeners =========
function wireForms() {
  // Login form
  const loginForm = $id("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $id("loginEmail").value.trim();
      const password = $id("loginPassword").value.trim();
      try {
        await loginUser(email, password);
        closeModal("loginModal");
        showSuccessMessage("Đăng nhập thành công!");
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Register form
  const registerForm = $id("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $id("registerName").value.trim();
      const email = $id("registerEmail").value.trim();
      const password = $id("registerPassword").value;
      const confirm = $id("confirmPassword").value;
      const role = $id("userRole").value;

      if (password !== confirm) { alert("Mật khẩu xác nhận không khớp!"); return; }
      if (password.length < 6) { alert("Mật khẩu tối thiểu 6 ký tự!"); return; }

      try {
        await registerUser(name, email, password, role);
        closeModal("registerModal");
        showSuccessMessage(`Đăng ký thành công! Chào mừng ${name} đến với LearnHub!`);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Payment form
  const paymentForm = $id("paymentForm");
  if (paymentForm) {
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const user = auth.currentUser;
        if (!user || !currentCourse) { closeModal("paymentModal"); return; }

        closeModal("paymentModal");
        showSuccessMessage("Đang xử lý thanh toán...");

        // (Demo) Giả lập thanh toán thành công sau 1.5s
        setTimeout(async () => {
          await addDoc(collection(db, "enrollments"), {
            userId: user.uid,
            courseId: currentCourse.name,
            price: currentCourse.price,
            enrolledAt: serverTimestamp(),
            paymentStatus: "completed",
            paymentMethod: selectedPaymentMethod
          });

          // (Tuỳ chọn) tạo progress
          await setDoc(doc(db, "progress", `${user.uid}_${currentCourse.name}`), {
            userId: user.uid,
            courseId: currentCourse.name,
            completedLessons: [],
            startDate: serverTimestamp(),
            lastAccessed: serverTimestamp(),
            progressPercentage: 0
          });

          // (Tuỳ chọn) thêm course vào users.enrolledCourses
          await updateDoc(doc(db, "users", user.uid), {
            enrolledCourses: arrayUnion(currentCourse.name)
          });

          showSuccessMessage(`Thanh toán thành công! Bạn đã đăng ký "${currentCourse.name}".`);
        }, 1500);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Đóng modal khi click nền
  window.addEventListener("click", (e) => {
    if (e.target.classList?.contains("modal")) e.target.classList.remove("show");
  });

  // ESC để đóng modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal.show").forEach(m => m.classList.remove("show"));
  });
}

// ========= Auth state listener =========
onAuthStateChanged(auth, (user) => {
  updateNavigation(user);
});

// ========= Gắn hàm lên window để HTML onclick vẫn chạy =========
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.switchToRegister = switchToRegister;
window.switchToLogin = switchToLogin;
window.logout = logout;
window.previewCourse = previewCourse;
window.enrollCourse = enrollCourse;
window.selectPaymentMethod = (m) => selectPaymentMethod(m, event);
window.showHomePage = showHomePage;
window.scrollToSection = scrollToSection;
window.loginWithGoogle = async () => {
  try { await loginWithGoogle(); closeModal("loginModal"); showSuccessMessage("Đăng nhập với Google thành công!"); }
  catch (e) { alert(e.message); }
};
window.registerWithGoogle = async () => {
  try { await loginWithGoogle(); closeModal("registerModal"); showSuccessMessage("Đăng ký với Google thành công!"); }
  catch (e) { alert(e.message); }
};

// ========= Khởi động =========
window.addEventListener("DOMContentLoaded", wireForms);