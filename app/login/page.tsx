
import { Suspense } from "react";
export const dynamic = 'force-dynamic';

export default function LoginPage() {

  return (
    <div className="auth-page">
        <Suspense>
          <LoginPage/>
        </Suspense>

    </div>
  );
}