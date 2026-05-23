"use client";
import "@/styles/tools.scss";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Tools() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const encodedUsername = user ? encodeURIComponent(user.username) : null;

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="left-bar">
      <Link className="linkout ubu-linkout" href="/">𖦹UbuTube</Link>

      {!loading && (
        user ? (
            <>
                <Link href={`/users/${encodedUsername}`} className="linkout ubu-linkout">{user.username}</Link> 
                <a  className="linkout ubu-linkout" onClick={handleLogout}>Log out</a>
            </>
        ) : (
          <div>
            <Link href="/login" className="linkout">Log in</Link> / <Link href="/signup" className="linkout">Sign up</Link>
          </div>
        )
      )}
    </div>
  );
}