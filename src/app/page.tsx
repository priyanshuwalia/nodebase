import React from "react";

import { requireAuth } from "@/lib/auth-utils";
const page = async () => {
  await requireAuth();

  return <div>Protected Server Components</div>;
};

export default page;
