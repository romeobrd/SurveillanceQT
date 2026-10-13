// Séparation www / app : redirections décidées avant le rendu.
import { describe, expect, it } from "vitest";
import { hostRedirect, isSessionCookieName } from "@/lib/routing/hosts";

const config = {
  siteUrl: "https://www.isoplan.fr",
  appUrl: "https://app.isoplan.fr",
};
const on = (
  host: string | null,
  pathname: string,
  search = "",
  signedIn = false,
) => hostRedirect({ host, pathname, search, signedIn }, config);

describe("hostRedirect", () => {
  it("www sert l'accueil et les pages légales", () => {
    expect(on("www.isoplan.fr", "/")).toBeNull();
    expect(on("WWW.isoplan.fr", "/cgu")).toBeNull();
    expect(on("www.isoplan.fr", "/confidentialite")).toBeNull();
  });

  it("www envoie la connexion, l'inscription et le service sur app, paramètres compris", () => {
    expect(on("www.isoplan.fr", "/login")).toBe("https://app.isoplan.fr/login");
    expect(on("www.isoplan.fr", "/inscription")).toBe(
      "https://app.isoplan.fr/inscription",
    );
    expect(on("www.isoplan.fr", "/stock", "?alert=low")).toBe(
      "https://app.isoplan.fr/stock?alert=low",
    );
  });

  it("app mène au tableau de bord (connecté) ou à la connexion, et sert tout le reste", () => {
    expect(on("app.isoplan.fr", "/", "", true)).toBe(
      "https://app.isoplan.fr/tableau-de-bord",
    );
    expect(on("app.isoplan.fr", "/")).toBe("https://app.isoplan.fr/login");
    expect(on("app.isoplan.fr", "/carte")).toBeNull();
    expect(on("app.isoplan.fr", "/cgu")).toBeNull();
  });

  it("ne redirige rien sans les deux adresses, avec la même adresse, ou sur un autre domaine", () => {
    const request = { host: "localhost:3000", pathname: "/login", search: "" };
    expect(hostRedirect(request, {})).toBeNull();
    expect(
      hostRedirect(request, { appUrl: "https://app.isoplan.fr" }),
    ).toBeNull();
    expect(
      hostRedirect(
        { ...request, host: "isoplan.fr" },
        { siteUrl: "https://isoplan.fr", appUrl: "https://isoplan.fr" },
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
      siteUrl: "http://www.isoplan.test:3000",
      appUrl: "http://app.isoplan.test:3000",
    };
    expect(
      hostRedirect(
        { host: "www.isoplan.test:3000", pathname: "/login", search: "" },
        local,
      ),
    ).toBe("http://app.isoplan.test:3000/login");
  });

  it("reconnaît le cookie de session Auth.js", () => {
    expect(isSessionCookieName("authjs.session-token")).toBe(true);
    expect(isSessionCookieName("__Secure-authjs.session-token")).toBe(true);
    expect(isSessionCookieName("__Secure-authjs.session-token.1")).toBe(true);
    expect(isSessionCookieName("authjs.csrf-token")).toBe(false);
  });
});
