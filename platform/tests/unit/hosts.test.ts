// Séparation www / app : redirections décidées avant le rendu.
import { describe, expect, it } from "vitest";
import { hostRedirect, isSessionCookieName } from "@/lib/routing/hosts";

const config = {
  siteUrl: "https://www.spacora.tech",
  appUrl: "https://app.spacora.tech",
};
const on = (
  host: string | null,
  pathname: string,
  search = "",
  signedIn = false,
) => hostRedirect({ host, pathname, search, signedIn }, config);

describe("hostRedirect", () => {
  it("www sert l'accueil et les pages légales", () => {
    expect(on("www.spacora.tech", "/")).toBeNull();
    expect(on("WWW.spacora.tech", "/cgu")).toBeNull();
    expect(on("www.spacora.tech", "/confidentialite")).toBeNull();
  });

  it("www envoie la connexion, l'inscription et le service sur app, paramètres compris", () => {
    expect(on("www.spacora.tech", "/login")).toBe(
      "https://app.spacora.tech/login",
    );
    expect(on("www.spacora.tech", "/inscription")).toBe(
      "https://app.spacora.tech/inscription",
    );
    expect(on("www.spacora.tech", "/stock", "?alert=low")).toBe(
      "https://app.spacora.tech/stock?alert=low",
    );
  });

  it("app mène au tableau de bord (connecté) ou à la connexion, et sert tout le reste", () => {
    expect(on("app.spacora.tech", "/", "", true)).toBe(
      "https://app.spacora.tech/tableau-de-bord",
    );
    expect(on("app.spacora.tech", "/")).toBe("https://app.spacora.tech/login");
    expect(on("app.spacora.tech", "/carte")).toBeNull();
    expect(on("app.spacora.tech", "/cgu")).toBeNull();
  });

  it("ne redirige rien sans les deux adresses, avec la même adresse, ou sur un autre domaine", () => {
    const request = { host: "localhost:3000", pathname: "/login", search: "" };
    expect(hostRedirect(request, {})).toBeNull();
    expect(
      hostRedirect(request, { appUrl: "https://app.spacora.tech" }),
    ).toBeNull();
    expect(
      hostRedirect(
        { ...request, host: "spacora.tech" },
        { siteUrl: "https://spacora.tech", appUrl: "https://spacora.tech" },
      ),
    ).toBeNull();
    expect(hostRedirect(request, config)).toBeNull();
    expect(on(null, "/")).toBeNull();
    expect(
      hostRedirect(request, { siteUrl: "pas une url", appUrl: "x" }),
    ).toBeNull();
  });

  it("tient compte du port (préproduction)", () => {
    const local = {
      siteUrl: "http://www.spacora.test:3000",
      appUrl: "http://app.spacora.test:3000",
    };
    expect(
      hostRedirect(
        { host: "www.spacora.test:3000", pathname: "/login", search: "" },
        local,
      ),
    ).toBe("http://app.spacora.test:3000/login");
  });

  it("reconnaît le cookie de session Auth.js", () => {
    expect(isSessionCookieName("authjs.session-token")).toBe(true);
    expect(isSessionCookieName("__Secure-authjs.session-token")).toBe(true);
    expect(isSessionCookieName("__Secure-authjs.session-token.1")).toBe(true);
    expect(isSessionCookieName("authjs.csrf-token")).toBe(false);
  });
});
