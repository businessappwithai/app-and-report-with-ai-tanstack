/**
 * The sign-in screen.
 *
 * It shows the seeded credentials. That looks wrong for a second and then does
 * not: the database is a file in the reader's own browser, created by the page
 * they are looking at, so there is no one to keep the password from. Hiding it
 * would only produce an application that cannot be opened by the person it was
 * generated for.
 *
 * It lists **every** seeded account rather than only the administrator, and
 * says how many entities each role can see. The administrator bypasses every
 * restriction the model wrote, so an application you can only sign into as the
 * administrator is one whose access control you cannot look at — the row
 * reading `support.agent@… · 5 of 17` is the invitation to try it. Clicking a
 * row fills the form, because retyping an address to compare two roles is the
 * kind of friction that stops people comparing them.
 */

import { el, mount, toast } from "../dom.js";
import { api, setToken } from "../api.js";

export async function loginView(root, { project, onSignedIn }) {
  let config = null;
  try {
    config = await api.get("/auth/config");
  } catch {
    // The sign-in screen still works without the hint.
  }
  const seeded = config?.seededAdmin ?? null;
  const accounts = config?.seededAccounts ?? [];

  const email = el("input.field__input", {
    type: "text",
    id: "email",
    name: "email",
    autocomplete: "username",
    value: seeded?.email ?? "",
    required: true,
  });
  const password = el("input.field__input", {
    type: "password",
    id: "password",
    name: "password",
    autocomplete: "current-password",
    value: seeded?.password ?? "",
    required: true,
  });
  const submit = el("button.btn.btn--primary", { type: "submit" }, "Sign in");

  const form = el(
    "form.login__form",
    {
      onsubmit: async (event) => {
        event.preventDefault();
        submit.disabled = true;
        submit.textContent = "Signing in…";
        try {
          const result = await api.post("/auth/login", {
            email: email.value.trim(),
            password: password.value,
          });
          // Before anything else calls the API: the very next request is the
          // one that loads the model, and without the token it is a 401 that
          // reads as "your session ended" a quarter-second after signing in.
          setToken(result.token);
          onSignedIn(result.user);
        } catch (error) {
          toast(error.message, "error");
          submit.disabled = false;
          submit.textContent = "Sign in";
          password.focus();
        }
      },
    },
    el(
      "div.field",
      el("div.field__head", el("label.field__label", { for: "email" }, "Email or username"), el("span.chip.chip--text", "Text")),
      email
    ),
    el(
      "div.field",
      el("div.field__head", el("label.field__label", { for: "password" }, "Password"), el("span.chip.chip--text", "Password")),
      password
    ),
    submit
  );

  mount(
    root,
    el(
      "div.login",
      el(
        "div.login__panel",
        el("div.login__mark", initials(project.name)),
        el("h1.login__title", project.name),
        el("p.login__subtitle", project.description || "Generated from an EML model"),
        form,
        accounts.length > 1
          ? el(
              "div.accounts",
              el(
                "p.accounts__head",
                `${accounts.length} seeded accounts, password `,
                el("code", seeded?.password ?? "admin"),
                config?.scoped
                  ? ". Each role sees only its own entities — pick one to try it."
                  : ". Pick one to fill the form."
              ),
              el(
                "ul.accounts__list",
                ...accounts.map((account) =>
                  el(
                    "li",
                    el(
                      "button.accounts__row",
                      {
                        type: "button",
                        onclick: () => {
                          email.value = account.email;
                          password.value = account.password;
                          password.focus();
                        },
                      },
                      el("span.accounts__role", account.role),
                      el("span.accounts__email", account.email),
                      el(
                        "span.accounts__scope",
                        account.isAdmin
                          ? `all ${config?.totalEntities ?? account.entities} entities`
                          : /* Zero is a real answer, not a broken seed: this is
                               the account holding no functional role, and an
                               empty application is the point of it. Said plainly
                               here, because a card reading "0 of 28" and nothing
                               else looks like the generator failed. */
                            account.entities === 0
                            ? "no entities — signed in, holding no role"
                            : `${account.entities} of ${config?.totalEntities ?? account.entities} entities`
                      )
                    )
                  )
                )
              )
            )
          : seeded
            ? el(
                "p.login__hint",
                `Seeded administrator: ${seeded.email} / ${seeded.password}. `,
                el("span.login__hint-note", "The database lives in this browser only.")
              )
            : null
      ),
      el(
        "div.login__aside",
        el("h2", "Running entirely in this tab"),
        el(
          "ul.login__facts",
          el("li", el("strong", "PostgreSQL 18"), " compiled to WebAssembly — a real server, not a shim"),
          el("li", el("strong", "The application server"), " on a Worker with a Node-API runtime"),
          el("li", el("strong", "A Service Worker"), " answering this page's own /api requests"),
          el("li", el("strong", "No network"), " after load, and no data leaves the browser")
        )
      ),
      el(
        "p.login__footer",
        "Built with ",
        el("a", { href: "http://www.appwithai.org", target: "_blank", rel: "noopener noreferrer" }, "APPWITHAI")
      )
    )
  );

  email.focus();
}

const initials = (name) =>
  String(name)
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("") || "AP";
