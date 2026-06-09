const API = "https://ubu-worker.tomaszkkmaher.workers.dev";

export type AuthUser = { id: string; username: string; email: string; bookmarks: string; link: string };

const call = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json();
  // console.log("API response:", { path, init, res, data });
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
};

export const register = (username: string, email: string, password: string) =>
  call("/api/auth/register", { method: "POST", body: JSON.stringify({ username, email, password }) });

export const login = async (email: string, password: string): Promise<AuthUser> =>
  (await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })).user;

export const logout = () =>
  call("/api/auth/logout", { method: "POST" });

export const getMe = async (): Promise<AuthUser | null> => {
  try { return (await call("/api/auth/me")).user; }
  catch { return null; }
};

export const verifyEmail = (token: string) =>
  call("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });

export const forgotPassword = (email: string) =>
  call("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });

export const resetPassword = (token: string, password: string) =>
  call("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });

export const deleteAccount = (password: string) =>
  call("/api/auth/account", { method: "DELETE", body: JSON.stringify({ password }) });

export const modifyBookmark = (bookmarks: string) =>
  call("/api/auth/bookmark", { method: "POST", body: JSON.stringify({ bookmarks }) });

export const postComment = (film_id: string, film_name: string, comment: string) =>
  call("/api/auth/comments", { method: "POST", body: JSON.stringify({ "film_id": film_id, "film_name": film_name, "comment": comment }) });

export const deleteComment = (date: string, film_id: string) =>
  call("/api/auth/comments", { method: "DELETE", body: JSON.stringify({ "date": date, "film_id": film_id }) });

export const editUser = ( link: string, username: string) => 
  call("/api/auth/edit", { method: "POST", body: JSON.stringify({"link": link, "username": username }) });

export const deleteUser = ( password: string ) => 
  call("/api/auth/account", { method: "DELETE", body: JSON.stringify({"password": password }) });
