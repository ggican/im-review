import { Outlet } from "react-router-dom";

import { AppChrome } from "@/components/layout/AppChrome";

/** Authenticated desktop shell: chrome + page content. */
export function AuthenticatedLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-on-background">
      <AppChrome />
      <div className="mx-auto flex w-full max-w-[1140px] flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
