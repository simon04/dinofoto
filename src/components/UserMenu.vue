<template>
  <span v-if="loginAvailable" class="dd-user">
    <template v-if="username">
      <a
        :href="`https://commons.wikimedia.org/wiki/User:${encodeURIComponent(username)}`"
        target="_blank"
        rel="external noopener"
      >
        <cdx-icon :icon="cdxIconUserAvatar" size="small" />
        {{ username }}
      </a>
      <cdx-button
        weight="quiet"
        :aria-label="t('logout')"
        v-tooltip="t('logout')"
        @click="logout"
      >
        <cdx-icon :icon="cdxIconLogOut" />
      </cdx-button>
    </template>
    <cdx-button v-else weight="quiet" @click="onLogin">
      <cdx-icon :icon="cdxIconLogIn" />
      {{ t("login") }}
    </cdx-button>
  </span>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { CdxButton, CdxIcon, useToast } from "@wikimedia/codex";
import {
  cdxIconLogIn,
  cdxIconLogOut,
  cdxIconUserAvatar,
} from "@wikimedia/codex-icons";
import { loginAvailable, useAuth } from "../auth";

const { username, login, logout } = useAuth();
const toast = useToast();

async function onLogin() {
  try {
    await login();
  } catch (e) {
    // closing the popup is not an error worth reporting
    if (!String(e).includes("closed"))
      toast.error(t("login-failed", String(e)));
  }
}
</script>

<style scoped>
.dd-user {
  display: flex;
  align-items: center;
  gap: var(--spacing-25);
  white-space: nowrap;
}
.dd-user a {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25);
}
</style>
