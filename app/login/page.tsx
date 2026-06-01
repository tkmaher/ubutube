
import { Suspense } from "react";

export default function LoginPage() {

  return (
    <div className="auth-page">
        <Suspense>
          <LoginPage/>
        </Suspense>

    </div>
  );
}