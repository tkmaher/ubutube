"use client";
import "@/styles/tools.scss";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Tools() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const encodedUsername = user ? encodeURIComponent(encodeURIComponent(user.username)) : null;

  const handleLogout = async () => {
    await logout();
    router.refresh();
  };

  return (
    <>
        <div className="left-header">
            <Link className="linkout" href="/" style={{lineHeight: 1}}>
                <div className="spiral">𖦹</div>
                UbuTube
            </Link>
        </div>
        <div className="left-bar">
            <div className="header">
                <Link className="linkout ubu-linkout" href="/about">About</Link>
                <Link className="linkout ubu-linkout" href="/userlist">Users</Link>
            </div>

            <div className="footer" style={{ opacity: loading ? 0 : 1}}>
                
                {!loading && (
                    user ? (
                        <>
                            <Link href={`/users/${encodedUsername}`} className="linkout ubu-linkout">{user.username}</Link> 
                            <a className="linkout ubu-linkout" onClick={handleLogout}>Log out</a>
                        </>
                    ) : (
                    <div>
                        <Link href="/login" className="linkout">Log in</Link>/<Link href="/signup" className="linkout">Sign up</Link>
                    </div>
                    )
                )}
                    <a href="mailto:admin@ubutube.org" target="_blank" className="linkout ubu-linkout">
                        Contact us
                    </a>
                    <a href="mailto:bugreport@ubutube.org" target="_blank" className="linkout ubu-linkout">
                        Report a bug!
                    </a>

            </div>
        </div>
    </>
    
  );
}