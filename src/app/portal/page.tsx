import DemoPortal from "./demo-portal";

/**
 * Public prototype entry point. It deliberately does not create a Supabase client,
 * fetch authenticated portal APIs, or render production records. All displayed
 * content is synthetic and actions are local to the browser session.
 */
export default function PortalPage() {
  return <DemoPortal />;
}
