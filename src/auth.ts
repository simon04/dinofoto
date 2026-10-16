import { createGlobalState } from "@vueuse/core";
import { UserManager, type User } from "oidc-client-ts";
import { computed, shallowRef } from "vue";

/**
 * Login with Wikimedia OAuth 2.0 (authorization code with PKCE, public
 * client), via a popup so that the opened directory and edits are kept.
 * https://www.mediawiki.org/wiki/OAuth/For_Developers
 */

const OAUTH = "https://commons.wikimedia.org/w/rest.php/oauth2";
const { VITE_OAUTH_CLIENT_ID: clientId, VITE_OAUTH_REDIRECT_URI: redirectUri } =
  import.meta.env;

/** Profile from the OAuth "profile" resource (no OpenID Connect ID token). */
export interface Profile {
  sub: string;
  username: string;
}

/** Only where the registered callback is served, e.g. not on GitHub Pages. */
export const loginAvailable =
  !!clientId &&
  !!redirectUri &&
  new URL(redirectUri).origin === location.origin;

let manager: UserManager | undefined;
function userManager(): UserManager {
  manager ??= new UserManager({
    authority: OAUTH,
    // no OIDC discovery: endpoints of the MediaWiki OAuth extension
    metadata: {
      issuer: OAUTH,
      authorization_endpoint: `${OAUTH}/authorize`,
      token_endpoint: `${OAUTH}/access_token`,
      userinfo_endpoint: `${OAUTH}/resource/profile`,
    },
    client_id: clientId,
    redirect_uri: redirectUri,
    popup_redirect_uri: redirectUri,
    // grants of the consumer; without "openid", no ID token is expected
    scope: "basic editpage createeditmovepage uploadfile uploadeditmovefile",
    // username from the profile resource
    loadUserInfo: true,
    // access tokens expire after an hour, renewed with the refresh token
    automaticSilentRenew: true,
  });
  return manager;
}

/** Handle the OAuth callback (popup or redirect); true if this is the callback page. */
export async function handleCallback(): Promise<boolean> {
  if (!loginAvailable || location.href.split("?")[0] !== redirectUri)
    return false;
  const user = await userManager().signinCallback();
  // redirect flow (popup blocked): back to the app
  if (!window.opener)
    location.replace(
      new URL(`./${(user?.state as string) ?? ""}`, location.href),
    );
  return true;
}

export const useAuth = createGlobalState(() => {
  const user = shallowRef<User | null>(null);
  if (loginAvailable) {
    const m = userManager();
    m.getUser()
      .then(async (u) => {
        // expired since the last visit: renew with the refresh token
        if (u?.expired && u.refresh_token)
          u = await m.signinSilent().catch(() => null);
        user.value = u && !u.expired ? u : null;
      })
      .catch(console.warn);
    m.events.addUserLoaded((u) => {
      user.value = u;
    });
    m.events.addUserUnloaded(() => {
      user.value = null;
    });
    m.events.addSilentRenewError(() => {
      user.value = null;
    });
  }
  const profile = computed(() => user.value?.profile as Profile | undefined);

  async function login() {
    try {
      await userManager().signinPopup();
    } catch (e) {
      // popup blocked: full-page redirect, the opened directory is lost
      if (String(e).includes("Popup"))
        await userManager().signinRedirect({ state: location.hash });
      else throw e;
    }
  }

  async function logout() {
    await userManager().removeUser();
  }

  return {
    user,
    /** Wikimedia username of the logged-in user */
    username: computed(() => profile.value?.username),
    /** current access token, for `Authorization: Bearer` */
    accessToken: computed(() => user.value?.access_token),
    login,
    logout,
  };
});
