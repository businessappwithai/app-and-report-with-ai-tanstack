// Fallback form handler - runs before React hydration
(() => {
  function setupForm() {
    const form = document.querySelector("form");
    if (!form || form._fallbackSetup) return;
    form._fallbackSetup = true;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]').value;
      const password = form.querySelector('input[type="password"]').value;

      if (!email || !password) {
        alert("Please enter email and password");
        return;
      }

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (response.ok && data.user) {
          window.location.href = "/projects";
        } else {
          alert(data.error || "Login failed");
        }
      } catch (error) {
        alert(`Network error: ${error.message}`);
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupForm);
  } else {
    setupForm();
  }

  // Also setup when new forms appear (dynamic content)
  if (window.MutationObserver) {
    new MutationObserver(setupForm).observe(document.body, { childList: true, subtree: true });
  }
})();
