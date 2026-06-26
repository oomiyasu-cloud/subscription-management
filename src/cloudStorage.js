import { normalizeState } from "./storage.js";

const SESSION_KEY = "subscription-management:cloud-session";

export function createCloudClient({ config, storage = localStorage, fetchImpl = fetch }) {
  const supabaseUrl = String(config.supabaseUrl ?? "").replace(/\/$/, "");
  const supabaseAnonKey = String(config.supabaseAnonKey ?? "");

  const request = async (path, options = {}) => {
    const response = await fetchImpl(`${supabaseUrl}${path}`, {
      ...options,
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message || "クラウドとの通信に失敗しました。");
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const saveSession = (session) => {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const getSession = () => {
    try {
      const raw = storage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  return {
    isConfigured() {
      return Boolean(supabaseUrl && supabaseAnonKey);
    },

    getSession,

    async signIn(email, password) {
      const session = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveSession(session);
      return session;
    },

    async signUp(email, password) {
      const session = await request("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveSession(session);
      return session;
    },

    signOut() {
      storage.removeItem(SESSION_KEY);
    },

    async loadState(session) {
      const userId = session?.user?.id;
      if (!userId) {
        return null;
      }

      const rows = await request(`/rest/v1/app_states?select=data&user_id=eq.${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      return rows[0]?.data ? normalizeState(rows[0].data) : null;
    },

    async saveState(session, state) {
      const userId = session?.user?.id;
      if (!userId) {
        return false;
      }

      await request("/rest/v1/app_states?on_conflict=user_id", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: userId,
          data: normalizeState(state),
          updated_at: new Date().toISOString(),
        }),
      });
      return true;
    },
  };
}

async function readErrorMessage(response) {
  try {
    const body = await response.json();
    return body.msg || body.message || body.error_description || body.error || "";
  } catch {
    return "";
  }
}
