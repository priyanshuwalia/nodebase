import { LoginForm } from "@/features/auth/components/Login-form";
import { requireUnauth } from "@/lib/auth-utils";
import React from "react";

const page = async () => {
  await requireUnauth();
  return (
    <div>
      <LoginForm />
    </div>
  );
};

export default page;
