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
        <div className="header">
            <div className="tabs">
                <Link className="linkout" href="/">𖦹UbuTube</Link>
            </div>
            <div className="tabs">
                <Link className="linkout" href="/about">About</Link>
            </div>
            <div className="tabs">
                <a href="" className="linkout">Report a bug!</a>
            </div>
        </div>

        <div className="footer">
            
            {!loading && (
                user ? (
                    <>
                        <div className="tabs">
                            <Link href={`/users/${encodedUsername}`} className="linkout">{user.username}</Link> 
                        </div>
                        <div className="tabs">
                            <a className="linkout" onClick={handleLogout}>Log out</a>
                        </div>
                    </>
                ) : (
                <div className="tabs">
                    <Link href="/login" className="linkout">Log in</Link> / <Link href="/signup" className="linkout">Sign up</Link>
                </div>
                )
            )}

        </div>
    </div>
  );
}