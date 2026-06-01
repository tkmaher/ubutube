
import LoginPage from "@/components/auth/loginPage";
import { Suspense } from "react";
export const dynamic = 'force-dynamic';

export default function Page() {

  return (
    <div className="auth-page">
        <Suspense>
          <LoginPage/>
        </Suspense>

    </div>
  );
}